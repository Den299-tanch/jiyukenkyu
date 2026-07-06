import { getRecordNumbers } from "./recordNumbers";

// グラフの色パレット(順番に使う)
export const GRAPH_COLORS = [
  "#FF6B6B",
  "#2EC4B6",
  "#8A6FE0",
  "#FFC93C",
  "#4facfe",
  "#48bb78",
  "#f5576c",
  "#a15c00",
];

// ISO日時 → 「7/25」
export function shortDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// この仮説の記録から、値つきの数字を1件ずつ取り出して並べる
// (1記録が num1/num2 の2つ持てるので、それぞれ1エントリになる)
export function collectNumberEntries(records) {
  const entries = [];
  records.forEach((r) => {
    getRecordNumbers(r).forEach((n, slot) => {
      if (n.value === null) return;
      entries.push({
        key: `${r.id}-${slot}`,
        recordId: r.id,
        label: n.label || "数字",
        value: n.value,
        unit: n.unit || "",
        date: r.observed_at,
      });
    });
  });
  return entries;
}

// x軸などに使う1エントリの見出し
function entryName(e, i) {
  const d = shortDate(e.date);
  return d ? d : `#${i + 1}`;
}

// 棒・折れ線用: 1エントリ=1本(ヨコ軸は日づけ=observed_at)
export function buildSeriesData(entries) {
  return entries.map((e, i) => ({
    name: entryName(e, i),
    value: e.value,
    unit: e.unit,
    label: e.label,
  }));
}

// 同じ記録の中にある2つのラベルの値を1点にまとめる(散布図・ペア折れ線で共通)。
// 例: 記録Aに「経過時間=5」「観察数=3」があれば {x:5, y:3} を1点にする。
// xLabel と yLabel の両方がそろっている記録だけを点にする。
export function pairByRecord(entries, xLabel, yLabel) {
  const byRecord = new Map();
  entries.forEach((e) => {
    if (!byRecord.has(e.recordId)) byRecord.set(e.recordId, { date: e.date });
    byRecord.get(e.recordId)[e.label] = e.value;
  });
  const points = [];
  byRecord.forEach((vals) => {
    if (vals[xLabel] !== undefined && vals[yLabel] !== undefined) {
      points.push({ x: vals[xLabel], y: vals[yLabel], date: vals.date });
    }
  });
  return points;
}

// 棒・折れ線用(2ラベル版): xLabel をヨコ軸、yLabel をタテ軸にしてペアにする。
// 折れ線がなめらかに見えるよう x の昇順で並べる。
export function buildPairedSeriesData(entries, xLabel, yLabel) {
  return pairByRecord(entries, xLabel, yLabel)
    .sort((a, b) => a.x - b.x)
    .map((p) => ({
      name: String(p.x),
      value: p.y,
      unit: "",
      label: yLabel,
    }));
}

// 円・帯用: 値の大きさ(絶対値)で割合を出す。単位が違っても機械的に%換算される。
export function buildShareData(entries) {
  return entries.map((e) => ({
    name: `${e.label}${shortDate(e.date) ? " " + shortDate(e.date) : ""}`,
    value: Math.abs(e.value),
  }));
}

// ヒストグラム用: 値を階級(バケツ)に分けて件数を数える
export function buildHistogramData(entries) {
  const values = entries.map((e) => e.value);
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    // 全部同じ値なら1本にまとめる
    return [{ name: `${min}`, value: values.length }];
  }
  const binCount = Math.min(5, values.length);
  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    lo: min + width * i,
    hi: min + width * (i + 1),
    count: 0,
  }));
  values.forEach((v) => {
    let idx = Math.floor((v - min) / width);
    if (idx >= binCount) idx = binCount - 1; // 最大値は最後のバケツへ
    bins[idx].count += 1;
  });
  const round = (x) => Math.round(x * 10) / 10;
  return bins.map((b) => ({
    name: `${round(b.lo)}〜${round(b.hi)}`,
    value: b.count,
  }));
}

// 散布図用: 2変数(2つのラベル)があれば同じ記録どうしをペアにする。
// 数字2が無ければ「値 × 記録順」で描く(代用ルール)。
export function buildScatterData(entries) {
  const labels = [...new Set(entries.map((e) => e.label))];
  if (labels.length >= 2) {
    const [ax, ay] = labels;
    const points = pairByRecord(entries, ax, ay);
    if (points.length > 0) {
      return { points, xName: ax, yName: ay };
    }
  }
  // 代用: 値 × 記録順
  return {
    points: entries.map((e, i) => ({ x: i + 1, y: e.value })),
    xName: "きろくの順番",
    yName: labels[0] || "数字",
  };
}
