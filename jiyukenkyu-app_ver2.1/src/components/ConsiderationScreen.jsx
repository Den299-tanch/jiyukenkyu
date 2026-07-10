import { useState, useEffect } from "react";
import { getGraphTypeById } from "../data/graphTypes";
import { apiGet, apiPost } from "../services/api";
import { useResearch } from "../contexts/ResearchContext";
import GraphView from "./GraphView";
import Ruby from "./Ruby";

export default function ConsiderationScreen({ userId, onBack, onNext }) {
  const { research } = useResearch();
  const hypothesis = research?.hypothesis;
  const [view, setView] = useState("reflect"); // 'reflect' | 'think'
  const [records, setRecords] = useState([]);
  const [graphs, setGraphs] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [restoredNotice, setRestoredNotice] = useState(false);

  const [polishLoading, setPolishLoading] = useState(false);
  const [polishError, setPolishError] = useState("");
  const [polished, setPolished] = useState(null); // null | { q1, q2 }

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // 画面に来たとき、この仮説の記録・グラフ・すでに書いた考察を読み込む
  useEffect(() => {
    if (!userId || !hypothesis?.id) return;
    let ignore = false;
    async function fetchAll() {
      setLoadingList(true);
      try {
        const data = await apiGet(`/api/research/${hypothesis.id}`);
        if (ignore) return;
        if (data.success) {
          setRecords(data.records);
          setGraphs(data.graphs);
          if (data.consideration) {
            setQ1(data.consideration.q1 ?? "");
            setQ2(data.consideration.q2 ?? "");
            setRestoredNotice(true);
          }
        }
      } catch {
        // 読み込みに失敗しても、これから書くこと自体はできるので黙って無視
      }
      if (!ignore) setLoadingList(false);
    }
    fetchAll();
    return () => {
      ignore = true;
    };
  }, [userId, hypothesis?.id]);

  useEffect(() => {
    if (!saveMessage) return;
    const timer = setTimeout(() => setSaveMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [saveMessage]);

  const whyList = records
    .filter((r) => r.why_note)
    .slice()
    .sort((a, b) => new Date(a.observed_at) - new Date(b.observed_at));

  async function handlePolish() {
    setPolishLoading(true);
    setPolishError("");
    try {
      const data = await apiPost('/api/consideration-polish', { q1, q2 });
      if (!data.success) throw new Error(data.error);
      setPolished({ q1: data.q1, q2: data.q2 });
    } catch (err) {
      setPolishError("整えるのに失敗したよ: " + err.message + "（もう一度試してみてね）");
    }
    setPolishLoading(false);
  }

  function applyPolished(field) {
    if (!polished) return;
    if (field === "q1") setQ1(polished.q1);
    if (field === "q2") setQ2(polished.q2);
  }

  function closePolished() {
    setPolished(null);
    setPolishError("");
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage("");
    try {
      const data = await apiPost('/api/save-consideration', {
        hypothesis_id: hypothesis?.id,
        q1,
        q2,
      });
      if (!data.success) throw new Error(data.error);
      setRestoredNotice(false);
      setSaveMessage("✅ かんがえたことをほぞんしたよ!");
    } catch (err) {
      alert("保存に失敗しました: " + err.message);
    }
    setSaving(false);
  }

  return (
    <div className="consideration-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>
          ← <Ruby>{"戻[もど]る"}</Ruby>
        </button>
        <h2>💡 かんがえたことを まとめよう</h2>
      </div>

      <div className="consideration-content">
        <div className="sch-tabs">
          <button
            className={`sch-tab ${view === "reflect" ? "active" : ""}`}
            onClick={() => setView("reflect")}
          >
            ①ふりかえり
          </button>
          <button
            className={`sch-tab ${view === "think" ? "active" : ""}`}
            onClick={() => setView("think")}
          >
            ②かんがえたこと
          </button>
        </div>

        {hypothesis?.hypothesis && (
          <div className="rec-hypo-recap">
            <span className="rec-hypo-label">💭 さいしょの予想</span>
            {hypothesis.hypothesis}
          </div>
        )}

        {view === "reflect" && (
          <>
            <p className="rec-list-title">これまでのきろくを ふりかえってみよう</p>

            {graphs.length > 0 && (
              <>
                <p className="cons-sublabel">📊 作ったグラフ</p>
                <div className="cons-graph-scroll">
                  {graphs.map((g) => {
                    const gd = g.graph_data || {};
                    const label = getGraphTypeById(gd.graphType).label;
                    return (
                      <div className="cons-graph-recap" key={g.id}>
                        <div className="cons-graph-recap-title">{gd.title || label}</div>
                        <div className="cons-graph-recap-chart">
                          <GraphView
                            type={gd.graphType}
                            entries={gd.entries || []}
                            xAxisLabel={gd.xAxisLabel ?? undefined}
                            compact
                          />
                        </div>
                        <div className="cons-graph-recap-sub">{label}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <p className="cons-sublabel">📌 書いた「なぜ?」だけ集めました</p>

            {loadingList ? (
              <p className="rec-empty">読み込み中…</p>
            ) : whyList.length === 0 ? (
              <div className="cons-empty-note">まだきろく・しらべたことがないよ</div>
            ) : (
              <div className="cons-why-timeline">
                {whyList.map((r) => (
                  <div className="cons-why-item" key={r.id}>
                    <span className={`cons-why-dot ${r.record_type === "kiroku" ? "rt-kiroku" : "rt-shirabe"}`} />
                    <span
                      className={`rec-type-badge ${r.record_type === "kiroku" ? "rt-kiroku" : "rt-shirabe"}`}
                    >
                      {r.record_type === "kiroku" ? "🧪" : "🔍"} {formatDate(r.observed_at)}
                    </span>
                    <span className="cons-why-text">
                      <b>{r.record_type === "kiroku" ? "なんでだと思う?" : "予想と同じ?ちがった?"}</b>{" "}
                      {r.why_note}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button className="next-btn cons-to-think-btn" onClick={() => setView("think")}>
              かんがえたことを<Ruby>{"書[か]く"}</Ruby> →
            </button>
          </>
        )}

        {view === "think" && (
          <>
            {restoredNotice && (
              <div className="sch-restore-banner">
                📥 前回ほぞんした考察を読み込んだよ
                <button
                  className="sch-restore-close"
                  onClick={() => setRestoredNotice(false)}
                  aria-label="閉じる"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="cons-q-card">
              <div className="cons-q-head">
                <span className="cons-q-num cons-q-num-1">Q1</span>
                <span className="cons-q-label">ぜんぶ見返して、一番の発見は?</span>
              </div>
              <textarea
                className="rec-textarea"
                rows={3}
                value={q1}
                onChange={(e) => setQ1(e.target.value)}
              />
              {polished && (
                <div className="cons-polish-box">
                  <div className="cons-polish-label">🤖 整えた案</div>
                  <p className="cons-polish-text">{polished.q1}</p>
                  <button className="cons-apply-btn" onClick={() => applyPolished("q1")}>
                    これに反映する
                  </button>
                </div>
              )}
            </div>

            <div className="cons-q-card">
              <div className="cons-q-head">
                <span className="cons-q-num cons-q-num-2">Q2</span>
                <span className="cons-q-label">さいしょの予想と比べてどうだった?</span>
              </div>
              <textarea
                className="rec-textarea"
                rows={3}
                value={q2}
                onChange={(e) => setQ2(e.target.value)}
              />
              {polished && (
                <div className="cons-polish-box">
                  <div className="cons-polish-label">🤖 整えた案</div>
                  <p className="cons-polish-text">{polished.q2}</p>
                  <button className="cons-apply-btn" onClick={() => applyPolished("q2")}>
                    これに反映する
                  </button>
                </div>
              )}
            </div>

            {polishError && <p className="sch-draft-error">{polishError}</p>}

            {polished ? (
              <button className="cons-secondary-btn" onClick={closePolished}>
                案をとじる
              </button>
            ) : (
              <button
                className="cons-ai-btn"
                onClick={handlePolish}
                disabled={polishLoading || (!q1.trim() && !q2.trim())}
              >
                {polishLoading ? "整え中…" : "🤖 AIが文章を整える(内容はそのまま)"}
              </button>
            )}

            {saveMessage && <p className="sch-save-message">{saveMessage}</p>}

            <button
              className="next-btn cons-save-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "ほぞん中…" : "💾 ほぞんする"}
            </button>

            {onNext && (
              <button
                className="next-btn cons-to-summary-btn"
                onClick={onNext}
              >
                📗 まとめを作る →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ISO日時 → 「7/25(土)」形式
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}
