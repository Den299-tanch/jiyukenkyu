// 汎用の確認モーダル。既定は「本当に消す?」(削除など取り消せない操作の前に挟む)。
// variant="primary" にすると、削除以外の確認(ダウンロードなど)向けの見た目になる。
export default function ConfirmModal({
  emoji = "🗑️",
  message,
  confirmLabel = "けす",
  cancelLabel = "やめる",
  confirming = false,
  variant = "danger", // 'danger' | 'primary'
  onConfirm,
  onCancel,
}) {
  return (
    <div className="cf-modal-backdrop" onClick={onCancel}>
      <div className="cf-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="cf-modal-emoji">{emoji}</div>
        <p className="cf-modal-text">{message}</p>
        <button
          className={variant === "primary" ? "cf-modal-primary-btn" : "cf-modal-danger-btn"}
          onClick={onConfirm}
          disabled={confirming}
        >
          {confirming ? (variant === "primary" ? "少しまってね…" : "けしています…") : confirmLabel}
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
