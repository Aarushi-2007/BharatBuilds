"""
The "brain" of the backend: loads the national models + data once, merges in live data,
and builds the dashboard / optimisation / data-status responses.

Two modes, chosen automatically per date:
  REPLAY - the date's real demand is known (historical). Shows forecast vs actual.
  LIVE   - the date is after the newest demand data (today / coming days). Uses the
           weather forecast and the model for the right horizon (1-14 days).
"""
import json
import sys
import threading
from datetime import datetime
from zoneinfo import ZoneInfo

import joblib
import numpy as np
import pandas as pd

from . import config, live_data

sys.path.insert(0, str(config.BACKEND_DIR))
import grid_forecast as gf       # noqa: E402  (backend/grid_forecast.py)
import peak_optimizer as po      # noqa: E402  (backend/peak_optimizer.py — the optimiser)


class DateNotAvailable(ValueError):
    """Raised when a date can't be forecast with the data we have."""


class GridService:
    def __init__(self):
        nd = config.NATIONAL_DIR
        self.cfg = json.loads((nd / "national_config.json").read_text())
        self.horizons = self.cfg["horizons"]
        self.prod = {h: joblib.load(nd / "production" / f"h{h}.pkl") for h in self.horizons}
        self.backtest = {h: joblib.load(nd / "backtest" / f"h{h}.pkl") for h in self.horizons
                         if (nd / "backtest" / f"h{h}.pkl").exists()}
        self.base = pd.read_csv(nd / "national_history.csv", parse_dates=["datetime"], index_col="datetime").sort_index()
        self.test_start = pd.Timestamp(self.cfg["test_period"]["start"])
        self.base_last_demand = self.base["demand"].last_valid_index()
        self.lock = threading.Lock()
        self.refreshing = False
        self._merge()

    # ------------------------------------------------------------ data
    def _merge(self):
        """Base data (from Notebook 3) + anything newer fetched/uploaded at runtime."""
        live_dem, live_wea = live_data.load_live()
        weather = self.base[gf.WEATHER_FEATURES]
        if live_wea is not None:
            weather = weather.combine_first(live_wea[gf.WEATHER_FEATURES])   # observed (base) wins over forecast
        demand = self.base["demand"]
        if live_dem is not None:
            demand = demand.combine_first(live_dem)                              # base wins where both exist
        idx = pd.date_range(min(weather.index.min(), demand.index.min()),
                            max(weather.index.max(), demand.dropna().index.max()), freq="h")
        data = weather.reindex(idx)
        data = data.astype(float)
        data["demand"] = pd.to_numeric(demand.reindex(idx), errors="coerce").astype(float)
        with self.lock:
            self.data = data

    def today(self):
        return pd.Timestamp(datetime.now(ZoneInfo(config.TIMEZONE)).date())

    def last_full_day(self):
        known = self.data["demand"].dropna()
        counts = known.groupby(known.index.normalize()).size()
        return counts[counts >= 23].index.max()

    def weather_last_day(self):
        w = self.data[gf.WEATHER_FEATURES].dropna()
        counts = w.groupby(w.index.normalize()).size()
        return counts[counts == 24].index.max()

    def date_bounds(self):
        first = (self.data["demand"].first_valid_index() + pd.Timedelta(days=40)).normalize()
        last = min(self.last_full_day() + pd.Timedelta(days=max(self.horizons)), self.weather_last_day())
        return first, last

    # ------------------------------------------------------------ helpers
    def _check_date(self, date):
        try:
            day = pd.Timestamp(date).normalize()
        except (ValueError, TypeError):
            raise DateNotAvailable(f"'{date}' is not a valid date. Use YYYY-MM-DD.")
        first, last = self.date_bounds()
        if not (first <= day <= last):
            raise DateNotAvailable(f"Forecasts are available from {first.date()} to {last.date()} with the current data. "
                                   "Refresh live data on the Data page to extend this.")
        return day

    def _models_for(self, day):
        if day <= self.base_last_demand.normalize() and day >= self.test_start and self.backtest:
            return self.backtest, "backtest model (trained before the test year, never saw this date)", False
        if day <= self.base_last_demand.normalize():
            return self.prod, "production model (this date was part of its training data)", True
        return self.prod, "production model (live forecast)", False

    def threshold(self, day):
        if config.FIXED_THRESHOLD_MW:
            return config.FIXED_THRESHOLD_MW
        t = gf.rolling_threshold(self.data["demand"], day)
        return t if t is not None else self.cfg["peak_detection"]["reference_threshold_mw"]

    def _risk(self, mw, thr):
        warn = self.cfg["peak_detection"]["warning_ratio"] * thr
        return "PEAK RISK" if mw >= thr else ("ELEVATED" if mw >= warn else "NORMAL")

    def _forecast(self, day):
        models, label, in_sample = self._models_for(day)
        try:
            fc, info = gf.forecast_day(self.data, day, models)
        except ValueError as e:
            raise DateNotAvailable(str(e))
        actual = self.data["demand"].reindex(fc.index)
        mode = "replay" if actual.notna().all() else "live"
        m = self.cfg["test_metrics"].get(str(info["horizon_days"]), {})
        info.update({"mode": mode, "model_used": label, "in_sample": in_sample,
                     "expected_error": {"MAE_MW": m.get("MAE_MW"), "MAPE_pct": m.get("MAPE_pct")}})
        return fc, actual, info

    @staticmethod
    def _events(fc, thr):
        above = fc >= thr
        events, start = [], None
        for t, flag in above.items():
            if flag and start is None:
                start = t
            if start is not None and (not flag or t == fc.index[-1]):
                end = t if not flag else t + pd.Timedelta(hours=1)
                block = fc[start:end - pd.Timedelta(hours=1)]
                events.append({"start": start.strftime("%H:%M"), "end": end.strftime("%H:%M"),
                               "duration_h": len(block), "max_forecast_MW": round(float(block.max()), 1),
                               "excess_over_limit_MWh": round(float((block - thr).clip(lower=0).sum()), 1)})
                start = None
        return events

    # ------------------------------------------------------------ /data/status
    def status(self):
        first, last = self.date_bounds()
        today = self.today()
        lfd = self.last_full_day()
        live_first = max(today, lfd + pd.Timedelta(days=1))
        default = today if first <= today <= last else min(last, max(first, lfd + pd.Timedelta(days=1)))
        return {
            "region": config.REGION_NAME,
            "today": str(today.date()),
            "newest_demand_hour": str(self.data["demand"].last_valid_index()),
            "newest_complete_demand_day": str(lfd.date()),
            "demand_age_days": int((today - lfd).days),
            "weather_until": str(self.weather_last_day().date()),
            "forecast_range": {"first": str(first.date()), "last": str(last.date())},
            "live_range": {"first": str(live_first.date()), "last": str(last.date())} if live_first <= last else None,
            "default_date": str(default.date()),
            "today_available": bool(first <= today <= last),
            "test_period": self.cfg["test_period"],
            "accuracy_by_horizon": self.cfg["test_metrics"],
            "refreshing": self.refreshing,
            "recent_activity": live_data.read_log()[:8],
            "sources": {"demand": "Grid-India daily reports via Grid-Sentinel (15-min, all-India) + CSV uploads",
                        "weather": "Open-Meteo forecast API (11 cities)"},
            "replay_demo_dates": ["2026-05-21", "2026-06-10", "2025-12-15", "2026-04-28"],
        }

    # ------------------------------------------------------------ refresh / upload
    def refresh(self, weather=True, demand=True):
        result = {}
        self.refreshing = True
        try:
            if weather:
                try:
                    w = live_data.fetch_weather_forecast()
                    live_data.save_weather(w)
                    result["weather"] = {"ok": True, "until": str(w.index.max())}
                except Exception as e:      # network/API problems shouldn't crash the server
                    result["weather"] = {"ok": False, "error": f"Couldn't reach the weather service (Open-Meteo): {str(e)[:200]}"}
            if demand:
                try:
                    d = live_data.fetch_demand_github()
                    new = d[d.index > self.base_last_demand]
                    live_data.save_demand(new)
                    result["demand"] = {"ok": True, "newest": str(d.index.max()), "new_hours": int(len(new))}
                except Exception as e:
                    result["demand"] = {"ok": False, "error": f"Couldn't download demand data from GitHub: {str(e)[:200]}"}
            self._merge()
            live_data._log({"event": "refresh", **{k: v for k, v in result.items()}})
        finally:
            self.refreshing = False
        return {**result, "status": self.status()}

    def upload(self, text, user_email):
        s = live_data.parse_uploaded_csv(text)
        live_data.save_demand(s)
        self._merge()
        info = {"rows_hourly": int(len(s)), "from": str(s.index.min()), "to": str(s.index.max())}
        live_data._log({"event": "upload", "by": user_email, **info})
        return {"ok": True, **info, "status": self.status()}

    # ------------------------------------------------------------ /dashboard
    def dashboard(self, date, days=1):
        start = self._check_date(date)
        _, last = self.date_bounds()
        out_days = []
        for i in range(max(1, min(days, 7))):
            day = start + pd.Timedelta(days=i)
            if day > last:
                break
            out_days.append(self._dashboard_day(day))

        thr0 = self.threshold(start)
        hist = self.data["demand"].loc[start - pd.Timedelta(days=14): start - pd.Timedelta(hours=1)]
        daily = hist.resample("D").agg(["max", "mean"]).dropna()
        recent = [{"date": str(d.date()), "peak_MW": round(float(r["max"]), 1), "avg_MW": round(float(r["mean"]), 1),
                   "over_limit": bool(r["max"] >= thr0)} for d, r in daily.iterrows()]
        return {
            "region": config.REGION_NAME,
            "threshold_MW": round(thr0, 1),
            "warning_MW": round(thr0 * self.cfg["peak_detection"]["warning_ratio"], 1),
            "threshold_rule": ("Fixed limit set by the authority" if config.FIXED_THRESHOLD_MW
                               else self.cfg["peak_detection"]["threshold_rule"]),
            "days": out_days,
            "recent_history": recent,
            "model_info": {"type": "XGBoost, one model per horizon (1-14 days after the newest demand data)",
                           "accuracy_by_horizon": self.cfg["test_metrics"]},
        }

    def _dashboard_day(self, day):
        fc, actual, info = self._forecast(day)
        thr = self.threshold(day)
        warn = thr * self.cfg["peak_detection"]["warning_ratio"]
        w = self.data.loc[fc.index, ["nat_temp", "nat_feels", "nat_humidity", "nat_rain", "feels_north", "feels_south"]]
        hourly = [{
            "hour": int(t.hour), "time": t.strftime("%H:%M"),
            "forecast_MW": round(float(fc[t]), 1),
            "actual_MW": None if pd.isna(actual[t]) else round(float(actual[t]), 1),
            "risk": self._risk(float(fc[t]), thr),
            "temperature_C": round(float(w.loc[t, "nat_temp"]), 1),
            "feels_like_C": round(float(w.loc[t, "nat_feels"]), 1),
            "feels_north_C": round(float(w.loc[t, "feels_north"]), 1),
            "feels_south_C": round(float(w.loc[t, "feels_south"]), 1),
            "humidity_pct": round(float(w.loc[t, "nat_humidity"]), 0),
            "rain_mm": round(float(w.loc[t, "nat_rain"]), 2),
        } for t in fc.index]
        n_over = int((fc >= thr).sum())
        n_elev = int(((fc >= warn) & (fc < thr)).sum())
        summary = {
            "status": "PEAK RISK" if n_over else ("ELEVATED" if n_elev else "NORMAL"),
            "forecast_peak_MW": round(float(fc.max()), 1),
            "forecast_peak_time": fc.idxmax().strftime("%H:%M"),
            "forecast_min_MW": round(float(fc.min()), 1),
            "daily_energy_MWh": round(float(fc.sum()), 1),
            "hours_over_limit": n_over, "hours_elevated": n_elev,
            "energy_over_limit_MWh": round(float((fc - thr).clip(lower=0).sum()), 1),
            "max_temperature_C": round(float(w["nat_temp"].max()), 1),
            "max_feels_like_C": round(float(w["nat_feels"].max()), 1),
            "max_feels_north_C": round(float(w["feels_north"].max()), 1),
        }
        accuracy = None
        if info["mode"] == "replay":
            err = (fc - actual).abs()
            accuracy = {"MAE_MW": round(float(err.mean()), 1), "MAPE_pct": round(float((err / actual).mean() * 100), 2),
                        "actual_peak_MW": round(float(actual.max()), 1),
                        "actual_hours_over_limit": int((actual >= thr).sum())}
        return {"date": str(day.date()), "weekday": day.day_name(), **info,
                "threshold_MW": round(thr, 1), "warning_MW": round(warn, 1),
                "summary": summary, "hourly": hourly, "peak_events": self._events(fc, thr), "accuracy": accuracy}

    # ------------------------------------------------------------ /optimization
    def optimization(self, date, flex_share=None, max_shift_hours=None, safety_margin_mw=None,
                     curtail_share=None, daily_energy_budget_mwh=None):
        d = self.cfg["optimizer_defaults"]
        params = {"flex_share": d["flex_share"] if flex_share is None else flex_share,
                  "max_shift_hours": d["max_shift_hours"] if max_shift_hours is None else max_shift_hours,
                  "safety_margin_mw": d["safety_margin_mw"] if safety_margin_mw is None else safety_margin_mw,
                  "curtail_share": d["curtail_share"] if curtail_share is None else curtail_share,
                  "daily_energy_budget_mwh": daily_energy_budget_mwh}
        day = self._check_date(date)
        fc, actual, info = self._forecast(day)
        thr = self.threshold(day)
        plan = po.optimize_day(fc.values, thr, **params)
        base = {"date": str(day.date()), **info, "threshold_MW": round(thr, 1), "parameters": params}
        if plan["status"] != "ok":
            return {**base, "status": plan["status"], "message": plan["message"]}

        s = plan["summary"]
        hourly = [{
            "hour": int(t.hour), "time": t.strftime("%H:%M"),
            "forecast_MW": round(float(f), 1), "optimized_MW": round(float(o), 1),
            "risk_before": self._risk(f, thr), "risk_after": self._risk(o, thr),
            "moved_out_MW": round(float(mo), 1), "moved_in_MW": round(float(mi), 1),
            "curtailed_MW": round(float(cu), 1),
        } for t, f, o, mo, mi, cu in zip(fc.index, plan["forecast"], plan["optimized"],
                                         plan["moved_out"], plan["moved_in"], plan["curtailed"])]
        actions = [{
            "from": f"{m['from_hour']:02d}:00", "to": f"{m['to_hour']:02d}:00", "MW": m["MW"],
            "direction": "earlier" if m["to_hour"] < m["from_hour"] else "later",
            "text": (f"Shift {m['MW']:,.0f} MW of flexible load from {m['from_hour']:02d}:00 to {m['to_hour']:02d}:00 "
                     f"({abs(m['to_hour'] - m['from_hour'])} h {'earlier' if m['to_hour'] < m['from_hour'] else 'later'})"),
        } for m in plan["moves"] if m["MW"] >= 100]
        for h in hourly:
            if h["curtailed_MW"] >= 100:
                actions.append({"from": h["time"], "to": None, "MW": h["curtailed_MW"], "direction": "reduce",
                                "text": f"Request demand reduction of {h['curtailed_MW']:,.0f} MW at {h['time']} "
                                        "(needed to meet the energy budget)"})

        if s["hours_over_threshold_before"] == 0 and s["energy_shifted_MWh"] == 0:
            headline = "No action needed: the forecast stays under the grid limit all day."
        elif s["hours_over_threshold_after"] == 0:
            headline = (f"Following this plan keeps every hour under the {thr:,.0f} MW limit "
                        f"(peak {s['original_peak_MW']:,.0f} → {s['optimized_peak_MW']:,.0f} MW).")
        else:
            headline = (f"Demand is high for most of the day, so shifting cannot clear every hour. The plan cuts the peak "
                        f"by {s['peak_reduction_MW']:,.0f} MW ({s['peak_reduction_pct']}%) and the energy above the limit "
                        f"from {s['energy_over_threshold_before_MWh']:,.0f} to {s['energy_over_threshold_after_MWh']:,.0f} MWh.")

        replay = None
        if info["mode"] == "replay":
            after = po.apply_plan_to_actual(actual.values, plan)
            replay = {
                "actual_peak_MW": round(float(actual.max()), 1),
                "actual_peak_with_plan_MW": round(float(after.max()), 1),
                "actual_energy_over_limit_MWh": round(float(np.clip(actual.values - thr, 0, None).sum()), 1),
                "with_plan_energy_over_limit_MWh": round(float(np.clip(after - thr, 0, None).sum()), 1),
                "actual_hours_over_limit": int((actual.values >= thr).sum()),
                "with_plan_hours_over_limit": int((after >= thr + 1).sum()),
                "hourly_actual_MW": [round(float(v), 1) for v in actual.values],
                "hourly_actual_with_plan_MW": [round(float(v), 1) for v in after],
            }
        return {**base, "status": "ok", "target_MW": round(plan["target_mw"], 1),
                "headline": headline, "summary": s, "actions": actions, "hourly": hourly, "replay_check": replay,
                "notes": ["Flexible load share is a scenario assumption (not in the data).",
                          "Essential load is never shifted or reduced.",
                          "The plan is a recommendation; operators approve and execute it."]}
