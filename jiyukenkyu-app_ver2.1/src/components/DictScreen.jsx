import { useState } from 'react';

// ===== 辞書データ =====
// メンバーから集めるキーワード＋説明文を、ここに入れていく
// カテゴリ id（biology, chemistry, ...）と CategorySelect の id を一致させる
const DICT_DATA = {
  biology: [
    { keyword: '光合成', desc: '植物が太陽の光のエネルギーをつかって、水と二酸化炭素から養分（でんぷん）をつくるはたらきのこと。このとき酸素も出てくるよ。' },
    { keyword: '細胞',   desc: '生き物の体をつくっている、とても小さな部屋のようなもの。人の体も、たくさんの細胞が集まってできているよ。' },
    { keyword: '食物連鎖', desc: '生き物どうしの「食べる・食べられる」のつながりのこと。草を虫が食べて、虫を鳥が食べる、というようにつながっているよ。' },
  ],
  chemistry: [
    { keyword: '酸化', desc: '物が空気中の酸素とむすびつくこと。釘がさびたり、リンゴの切り口が茶色くなったりするのも酸化だよ。' },
    { keyword: '中和', desc: '酸性のものとアルカリ性のものを混ぜると、おたがいの性質を打ち消しあうこと。' },
  ],
  physics: [
    { keyword: '摩擦', desc: '物と物がふれあったときに、動きをじゃまする力のこと。すべり台がツルツルしているのは摩擦を小さくしているからだよ。' },
  ],
  history: [
    { keyword: '弥生時代', desc: '今からおよそ2300年前から1700年前ごろの時代。米作りが広まり、むらや くにができていったよ。' },
  ],
  it: [
    { keyword: 'プログラミング', desc: 'コンピュータに「こう動いてね」と命令を書くこと。命令の書き方にはいろいろな種類（言語）があるよ。' },
  ],
  society: [
    { keyword: '三権分立', desc: '国の大切な仕事を「法律をつくる」「政治をする」「裁判をする」の3つに分けて、おたがいがチェックしあうしくみ。' },
  ],
  life: [
    { keyword: 'リサイクル', desc: '使い終わったものを、ごみにしないでもう一度使えるようにすること。ペットボトルが服や別のボトルに生まれ変わるよ。' },
  ],
  nature: [
    { keyword: '台風', desc: '南の海であたためられた空気から生まれる、強い風と雨をともなう大きなうずまき。' },
  ],
};

export default function DictScreen({ category, onBack }) {
  // どのキーワードを開いているか（複数同時に開けるように Set で管理）
  const [openSet, setOpenSet] = useState(new Set());

  const items = DICT_DATA[category?.id] ?? [];

  function toggle(keyword) {
    setOpenSet(prev => {
      const next = new Set(prev);
      if (next.has(keyword)) {
        next.delete(keyword);
      } else {
        next.add(keyword);
      }
      return next;
    });
  }

  return (
    <div className="dict-screen">
      <button className="back-btn" onClick={onBack}>← 戻る</button>

      <h2 className="dict-title">
        {category?.icon} {category?.label} のキーワード
      </h2>

      {items.length === 0 ? (
        <p className="dict-empty">このカテゴリのキーワードはまだ準備中です。</p>
      ) : (
        <div className="dict-list">
          {items.map(item => {
            const isOpen = openSet.has(item.keyword);
            return (
              <div
                key={item.keyword}
                className={`dict-item ${isOpen ? 'open' : ''}`}
              >
                <button
                  className="dict-item-head"
                  onClick={() => toggle(item.keyword)}
                >
                  <span className="dict-keyword">{item.keyword}</span>
                  <span className="dict-arrow">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="dict-desc">{item.desc}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
