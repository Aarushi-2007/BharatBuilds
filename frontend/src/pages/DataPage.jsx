import { useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSelectedDate } from "../hooks/useSelectedDate.js";
import StatCard from "../components/ui/StatCard.jsx";
import Badge from "../components/ui/Badge.jsx";
import CardHeader from "../components/ui/CardHeader.jsx";
import { ErrorBox, Spinner } from "../components/ui/Feedback.jsx";
import { IconCalendar, IconClock, IconDatabase, IconRefresh, IconThermo, IconUpload } from "../components/ui/Icons.jsx";
import ChartTooltip from "../components/charts/ChartTooltip.jsx";
import { SERIES, useChartTheme } from "../components/charts/theme.js";

const EDITORS = ["planner", "admin"];

function AccuracyChart({ metrics, current }) {
  const t = useChartTheme();
  const data = Object.entries(metrics).map(([h, m]) => ({ h: `${h}d`, hNum: +h, MAPE: m.MAPE_pct }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={t.grid} />
        <XAxis dataKey="h" tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} unit="%" />
        <Tooltip cursor={{ fill: t.cursor }} content={<ChartTooltip unit="%" labelPrefix="Data age: " />} />
        <Bar dataKey="MAPE" name="Avg. error" radius={[4, 4, 0, 0]} maxBarSize={28}>
          {data.map((d) => <Cell key={d.h} fill={d.hNum === current ? SERIES.orange : SERIES.forecast} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function DataPage() {
  const { user } = useAuth();
  const { status, statusError, reloadStatus } = useSelectedDate();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);
  const canEdit = EDITORS.includes(user?.role);

  const refresh = async (what) => {
    setBusy(what); setMsg(null);
    try {
      const r = await api.refreshData({ weather: what !== "demand", demand: what !== "weather" });
      const parts = [];
      if (r.weather) parts.push(r.weather.ok ? `Weather updated until ${r.weather.until.slice(0, 10)}` : `Weather failed: ${r.weather.error}`);
      if (r.demand) parts.push(r.demand.ok ? `Demand checked: newest ${r.demand.newest.slice(0, 10)} (${r.demand.new_hours} new hours)` : `Demand failed: ${r.demand.error}`);
      setMsg({ ok: (r.weather?.ok ?? true) && (r.demand?.ok ?? true), text: parts.join(" · ") });
      await reloadStatus();
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally { setBusy(""); }
  };

  const upload = async (file) => {
    if (!file) return;
    setBusy("upload"); setMsg(null);
    try {
      const r = await api.uploadData(await file.text());
      setMsg({ ok: true, text: `Uploaded ${r.rows_hourly} hours (${r.from.slice(0, 16)} → ${r.to.slice(0, 16)}).` });
      await reloadStatus();
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally { setBusy(""); if (fileRef.current) fileRef.current.value = ""; }
  };

  if (!status) return statusError ? <ErrorBox message={statusError} onRetry={reloadStatus} /> : <Spinner label="Loading data status…" />;
  const age = status.demand_age_days;
  const ageTone = age <= 1 ? "green" : age <= 4 ? "brand" : age <= 14 ? "amber" : "red";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink dark:text-white">Data</h1>
        <p className="mt-1 text-sm text-ink-muted dark:text-gray-400">
          How fresh the inputs are, how to update them, and how accurate forecasts are for each data age.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-6">
        <StatCard icon={IconDatabase} tone={ageTone} label="Newest demand data" value={status.newest_complete_demand_day}
                  badge={<Badge status={age <= 1 ? "NORMAL" : age <= 14 ? "ELEVATED" : "PEAK RISK"}>{age} day{age === 1 ? "" : "s"} old</Badge>}
                  sub="Fresher data → more accurate forecasts" />
        <StatCard icon={IconThermo} tone="amber" label="Weather available until" value={status.weather_until}
                  sub="Observed + forecast, 11 cities" />
        <StatCard icon={IconCalendar} tone="brand" label="Forecasts possible until" value={status.forecast_range.last}
                  sub="Limited by weather data and by demand data age (max 14 days)" />
        <StatCard icon={IconClock} tone={status.today_available ? "green" : "red"} label={`Today (${status.today})`}
                  value={status.today_available ? "Available" : "Not yet"}
                  sub={status.today_available ? "Live forecast ready on the dashboard"
                       : age > 14 ? "Demand data is over 14 days old: upload newer data" : "Click “Refresh weather” to fetch the forecast"} />
      </div>

      {msg && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${msg.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
          : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"}`}>{msg.text}</div>
      )}

      <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
        <div className="card">
          <CardHeader title="Update live data" subtitle="Fetch the newest weather forecast and demand data" />
          {!canEdit && <p className="mb-4 text-sm text-amber-700 dark:text-amber-300">Only planners and admins can update data.</p>}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-4 dark:bg-night-900">
              <div>
                <p className="font-medium text-ink dark:text-white">Weather forecast</p>
                <p className="text-sm text-ink-muted dark:text-gray-400">Open-Meteo · last 14 days + next 10 days</p>
              </div>
              <button className="btn-outline" disabled={!canEdit || !!busy} onClick={() => refresh("weather")}>
                <IconRefresh className={`h-4 w-4 ${busy === "weather" ? "animate-spin" : ""}`} /> Refresh weather
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-4 dark:bg-night-900">
              <div>
                <p className="font-medium text-ink dark:text-white">Demand (public source)</p>
                <p className="text-sm text-ink-muted dark:text-gray-400">Grid-India daily reports via Grid-Sentinel · 15-min, all-India</p>
              </div>
              <button className="btn-outline" disabled={!canEdit || !!busy} onClick={() => refresh("demand")}>
                <IconRefresh className={`h-4 w-4 ${busy === "demand" ? "animate-spin" : ""}`} /> Refresh demand
              </button>
            </div>
            <div className="rounded-xl border border-dashed border-gray-300 p-4 dark:border-night-600">
              <p className="font-medium text-ink dark:text-white">Upload demand data (CSV)</p>
              <p className="mt-1 text-sm text-ink-muted dark:text-gray-400">
                e.g. an export from your SCADA system. Columns <code className="rounded bg-gray-100 px-1 dark:bg-night-700">datetime,demand_MW</code> (hourly
                or 15-minute, all-India, in MW), or the Grid-India format <code className="rounded bg-gray-100 px-1 dark:bg-night-700">date,time,demand_met_mw</code>.
              </p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
              <button className="btn-primary mt-3" disabled={!canEdit || !!busy} onClick={() => fileRef.current?.click()}>
                <IconUpload className="h-4 w-4" /> {busy === "upload" ? "Uploading…" : "Choose CSV file"}
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <CardHeader title="Accuracy vs. data age" subtitle="Average error on a full test year the models never saw"
                      right={<Badge status="info">current: {age} day{age === 1 ? "" : "s"}</Badge>} />
          <AccuracyChart metrics={status.accuracy_by_horizon} current={age} />
          <p className="mt-3 text-sm text-ink-muted dark:text-gray-400">
            With yesterday's demand data the error is about {status.accuracy_by_horizon["1"]?.MAPE_pct}%; with two-week-old
            data about {status.accuracy_by_horizon["14"]?.MAPE_pct}%. Forecasts need demand data at most 14 days old.
          </p>
        </div>
      </div>

      <div className="card">
        <CardHeader title="Recent activity" subtitle="Refreshes and uploads" />
        {status.recent_activity.length === 0 ? (
          <p className="text-sm text-ink-muted dark:text-gray-400">No refreshes or uploads yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-xs text-ink-muted dark:border-night-700 dark:text-gray-400">
              <th className="pb-2 font-normal">Time (UTC)</th><th className="pb-2 font-normal">Event</th><th className="pb-2 font-normal">Details</th></tr></thead>
            <tbody>
              {status.recent_activity.map((a, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0 dark:border-night-700">
                  <td className="py-2.5 text-ink-soft dark:text-gray-300">{a.time_utc.replace("T", " ").slice(0, 16)}</td>
                  <td className="py-2.5"><Badge status="neutral">{a.event}</Badge></td>
                  <td className="py-2.5 text-ink-muted dark:text-gray-400">
                    {a.event === "upload" ? `${a.rows_hourly} h by ${a.by}` :
                      [a.weather && (a.weather.ok ? "weather ✓" : "weather ✗"), a.demand && (a.demand.ok ? `demand ✓ (${a.demand.new_hours} new h)` : "demand ✗")].filter(Boolean).join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-4 text-xs text-ink-muted dark:text-gray-400">Sources: {status.sources.demand} · {status.sources.weather}</p>
      </div>
    </div>
  );
}
