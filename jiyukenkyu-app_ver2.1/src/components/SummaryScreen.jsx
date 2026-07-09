import { useState, useEffect, useMemo } from "react";
import { apiGet, apiPost } from "../services/api";
import { useResearch } from "../contexts/ResearchContext";
import ReportView from "./ReportView";
import { getGraphTypeById } from "../data/graphTypes";
import { buildReportData } from "../data/buildReport";

// STEP7: じゆうけんきゅうを まとめよう
// ①じぶんのことば → ②プレビュー → ③かんせい
// AIは使わない。子どもが書いた Q1・Q2 と、これまでのDBデータを
// そのままレポート(JSON)に流し込み、承認したらDBへ保存する。
export default function SummaryScreen({ userId, onBack }) {
  const { research } = useResearch();
  const { theme, hypothesis } = research ?? {};
  const [view, setView] = useState("write"); // 'write' | 'preview' | 'done'

  const [records, setRecords] = useState([]);
  const [graphs, setGraphs] = useState([]);
  const [schedule, setSchedule] = useState(null); // { endDate, tasks }
  const [reflection, setReflection] = useState({ q1: "", q2: "" });
  const [loading, setLoading] = useState(true);

  const [summaryDid, setSummaryDid] = useState(""); // Q1: やったこと
  const [summaryTell, setSummaryTell] = useState(""); // Q2: つたえたいこと
  const [restoredNotice, setRestoredNotice] = useState(false);

  const [saving, setSaving] = useState(false);

  // 今の仮説"以外"のテーマ・仮説(タイトルだけ)。多くの子はテーマ・仮説を
  // いくつも考えるが、研究方法から先は1本にしぼって進める想定なので、
  // 経緯として「ほかにも考えたこと」をまとめのPDFにタイトルだけ載せる。
  const [otherResearch, setOtherResearch] = useState([]);

  // この仮説の記録・グラフ・スケジュール・考察・(あれば)保存済みまとめを読み込む
  useEffect(() => {
    if (!userId || !hypothesis?.id) return;
    let ignore = false;
    async function fetchAll() {
      setLoading(true);
      try {
        const data = await apiGet(`/api/research/${hypothesis.id}`);
        if (ignore) return;
        if (data.success) {
          setRecords(data.records);
          setGraphs(data.graphs);
          if (data.schedule) {
            setSchedule({ endDate: data.schedule.end_date, tasks: data.schedule.tasks ?? [] });
          }
          if (data.consideration) {
            setReflection({ q1: data.consideration.q1 ?? "", q2: data.consideration.q2 ?? "" });
          }
          // すでにまとめを作っていれば、書いた言葉を復元する
          const rd = data.report?.report_data;
          if (rd) {
            setSummaryDid(rd.summaryDid ?? "");
            setSummaryTell(rd.summaryTell ?? "");
            setRestoredNotice(true);
          }
        }
      } catch {
        // 読み込みに失敗しても、書くこと自体はできるので黙って続行
      }
      if (!ignore) setLoading(false);
    }
    fetchAll();
    return () => {
      ignore = true;
    };
  }, [userId, hypothesis?.id]);

  // 今の仮説以外のテーマ・仮説(タイトルだけ)を読み込む。テーマ選択・仮説パートの
  // ために用意した既存エンドポイントをそのまま使う(ResearchListScreenと同じ
  // 組み立て方)。admin側のPDF化は report_data のスナップショットしか見ないため、
  // この一覧は"表示"ではなくreport_dataに焼き込む材料としてここで持つ。
  useEffect(() => {
    if (!userId) return;
    let ignore = false;
    async function fetchOtherResearch() {
      try {
        const [themesRes, hypRes] = await Promise.all([
          apiGet('/api/themes'),
          apiGet('/api/hypotheses'),
        ]);
        if (ignore) return;
        if (themesRes.success && hypRes.success) {
          const themeById = new Map(themesRes.themes.map((t) => [t.id, t]));
          const list = hypRes.hypotheses
            .filter((h) => h.id !== hypothesis?.id)
            .map((h) => ({
              theme: themeById.get(h.theme_id)?.theme ?? "",
              hypothesis: h.hypothesis,
            }))
            .reverse(); // 新しい順
          setOtherResearch(list);
        }
      } catch {
        // 一覧が取れなくても、今の研究のまとめ作成自体はできるので黙って無視
      }
    }
    fetchOtherResearch();
    return () => {
      ignore = true;
    };
  }, [userId, hypothesis?.id]);

  // プレビュー/保存で使う report JSON。書いた言葉やデータが変わるたび作り直す。
  const report = useMemo(
    () =>
      buildReportData({
        userNumber: userId,
        theme: theme?.theme,
        category: theme?.category,
        hypothesis: hypothesis?.hypothesis,
        schedule,
        records,
        graphs,
        reflection,
        summaryDid,
        summaryTell,
        otherResearch,
      }),
    [userId, theme, hypothesis, schedule, records, graphs, reflection, summaryDid, summaryTell, otherResearch],
  );

  // ヒント: これまで書いた「なぜ?」を日づけ順に
  const whyHints = records
    .filter((r) => r.why_note)
    .slice()
    .sort((a, b) => new Date(a.observed_at) - new Date(b.observed_at));

  const canPreview = summaryDid.trim() || summaryTell.trim();

  async function handleApprove() {
    if (saving) return;
    setSaving(true);
    try {
      const data = await apiPost('/api/save-report', {
        hypothesis_id: hypothesis?.id,
        report_data: report,
      });
      if (!data.success) throw new Error(data.error);
      setView("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      alert("まとめの保存に失敗しました: " + err.message);
    }
    setSaving(false);
  }

  return (
    <div className="summary-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>
          ← 戻る
        </button>
        <h2>📗 じゆうけんきゅうを まとめよう</h2>
      </div>

      <div className="summary-content">
        <div className="sch-tabs">
          <button
            className={`sch-tab ${view === "write" ? "active" : ""}`}
            onClick={() => setView("write")}
          >
            ①じぶんのことば
          </button>
          <button
            className={`sch-tab ${view === "preview" ? "active" : ""}`}
            onClick={() => canPreview && setView("preview")}
            disabled={!canPreview}
          >
            ②プレビュー
          </button>
          <button
            className={`sch-tab ${view === "done" ? "active" : ""}`}
            disabled={view !== "done"}
          >
            ③かんせい
          </button>
        </div>

        {/* ① じぶんのことば */}
        {view === "write" && (
          <>
            {hypothesis?.hypothesis && (
              <div className="rec-hypo-recap">
                <span className="rec-hypo-label">💭 さいしょの予想</span>
                {hypothesis.hypothesis}
              </div>
            )}

            {restoredNotice && (
              <div className="sch-restore-banner">
                📥 前回書いたまとめを読み込んだよ
                <button
                  className="sch-restore-close"
                  onClick={() => setRestoredNotice(false)}
                  aria-label="閉じる"
                >
                  ✕
                </button>
              </div>
            )}

            <p className="summary-lead">
              さいごのステップ！これまでのきろくを見返しながら、
              <b>じぶんのことば</b>でまとめてみよう。
            </p>

            {/* ヒント一覧 */}
            <p className="cons-sublabel">📌 これまでのきろく(ヒント)</p>
            {loading ? (
              <p className="rec-empty">読み込み中…</p>
            ) : (
              <div className="summary-hint-list">
                {whyHints.map((r) => (
                  <div className="summary-hint" key={`w${r.id}`}>
                    <span className="summary-hint-badge b-kiroku">
                      {r.record_type === "kiroku" ? "🧪" : "🔍"} {shortDate(r.observed_at)}
                    </span>
                    <span className="summary-hint-text">{r.why_note}</span>
                  </div>
                ))}
                {graphs.map((g) => {
                  const gd = g.graph_data || {};
                  const info = getGraphTypeById(gd.graphType);
                  return (
                    <div className="summary-hint" key={`g${g.id}`}>
                      <span className="summary-hint-badge b-graph">📊 グラフ</span>
                      <span className="summary-hint-text">{gd.title || info.label}</span>
                    </div>
                  );
                })}
                {reflection.q1 && (
                  <div className="summary-hint">
                    <span className="summary-hint-badge b-shirabe">💡 考察</span>
                    <span className="summary-hint-text">{reflection.q1}</span>
                  </div>
                )}
                {whyHints.length === 0 && graphs.length === 0 && !reflection.q1 && (
                  <div className="cons-empty-note">まだヒントになるきろくがないよ</div>
                )}
              </div>
            )}

            <div className="cons-q-card" style={{ marginTop: 18 }}>
              <div className="cons-q-label">
                Q1. 今回の自由研究では、どんなことをしらべた・やってみた?
              </div>
              <textarea
                className="rec-textarea"
                rows={3}
                placeholder="例: 保冷剤の大きさをかえて、とける時間を3回くらべた。"
                value={summaryDid}
                onChange={(e) => setSummaryDid(e.target.value)}
              />
            </div>

            <div className="cons-q-card">
              <div className="cons-q-label">
                Q2. やってみて、いちばん つたえたいことは?
              </div>
              <textarea
                className="rec-textarea"
                rows={3}
                placeholder="例: 大きさで2倍もちがってびっくりした。表面積が関係してると思う。"
                value={summaryTell}
                onChange={(e) => setSummaryTell(e.target.value)}
              />
            </div>

            <button
              className="next-btn summary-to-preview-btn"
              onClick={() => setView("preview")}
              disabled={!canPreview}
            >
              📝 まとめをプレビューする →
            </button>
          </>
        )}

        {/* ② プレビュー */}
        {view === "preview" && (
          <>
            <p className="summary-lead">
              あなたが書いた言葉に、きろく・グラフ・スケジュールをあわせたよ。
              これでよければ「かんせい」にしよう。
            </p>

            <div className="summary-preview-wrap">
              <ReportView report={report} />
            </div>

            <div className="summary-preview-actions">
              <button
                className="cons-secondary-btn"
                onClick={() => setView("write")}
              >
                ✏️ 書きなおす
              </button>
              <button
                className="next-btn"
                onClick={handleApprove}
                disabled={saving}
              >
                {saving ? "ほぞん中…" : "✅ これでかんせいにする"}
              </button>
            </div>
          </>
        )}

        {/* ③ かんせい */}
        {view === "done" && (
          <div className="summary-done">
            <div className="summary-done-emoji">🎉</div>
            <div className="summary-done-title">まとめができたよ!</div>

            <div className="summary-done-note">
              <b>💾 きろくはずっと残るよ</b>
              <br />
              これで終わりでも、まだつづけてもOK。あとで記録を足したら、
              またここからまとめを作りなおせるよ。
            </div>

            <div className="summary-continue-note">
              🌱 予想とちがってもOK。まとめられたこと自体が、りっぱな自由研究のいちぽ！
            </div>

            <div className="summary-done-preview">
              <ReportView report={report} />
            </div>

            <button
              className="cons-secondary-btn"
              onClick={() => setView("write")}
            >
              ✏️ もう一度なおす
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ISO日時 → 「7/25」
function shortDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
