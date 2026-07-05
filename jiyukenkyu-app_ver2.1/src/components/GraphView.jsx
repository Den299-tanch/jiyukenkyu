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
  buildShareData,
  buildHistogramData,
  buildScatterData,
} from "../data/graphBuild";

// 選んだ数字(entries)を、えらんだ種類(type)で必ず描く。
// 理想形でないデータでも代用ルールで機械的に描画する。
export default function GraphView({ type, entries }) {
  if (!entries || entries.length === 0) {
    return <p className="graph-empty">数字がえらばれていないよ。</p>;
  }

  if (type === "bar" || type === "histogram") {
    const data = type === "bar" ? buildSeriesData(entries) : buildHistogramData(entries);
    return (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#efebda" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
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
    const data = buildSeriesData(entries);
    return (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#efebda" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
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
