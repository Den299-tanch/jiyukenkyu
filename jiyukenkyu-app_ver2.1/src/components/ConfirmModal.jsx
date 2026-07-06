// 汎用の「本当に消す?」確認モーダル(削除など取り消せない操作の前に挟む)
export default function ConfirmModal({
  emoji = "🗑️",
  message,
  confirmLabel = "けす",
  cancelLabel = "やめる",
  confirming = false,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="cf-modal-backdrop" onClick={onCancel}>
      <div className="cf-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="cf-modal-emoji">{emoji}</div>
        <p className="cf-modal-text">{message}</p>
        <button
          className="cf-modal-danger-btn"
          onClick={onConfirm}
          disabled={confirming}
        >
          {confirming ? "けしています…" : confirmLabel}
        </button>
        <button
          className="cf-modal-cancel-btn"
          onClick={onCancel}
          disabled={confirming}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
