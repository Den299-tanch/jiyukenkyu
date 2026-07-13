import { useState, useEffect, useRef } from "react";
import { apiPost } from "../services/api";
import GraphView from "./GraphView";
import { GRAPH_TYPES, getGraphTypeById } from "../data/graphTypes";
import {
  collectNumberEntries,
  shortDate,
  pairByRecord,
  recommendGraphType,
  recommendXAxis,
  xAxisDisplayName,
} from "../data/graphBuild";
import { layer1Checks } from "../data/graphSafety";

const ASK_LIMIT = 3; // 層2(任意で聞く)の回数上限(コスト対策)

// 軸えらびをする種類(再設計ずみの3種)。円・帯・ヒストグラムは軸えらび無しで従来どおり。
const AXIS_TYPES = ["bar", "line", "scatter"];

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

// 選んだ数字の中でいちばん件数の多いラベル(タテ軸の初期候補)
function mostCommonLabel(entries) {
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
  return bestLabel;
}

// xAxis どうしが同じ選択かどうか
function sameXAxis(a, b) {
  if (!a || !b) return false;
  return a.kind === b.kind && (a.kind !== "label" || a.label === b.label);
}

// 依存配列や層1.5の署名に使う短いキー
function xAxisKey(xAxis) {
  if (!xAxis) return "none";
  return xAxis.kind === "label" ? `label:${xAxis.label}` : xAxis.kind;
}

export default function GraphFlowScreen({ records, theme, hypothesis, onExit, onSaved }) {
  const [entries] = useState(() => collectNumberEntries(records));
  const [step, setStep] = useState("table"); // 'table' | 'choose' | 'axes' | 'show'
  const [selectedKeys, setSelectedKeys] = useState(() =>
    defaultSelectedKeys(entries),
  );
  const [graphType, setGraphType] = useState("bar");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false); // 手入力されたら自動生成をやめる
  // 軸えらび(棒・折れ線・散布図)。子どもが自分で選ぶまで xAxis は null のまま。
  const [yLabel, setYLabel] = useState(null); // タテ軸にするラベル
  const [xAxis, setXAxis] = useState(null); // {kind:'order'|'date'|'label', label?}

  // 安全網の状態
  const [check15, setCheck15] = useState({ loading: false, warn: false, message: "" });
  const [questions, setQuestions] = useState([]);
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastCheckSig = useRef(null);

  const selectedEntries = entries.filter((e) => selectedKeys.includes(e.key));
  const askLeft = ASK_LIMIT - questions.length;

  // 選んだ数字の中にあるラベルの種類(タテ軸の候補)
  const selectedLabels = [...new Set(selectedEntries.map((e) => e.label))];
  const usesAxisPick = AXIS_TYPES.includes(graphType);

  // ヨコ軸の候補。「順番」「日づけ」+ タテ軸以外のラベルの値。
  // 散布図は数直線どうしのグラフなので、日づけは候補に入れない。
  const xCandidates = [
    { kind: "order" },
    ...(graphType !== "scatter" ? [{ kind: "date" }] : []),
    ...selectedLabels
      .filter((l) => l !== yLabel)
      .map((l) => ({ kind: "label", label: l })),
  ];
  const recommendedX = yLabel ? recommendXAxis(selectedEntries, yLabel) : null;

  // グラフに実際に使われる数字。
  // ヨコ軸がラベルの値なら「ペアになる2つのラベル」、それ以外なら「タテ軸のラベル」の数字だけ。
  const usedEntries = usesAxisPick
    ? xAxis?.kind === "label"
      ? selectedEntries.filter((e) => e.label === yLabel || e.label === xAxis.label)
      : selectedEntries.filter((e) => e.label === yLabel)
    : selectedEntries;
  const unusedCount = selectedEntries.length - usedEntries.length;

  const isRelationship = usesAxisPick && xAxis?.kind === "label";
  const layer1 = layer1Checks(usedEntries, graphType, { isRelationship });
  const recommendedType = recommendGraphType(selectedEntries);

  // AIに渡すグラフの中身(層1.5・層2で共通)
  function graphPayload() {
    if (usesAxisPick && xAxis && yLabel) {
      // 記録した順ではなく、グラフが実際に描く並び(ヨコ軸=x昇順)に揃えてAIに渡す。
      // これを揃えないと、AIが「記録した順」だけを見て、実際には無い減少傾向などを誤って指摘してしまう。
      const pairs = isRelationship
        ? pairByRecord(selectedEntries, xAxis.label, yLabel)
            .sort((a, b) => a.x - b.x)
            .map((p) => ({ x: p.x, y: p.y }))
        : null;
      return {
        theme_title: theme?.theme,
        hypothesis: hypothesis?.hypothesis,
        graph_type_label: getGraphTypeById(graphType).label,
        title,
        is_relationship: isRelationship,
        x_axis_label: xAxisDisplayName(xAxis),
        y_axis_label: yLabel,
        pairs,
        // 関係グラフのときは pairs が実際の描画内容そのものなので、numbers は重複させない。
        numbers: isRelationship
          ? []
          : usedEntries.map((e) => ({
              label: e.label,
              value: e.value,
              unit: e.unit,
              date: shortDate(e.date),
            })),
      };
    }
    // 軸えらびの無い種類(円・帯・ヒストグラム)は従来どおり
    return {
      theme_title: theme?.theme,
      hypothesis: hypothesis?.hypothesis,
      graph_type_label: getGraphTypeById(graphType).label,
      title,
      is_relationship: false,
      x_axis_label: null,
      y_axis_label: null,
      pairs: null,
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
    const sig =
      graphType + "|" + xAxisKey(xAxis) + "|" + (yLabel ?? "") + "|" + selectedKeys.join(",");
    if (sig === lastCheckSig.current) return;
    lastCheckSig.current = sig;
    setQuestions([]); // 組み合わせが変わったら層2の履歴もリセット

    let ignore = false;
    setCheck15({ loading: true, warn: false, message: "" });
    (async () => {
      try {
        const data = await apiPost('/api/graph-check', graphPayload());
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
  }, [step, graphType, xAxis, yLabel, selectedKeys]);

  async function handleSaveGraph() {
    if (saving) return;
    setSaving(true);
    try {
      const data = await apiPost('/api/save-graph', {
        hypothesis_id: hypothesis?.id,
        // 材料一式(あとで再表示できるよう、使った数字ごと保存する)
        graph_data: {
          title: title.trim() || getGraphTypeById(graphType).label,
          graphType,
          entries: selectedEntries,
          // 軸えらび(再設計後)。旧表示コードのために xAxisLabel も残しておく。
          xAxis: usesAxisPick ? xAxis : null,
          yLabel: usesAxisPick ? yLabel : null,
          xAxisLabel: isRelationship ? xAxis.label : null,
        },
      });
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
      const data = await apiPost('/api/graph-ask', graphPayload());
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

  // グラフの種類を選んだあとの行き先。
  // 棒・折れ線・散布図 → 軸えらびへ。それ以外 → そのまま表示へ。
  function goAfterChoose() {
    if (!usesAxisPick) {
      goToShow();
      return;
    }
    // タテ軸の初期値: いちばん件数の多いラベル(選び直しはできる)
    const nextY = selectedLabels.includes(yLabel)
      ? yLabel
      : mostCommonLabel(selectedEntries);
    if (nextY !== yLabel) setYLabel(nextY);
    // 前に選んだヨコ軸が、新しいタテ軸・種類の候補に無ければリセット(選び直してもらう)
    const stillValid =
      xAxis &&
      (xAxis.kind === "order" ||
        (xAxis.kind === "date" && graphType !== "scatter") ||
        (xAxis.kind === "label" &&
          xAxis.label !== nextY &&
          selectedLabels.includes(xAxis.label)));
    if (xAxis && !stillValid) setXAxis(null);
    setStep("axes");
  }

  // タテ軸を選び直したとき: ヨコ軸がそのラベルの値だったら選び直してもらう
  function pickYLabel(label) {
    setYLabel(label);
    if (xAxis?.kind === "label" && xAxis.label === label) setXAxis(null);
  }

  // タイトルの初期値(選んだ軸からつくる)。手入力されるまでは選び直すたびに作り直す。
  function goToShow() {
    if (!titleTouched) {
      if (usesAxisPick && yLabel) {
        setTitle(
          xAxis?.kind === "label"
            ? `${xAxis.label} と ${yLabel} のグラフ`
            : `${yLabel} のグラフ`,
        );
      } else {
        const labels = [...new Set(selectedEntries.map((e) => e.label))];
        setTitle(labels.join(" と ") + " のグラフ");
      }
    }
    setStep("show");
  }

  // 表ステップで「同じ記録から来た数字」が分かるように、記録ごとの番号をふる
  const recordIndexById = new Map();
  entries.forEach((e) => {
    if (!recordIndexById.has(e.recordId)) {
      recordIndexById.set(e.recordId, recordIndexById.size + 1);
    }
  });

  return (
    <div className="record-screen">
      <div className="screen-header">
        <button
          className="back-btn"
          onClick={() => {
            if (step === "table") onExit();
            else if (step === "choose") setStep("table");
            else if (step === "axes") setStep("choose");
            else setStep(usesAxisPick ? "axes" : "choose");
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
                    <th>きろく</th>
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
                      <td className="graph-rec-no">{recordIndexById.get(e.recordId)}</td>
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
              💡 「きろく」の番号が同じ数字は、同じときにはかった数字だよ。
              ちがうラベルの数字も✓すると、2つの関係を見るグラフがためせるよ。
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
                  {recommendedType === g.id && (
                    <span className="graph-reco-badge">⭐ おすすめ</span>
                  )}
                </button>
              ))}
            </div>
            <div className="graph-type-desc">
              💡 どれをえらんでもOK。あってなくても、まず作ってみよう。変だなと思ったら、
              それも発見だよ。
            </div>
            <button className="next-btn rec-save-btn" onClick={goAfterChoose}>
              {AXIS_TYPES.includes(graphType) ? "じくをえらぶ →" : "つくってみる →"}
            </button>
          </>
        )}

        {step === "axes" && (
          <>
            <p className="rec-list-title">グラフのじくを えらぼう</p>

            <p className="graph-note">
              タテ軸(たての目もり)にする数字をえらんでね。
            </p>
            <div className="graph-axis-pick">
              <span className="graph-axis-pick-lbl">タテ軸:</span>
              {selectedLabels.map((lbl) => (
                <button
                  key={lbl}
                  className={`graph-axis-chip ${yLabel === lbl ? "on" : ""}`}
                  onClick={() => pickYLabel(lbl)}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <p className="graph-note">
              ヨコ軸(よこの目もり)は、数字をどうならべるかだよ。じぶんでえらんでみよう。
            </p>
            <div className="graph-axis-pick">
              <span className="graph-axis-pick-lbl">ヨコ軸:</span>
              {xCandidates.map((c) => (
                <button
                  key={xAxisKey(c)}
                  className={`graph-axis-chip ${sameXAxis(xAxis, c) ? "on" : ""}`}
                  onClick={() => setXAxis(c)}
                >
                  {c.kind === "order" && "🔢 きろくした順番"}
                  {c.kind === "date" && "📅 日づけ"}
                  {c.kind === "label" && `🔗 ${c.label} の値`}
                  {recommendedX && sameXAxis(recommendedX, c) && (
                    <span className="graph-reco-badge">⭐ おすすめ</span>
                  )}
                </button>
              ))}
            </div>

            <div className="graph-type-desc">
              💡 「きろくした順番」は、1回目・2回目…とはかった順にならべるよ。
              同じ日に何回もはかったときや、日づけを書きわすれたときにべんりだよ。
            </div>

            {xAxis && unusedCount > 0 && (
              <p className="graph-note graph-note-hint">
                ✓した数字のうち {unusedCount}こは、このじくのえらび方だとグラフに出ないよ。
                (べつのグラフでつかえるよ)
              </p>
            )}

            <button
              className="next-btn rec-save-btn"
              onClick={goToShow}
              disabled={!xAxis || !yLabel}
            >
              {xAxis ? "つくってみる →" : "ヨコ軸をえらんでね"}
            </button>
          </>
        )}

        {step === "show" && (
          <>
            <div className="graph-card">
              <input
                className="graph-title-input"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleTouched(true);
                }}
                placeholder="グラフのタイトル"
              />
              <div className="graph-sub">
                えらんだグラフ: {getGraphTypeById(graphType).label}
                {usesAxisPick && xAxis && yLabel && (
                  <>
                    {" "}/ ヨコ軸: {xAxisDisplayName(xAxis)} / タテ軸: {yLabel}{" "}
                    <button
                      className="graph-axis-chip graph-axis-redo"
                      onClick={() => setStep("axes")}
                    >
                      じくをえらびなおす
                    </button>
                  </>
                )}
              </div>
              <GraphView
                type={graphType}
                entries={selectedEntries}
                xAxis={usesAxisPick ? xAxis : undefined}
                yLabel={usesAxisPick ? yLabel : undefined}
              />
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
