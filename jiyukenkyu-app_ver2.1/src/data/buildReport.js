import { getRecordNumbers } from "./recordNumbers";

// これまで貯めてきたデータ(記録・グラフ・スケジュール・考察)と、
// 子どもが自分の言葉で書いた Q1(やったこと)・Q2(つたえたいこと)を
// まとめ1件ぶんの JSON に組み立てる。
//
// この JSON がそのまま reports テーブルに保存され、
// ReportView はこの形だけを受け取って描画する(DBに入るのと同じ形)。
export function buildReportData({
  userNumber,
  theme,
  category,
  hypothesis,
  schedule,
  records = [],
  graphs = [],
  reflection = {},
  summaryDid = "",
  summaryTell = "",
}) {
  const sortedRecords = records
    .slice()
    .sort((a, b) => new Date(a.observed_at) - new Date(b.observed_at));

  return {
    version: 1,
    userNumber: userNumber ?? null,
    theme: theme ?? "",
    category: category ?? null,
    hypothesis: hypothesis ?? "",
    period: {
      start: sortedRecords[0]?.observed_at ?? null,
      end: schedule?.endDate ?? null,
    },
    schedule: Array.isArray(schedule?.tasks) ? schedule.tasks : [],
    summaryDid,
    summaryTell,
    // 記録は表示に必要なぶんだけスナップショットにする(元テーブルを引かなくても再現できる)
    records: sortedRecords.map((r) => ({
      id: r.id,
      record_type: r.record_type,
      observed_at: r.observed_at,
      body: r.body ?? "",
      why_note: r.why_note ?? "",
      viewpoints: r.viewpoints ?? [],
      numbers: getRecordNumbers(r).map((n) => ({
        label: n.label,
        value: n.value,
        unit: n.unit,
      })),
    })),
    graphs: graphs.map((g) => {
      const gd = g.graph_data ?? g;
      return {
        graphType: gd.graphType,
        title: gd.title ?? "",
        entries: gd.entries ?? [],
        xAxisLabel: gd.xAxisLabel ?? null,
      };
    }),
    reflection: { q1: reflection.q1 ?? "", q2: reflection.q2 ?? "" },
    createdAt: new Date().toISOString(),
  };
}
