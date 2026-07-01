import { useState } from 'react';
import { getCategoryById } from '../data/categories';

const HINT_LIMIT = 3;

export default function HypothesisScreen({ userId, theme, onBack, onNext }) {
  const [researchNote, setResearchNote] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [hint, setHint] = useState('');
  const [hintCount, setHintCount] = useState(0);
  const [hintHistory, setHintHistory] = useState([]); // これまで出したヒントを溜めておく配列
  const [hintLoading, setHintLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const cat = getCategoryById(theme?.category);
  const hintsLeft = HINT_LIMIT - hintCount;

  async function handleHint() {
    if (hintsLeft <= 0 || hintLoading) return;
    setHintLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/hypothesis-hint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            category: cat?.mode,
            research_note: researchNote,
            previous_hints: hintHistory, // ← 追加: これまで出したヒントを一緒に送る
        }),
      });
      const data = await res.json();
      if (!data.content) throw new Error(data.error?.message ?? JSON.stringify(data));

      const newHint = data.content[0].text;
      setHint(newHint);
      setHintHistory(prev => [...prev, newHint]); // ← 追加: 履歴配列に今回のヒントを足す
      setHintCount(prev => prev + 1);
    } catch (err) {
      setHint('エラー: ' + err.message);
    }
    setHintLoading(false);
  }

  async function handleSave() {
    const trimmedHypothesis = hypothesis.trim();
    if (!trimmedHypothesis) return;

    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/save-hypothesis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          theme_id: theme?.id,
          research_note: researchNote.trim(),
          hypothesis: trimmedHypothesis,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      onNext(data.data);
    } catch (err) {
      alert('保存に失敗しました: ' + err.message);
    }
    setSaving(false);
  }

  return (
    <div className="hypothesis-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>← 戻る</button>
        <h2>{cat ? `${cat.icon} ${theme.theme}` : theme?.theme} の仮説を考えよう</h2>
      </div>

      <div className="hypothesis-content">
        <p className="hypothesis-badge">📚 本やインターネットで調べてみよう！</p>

        <label className="hypothesis-label">① 調べてわかったこと</label>
        <textarea
          className="hypothesis-textarea"
          placeholder="例: アリは仲間にフェロモンで道を伝えるらしい"
          value={researchNote}
          onChange={(e) => setResearchNote(e.target.value)}
          rows={3}
        />

        <label className="hypothesis-label">② 自分の仮説</label>
        <textarea
          className="hypothesis-textarea"
          placeholder="例: アリは道に印をつけながら歩いているのかも"
          value={hypothesis}
          onChange={(e) => setHypothesis(e.target.value)}
          rows={3}
        />

        <button
          className="hint-btn"
          onClick={handleHint}
          disabled={hintsLeft <= 0 || hintLoading}
        >
          {hintLoading ? 'ヒントを考え中…' : '💡 ヒントをもらう(調べる方向を教えるよ)'}
          <span className="hint-count"> 残り {Math.max(hintsLeft, 0)}/{HINT_LIMIT} 回</span>
        </button>

        {hint && <p className="hint-result">🤖 {hint}</p>}

        <div className="hypothesis-footer-row">
          <button
            className="save-theme-btn"
            onClick={handleSave}
            disabled={saving || !hypothesis.trim()}
          >
            {saving ? '保存中…' : '📝 保存して次へ →'}
          </button>
        </div>
      </div>
    </div>
  );
}
