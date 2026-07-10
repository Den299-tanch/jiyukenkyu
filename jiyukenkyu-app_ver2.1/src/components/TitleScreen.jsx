import Ruby from './Ruby';

export default function TitleScreen({ onDict, onChat, onContinue, onGuide, onLogout }) {
  return (
    <div className="title-screen">
      <div className="title-content">
        <div className="title-icon">🔬</div>
        <h1 className="title-main"><Ruby>{"自由研究[じゆうけんきゅう]"}</Ruby><br />AIアシスタント</h1>
        <p className="title-sub"><Ruby>{"何[なに]をしたいですか？"}</Ruby></p>

        <div className="title-buttons">
          <button className="title-btn continue-btn" onClick={onContinue}>
            <span className="btn-icon">🔄</span>
            <span className="btn-label">つづきから</span>
            <span className="btn-desc"><Ruby>{"前[まえ]にやった研究[けんきゅう]をえらぶ"}</Ruby></span>
          </button>

          <button className="title-btn dict-btn" onClick={onDict}>
            <span className="btn-icon">📖</span>
            <span className="btn-label"><Ruby>{"既習単元辞書[きしゅうたんげんじしょ]"}</Ruby></span>
            <span className="btn-desc"><Ruby>{"習[なら]ったことを調[しら]べよう"}</Ruby></span>
          </button>

          <button className="title-btn chat-btn" onClick={onChat}>
            <span className="btn-icon">💡</span>
            <span className="btn-label"><Ruby>{"テーマを決[き]める"}</Ruby></span>
            <span className="btn-desc"><Ruby>{"AIと一緒[いっしょ]に考[かんが]えよう"}</Ruby></span>
          </button>
        </div>

        <button className="guide-link-btn" onClick={onGuide}>
          📘 つかいかたガイド
        </button>

        <button className="guide-link-btn" onClick={onLogout}>
          🚪 <Ruby>{"番号[ばんごう]をかえる(ログアウト)"}</Ruby>
        </button>
      </div>
    </div>
  );
}
