import { useState, useEffect } from "react";
import { getViewpoints } from "../data/recordViewpoints";
import { apiGet, apiPost } from "../services/api";
import Ruby from "./Ruby";

// 文字列を数値へ(空や数字でないものは null)
function toNum(str) {
  const t = (str ?? "").trim();
  if (t === "") return null;
  const n = Number(t);
  return isNaN(n) ? null : n;
}

// 今日の日付を YYYY-MM-DD で(date inputの初期値用)
function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function RecordInputScreen({
  userId,
  hypothesis,
  initialType,
  onBack,
  onSaved,
}) {
  const [recordType, setRecordType] = useState(initialType ?? "kiroku");
  const [observedAt, setObservedAt] = useState(todayStr());
  const [viewpoints, setViewpoints] = useState([]);
  const [body, setBody] = useState("");
  const [whyNote, setWhyNote] = useState("");
  const [saving, setSaving] = useState(false);

  // 数字欄(にんい)
  const [num1Label, setNum1Label] = useState("");
  const [num1Value, setNum1Value] = useState("");
  const [num1Unit, setNum1Unit] = useState("");
  const [showNum2, setShowNum2] = useState(false);
  const [num2Label, setNum2Label] = useState("");
  const [num2Value, setNum2Value] = useState("");
  const [num2Unit, setNum2Unit] = useState("");

  // オートコンプリート(過去に入力したラベル+単位)
  const [labelHistory, setLabelHistory] = useState([]);
  const [activeAc, setActiveAc] = useState(null); // 'num1' | 'num2' | null

  const isKiroku = recordType === "kiroku";
  const chips = getViewpoints(recordType);

  // この子が過去に使ったラベル/単位を読み込む(生命線: 表記ゆれ防止)
  useEffect(() => {
    if (!userId) return;
    let ignore = false;
    async function fetchLabels() {
      try {
        const data = await apiGet('/api/record-labels');
        if (!ignore && data.success) setLabelHistory(data.labels ?? []);
      } catch {
        // 履歴が取れなくても、手入力はできるので黙って無視
      }
    }
    fetchLabels();
    return () => {
      ignore = true;
    };
  }, [userId]);

  // 入力中のラベルに合う候補をしぼる(空なら最近の5件)
  function suggestionsFor(text) {
    if (labelHistory.length === 0) return [];
    const q = (text ?? "").trim();
    if (!q) return labelHistory.slice(0, 5);
    return labelHistory
      .filter((l) => l.label.includes(q) && l.label !== q)
      .slice(0, 5);
  }

  function switchType(type) {
    if (type === recordType) return;
    setRecordType(type);
    setViewpoints([]);
  }

  function toggleChip(id) {
    setViewpoints((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }

  async function handleSave() {
    if (!body.trim() || saving) return;
    setSaving(true);
    try {
      const data = await apiPost('/api/save-record', {
        hypothesis_id: hypothesis?.id,
        record_type: recordType,
        viewpoints,
        body: body.trim(),
        why_note: whyNote.trim(),
        observed_at: observedAt,
        num1_label: num1Label.trim() || null,
        num1_value: toNum(num1Value),
        num1_unit: num1Unit.trim() || null,
        num2_label: showNum2 ? num2Label.trim() || null : null,
        num2_value: showNum2 ? toNum(num2Value) : null,
        num2_unit: showNum2 ? num2Unit.trim() || null : null,
      });
      if (!data.success) throw new Error(data.error);
      onSaved(data.data);
    } catch (err) {
      alert("保存に失敗しました: " + err.message);
    }
    setSaving(false);
  }

  // 数字1行ぶんの入力(ラベル+値+単位、ラベルはオートコンプリート付き)
  function renderNumRow(key, label, setLabel, value, setValue, unit, setUnit) {
    const suggestions = activeAc === key ? suggestionsFor(label) : [];
    return (
      <div className="rec-num-row">
        <div className="rec-num-label-wrap">
          <input
            className="rec-num-input"
            placeholder="なにをはかった?"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setActiveAc(key);
            }}
            onFocus={() => setActiveAc(key)}
            onBlur={() => setTimeout(() => setActiveAc(null), 150)}
          />
          {suggestions.length > 0 && (
            <div className="rec-ac">
              <div className="rec-ac-title">前に使ったラベル:</div>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className="rec-ac-item"
                  onMouseDown={(e) => {
                    e.preventDefault(); // blurより先に確定させる
                    setLabel(s.label);
                    if (s.unit) setUnit(s.unit);
                    setActiveAc(null);
                  }}
                >
                  <span>{s.label}</span>
                  {s.unit && <span className="rec-ac-unit">たんい:{s.unit}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          className="rec-num-input rec-num-value"
          placeholder="すう字"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <input
          className="rec-num-input rec-num-unit"
          placeholder="たんい"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="record-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>
          ← <Ruby>{"戻[もど]る"}</Ruby>
        </button>
        <h2>{isKiroku ? "🧪 きろくを かく" : "🔍 しらべたことを かく"}</h2>
      </div>

      <div className="record-content">
        <div className="rec-type-toggle">
          <button
            className={`rec-toggle-opt ${isKiroku ? "on-kiroku" : ""}`}
            onClick={() => switchType("kiroku")}
          >
            🧪 きろく
          </button>
          <button
            className={`rec-toggle-opt ${!isKiroku ? "on-shirabe" : ""}`}
            onClick={() => switchType("shirabe")}
          >
            🔍 しらべたこと
          </button>
        </div>

        <p className="rec-field-label">
          {isKiroku ? <Ruby>{"いつ観察[かんさつ]した?"}</Ruby> : <Ruby>{"いつ調[しら]べた?"}</Ruby>}
        </p>
        <input
          type="date"
          className="rec-date-input"
          value={observedAt}
          onChange={(e) => setObservedAt(e.target.value)}
        />

        <p className="rec-field-label">
          {isKiroku ? "きになったところをタップ" : "どうやって調べた?"}
        </p>
        <div className="rec-chip-row">
          {chips.map((c) => (
            <button
              key={c.id}
              className={`rec-chip ${viewpoints.includes(c.id) ? "picked" : ""}`}
              onClick={() => toggleChip(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <p className="rec-field-label">気づいたこと</p>
        <textarea
          className="rec-textarea"
          rows={3}
          placeholder={
            isKiroku
              ? "見たこと・やったことを書いてみよう"
              : "本やネットで分かったことを書いてみよう"
          }
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        {/* 数字欄(にんい) */}
        <div className="rec-num-field">
          <div className="rec-num-field-lbl">📊 はかった数字があれば(にんい)</div>
          {renderNumRow(
            "num1",
            num1Label,
            setNum1Label,
            num1Value,
            setNum1Value,
            num1Unit,
            setNum1Unit,
          )}
          {!showNum2 ? (
            <button
              type="button"
              className="rec-add-num2"
              onClick={() => setShowNum2(true)}
            >
              ＋ もう1つ数字を入れる(2つの関係を見たいとき)
            </button>
          ) : (
            renderNumRow(
              "num2",
              num2Label,
              setNum2Label,
              num2Value,
              setNum2Value,
              num2Unit,
              setNum2Unit,
            )
          )}
        </div>

        <p className="rec-field-label rec-why-label">
          {isKiroku ? "なんでだと思う?(ひとことでOK)" : "予想と同じ?ちがった?"}
        </p>
        <textarea
          className="rec-textarea rec-why-textarea"
          rows={2}
          placeholder={
            isKiroku
              ? "じぶんの予想でOK"
              : "予想と同じだった? それともちがった?"
          }
          value={whyNote}
          onChange={(e) => setWhyNote(e.target.value)}
        />

        <button
          className="next-btn rec-save-btn"
          onClick={handleSave}
          disabled={saving || !body.trim()}
        >
          {saving ? "保存中…" : "💾 きろくを ほぞんする"}
        </button>
      </div>
    </div>
  );
}
