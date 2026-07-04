// スケジュールのタスクの「しゅるい」定義(ScheduleScreen などで共通で使用)
// id はモックアップのCSSクラス名(t-jikken など)、AIが返すJSONの type ともそろえてある
export const TASK_TYPES = [
  { id: 'jikken',    label: '実験',     icon: '🧪' },
  { id: 'kuraberu',  label: 'くらべる', icon: '⚖️' },
  { id: 'shiraberu', label: 'しらべる', icon: '📚' },
  { id: 'kansatsu',  label: '観察',     icon: '🔭' },
  { id: 'junbi',     label: '準備',     icon: '🎒' },
  { id: 'kiroku',    label: '記録',     icon: '📝' },
  { id: 'yasumi',    label: 'やすみ',   icon: '🌤️' },
  { id: 'matome',    label: 'まとめ',   icon: '✨' },
  { id: 'other',     label: 'その他',   icon: '✏️' },
];

// id から タスクの型情報を取り出すヘルパー
export function getTaskTypeById(id) {
  return TASK_TYPES.find(t => t.id === id) ?? TASK_TYPES[TASK_TYPES.length - 1];
}
