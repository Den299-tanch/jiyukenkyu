import { useState, useEffect } from "react";
import { getMethodTypeById } from "../data/methodTypes";
import { TASK_TYPES, getTaskTypeById } from "../data/taskTypes";

function makeTaskId() {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function ScheduleScreen({
  userId,
  theme,
  hypothesis,
  researchMethod,
  onBack,
  onNext,
}) {
  const [tab, setTab] = useState("intro");
  const [endDate, setEndDate] = useState("");
  const [tasks, setTasks] = useState([]);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [saving, setSaving] = useState(false);

  const methodTypeLabel = getMethodTypeById(researchMethod?.method_type)?.label;

  // 戻るボタンなどで再度この画面に来たとき、すでに保存済みのスケジュールを読み込んで復元する
  useEffect(() => {
    if (!userId || !researchMethod?.id) return;
    async function fetchExisting() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL ?? ""}/api/schedules/${userId}`,
        );
        const data = await res.json();
        if (!data.success) return;
        const existing = data.schedules.find(
          (s) => s.research_method_id === researchMethod.id,
        );
        if (existing) {
          setEndDate(existing.end_date ?? "");
          setTasks(existing.tasks ?? []);
          setTab("plan");
        }
      } catch {
        // 読み込みに失敗しても、これから新しく作ること自体はできるので黙って無視
      }
    }
    fetchExisting();
  }, [userId, researchMethod?.id]);

  async function requestDraft(isRetry) {
    setDraftLoading(true);
    setDraftError("");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ""}/api/schedule-draft`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            theme_title: theme?.theme,
            hypothesis: hypothesis?.hypothesis,
            method_type_label: methodTypeLabel,
            what_to_study: researchMethod?.what_to_study,
            tools_materials: researchMethod?.tools_materials,
            location: researchMethod?.location,
            duration: researchMethod?.duration,
            summary: researchMethod?.summary,
            end_date: endDate,
            previous_tasks: isRetry ? tasks : undefined,
          }),
        },
      );
      const data = await res.json();
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

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ""}/api/save-schedule`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            theme_id: theme?.id,
            hypothesis_id: hypothesis?.id,
            research_method_id: researchMethod?.id,
            end_date: endDate,
            tasks,
          }),
        },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      onNext(data.data);
    } catch (err) {
      alert("保存に失敗しました: " + err.message);
    }
    setSaving(false);
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
              <div className="sch-date-label">📅 おわりの日</div>
              <input
                className="sch-date-input"
                placeholder="例: 8月31日"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
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
              onClick={() => requestDraft(false)}
              disabled={draftLoading || !endDate.trim()}
            >
              {draftLoading
                ? "たたき台を考え中…"
                : "🤖 AIにたたき台をつくってもらう"}
            </button>
            <button className="sch-secondary-btn" onClick={handleWriteMyself}>
              ✏️ 自分で書く(空の行を追加)
            </button>
          </>
        )}

        {tab === "plan" && (
          <>
            <div className="sch-summary-row">
              <span className="sch-end-chip">
                〜 {endDate || "おわりの日未定"} まで
              </span>
              <span className="sch-progress-note">
                {doneCount} こ / {tasks.length} こ できた!
              </span>
            </div>

            {tasks.map((t) => {
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
              onClick={() => requestDraft(true)}
              disabled={draftLoading || !endDate.trim()}
            >
              {draftLoading ? "考え中…" : "🔁 AIにもう一度たたき台をつくってもらう"}
            </button>

            <button
              className="next-btn sch-save-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "保存中…" : "ほぞんして つぎへ →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
