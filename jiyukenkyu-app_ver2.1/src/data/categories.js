// カテゴリ定義（辞書機能・テーマ決定の両方が参照する唯一の定義）
//
// 以前は辞書用（src/data/dictCategories.js）とテーマ決定用でリストを別々に持っていたが、
// 片方だけ増やすと「辞書では調べられるのにテーマ決定では選べない」というズレが起きるため、
// ここ1か所に統合した。カテゴリを増減するときはこの配列だけを編集すること。
//
// - id   : DB の themes.category に保存される値。DictScreen の DICT_DATA のキーとも一致させる
// - mode : AI のシステムプロンプトを引くキー（server/index.js の PROMPTS）。id と 1:1 で対応する
// - themeOnly : テーマ決定にだけ出し、辞書には出さない（辞書に載せるキーワード集が無いもの）
export const CATEGORIES = [
  { id: 'biology', label: '生き物',        icon: '🐛', mode: 'theme-biology' },
  { id: 'science', label: '理科',          icon: '🧪', mode: 'theme-science' },
  { id: 'history', label: '歴史',          icon: '🏯', mode: 'theme-history' },
  { id: 'it',      label: 'IT',            icon: '💻', mode: 'theme-it'      },
  { id: 'society', label: '社会',          icon: '🌏', mode: 'theme-society' },
  { id: 'life',    label: '生活',          icon: '🏠', mode: 'theme-life'    },
  { id: 'nature',  label: '自然',          icon: '🌿', mode: 'theme-nature'  },
  { id: 'space',   label: '宇宙',          icon: '🚀', mode: 'theme-space'   },
  { id: 'art',     label: '芸術・音楽',    icon: '🎨', mode: 'theme-art'     },
  { id: 'sports',  label: 'スポーツ・健康', icon: '🏃', mode: 'theme-sports'  },
  { id: 'math',    label: '算数',          icon: '🔢', mode: 'theme-math'    },
  // どのカテゴリにも当てはまらない子の受け皿。辞書に載せるキーワード集が無いので
  // themeOnly を立て、辞書のカテゴリ選択には出さない。
  { id: 'other',   label: 'その他',        icon: '✨', mode: 'theme-other', themeOnly: true },
];

// 辞書のカテゴリ選択に出すもの（キーワード集があるカテゴリだけ）
export const DICT_CATEGORIES = CATEGORIES.filter(c => !c.themeOnly);

// 旧カテゴリ id → 現カテゴリ id の読み替え表。
// 化学(chemistry)・物理(physics)は辞書側に合わせて理科(science)へ統合したが、
// 統合前に保存されたテーマが DB の themes.category に残っている。
// 読み替えをしないと一覧で「chemistry」という生の文字列が出たり、
// AI ヒントの category（= mode）が undefined になってカテゴリの文脈が失われてしまう。
const LEGACY_CATEGORY_ALIASES = {
  chemistry: 'science',
  physics: 'science',
};

// id から カテゴリ情報を取り出すヘルパー（旧 id もここで吸収する）
export function getCategoryById(id) {
  const resolvedId = LEGACY_CATEGORY_ALIASES[id] ?? id;
  return CATEGORIES.find(c => c.id === resolvedId);
}
