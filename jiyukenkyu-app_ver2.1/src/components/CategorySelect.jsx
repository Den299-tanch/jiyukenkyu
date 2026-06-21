// カテゴリの定義
// mode="dict"  → 辞書機能用
// mode="chat"  → テーマ決定用
// どちらも同じカテゴリ一覧を使う

const CATEGORIES = [
  { id: 'biology',  label: '生き物',   icon: '🐛', mode: 'theme-biology'  },
  { id: 'chemistry',label: '化学',     icon: '⚗️', mode: 'theme-chemistry'},
  { id: 'physics',  label: '物理',     icon: '⚡', mode: 'theme-physics'  },
  { id: 'history',  label: '歴史',     icon: '🏯', mode: 'theme-history'  },
  { id: 'it',       label: 'IT',       icon: '💻', mode: 'theme-it'       },
  { id: 'society',  label: '社会',     icon: '🌏', mode: 'theme-society'  },
  { id: 'life',     label: '生活',     icon: '🏠', mode: 'theme-life'     },
  { id: 'nature',   label: '自然',     icon: '🌿', mode: 'theme-nature'   },
];

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
