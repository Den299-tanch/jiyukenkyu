// グラフの6種類の定義。6種すべて常に選べる(ブロックしない方針)。
export const GRAPH_TYPES = [
  { id: 'bar',       label: '棒グラフ',       icon: '📊' },
  { id: 'line',      label: '折れ線グラフ',   icon: '📈' },
  { id: 'pie',       label: '円グラフ',       icon: '🥧' },
  { id: 'histogram', label: 'ヒストグラム',   icon: '📶' },
  { id: 'scatter',   label: '散布図',         icon: '🔵' },
  { id: 'band',      label: '帯グラフ',       icon: '🎗️' },
];

export function getGraphTypeById(id) {
  return GRAPH_TYPES.find((g) => g.id === id) ?? GRAPH_TYPES[0];
}
