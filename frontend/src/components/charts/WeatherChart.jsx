import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "./ChartTooltip.jsx";
import { SERIES, useChartTheme } from "./theme.js";

export default function WeatherChart({ hourly, height = 220 }) {
  const t = useChartTheme();
  const data = hourly.map((h) => ({ time: h.time, temp: h.temperature_C, feels: h.feels_like_C }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gFeels" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES.orange} stopOpacity={0.25} />
            <stop offset="100%" stopColor={SERIES.orange} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={t.grid} />
        <XAxis dataKey="time" tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} interval={3} />
        <YAxis tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} unit="°" domain={["dataMin - 2", "dataMax + 2"]} />
        <Tooltip content={<ChartTooltip unit="°C" />} cursor={{ stroke: t.grid }} />
        <Area dataKey="feels" name="Feels like" type="monotone" stroke={SERIES.orange} strokeWidth={2} fill="url(#gFeels)" />
        <Area dataKey="temp" name="Temperature" type="monotone" stroke={SERIES.forecast} strokeWidth={2} fill="none" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
