import { useState } from 'react';

// つかいかたガイドの中身。
// 今後アプリの機能(グラフ機能の採否など)が変わっても古くならないよう、
// 具体的な画面名・機能名ではなく「自由研究の進め方」という抽象的な流れとして書く。
// imageUrl を入れれば絵文字の代わりに写真/イラストを表示できる(今回はデモ版のため未設定)。
const GUIDE_SLIDES = [
  {
    emoji: '🔬',
    title: '自由研究をはじめよう',
    body: 'このアプリは、自由研究をじゅんばんに進めるお手伝いをします。\n答えをそのまま出すのではなく、自分で考えるためのヒントを出します。\n\n最初から全部を完成させなくても大丈夫。\n気になることを見つけて、予想して、調べて、記録して、さいごにまとめていこう。',
    imageUrl: null,
  },
  {
    emoji: '💡',
    title: '① テーマを決める',
    body: '何について調べたいかを決めます。',
    imageUrl: null,
  },
  {
    emoji: '🔮',
    title: '② 予想を立てる',
    body: '「こうなるかもしれない」と考えてみます。\n正解しなくても大丈夫。',
    imageUrl: null,
  },
  {
    emoji: '🔍',
    title: '③ 調べ方を考える',
    body: 'どうすれば予想をたしかめられるかを考えます。',
    imageUrl: null,
  },
  {
    emoji: '🗓️',
    title: '④ 予定を立てる',
    body: 'いつ、何をするかを決めます。',
    imageUrl: null,
  },
  {
    emoji: '📝',
    title: '⑤ 記録をつける',
    body: '見たこと、数えたこと、気づいたことを書きます。\nうまくいかなかったことも大切な記録だよ。',
    imageUrl: null,
  },
  {
    emoji: '🔎',
    title: '⑥ 記録を見くらべる',
    body: '記録を見返して、変わったところや気づいたことをさがします。',
    imageUrl: null,
  },
  {
    emoji: '🤔',
    title: '⑦ 考えたことを書く',
    body: '結果を見て、どうしてそうなったのかを考えます。',
    imageUrl: null,
  },
  {
    emoji: '🎉',
    title: '⑧ まとめを作る',
    body: '研究したことを、さいごにわかりやすくまとめます。',
    imageUrl: null,
  },
];

export default function GuideOverlay({ onClose }) {
  const [index, setIndex] = useState(0);
  const slide = GUIDE_SLIDES[index];
  const isFirst = index === 0;
  const isLast = index === GUIDE_SLIDES.length - 1;

  return (
    <div className="guide-backdrop" onClick={onClose}>
      <div className="guide-card" onClick={(e) => e.stopPropagation()}>
        <button className="guide-close-btn" onClick={onClose} aria-label="とじる">✕</button>

        <div className="guide-visual">
          {slide.imageUrl ? (
            <img src={slide.imageUrl} alt={slide.title} className="guide-image" />
          ) : (
            <div className="guide-emoji">{slide.emoji}</div>
          )}
        </div>

        <h3 className="guide-title">{slide.title}</h3>
        <p className="guide-body">{slide.body}</p>

        <div className="guide-dots">
          {GUIDE_SLIDES.map((_, i) => (
            <span key={i} className={`guide-dot ${i === index ? 'active' : ''}`} />
          ))}
        </div>

        <div className="guide-nav">
          <button
            className="guide-nav-btn"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={isFirst}
          >
            ← もどる
          </button>
          {isLast ? (
            <button className="guide-nav-btn guide-nav-btn--primary" onClick={onClose}>
              とじる
            </button>
          ) : (
            <button
              className="guide-nav-btn guide-nav-btn--primary"
              onClick={() => setIndex((i) => Math.min(GUIDE_SLIDES.length - 1, i + 1))}
            >
              つぎへ →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
