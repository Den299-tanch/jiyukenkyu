import { useState, useRef } from "react";
import ReportView from "./components/ReportView";
import { downloadElementAsPdf } from "./services/pdf";
import "./App.css";

// 管理者モード。
// エンドユーザーには存在を見せない隠しモード(#admin などで入る)。
// ①パスコード → ②まとめ一覧/ユーザー管理(タブ) → ③PDF化。
// パスコードはサーバー側の環境変数で照合する(ここでは持たない)。
const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function adminPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// 進捗ダッシュボードの列(DBの集計キー → 表示名)。この順に左から並ぶ
const PROGRESS_STEPS = [
  { key: "themes", label: "テーマ" },
  { key: "hypotheses", label: "仮説" },
  { key: "methods", label: "方法" },
  { key: "schedules", label: "計画" },
  { key: "records", label: "記録" },
  { key: "graphs", label: "グラフ" },
  { key: "considerations", label: "考察" },
  { key: "reports", label: "まとめ" },
];

const AI_KIND_LABELS = {
  hypothesis_hint: "仮説ヒント",
  rm_what_to_study: "方法(何を調べる)",
  rm_tools_materials: "方法(道具・材料)",
  schedule_draft: "スケジュールたたき台",
};

const STALE_DAYS = 7; // この日数以上動きがない子を目立たせる

export default function AdminApp() {
  const [stage, setStage] = useState("lock"); // 'lock' | 'list' | 'pdf' | 'users'
  const [passcode, setPasscode] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const sheetRef = useRef(null);

  // 進捗ダッシュボードタブ
  const [progress, setProgress] = useState([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState("");

  // AIヒント使用状況タブ
  const [aiUsage, setAiUsage] = useState([]);
  const [aiUsageLimit, setAiUsageLimit] = useState(4);
  const [aiUsageLoading, setAiUsageLoading] = useState(false);
  const [aiUsageError, setAiUsageError] = useState("");
  const [granting, setGranting] = useState(null); // "userId:kind:contextId" 付与中の行

  // ユーザー管理タブ
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [resetTarget, setResetTarget] = useState(null); // リセット確認中のユーザー行
  const [resetConfirmNum, setResetConfirmNum] = useState(""); // 打ち直し確認用の番号入力
  const [resetting, setResetting] = useState(false);
  const [resetNotice, setResetNotice] = useState(""); // リセット完了後の案内

  async function handleUnlock() {
    if (authLoading) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      const data = await adminPost("/api/admin/reports", { passcode });
      if (!data.success) {
        throw new Error(data.error || "ちがうパスコードです");
      }
      setReports(data.reports || []);
      setStage("list");
    } catch (err) {
      setAuthError(err.message);
    }
    setAuthLoading(false);
  }

  // 「しんちょく」タブを開く(開くたびに最新の集計を取り直す)
  async function openProgress() {
    setStage("progress");
    setProgressLoading(true);
    setProgressError("");
    try {
      const data = await adminPost("/api/admin/progress", { passcode });
      if (!data.success) throw new Error(data.error || "進捗の取得に失敗しました");
      setProgress(data.progress || []);
    } catch (err) {
      setProgressError(err.message);
    }
    setProgressLoading(false);
  }

  // 「AIヒント」タブを開く(開くたびに最新の使用状況を取り直す)
  async function openAiUsage() {
    setStage("ai");
    setAiUsageLoading(true);
    setAiUsageError("");
    try {
      const data = await adminPost("/api/admin/ai-usage", { passcode });
      if (!data.success) throw new Error(data.error || "使用状況の取得に失敗しました");
      setAiUsage(data.usage || []);
      setAiUsageLimit(data.limit ?? 4);
    } catch (err) {
      setAiUsageError(err.message);
    }
    setAiUsageLoading(false);
  }

  // その行(その子×その機能×その研究)の上限を1回ぶん積み増す
  async function handleGrant(row) {
    const key = `${row.user_id}:${row.kind}:${row.context_id}`;
    if (granting) return;
    setGranting(key);
    try {
      const data = await adminPost("/api/admin/grant-ai-use", {
        passcode,
        user_id: row.user_id,
        kind: row.kind,
        context_id: row.context_id,
      });
      if (!data.success) throw new Error(data.error || "追加付与に失敗しました");
      setAiUsage((prev) =>
        prev.map((r) =>
          r.user_id === row.user_id && r.kind === row.kind && r.context_id === row.context_id
            ? { ...r, used: data.used, bonus: data.bonus }
            : r,
        ),
      );
    } catch (err) {
      alert("追加付与に失敗しました: " + err.message);
    }
    setGranting(null);
  }

  // 「ユーザー管理」タブを開く(開くたびに最新の登録状況を取り直す)
  async function openUsers() {
    setStage("users");
    setUsersLoading(true);
    setUsersError("");
    try {
      const data = await adminPost("/api/admin/users", { passcode });
      if (!data.success) throw new Error(data.error || "一覧の取得に失敗しました");
      setUsers(data.users || []);
    } catch (err) {
      setUsersError(err.message);
    }
    setUsersLoading(false);
  }

  function openResetConfirm(user) {
    setResetTarget(user);
    setResetConfirmNum("");
    setResetNotice("");
  }

  async function handleReset() {
    if (!resetTarget || resetting) return;
    setResetting(true);
    try {
      const data = await adminPost("/api/admin/reset-user", {
        passcode,
        user_id: resetTarget.id,
      });
      if (!data.success) throw new Error(data.error || "リセットに失敗しました");
      setUsers((prev) => prev.filter((u) => u.id !== resetTarget.id));
      setResetNotice(
        `${resetTarget.id}ばんのあんしょう番号をリセットしました。次にこの番号でログインするとき、新しいあんしょう番号を登録できます。`,
      );
      setResetTarget(null);
    } catch (err) {
      alert("リセットに失敗しました: " + err.message);
    }
    setResetting(false);
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

      {/* 各機能の切り替えタブ */}
      {stage !== "lock" && stage !== "pdf" && (
        <div className="admin-tabs">
          <button
            className={`admin-tab ${stage === "list" ? "active" : ""}`}
            onClick={() => setStage("list")}
          >
            📋 まとめ一覧
          </button>
          <button
            className={`admin-tab ${stage === "progress" ? "active" : ""}`}
            onClick={openProgress}
          >
            📊 しんちょく
          </button>
          <button
            className={`admin-tab ${stage === "ai" ? "active" : ""}`}
            onClick={openAiUsage}
          >
            💡 AIヒント
          </button>
          <button
            className={`admin-tab ${stage === "users" ? "active" : ""}`}
            onClick={openUsers}
          >
            👤 ユーザー管理
          </button>
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

      {/* ②'' 進捗ダッシュボード */}
      {stage === "progress" && (
        <div className="admin-list admin-list-wide">
          <div className="admin-list-header">
            <div className="admin-list-title">📊 みんなのしんちょく</div>
            <div className="admin-list-count">{progress.length} 人</div>
          </div>

          <div className="admin-bulk-note">
            💡 数字は「そのステップで保存した件数」です。0のままの列がその子の止まっている場所。
            {STALE_DAYS}日以上動きがない子には 😴 マークがつきます。
          </div>

          {progressError && <div className="admin-lock-error">{progressError}</div>}

          {progressLoading ? (
            <div className="admin-empty">読み込み中…</div>
          ) : progress.length === 0 ? (
            <div className="admin-empty">まだ だれも始めていません。</div>
          ) : (
            <table className="admin-roster admin-progress-table">
              <thead>
                <tr>
                  <th>ばんごう</th>
                  {PROGRESS_STEPS.map((s) => (
                    <th key={s.key} className="admin-progress-th">{s.label}</th>
                  ))}
                  <th>さいごの活動</th>
                </tr>
              </thead>
              <tbody>
                {progress.map((p) => {
                  const stale = isStale(p.last_activity);
                  return (
                    <tr key={p.id} className={stale ? "admin-stale-row" : ""}>
                      <td className="admin-num">
                        {p.id}ばん{stale && <span className="admin-stale-mark"> 😴</span>}
                      </td>
                      {PROGRESS_STEPS.map((s) => (
                        <td
                          key={s.key}
                          className={`admin-progress-cell ${p[s.key] === 0 ? "zero" : ""}`}
                        >
                          {p[s.key]}
                        </td>
                      ))}
                      <td className="admin-time">
                        {p.last_activity ? formatTime(p.last_activity) : "まだ何もなし"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ②''' AIヒント使用状況と追加付与 */}
      {stage === "ai" && (
        <div className="admin-list admin-list-wide">
          <div className="admin-list-header">
            <div className="admin-list-title">💡 AIヒントの使用状況</div>
            <div className="admin-list-count">{aiUsage.length} 件</div>
          </div>

          <div className="admin-bulk-note">
            💡 基本の上限は {aiUsageLimit} 回です。本当に困っている子には「＋1回」で
            その研究・その機能の上限を増やせます(何回でも積み増しできます)。
          </div>

          {aiUsageError && <div className="admin-lock-error">{aiUsageError}</div>}

          {aiUsageLoading ? (
            <div className="admin-empty">読み込み中…</div>
          ) : aiUsage.length === 0 ? (
            <div className="admin-empty">まだ AIヒントは使われていません。</div>
          ) : (
            <table className="admin-roster">
              <thead>
                <tr>
                  <th>ばんごう</th>
                  <th>機能</th>
                  <th>どの研究</th>
                  <th>回数</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {aiUsage.map((row) => {
                  const key = `${row.user_id}:${row.kind}:${row.context_id}`;
                  const limit = aiUsageLimit + (row.bonus ?? 0);
                  const maxed = row.used >= limit;
                  return (
                    <tr key={key}>
                      <td className="admin-num">{row.user_id}ばん</td>
                      <td>
                        <span className="admin-kind-chip">
                          {AI_KIND_LABELS[row.kind] ?? row.kind}
                        </span>
                      </td>
                      <td className="admin-theme admin-context-label">
                        {row.context_label || "(不明)"}
                      </td>
                      <td className={`admin-usage-count ${maxed ? "maxed" : ""}`}>
                        {row.used} / {limit}
                        {row.bonus > 0 && (
                          <span className="admin-bonus-note">(+{row.bonus})</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="admin-grant-btn"
                          onClick={() => handleGrant(row)}
                          disabled={granting !== null}
                        >
                          {granting === key ? "付与中…" : "＋1回"}
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

      {/* ②' ユーザー管理(PINリセット) */}
      {stage === "users" && (
        <div className="admin-list">
          <div className="admin-list-header">
            <div className="admin-list-title">👤 ユーザー管理</div>
            <div className="admin-list-count">とうろく {users.length} 人</div>
          </div>

          <div className="admin-bulk-note">
            💡 あんしょう番号(PIN)をわすれた子がいたら、その番号を「リセット」してください。
            リセットしても研究データは消えません。次のログインで新しいあんしょう番号を登録できます。
          </div>

          {resetNotice && <div className="admin-reset-notice">✅ {resetNotice}</div>}
          {usersError && <div className="admin-lock-error">{usersError}</div>}

          {usersLoading ? (
            <div className="admin-empty">読み込み中…</div>
          ) : users.length === 0 ? (
            <div className="admin-empty">まだ とうろくされた番号がありません。</div>
          ) : (
            <table className="admin-roster">
              <thead>
                <tr>
                  <th>ばんごう</th>
                  <th>とうろく日</th>
                  <th>テーマ数</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="admin-num">{u.id}ばん</td>
                    <td className="admin-time">{formatTime(u.created_at)}</td>
                    <td className="admin-theme">{u.theme_count} 件</td>
                    <td>
                      <button
                        className="admin-row-btn"
                        onClick={() => openResetConfirm(u)}
                      >
                        PINリセット
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* PINリセットの確認モーダル(番号の打ち直しで誤操作を防ぐ) */}
      {resetTarget && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <div className="admin-modal-emoji">⚠️</div>
            <div className="admin-modal-title">
              {resetTarget.id}ばんのPINをリセットします
            </div>
            <p className="admin-modal-text">
              あんしょう番号だけが消えます。研究データはそのまま残ります。
              <br />
              次にこの番号でログインした子が、新しいあんしょう番号を登録します。
            </p>
            <p className="admin-modal-text">
              まちがい防止のため、リセットする番号を入力してください。
            </p>
            <input
              type="number"
              className="admin-modal-input"
              placeholder={`${resetTarget.id} と入力`}
              value={resetConfirmNum}
              autoFocus
              onChange={(e) => setResetConfirmNum(e.target.value)}
            />
            <div className="admin-modal-btn-row">
              <button
                className="admin-modal-cancel-btn"
                onClick={() => setResetTarget(null)}
                disabled={resetting}
              >
                やめる
              </button>
              <button
                className="admin-modal-danger-btn"
                onClick={handleReset}
                disabled={
                  resetting || resetConfirmNum.trim() !== String(resetTarget.id)
                }
              >
                {resetting ? "リセット中…" : "リセットする"}
              </button>
            </div>
          </div>
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

// 最終活動が STALE_DAYS 日より前なら true(活動が一度もない子は対象外)
function isStale(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d)) return false;
  return Date.now() - d.getTime() > STALE_DAYS * 24 * 60 * 60 * 1000;
}

// ISO日時 → 「7/25 14:32」
function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
