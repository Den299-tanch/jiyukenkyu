import { useState } from "react";
import GraphView from "./GraphView";
import ConfirmModal from "./ConfirmModal";
import { getGraphTypeById } from "../data/graphTypes";

// 保存したグラフだけを見られる一覧画面(記録とは別)。
// PC・タブレット横持ちでの一覧性を優先したグリッドギャラリー。
export default function GraphListScreen({ userId, graphs, onBack, onDeleted }) {
  const [openGraph, setOpenGraph] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function handleConfirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const base = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(
        `${base}/api/graphs/${deleteTarget.id}?userId=${userId}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      onDeleted(deleteTarget.id);
      if (openGraph?.id === deleteTarget.id) setOpenGraph(null);
      setDeleteTarget(null);
    } catch (err) {
      alert("グラフの削除に失敗しました: " + err.message);
    }
    setDeleting(false);
  }

  return (
    <div className="record-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>
          ← 戻る
        </button>
        <h2>📊 グラフ一覧</h2>
      </div>

      <div className="record-content">
        {graphs.length === 0 ? (
          <div className="rec-empty-card">
            <p className="rec-empty-emoji">📊</p>
            <p className="rec-empty-text">
              まだ保存したグラフがないよ。
              <br />
              記録がたまったらグラフを作ってみよう。
            </p>
          </div>
        ) : (
          <div className="glist-grid">
            {graphs.map((g) => (
              <GraphGridCard
                key={g.id}
                graph={g}
                onOpen={() => setOpenGraph(g)}
                onDelete={() => setDeleteTarget(g)}
              />
            ))}
          </div>
        )}
      </div>

      {openGraph && (
        <GraphDetailOverlay
          graph={openGraph}
          onClose={() => setOpenGraph(null)}
          onDelete={() => setDeleteTarget(openGraph)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          message={"このグラフを消すよ。\nもとにはもどせないけど、いいかな?"}
          confirming={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// グリッド1枚分のミニカード
function GraphGridCard({ graph, onOpen, onDelete }) {
  const gd = graph.graph_data || {};
  const typeInfo = getGraphTypeById(gd.graphType);
  return (
    <div className="glist-card">
      <button
        className="glist-delete-btn"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="このグラフを消す"
      >
        🗑️
      </button>
      <div className="glist-card-body" onClick={onOpen}>
        <div className="glist-card-title">{gd.title || typeInfo.label}</div>
        <div className="glist-card-sub">
          {typeInfo.icon} {typeInfo.label}・{formatDate(graph.created_at)}
        </div>
        <div className="glist-card-chart">
          <GraphView
            type={gd.graphType}
            entries={gd.entries || []}
            xAxisLabel={gd.xAxisLabel ?? undefined}
            compact
          />
        </div>
      </div>
    </div>
  );
}

// タップしたグラフを大きく見る詳細オーバーレイ
function GraphDetailOverlay({ graph, onClose, onDelete }) {
  const gd = graph.graph_data || {};
  const typeInfo = getGraphTypeById(gd.graphType);
  return (
    <div className="glist-detail-backdrop" onClick={onClose}>
      <div className="glist-detail-card" onClick={(e) => e.stopPropagation()}>
        <div className="glist-detail-top">
          <div className="graph-saved-title">{gd.title || typeInfo.label}</div>
          <button className="glist-detail-delete" onClick={onDelete}>
            🗑️ 消す
          </button>
        </div>
        <div className="graph-sub">えらんだグラフ: {typeInfo.label}</div>
        <GraphView
          type={gd.graphType}
          entries={gd.entries || []}
          xAxisLabel={gd.xAxisLabel ?? undefined}
        />
        <button className="next-btn rec-save-btn" onClick={onClose}>
          いちらんに もどる
        </button>
      </div>
    </div>
  );
}

// ISO日時 → 「7/25(土)」形式
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}
