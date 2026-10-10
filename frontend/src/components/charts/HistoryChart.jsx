import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "./ChartTooltip.jsx";
import { SERIES, gw, useChartTheme } from "./theme.js";
import { fmtShortDate } from "../../utils/format.js";

// Daily peak demand for the 14 days before the selected date
export default function HistoryChart({ history, threshold, height = 240 }) {
  const t = useChartTheme();
  const data = history.map((d) => ({ ...d, label: fmtShortDate(d.date), peak: gw(d.peak_MW),
                                     fill: d.over_limit ? SERIES.peak : SERIES.forecast }));
  const min = Math.floor(Math.min(...data.map((d) => d.peak)) * 0.85 / 5) * 5;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={t.grid} />
        <XAxis dataKey="label" tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} interval={1} />
        <YAxis domain={[min, "auto"]} tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} unit=" GW" width={68} />
        <Tooltip cursor={{ fill: t.cursor }} content={<ChartTooltip />} />
        <ReferenceLine y={threshold / 1000} stroke={SERIES.limit} strokeDasharray="6 4" strokeWidth={1.5} />
        <Bar dataKey="peak" name="Daily peak" radius={[4, 4, 0, 0]} maxBarSize={26}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
