import { useState, useEffect } from "react";
import { getMethodTypeById } from "../data/methodTypes";
import { TASK_TYPES, getTaskTypeById } from "../data/taskTypes";
import { apiGet, apiPost } from "../services/api";
import { useResearch } from "../contexts/ResearchContext";

const DRAFT_LIMIT = 3;

function makeTaskId() {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// カレンダー入力の "YYYY-MM-DD" → 「8月31日」表示に整形
function formatEndDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d)) return iso;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function ScheduleScreen({
  userId,
  onBack,
  onNext,
}) {
  const { research } = useResearch();
  const { theme, hypothesis, researchMethods } = research ?? {};
  const [tab, setTab] = useState("intro");
  const [endDate, setEndDate] = useState("");
  const [workDays, setWorkDays] = useState("");
  const [tasks, setTasks] = useState([]);
  const [planView, setPlanView] = useState("list"); // 'list' | 'calendar'
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [draftCount, setDraftCount] = useState(0);
  const [confirmingRetry, setConfirmingRetry] = useState(null); // null | false(初回) | true(やり直し)
  const [saving, setSaving] = useState(false);
  const [savingOnly, setSavingOnly] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [restoredNotice, setRestoredNotice] = useState(false);

  const draftsLeft = DRAFT_LIMIT - draftCount;

  // 戻るボタンなどで再度この画面に来たとき、すでに保存済みのスケジュールを読み込んで復元する
  useEffect(() => {
    if (!userId || !hypothesis?.id) return;
    async function fetchExisting() {
      try {
        const data = await apiGet(`/api/research/${hypothesis.id}`);
        if (!data.success) return;
        const existing = data.schedule;
        if (existing) {
          setEndDate(existing.end_date ?? "");
          setTasks(existing.tasks ?? []);
          setTab("plan");
          setRestoredNotice(true);
        }
      } catch {
        // 読み込みに失敗しても、これから新しく作ること自体はできるので黙って無視
      }
    }
    fetchExisting();
  }, [userId, hypothesis?.id]);

  useEffect(() => {
    if (!saveMessage) return;
    const timer = setTimeout(() => setSaveMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [saveMessage]);

  function openDraftConfirm(isRetry) {
    if (draftsLeft <= 0 || draftLoading) return;
    setConfirmingRetry(isRetry);
  }

  function handleConfirmDraft() {
    const isRetry = confirmingRetry;
    setConfirmingRetry(null);
    requestDraft(isRetry);
  }

  async function requestDraft(isRetry) {
    setDraftLoading(true);
    setDraftError("");
    try {
      const data = await apiPost('/api/schedule-draft', {
        theme_title: theme?.theme,
        hypothesis: hypothesis?.hypothesis,
        end_date: endDate,
        work_days: workDays,
        research_methods: (researchMethods ?? []).map((rm) => ({
          method_type_label: getMethodTypeById(rm.method_type)?.label,
          what_to_study: rm.what_to_study,
          tools_materials: rm.tools_materials,
          location: rm.location,
          duration: rm.duration,
          summary: rm.summary,
        })),
        previous_tasks: isRetry ? tasks : undefined,
      });
      if (!data.content)
        throw new Error(data.error?.message ?? JSON.stringify(data));

      const raw = data.content[0].text.trim();
      const parsed = JSON.parse(raw);
      const withIds = (parsed.tasks ?? []).map((t) => ({
        id: makeTaskId(),
        date: t.date ?? "",
        task: t.task ?? "",
        type: t.type ?? "other",
        done: !!t.done,
      }));
      setTasks(withIds);
      setTab("plan");
      setDraftCount((prev) => prev + 1);
    } catch (err) {
      setDraftError(
        "たたき台づくりに失敗したよ: " + err.message + "（もう一度試してみてね）",
      );
    }
    setDraftLoading(false);
  }

  function handleWriteMyself() {
    setTasks((prev) => [
      ...prev,
      { id: makeTaskId(), date: "", task: "", type: "other", done: false },
    ]);
    setTab("plan");
  }

  function updateTask(id, field, value) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
    );
  }

  function toggleDone(id) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }

  function deleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function addRow() {
    setTasks((prev) => [
      ...prev,
      { id: makeTaskId(), date: "", task: "", type: "other", done: false },
    ]);
  }

  async function saveScheduleToServer() {
    const data = await apiPost('/api/save-schedule', {
      hypothesis_id: hypothesis?.id,
      end_date: endDate,
      tasks,
    });
    if (!data.success) throw new Error(data.error);
    return data;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data = await saveScheduleToServer();
      onNext(data.data);
    } catch (err) {
      alert("保存に失敗しました: " + err.message);
    }
    setSaving(false);
  }

  async function handleSaveOnly() {
    setSavingOnly(true);
    setSaveMessage("");
    try {
      await saveScheduleToServer();
      setRestoredNotice(false);
      setSaveMessage("✅ ここまでのスケジュールをほぞんしたよ!");
    } catch (err) {
      alert("保存に失敗しました: " + err.message);
    }
    setSavingOnly(false);
  }

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="schedule-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>
          ← 戻る
        </button>
        <h2>🗓️ スケジュールを立てよう</h2>
      </div>

      <div className="schedule-content">
        <div className="sch-tabs">
          <button
            className={`sch-tab ${tab === "intro" ? "active" : ""}`}
            onClick={() => setTab("intro")}
          >
            ① はじめに
          </button>
          <button
            className={`sch-tab ${tab === "plan" ? "active" : ""}`}
            onClick={() => setTab("plan")}
          >
            ② けいかくひょう
          </button>
        </div>

        {tab === "intro" && (
          <>
            <div className="sch-intro-banner">
              🗓️ じぶんで書いてもいいし、AIにたたき台をつくってもらってもいいよ。
            </div>
            <p className="sch-headline">夏休み、いつまでに研究をすすめたい?</p>

            <div className="sch-date-card">
              <div className="sch-date-label">
                📅 おわりの日
                <span className="rm-badge-required">*</span>
              </div>
              <input
                type="date"
                className="sch-date-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="sch-date-card">
              <div className="sch-date-label">
                🔢 なんにちで やりたい?
                <span className="rm-badge-required">*</span>
              </div>
              <div className="sch-workdays-row">
                <input
                  type="number"
                  min="1"
                  max="90"
                  className="sch-date-input sch-workdays-input"
                  placeholder="例: 10"
                  value={workDays}
                  onChange={(e) => setWorkDays(e.target.value)}
                />
                <span className="sch-workdays-suffix">日</span>
              </div>
            </div>

            {tasks.length === 0 && (
              <div className="sch-blank-table">
                <div className="sch-blank-th">
                  <span>日づけ</span>
                  <span>やること</span>
                  <span>しゅるい</span>
                  <span>✓</span>
                </div>
                <div className="sch-ghost-row">まだ何も入っていません</div>
                <div className="sch-ghost-row">ボタンをおして始めよう</div>
              </div>
            )}

            {draftError && <p className="sch-draft-error">{draftError}</p>}

            <button
              className="next-btn sch-ai-btn"
              onClick={() => openDraftConfirm(false)}
              disabled={draftLoading || !endDate.trim() || !workDays || draftsLeft <= 0}
            >
              {draftLoading
                ? "たたき台を考え中…"
                : `🤖 AIにたたき台をつくってもらう (残り${Math.max(draftsLeft, 0)}/${DRAFT_LIMIT}回)`}
            </button>
            <button className="sch-secondary-btn" onClick={handleWriteMyself}>
              ✏️ 自分で書く(空の行を追加)
            </button>
          </>
        )}

        {tab === "plan" && (
          <>
            {restoredNotice && (
              <div className="sch-restore-banner">
                📥 前回ほぞんしたスケジュールを読み込んだよ
                <button
                  className="sch-restore-close"
                  onClick={() => setRestoredNotice(false)}
                  aria-label="閉じる"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="sch-summary-row">
              <span className="sch-end-chip">
                〜 {formatEndDate(endDate) || "おわりの日未定"} まで
              </span>
              <span className="sch-progress-note">
                {doneCount} こ / {tasks.length} こ できた!
              </span>
            </div>

            {tasks.length > 0 && (
              <div className="sch-view-toggle">
                <button
                  className={`sch-view-btn ${planView === "list" ? "active" : ""}`}
                  onClick={() => setPlanView("list")}
                >
                  📋 リスト
                </button>
                <button
                  className={`sch-view-btn ${planView === "calendar" ? "active" : ""}`}
                  onClick={() => setPlanView("calendar")}
                >
                  🗓️ カレンダー
                </button>
              </div>
            )}

            {planView === "calendar" && tasks.length > 0 && (
              <ScheduleCalendar
                tasks={tasks}
                endDate={endDate}
                toggleDone={toggleDone}
              />
            )}

            {planView === "list" && tasks.map((t) => {
              const typeInfo = getTaskTypeById(t.type);
              return (
                <div key={t.id} className="sch-task-card">
                  <div className="sch-task-top">
                    <button
                      className={`sch-checkbox ${t.done ? "checked" : ""}`}
                      onClick={() => toggleDone(t.id)}
                      aria-label="完了"
                    />
                    <input
                      className="sch-date-field"
                      placeholder="例: 7/25(土)"
                      value={t.date}
                      onChange={(e) => updateTask(t.id, "date", e.target.value)}
                    />
                    <select
                      className={`sch-type-select t-${t.type}`}
                      value={t.type}
                      onChange={(e) => updateTask(t.id, "type", e.target.value)}
                    >
                      {TASK_TYPES.map((tt) => (
                        <option key={tt.id} value={tt.id}>
                          {tt.icon} {tt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="sch-del-btn"
                      onClick={() => deleteTask(t.id)}
                      aria-label="削除"
                    >
                      ✕
                    </button>
                  </div>
                  <span className={`sch-type-badge t-${t.type}`}>
                    {typeInfo.icon} {typeInfo.label}
                  </span>
                  <textarea
                    className={`sch-task-text ${t.done ? "done" : ""}`}
                    rows={2}
                    value={t.task}
                    onChange={(e) => updateTask(t.id, "task", e.target.value)}
                  />
                </div>
              );
            })}

            <button className="sch-add-row-btn" onClick={addRow}>
              ＋ タスクを追加
            </button>

            {draftError && <p className="sch-draft-error">{draftError}</p>}

            <button
              className="sch-retry-btn"
              onClick={() => openDraftConfirm(true)}
              disabled={draftLoading || !endDate.trim() || !workDays || draftsLeft <= 0}
            >
              {draftLoading
                ? "考え中…"
                : `🔁 AIにもう一度たたき台をつくってもらう (残り${Math.max(draftsLeft, 0)}/${DRAFT_LIMIT}回)`}
            </button>

            {saveMessage && <p className="sch-save-message">{saveMessage}</p>}

            <button
              className="sch-save-only-btn"
              onClick={handleSaveOnly}
              disabled={saving || savingOnly}
            >
              {savingOnly ? "ほぞん中…" : "💾 ここまでをほぞんする"}
            </button>

            <button
              className="next-btn sch-save-btn"
              onClick={handleSave}
              disabled={saving || savingOnly}
            >
              {saving ? "保存中…" : "ほぞんして つぎへ →"}
            </button>
          </>
        )}
      </div>

      {confirmingRetry !== null && (
        <div className="sch-modal-backdrop">
          <div className="sch-modal-card">
            <div className="sch-modal-emoji">{tasks.length > 0 ? "⚠️" : "🌱"}</div>
            <p className="sch-modal-text">
              {tasks.length > 0 ? (
                <>
                  今ある{tasks.length}件の予定は、AIのたたき台に
                  <br />
                  すべて置きかわるよ(消えてしまうので注意!)。
                  <br />
                  それでもいいかな?
                </>
              ) : (
                <>
                  まずは自分で、日づけややることを考えてみよう!
                  <br />
                  どうしても思いつかないときだけ、AIにおねがいしてね。
                </>
              )}
            </p>
            <button
              className="sch-modal-think-btn"
              onClick={() => setConfirmingRetry(null)}
            >
              {tasks.length > 0 ? "やめておく" : "自分で考えてみる"}
            </button>
            <button
              className="sch-modal-confirm-btn"
              onClick={handleConfirmDraft}
            >
              {tasks.length > 0 ? "置きかえてもらう" : "それでもAIにおねがいする"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// タスクの "date" (「7/25(土)」のような自由記述)から月日を読みとる。
// 形式が合わないもの(空欄・書きかけなど)は null を返し、カレンダーには出さない。
function parseTaskDate(dateStr) {
  const m = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})/.exec(dateStr || "");
  if (!m) return null;
  return { month: Number(m[1]), day: Number(m[2]) };
}

// 全体をひと目で見わたす用のカレンダービュー。
// 期間が月をまたいでも(7月→8月など)、必要な月ぶんだけ並べて出す。
function ScheduleCalendar({ tasks, endDate, toggleDone }) {
  const [openDay, setOpenDay] = useState(null); // "M-D" | null

  const tasksByDay = new Map();
  let unplaced = 0;
  tasks.forEach((t) => {
    const parsed = parseTaskDate(t.date);
    if (!parsed) {
      unplaced += 1;
      return;
    }
    const key = `${parsed.month}-${parsed.day}`;
    if (!tasksByDay.has(key)) tasksByDay.set(key, []);
    tasksByDay.get(key).push(t);
  });

  const endDateObj = endDate ? new Date(`${endDate}T00:00:00`) : null;
  const year = endDateObj && !isNaN(endDateObj) ? endDateObj.getFullYear() : new Date().getFullYear();

  const monthsSet = new Set();
  tasksByDay.forEach((_, key) => monthsSet.add(Number(key.split("-")[0])));
  if (endDateObj && !isNaN(endDateObj)) monthsSet.add(endDateObj.getMonth() + 1);
  if (monthsSet.size === 0) monthsSet.add(new Date().getMonth() + 1);
  const months = [...monthsSet].sort((a, b) => a - b);

  return (
    <div className="sch-cal-wrap">
      {months.map((month) => (
        <CalendarMonth
          key={month}
          year={year}
          month={month}
          tasksByDay={tasksByDay}
          openDay={openDay}
          setOpenDay={setOpenDay}
          toggleDone={toggleDone}
        />
      ))}
      {unplaced > 0 && (
        <p className="sch-cal-unplaced-note">
          📋 日づけがまだ整っていない予定が{unplaced}件あるよ(リスト表示から直せるよ)
        </p>
      )}
    </div>
  );
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function CalendarMonth({ year, month, tasksByDay, openDay, setOpenDay, toggleDone }) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="sch-cal-month">
      <div className="sch-cal-month-label">{month}月</div>
      <div className="sch-cal-weekdays">
        {WEEKDAYS.map((w, i) => (
          <span
            key={w}
            className={`sch-cal-wd ${i === 0 ? "sun" : ""} ${i === 6 ? "sat" : ""}`}
          >
            {w}
          </span>
        ))}
      </div>
      <div className="sch-cal-grid">
        {cells.map((d, i) => {
          const colIdx = i % 7;
          if (d === null) {
            return <div className="sch-cal-cell blank" key={`b${i}`} />;
          }
          const key = `${month}-${d}`;
          const dayTasks = tasksByDay.get(key) ?? [];
          const hasTasks = dayTasks.length > 0;
          const isOpen = openDay === key;
          return (
            <div
              key={key}
              className={`sch-cal-cell ${hasTasks ? "has-task" : ""} ${colIdx === 0 ? "col-sun" : ""} ${colIdx === 6 ? "col-sat" : ""}`}
              onMouseEnter={() => hasTasks && setOpenDay(key)}
              onMouseLeave={() => setOpenDay((prev) => (prev === key ? null : prev))}
              onClick={() => hasTasks && setOpenDay((prev) => (prev === key ? null : key))}
            >
              <span className="sch-cal-daynum">{d}</span>
              {hasTasks && (
                <div className="sch-cal-icons">
                  {dayTasks.slice(0, 3).map((t, ti) => {
                    const info = getTaskTypeById(t.type);
                    return (
                      <span
                        key={ti}
                        className={`sch-cal-icon ${t.done ? "done" : ""}`}
                      >
                        {info.icon}
                      </span>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <span className="sch-cal-more">+{dayTasks.length - 3}</span>
                  )}
                </div>
              )}
              {isOpen && (
                <div
                  className="sch-cal-popover"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sch-cal-popover-date">
                    {month}月{d}日
                  </div>
                  {dayTasks.map((t) => {
                    const info = getTaskTypeById(t.type);
                    return (
                      <div className="sch-cal-popover-item" key={t.id}>
                        <button
                          className={`sch-checkbox ${t.done ? "checked" : ""}`}
                          onClick={() => toggleDone(t.id)}
                          aria-label="完了"
                        />
                        <div>
                          <span className={`sch-type-badge t-${t.type}`}>
                            {info.icon} {info.label}
                          </span>
                          <p
                            className={`sch-cal-popover-text ${t.done ? "done" : ""}`}
                          >
                            {t.task}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
