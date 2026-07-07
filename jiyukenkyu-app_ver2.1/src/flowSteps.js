// 研究フローの「今どのへんまで進んだか」を、左サイドのロケットの道で見せる進捗表示。
// screen(App.jsxの画面state) と実際のステップの対応づけをここに集約する。
export const FLOW_STEPS = [
  { key: 'theme', emoji: '💡', label: 'テーマ', screens: ['chat-category', 'chat', 'theme-list'] },
  { key: 'hypothesis', emoji: '🔮', label: 'よそう', screens: ['hypothesis'] },
  { key: 'method', emoji: '🔍', label: 'しらべ方', screens: ['research-method'] },
  { key: 'schedule', emoji: '🗓️', label: 'よてい', screens: ['schedule'] },
  { key: 'record', emoji: '📝', label: 'きろく', screens: ['record'] },
  { key: 'consideration', emoji: '🤔', label: 'こうさつ', screens: ['consideration'] },
  { key: 'summary', emoji: '🎉', label: 'まとめ', screens: ['summary'] },
];

export function getFlowStepIndex(screen) {
  return FLOW_STEPS.findIndex((step) => step.screens.includes(screen));
}
