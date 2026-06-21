import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('API_KEY loaded:', process.env.CLAUDE_API_KEY ? '✅ OK' : '❌ NOT FOUND');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.CLAUDE_API_KEY;

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

app.post('/api/chat', async (req, res) => {
  try {
    const { history, mode } = req.body;

    // モードに合わせてプロンプトを切り替え
    const modePrompt = PROMPTS[mode] ?? '';
    const systemPrompt = modePrompt
      ? `${modePrompt}\n\n${BASE_SYSTEM}`
      : BASE_SYSTEM;

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

app.listen(3001, () => console.log('Server running on http://localhost:3001'));