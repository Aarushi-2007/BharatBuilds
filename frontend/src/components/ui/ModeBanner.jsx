import Badge from "./Badge.jsx";
import { IconInfo } from "./Icons.jsx";
import { fmtGW } from "../../utils/format.js";

// Explains where a forecast comes from: LIVE (future) or REPLAY (past, checked against reality)
export default function ModeBanner({ day }) {
  if (!day) return null;
  const live = day.mode === "live";
  const err = day.expected_error;
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3 text-sm ${
      live ? "border-brand-200 bg-brand-25 dark:border-brand-500/30 dark:bg-brand-500/10"
           : "border-gray-200 bg-white dark:border-night-700 dark:bg-night-800"}`}>
      <Badge status={live ? "info" : "neutral"}>{live ? "● LIVE FORECAST" : "REPLAY"}</Badge>
      <span className="text-ink-soft dark:text-gray-300">
        {live
          ? <>Forecast made {day.horizon_days} day{day.horizon_days > 1 ? "s" : ""} ahead from demand data up to <b>{day.last_demand_date}</b> and the weather forecast.</>
          : <>Past day: forecast made the evening before, shown next to what actually happened.</>}
      </span>
      {err?.MAE_MW && (
        <span className="flex items-center gap-1.5 text-ink-muted dark:text-gray-400">
          <IconInfo className="h-4 w-4" /> Typical error at this horizon: ±{fmtGW(err.MAE_MW)} ({err.MAPE_pct}%)
        </span>
      )}
    </div>
  );
}
