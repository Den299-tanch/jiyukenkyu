export default function SaveThemeArea({ themeInput, setThemeInput, onSave, saving, saved }) {
  if (saved) {
    return (
      <div className="save-theme-area saved">
        <p className="save-theme-done">✅ テーマを保存しました！</p>
      </div>
    );
  }

  return (
    <div className="save-theme-area">
      <p className="save-theme-label">💡 テーマが決まったら保存しよう！</p>
      <div className="save-theme-row">
        <input
          type="text"
          className="save-theme-input"
          placeholder="例: アリが迷子にならない理由を調べる"
          value={themeInput}
          onChange={(e) => setThemeInput(e.target.value)}
          disabled={saving}
        />
        <button
          className="save-theme-btn"
          onClick={onSave}
          disabled={saving || !themeInput.trim()}
        >
          {saving ? '保存中…' : '📝 テーマを保存'}
        </button>
      </div>
    </div>
  );
}