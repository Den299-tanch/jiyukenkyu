import { useState, useEffect } from "react";
import { getCategoryById } from "../data/categories";
import { METHOD_TYPES, getMethodTypeById } from "../data/methodTypes";
import { apiGet, apiPost, apiDelete } from "../services/api";
import { useResearch } from "../contexts/ResearchContext";
import ConfirmModal from "./ConfirmModal";
import Ruby from "./Ruby";

const HINT_LIMIT = 3;

export default function ResearchMethodScreen({
  userId,
  savedHypotheses,
  onBack,
  onNext,
}) {
  const { research } = useResearch();
  const theme = research?.theme;
  const cat = getCategoryById(theme?.category);
  const hasMultiple = (savedHypotheses?.length ?? 0) > 1;

  const [step, setStep] = useState(hasMultiple ? "select" : "type");
  const [selectedHypothesis, setSelectedHypothesis] = useState(
    hasMultiple ? null : (savedHypotheses?.[0] ?? null),
  );
  const [methodType, setMethodType] = useState(null);

  const [whatToStudy, setWhatToStudy] = useState("");
  const [toolsMaterials, setToolsMaterials] = useState("");
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState("");
  const [summary, setSummary] = useState("");

  const [whatHintHistory, setWhatHintHistory] = useState([]);
  const [whatHintCount, setWhatHintCount] = useState(0);
  const [whatHintLoading, setWhatHintLoading] = useState(false);

  const [toolsHintHistory, setToolsHintHistory] = useState([]);
  const [toolsHintCount, setToolsHintCount] = useState(0);
  const [toolsHintLoading, setToolsHintLoading] = useState(false);

  const [savedList, setSavedList] = useState([]); // この仮説で追加した研究方法の一覧
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // 削除確認中の研究方法
  const [deleting, setDeleting] = useState(false);

  const whatHintsLeft = HINT_LIMIT - whatHintCount;
  const toolsHintsLeft = HINT_LIMIT - toolsHintCount;

  // 戻るボタンなどで再度この画面に来たとき、すでに保存済みの研究方法を読み込んで復元する
  useEffect(() => {
    if (!userId || !selectedHypothesis?.id) return;
    async function fetchExisting() {
      try {
        const data = await apiGet(`/api/research/${selectedHypothesis.id}`);
        if (!data.success) return;
        setSavedList(data.researchMethods);
      } catch {
        // 読み込みに失敗しても、新しく追加すること自体はできるので黙って無視
      }
    }
    fetchExisting();
  }, [userId, selectedHypothesis?.id]);

  async function fetchHint(field, currentText, history, setHistory, setCount, setLoading) {
    setLoading(true);
    try {
      const data = await apiPost('/api/research-method-hint', {
        category: cat?.mode,
        field,
        theme_title: theme?.theme,
        hypothesis: selectedHypothesis?.hypothesis,
        current_text: currentText,
        previous_hints: history,
      });
      if (!data.content)
        throw new Error(data.error?.message ?? JSON.stringify(data));

      const newHint = data.content[0].text;
      setHistory((prev) => [...prev, newHint]);
      setCount((prev) => prev + 1);
    } catch (err) {
      setHistory((prev) => [...prev, "エラー: " + err.message]);
    }
    setLoading(false);
  }

  function handleSelectHypothesis(h) {
    setSelectedHypothesis(h);
    setStep("type");
  }

  function handleGoToDetails() {
    if (!methodType) return;
    setStep("details");
  }

  async function handleAddToList() {
    if (!whatToStudy.trim() || !toolsMaterials.trim() || !summary.trim() || saving) return;

    setSaving(true);
    try {
      const data = await apiPost('/api/save-research-method', {
        hypothesis_id: selectedHypothesis?.id,
        method_type: methodType,
        what_to_study: whatToStudy.trim(),
        tools_materials: toolsMaterials.trim(),
        location: location.trim(),
        duration: duration.trim(),
        summary: summary.trim(),
      });
      if (!data.success) throw new Error(data.error);

      setSavedList((prev) => [...prev, data.data]);

      // 次の1件を続けて追加できるように入力欄・ヒント関連をリセット
      setMethodType(null);
      setWhatToStudy("");
      setToolsMaterials("");
      setLocation("");
      setDuration("");
      setSummary("");
      setWhatHintHistory([]);
      setWhatHintCount(0);
      setToolsHintHistory([]);
      setToolsHintCount(0);
      setStep("type");
    } catch (err) {
      alert("保存に失敗しました: " + err.message);
    }
    setSaving(false);
  }

  function handleNext() {
    onNext({ researchMethods: savedList, hypothesis: selectedHypothesis });
  }

  // 「詳細記述」ステップからの戻るは、その手前の「型えらび」に戻すだけにする
  // (画面全体のonBackを呼ぶと、仮説作成まで戻ってしまっていた)
  function handleBack() {
    if (step === "details") {
      setStep("type");
      return;
    }
    onBack();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const data = await apiDelete(`/api/research-methods/${deleteTarget.id}`);
      if (!data.success) throw new Error(data.error);
      setSavedList((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      alert("研究方法の削除に失敗しました: " + err.message);
    }
    setDeleting(false);
  }

  return (
    <div className="research-method-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={handleBack}>
          ← <Ruby>{"戻[もど]る"}</Ruby>
        </button>
        <h2>🧭 <Ruby>{"研究方法[けんきゅうほうほう]を考[かんが]えよう"}</Ruby></h2>
      </div>

      <div className="research-method-content">
        {step === "select" && (
          <>
            <div className="rm-intro-banner">
              🌱 どの予想について、研究方法を考える?
            </div>
            <div className="rm-select-list">
              {savedHypotheses.map((h) => (
                <div
                  key={h.id}
                  className="rm-hypothesis-card"
                  onClick={() => handleSelectHypothesis(h)}
                >
                  <p className="rm-hypothesis-text">{h.hypothesis}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {step === "type" && (
          <>
            <div className="rm-intro-banner">
              🌱 今日で終わらなくても大丈夫だよ。できるところまで、いっしょに考えてみよう。
            </div>
            <p className="rm-headline">
              あなたの予想「{selectedHypothesis?.hypothesis}」
              <br />
              これは、どうやってたしかめる?
            </p>

            <div className="rm-type-grid">
              {METHOD_TYPES.map((m) => (
                <div
                  key={m.id}
                  className={`rm-type-card ${methodType === m.id ? "selected" : ""}`}
                  onClick={() => setMethodType(m.id)}
                >
                  <div className="rm-type-emoji">{m.icon}</div>
                  <div className="rm-type-name">{m.label}</div>
                  <div className="rm-type-desc">{m.desc}</div>
                  <div className="rm-type-example">{m.example}</div>
                </div>
              ))}
            </div>

            <div className="rm-next-row">
              <button
                className="next-btn"
                onClick={handleGoToDetails}
                disabled={!methodType}
              >
                つぎへ →
              </button>
            </div>

            {savedList.length > 0 && (
              <div className="rm-saved-list">
                <h3 className="rm-saved-title">
                  📋 <Ruby>{"追加[ついか]した研究方法[けんきゅうほうほう] ("}</Ruby>{savedList.length}<Ruby>{"件[けん])"}</Ruby>
                </h3>
                {savedList.map((item) => {
                  const info = getMethodTypeById(item.method_type);
                  return (
                    <div key={item.id} className="rm-saved-card">
                      <button
                        className="rm-saved-delete-btn"
                        onClick={() => setDeleteTarget(item)}
                        aria-label="この研究方法を消す"
                      >
                        🗑️
                      </button>
                      <span className="rm-saved-type">
                        {info?.icon} {info?.label}
                      </span>
                      <p className="rm-saved-text">{item.what_to_study}</p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="rm-final-next-row">
              <button
                className="rm-final-next-btn"
                onClick={handleNext}
                disabled={savedList.length === 0}
              >
                次のステップへ進む →
              </button>
            </div>
          </>
        )}

        {step === "details" && (
          <>
            <div className="rm-field-card rm-quote-card">
              <div className="rm-field-label">🧭 あなたの予想</div>
              <p className="rm-quote-text">「{selectedHypothesis?.hypothesis}」</p>
              <p className="rm-quote-question">
                この予想がほんとうか、たしかめるには何をすればいいかな?
              </p>
            </div>

            <div className="rm-field-card">
              <div className="rm-field-label">
                <span className="rm-field-num">1</span>何を調べる・実験する?
                <span className="rm-badge-required">*</span>
              </div>
              <textarea
                className="rm-textarea"
                rows={2}
                placeholder="例: 保冷剤を2こと5こでアイスのとけかたをくらべる"
                value={whatToStudy}
                onChange={(e) => setWhatToStudy(e.target.value)}
              />
              <div className="rm-hint-row">
                <button
                  className="hint-btn"
                  disabled={whatHintsLeft <= 0 || whatHintLoading}
                  onClick={() =>
                    fetchHint(
                      "what_to_study",
                      whatToStudy,
                      whatHintHistory,
                      setWhatHintHistory,
                      setWhatHintCount,
                      setWhatHintLoading,
                    )
                  }
                >
                  {whatHintLoading ? "ヒントを考え中…" : "💡 AIにヒントをもらう"}
                  <span className="hint-count">
                    {" "}
                    残り {Math.max(whatHintsLeft, 0)}/{HINT_LIMIT} 回
                  </span>
                </button>
              </div>
              {whatHintHistory.map((h, i) => (
                <p key={i} className="hint-result">
                  🤖 {h}
                </p>
              ))}
            </div>

            <div className="rm-field-card">
              <div className="rm-field-label">
                <span className="rm-field-num">2</span>どうやってやる?(道具・材料)
                <span className="rm-badge-required">*</span>
              </div>
              <textarea
                className="rm-textarea"
                rows={2}
                placeholder="例: 保冷剤、アイス、タイマー、コップ"
                value={toolsMaterials}
                onChange={(e) => setToolsMaterials(e.target.value)}
              />
              <div className="rm-hint-row">
                <button
                  className="hint-btn"
                  disabled={toolsHintsLeft <= 0 || toolsHintLoading}
                  onClick={() =>
                    fetchHint(
                      "tools_materials",
                      toolsMaterials,
                      toolsHintHistory,
                      setToolsHintHistory,
                      setToolsHintCount,
                      setToolsHintLoading,
                    )
                  }
                >
                  {toolsHintLoading ? "ヒントを考え中…" : "💡 AIにヒントをもらう"}
                  <span className="hint-count">
                    {" "}
                    残り {Math.max(toolsHintsLeft, 0)}/{HINT_LIMIT} 回
                  </span>
                </button>
              </div>
              {toolsHintHistory.map((h, i) => (
                <p key={i} className="hint-result">
                  🤖 {h}
                </p>
              ))}
            </div>

            <div className="rm-field-card">
              <div className="rm-field-label">
                <span className="rm-field-num">3</span>どこでやる?
                <span className="rm-badge-optional">予想でOK</span>
              </div>
              <textarea
                className="rm-textarea"
                rows={1}
                placeholder="まだ決まってなくても、今おもいついてる場所でOK"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="rm-field-card">
              <div className="rm-field-label">
                <span className="rm-field-num">4</span>どのくらいの時間でやる?
                <span className="rm-badge-optional">予想でOK</span>
              </div>
              <textarea
                className="rm-textarea"
                rows={1}
                placeholder="今日で終わらなくてもOK。だいたいの時間でだいじょうぶ"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>

            <div className="rm-field-card rm-final-card">
              <div className="rm-field-label">
                ✏️ さいごに、ひとことで
                <span className="rm-badge-required">*</span>
              </div>
              <p className="rm-sub">じゃあ今日、あなたは何をしますか?</p>
              <textarea
                className="rm-textarea"
                rows={2}
                placeholder="自分の言葉でまとめてみよう"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>

            <button
              className="next-btn rm-submit-btn"
              onClick={handleAddToList}
              disabled={saving || !whatToStudy.trim() || !toolsMaterials.trim() || !summary.trim()}
            >
              {saving ? <Ruby>{"追加中[ついかちゅう]…"}</Ruby> : <Ruby>{"＋ この研究方法[けんきゅうほうほう]をリストに追加[ついか]"}</Ruby>}
            </button>
          </>
        )}
      </div>

      {deleteTarget && (
        <ConfirmModal
          message={"この研究方法を消すよ。\nもとにはもどせないけど、いいかな?"}
          confirming={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
