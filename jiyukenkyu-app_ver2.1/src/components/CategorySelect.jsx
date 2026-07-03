// カテゴリの定義
// mode="dict"  → 辞書機能用（DICT_CATEGORIES）
// mode="chat"  → テーマ決定用（CATEGORIES）
// 辞書とテーマ決定でカテゴリ一覧は別々に管理している
import { CATEGORIES } from '../data/categories';
import { DICT_CATEGORIES } from '../data/dictCategories';

export default function CategorySelect({ mode, onSelect, onBack }) {
  const title = mode === 'dict'
    ? '📖 どのカテゴリを調べますか？'
    : '💡 どのカテゴリに興味がありますか？';

  const categories = mode === 'dict' ? DICT_CATEGORIES : CATEGORIES;

  return (
    <div className="category-screen">
      <button className="back-btn" onClick={onBack}>← 戻る</button>

      <h2 className="category-title">{title}</h2>

      <div className="category-grid">
        {categories.map(cat => (
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
