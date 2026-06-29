// カテゴリの定義
// mode="dict"  → 辞書機能用
// mode="chat"  → テーマ決定用
// どちらも同じカテゴリ一覧を使う
import { CATEGORIES } from '../data/categories';

export default function CategorySelect({ mode, onSelect, onBack }) {
  const title = mode === 'dict'
    ? '📖 どのカテゴリを調べますか？'
    : '💡 どのカテゴリに興味がありますか？';

  return (
    <div className="category-screen">
      <button className="back-btn" onClick={onBack}>← 戻る</button>

      <h2 className="category-title">{title}</h2>

      <div className="category-grid">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className="category-btn"
            onClick={() => onSelect(cat)}
          >
            <span className="cat-icon">{cat.icon}</span>
            <span className="cat-label">{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
