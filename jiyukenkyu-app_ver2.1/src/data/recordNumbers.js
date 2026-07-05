// 記録の「数字」まわりの共通ヘルパー。
// グラフ導線を出す件数のしきい値もここに置く(件数であって日数ではない)。
export const GRAPH_MIN_COUNT = 2; // 同じラベルの数値がこの件数そろったらグラフ導線を出す

// 記録から入力済みの数字を取り出す。
// ※node-pg は NUMERIC 列を文字列で返すので、ここで数値へ正規化する。
export function getRecordNumbers(record) {
  const out = [];
  for (const n of [1, 2]) {
    const label = record[`num${n}_label`];
    const rawValue = record[`num${n}_value`];
    const unit = record[`num${n}_unit`];
    const hasValue =
      rawValue !== null && rawValue !== undefined && rawValue !== "";
    const hasLabel = !!(label && String(label).trim());
    if (hasLabel || hasValue) {
      out.push({
        label: label ?? "",
        value: hasValue ? Number(rawValue) : null,
        unit: unit ?? "",
      });
    }
  }
  return out;
}

// この記録に「値つきの数字」があるか(記録カードの📊マークの判定に使う)
export function hasNumberData(record) {
  return getRecordNumbers(record).some((n) => n.value !== null);
}

// records の中で、指定ラベルの「値つき数字」を持つ記録の件数を数える
export function countRecordsWithLabel(records, label) {
  if (!label) return 0;
  return records.filter((r) =>
    getRecordNumbers(r).some((n) => n.label === label && n.value !== null),
  ).length;
}

// 保存直後に「今はかったラベル」を1つ取り出す(値つき・ラベルありを優先)
export function getMeasuredNumber(record) {
  if (!record) return null;
  return (
    getRecordNumbers(record).find((n) => n.value !== null && n.label) ?? null
  );
}

// records 全体で、値つき数字の合計件数
export function countAllNumbers(records) {
  return records.reduce(
    (sum, r) => sum + getRecordNumbers(r).filter((n) => n.value !== null).length,
    0,
  );
}

// グラフ導線を出してよいか(値つき数字が GRAPH_MIN_COUNT 件以上あるか)
export function hasGraphableData(records) {
  return countAllNumbers(records) >= GRAPH_MIN_COUNT;
}

// GRAPH_MIN_COUNT 件以上そろっている「同じラベル」の一覧
export function graphableLabels(records) {
  const counts = new Map();
  records.forEach((r) => {
    const labels = new Set(
      getRecordNumbers(r)
        .filter((n) => n.value !== null && n.label)
        .map((n) => n.label),
    );
    labels.forEach((l) => counts.set(l, (counts.get(l) || 0) + 1));
  });
  return [...counts]
    .filter(([, c]) => c >= GRAPH_MIN_COUNT)
    .map(([label]) => label);
}
