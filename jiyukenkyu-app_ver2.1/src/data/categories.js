// カテゴリ定義（CategorySelect / ThemeListScreen など共通で使用）
export const CATEGORIES = [
  { id: 'biology',  label: '生き物', icon: '🐛', mode: 'theme-biology'  },
  { id: 'chemistry',label: '化学',   icon: '⚗️', mode: 'theme-chemistry'},
  { id: 'physics',  label: '物理',   icon: '⚡', mode: 'theme-physics'  },
  { id: 'history',  label: '歴史',   icon: '🏯', mode: 'theme-history'  },
  { id: 'it',       label: 'IT',     icon: '💻', mode: 'theme-it'       },
  { id: 'society',  label: '社会',   icon: '🌏', mode: 'theme-society'  },
  { id: 'life',     label: '生活',   icon: '🏠', mode: 'theme-life'     },
  { id: 'nature',   label: '自然',   icon: '🌿', mode: 'theme-nature'   },
];

// id から カテゴリ情報を取り出すヘルパー
export function getCategoryById(id) {
  return CATEGORIES.find(c => c.id === id);
}
