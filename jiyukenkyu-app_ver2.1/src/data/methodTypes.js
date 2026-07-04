// 研究方法の「型」定義（ResearchMethodScreen などで共通で使用）
export const METHOD_TYPES = [
  {
    id: 'try',
    label: 'やってみる',
    icon: '🧪',
    desc: 'じっさいに何かをためしてみる',
    example: '例: こおりに塩をかける',
  },
  {
    id: 'compare',
    label: 'くらべる',
    icon: '⚖️',
    desc: '2つ以上ならべてちがいを見る',
    example: '例: 水と塩水でくらべる',
  },
  {
    id: 'investigate',
    label: 'しらべる',
    icon: '📚',
    desc: '本やネット、人に聞いて調べる',
    example: '例: 図鑑でしゅるいを調べる',
  },
  {
    id: 'observe',
    label: 'かんさつする',
    icon: '🔭',
    desc: '時間をかけてようすを見る',
    example: '例: 毎日せの高さをはかる',
  },
];

// id から 研究方法の型情報を取り出すヘルパー
export function getMethodTypeById(id) {
  return METHOD_TYPES.find(m => m.id === id);
}
