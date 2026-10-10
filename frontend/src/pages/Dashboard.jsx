import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useSelectedDate } from "../hooks/useSelectedDate.js";
import DateControl from "../components/ui/DateControl.jsx";
import ModeBanner from "../components/ui/ModeBanner.jsx";
import StatCard from "../components/ui/StatCard.jsx";
import Badge from "../components/ui/Badge.jsx";
import CardHeader from "../components/ui/CardHeader.jsx";
import { ErrorBox, Spinner } from "../components/ui/Feedback.jsx";
import { IconAlert, IconArrowRight, IconClock, IconEnergy, IconThermo, IconInfo } from "../components/ui/Icons.jsx";
import DemandChart from "../components/charts/DemandChart.jsx";
import WeatherChart from "../components/charts/WeatherChart.jsx";
import HistoryChart from "../components/charts/HistoryChart.jsx";
import Legend from "../components/charts/Legend.jsx";
import { SERIES, useChartTheme } from "../components/charts/theme.js";
import { fmtDate, fmtGW, fmtMW, fmtMWh, fmtShortDate } from "../utils/format.js";

export default function Dashboard() {
  const { date, setDate, status, statusError, reloadStatus } = useSelectedDate();
  const [days, setDays] = useState(1);
  const [active, setActive] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const t = useChartTheme();

  const load = useCallback(() => {
    if (!date) return;
    setLoading(true); setError(null);
    api.dashboard({ date, days })
      .then((d) => { setData(d); setActive(0); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [date, days]);
  useEffect(load, [load]);

  const day = data?.days?.[active];
  const s = day?.summary;

  return (
    <div className="space-y-6">
      {/* page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink dark:text-white">Demand forecast</h1>
          <p className="mt-1 text-sm text-ink-muted dark:text-gray-400">
            All-India hourly demand forecast. Past dates replay history; today and future dates are live forecasts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateControl date={date} setDate={setDate} status={status} />
          <div className="seg" role="tablist" aria-label="Number of days">
            {[1, 3, 7].map((n) => (
              <button key={n} className={`seg-btn ${days === n ? "seg-btn-active" : ""}`} onClick={() => setDays(n)}>
                {n === 1 ? "1 day" : `${n} days`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {statusError && !date && <ErrorBox message={statusError} onRetry={reloadStatus} />}
      {error && <ErrorBox message={error} onRetry={load} />}
      {loading && !data && !statusError && <Spinner label="Running the forecast…" />}

      {day && (
        <>
          <ModeBanner day={day} />

          {/* multi-day tabs */}
          {data.days.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {data.days.map((d, i) => (
                <button key={d.date} onClick={() => setActive(i)}
                        className={`min-w-[150px] rounded-xl border px-4 py-3 text-left transition ${
                          i === active ? "border-brand-500 bg-brand-25 dark:bg-brand-500/10"
                                       : "border-gray-200 bg-white hover:border-brand-300 dark:border-night-700 dark:bg-night-800"}`}>
                  <p className="text-sm font-medium text-ink dark:text-white">{d.weekday.slice(0, 3)}, {fmtShortDate(d.date)}</p>
                  <p className="mt-0.5 text-xs text-ink-muted dark:text-gray-400">Peak {fmtGW(d.summary.forecast_peak_MW)}</p>
                  <Badge status={d.summary.status} className="mt-2" />
                </button>
              ))}
            </div>
          )}

          {/* stat cards */}
          <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-6 ${loading ? "opacity-60" : ""}`}>
            <StatCard icon={IconAlert} tone={s.status === "PEAK RISK" ? "red" : s.status === "ELEVATED" ? "amber" : "green"}
                      label="Forecast peak" value={fmtGW(s.forecast_peak_MW)}
                      badge={<Badge status={s.status} />} sub={`at ${s.forecast_peak_time} · limit ${fmtGW(day.threshold_MW)}`} />
            <StatCard icon={IconClock} tone={s.hours_over_limit ? "red" : "green"} label="Hours over the limit"
                      value={`${s.hours_over_limit} h`} sub={`+ ${s.hours_elevated} h elevated (within 5%)`} />
            <StatCard icon={IconEnergy} tone="brand" label="Energy above the limit"
                      value={fmtMWh(s.energy_over_limit_MWh)} sub={`of ${fmtMWh(s.daily_energy_MWh)} total for the day`} />
            <StatCard icon={IconThermo} tone="amber" label="Max temperature"
                      value={`${s.max_temperature_C}°C`} sub={`feels like ${s.max_feels_like_C}°C (11-city avg) · north ${s.max_feels_north_C}°C`} />
          </div>

          {/* main chart */}
          <div className="card">
            <CardHeader
              title="Hourly demand forecast"
              subtitle={`${fmtDate(day.date)} · All-India`}
              right={s.hours_over_limit > 0 && (
                <Link to={`/optimization?date=${day.date}`} className="btn-primary">
                  View optimisation plan <IconArrowRight className="h-4 w-4" />
                </Link>
              )}
            />
            <div className="mb-4">
              <Legend items={[
                { label: "Forecast (normal)", color: SERIES.forecast },
                { label: "Forecast (elevated)", color: SERIES.elevated },
                { label: "Forecast (peak risk)", color: SERIES.peak },
                { label: "Actual demand", color: t.ink, type: "line" },
                { label: "Grid limit", color: SERIES.limit, type: "line", dashed: true },
              ]} />
            </div>
            <DemandChart hourly={day.hourly} threshold={day.threshold_MW} warning={day.warning_MW} />
            <p className="mt-3 flex items-center gap-2 text-xs text-ink-muted dark:text-gray-400">
              <IconInfo className="h-4 w-4 shrink-0" /> {day.model_used} · grid limit = {data.threshold_rule.toLowerCase()}
            </p>
          </div>

          {/* peak events + accuracy + weather */}
          <div className="grid gap-4 md:gap-6 xl:grid-cols-3">
            <div className="card">
              <CardHeader title="Peak-risk periods" subtitle="Consecutive hours forecast above the limit" />
              {day.peak_events.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Badge status="NORMAL">No peaks forecast</Badge>
                  <p className="text-sm text-ink-muted dark:text-gray-400">Demand stays under the grid limit all day.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs text-ink-muted dark:border-night-700 dark:text-gray-400">
                      <th className="pb-3 font-normal">Window</th><th className="pb-3 font-normal">Hours</th>
                      <th className="pb-3 text-right font-normal">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.peak_events.map((e) => (
                      <tr key={e.start} className="border-b border-gray-100 last:border-0 dark:border-night-700">
                        <td className="py-3 font-medium text-ink dark:text-white">{e.start} – {e.end}</td>
                        <td className="py-3 text-ink-soft dark:text-gray-300">{e.duration_h} h</td>
                        <td className="py-3 text-right text-ink-soft dark:text-gray-300">{fmtGW(e.max_forecast_MW)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card">
              <CardHeader title="Forecast accuracy"
                          subtitle={day.accuracy ? "Compared with what actually happened" : "Expected accuracy for this forecast"} />
              {day.accuracy ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {[["Avg. error (MAE)", fmtMW(day.accuracy.MAE_MW)], ["Avg. error %", `${day.accuracy.MAPE_pct}%`],
                      ["Actual peak", fmtGW(day.accuracy.actual_peak_MW)], ["Actual hours over limit", `${day.accuracy.actual_hours_over_limit} h`]]
                      .map(([k, v]) => (
                        <div key={k} className="rounded-xl bg-gray-50 p-3 dark:bg-night-900">
                          <p className="text-xs text-ink-muted dark:text-gray-400">{k}</p>
                          <p className="mt-1 text-lg font-semibold text-ink dark:text-white">{v}</p>
                        </div>
                      ))}
                  </div>
                  <div className="mt-4">
                    {day.in_sample
                      ? <Badge status="ELEVATED">Model trained on this date: accuracy looks better than real-life</Badge>
                      : <Badge status="info">Honest test: model never saw this date</Badge>}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {[["Typical error", fmtMW(day.expected_error?.MAE_MW)], ["Typical error %", `${day.expected_error?.MAPE_pct ?? "—"}%`],
                      ["Forecast horizon", `${day.horizon_days} day${day.horizon_days > 1 ? "s" : ""}`], ["Newest demand data", day.last_demand_date]]
                      .map(([k, v]) => (
                        <div key={k} className="rounded-xl bg-gray-50 p-3 dark:bg-night-900">
                          <p className="text-xs text-ink-muted dark:text-gray-400">{k}</p>
                          <p className="mt-1 text-lg font-semibold text-ink dark:text-white">{v}</p>
                        </div>
                      ))}
                  </div>
                  <p className="mt-4 text-xs text-ink-muted dark:text-gray-400">
                    Measured on a full year the model never saw. Fresher demand data → smaller error (see the Data page).
                  </p>
                </>
              )}
            </div>

            <div className="card">
              <CardHeader title="Weather" subtitle="Average of 11 cities across India" />
              <div className="mb-2">
                <Legend items={[{ label: "Temperature", color: SERIES.forecast, type: "line" }, { label: "Feels like", color: SERIES.orange, type: "line" }]} />
              </div>
              <WeatherChart hourly={day.hourly} />
            </div>
          </div>

          {/* history + hourly table */}
          <div className="grid gap-4 md:gap-6 xl:grid-cols-5">
            <div className="card xl:col-span-3">
              <CardHeader title="Last 14 days" subtitle="Actual daily peak demand before the selected date (gaps = no data)" />
              <div className="mb-3">
                <Legend items={[{ label: "Under limit", color: SERIES.forecast }, { label: "Crossed limit", color: SERIES.peak },
                                { label: "Grid limit", color: SERIES.limit, type: "line", dashed: true }]} />
              </div>
              {data.recent_history.length ? <HistoryChart history={data.recent_history} threshold={data.threshold_MW} />
                : <p className="py-10 text-center text-sm text-ink-muted dark:text-gray-400">No demand data for the 14 days before this date.</p>}
            </div>
            <div className="card xl:col-span-2">
              <CardHeader title="Hourly breakdown" subtitle="Forecast vs actual, with risk level" />
              <div className="max-h-[300px] overflow-y-auto pr-1">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-night-800">
                    <tr className="border-b border-gray-200 text-left text-xs text-ink-muted dark:border-night-700 dark:text-gray-400">
                      <th className="pb-2 font-normal">Time</th><th className="pb-2 text-right font-normal">Forecast</th>
                      <th className="pb-2 text-right font-normal">Actual</th><th className="pb-2 pl-3 font-normal">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.hourly.map((h) => (
                      <tr key={h.time} className="border-b border-gray-100 last:border-0 dark:border-night-700">
                        <td className="py-2 font-medium text-ink dark:text-white">{h.time}</td>
                        <td className="py-2 text-right tabular-nums text-ink-soft dark:text-gray-300">{fmtGW(h.forecast_MW)}</td>
                        <td className="py-2 text-right tabular-nums text-ink-soft dark:text-gray-300">{fmtGW(h.actual_MW)}</td>
                        <td className="py-2 pl-3"><Badge status={h.risk} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
