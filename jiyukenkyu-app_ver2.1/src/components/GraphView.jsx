import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  GRAPH_COLORS,
  buildSeriesData,
  buildPairedSeriesData,
  buildShareData,
  buildHistogramData,
  buildScatterData,
  buildAxisSeries,
  buildAxisScatter,
} from "../data/graphBuild";

// 棒・折れ線のヨコ軸データを決める。
// xAxisLabel が指定されていて、選んだ数字がちょうど2ラベルなら「ペア」でヨコ軸を作る。
// それ以外(1ラベル・軸未指定・ペアが作れない)は今までどおり日づけ(observed_at)軸。
// タテ軸のタイトルも同時に決める(ペアなら「もう一方のラベル」、単一ラベルなら「そのラベル(単位)」)。
function seriesForAxis(entries, xAxisLabel) {
  const labels = [...new Set(entries.map((e) => e.label))];
  if (xAxisLabel && labels.length === 2) {
    const yLabel = labels.find((l) => l !== xAxisLabel);
    const paired = buildPairedSeriesData(entries, xAxisLabel, yLabel);
    if (paired.length > 0) {
      return { data: paired, axisLabel: xAxisLabel, yAxisLabel: yLabel };
    }
  }
  let yAxisLabel = null;
  if (labels.length === 1) {
    const unit = entries.find((e) => e.unit)?.unit;
    yAxisLabel = unit ? `${labels[0]}(${unit})` : labels[0];
  }
  return { data: buildSeriesData(entries), axisLabel: "日づけ", yAxisLabel };
}

// 軸えらび済みデータ用: buildAxisSeries の結果を seriesForAxis と同じ形に揃える
function axisSeriesCompat(entries, xAxis, yLabel) {
  const { data, xName, yName } = buildAxisSeries(entries, xAxis, yLabel);
  return { data, axisLabel: xName, yAxisLabel: yName };
}

// 軸えらびの組み合わせでは点が1つも作れなかったとき(ペアが無い等)の説明。
// 空のグラフを黙って見せると子どもは何が起きたか分からないため、理由と直し方を伝える。
function EmptyAxisNotice({ xAxis, yLabel, compact }) {
  if (compact) {
    return <p className="graph-empty">点が作れなかったグラフだよ</p>;
  }
  if (xAxis?.kind === "label") {
    return (
      <p className="graph-empty">
        「{xAxis.label}」と「{yLabel}」を同じときにはかった記録が見つからなかったよ。
        <br />
        このじくの組み合わせは、1つの記録に2つの数字が入っているときに使えるよ。
        じくをえらびなおしてみてね。
      </p>
    );
  }
  return (
    <p className="graph-empty">
      この組み合わせだと、グラフにできる数字が無かったよ。じくをえらびなおしてみてね。
    </p>
  );
}

// 選んだ数字(entries)を、えらんだ種類(type)で必ず描く。
// 理想形でないデータでも代用ルールで機械的に描画する。
// xAxis + yLabel: 軸えらび(再設計後)。子どもが選んだヨコ軸とタテ軸のラベル。
// xAxisLabel: 旧形式の保存グラフ用(棒・折れ線でヨコ軸に使うラベル。なければ日づけ軸)
// compact: グラフ一覧のサムネイル用に、軸タイトルなどを省いて小さく描く
export default function GraphView({ type, entries, xAxis, yLabel, xAxisLabel, compact = false }) {
  if (!entries || entries.length === 0) {
    return <p className="graph-empty">数字がえらばれていないよ。</p>;
  }
  // 軸えらび済みのデータかどうか(旧形式の保存グラフは xAxis を持たない)
  const hasAxisPick = !!(xAxis && yLabel);

  if (type === "bar" || type === "histogram") {
    const isHist = type === "histogram";
    const series = isHist
      ? null
      : hasAxisPick
        ? axisSeriesCompat(entries, xAxis, yLabel)
        : seriesForAxis(entries, xAxisLabel);
    const data = isHist ? buildHistogramData(entries) : series.data;
    if (!isHist && hasAxisPick && data.length === 0) {
      return <EmptyAxisNotice xAxis={xAxis} yLabel={yLabel} compact={compact} />;
    }
    const xLabel = isHist ? (entries[0]?.label ?? "数字") : series.axisLabel;
    const yLabel_ = isHist ? "件数" : series.yAxisLabel;
    return (
      <ResponsiveContainer width="100%" height={compact ? 130 : 260}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: compact ? 0 : 12, bottom: compact ? 6 : 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#efebda" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            label={!compact && xLabel ? { value: xLabel, position: "insideBottom", offset: -8, fontSize: 11 } : undefined}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            label={!compact && yLabel_ ? { value: yLabel_, angle: -90, position: "insideLeft", fontSize: 11 } : undefined}
          />
          <Tooltip />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={GRAPH_COLORS[i % GRAPH_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line") {
    const { data, axisLabel, yAxisLabel } = hasAxisPick
      ? axisSeriesCompat(entries, xAxis, yLabel)
      : seriesForAxis(entries, xAxisLabel);
    if (hasAxisPick && data.length === 0) {
      return <EmptyAxisNotice xAxis={xAxis} yLabel={yLabel} compact={compact} />;
    }
    return (
      <ResponsiveContainer width="100%" height={compact ? 130 : 260}>
        <LineChart data={data} margin={{ top: 10, right: 12, left: compact ? 0 : 12, bottom: compact ? 6 : 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#efebda" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            label={!compact && axisLabel ? { value: axisLabel, position: "insideBottom", offset: -8, fontSize: 11 } : undefined}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            label={!compact && yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft", fontSize: 11 } : undefined}
          />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#2EC4B6"
            strokeWidth={3}
            dot={{ r: 4, fill: "#2EC4B6" }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === "pie") {
    const data = buildShareData(entries);
    return (
      <ResponsiveContainer width="100%" height={compact ? 130 : 280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={compact ? 50 : 90}
            label={compact ? false : (d) => `${Math.round((d.percent ?? 0) * 100)}%`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={GRAPH_COLORS[i % GRAPH_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          {!compact && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "scatter") {
    const { points, xName, yName } = hasAxisPick
      ? buildAxisScatter(entries, xAxis, yLabel)
      : buildScatterData(entries);
    if (hasAxisPick && points.length === 0) {
      return <EmptyAxisNotice xAxis={xAxis} yLabel={yLabel} compact={compact} />;
    }
    return (
      <ResponsiveContainer width="100%" height={compact ? 130 : 260}>
        <ScatterChart margin={{ top: 10, right: 16, left: compact ? 0 : 12, bottom: compact ? 6 : 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#efebda" />
          <XAxis
            type="number"
            dataKey="x"
            name={xName}
            tick={{ fontSize: 11 }}
            label={!compact ? { value: xName, position: "insideBottom", offset: -8, fontSize: 11 } : undefined}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yName}
            tick={{ fontSize: 11 }}
            label={!compact ? { value: yName, angle: -90, position: "insideLeft", fontSize: 11 } : undefined}
          />
          <ZAxis range={[80, 80]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={points} fill="#8A6FE0" />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  if (type === "band") {
    // 100%積み上げの横帯。1エントリ=1区切り。
    const data = buildShareData(entries);
    const row = { name: "割合" };
    data.forEach((d, i) => {
      row[`k${i}`] = d.value;
    });
    return (
      <ResponsiveContainer width="100%" height={compact ? 90 : 140}>
        <BarChart
          layout="vertical"
          data={[row]}
          margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
        >
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip />
          {!compact && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {data.map((d, i) => (
            <Bar
              key={i}
              dataKey={`k${i}`}
              name={d.name}
              stackId="band"
              fill={GRAPH_COLORS[i % GRAPH_COLORS.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return null;
}
