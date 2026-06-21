export default function TitleScreen({ onDict, onChat }) {
  return (
    <div className="title-screen">
      <div className="title-content">
        <div className="title-icon">🔬</div>
        <h1 className="title-main">自由研究<br />AIアシスタント</h1>
        <p className="title-sub">何をしたいですか？</p>

        <div className="title-buttons">
          <button className="title-btn dict-btn" onClick={onDict}>
            <span className="btn-icon">📖</span>
            <span className="btn-label">既習単元辞書</span>
            <span className="btn-desc">習ったことを調べよう</span>
          </button>

          <button className="title-btn chat-btn" onClick={onChat}>
            <span className="btn-icon">💡</span>
            <span className="btn-label">テーマを決める</span>
            <span className="btn-desc">AIと一緒に考えよう</span>
          </button>
        </div>
      </div>
    </div>
  );
}
