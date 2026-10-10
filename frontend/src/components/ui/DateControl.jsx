import { IconCalendar } from "./Icons.jsx";

const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function DateControl({ date, setDate, status }) {
  const range = status?.forecast_range;
  const inRange = (d) => range && d >= range.first && d <= range.last;
  const today = status?.today;
  const quick = today ? [["Today", today], ["Tomorrow", addDays(today, 1)]].filter(([, d]) => inRange(d)) : [];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {quick.length > 0 && (
        <div className="seg">
          {quick.map(([label, d]) => (
            <button key={label} className={`seg-btn ${date === d ? "seg-btn-active" : ""}`} onClick={() => setDate(d)}>{label}</button>
          ))}
        </div>
      )}
      <label className="relative">
        <span className="sr-only">Date</span>
        <IconCalendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <input type="date" className="input h-10 w-[170px] pl-9" value={date || ""}
               min={range?.first} max={range?.last}
               onChange={(e) => e.target.value && setDate(e.target.value)} />
      </label>
      {status?.replay_demo_dates && (
        <select className="input h-10 w-auto pr-8" value=""
                onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Past dates to replay">
          <option value="">Replay a past day…</option>
          {status.replay_demo_dates.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      )}
    </div>
  );
}
