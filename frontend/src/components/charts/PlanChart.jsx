import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "./ChartTooltip.jsx";
import { SERIES, niceTicks, gw, useChartTheme } from "./theme.js";

// Before (forecast) vs after (optimised plan), or actual vs actual-with-plan
export default function PlanChart({ rows, threshold, target, before = "Forecast", after = "With plan", height = 340 }) {
  const t = useChartTheme();
  const data = rows.map((r) => ({ time: r.time, before: gw(r.before), after: gw(r.after) }));
  const vals = data.flatMap((d) => [d.before, d.after]);
  const lo = Math.floor(Math.min(...vals) * 0.92 / 5) * 5;
  const hi = Math.ceil(Math.max(...vals, threshold / 1000) * 1.03 / 5) * 5;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gAfter" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES.optimized} stopOpacity={0.28} />
            <stop offset="100%" stopColor={SERIES.optimized} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={t.grid} />
        <XAxis dataKey="time" tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} interval={1} />
        <YAxis domain={[lo, hi]} ticks={niceTicks(lo, hi)} tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} unit=" GW" width={68} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: t.grid }} />
        {target != null && target < threshold && (
          <ReferenceLine y={target / 1000} stroke={SERIES.warning} strokeDasharray="2 4" strokeWidth={1.5} />
        )}
        <ReferenceLine y={threshold / 1000} stroke={SERIES.limit} strokeDasharray="6 4" strokeWidth={1.5} />
        <Area dataKey="after" name={after} type="monotone" stroke={SERIES.optimized} strokeWidth={2.5} fill="url(#gAfter)"
              activeDot={{ r: 4 }} />
        <Line dataKey="before" name={before} type="monotone" stroke={SERIES.orange} strokeWidth={2} dot={false}
              strokeDasharray="5 4" activeDot={{ r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
