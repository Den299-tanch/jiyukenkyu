import { useState } from 'react';

// ===== 初期スケジュール(夏休み1ヶ月の例) =====
// 本物のアプリではここがAIの返したJSONになる
const INITIAL_SCHEDULE = [
  { id: 1,  date: "7/21(月)", task: "テーマをきめる",              type: "junbi" },
  { id: 2,  date: "7/22(火)", task: "としょかんで本をかりる",        type: "junbi" },
  { id: 3,  date: "7/23(水)", task: "かせつを考える",              type: "junbi" },
  { id: 4,  date: "7/24(木)", task: "じっけんのざいりょうをかう",     type: "junbi" },
  { id: 5,  date: "7/26(土)", task: "おやすみ",                   type: "yasumi" },
  { id: 6,  date: "7/28(月)", task: "アサガオのたねをまく",          type: "jikken" },
  { id: 7,  date: "7/29(火)", task: "まいにちの記ろくをはじめる",     type: "kiroku" },
  { id: 8,  date: "8/4(月)",  task: "1しゅうかんめの しゃしんをとる", type: "kiroku" },
  { id: 9,  date: "8/8(金)",  task: "つるがでてきたら記ろく",        type: "kiroku" },
  { id: 10, date: "8/11(月)", task: "つるのまく方こうをしらべる",     type: "jikken" },
  { id: 11, date: "8/15(金)", task: "2しゅうかん分のデータをまとめる",type: "matome" },
  { id: 12, date: "8/19(火)", task: "こうさつを書く",              type: "matome" },
  { id: 13, date: "8/23(土)", task: "まとめのげんこうを書く",        type: "matome" },
  { id: 14, date: "8/27(水)", task: "きれいに せいしょする",         type: "matome" },
  { id: 15, date: "8/30(土)", task: "かんせい!いんさつする",        type: "matome" },
];

// ===== type → 見た目のマップ =====
// 本物のアプリでもこれを共通コンポーネントで使う想定
const TYPE_STYLE = {
  junbi:  { bg: "bg-blue-50",    text: "text-blue-900",    label: "じゅんび", icon: "🔧" },
  jikken: { bg: "bg-orange-50",  text: "text-orange-900",  label: "じっけん", icon: "🧪" },
  kiroku: { bg: "bg-amber-50",   text: "text-amber-900",   label: "きろく",   icon: "📸" },
  matome: { bg: "bg-emerald-50", text: "text-emerald-900", label: "まとめ",   icon: "📝" },
  yasumi: { bg: "bg-gray-100",   text: "text-gray-700",    label: "やすみ",   icon: "🍉" },
};

export default function ScheduleEditor() {
  // 現在のスケジュール(編集対象)
  const [schedule, setSchedule] = useState(INITIAL_SCHEDULE);
  // 編集モードのオン/オフ
  const [editMode, setEditMode] = useState(false);
  // 最後に「保存」を押したときのJSON(DBに送ったつもりの内容)
  const [savedJson, setSavedJson] = useState(null);

  // ----- セル編集: 配列の特定要素だけ書き換えるパターン -----
  function updateField(id, field, value) {
    setSchedule(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  // ----- 行の削除 -----
  function deleteRow(id) {
    setSchedule(prev => prev.filter(item => item.id !== id));
  }

  // ----- 行の追加 -----
  function addRow() {
    const newId = Math.max(...schedule.map(s => s.id), 0) + 1;
    setSchedule(prev => [
      ...prev,
      { id: newId, date: "?/??", task: "あたらしいよてい", type: "junbi" },
    ]);
  }

  // ----- 保存(本物のアプリではここで fetch して DB に送る) -----
  function handleSave() {
    const json = JSON.stringify(schedule, null, 2);
    setSavedJson(json);
    // 本物のアプリではこうなる:
    // await fetch('/api/save-schedule', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ user_id: userId, schedule_json: schedule })
    // });
  }

  // ----- やりなおす(初期JSONに戻す) -----
  function handleReset() {
    if (confirm("ほんとうに さいしょから やりなおす?")) {
      setSchedule(INITIAL_SCHEDULE);
      setSavedJson(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">

        {/* ===== ヘッダー ===== */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">
            なつやすみの じゆうけんきゅう よてい
          </h1>
          <p className="text-sm text-slate-500 mb-4">
            テーマ: アサガオは どうしてつるをまくのかな?
          </p>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setEditMode(!editMode)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                editMode
                  ? "bg-emerald-600 text-white"
                  : "bg-white border border-slate-300 text-slate-700"
              }`}
            >
              {editMode ? "✓ へんしゅうおわり" : "✏️ へんしゅうする"}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-300 text-slate-700"
            >
              ↺ さいしょからやりなおす
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white"
            >
              💾 ほぞんする
            </button>
          </div>
        </header>

        {/* ===== スケジュール本体 ===== */}
        <div className="space-y-2 mb-6">
          {schedule.map(item => {
            const style = TYPE_STYLE[item.type] || TYPE_STYLE.junbi;
            return (
              <div
                key={item.id}
                className={`${style.bg} rounded-xl p-4 flex items-center gap-3`}
              >
                {/* 日付 */}
                <div className={`${style.text} font-medium w-24 text-sm flex-shrink-0`}>
                  {editMode ? (
                    <input
                      value={item.date}
                      onChange={e => updateField(item.id, "date", e.target.value)}
                      className="w-full bg-white/70 rounded px-2 py-1 text-sm"
                    />
                  ) : (
                    item.date
                  )}
                </div>

                {/* アイコン */}
                <div className="text-2xl flex-shrink-0">{style.icon}</div>

                {/* タスク本文 */}
                <div className={`${style.text} flex-1 text-sm`}>
                  {editMode ? (
                    <input
                      value={item.task}
                      onChange={e => updateField(item.id, "task", e.target.value)}
                      className="w-full bg-white/70 rounded px-2 py-1 text-sm"
                    />
                  ) : (
                    item.task
                  )}
                </div>

                {/* タイプ(色分け) */}
                <div className="flex-shrink-0">
                  {editMode ? (
                    <select
                      value={item.type}
                      onChange={e => updateField(item.id, "type", e.target.value)}
                      className="bg-white/70 rounded px-2 py-1 text-xs"
                    >
                      {Object.entries(TYPE_STYLE).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`${style.text} text-xs`}>{style.label}</span>
                  )}
                </div>

                {/* 削除ボタン(編集モードのみ) */}
                {editMode && (
                  <button
                    onClick={() => deleteRow(item.id)}
                    className="text-red-500 text-lg flex-shrink-0"
                    aria-label="この行を削除"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          {/* 追加ボタン(編集モードのみ) */}
          {editMode && (
            <button
              onClick={addRow}
              className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 text-sm"
            >
              + よていを ついかする
            </button>
          )}
        </div>

        {/* ===== デバッグ表示: 現在のJSON(stateの中身) ===== */}
        <details className="mb-4 bg-white rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            🔍 げんざいのJSON(state の中身、リアルタイム)
          </summary>
          <pre className="mt-3 text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-auto max-h-96">
            {JSON.stringify(schedule, null, 2)}
          </pre>
        </details>

        {/* ===== 「保存」を押したときのJSON ===== */}
        {savedJson && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-sm font-medium text-blue-900 mb-2">
              💾 ほぞんボタンを押した時に DB に送られるJSON:
            </div>
            <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-auto max-h-96">
              {savedJson}
            </pre>
            <p className="text-xs text-blue-700 mt-2">
              本物のアプリではこれを fetch('/api/save-schedule', ...) でサーバーに送って、
              PostgreSQL の schedule_json カラムに保存する。
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
