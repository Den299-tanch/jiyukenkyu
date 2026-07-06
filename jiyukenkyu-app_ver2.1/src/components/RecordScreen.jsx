import { useState, useEffect } from "react";
import RecordInputScreen from "./RecordInputScreen";
import RecordSavedScreen from "./RecordSavedScreen";
import GraphFlowScreen from "./GraphFlowScreen";
import GraphView from "./GraphView";
import { getViewpointLabel } from "../data/recordViewpoints";
import { getGraphTypeById } from "../data/graphTypes";
import {
  GRAPH_MIN_COUNT,
  getRecordNumbers,
  hasNumberData,
  hasGraphableData,
  countRecordsWithLabel,
  getMeasuredNumber,
} from "../data/recordNumbers";

export default function RecordScreen({ userId, theme, hypothesis, onBack, onNext }) {
  const [view, setView] = useState("list"); // 'list' | 'input' | 'saved' | 'graph' | 'graphview'
  const [records, setRecords] = useState([]);
  const [graphs, setGraphs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialType, setInitialType] = useState("kiroku");
  const [lastSaved, setLastSaved] = useState(null);
  const [selectedGraph, setSelectedGraph] = useState(null);

  // 画面に来たとき、この仮説の記録と保存グラフを読み込む
  useEffect(() => {
    if (!userId) return;
    let ignore = false;
    async function fetchAll() {
      setLoading(true);
      const base = import.meta.env.VITE_API_URL ?? "";
      try {
        const [recRes, graphRes] = await Promise.all([
          fetch(`${base}/api/records/${userId}`).then((r) => r.json()),
          fetch(`${base}/api/graphs/${userId}`).then((r) => r.json()),
        ]);
        if (ignore) return;
        if (recRes.success) {
          setRecords(
            hypothesis?.id
              ? recRes.records.filter((r) => r.hypothesis_id === hypothesis.id)
              : recRes.records,
          );
        }
        if (graphRes.success) {
          setGraphs(
            hypothesis?.id
              ? graphRes.graphs.filter((g) => g.hypothesis_id === hypothesis.id)
              : graphRes.graphs,
          );
        }
      } catch {
        // 読み込みに失敗しても、新しく追加すること自体はできるので黙って無視
      }
      if (!ignore) setLoading(false);
    }
    fetchAll();
    return () => {
      ignore = true;
    };
  }, [userId, hypothesis?.id]);

  function handleAdd(type) {
    setInitialType(type);
    setView("input");
  }

  function handleSaved(saved) {
    setRecords((prev) => [...prev, saved]);
    setLastSaved(saved);
    setView("saved"); // 保存直後は「後押し」画面をはさむ
  }

  function handleGraphSaved(saved) {
    setGraphs((prev) => [...prev, saved]);
    setView("list");
  }

  function openGraph(graph) {
    setSelectedGraph(graph);
    setView("graphview");
  }

  if (view === "input") {
    return (
      <RecordInputScreen
        userId={userId}
        theme={theme}
        hypothesis={hypothesis}
        initialType={initialType}
        onBack={() => setView("list")}
        onSaved={handleSaved}
      />
    );
  }

  if (view === "saved") {
    // 今はかったラベルが、この仮説の記録の中で何件たまったか数える
    const measured = getMeasuredNumber(lastSaved);
    const sameLabelCount = measured
      ? countRecordsWithLabel(records, measured.label)
      : 0;
    return (
      <RecordSavedScreen
        record={lastSaved}
        measuredLabel={measured?.label ?? null}
        sameLabelCount={sameLabelCount}
        graphReady={sameLabelCount >= GRAPH_MIN_COUNT}
        onBackToList={() => setView("list")}
      />
    );
  }

  if (view === "graph") {
    return (
      <GraphFlowScreen
        userId={userId}
        records={records}
        theme={theme}
        hypothesis={hypothesis}
        onExit={() => setView("list")}
        onSaved={handleGraphSaved}
      />
    );
  }

  if (view === "graphview" && selectedGraph) {
    const gd = selectedGraph.graph_data || {};
    return (
      <div className="record-screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => setView("list")}>
            ← 戻る
          </button>
          <h2>📊 保存したグラフ</h2>
        </div>
        <div className="record-content">
          <div className="graph-card">
            <div className="graph-saved-title">
              {gd.title || getGraphTypeById(gd.graphType).label}
            </div>
            <div className="graph-sub">
              えらんだグラフ: {getGraphTypeById(gd.graphType).label}
            </div>
            <GraphView
              type={gd.graphType}
              entries={gd.entries || []}
              xAxisLabel={gd.xAxisLabel ?? undefined}
            />
          </div>
          <button
            className="next-btn rec-save-btn"
            onClick={() => setView("list")}
          >
            いちらんに もどる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="record-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>
          ← 戻る
        </button>
        <h2>🗂️ きろくを つけよう</h2>
      </div>

      <div className="record-content">
        {hypothesis?.hypothesis && (
          <div className="rec-hypo-recap">
            <span className="rec-hypo-label">💭 さいしょの予想</span>
            {hypothesis.hypothesis}
          </div>
        )}

        <div className="rec-safe-banner">🌈 予想とちがってもOK、それも発見だよ</div>

        <p className="rec-list-title">きろく・しらべたこと</p>

        {loading ? (
          <p className="rec-empty">読み込み中…</p>
        ) : records.length === 0 && graphs.length === 0 ? (
          <div className="rec-empty-card">
            <p className="rec-empty-emoji">🌱</p>
            <p className="rec-empty-text">
              まだ何もないよ。
              <br />
              まず「しらべたこと」からでもOK！
            </p>
          </div>
        ) : (
          mergeItems(records, graphs).map((item) =>
            item.kind === "record" ? (
              <RecordCard key={item.id} record={item.data} />
            ) : (
              <GraphCard
                key={item.id}
                graph={item.data}
                onOpen={() => openGraph(item.data)}
              />
            ),
          )
        )}

        {hasGraphableData(records) && (
          <button className="rec-graph-cta" onClick={() => setView("graph")}>
            📊 数字がたまったよ！グラフを作ってみる?
          </button>
        )}

        <div className="rec-add-row">
          <button className="rec-add-btn" onClick={() => handleAdd("shirabe")}>
            <span className="rec-add-emoji">🔍</span>＋ しらべたことを追加
          </button>
          <button className="rec-add-btn" onClick={() => handleAdd("kiroku")}>
            <span className="rec-add-emoji">🧪</span>＋ きろくを追加
          </button>
        </div>

        {onNext && (
          <button className="next-btn rec-to-consideration-btn" onClick={onNext}>
            かんがえたことをまとめる →
          </button>
        )}
      </div>
    </div>
  );
}

// 記録カード1枚
function RecordCard({ record }) {
  const isKiroku = record.record_type === "kiroku";
  const viewpoints = Array.isArray(record.viewpoints) ? record.viewpoints : [];
  const numbers = getRecordNumbers(record).filter((n) => n.value !== null);
  const showMark = hasNumberData(record);
  return (
    <div className="rec-card">
      <div className="rec-card-top">
        <span
          className={`rec-type-badge ${isKiroku ? "rt-kiroku" : "rt-shirabe"}`}
        >
          {isKiroku ? "🧪 きろく" : "🔍 しらべたこと"}
        </span>
        {showMark && <span className="rec-num-mark">📊</span>}
        <span className="rec-card-date">{formatDate(record.observed_at)}</span>
      </div>
      {viewpoints.length > 0 && (
        <div className="rec-card-chips">
          {viewpoints.map((v) => (
            <span key={v} className="rec-card-chip">
              {getViewpointLabel(record.record_type, v)}
            </span>
          ))}
        </div>
      )}
      {record.body && <p className="rec-card-text">{record.body}</p>}
      {numbers.length > 0 && (
        <div className="rec-card-numtags">
          {numbers.map((n, i) => (
            <span key={i} className="rec-num-tag">
              📏 {n.label}
              {n.label ? ":" : ""}
              {n.value}
              {n.unit}
            </span>
          ))}
        </div>
      )}
      {record.why_note && (
        <div className="rec-card-why">
          <b>{isKiroku ? "なんでだと思う?" : "予想と同じ?ちがった?"}</b>{" "}
          {record.why_note}
        </div>
      )}
    </div>
  );
}

// 保存グラフのカード(きろく・しらべたことと並ぶ3つ目の種類)
function GraphCard({ graph, onOpen }) {
  const gd = graph.graph_data || {};
  const label = getGraphTypeById(gd.graphType).label;
  return (
    <div className="rec-card rec-card-graph" onClick={onOpen}>
      <div className="rec-card-top">
        <span className="rec-type-badge rt-graph">📊 グラフ</span>
        <span className="rec-card-date">{formatDate(graph.created_at)}</span>
      </div>
      <p className="rec-card-text rec-graph-cardtext">
        {gd.title || label}・{label} ▶ タップで見る
      </p>
    </div>
  );
}

// 記録とグラフを1つのリストにまとめ、日づけ順(古い→新しい)に並べる
function mergeItems(records, graphs) {
  const items = [
    ...records.map((r) => ({
      kind: "record",
      id: "r" + r.id,
      ts: r.observed_at,
      data: r,
    })),
    ...graphs.map((g) => ({
      kind: "graph",
      id: "g" + g.id,
      ts: g.created_at,
      data: g,
    })),
  ];
  items.sort((a, b) => new Date(a.ts) - new Date(b.ts));
  return items;
}

// ISO日時 → 「7/25(土)」形式
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}
