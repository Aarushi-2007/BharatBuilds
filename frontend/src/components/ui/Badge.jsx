// Status badges: colour + text label (never colour alone)
const STYLES = {
  "PEAK RISK": "bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/15 dark:text-red-300",
  ELEVATED: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300",
  NORMAL: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/15 dark:text-emerald-300",
  info: "bg-brand-50 text-brand-600 ring-brand-500/15 dark:bg-brand-500/15 dark:text-brand-300",
  neutral: "bg-gray-100 text-ink-soft ring-gray-500/10 dark:bg-night-700 dark:text-gray-300",
};
const DOT = { "PEAK RISK": "bg-red-500", ELEVATED: "bg-amber-500", NORMAL: "bg-emerald-500" };

export default function Badge({ status = "neutral", children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status] || STYLES.neutral} ${className}`}>
      {DOT[status] && <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />}
      {children ?? status}
    </span>
  );
}
