import { useState, useEffect, useRef } from "react";
import GraphView from "./GraphView";
import { GRAPH_TYPES, getGraphTypeById } from "../data/graphTypes";
import { collectNumberEntries, shortDate } from "../data/graphBuild";
import { layer1Checks } from "../data/graphSafety";

const ASK_LIMIT = 3; // 層2(任意で聞く)の回数上限(コスト対策)

// はじめに選んでおく数字を決める:
// いちばん件数の多いラベルのグループ(2件以上)を初期選択。無ければ全部。
function defaultSelectedKeys(entries) {
  const counts = new Map();
  entries.forEach((e) => counts.set(e.label, (counts.get(e.label) || 0) + 1));
  let bestLabel = null;
  let best = 0;
  counts.forEach((c, label) => {
    if (c > best) {
      best = c;
      bestLabel = label;
    }
  });
  if (best >= 2) {
    return entries.filter((e) => e.label === bestLabel).map((e) => e.key);
  }
  return entries.map((e) => e.key);
}

export default function GraphFlowScreen({ userId, records, theme, hypothesis, onExit, onSaved }) {
  const [entries] = useState(() => collectNumberEntries(records));
  const [step, setStep] = useState("table"); // 'table' | 'choose' | 'show'
  const [selectedKeys, setSelectedKeys] = useState(() =>
    defaultSelectedKeys(entries),
  );
  const [graphType, setGraphType] = useState("bar");
  const [title, setTitle] = useState("");

  // 安全網の状態
  const [check15, setCheck15] = useState({ loading: false, warn: false, message: "" });
  const [questions, setQuestions] = useState([]);
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastCheckSig = useRef(null);

  const selectedEntries = entries.filter((e) => selectedKeys.includes(e.key));
  const layer1 = layer1Checks(selectedEntries, graphType);
  const askLeft = ASK_LIMIT - questions.length;

  // AIに渡すグラフの中身(層1.5・層2で共通)
  function graphPayload() {
    return {
      theme_title: theme?.theme,
      hypothesis: hypothesis?.hypothesis,
      graph_type_label: getGraphTypeById(graphType).label,
      title,
      numbers: selectedEntries.map((e) => ({
        label: e.label,
        value: e.value,
        unit: e.unit,
        date: shortDate(e.date),
      })),
    };
  }

  // 層1.5: グラフを表示したとき、自動で1回だけ確認する(同じ組み合わせなら再実行しない)
  useEffect(() => {
    if (step !== "show") return;
    const sig = graphType + "|" + selectedKeys.join(",");
    if (sig === lastCheckSig.current) return;
    lastCheckSig.current = sig;
    setQuestions([]); // 組み合わせが変わったら層2の履歴もリセット

    let ignore = false;
    setCheck15({ loading: true, warn: false, message: "" });
    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL ?? ""}/api/graph-check`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(graphPayload()),
          },
        );
        const data = await res.json();
        if (ignore) return;
        setCheck15({
          loading: false,
          warn: !!data.warn,
          message: data.message ?? "",
        });
      } catch {
        if (!ignore) setCheck15({ loading: false, warn: false, message: "" });
      }
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, graphType, selectedKeys]);

  async function handleSaveGraph() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ""}/api/save-graph`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            theme_id: theme?.id,
            hypothesis_id: hypothesis?.id,
            // 材料一式(あとで再表示できるよう、使った数字ごと保存する)
            graph_data: {
              title: title.trim() || getGraphTypeById(graphType).label,
              graphType,
              entries: selectedEntries,
            },
          }),
        },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      onSaved ? onSaved(data.data) : onExit();
    } catch (err) {
      alert("グラフの保存に失敗しました: " + err.message);
      setSaving(false);
    }
  }

  async function handleAsk() {
    if (asking || askLeft <= 0) return;
    setAsking(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ""}/api/graph-ask`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(graphPayload()),
        },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setQuestions((prev) => [...prev, data.question]);
    } catch {
      setQuestions((prev) => [
        ...prev,
        "うまく聞けなかったよ。もう一度ためしてね。",
      ]);
    }
    setAsking(false);
  }

  function toggleKey(key) {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  // タイトルの初期値(選んだラベルからつくる)
  function goToShow() {
    if (!title.trim()) {
      const labels = [...new Set(selectedEntries.map((e) => e.label))];
      setTitle(labels.join(" と ") + " のグラフ");
    }
    setStep("show");
  }

  return (
    <div className="record-screen">
      <div className="screen-header">
        <button
          className="back-btn"
          onClick={() => {
            if (step === "table") onExit();
            else if (step === "choose") setStep("table");
            else setStep("choose");
          }}
        >
          ← 戻る
        </button>
        <h2>📊 グラフを作ろう</h2>
      </div>

      <div className="record-content">
        {step === "table" && (
          <>
            <p className="rec-list-title">📋 あつまった数字のひょう</p>
            <p className="graph-note">
              グラフにする前に、まずひょうで見てみよう。グラフにしたい数字に✓をつけてね。
              (ひょうが先、グラフが後、が理科のきほんだよ)
            </p>

            {entries.length === 0 ? (
              <div className="rec-empty-card">
                <p className="rec-empty-text">
                  まだ数字が入っていないよ。
                  <br />
                  記録に数字を入れると、ここに出てくるよ。
                </p>
              </div>
            ) : (
              <table className="graph-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>ラベル</th>
                    <th>数字</th>
                    <th>日づけ</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.key} onClick={() => toggleKey(e.key)}>
                      <td>
                        <span
                          className={`graph-check ${selectedKeys.includes(e.key) ? "on" : ""}`}
                        />
                      </td>
                      <td>{e.label}</td>
                      <td>
                        {e.value} {e.unit}
                      </td>
                      <td>{shortDate(e.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <p className="graph-note graph-note-hint">
              💡 ちがうラベルの数字も✓すると、「2つの関係」を見るグラフ(散布図など)が
              ためせるよ。
            </p>

            <button
              className="next-btn rec-save-btn"
              onClick={() => setStep("choose")}
              disabled={selectedEntries.length === 0}
            >
              この数字でグラフをえらぶ →
            </button>
          </>
        )}

        {step === "choose" && (
          <>
            <p className="rec-list-title">グラフのしゅるいを えらぼう</p>
            <div className="graph-type-row">
              {GRAPH_TYPES.map((g) => (
                <button
                  key={g.id}
                  className={`graph-type-chip ${graphType === g.id ? "selected" : ""}`}
                  onClick={() => setGraphType(g.id)}
                >
                  {g.icon} {g.label}
                </button>
              ))}
            </div>
            <div className="graph-type-desc">
              💡 どれをえらんでもOK。あってなくても、まず作ってみよう。変だなと思ったら、
              それも発見だよ。
            </div>
            <button className="next-btn rec-save-btn" onClick={goToShow}>
              つくってみる →
            </button>
          </>
        )}

        {step === "show" && (
          <>
            <div className="graph-card">
              <input
                className="graph-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="グラフのタイトル"
              />
              <div className="graph-sub">
                えらんだグラフ: {getGraphTypeById(graphType).label}
              </div>
              <GraphView type={graphType} entries={selectedEntries} />
            </div>

            {/* 3層の安全網(レイヤー名は子ども画面には出さない) */}
            {/* 層1: 機械チェック */}
            {layer1.map((w, i) => (
              <div key={i} className="graph-warn graph-warn-1">
                ⚠️ {w}
              </div>
            ))}

            {/* 層1.5: AIが自動でチェック */}
            {check15.loading && (
              <div className="graph-checking">
                🔎 グラフをかくにんしているよ…
              </div>
            )}
            {!check15.loading && check15.warn && check15.message && (
              <div className="graph-warn graph-warn-15">🤖 {check15.message}</div>
            )}

            {/* 層2: 任意でAIに聞く */}
            <button
              className="graph-ask-btn"
              onClick={handleAsk}
              disabled={asking || askLeft <= 0}
            >
              {asking
                ? "考え中…"
                : askLeft > 0
                  ? "🤖 このグラフについて聞いてみる(にんい)"
                  : "また記録をふやしたら聞いてみてね"}
            </button>
            {questions.map((q, i) => (
              <div key={i} className="graph-question">
                🤖 {q}
              </div>
            ))}

            <button
              className="next-btn rec-save-btn"
              onClick={handleSaveGraph}
              disabled={saving}
            >
              {saving ? "保存中…" : "💾 グラフをほぞんして いちらんへ"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
