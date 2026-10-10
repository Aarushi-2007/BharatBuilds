import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useSelectedDate } from "../hooks/useSelectedDate.js";
import DateControl from "../components/ui/DateControl.jsx";
import ModeBanner from "../components/ui/ModeBanner.jsx";
import StatCard from "../components/ui/StatCard.jsx";
import Badge from "../components/ui/Badge.jsx";
import CardHeader from "../components/ui/CardHeader.jsx";
import { ErrorBox, Spinner } from "../components/ui/Feedback.jsx";
import { IconAlert, IconArrowRight, IconCheck, IconClock, IconInfo, IconShuffle, IconTrendDown } from "../components/ui/Icons.jsx";
import PlanChart from "../components/charts/PlanChart.jsx";
import ShiftChart from "../components/charts/ShiftChart.jsx";
import Legend from "../components/charts/Legend.jsx";
import { SERIES } from "../components/charts/theme.js";
import { fmtDate, fmtGW, fmtMW, fmtMWh, fmtNum } from "../utils/format.js";

const DEFAULTS = { flex_share: 0.1, max_shift_hours: 3, safety_margin_mw: 5000, curtail_share: 0.02 };

function Slider({ label, hint, value, display, min, max, step, onChange }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="label mb-0">{label}</label>
        <span className="text-sm font-semibold text-brand-500 dark:text-brand-300">{display}</span>
      </div>
      <input type="range" className="mt-2 w-full" min={min} max={max} step={step} value={value}
             onChange={(e) => onChange(Number(e.target.value))} />
      <p className="mt-1 text-xs text-ink-muted dark:text-gray-400">{hint}</p>
    </div>
  );
}

export default function Optimization() {
  const { date, setDate, status, statusError, reloadStatus } = useSelectedDate();
  const [params, setParams] = useState(DEFAULTS);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);

  const load = useCallback(() => {
    if (!date) return;
    setLoading(true); setError(null);
    api.optimization({ date, ...params })
      .then(setPlan)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [date, params]);

  // re-run the optimiser shortly after the user stops moving a slider
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(load, 300);
    return () => clearTimeout(timer.current);
  }, [load]);

  const set = (k) => (v) => setParams((p) => ({ ...p, [k]: v }));
  const s = plan?.summary;
  const r = plan?.replay_check;

  const solved = s && s.hours_over_threshold_after === 0;
  const noAction = s && s.hours_over_threshold_before === 0 && s.energy_shifted_MWh === 0;
  const banner = noAction ? { tone: "NORMAL", icon: IconCheck, title: "No action needed" }
    : solved ? { tone: "NORMAL", icon: IconCheck, title: "Plan keeps every hour under the limit" }
    : { tone: "ELEVATED", icon: IconAlert, title: "Partial relief: extra measures needed" };
  const bannerCls = { NORMAL: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
                      ELEVATED: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200" };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink dark:text-white">Optimisation plan</h1>
          <p className="mt-1 text-sm text-ink-muted dark:text-gray-400">
            How to shift flexible load so tomorrow stays under the grid limit. Essential load is never touched.
          </p>
        </div>
        <DateControl date={date} setDate={setDate} status={status} />
      </div>

      <div className="grid gap-4 md:gap-6 xl:grid-cols-4">
        {/* controls */}
        <div className="card space-y-6 self-start xl:sticky xl:top-[100px] xl:col-span-1">
          <div>
            <h3 className="card-title">Plan settings</h3>
            <p className="card-sub">The plan updates as you move the sliders.</p>
          </div>
          <Slider label="Flexible load" display={`${Math.round(params.flex_share * 100)}%`}
                  hint="Share of each hour's demand that can be moved (pumps, EV charging, water heating, pre-cooling). Scenario assumption."
                  value={params.flex_share} min={0} max={0.3} step={0.01} onChange={set("flex_share")} />
          <Slider label="Max shift" display={`${params.max_shift_hours} h`}
                  hint="Comfort rule: how many hours earlier or later a load may run."
                  value={params.max_shift_hours} min={1} max={6} step={1} onChange={set("max_shift_hours")} />
          <Slider label="Safety margin" display={fmtMW(params.safety_margin_mw)}
                  hint="Plan this far below the limit to absorb forecast error (≈ 5,000 MW is the model's typical 1-day-ahead error nationally)."
                  value={params.safety_margin_mw} min={0} max={15000} step={500} onChange={set("safety_margin_mw")} />
          <Slider label="Max reduction" display={`${(params.curtail_share * 100).toFixed(0)}%`}
                  hint="Demand that may be reduced outright. Only used if an energy budget requires it."
                  value={params.curtail_share} min={0} max={0.05} step={0.01} onChange={set("curtail_share")} />
          <button className="btn-outline w-full" onClick={() => setParams(DEFAULTS)}>Reset to defaults</button>
        </div>

        {/* results */}
        <div className="space-y-4 md:space-y-6 xl:col-span-3">
          {statusError && !date && <ErrorBox message={statusError} onRetry={reloadStatus} />}
          {error && <ErrorBox message={error} onRetry={load} />}
          {loading && !plan && !statusError && <Spinner label="Optimising…" />}

          {plan?.status === "infeasible" && (
            <div className="card border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="font-medium text-amber-800 dark:text-amber-200">No feasible plan</p>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{plan.message}</p>
            </div>
          )}

          {plan?.status === "ok" && (
            <div className={`space-y-4 md:space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
              <ModeBanner day={plan} />
              <div className={`flex items-start gap-3 rounded-2xl border p-4 ${bannerCls[banner.tone]}`}>
                <banner.icon className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">{banner.title} · {fmtDate(plan.date)}</p>
                  <p className="mt-0.5 text-sm opacity-90">{plan.headline}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                <StatCard icon={IconTrendDown} tone="green" label="Peak demand"
                          value={`${fmtGW(s.original_peak_MW)} → ${fmtGW(s.optimized_peak_MW)}`}
                          sub={`${fmtNum(s.peak_reduction_MW)} MW lower (${s.peak_reduction_pct}%)`} />
                <StatCard icon={IconClock} tone={solved ? "green" : "amber"} label="Hours over the limit"
                          value={`${s.hours_over_threshold_before} → ${s.hours_over_threshold_after}`}
                          sub={`Energy above limit: ${fmtMWh(s.energy_over_threshold_before_MWh)} → ${fmtMWh(s.energy_over_threshold_after_MWh)}`} />
                <StatCard icon={IconShuffle} tone="brand" label="Load shifted"
                          value={fmtMWh(s.energy_shifted_MWh)}
                          sub={`${fmtNum(plan.actions.filter((a) => a.direction !== "reduce").length)} actions · total energy unchanged`} />
                <StatCard icon={IconInfo} tone="amber" label="Comfort cost"
                          value={`${fmtNum(s.delay_MW_hours / 1000, 1)} GW·h`}
                          sub={s.energy_curtailed_MWh > 0 ? `+ ${fmtMWh(s.energy_curtailed_MWh)} reduced` : "MW moved × hours delayed"} />
              </div>

              <div className="card">
                <CardHeader title="Demand: forecast vs plan" subtitle="Orange = what the forecast says will happen · green = if the plan is followed" />
                <div className="mb-4">
                  <Legend items={[
                    { label: "Forecast", color: SERIES.orange, type: "line", dashed: true },
                    { label: "With plan", color: SERIES.optimized, type: "line" },
                    { label: "Grid limit", color: SERIES.limit, type: "line", dashed: true },
                    { label: "Planning target (limit − margin)", color: SERIES.warning, type: "line", dashed: true },
                  ]} />
                </div>
                <PlanChart threshold={plan.threshold_MW} target={plan.target_MW}
                           rows={plan.hourly.map((h) => ({ time: h.time, before: h.forecast_MW, after: h.optimized_MW }))} />
              </div>

              <div className="grid gap-4 md:gap-6 2xl:grid-cols-2">
                <div className="card">
                  <CardHeader title="Where the load goes" subtitle="Below zero: moved out of the hour · above zero: moved in" />
                  <div className="mb-3">
                    <Legend items={[{ label: "Moved in", color: SERIES.optimized }, { label: "Moved out", color: SERIES.orange },
                                    ...(s.energy_curtailed_MWh > 0 ? [{ label: "Reduced", color: SERIES.peak }] : [])]} />
                  </div>
                  <ShiftChart hourly={plan.hourly} />
                </div>

                <div className="card">
                  <CardHeader title="Action plan" subtitle="Instructions to issue, largest first"
                              right={<Badge status="info">{plan.actions.length} actions</Badge>} />
                  {plan.actions.length === 0 ? (
                    <p className="py-8 text-center text-sm text-ink-muted dark:text-gray-400">Nothing to do: the forecast stays under the limit.</p>
                  ) : (
                    <div className="max-h-[260px] overflow-y-auto pr-1">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white dark:bg-night-800">
                          <tr className="border-b border-gray-200 text-left text-xs text-ink-muted dark:border-night-700 dark:text-gray-400">
                            <th className="pb-2 font-normal">From</th><th className="pb-2 font-normal">To</th>
                            <th className="pb-2 font-normal">Shift</th><th className="pb-2 text-right font-normal">Load</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plan.actions.map((a, i) => (
                            <tr key={i} className="border-b border-gray-100 last:border-0 dark:border-night-700" title={a.text}>
                              <td className="py-2.5 font-medium text-ink dark:text-white">{a.from}</td>
                              <td className="py-2.5 text-ink-soft dark:text-gray-300">
                                {a.to ? <span className="flex items-center gap-1.5"><IconArrowRight className="h-3.5 w-3.5 text-ink-faint" />{a.to}</span> : "—"}
                              </td>
                              <td className="py-2.5">
                                <Badge status={a.direction === "reduce" ? "PEAK RISK" : a.direction === "earlier" ? "info" : "neutral"}>
                                  {a.direction === "reduce" ? "reduce" : `${a.direction}`}
                                </Badge>
                              </td>
                              <td className="py-2.5 text-right font-medium tabular-nums text-ink dark:text-white">{fmtMW(a.MW)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {r && (
                <div className="card">
                  <CardHeader title="Reality check" subtitle="The same moves applied to what actually happened that day (forecasts are never perfect)" />
                  <div className="mb-4 grid gap-3 sm:grid-cols-3">
                    {[["Actual peak", `${fmtGW(r.actual_peak_MW)} → ${fmtGW(r.actual_peak_with_plan_MW)}`],
                      ["Energy above limit", `${fmtMWh(r.actual_energy_over_limit_MWh)} → ${fmtMWh(r.with_plan_energy_over_limit_MWh)}`],
                      ["Hours above limit", `${r.actual_hours_over_limit} → ${r.with_plan_hours_over_limit}`]].map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-gray-50 p-3 dark:bg-night-900">
                        <p className="text-xs text-ink-muted dark:text-gray-400">{k}</p>
                        <p className="mt-1 text-lg font-semibold text-ink dark:text-white">{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mb-3">
                    <Legend items={[{ label: "Actual demand", color: SERIES.orange, type: "line", dashed: true },
                                    { label: "Actual with plan", color: SERIES.optimized, type: "line" },
                                    { label: "Grid limit", color: SERIES.limit, type: "line", dashed: true }]} />
                  </div>
                  <PlanChart threshold={plan.threshold_MW} before="Actual" after="Actual with plan" height={280}
                             rows={plan.hourly.map((h, i) => ({ time: h.time, before: r.hourly_actual_MW[i], after: r.hourly_actual_with_plan_MW[i] }))} />
                </div>
              )}

              <div className="card">
                <h3 className="card-title">Notes</h3>
                <ul className="mt-3 space-y-2 text-sm text-ink-muted dark:text-gray-400">
                  {plan.notes.map((n) => <li key={n} className="flex gap-2"><IconInfo className="mt-0.5 h-4 w-4 shrink-0" />{n}</li>)}
                  <li className="flex gap-2"><IconInfo className="mt-0.5 h-4 w-4 shrink-0" />{plan.model_used}</li>
                </ul>
                <Link to={`/dashboard?date=${plan.date}`} className="btn-outline mt-5">← Back to the forecast</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
