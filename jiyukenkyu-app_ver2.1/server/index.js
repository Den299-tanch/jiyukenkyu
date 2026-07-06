import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

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

// カテゴリごとのシステムプロンプト
const PROMPTS = {
  'theme-biology':   '生き物や植物に関する自由研究のテーマを一緒に考えます。',
  'theme-chemistry': '化学や実験に関する自由研究のテーマを一緒に考えます。',
  'theme-physics':   '物理や力・光・音に関する自由研究のテーマを一緒に考えます。',
  'theme-history':   '歴史や文化に関する自由研究のテーマを一緒に考えます。',
  'theme-it':        'コンピュータやインターネットに関する自由研究のテーマを一緒に考えます。',
  'theme-society':   '社会やくらしに関する自由研究のテーマを一緒に考えます。',
  'theme-life':      '日常生活の不思議に関する自由研究のテーマを一緒に考えます。',
  'theme-nature':    '自然や天気・地球に関する自由研究のテーマを一緒に考えます。',
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

// スケジュールパート用: 期間の言い回し(あとで日数の前提を差し替えやすいよう1箇所にまとめる)
const SCHEDULE_PERIOD_NOTE = '夏休みの間(今日から「おわりの日」までの、だいたい30日くらいを想定)で、';

// スケジュールパート用: ここは例外的にAIがたたき台を直接作ってよい(答えではなく足場のため)
const SCHEDULE_DRAFT_SYSTEM = `あなたは小学生の自由研究を手伝う先生です。
子どもの予想・研究方法をもとに、${SCHEDULE_PERIOD_NOTE}実際に取り組めるスケジュールのたたき台を作ってください。
スケジュールは研究の"答え"ではなく足場なので、ここでは遠慮せず具体的な下書きを作ってかまいません。
ただし出したタスクは子どもが後から自由に書き換えたり消したりできるので、細かすぎず、無理のない現実的な内容にしてください。
休憩日(やすみ)も1つ以上入れてください。最後には「まとめ」のタスクを入れてください。
タスクは10〜15個程度、"task"の文章は1文(40文字程度まで)の短さにおさめてください。

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
app.post('/api/save-theme', async (req, res) => {
  try {
    const { user_id, category, theme } = req.body;
    const result = await pool.query(
      'INSERT INTO themes (user_id, category, theme) VALUES ($1, $2, $3) RETURNING *',
      [user_id || null, category, theme]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Save theme error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ユーザーごとのテーマ取得エンドポイント
app.get('/api/themes/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT id, category, theme, created_at FROM themes WHERE user_id = $1 ORDER BY created_at ASC',
      [userId]
    );
    res.json({ success: true, themes: result.rows });
  } catch (err) {
    console.error('Get themes error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 仮説保存エンドポイント
app.post('/api/save-hypothesis', async (req, res) => {
  try {
    const { user_id, theme_id, research_note, hypothesis } = req.body;
    const result = await pool.query(
      'INSERT INTO hypotheses (user_id, theme_id, research_note, hypothesis) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_id || null, theme_id || null, research_note || null, hypothesis]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Save hypothesis error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 仮説パートのAIヒント(単発、会話履歴なし)
app.post('/api/hypothesis-hint', async (req, res) => {
  try {
    const { category, research_note, previous_hints } = req.body;
    const modePrompt = PROMPTS[category] ?? '';
    const systemPrompt = modePrompt
      ? `${modePrompt}\n\n${HYPOTHESIS_HINT_SYSTEM}`
      : HYPOTHESIS_HINT_SYSTEM;

    let userText = research_note
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
    res.json(data);
  } catch (err) {
    console.error('Hypothesis hint error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ユーザーごとの仮説取得エンドポイント
app.get('/api/hypotheses/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT id, theme_id, research_note, hypothesis, hint_count, created_at FROM hypotheses WHERE user_id = $1 ORDER BY created_at ASC',
      [userId]
    );
    res.json({ success: true, hypotheses: result.rows });
  } catch (err) {
    console.error('Get hypotheses error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 研究方法保存エンドポイント
app.post('/api/save-research-method', async (req, res) => {
  try {
    const {
      user_id,
      theme_id,
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
        (user_id, theme_id, hypothesis_id, method_type, what_to_study, tools_materials, location, duration, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        user_id || null,
        theme_id || null,
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

// ユーザーごとの研究方法取得エンドポイント
app.get('/api/research-methods/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT id, theme_id, hypothesis_id, method_type, what_to_study, tools_materials, location, duration, summary, created_at
       FROM research_methods WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId],
    );
    res.json({ success: true, researchMethods: result.rows });
  } catch (err) {
    console.error('Get research methods error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 研究方法パートのAIヒント(単発、field で「何を調べる」/「道具・材料」を切り替え)
app.post('/api/research-method-hint', async (req, res) => {
  try {
    const { category, field, theme_title, hypothesis, current_text, previous_hints } = req.body;
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
    res.json(data);
  } catch (err) {
    console.error('Research method hint error:', err);
    res.status(500).json({ error: err.message });
  }
});

// スケジュールのAIたたき台生成(単発、DBには保存しない。フロントがそのまま編集して保存する)
app.post('/api/schedule-draft', async (req, res) => {
  try {
    const {
      theme_title,
      hypothesis,
      research_methods,
      end_date,
      previous_tasks,
    } = req.body;

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
    userText += `おわりの日: ${end_date || '未定'}\n\n上記の研究方法すべてをふまえて、1つのスケジュールのたたき台をJSONで作ってください。`;

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
    res.json(data);
  } catch (err) {
    console.error('Schedule draft error:', err);
    res.status(500).json({ error: err.message });
  }
});

// スケジュール保存エンドポイント(hypothesis_id ごとに1件。あれば上書き、なければ新規作成)
app.post('/api/save-schedule', async (req, res) => {
  try {
    const {
      user_id,
      theme_id,
      hypothesis_id,
      end_date,
      tasks,
    } = req.body;
    const result = await pool.query(
      `INSERT INTO schedules (user_id, theme_id, hypothesis_id, end_date, tasks, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (hypothesis_id)
       DO UPDATE SET end_date = EXCLUDED.end_date, tasks = EXCLUDED.tasks, updated_at = NOW()
       RETURNING *`,
      [
        user_id || null,
        theme_id || null,
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
app.get('/api/schedules/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT id, theme_id, hypothesis_id, end_date, tasks, created_at, updated_at
       FROM schedules WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId],
    );
    res.json({ success: true, schedules: result.rows });
  } catch (err) {
    console.error('Get schedules error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== STEP5 記録パート =====

// 記録保存エンドポイント(1件ずつ追加。きろく/しらべたことの両方をこの1つで扱う)
app.post('/api/save-record', async (req, res) => {
  try {
    const {
      user_id,
      theme_id,
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
        (user_id, theme_id, hypothesis_id, record_type, viewpoints, body, why_note,
         num1_label, num1_value, num1_unit, num2_label, num2_value, num2_unit, observed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, COALESCE($14, now()))
       RETURNING *`,
      [
        user_id || null,
        theme_id || null,
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
app.get('/api/records/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT id, theme_id, hypothesis_id, record_type, viewpoints, body, why_note,
              num1_label, num1_value, num1_unit, num2_label, num2_value, num2_unit,
              observed_at, created_at
       FROM records WHERE user_id = $1 ORDER BY observed_at ASC`,
      [userId],
    );
    res.json({ success: true, records: result.rows });
  } catch (err) {
    console.error('Get records error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 記録の削除エンドポイント(本人の記録だけ消せるよう user_id も照合する)
app.delete('/api/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    const result = await pool.query(
      'DELETE FROM records WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId || null],
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

// ===== STEP5 グラフの安全網(層1.5=自動 / 層2=任意) =====
// 軽量モデル。もし account でこの id が使えなければ 'claude-sonnet-4-6' に変えてOK。
const GRAPH_SAFETY_MODEL = 'claude-haiku-4-5-20251001';

// 層1.5(自動): 「もっともらしいのに実は変」を1つだけそっと知らせる。
// 問題がないときは「OK」だけ返させ、実質なにも出さない(表示もコストも軽い)。
const GRAPH_CHECK_SYSTEM = `あなたは小学生の自由研究を手伝う先生です。
子どもが作ったグラフの「数字の組み合わせ」を見て、"もっともらしいけれど実はおかしいかもしれない点"が
ないかを確認する役です。とくに次に注意してください:
- ケタ違い(たとえば片方が分・片方が秒など、桁が大きく違う数字がまざっている)
- 出どころや種類がちがう数字を、1つのグラフに混ぜている
- 単位がバラバラなのに、1つの量として比べている

ただし「これは関係グラフです(ヨコ軸/タテ軸が指定されている)」と伝えられたときは、
2つのちがう種類の数字・ちがう単位・ちがう桁を比べるのがそのグラフの目的なので、
単位や種類がちがうこと自体は絶対に指摘しないでください。その場合でも、
ケタ違いで片方の変化がグラフ上でほぼ見えなくなっていそうなときなどは指摘してかまいません。

問題がなさそうなときは、説明や前置きを一切書かず「OK」とだけ返してください。
気になる点があるときだけ、答えや正解は言わず、気づきをうながす一言(1〜2文・やさしい言葉)を返してください。`;

// 層2(任意): 押した子だけに「問いかけ」を1つ返す。答えは出さない
const GRAPH_ASK_SYSTEM = `あなたは小学生の自由研究を手伝う先生です。
子どもが自分のグラフについて考えを深められるよう、"問いかけ"を1つだけ返します。
絶対に答え・結論・正解は言わないでください。
グラフから読み取れそうなこと、次にたしかめるとよさそうなことを、
「〜はどうなっているかな?」「〜だとしたら、なぜだろう?」のように問いのかたちで返してください。
返答は1〜2文、やさしい言葉で。`;

// グラフの中身を説明する文章を組み立てる(層1.5・層2で共通)
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

  text += '\n使っている数字:\n';
  (numbers ?? []).forEach((n) => {
    const unit = n.unit ? ` ${n.unit}` : '';
    const date = n.date ? ` (${n.date})` : '';
    text += `- ${n.label || '数字'}: ${n.value}${unit}${date}\n`;
  });
  return text;
}

// 層1.5: グラフを開いたとき自動で1回、注意点がないか確認する
app.post('/api/graph-check', async (req, res) => {
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
        system:     GRAPH_CHECK_SYSTEM,
        messages:   [{ role: 'user', content: userText }],
      }),
    });
    const data = await response.json();
    // AIの返事を解釈。空 or 「OK」だけなら注意なし。それ以外は注意メッセージ扱い。
    const text = (data.content?.[0]?.text ?? '').trim();
    const isOk = text === '' || /^ok[\s!.。、]*$/i.test(text);
    const warn = !isOk;
    const message = warn ? text : '';
    res.json({ success: true, warn, message });
  } catch (err) {
    console.error('Graph check error:', err);
    res.status(500).json({ error: err.message });
  }
});

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
app.get('/api/record-labels/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
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
      [userId],
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
app.post('/api/save-graph', async (req, res) => {
  try {
    const { user_id, theme_id, hypothesis_id, graph_data } = req.body;
    const result = await pool.query(
      `INSERT INTO graphs (user_id, theme_id, hypothesis_id, graph_data)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        user_id || null,
        theme_id || null,
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
app.get('/api/graphs/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT id, theme_id, hypothesis_id, graph_data, created_at
       FROM graphs WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId],
    );
    res.json({ success: true, graphs: result.rows });
  } catch (err) {
    console.error('Get graphs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// グラフの削除エンドポイント(本人のグラフだけ消せるよう user_id も照合する)
app.delete('/api/graphs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    const result = await pool.query(
      'DELETE FROM graphs WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId || null],
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
app.post('/api/save-consideration', async (req, res) => {
  try {
    const {
      user_id,
      theme_id,
      hypothesis_id,
      q1,   // ぜんぶ見返して、一番の発見は?
      q2,   // さいしょの予想と比べてどうだった?
    } = req.body;
    const result = await pool.query(
      `INSERT INTO considerations (user_id, theme_id, hypothesis_id, q1, q2, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (hypothesis_id)
       DO UPDATE SET q1 = EXCLUDED.q1, q2 = EXCLUDED.q2, updated_at = NOW()
       RETURNING *`,
      [
        user_id || null,
        theme_id || null,
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
app.get('/api/considerations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT id, theme_id, hypothesis_id, q1, q2, created_at, updated_at
       FROM considerations WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId],
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

app.listen(3001, () => console.log('Server running on http://localhost:3001'));