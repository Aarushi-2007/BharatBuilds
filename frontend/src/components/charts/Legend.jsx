// Simple HTML legend above charts
export default function Legend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-soft dark:text-gray-300">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-2">
          {it.type === "line" ? (
            <span className="h-0.5 w-5 rounded" style={{ background: it.color, borderTop: it.dashed ? `2px dashed ${it.color}` : undefined, height: it.dashed ? 0 : undefined }} />
          ) : (
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}
