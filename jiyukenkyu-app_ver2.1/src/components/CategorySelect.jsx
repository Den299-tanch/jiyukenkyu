// カテゴリ選択画面
// 選択肢は src/data/categories.js に一本化してあり、辞書とテーマ決定で同じ一覧が出る。
// ただし「その他」だけは辞書に載せるキーワード集が無いため、辞書では非表示にする
// （DICT_CATEGORIES = CATEGORIES から themeOnly を除いたもの）。
import { CATEGORIES, DICT_CATEGORIES } from '../data/categories';
import Ruby from './Ruby';

export default function CategorySelect({ mode, onSelect, onBack }) {
  const title = mode === 'dict'
    ? '📖 どのカテゴリを調[しら]べますか？'
    : '💡 どのカテゴリに興味[きょうみ]がありますか？';

  const categories = mode === 'dict' ? DICT_CATEGORIES : CATEGORIES;

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
