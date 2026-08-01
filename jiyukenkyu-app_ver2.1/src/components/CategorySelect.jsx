// カテゴリ選択画面
// mode は見出しの文言を切り替えるためだけに使う（辞書=dict / テーマ決定=chat）。
// 選択肢そのものは src/data/categories.js の CATEGORIES に一本化しており、
// 辞書とテーマ決定でまったく同じ一覧が出る。
import { CATEGORIES } from '../data/categories';
import Ruby from './Ruby';

export default function CategorySelect({ mode, onSelect, onBack }) {
  const title = mode === 'dict'
    ? '📖 どのカテゴリを調[しら]べますか？'
    : '💡 どのカテゴリに興味[きょうみ]がありますか？';

  const categories = CATEGORIES;

  return (
    <div className="category-screen">
      <button className="back-btn" onClick={onBack}>← <Ruby>{"戻[もど]る"}</Ruby></button>

      <h2 className="category-title"><Ruby>{title}</Ruby></h2>

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
