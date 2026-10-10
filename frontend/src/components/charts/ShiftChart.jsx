import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "./ChartTooltip.jsx";
import { SERIES, gw, useChartTheme } from "./theme.js";

// Per hour: flexible load moved OUT (below zero) and moved IN (above zero)
export default function ShiftChart({ hourly, height = 240 }) {
  const t = useChartTheme();
  const data = hourly.map((h) => ({
    time: h.time,
    moved_in: gw(h.moved_in_MW) || null,
    moved_out: h.moved_out_MW ? -gw(h.moved_out_MW) : null,
    curtailed: h.curtailed_MW ? -gw(h.curtailed_MW) : null,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} stackOffset="sign" margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={t.grid} />
        <XAxis dataKey="time" tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} interval={1} />
        <YAxis tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} unit=" GW" width={68} />
        <Tooltip cursor={{ fill: t.cursor }} content={<ChartTooltip />} />
        <ReferenceLine y={0} stroke={t.axis} />
        <Bar dataKey="moved_in" name="Moved in" stackId="s" fill={SERIES.optimized} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="moved_out" name="Moved out" stackId="s" fill={SERIES.orange} radius={[0, 0, 4, 4]} maxBarSize={22} />
        <Bar dataKey="curtailed" name="Reduced" stackId="s" fill={SERIES.peak} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
