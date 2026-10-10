// Tooltip card shown when hovering a chart
export default function ChartTooltip({ active, payload, label, unit = "GW", labelPrefix = "", extra }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="min-w-[180px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-lg dark:border-night-600 dark:bg-night-800">
      <p className="mb-1.5 font-medium text-ink dark:text-white">{labelPrefix}{label}</p>
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-2 text-ink-muted dark:text-gray-400">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.payload?.fill || p.color || p.stroke }} />
            {p.name}
          </span>
          <span className="font-medium tabular-nums text-ink dark:text-white">
            {typeof p.value === "number" ? p.value.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : p.value} {unit}
          </span>
        </div>
      ))}
      {extra && extra(row)}
    </div>
  );
}
