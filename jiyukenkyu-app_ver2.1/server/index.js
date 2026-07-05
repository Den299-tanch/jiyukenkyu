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

app.listen(3001, () => console.log('Server running on http://localhost:3001'));