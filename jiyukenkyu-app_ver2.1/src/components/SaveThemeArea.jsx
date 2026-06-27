export default function SaveThemeArea({ themeInput, setThemeInput, onSave, saving, savedThemes }) {
  return (
    <div className="save-theme-area">
      {savedThemes.length > 0 && (
        <div className="saved-themes-list">
          <p className="saved-themes-title">📋 保存したテーマ</p>
          {savedThemes.map((theme, i) => (
            <div key={i} className="saved-theme-item">
              <span className="saved-theme-num">{i + 1}.</span>
              <span className="saved-theme-text">{theme}</span>
            </div>
          ))}
        </div>
      )}

      <p className="save-theme-label">💡 テーマが思いついたら保存しよう！</p>
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
          {saving ? '保存中…' : '📝 保存'}
        </button>
      </div>
    </div>
  );
}