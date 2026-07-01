import { useState } from "react";
import { getCategoryById } from "../data/categories";

const HINT_LIMIT = 3;

export default function HypothesisScreen({ userId, theme, onBack, onNext }) {
  const [researchNote, setResearchNote] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [hint, setHint] = useState("");
  const [hintCount, setHintCount] = useState(0);
  const [hintHistory, setHintHistory] = useState([]); // これまで出したヒントを溜めておく配列
  const [savedList, setSavedList] = useState([]); // このテーマで追加した仮説の一覧
  const [hintLoading, setHintLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const cat = getCategoryById(theme?.category);
  const hintsLeft = HINT_LIMIT - hintCount;

  async function handleHint() {
    if (hintsLeft <= 0 || hintLoading) return;
    setHintLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ""}/api/hypothesis-hint`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: cat?.mode,
            research_note: researchNote,
            previous_hints: hintHistory, // ← 追加: これまで出したヒントを一緒に送る
          }),
        },
      );
      const data = await res.json();
      if (!data.content)
        throw new Error(data.error?.message ?? JSON.stringify(data));

      const newHint = data.content[0].text;
      setHint(newHint);
      setHintHistory((prev) => [...prev, newHint]); // ← 追加: 履歴配列に今回のヒントを足す
      setHintCount((prev) => prev + 1);
    } catch (err) {
      setHint("エラー: " + err.message);
    }
    setHintLoading(false);
  }

  async function handleAddToList() {
    const trimmedHypothesis = hypothesis.trim();
    if (!trimmedHypothesis) return;

    setSaving(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ""}/api/save-hypothesis`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            theme_id: theme?.id,
            research_note: researchNote.trim(),
            hypothesis: trimmedHypothesis,
          }),
        },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // リストに追加
      setSavedList((prev) => [...prev, data.data]);

      // 次の1件を書けるように入力欄・ヒント関連をリセット
      setResearchNote("");
      setHypothesis("");
      setHint("");
      setHintHistory([]);
      setHintCount(0);
    } catch (err) {
      alert("保存に失敗しました: " + err.message);
    }
    setSaving(false);
  }
  
  function handleNext() {
  onNext(savedList);
}

  return (
    <div className="hypothesis-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>
          ← 戻る
        </button>
        <h2>
          {cat ? `${cat.icon} ${theme.theme}` : theme?.theme} の仮説を考えよう
        </h2>
      </div>

      <div className="hypothesis-content">
        <p className="hypothesis-badge">
          📚 本やインターネットで調べてみよう！
        </p>

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
          {hintLoading
            ? "ヒントを考え中…"
            : "💡 ヒントをもらう(調べる方向を教えるよ)"}
          <span className="hint-count">
            {" "}
            残り {Math.max(hintsLeft, 0)}/{HINT_LIMIT} 回
          </span>
        </button>

        {hintHistory.length > 0 && (
  <div className="hint-history">
    {hintHistory.map((h, i) => (
      <p key={i} className="hint-result">🤖 {h}</p>
    ))}
  </div>
)}

<div className="hypothesis-footer-row">
  <button
    className="add-list-btn"
    onClick={handleAddToList}
    disabled={saving || !hypothesis.trim()}
  >
    {saving ? '追加中…' : '＋ この仮説をリストに追加'}
  </button>
</div>

{savedList.length > 0 && (
  <div className="saved-hypothesis-list">
    <h3 className="saved-list-title">📋 追加した仮説 ({savedList.length}件)</h3>
    {savedList.map((item) => (
      <div key={item.id} className="saved-hypothesis-card">
        {item.research_note && (
          <p className="saved-hypothesis-note">調べたこと: {item.research_note}</p>
        )}
        <p className="saved-hypothesis-text">仮説: {item.hypothesis}</p>
      </div>
    ))}
  </div>
)}

<div className="hypothesis-next-row">
  <button
    className="hypothesis-next-btn"
    onClick={handleNext}
    disabled={savedList.length === 0}
  >
    次のステップへ進む →
  </button>
</div>
      </div>
    </div>
  );
}
