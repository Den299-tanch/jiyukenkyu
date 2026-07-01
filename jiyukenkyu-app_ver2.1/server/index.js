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

app.listen(3001, () => console.log('Server running on http://localhost:3001'));