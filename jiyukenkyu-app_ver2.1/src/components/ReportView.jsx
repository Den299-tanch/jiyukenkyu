import GraphView from "./GraphView";
import { getGraphTypeById } from "../data/graphTypes";
import { getViewpointLabel } from "../data/recordViewpoints";

// まとめレポートの「見た目」を1つにまとめた汎用テンプレート。
// 子どもの承認プレビューでも、先生のPDF化画面でも、この同じ部品を使う。
// 受け取るのは保存用の report_data JSON そのもの(DBに入るのと同じ形)。
// 表示専用。データ取得も保存もしない。
//
// forPdf=true のときは、PDF(html2pdf.js)で崩れにくいよう
// アニメーションや影を弱めた静的な体裁で描く。
export default function ReportView({ report, forPdf = false }) {
  if (!report) return null;

  const {
    userNumber,
    theme,
    hypothesis,
    otherResearch = [],
    period,
    schedule = [],
    summaryDid,
    summaryTell,
    records = [],
    graphs = [],
    reflection = {},
  } = report;

  const periodText = formatPeriod(period);

  return (
    <div className={`report-sheet ${forPdf ? "for-pdf" : ""}`}>
      {/* 表紙ヘッダー */}
      <header className="report-cover">
        <div className="report-cover-tag">じゆうけんきゅう</div>
        <h1 className="report-cover-title">{theme || "わたしの自由研究"}</h1>
        <div className="report-cover-meta">
          {userNumber != null && <span>🙋 {userNumber}ばん</span>}
          {periodText && <span>🗓️ {periodText}</span>}
        </div>
      </header>

      {/* ほかにも考えたテーマ・仮説(タイトルだけ。深く進めたのは下の1本) */}
      {otherResearch.length > 0 && (
        <Section icon="📚" title="ほかにも考えたテーマ・予想" tone="purple">
          <ul className="report-other-list">
            {otherResearch.map((o, i) => (
              <li className="report-other-item" key={i}>
                {o.theme && <span className="report-other-theme">{o.theme}</span>}
                {o.hypothesis && (
                  <span className="report-other-hypo">{o.hypothesis}</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* さいしょの予想 */}
      {hypothesis && (
        <Section icon="💭" title="さいしょの予想" tone="purple">
          <p className="report-p">{hypothesis}</p>
        </Section>
      )}

      {/* けんきゅうのながれ(スケジュール) */}
      {schedule.length > 0 && (
        <Section icon="🧭" title="けんきゅうのながれ" tone="teal">
          <div className="report-schedule-strip">
            {schedule.map((t, i) => (
              <div
                className={`report-schedule-chip ${t.done ? "is-done" : ""}`}
                key={i}
              >
                <span className="report-schedule-date">{t.date}</span>
                <span className="report-schedule-task">{t.task}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* やったこと(じぶんのことば Q1) */}
      {summaryDid && (
        <Section icon="✏️" title="やったこと" tone="teal">
          <OwnWords text={summaryDid} />
        </Section>
      )}

      {/* きろく・しらべたこと */}
      {records.length > 0 && (
        <Section icon="🧪" title="きろく・しらべたこと" tone="teal">
          <div className="report-record-list">
            {records.map((r) => (
              <RecordCard key={r.id ?? r.observed_at} record={r} />
            ))}
          </div>
        </Section>
      )}

      {/* グラフ */}
      {graphs.length > 0 && (
        <Section icon="📊" title="グラフでわかったこと" tone="yellow">
          <div className="report-graph-list">
            {graphs.map((g, i) => {
              const info = getGraphTypeById(g.graphType);
              return (
                <figure className="report-graph-card" key={i}>
                  <figcaption className="report-graph-title">
                    {g.title || info.label}
                  </figcaption>
                  <div className="report-graph-canvas">
                    <GraphView
                      type={g.graphType}
                      entries={g.entries || []}
                      xAxis={g.xAxis ?? undefined}
                      yLabel={g.yLabel ?? undefined}
                      xAxisLabel={g.xAxisLabel ?? undefined}
                    />
                  </div>
                  <div className="report-graph-sub">
                    {info.icon} {info.label}
                  </div>
                </figure>
              );
            })}
          </div>
        </Section>
      )}

      {/* わかったこと・つたえたいこと(じぶんのことば Q2) */}
      {summaryTell && (
        <Section icon="🌟" title="いちばん つたえたいこと" tone="coral">
          <OwnWords text={summaryTell} />
        </Section>
      )}

      {/* ふりかえり(STEP6の考察) */}
      {(reflection.q1 || reflection.q2) && (
        <Section icon="💡" title="ふりかえって かんがえたこと" tone="purple">
          {reflection.q1 && (
            <div className="report-reflect-block">
              <div className="report-reflect-q">いちばんの発見</div>
              <p className="report-p">{reflection.q1}</p>
            </div>
          )}
          {reflection.q2 && (
            <div className="report-reflect-block">
              <div className="report-reflect-q">予想とくらべて</div>
              <p className="report-p">{reflection.q2}</p>
            </div>
          )}
        </Section>
      )}

      <footer className="report-foot">🌱 じぶんの力でまとめた、りっぱな自由研究！</footer>
    </div>
  );
}

// 見出し+中身の共通ブロック(左に色つきのライン)
function Section({ icon, title, tone, children }) {
  return (
    <section className={`report-section tone-${tone}`}>
      <h2 className="report-h">
        <span className="report-h-icon">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

// 「じぶんのことば」を強調する黄色い枠(子どもが書いた文章はここに入れて大事にする)
function OwnWords({ text }) {
  return (
    <div className="report-own-words">
      <span className="report-own-tag">✏️ じぶんのことば</span>
      <p className="report-p">{text}</p>
    </div>
  );
}

// 記録1件のカード(気づき・なぜ?・視点チップ・数字)
function RecordCard({ record }) {
  const isKiroku = record.record_type === "kiroku";
  const numbers = record.numbers ?? [];
  const viewpoints = record.viewpoints ?? [];
  return (
    <div className="report-record-card">
      <div className="report-record-head">
        <span
          className={`report-record-badge ${isKiroku ? "b-kiroku" : "b-shirabe"}`}
        >
          {isKiroku ? "🧪 きろく" : "🔍 しらべた"}
        </span>
        <span className="report-record-date">{shortDate(record.observed_at)}</span>
      </div>
      {record.body && <p className="report-p">{record.body}</p>}
      {record.why_note && (
        <p className="report-record-why">
          <b>{isKiroku ? "なぜ?" : "予想と…"}</b> {record.why_note}
        </p>
      )}
      {(viewpoints.length > 0 || numbers.length > 0) && (
        <div className="report-record-chips">
          {viewpoints.map((v, i) => (
            <span className="report-chip vp" key={`v${i}`}>
              {getViewpointLabel(record.record_type, v)}
            </span>
          ))}
          {numbers.map((n, i) => (
            <span className="report-chip num" key={`n${i}`}>
              {n.label}: {n.value}
              {n.unit}
            </span>
          ))}
        </div>
      )}
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

// 期間 { start, end } を「7/25〜7/28」のように整形
// end はカレンダー入力の "YYYY-MM-DD" 形式で来る
function formatPeriod(period) {
  if (!period) return "";
  const s = shortDate(period.start);
  const e = shortDate(period.end);
  if (s && e) return `${s}〜${e}`;
  return s || e || "";
}
