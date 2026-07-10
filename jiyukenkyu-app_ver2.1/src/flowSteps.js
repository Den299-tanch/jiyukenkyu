// 研究フローの「今どのへんまで進んだか」を、左サイドのロケットの道で見せる進捗表示。
// screen(App.jsxの画面state) と実際のステップの対応づけをここに集約する。
export const FLOW_STEPS = [
  { key: 'theme', emoji: '💡', label: 'テーマ', screens: ['chat-category', 'chat', 'theme-list'] },
  { key: 'hypothesis', emoji: '🔮', label: 'よそう', screens: ['hypothesis'] },
  { key: 'method', emoji: '🔍', label: 'しらべ方[かた]', screens: ['research-method'] },
  { key: 'schedule', emoji: '🗓️', label: 'よてい', screens: ['schedule'] },
  { key: 'record', emoji: '📝', label: 'きろく', screens: ['record'] },
  { key: 'consideration', emoji: '🤔', label: 'こうさつ', screens: ['consideration'] },
  { key: 'summary', emoji: '🎉', label: 'まとめ', screens: ['summary'] },
];

export function getFlowStepIndex(screen) {
  return FLOW_STEPS.findIndex((step) => step.screens.includes(screen));
}

// 「🔄 つづきから」で選んだ研究がどこまで進んでいるかを、GET /api/research/:id が
// 返す schedule/consideration/report の有無から判定し、続きの画面を決める。
export function pickResearchLandingScreen({ schedule, consideration, report }) {
  if (report) return 'summary';
  if (consideration) return 'summary';
  if (schedule) return 'record';
  return 'schedule';
}
