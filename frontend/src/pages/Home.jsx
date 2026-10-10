import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { Logo } from "../components/layout/Sidebar.jsx";
import { IconAlert, IconArrowRight, IconBolt, IconMoon, IconShuffle, IconSun, IconTrendDown, IconCheck, IconDatabase, IconGrid } from "../components/ui/Icons.jsx";

const STEP_ICONS = [IconTrendDown, IconAlert, IconShuffle, IconCheck];
const FALLBACK_STEPS = [
  { step: 1, title: "Forecast", text: "An XGBoost model predicts demand for each hour of tomorrow from recent demand and the weather forecast." },
  { step: 2, title: "Detect peaks", text: "Hours above the grid limit are flagged PEAK RISK; hours close to it are ELEVATED." },
  { step: 3, title: "Optimise", text: "A linear-programming optimiser shifts flexible load out of peak hours without touching essential services." },
  { step: 4, title: "Act", text: "Authority staff review the plan, adjust assumptions and issue instructions." },
];

const FEATURES = [
  { icon: IconTrendDown, title: "Hourly demand forecast", tint: "bg-gradient-to-br from-brand-500 to-violet-500",
    text: "Weather-aware XGBoost models predict every hour of the next 1–14 days from recent demand and city forecasts." },
  { icon: IconAlert, title: "Peak-risk alerts", tint: "bg-gradient-to-br from-amber-500 to-rose-500",
    text: "Hours above the rolling grid limit are flagged PEAK RISK; hours within 5% are marked ELEVATED." },
  { icon: IconShuffle, title: "Load-shifting optimiser", tint: "bg-gradient-to-br from-emerald-500 to-cyan-500",
    text: "Linear programming moves flexible load out of peak hours while essential services stay untouched." },
  { icon: IconDatabase, title: "Live data & uploads", tint: "bg-gradient-to-br from-sky-500 to-brand-500",
    text: "Pull the latest Grid-India reports automatically, or upload your own CSV to extend the history." },
  { icon: IconGrid, title: "Replay past days", tint: "bg-gradient-to-br from-violet-500 to-fuchsia-500",
    text: "Pick any past date to compare forecast against actual demand and check accuracy yourself." },
  { icon: IconCheck, title: "Built for authorities", tint: "bg-gradient-to-br from-brand-600 to-brand-400",
    text: "Secure operator login, a dark mode for control rooms and plans you can review before acting." },
];

/** Decorative dashboard preview: an illustrative demand curve crossing the grid limit. */
function HeroPreview({ da }) {
  const curve = "M0 150 C40 140 60 120 100 118 S160 150 200 110 S260 30 310 36 S380 60 420 100 S470 140 520 130";
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-brand-500/20 to-cyan-400/20 blur-2xl" />
      <div className="card relative !p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-ink dark:text-white">Demand forecast</p>
            <p className="text-xs text-ink-muted dark:text-gray-400">All-India · next 24 hours (illustrative)</p>
          </div>
          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">Peak risk</span>
        </div>
        <svg viewBox="0 0 520 180" className="mt-4 w-full">
          <defs>
            <linearGradient id="hp-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#465fff" stopOpacity="0.35" /><stop offset="1" stopColor="#465fff" stopOpacity="0" /></linearGradient>
            <linearGradient id="hp-line" x1="0" x2="1"><stop stopColor="#465fff" /><stop offset="1" stopColor="#12c2e9" /></linearGradient>
          </defs>
          {[40, 80, 120, 160].map((y) => <line key={y} x1="0" x2="520" y1={y} y2={y} className="stroke-gray-200 dark:stroke-night-700" strokeDasharray="3 5" />)}
          <line x1="0" x2="520" y1="62" y2="62" stroke="#f04438" strokeWidth="1.5" strokeDasharray="6 4" />
          <text x="8" y="54" fontSize="11" fill="#f04438">Grid limit</text>
          <path d={`${curve} L520 180 L0 180Z`} fill="url(#hp-fill)" />
          <path d={curve} fill="none" stroke="url(#hp-line)" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="310" cy="36" r="6" fill="#fff" stroke="#f04438" strokeWidth="3" />
        </svg>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[["Peak hours", "Flagged"], ["Load shift", "Planned"], ["R²", da?.R2 != null ? da.R2.toFixed(2) : "—"]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-gray-50 px-3 py-2 text-center dark:bg-night-700">
              <p className="text-xs text-ink-muted dark:text-gray-400">{k}</p>
              <p className="text-base font-bold text-ink dark:text-white">{v}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-5 -left-3 hidden items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-lg dark:border-night-700 dark:bg-night-800 dark:text-white sm:flex">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white"><IconCheck className="h-4 w-4" /></span> Plan ready
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { dark, toggle } = useTheme();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { api.overview().then(setInfo).catch((e) => setError(e.message)); }, []);

  const steps = info?.how_it_works || FALLBACK_STEPS;
  const da = info?.model_performance?.day_ahead;
  const nh = info?.model_performance?.week_ahead;

  return (
    <div className="min-h-screen bg-white dark:bg-night-900">
      {/* top bar */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-3">
          <button onClick={toggle} aria-label="Toggle dark mode"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-ink-muted hover:bg-gray-100 dark:border-night-600 dark:text-gray-400 dark:hover:bg-night-700">
            {dark ? <IconSun /> : <IconMoon />}
          </button>
          <Link to={user ? "/dashboard" : "/login"} className="btn-primary">
            {user ? "Open dashboard" : "Authority login"} <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-32 -top-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-10 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
             style={{ backgroundImage: "radial-gradient(#98a2b366 1px, transparent 1px)", backgroundSize: "28px 28px",
                      maskImage: "linear-gradient(to bottom, black, transparent 85%)", WebkitMaskImage: "linear-gradient(to bottom, black, transparent 85%)" }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 md:pt-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-600 dark:border-brand-500/20 dark:bg-brand-500/15 dark:text-brand-300">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
              Live all-India demand forecasting
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-ink dark:text-white md:text-6xl">
              Smarter energy.{" "}
              <span className="bg-gradient-to-r from-brand-500 via-violet-500 to-cyan-400 bg-clip-text text-transparent">Smoother demand.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-muted dark:text-gray-400">
              {info?.problem || "Urban electricity demand spikes on hot days. Covering those few peak hours is expensive and can force load-shedding."}{" "}
              FluxGrid forecasts all-India demand for every hour of the coming days, flags where the grid limit will be
              crossed, and builds a load-shifting plan that protects essential services.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={user ? "/dashboard" : "/login"} className="btn-primary px-5 py-3 text-base shadow-lg shadow-brand-500/25">
                {user ? "Go to dashboard" : "Log in to the dashboard"} <IconArrowRight className="h-4 w-4" />
              </Link>
              <a href="#how" className="btn-outline px-5 py-3 text-base">How it works</a>
            </div>
            {error && (
              <p className="mt-6 text-sm text-amber-700 dark:text-amber-300">
                Note: couldn't load live info from the backend ({error}).
              </p>
            )}
          </div>
          <HeroPreview da={da} />
        </div>
      </section>

      {/* stat strip */}
      <section className="mx-auto -mt-4 max-w-6xl px-5">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 shadow-card dark:border-night-700 dark:bg-night-700 md:grid-cols-4">
          {[
            ["24 × 7", "Hourly forecasts"],
            ["11", "Cities of weather data"],
            [da?.MAPE_pct != null ? `${da.MAPE_pct.toFixed(1)}%` : "—", "Day-ahead error"],
            ["1–14 days", "Forecast horizon"],
          ].map(([v, k]) => (
            <div key={k} className="bg-white px-5 py-5 text-center dark:bg-night-800">
              <p className="text-2xl font-bold text-ink dark:text-white md:text-3xl">{v}</p>
              <p className="mt-1 text-sm text-ink-muted dark:text-gray-400">{k}</p>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-500">Features</p>
        <h2 className="mt-2 text-2xl font-bold text-ink dark:text-white md:text-3xl">Everything a grid planner needs</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text, tint }) => (
            <div key={title} className="card transition hover:-translate-y-1 hover:shadow-lg">
              <span className={`flex h-12 w-12 items-center justify-center rounded-xl text-white ${tint}`}><Icon /></span>
              <h3 className="mt-5 text-lg font-semibold text-ink dark:text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted dark:text-gray-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="border-y border-gray-200 bg-gray-50 py-16 dark:border-night-700 dark:bg-night-800/50">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-2xl font-bold text-ink dark:text-white md:text-3xl">How it works</h2>
          <p className="mt-2 text-ink-muted dark:text-gray-400">From weather forecast to an approved action plan, every evening.</p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => {
              const Icon = STEP_ICONS[i] || IconBolt;
              return (
                <div key={s.step} className="card">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-300">
                    <Icon />
                  </span>
                  <p className="mt-4 text-xs font-medium uppercase tracking-wider text-ink-faint">Step {s.step}</p>
                  <h3 className="mt-1 text-lg font-semibold text-ink dark:text-white">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted dark:text-gray-400">{s.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* model performance */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-bold text-ink dark:text-white md:text-3xl">Tested on a year it never saw</h2>
        <p className="mt-2 max-w-2xl text-ink-muted dark:text-gray-400">
          All-India models trained on 2019 – Sept 2025 and evaluated on the following 12 months.
          {info?.data_freshness && <> Newest demand data: <b>{info.data_freshness.newest_demand_day}</b>.</>}
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {[["1 day ahead", "With yesterday's demand data", da], ["7 days ahead", "With week-old demand data", nh]].map(([title, sub, m]) => (
            <div key={title} className="card">
              <h3 className="card-title">{title}</h3>
              <p className="card-sub">{sub}</p>
              <div className="mt-5 grid grid-cols-3 divide-x divide-gray-200 dark:divide-night-700">
                {[["Avg. error", m?.MAE_MW, " MW"], ["Error %", m?.MAPE_pct, "%"], ["R²", m?.R2, ""]].map(([k, v, u]) => (
                  <div key={k} className="px-3 text-center first:pl-0 last:pr-0">
                    <p className="text-2xl font-bold text-ink dark:text-white">
                      {v == null ? "—" : k === "R²" ? v.toFixed(3) : k === "Error %" ? v.toFixed(1) : Math.round(v).toLocaleString("en-IN")}
                      <span className="text-sm font-medium text-ink-muted">{v == null ? "" : u}</span>
                    </p>
                    <p className="text-sm text-ink-muted dark:text-gray-400">{k}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* call to action */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-500 to-cyan-500 px-8 py-12 text-center md:py-16">
          <div className="pointer-events-none absolute inset-0 opacity-20"
               style={{ backgroundImage: "linear-gradient(#fff3 1px, transparent 1px), linear-gradient(90deg, #fff3 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          <div className="relative">
            <h2 className="text-2xl font-bold text-white md:text-4xl">Flatten tomorrow's peak today.</h2>
            <p className="mx-auto mt-3 max-w-xl text-brand-50">See the forecast, spot the risky hours and get a ready-to-review load-shifting plan.</p>
            <Link to={user ? "/dashboard" : "/login"} className="btn mt-7 bg-white px-6 py-3 text-base text-brand-600 shadow-lg hover:bg-brand-25">
              {user ? "Open dashboard" : "Authority login"} <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-ink-muted dark:border-night-700 dark:text-gray-500">
        <div className="mb-3 flex justify-center"><Logo /></div>
        <p className="mb-2 font-medium text-ink-soft dark:text-gray-400">Smarter energy. Smoother demand.</p>
        Demand data: Grid-India daily reports via Grid-Sentinel (CC BY-SA 4.0) · Weather: ERA5 & forecasts via Open-Meteo
      </footer>
    </div>
  );
}
