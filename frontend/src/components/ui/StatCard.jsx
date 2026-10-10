export default function StatCard({ icon: Icon, label, value, sub, badge, tone = "brand" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-300",
    red: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  };
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm text-ink-muted dark:text-gray-400">{label}</span>
        {Icon && (
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="text-2xl font-bold tracking-tight text-ink dark:text-white md:text-[28px]">{value}</span>
        {badge}
      </div>
      {sub && <p className="mt-1.5 text-sm text-ink-muted dark:text-gray-400">{sub}</p>}
    </div>
  );
}
