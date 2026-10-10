export function Spinner({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-ink-muted dark:text-gray-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="card border-red-200 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/10">
      <p className="font-medium text-red-700 dark:text-red-300">Something went wrong</p>
      <p className="mt-1 text-sm text-red-600 dark:text-red-300/80">{message}</p>
      {onRetry && <button className="btn-outline mt-4" onClick={onRetry}>Try again</button>}
    </div>
  );
}
