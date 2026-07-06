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
} from "../data/graphBuild";

// 棒・折れ線のヨコ軸データを決める。
// xAxisLabel が指定されていて、選んだ数字がちょうど2ラベルなら「ペア」でヨコ軸を作る。
// それ以外(1ラベル・軸未指定・ペアが作れない)は今までどおり日づけ(observed_at)軸。
function seriesForAxis(entries, xAxisLabel) {
  const labels = [...new Set(entries.map((e) => e.label))];
  if (xAxisLabel && labels.length === 2) {
    const yLabel = labels.find((l) => l !== xAxisLabel);
    const paired = buildPairedSeriesData(entries, xAxisLabel, yLabel);
    if (paired.length > 0) return { data: paired, axisLabel: xAxisLabel };
  }
  return { data: buildSeriesData(entries), axisLabel: null };
}

// 選んだ数字(entries)を、えらんだ種類(type)で必ず描く。
// 理想形でないデータでも代用ルールで機械的に描画する。
// xAxisLabel: 棒・折れ線でヨコ軸に使うラベル(なければ日づけ軸)
export default function GraphView({ type, entries, xAxisLabel }) {
  if (!entries || entries.length === 0) {
    return <p className="graph-empty">数字がえらばれていないよ。</p>;
  }

  if (type === "bar" || type === "histogram") {
    const isHist = type === "histogram";
    const series = isHist ? null : seriesForAxis(entries, xAxisLabel);
    const data = isHist ? buildHistogramData(entries) : series.data;
    return (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: series?.axisLabel ? 24 : 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#efebda" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            label={series?.axisLabel ? { value: series.axisLabel, position: "insideBottom", offset: -8, fontSize: 11 } : undefined}
          />
          <YAxis tick={{ fontSize: 11 }} />
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
    const { data, axisLabel } = seriesForAxis(entries, xAxisLabel);
    return (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: axisLabel ? 24 : 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#efebda" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            label={axisLabel ? { value: axisLabel, position: "insideBottom", offset: -8, fontSize: 11 } : undefined}
          />
          <YAxis tick={{ fontSize: 11 }} />
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
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            label={(d) => `${Math.round((d.percent ?? 0) * 100)}%`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={GRAPH_COLORS[i % GRAPH_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "scatter") {
    const { points, xName, yName } = buildScatterData(entries);
    return (
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 10, right: 16, left: 0, bottom: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#efebda" />
          <XAxis
            type="number"
            dataKey="x"
            name={xName}
            tick={{ fontSize: 11 }}
            label={{ value: xName, position: "insideBottom", offset: -8, fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yName}
            tick={{ fontSize: 11 }}
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
      <ResponsiveContainer width="100%" height={140}>
        <BarChart
          layout="vertical"
          data={[row]}
          margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
        >
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
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
