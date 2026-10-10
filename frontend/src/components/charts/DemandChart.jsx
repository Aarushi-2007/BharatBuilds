import { Bar, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import ChartTooltip from "./ChartTooltip.jsx";
import { SERIES, niceTicks, gw, riskColor, useChartTheme } from "./theme.js";

// Forecast bars (coloured by risk) + actual demand line + grid-limit lines
export default function DemandChart({ hourly, threshold, warning, height = 340 }) {
  const t = useChartTheme();
  const data = hourly.map((h) => ({ ...h, forecast: gw(h.forecast_MW), actual: gw(h.actual_MW), fill: riskColor(h.risk) }));
  const vals = data.flatMap((d) => [d.forecast, d.actual]).filter((v) => v != null);
  const lo = Math.floor(Math.min(...vals, threshold / 1000) * 0.9 / 5) * 5;
  const hi = Math.ceil(Math.max(...vals, threshold / 1000) * 1.03 / 5) * 5;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={t.grid} />
        <XAxis dataKey="time" tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} interval={1} />
        <YAxis domain={[lo, hi]} ticks={niceTicks(lo, hi)} tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} unit=" GW" width={68} />
        <Tooltip cursor={{ fill: t.cursor }}
                 content={<ChartTooltip extra={(r) => (
                   <p className="mt-1.5 border-t border-gray-100 pt-1.5 text-xs text-ink-muted dark:border-night-600 dark:text-gray-400">
                     Risk: <b style={{ color: r.fill }}>{r.risk}</b> · {r.temperature_C}°C (feels {r.feels_like_C}°C)
                   </p>)} />} />
        <ReferenceLine y={warning / 1000} stroke={SERIES.warning} strokeDasharray="2 4" strokeWidth={1.5} />
        <ReferenceLine y={threshold / 1000} stroke={SERIES.limit} strokeDasharray="6 4" strokeWidth={1.5} />
        <Bar dataKey="forecast" name="Forecast" radius={[4, 4, 0, 0]} maxBarSize={22}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Bar>
        <Line dataKey="actual" name="Actual" type="monotone" stroke={t.ink} strokeWidth={2} dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: t.dark ? "#101828" : "#fff" }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
