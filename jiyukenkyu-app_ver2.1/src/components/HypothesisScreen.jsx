import { useState, useEffect } from "react";
import { getCategoryById } from "../data/categories";
import { apiGet, apiPost } from "../services/api";
import { useResearch } from "../contexts/ResearchContext";
import Ruby from "./Ruby";

const HINT_LIMIT = 3;

export default function HypothesisScreen({ userId, onBack, onNext }) {
  const { research } = useResearch();
  const theme = research?.theme;
  const [researchNote, setResearchNote] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [hintCount, setHintCount] = useState(0);
  const [hintHistory, setHintHistory] = useState([]); // これまで出したヒントを溜めておく配列
  const [savedList, setSavedList] = useState([]); // このテーマで追加した仮説の一覧
  const [hintLoading, setHintLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const cat = getCategoryById(theme?.category);
  const hintsLeft = HINT_LIMIT - hintCount;

  // 戻るボタンなどで再度この画面に来たとき、すでに保存済みの仮説を読み込んで
  // 「次のステップへ進む」が押せない状態にならないようにする
  useEffect(() => {
    if (!userId || !theme?.id) return;
    async function fetchExisting() {
      try {
        const data = await apiGet('/api/hypotheses');
        if (!data.success) return;
        setSavedList(data.hypotheses.filter((h) => h.theme_id === theme.id));
      } catch {
        // 読み込みに失敗しても、新しく仮説を追加すること自体はできるので黙って無視
      }
    }
    fetchExisting();
  }, [userId, theme?.id]);

  async function handleHint() {
    if (hintsLeft <= 0 || hintLoading) return;
    setHintLoading(true);
    try {
      const data = await apiPost('/api/hypothesis-hint', {
        category: cat?.mode,
        research_note: researchNote,
        previous_hints: hintHistory, // これまで出したヒントを一緒に送る
      });
      if (!data.content)
        throw new Error(data.error?.message ?? JSON.stringify(data));

      const newHint = data.content[0].text;
      setHintHistory((prev) => [...prev, newHint]); // 履歴配列に今回のヒントを足す(表示もここから)
      setHintCount((prev) => prev + 1);
    } catch (err) {
      console.error("Hypothesis hint error:", err);
    }
    setHintLoading(false);
  }

  async function handleAddToList() {
    const trimmedHypothesis = hypothesis.trim();
    if (!trimmedHypothesis) return;

    setSaving(true);
    try {
      const data = await apiPost('/api/save-hypothesis', {
        theme_id: theme?.id,
        research_note: researchNote.trim(),
        hypothesis: trimmedHypothesis,
      });
      if (!data.success) throw new Error(data.error);

      // リストに追加
      setSavedList((prev) => [...prev, data.data]);

      // 次の1件を書けるように入力欄・ヒント関連をリセット
      setResearchNote("");
      setHypothesis("");
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
          ← <Ruby>{"戻[もど]る"}</Ruby>
        </button>
        <h2>
          {cat ? `${cat.icon} ${theme.theme}` : theme?.theme} の<Ruby>{"仮説[かせつ]を考[かんが]えよう"}</Ruby>
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
    {saving ? <Ruby>{"追加中[ついかちゅう]…"}</Ruby> : <Ruby>{"＋ この仮説[かせつ]をリストに追加[ついか]"}</Ruby>}
  </button>
</div>

{savedList.length > 0 && (
  <div className="saved-hypothesis-list">
    <h3 className="saved-list-title">📋 <Ruby>{"追加[ついか]した仮説[かせつ] ("}</Ruby>{savedList.length}<Ruby>{"件[けん])"}</Ruby></h3>
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
    <Ruby>{"次[つぎ]のステップへ進[すす]む →"}</Ruby>
  </button>
</div>
      </div>
    </div>
  );
}
