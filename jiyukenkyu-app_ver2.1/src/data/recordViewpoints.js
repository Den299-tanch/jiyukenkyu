// 記録入力画面の「視点チップ」定義
// きろく = 実際に見た・やった とき / しらべた = 本・ネット・人に聞いた とき で
// 出すチップを丸ごと切り替える。id は保存用、label は画面表示用。
export const KIROKU_VIEWPOINTS = [
  { id: 'iro',     label: 'いろ' },
  { id: 'oto',     label: 'おと' },
  { id: 'nioi',    label: 'におい' },
  { id: 'jikan',   label: 'じかん' },
  { id: 'ookisa',  label: 'おおきさ' },
  { id: 'katachi', label: 'かたち' },
];

export const SHIRABE_VIEWPOINTS = [
  { id: 'hon',          label: '本' },
  { id: 'internet',     label: 'インターネット' },
  { id: 'hito',         label: '人に聞いた' },
  { id: 'hakubutsukan', label: 'はくぶつかん・しせつ' },
];

// 記録の種類(kiroku / shirabe)に応じたチップ一覧を返すヘルパー
export function getViewpoints(recordType) {
  return recordType === 'shirabe' ? SHIRABE_VIEWPOINTS : KIROKU_VIEWPOINTS;
}

// 保存された id から表示ラベルを引くヘルパー(記録カードの表示で使用)
export function getViewpointLabel(recordType, id) {
  return getViewpoints(recordType).find((v) => v.id === id)?.label ?? id;
}
