import { useState, useRef } from "react";
import ReportView from "./components/ReportView";
import { downloadElementAsPdf } from "./services/pdf";
import "./App.css";

// 管理者モード。
// エンドユーザーには存在を見せない隠しモード(#admin などで入る)。
// ①パスコード → ②一覧 → ③PDF化 の3画面。
// パスコードはサーバー側の環境変数で照合する(ここでは持たない)。
export default function AdminApp() {
  const [stage, setStage] = useState("lock"); // 'lock' | 'list' | 'pdf'
  const [passcode, setPasscode] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const sheetRef = useRef(null);

  async function handleUnlock() {
    if (authLoading) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ""}/api/admin/reports`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode }),
        },
      );
      const data = await res.json();
      if (res.status === 401 || !data.success) {
        throw new Error(data.error || "ちがうパスコードです");
      }
      setReports(data.reports || []);
      setStage("list");
    } catch (err) {
      setAuthError(err.message);
    }
    setAuthLoading(false);
  }

  function openPdf(report) {
    setSelected(report);
    setStage("pdf");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      const rd = selected?.report_data || {};
      const name = `${rd.userNumber ?? "no"}ばん_${(rd.theme || "まとめ").slice(0, 20)}.pdf`;
      await downloadElementAsPdf(sheetRef.current, name);
    } catch (err) {
      alert("PDFの作成に失敗しました: " + err.message);
    }
    setDownloading(false);
  }

  return (
    <div className="admin-app">
      {/* ① パスコード */}
      {stage === "lock" && (
        <div className="admin-lock-wrap">
          <div className="admin-lock-card">
            <div className="admin-lock-emoji">🔒</div>
            <div className="admin-lock-title">管理者モード</div>
            <div className="admin-lock-sub">パスコードを入力してください</div>
            <input
              type="password"
              inputMode="numeric"
              className="admin-lock-input"
              value={passcode}
              autoFocus
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              placeholder="••••"
            />
            {authError && <div className="admin-lock-error">{authError}</div>}
            <button
              className="admin-lock-btn"
              onClick={handleUnlock}
              disabled={authLoading || !passcode}
            >
              {authLoading ? "確認中…" : "入る"}
            </button>
            <div className="admin-lock-note">
              ※ パスコードは管理者だけが知っています
              <br />
              (サーバー側の環境変数で設定)
            </div>
          </div>
        </div>
      )}

      {/* ② 一覧 */}
      {stage === "list" && (
        <div className="admin-list">
          <div className="admin-list-header">
            <div className="admin-list-title">📋 みんなの自由研究</div>
            <div className="admin-list-count">
              かんせい {reports.length} 件
            </div>
          </div>

          <div className="admin-bulk-note">
            💡 「PDF化」を押すと、その場でレポートを作ってダウンロードできます。
            まとめて印刷したいときは、1人ずつ押して順番にダウンロードしてください。
          </div>

          {reports.length === 0 ? (
            <div className="admin-empty">まだ かんせいしたまとめがありません。</div>
          ) : (
            <table className="admin-roster">
              <thead>
                <tr>
                  <th>ばんごう</th>
                  <th>テーマ</th>
                  <th>さいごの更新</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const rd = r.report_data || {};
                  return (
                    <tr key={r.id}>
                      <td className="admin-num">
                        {rd.userNumber ?? r.user_id ?? "-"}ばん
                      </td>
                      <td className="admin-theme">{rd.theme || "(テーマなし)"}</td>
                      <td className="admin-time">{formatTime(r.updated_at)}</td>
                      <td>
                        <button
                          className="admin-row-btn"
                          onClick={() => openPdf(r)}
                        >
                          PDF化
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ③ PDF化 */}
      {stage === "pdf" && selected && (
        <div className="admin-pdf">
          <div className="admin-pdf-bar">
            <button
              className="cons-secondary-btn admin-back-btn"
              onClick={() => setStage("list")}
            >
              ← 一覧にもどる
            </button>
            <button
              className="next-btn admin-download-btn"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? "作成中…" : "⬇️ このPDFをダウンロード"}
            </button>
          </div>

          <div className="admin-pdf-preview">
            {/* この div がそのまま PDF になる */}
            <div ref={sheetRef}>
              <ReportView report={selected.report_data} forPdf />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ISO日時 → 「7/25 14:32」
function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
