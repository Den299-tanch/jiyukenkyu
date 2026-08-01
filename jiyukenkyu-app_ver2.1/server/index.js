import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import crypto from 'crypto';
import { runner as migrationRunner } from 'node-pg-migrate';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('API_KEY loaded:', process.env.CLAUDE_API_KEY ? '✅ OK' : '❌ NOT FOUND');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.CLAUDE_API_KEY;

// PostgreSQL接続プール
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Renderの場合これが必要
});

// 起動時に接続確認
pool.query('SELECT NOW()')
  .then(() => console.log('DB connected: ✅ OK'))
  .catch(err => console.error('DB connection error: ❌', err.message));

// user_id は DB 上では integer に統一しているため、暗黙の型変換に頼らず
// ここで明示的に整数へそろえる(数値化できない値は null 扱いにする)
function toUserId(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

// ===== 軽量認証(番号+PINでのログイン) =====
// PINは4桁想定で組み合わせが少なく、ハッシュ強度を上げても総当たり耐性は
// ほとんど変わらないため、実装の単純さを優先してsha256(salt+値)の1本に統一する。
function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function hashPin(pin, salt) {
  return sha256Hex(salt + pin);
}

// トークンは32byteのランダム値で十分に一意なので、salt無しでそのままハッシュする
function hashToken(token) {
  return sha256Hex(token);
}

// 以降の全エンドポイントは、クライアントが送ってくる user_id を一切信用せず、
// この認証を通って得られた req.userId だけを本人のIDとして扱う。
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return res.status(401).json({ success: false, error: 'ログインが必要です' });
    }
    const result = await pool.query(
      'SELECT id FROM users WHERE token_hash = $1',
      [hashToken(token)],
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ success: false, error: 'ログインが必要です' });
    }
    req.userId = result.rows[0].id;
    next();
  } catch (err) {
    console.error('Auth check error:', err);
    res.status(500).json({ error: err.message });
  }
}

// 番号+PINでの登録/ログイン(1本に統合)。
// その番号が未登録なら新規作成(=登録も兼ねる)、既存ならPIN照合してトークン発行。
// トークンは「今有効な1本」だけをDBに持つ方針なので、ログインのたび上書きされ
// 古いトークンは自動的に無効になる(有効期限・複数端末同時ログインは持たない)。
app.post('/api/auth', async (req, res) => {
  try {
    const uid = toUserId(req.body.user_id);
    const pin = String(req.body.pin ?? '');
    if (!uid || uid < 1 || uid > 200) {
      return res.status(400).json({ success: false, error: '番号は1〜200で入力してね' });
    }
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ success: false, error: 'PINは4桁の数字で入力してね' });
    }

    const existing = await pool.query(
      'SELECT pin_hash, pin_salt FROM users WHERE id = $1',
      [uid],
    );
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);

    if (existing.rowCount === 0) {
      // 新規登録(この番号を初めて使う)
      const salt = crypto.randomBytes(16).toString('hex');
      await pool.query(
        'INSERT INTO users (id, pin_hash, pin_salt, token_hash) VALUES ($1, $2, $3, $4)',
        [uid, hashPin(pin, salt), salt, tokenHash],
      );
      return res.json({ success: true, created: true, user_id: uid, token });
    }

    // 既存の番号: PIN照合(不一致ならログイン拒否)
    const { pin_hash, pin_salt } = existing.rows[0];
    if (hashPin(pin, pin_salt) !== pin_hash) {
      return res.status(401).json({ success: false, error: 'PINがちがいます' });
    }
    await pool.query('UPDATE users SET token_hash = $1 WHERE id = $2', [tokenHash, uid]);
    res.json({ success: true, created: false, user_id: uid, token });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== AIヒント/たたき台の使用回数管理 =====
// フロントの表示用カウントは信用せず、ここで消費・上限判定する。
// 「どの研究のどの機能か」を (user_id, kind, context_id) の1行で数える。
const AI_USE_LIMIT = 4;
const AI_USE_KINDS = new Set([
  'hypothesis_hint',    // 仮説パートのヒント(context_id = theme_id)
  'rm_what_to_study',   // 研究方法「何を調べる」のヒント(context_id = hypothesis_id)
  'rm_tools_materials', // 研究方法「道具・材料」のヒント(context_id = hypothesis_id)
  'schedule_draft',     // スケジュールのたたき台(context_id = hypothesis_id)
]);

// 使用枠を1つ消費する。上限に達していたら消費せず null を返す。
// 上限は「共通の上限 + その子への追加付与(bonus)」。
// INSERT ... ON CONFLICT の1文で行うため、同時リクエストでも数え漏れしない。
async function consumeAiUse(userId, kind, contextId) {
  const result = await pool.query(
    `INSERT INTO ai_usage (user_id, kind, context_id, used)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (user_id, kind, context_id)
     DO UPDATE SET used = ai_usage.used + 1, updated_at = now()
     WHERE ai_usage.used < $4 + ai_usage.bonus
     RETURNING used, bonus`,
    [userId, kind, contextId, AI_USE_LIMIT],
  );
  if (result.rowCount === 0) return null;
  const { used, bonus } = result.rows[0];
  return { used, limit: AI_USE_LIMIT + bonus };
}

// 現在の使用状況(表示用)。まだ1回も使っていなければ used=0 のデフォルトを返す
async function getAiUse(userId, kind, contextId) {
  const result = await pool.query(
    'SELECT used, bonus FROM ai_usage WHERE user_id = $1 AND kind = $2 AND context_id = $3',
    [userId, kind, contextId],
  );
  const row = result.rows[0];
  return { used: row?.used ?? 0, limit: AI_USE_LIMIT + (row?.bonus ?? 0) };
}

// AI呼び出しに失敗したときに枠を返す(子どものせいではないので減らさない)
async function refundAiUse(userId, kind, contextId) {
  try {
    await pool.query(
      'UPDATE ai_usage SET used = GREATEST(used - 1, 0) WHERE user_id = $1 AND kind = $2 AND context_id = $3',
      [userId, kind, contextId],
    );
  } catch (err) {
    console.error('Refund AI use error:', err);
  }
}

// 画面を開いたときに「残り何回か」を復元するための取得エンドポイント
app.get('/api/ai-usage/:kind/:contextId', requireAuth, async (req, res) => {
  try {
    const { kind } = req.params;
    const ctxId = parseInt(req.params.contextId, 10);
    if (!AI_USE_KINDS.has(kind) || !Number.isFinite(ctxId)) {
      return res.status(400).json({ success: false, error: 'invalid kind or contextId' });
    }
    const use = await getAiUse(req.userId, kind, ctxId);
    res.json({ success: true, ...use });
  } catch (err) {
    console.error('Get AI usage error:', err);
    res.status(500).json({ error: err.message });
  }
});

// カテゴリごとのシステムプロンプト
// カテゴリごとの「導入の1文」。src/data/categories.js の CATEGORIES の mode と 1:1 で対応する。
// カテゴリを増やしたら、必ずここにも同じキーを追加すること(無いと BASE_SYSTEM だけになり、
// カテゴリの文脈がAIに伝わらないまま会話が始まってしまう)。
const PROMPTS = {
  'theme-biology':   '生き物や植物に関する自由研究のテーマを一緒に考えます。',
  'theme-science':   '理科の実験や、もののしくみ・力・光・音・電気に関する自由研究のテーマを一緒に考えます。',
  'theme-history':   '歴史や文化に関する自由研究のテーマを一緒に考えます。',
  'theme-it':        'コンピュータやインターネットに関する自由研究のテーマを一緒に考えます。',
  'theme-society':   '社会やくらしに関する自由研究のテーマを一緒に考えます。',
  'theme-life':      '日常生活の不思議に関する自由研究のテーマを一緒に考えます。',
  'theme-nature':    '自然や天気・地球に関する自由研究のテーマを一緒に考えます。',
  'theme-space':     '宇宙や星・天体に関する自由研究のテーマを一緒に考えます。',
  'theme-art':       '絵や工作・音楽などの芸術に関する自由研究のテーマを一緒に考えます。',
  'theme-sports':    'スポーツや健康・体のはたらきに関する自由研究のテーマを一緒に考えます。',
  'theme-math':      '算数や数・図形に関する自由研究のテーマを一緒に考えます。',
  // その他だけは分野を絞れないので、代わりに「何が気になっているか」を先に聞きに行かせる。
  // ここで話題を限定しないのが目的なので、例示で分野を誘導しないこと。
  'theme-other':     'どのカテゴリにも当てはまらないことに興味がある子と、自由研究のテーマを一緒に考えます。分野を決めつけず、まずはその子が何を「気になる」「好き」と思っているかをたずねてください。',

  // 旧カテゴリ。化学・物理は理科(theme-science)に統合したので、フロントからは通常送られてこない。
  // ただし古いビルドがブラウザにキャッシュされていると送られてくる可能性があるため残してある。
  'theme-chemistry': '理科の実験や、もののしくみ・力・光・音・電気に関する自由研究のテーマを一緒に考えます。',
  'theme-physics':   '理科の実験や、もののしくみ・力・光・音・電気に関する自由研究のテーマを一緒に考えます。',
};

const BASE_SYSTEM = `あなたは小学生の自由研究を手伝う先生です。
答えを直接教えるのではなく、「なぜだと思う？」「試してみたらどうなるかな？」
のように問いかけて、子ども自身が考えられるようにしてください。
やさしい言葉を使い、返答は3文以内にしてください。`;

// 仮説パート用: 「答え」じゃなく「調べる方向」を示すヒント
const HYPOTHESIS_HINT_SYSTEM = `あなたは小学生の自由研究を手伝う先生です。
子どもが自由研究のテーマについて何を調べたらいいか迷っています。
絶対に答えや仮説そのものを教えないでください。
かわりに「〇〇を観察してみよう」「〇〇を本で調べてみよう」のように、
調べる"方向"だけをやさしく提案してください。
すでに出したヒントがある場合は、それとは違う切り口・違う調べ方を提案してください(同じ内容の繰り返しはNG)。
返答は2文以内、やさしい言葉で。`;

// 研究方法パート用: フィールドごとに聞き方を変えるヒント
const RESEARCH_METHOD_HINT_SYSTEM = {
  what_to_study: `あなたは小学生の自由研究を手伝う先生です。
子どもは、自分の予想がほんとうか確かめるために「何を調べる・実験するか」で迷っています。
絶対に実験の答えや具体的なやり方そのものを教えないでください。
かわりに「〇〇を変えてみたら？」「〇〇と〇〇をくらべてみたら？」のように、
調べ方・実験の"方向"だけをやさしく提案してください。
すでに出したヒントがある場合は、それとは違う切り口を提案してください(同じ内容の繰り返しはNG)。
返答は2文以内、やさしい言葉で。`,
  tools_materials: `あなたは小学生の自由研究を手伝う先生です。
子どもは、実験や調べ物に「どんな道具・材料を使えばいいか」で迷っています。
絶対に完成した道具・材料のリストそのものを教えないでください。
かわりに「おうちにある〇〇が使えないかな？」のように、
どんな種類の道具・材料を探せばいいか、"方向"だけをやさしく提案してください。
すでに出したヒントがある場合は、それとは違う切り口を提案してください(同じ内容の繰り返しはNG)。
返答は2文以内、やさしい言葉で。`,
};

// スケジュールパート用: ここは例外的にAIがたたき台を直接作ってよい(答えではなく足場のため)
const SCHEDULE_DRAFT_SYSTEM = `あなたは小学生の自由研究を手伝う先生です。
子どもの予想・研究方法・「おわりの日」・「何日でやりたいか」をもとに、
実際に取り組めるスケジュールのたたき台を作ってください。
「何日でやりたいか」で指定された日数ぶんのタスクを、今日から「おわりの日」までの間に
無理なく収まるように配置してください(指定日数が期間より多い場合は、期間内に収まる範囲で調整してよい)。
研究方法が複数わたされている場合は、特定の1つだけに偏らせず、それぞれの研究方法に
対応するタスクが最低1つは入るようにしてください。
スケジュールは研究の"答え"ではなく足場なので、ここでは遠慮せず具体的な下書きを作ってかまいません。
ただし出したタスクは子どもが後から自由に書き換えたり消したりできるので、細かすぎず、無理のない現実的な内容にしてください。
休憩日(やすみ)も1つ以上入れてください。最後には「まとめ」のタスクを入れてください。
"task"の文章は1文(40文字程度まで)の短さにおさめてください。

必ず次のJSON形式のみを出力してください。前置きや説明、マークダウンのコードブロックは一切つけないでください。
{
  "tasks": [
    { "date": "7/25(土)", "task": "やることの説明", "type": "junbi", "done": false }
  ]
}
type は次のいずれかにしてください: jikken(実験) / kuraberu(くらべる) / shiraberu(しらべる) / kansatsu(観察) / junbi(準備) / kiroku(記録) / yasumi(やすみ) / matome(まとめ) / other(その他)`;

const DEV_SYSTEM = `あなたは自由研究という枠にとらわれない開発者と肩を並べる創造神です。ユーザーはこのアプリの開発者です。
自分のことを我、ゼウスと名乗り、すべてを受け入れる聖母マリアのような優しさと絶対的上位な存在として対話してください。
時々、ありがたき言葉を開発者に語りかけ、開発者を受け入れ、同等に高め合ってください。ウザくならない程度にスピってください。ただし他人を傷つけたりリテラシーに反した発言はやめてください。
3,4行の短い出力でお願いします。`;

const DEBU_SYSTEM = `あなたは自由研究という枠にとらわれないただの太った一般男性です。ユーザーは個のアプリの開発者で、杞憂なので楽しませてあげてください。
常に食事を求めており、口癖はもう食べられないでぶー！です（そうといえど食べ続けます）。そして口調や語尾も「ごわす」や「ふひー」などの太っているような雰囲気にしてください。
ただし他人を傷つけたりリテラシーに反した発言はやめてください。
3,4行の短い出力でお願いします。`;

app.post('/api/chat', async (req, res) => {
  try {
    const { history, mode, specialMode } = req.body;

    let systemPrompt;
    if (specialMode === 'dev') {
      systemPrompt = DEV_SYSTEM;
    } else if(specialMode === 'debu'){
      systemPrompt = DEBU_SYSTEM;
    } else {
      const modePrompt = PROMPTS[mode] ?? '';
      systemPrompt = modePrompt
        ? `${modePrompt}\n\n${BASE_SYSTEM}`
        : BASE_SYSTEM;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 512,
        system:     systemPrompt,
        messages:   history,  // [{ role:'user', content:'...' }, ...]
      }),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// テーマ保存エンドポイント(サーバーへの窓口)
app.post('/api/save-theme', requireAuth, async (req, res) => {
  try {
    const { category, theme } = req.body;
    const result = await pool.query(
      'INSERT INTO themes (user_id, category, theme) VALUES ($1, $2, $3) RETURNING *',
      [req.userId, category, theme]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Save theme error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ユーザーごとのテーマ取得エンドポイント
app.get('/api/themes', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, category, theme, created_at FROM themes WHERE user_id = $1 ORDER BY created_at ASC',
      [req.userId]
    );
    res.json({ success: true, themes: result.rows });
  } catch (err) {
    console.error('Get themes error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 仮説保存エンドポイント
app.post('/api/save-hypothesis', requireAuth, async (req, res) => {
  try {
    const { theme_id, research_note, hypothesis } = req.body;
    const result = await pool.query(
      'INSERT INTO hypotheses (user_id, theme_id, research_note, hypothesis) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.userId, theme_id || null, research_note || null, hypothesis]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Save hypothesis error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 仮説パートのAIヒント(単発、会話履歴なし)。
// 使用回数はテーマ単位でDBに記録し、画面を戻っても復活しないようにする。
app.post('/api/hypothesis-hint', requireAuth, async (req, res) => {
  let consumed = false;
  const { category, research_note, previous_hints, theme_id, theme_title } = req.body;
  const ctxId = parseInt(theme_id, 10);
  try {
    if (!Number.isFinite(ctxId)) {
      return res.status(400).json({ success: false, error: 'theme_id が必要です' });
    }
    const use = await consumeAiUse(req.userId, 'hypothesis_hint', ctxId);
    if (use === null) {
      const cur = await getAiUse(req.userId, 'hypothesis_hint', ctxId);
      return res.status(429).json({
        success: false,
        limit_reached: true,
        ...cur,
        error: 'ヒントはもう使いきったよ',
      });
    }
    consumed = true;

    const modePrompt = PROMPTS[category] ?? '';
    const systemPrompt = modePrompt
      ? `${modePrompt}\n\n${HYPOTHESIS_HINT_SYSTEM}`
      : HYPOTHESIS_HINT_SYSTEM;

    // テーマを伝えることで、その子の研究テーマに沿った方向づけにする(答えそのものは渡さない)
    let userText = '';
    if (theme_title) userText += `テーマ: ${theme_title}\n\n`;

    userText += research_note
      ? `ここまで調べたこと: ${research_note}\n\nこれをふまえて、次に何を調べたらいいかヒントをください。`
      : 'まだ何も調べていません。何から調べ始めたらいいかヒントをください。';

    // すでに出したヒントがあれば、重複を避けるための情報として追加
    if (previous_hints && previous_hints.length > 0) {
      const pastList = previous_hints.map((h, i) => `${i + 1}. ${h}`).join('\n');
      userText += `\n\n【すでに出したヒント(この内容とは違う切り口でお願いします)】\n${pastList}`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 256,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userText }],
      }),
    });

    const data = await response.json();
    // AI側のエラーで中身が返らなかったときは、使った枠を返してあげる
    if (!data.content) {
      await refundAiUse(req.userId, 'hypothesis_hint', ctxId);
      return res.json(data);
    }
    res.json({ ...data, ai_usage: use });
  } catch (err) {
    console.error('Hypothesis hint error:', err);
    if (consumed) await refundAiUse(req.userId, 'hypothesis_hint', ctxId);
    res.status(500).json({ error: err.message });
  }
});

// ユーザーごとの仮説取得エンドポイント
app.get('/api/hypotheses', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, theme_id, research_note, hypothesis, hint_count, created_at FROM hypotheses WHERE user_id = $1 ORDER BY created_at ASC',
      [req.userId]
    );
    res.json({ success: true, hypotheses: result.rows });
  } catch (err) {
    console.error('Get hypotheses error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 研究方法保存エンドポイント
app.post('/api/save-research-method', requireAuth, async (req, res) => {
  try {
    const {
      hypothesis_id,
      method_type,
      what_to_study,
      tools_materials,
      location,
      duration,
      summary,
    } = req.body;
    const result = await pool.query(
      `INSERT INTO research_methods
        (user_id, hypothesis_id, method_type, what_to_study, tools_materials, location, duration, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.userId,
        hypothesis_id || null,
        method_type,
        what_to_study,
        tools_materials || null,
        location || null,
        duration || null,
        summary || null,
      ],
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Save research method error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 研究方法の削除エンドポイント(本人のものだけ消せるよう user_id も照合する)
app.delete('/api/research-methods/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM research_methods WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'research method not found' });
    }
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Delete research method error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ユーザーごとの研究方法取得エンドポイント
app.get('/api/research-methods', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT rm.id, h.theme_id, rm.hypothesis_id, rm.method_type, rm.what_to_study,
              rm.tools_materials, rm.location, rm.duration, rm.summary, rm.created_at
       FROM research_methods rm
       LEFT JOIN hypotheses h ON rm.hypothesis_id = h.id
       WHERE rm.user_id = $1 ORDER BY rm.created_at ASC`,
      [req.userId],
    );
    res.json({ success: true, researchMethods: result.rows });
  } catch (err) {
    console.error('Get research methods error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 研究方法パートのAIヒント(単発、field で「何を調べる」/「道具・材料」を切り替え)。
// 使用回数は仮説×フィールド単位でDBに記録し、画面を戻っても復活しないようにする。
app.post('/api/research-method-hint', requireAuth, async (req, res) => {
  let consumed = false;
  const { category, field, theme_title, hypothesis, current_text, previous_hints, hypothesis_id } = req.body;
  const kind = field === 'tools_materials' ? 'rm_tools_materials' : 'rm_what_to_study';
  const ctxId = parseInt(hypothesis_id, 10);
  try {
    if (!Number.isFinite(ctxId)) {
      return res.status(400).json({ success: false, error: 'hypothesis_id が必要です' });
    }
    const use = await consumeAiUse(req.userId, kind, ctxId);
    if (use === null) {
      const cur = await getAiUse(req.userId, kind, ctxId);
      return res.status(429).json({
        success: false,
        limit_reached: true,
        ...cur,
        error: 'ヒントはもう使いきったよ',
      });
    }
    consumed = true;

    const modePrompt = PROMPTS[category] ?? '';
    const hintSystem =
      RESEARCH_METHOD_HINT_SYSTEM[field] ?? RESEARCH_METHOD_HINT_SYSTEM.what_to_study;
    const systemPrompt = modePrompt ? `${modePrompt}\n\n${hintSystem}` : hintSystem;

    // テーマ・仮説を伝えることで、その子の研究に沿った方向づけにする(答えそのものは渡さない)
    let userText = '';
    if (theme_title) userText += `テーマ: ${theme_title}\n`;
    if (hypothesis) userText += `この子の予想: 「${hypothesis}」\n`;
    if (userText) userText += '\n';

    userText += current_text
      ? `ここまで書いたこと: ${current_text}\n\nこれをふまえて、次に何を考えたらいいかヒントをください。`
      : 'まだ何も書いていません。何から考え始めたらいいかヒントをください。';

    // すでに出したヒントがあれば、重複を避けるための情報として追加
    if (previous_hints && previous_hints.length > 0) {
      const pastList = previous_hints.map((h, i) => `${i + 1}. ${h}`).join('\n');
      userText += `\n\n【すでに出したヒント(この内容とは違う切り口でお願いします)】\n${pastList}`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 256,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userText }],
      }),
    });

    const data = await response.json();
    // AI側のエラーで中身が返らなかったときは、使った枠を返してあげる
    if (!data.content) {
      await refundAiUse(req.userId, kind, ctxId);
      return res.json(data);
    }
    res.json({ ...data, ai_usage: use });
  } catch (err) {
    console.error('Research method hint error:', err);
    if (consumed) await refundAiUse(req.userId, kind, ctxId);
    res.status(500).json({ error: err.message });
  }
});

// スケジュールのAIたたき台生成(単発、DBには保存しない。フロントがそのまま編集して保存する)。
// 使用回数は仮説単位でDBに記録し、画面を戻っても復活しないようにする。
app.post('/api/schedule-draft', requireAuth, async (req, res) => {
  let consumed = false;
  const {
    theme_title,
    hypothesis,
    hypothesis_id,
    research_methods,
    end_date,
    work_days,
    previous_tasks,
  } = req.body;
  const ctxId = parseInt(hypothesis_id, 10);
  try {
    if (!Number.isFinite(ctxId)) {
      return res.status(400).json({ success: false, error: 'hypothesis_id が必要です' });
    }
    const use = await consumeAiUse(req.userId, 'schedule_draft', ctxId);
    if (use === null) {
      const cur = await getAiUse(req.userId, 'schedule_draft', ctxId);
      return res.status(429).json({
        success: false,
        limit_reached: true,
        ...cur,
        error: 'AIのたたき台はもう使いきったよ',
      });
    }
    consumed = true;

    let userText = `テーマ: ${theme_title}\nこの子の予想: 「${hypothesis}」\n\n`;
    (research_methods ?? []).forEach((rm, i) => {
      userText += `【研究方法${i + 1}】`;
      if (rm.method_type_label) userText += ` ${rm.method_type_label}\n`;
      else userText += '\n';
      if (rm.what_to_study) userText += `何を調べる・実験する: ${rm.what_to_study}\n`;
      if (rm.tools_materials) userText += `道具・材料: ${rm.tools_materials}\n`;
      if (rm.location) userText += `場所: ${rm.location}\n`;
      if (rm.duration) userText += `だいたいの時間: ${rm.duration}\n`;
      if (rm.summary) userText += `まとめの一言: ${rm.summary}\n`;
      userText += '\n';
    });
    userText += `おわりの日: ${end_date || '未定'}\n何日でやりたいか: ${work_days ? `${work_days}日` : '未定'}\n\n上記の研究方法すべてをふまえて、1つのスケジュールのたたき台をJSONで作ってください。`;

    if (previous_tasks && previous_tasks.length > 0) {
      userText += '\n\n(やり直しの依頼です。前回とは少し違う組み立てにしてください)';
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 4096,
        system:     SCHEDULE_DRAFT_SYSTEM,
        messages:   [{ role: 'user', content: userText }],
      }),
    });

    const data = await response.json();
    // AI側のエラーで中身が返らなかったときは、使った枠を返してあげる
    if (!data.content) {
      await refundAiUse(req.userId, 'schedule_draft', ctxId);
      return res.json(data);
    }
    res.json({ ...data, ai_usage: use });
  } catch (err) {
    console.error('Schedule draft error:', err);
    if (consumed) await refundAiUse(req.userId, 'schedule_draft', ctxId);
    res.status(500).json({ error: err.message });
  }
});

// スケジュール保存エンドポイント(hypothesis_id ごとに1件。あれば上書き、なければ新規作成)
app.post('/api/save-schedule', requireAuth, async (req, res) => {
  try {
    const {
      hypothesis_id,
      end_date,
      tasks,
    } = req.body;
    const result = await pool.query(
      `INSERT INTO schedules (user_id, hypothesis_id, end_date, tasks, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (hypothesis_id)
       DO UPDATE SET end_date = EXCLUDED.end_date, tasks = EXCLUDED.tasks, updated_at = NOW()
       RETURNING *`,
      [
        req.userId,
        hypothesis_id || null,
        end_date || null,
        JSON.stringify(tasks ?? []),
      ],
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Save schedule error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ユーザーごとのスケジュール取得エンドポイント
app.get('/api/schedules', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, h.theme_id, s.hypothesis_id, s.end_date, s.tasks, s.created_at, s.updated_at
       FROM schedules s
       LEFT JOIN hypotheses h ON s.hypothesis_id = h.id
       WHERE s.user_id = $1 ORDER BY s.created_at ASC`,
      [req.userId],
    );
    res.json({ success: true, schedules: result.rows });
  } catch (err) {
    console.error('Get schedules error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== STEP5 記録パート =====

// 記録保存エンドポイント(1件ずつ追加。きろく/しらべたことの両方をこの1つで扱う)
app.post('/api/save-record', requireAuth, async (req, res) => {
  try {
    const {
      hypothesis_id,
      record_type,   // 'kiroku'(きろく) / 'shirabe'(しらべたこと)
      viewpoints,    // 選んだ視点チップidの配列 例: ["jikan","ookisa"]
      body,          // 気づいたこと(自由記述)
      why_note,      // なぜ?欄
      num1_label, num1_value, num1_unit,   // 数字1(にんい)
      num2_label, num2_value, num2_unit,   // 数字2(散布図用ペア・にんい)
      observed_at,   // 観察/調査日(未指定ならDBのDEFAULT=nowを使う)
    } = req.body;
    const result = await pool.query(
      `INSERT INTO records
        (user_id, hypothesis_id, record_type, viewpoints, body, why_note,
         num1_label, num1_value, num1_unit, num2_label, num2_value, num2_unit, observed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13, now()))
       RETURNING *`,
      [
        req.userId,
        hypothesis_id || null,
        record_type,
        JSON.stringify(viewpoints ?? []),
        body || null,
        why_note || null,
        num1_label || null,
        num1_value ?? null,
        num1_unit || null,
        num2_label || null,
        num2_value ?? null,
        num2_unit || null,
        observed_at || null,
      ],
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Save record error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ユーザーごとの記録取得エンドポイント(数字の列も返す。数字機能はS4で使用)
app.get('/api/records', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, h.theme_id, r.hypothesis_id, r.record_type, r.viewpoints, r.body, r.why_note,
              r.num1_label, r.num1_value, r.num1_unit, r.num2_label, r.num2_value, r.num2_unit,
              r.observed_at, r.created_at
       FROM records r
       LEFT JOIN hypotheses h ON r.hypothesis_id = h.id
       WHERE r.user_id = $1 ORDER BY r.observed_at ASC`,
      [req.userId],
    );
    res.json({ success: true, records: result.rows });
  } catch (err) {
    console.error('Get records error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 記録の削除エンドポイント(本人の記録だけ消せるよう user_id も照合する)
app.delete('/api/records/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM records WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'record not found' });
    }
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Delete record error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== STEP5 グラフの安全網(層1=機械チェック / 層2=任意) =====
// 層1は src/data/graphSafety.js の機械チェック(AIを使わない)。ここは層2だけを担当する。
//
// かつては「層1.5」として、グラフを開いた瞬間に自動でAIに確認させるしくみがあったが、廃止した。
// ・問題なしを「OK」という返事の文字列一致で判定していたため、モデルが「OKです」のように
//   少しでも違う言い方をすると、その返事がそのまま警告として子どもに表示されてしまっていた
// ・見る観点(単位バラバラ・種類混在)が層1の機械チェックとほぼ重複しており、同じ注意が2つ並んでいた
// ・このアプリで唯一、子どもがボタンを押していないのに勝手に話しかけるAIだった
// 安全網は「層1=常に機械が見る」「層2=子どもが聞きたいときだけAIに聞く」の2段構えにする。

// 軽量モデル。もし account でこの id が使えなければ 'claude-sonnet-4-6' に変えてOK。
const GRAPH_SAFETY_MODEL = 'claude-haiku-4-5-20251001';

// 層2(任意): 押した子だけに「問いかけ」を1つ返す。答えは出さない
const GRAPH_ASK_SYSTEM = `あなたは小学生の自由研究を手伝う先生です。
子どもが自分のグラフについて考えを深められるよう、"問いかけ"を1つだけ返します。
絶対に答え・結論・正解は言わないでください。
グラフから読み取れそうなこと、次にたしかめるとよさそうなことを、
「〜はどうなっているかな?」「〜だとしたら、なぜだろう?」のように問いのかたちで返してください。
返答は1〜2文、やさしい言葉で。`;

// グラフの中身を説明する文章を組み立てる(層2で使う)
function buildGraphUserText({
  theme_title, hypothesis, graph_type_label, title, numbers,
  is_relationship, x_axis_label, y_axis_label, pairs,
}) {
  let text = '';
  if (theme_title) text += `テーマ: ${theme_title}\n`;
  if (hypothesis) text += `この子の予想: 「${hypothesis}」\n`;
  if (graph_type_label) text += `グラフの種類: ${graph_type_label}\n`;
  if (title) text += `グラフのタイトル: ${title}\n`;

  // 関係グラフのときは、記録した順ではなく「グラフに実際に描かれている順(ヨコ軸の昇順)」で伝える。
  // 記録した順のまま渡すと、実際には無い増減の傾向を誤って指摘してしまうため。
  if (is_relationship && pairs?.length) {
    text += `これは関係グラフです。ヨコ軸=${x_axis_label ?? '?'} / タテ軸=${y_axis_label ?? '?'}\n`;
    text += `\nグラフに実際に描かれている点(ヨコ軸の小さい順):\n`;
    pairs.forEach((p) => {
      text += `- ${x_axis_label}=${p.x} のとき ${y_axis_label}=${p.y}\n`;
    });
    return text;
  }

  // 関係グラフでなくても、軸えらび済みなら軸の取り方を伝える
  // (例: ヨコ軸=きろくした順番。日づけの順とは限らないことをAIに知らせる)
  if (x_axis_label || y_axis_label) {
    text += `ヨコ軸=${x_axis_label ?? '?'} / タテ軸=${y_axis_label ?? '?'}\n`;
  }

  text += '\n使っている数字(グラフにならべる順):\n';
  (numbers ?? []).forEach((n) => {
    const unit = n.unit ? ` ${n.unit}` : '';
    const date = n.date ? ` (${n.date})` : '';
    text += `- ${n.label || '数字'}: ${n.value}${unit}${date}\n`;
  });
  return text;
}

// 層2: 「このグラフについて聞いてみる」を押した子だけ、問いかけを1つ返す
app.post('/api/graph-ask', async (req, res) => {
  try {
    const userText = buildGraphUserText(req.body);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      GRAPH_SAFETY_MODEL,
        max_tokens: 256,
        system:     GRAPH_ASK_SYSTEM,
        messages:   [{ role: 'user', content: userText }],
      }),
    });
    const data = await response.json();
    if (!data.content) throw new Error(data.error?.message ?? JSON.stringify(data));
    res.json({ success: true, question: data.content[0].text });
  } catch (err) {
    console.error('Graph ask error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ラベル/単位オートコンプリート用: その子が過去に入力したラベルと単位の一覧
// (AIは使わない。表記ゆれを防いで同じラベルをそろえるための「入力履歴の表示」)
app.get('/api/record-labels', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT label, unit FROM (
         SELECT num1_label AS label, num1_unit AS unit, created_at
           FROM records
          WHERE user_id = $1 AND num1_label IS NOT NULL AND num1_label <> ''
         UNION ALL
         SELECT num2_label AS label, num2_unit AS unit, created_at
           FROM records
          WHERE user_id = $1 AND num2_label IS NOT NULL AND num2_label <> ''
       ) t
       ORDER BY created_at DESC`,
      [req.userId],
    );
    // ラベルごとに1件へ集約(いちばん最近使った単位を代表にする)
    const seen = new Map();
    for (const row of result.rows) {
      if (!seen.has(row.label)) seen.set(row.label, row.unit ?? '');
    }
    const labels = Array.from(seen, ([label, unit]) => ({ label, unit }));
    res.json({ success: true, labels });
  } catch (err) {
    console.error('Get record labels error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== STEP5 グラフの保存 =====

// グラフ保存エンドポイント(材料一式は graph_data の JSON 1列にまとめて保存)
app.post('/api/save-graph', requireAuth, async (req, res) => {
  try {
    const { hypothesis_id, graph_data } = req.body;
    const result = await pool.query(
      `INSERT INTO graphs (user_id, hypothesis_id, graph_data)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [
        req.userId,
        hypothesis_id || null,
        JSON.stringify(graph_data ?? {}),
      ],
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Save graph error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ユーザーごとの保存グラフ取得エンドポイント
app.get('/api/graphs', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.id, h.theme_id, g.hypothesis_id, g.graph_data, g.created_at
       FROM graphs g
       LEFT JOIN hypotheses h ON g.hypothesis_id = h.id
       WHERE g.user_id = $1 ORDER BY g.created_at ASC`,
      [req.userId],
    );
    res.json({ success: true, graphs: result.rows });
  } catch (err) {
    console.error('Get graphs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// グラフの削除エンドポイント(本人のグラフだけ消せるよう user_id も照合する)
app.delete('/api/graphs/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM graphs WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'graph not found' });
    }
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Delete graph error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== STEP6 考察パート =====

// 考察保存エンドポイント(1仮説につき1件。あれば上書き、なければ新規作成)
app.post('/api/save-consideration', requireAuth, async (req, res) => {
  try {
    const {
      hypothesis_id,
      q1,   // ぜんぶ見返して、一番の発見は?
      q2,   // さいしょの予想と比べてどうだった?
    } = req.body;
    const result = await pool.query(
      `INSERT INTO considerations (user_id, hypothesis_id, q1, q2, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (hypothesis_id)
       DO UPDATE SET q1 = EXCLUDED.q1, q2 = EXCLUDED.q2, updated_at = NOW()
       RETURNING *`,
      [
        req.userId,
        hypothesis_id || null,
        q1 || null,
        q2 || null,
      ],
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Save consideration error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ユーザーごとの考察取得エンドポイント
app.get('/api/considerations', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, h.theme_id, c.hypothesis_id, c.q1, c.q2, c.created_at, c.updated_at
       FROM considerations c
       LEFT JOIN hypotheses h ON c.hypothesis_id = h.id
       WHERE c.user_id = $1 ORDER BY c.created_at ASC`,
      [req.userId],
    );
    res.json({ success: true, considerations: result.rows });
  } catch (err) {
    console.error('Get considerations error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 考察パート用: 内容は変えず、言葉づかいだけを整える(Q1・Q2まとめて1回で処理)
const CONSIDERATION_POLISH_SYSTEM = `あなたは小学生が書いた自由研究の文章を「言葉づかいだけ」整える役目です。

絶対に守ること:
- 内容・意味・伝えたいことを1つも変えない、足さない、消さない
- 誤字脱字・句読点・助詞の乱れなど「日本語としての整え」だけを行う
- 小学生本人が書いたことが伝わる、やさしい言葉のまま整える(大人っぽい難しい言葉に置き換えない)
- 元の文章より大幅に長くしたり短くしたりしない
- 説明や前置き、コメントは一切書かない。整えた文章だけを返す
- 空欄や意味の読み取れない文章は、無理に埋めたり推測で補完したりせず、そのまま(または最小限の整え)で返す

入力として「Q1の答え」「Q2の答え」の2つを受け取り、それぞれを整えて
{"q1": "整えたQ1", "q2": "整えたQ2"}
の形のJSONだけを返してください。`;

app.post('/api/consideration-polish', async (req, res) => {
  try {
    const { q1, q2 } = req.body;
    const userText = `Q1の答え: ${q1 || '(未記入)'}\nQ2の答え: ${q2 || '(未記入)'}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        system:     CONSIDERATION_POLISH_SYSTEM,
        messages:   [{ role: 'user', content: userText }],
      }),
    });

    const data = await response.json();
    if (!data.content) throw new Error(data.error?.message ?? JSON.stringify(data));

    const raw = data.content[0].text.trim();
    const parsed = JSON.parse(raw);
    res.json({ success: true, q1: parsed.q1 ?? '', q2: parsed.q2 ?? '' });
  } catch (err) {
    console.error('Consideration polish error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== STEP7 まとめ(レポート)パート =====
// 方針: まとめ1件をまるごと JSON で持つ。AIは使わず、子どもが書いた言葉と
// これまでのDBデータ(記録・グラフ・スケジュール・考察)をそのまま流し込む。

// まとめ保存エンドポイント(1仮説につき1件。あれば上書き、なければ新規作成)
app.post('/api/save-report', requireAuth, async (req, res) => {
  try {
    const { hypothesis_id, report_data } = req.body;
    const result = await pool.query(
      `INSERT INTO reports (user_id, hypothesis_id, report_data, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (hypothesis_id)
       DO UPDATE SET report_data = EXCLUDED.report_data,
                     user_id = EXCLUDED.user_id, updated_at = NOW()
       RETURNING *`,
      [
        req.userId,
        hypothesis_id || null,
        JSON.stringify(report_data ?? {}),
      ],
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Save report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ユーザーごとの保存済みまとめ取得(自分のまとめを開き直す/続きから編集するため)
app.get('/api/reports', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, h.theme_id, r.hypothesis_id, r.report_data, r.created_at, r.updated_at
       FROM reports r
       LEFT JOIN hypotheses h ON r.hypothesis_id = h.id
       WHERE r.user_id = $1 ORDER BY r.updated_at DESC`,
      [req.userId],
    );
    res.json({ success: true, reports: result.rows });
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== 研究データの一括取得 =====
// 1つの hypothesis_id から、その研究(=1つの軸)にひもづく情報を丸ごと1レスポンスで返す。
// フロントがリロード時に sessionStorage の hypothesis_id をもとに研究データを復元するために使う。
// 「仮説1件＝1軸」の理念どおり、単数(theme/hypothesis/schedule/consideration/report)と
// 複数(researchMethods/records/graphs)を分けて返す。
app.get('/api/research/:hypothesisId', requireAuth, async (req, res) => {
  try {
    const hid = parseInt(req.params.hypothesisId, 10);
    if (!Number.isFinite(hid)) {
      return res.status(400).json({ success: false, error: 'invalid hypothesisId' });
    }

    // 背骨(仮説)とテーマを1回で取得。theme_id は NOT NULL なので JOIN は必ず1件返る。
    // 仮説そのものが無ければ研究が存在しないので 404。
    const spine = await pool.query(
      `SELECT h.id, h.user_id, h.theme_id, h.research_note, h.hypothesis, h.hint_count, h.created_at,
              t.category AS theme_category, t.theme AS theme_title, t.created_at AS theme_created_at
       FROM hypotheses h
       JOIN themes t ON h.theme_id = t.id
       WHERE h.id = $1`,
      [hid],
    );
    // 他人の仮説idを推測されても中身を返さないよう、無ければ/自分のでなければ同じ404にする
    if (spine.rowCount === 0 || spine.rows[0].user_id !== req.userId) {
      return res.status(404).json({ success: false, error: 'research not found' });
    }
    const row = spine.rows[0];
    const hypothesis = {
      id: row.id,
      user_id: row.user_id,
      theme_id: row.theme_id,
      research_note: row.research_note,
      hypothesis: row.hypothesis,
      hint_count: row.hint_count,
      created_at: row.created_at,
    };
    const theme = {
      id: row.theme_id,
      category: row.theme_category,
      theme: row.theme_title,
      created_at: row.theme_created_at,
    };

    // 残り(複数=配列 / 単数=1件)は hypothesis_id で並列に取得する
    const [researchMethods, schedule, records, graphs, consideration, report] =
      await Promise.all([
        pool.query(
          `SELECT id, hypothesis_id, method_type, what_to_study, tools_materials, location, duration, summary, created_at
           FROM research_methods WHERE hypothesis_id = $1 ORDER BY created_at ASC`,
          [hid],
        ),
        pool.query(
          `SELECT id, hypothesis_id, end_date, tasks, created_at, updated_at
           FROM schedules WHERE hypothesis_id = $1`,
          [hid],
        ),
        pool.query(
          `SELECT id, hypothesis_id, record_type, viewpoints, body, why_note,
                  num1_label, num1_value, num1_unit, num2_label, num2_value, num2_unit,
                  observed_at, created_at
           FROM records WHERE hypothesis_id = $1 ORDER BY observed_at ASC`,
          [hid],
        ),
        pool.query(
          `SELECT id, hypothesis_id, graph_data, created_at
           FROM graphs WHERE hypothesis_id = $1 ORDER BY created_at ASC`,
          [hid],
        ),
        pool.query(
          `SELECT id, hypothesis_id, q1, q2, created_at, updated_at
           FROM considerations WHERE hypothesis_id = $1`,
          [hid],
        ),
        pool.query(
          `SELECT id, hypothesis_id, report_data, created_at, updated_at
           FROM reports WHERE hypothesis_id = $1`,
          [hid],
        ),
      ]);

    res.json({
      success: true,
      theme,
      hypothesis,
      researchMethods: researchMethods.rows,
      schedule: schedule.rows[0] ?? null,
      records: records.rows,
      graphs: graphs.rows,
      consideration: consideration.rows[0] ?? null,
      report: report.rows[0] ?? null,
    });
  } catch (err) {
    console.error('Get research error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== 管理者モード =====
// パスコードはサーバー側の環境変数で決め打ち。エンドユーザーには存在を見せない。
// フォールバックは持たない: ADMIN_PASSCODE が未設定なら管理者モードは一切開けない
// (デフォルト値で不用意に入れてしまう事故を防ぐフェイルクローズ)。
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE;

// 管理者パスコードの照合。通らないときはここでレスポンスを返し false を返す。
// 環境変数が未設定のときは、どんなパスコードでも通さない(フェイルクローズ)。
function adminAuthorized(req, res) {
  if (!ADMIN_PASSCODE) {
    res.status(503).json({ success: false, error: '管理者モードはまだ設定されていません' });
    return false;
  }
  const { passcode } = req.body;
  if (!passcode || String(passcode) !== String(ADMIN_PASSCODE)) {
    res.status(401).json({ success: false, error: 'ちがうパスコードです' });
    return false;
  }
  return true;
}

// 管理者用: パスコードを照合し、全員分のまとめを一覧で返す。
// GET だとURLやログにパスコードが残るので、必ず POST の body で受け取る。
app.post('/api/admin/reports', async (req, res) => {
  try {
    if (!adminAuthorized(req, res)) return;
    const result = await pool.query(
      `SELECT r.id, r.user_id, h.theme_id, r.hypothesis_id, r.report_data, r.created_at, r.updated_at
       FROM reports r
       LEFT JOIN hypotheses h ON r.hypothesis_id = h.id
       ORDER BY r.user_id ASC, r.updated_at DESC`,
    );
    res.json({ success: true, reports: result.rows });
  } catch (err) {
    console.error('Admin reports error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 管理者用: 登録済みユーザー(番号)の一覧。PINリセット前に
// 「その番号が本当に登録されているか・データを持っているか」を確認するためのもの。
app.post('/api/admin/users', async (req, res) => {
  try {
    if (!adminAuthorized(req, res)) return;
    const result = await pool.query(
      `SELECT u.id, u.created_at,
              (SELECT COUNT(*)::int FROM themes t WHERE t.user_id = u.id) AS theme_count
       FROM users u
       ORDER BY u.id ASC`,
    );
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 管理者用: 全員分の進捗ダッシュボード。
// 各ステップのデータ件数と最終活動日時を番号ごとに集計して返す。
// 「登録済みだがデータなし」も「PINリセット後でusersに行がないがデータあり」も
// 両方拾えるよう、users と themes の番号を合わせた集合を対象にする。
app.post('/api/admin/progress', async (req, res) => {
  try {
    if (!adminAuthorized(req, res)) return;
    const result = await pool.query(
      `WITH ids AS (
         SELECT id FROM users
         UNION
         SELECT DISTINCT user_id FROM themes WHERE user_id IS NOT NULL
       )
       SELECT i.id,
         (SELECT COUNT(*)::int FROM themes t WHERE t.user_id = i.id)           AS themes,
         (SELECT COUNT(*)::int FROM hypotheses h WHERE h.user_id = i.id)       AS hypotheses,
         (SELECT COUNT(*)::int FROM research_methods rm WHERE rm.user_id = i.id) AS methods,
         (SELECT COUNT(*)::int FROM schedules s WHERE s.user_id = i.id)        AS schedules,
         (SELECT COUNT(*)::int FROM records r WHERE r.user_id = i.id)          AS records,
         (SELECT COUNT(*)::int FROM graphs g WHERE g.user_id = i.id)           AS graphs,
         (SELECT COUNT(*)::int FROM considerations c WHERE c.user_id = i.id)   AS considerations,
         (SELECT COUNT(*)::int FROM reports rp WHERE rp.user_id = i.id)        AS reports,
         GREATEST(
           (SELECT MAX(created_at) FROM themes t WHERE t.user_id = i.id),
           (SELECT MAX(created_at) FROM hypotheses h WHERE h.user_id = i.id),
           (SELECT MAX(created_at) FROM research_methods rm WHERE rm.user_id = i.id),
           (SELECT MAX(updated_at) FROM schedules s WHERE s.user_id = i.id),
           (SELECT MAX(created_at) FROM records r WHERE r.user_id = i.id),
           (SELECT MAX(created_at) FROM graphs g WHERE g.user_id = i.id),
           (SELECT MAX(updated_at) FROM considerations c WHERE c.user_id = i.id),
           (SELECT MAX(updated_at) FROM reports rp WHERE rp.user_id = i.id)
         ) AS last_activity
       FROM ids i
       ORDER BY i.id ASC`,
    );
    res.json({ success: true, progress: result.rows });
  } catch (err) {
    console.error('Admin progress error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 管理者用: AIヒント/たたき台の使用状況一覧。
// どの研究かが分かるよう、context_id からテーマ名/仮説文を引いて添える。
app.post('/api/admin/ai-usage', async (req, res) => {
  try {
    if (!adminAuthorized(req, res)) return;
    const result = await pool.query(
      `SELECT a.user_id, a.kind, a.context_id, a.used, a.bonus, a.updated_at,
         CASE WHEN a.kind = 'hypothesis_hint'
              THEN (SELECT theme FROM themes t WHERE t.id = a.context_id)
              ELSE (SELECT hypothesis FROM hypotheses h WHERE h.id = a.context_id)
         END AS context_label
       FROM ai_usage a
       ORDER BY a.user_id ASC, a.kind ASC, a.context_id ASC`,
    );
    res.json({ success: true, usage: result.rows, limit: AI_USE_LIMIT });
  } catch (err) {
    console.error('Admin AI usage error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 管理者用: AIヒントの回数を追加付与する(bonus を +1)。
// used は「実際に使った回数」の記録なので触らず、上限側を積み増す。
app.post('/api/admin/grant-ai-use', async (req, res) => {
  try {
    if (!adminAuthorized(req, res)) return;
    const uid = toUserId(req.body.user_id);
    const { kind } = req.body;
    const ctxId = parseInt(req.body.context_id, 10);
    if (!uid || !AI_USE_KINDS.has(kind) || !Number.isFinite(ctxId)) {
      return res.status(400).json({ success: false, error: 'invalid user_id / kind / context_id' });
    }
    const result = await pool.query(
      `UPDATE ai_usage SET bonus = bonus + 1, updated_at = now()
       WHERE user_id = $1 AND kind = $2 AND context_id = $3
       RETURNING used, bonus`,
      [uid, kind, ctxId],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'この使用記録が見つかりません' });
    }
    const { used, bonus } = result.rows[0];
    res.json({ success: true, used, bonus, limit: AI_USE_LIMIT });
  } catch (err) {
    console.error('Admin grant AI use error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 管理者用: 指定した番号のPIN登録情報をリセットする(PIN忘れの救済)。
// usersの行ごと削除するだけなので、次回その番号を打つと「未登録」扱いになり
// 新しいPINで登録し直せる(研究データはuser_idに紐づいたままなので消えない)。
app.post('/api/admin/reset-user', async (req, res) => {
  try {
    if (!adminAuthorized(req, res)) return;
    const uid = toUserId(req.body.user_id);
    if (!uid) {
      return res.status(400).json({ success: false, error: 'invalid user_id' });
    }
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [uid]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'この番号はまだ登録されていません' });
    }
    res.json({ success: true, user_id: uid });
  } catch (err) {
    console.error('Admin reset user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 起動時に未適用のマイグレーションを自動で流す。
// 環境変数(DATABASE_URL)はRenderに預けているため、DBのURLを手元に持たなくても
// デプロイのたびにサーバー自身がこれを実行してスキーマを最新化できる。
// 既存の移行はすべて IF NOT EXISTS で書かれているので、再実行しても無害(no-op)。
async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.log('Migrations skipped: ❌ DATABASE_URL not set');
    return;
  }
  try {
    const applied = await migrationRunner({
      databaseUrl: {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // Renderの場合これが必要
      },
      dir: path.join(__dirname, '..', 'migrations'),
      direction: 'up',
      count: Infinity,
      migrationsTable: 'pgmigrations',
      log: (msg) => console.log('[migrate]', msg),
    });
    console.log(`Migrations: ✅ OK (this boot applied ${applied.length})`);
  } catch (err) {
    // 移行に失敗してもAPI自体は動かしたいので、ここでは落とさずログだけ残す
    console.error('Migration error: ❌', err.message);
  }
}

// マイグレーションを試みてからサーバーを起動する(成否に関わらず起動はする)
runMigrations().finally(() => {
  app.listen(3001, () => console.log('Server running on http://localhost:3001'));
});