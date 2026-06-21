import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ESMでの__dirnameを定義
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env を読み込む
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('API_KEY loaded:', process.env.GEMINI_API_KEY ? '✅ OK' : '❌ NOT FOUND');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM = `あなたは小学生の自由研究を手伝う先生です。
答えを直接教えるのではなく、「なぜだと思う？」「試してみたらどうなるかな？」
のように問いかけて、子ども自身が考えられるようにしてください。
やさしい言葉を使い、返答は3文以内にしてください。`;

app.post('/api/chat', async (req, res) => {
  try {
    const { history } = req.body;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM }] },
          contents: history
        })
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => console.log('Server running on http://localhost:3001'));