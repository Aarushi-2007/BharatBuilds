"""
peak_optimizer.py
=================
Day-ahead peak forecasting + load-shifting optimiser for the
Weather-Aware Peak-Demand Management System.

Pipeline:   history + weather  ->  day-ahead forecast (XGBoost)  ->  optimiser (linear program)  ->  plan

Only dependencies: numpy, pandas, scipy (all preinstalled in Google Colab), joblib.
"""
import json
import numpy as np
import pandas as pd
from scipy.optimize import linprog

WEATHER_COLS = ["temperature", "humidity", "feels_like", "rain_mm"]


def load_config(path="feature_config.json"):
    with open(path) as f:
        return json.load(f)


def make_day_ahead_features(d, cfg):
    """Add every day-ahead feature column to an hourly DataFrame with 'demand' + weather.
    Used BOTH for training and for forecasting, so the features can never drift apart."""
    fd = cfg["feature_definitions"]
    d = d.copy()
    idx = d.index
    season_map = {int(k): v for k, v in fd["season_map"].items()}
    d["hour"] = idx.hour
    d["day_of_week"] = idx.dayofweek
    d["month"] = idx.month
    d["is_weekend"] = (idx.dayofweek >= 5).astype(int)
    d["season"] = d["month"].map(season_map)
    d["hour_sin"] = np.sin(2 * np.pi * d["hour"] / 24)
    d["hour_cos"] = np.cos(2 * np.pi * d["hour"] / 24)

    d["lag_24"] = d["demand"].shift(24)
    d["lag_48"] = d["demand"].shift(48)
    d["lag_168"] = d["demand"].shift(168)
    past24 = d["demand"].shift(24)                    # newest usable value = t-24
    d["roll_mean_24_da"] = past24.rolling(24).mean()
    d["roll_std_24_da"] = past24.rolling(24).std()
    d["roll_max_24_da"] = past24.rolling(24).max()

    d["cdh"] = (d["feels_like"] - fd["cdh_base_c"]).clip(lower=0)
    d["hdh"] = (fd["hdh_base_c"] - d["temperature"]).clip(lower=0)
    d["feels_like_change_24h"] = d["feels_like"] - d["feels_like"].shift(24)
    return d


def build_day_ahead_features(data, day, cfg):
    """Build the 24 feature rows the day-ahead model needs to forecast `day`.

    data : DataFrame indexed by hourly datetime with columns
           'demand' (MW, known up to day-1 23:00) and the weather columns
           (temperature, humidity, feels_like, rain_mm) for `day` and the 9 days before it.
           In production, the weather for `day` comes from a weather FORECAST.
    day  : the date to forecast (e.g. "2023-08-18").
    cfg  : the dict from feature_config.json (written by Notebook 1).
    """
    day = pd.Timestamp(day).normalize()
    hours = pd.date_range(day, periods=24, freq="h")
    window = pd.date_range(day - pd.Timedelta(days=9), hours[-1], freq="h")
    d = data.reindex(window)[["demand"] + WEATHER_COLS].copy()
    d.loc[hours, "demand"] = np.nan          # safety: the target day's demand is never used

    X = make_day_ahead_features(d, cfg).loc[hours, cfg["day_ahead_model"]["features"]]
    if X.isna().any().any():
        bad = X.columns[X.isna().any()].tolist()
        raise ValueError(f"Missing history/weather to build features for {day.date()}: {bad}")
    return X


def forecast_day_ahead(model, X, cfg):
    """Return a pd.Series of 24 forecast values (MW) for the hours in X."""
    base = cfg["day_ahead_model"]["output_transform"]["feature"]   # 'lag_24'
    pred = model.predict(X) + X[base].values                        # change -> level
    return pd.Series(pred, index=X.index, name="forecast_MW")

def optimize_day(forecast, threshold_mw, flex_share=0.10, max_shift_hours=3,
                 curtail_share=0.02, daily_energy_budget_mwh=None, safety_margin_mw=0.0):
    """Plan how to move flexible load so tomorrow's peak stays under the threshold.

    forecast                : 24 hourly demand values (MW) for the day
    threshold_mw            : grid limit we want to stay under
    flex_share              : share of each hour's demand that is flexible (can be moved)
    max_shift_hours         : comfort rule - a load can move at most this many hours
    curtail_share           : max share of an hour's demand that may be reduced outright
                              (used ONLY if the energy budget forces it)
    daily_energy_budget_mwh : energy allowed today (from the monthly budget); None = no limit
    safety_margin_mw        : plan to stay this far below the threshold (forecast error buffer)

    Two-stage linear program:
      Stage 1: "How low can the peak go?"          -> minimise peak P
      Stage 2: keep P <= max(best possible peak, target), then
               (a) minimise energy still above the target  (main goal)
               (b) minimise MW-hours of delay              (comfort, tie-breaker)
    """
    D = np.asarray(forecast, dtype=float)
    H = len(D)
    target = threshold_mw - safety_margin_mw
    F = flex_share * D                          # flexible MW per hour; the rest is essential

    # ---- decision variables: x[h->k] (moves), c[h] (curtailment), e[h] (excess), P (peak) ----
    pairs = [(h, k) for h in range(H) for k in range(H)
             if h != k and abs(h - k) <= max_shift_hours]
    nx = len(pairs)
    ic = nx                    # index of first curtailment variable
    ie = nx + H                # index of first "excess above target" variable
    iP = nx + 2 * H            # index of the peak variable
    nvar = nx + 2 * H + 1

    def new_demand_row(k):
        """Coefficients so that row @ z = (new demand at hour k) - D_k."""
        row = np.zeros(nvar)
        for j, (h, kk) in enumerate(pairs):
            if kk == k:
                row[j] += 1          # load arriving in hour k
            if h == k:
                row[j] -= 1          # load leaving hour k
        row[ic + k] = -1             # load cut in hour k
        return row

    A_ub, b_ub = [], []
    # (1) new demand at every hour <= P      ->  in_k - out_k - c_k - P <= -D_k
    for k in range(H):
        row = new_demand_row(k)
        row[iP] = -1
        A_ub.append(row); b_ub.append(-D[k])
    # (1b) excess e_k >= new demand - target  ->  new_k - e_k <= target
    for k in range(H):
        row = new_demand_row(k)
        row[ie + k] = -1
        A_ub.append(row); b_ub.append(target - D[k])
    # (2) only flexible load may leave or be cut  ->  out_h + c_h <= F_h
    for h in range(H):
        row = np.zeros(nvar)
        for j, (hh, k) in enumerate(pairs):
            if hh == h:
                row[j] = 1
        row[ic + h] = 1
        A_ub.append(row); b_ub.append(F[h])
    A_ub, b_ub = np.array(A_ub), np.array(b_ub)

    # (3) energy budget: shifting conserves energy, so only curtailment can save energy
    required_cut = 0.0
    if daily_energy_budget_mwh is not None:
        required_cut = max(D.sum() - daily_energy_budget_mwh, 0.0)
    A_eq = np.zeros((1, nvar)); A_eq[0, ic:ic + H] = 1
    b_eq = np.array([required_cut])

    bounds = ([(0, None)] * nx + [(0, curtail_share * D[h]) for h in range(H)]
              + [(0, None)] * H + [(None, None)])

    # ---- Stage 1: minimise the peak ----
    c1 = np.zeros(nvar); c1[iP] = 1
    s1 = linprog(c1, A_ub=A_ub, b_ub=b_ub, A_eq=A_eq, b_eq=b_eq, bounds=bounds, method="highs")
    if s1.status != 0:
        return {"status": "infeasible",
                "message": "The energy budget needs more curtailment than allowed "
                           f"(need {required_cut:,.0f} MWh, max {curtail_share * D.sum():,.0f} MWh)."}
    best_peak = s1.x[iP]

    # ---- Stage 2: reach max(best_peak, target) with minimum delay ----
    peak_cap = max(best_peak, target) + 1e-6 * max(1.0, abs(target))
    bounds2 = bounds[:-1] + [(None, peak_cap)]
    c2 = np.zeros(nvar)
    c2[ie:ie + H] = 100.0                   # energy above the target matters most...
    for j, (h, k) in enumerate(pairs):
        c2[j] = abs(h - k)                  # ...then comfort: 1 MW moved by 3 h = 3 MW-h of delay
    s2 = linprog(c2, A_ub=A_ub, b_ub=b_ub, A_eq=A_eq, b_eq=b_eq, bounds=bounds2, method="highs")
    z = s2.x if s2.status == 0 else s1.x

    x = z[:nx]
    curtail = z[ic:ic + H]
    moved_out = np.zeros(H); moved_in = np.zeros(H)
    moves = []
    for j, (h, k) in enumerate(pairs):
        if x[j] > 1e-3:
            moved_out[h] += x[j]; moved_in[k] += x[j]
            moves.append({"from_hour": h, "to_hour": k, "MW": round(float(x[j]), 1)})
    new = D - moved_out - curtail + moved_in

    return {
        "status": "ok",
        "target_mw": target,
        "forecast": D,
        "optimized": new,
        "moved_out": moved_out,
        "moved_in": moved_in,
        "curtailed": curtail,
        "moves": sorted(moves, key=lambda m: -m["MW"]),
        "summary": {
            "original_peak_MW": round(float(D.max()), 1),
            "optimized_peak_MW": round(float(new.max()), 1),
            "peak_reduction_MW": round(float(D.max() - new.max()), 1),
            "peak_reduction_pct": round(float(100 * (D.max() - new.max()) / D.max()), 2),
            "target_reached": bool(new.max() <= target + 1),
            "hours_over_threshold_before": int((D > threshold_mw).sum()),
            "hours_over_threshold_after": int((new > threshold_mw + 1).sum()),
            "energy_over_threshold_before_MWh": round(float(np.clip(D - threshold_mw, 0, None).sum()), 1),
            "energy_over_threshold_after_MWh": round(float(np.clip(new - threshold_mw, 0, None).sum()), 1),
            "energy_shifted_MWh": round(float(moved_out.sum()), 1),
            "delay_MW_hours": round(float(sum(abs(m["from_hour"] - m["to_hour"]) * m["MW"] for m in moves)), 1),
            "energy_curtailed_MWh": round(float(curtail.sum()), 1),
        },
    }


def apply_plan_to_actual(actual, plan):
    """What would really have happened if the plan's MW moves were carried out
    on the ACTUAL demand curve (forecast errors included)."""
    return np.asarray(actual, dtype=float) - plan["moved_out"] - plan["curtailed"] + plan["moved_in"]

def plan_day(day, data, model, cfg, threshold_mw=None, **opt_params):
    """One call = the whole pipeline for one day.  Returns a JSON-ready dict
    (this is what a FastAPI /plan endpoint would return)."""
    threshold_mw = threshold_mw or cfg["peak_detection"]["threshold_mw"]
    warn = cfg["peak_detection"]["warning_ratio"] * threshold_mw
    X = build_day_ahead_features(data, day, cfg)
    fc = forecast_day_ahead(model, X, cfg)
    plan = optimize_day(fc.values, threshold_mw, **opt_params)
    if plan["status"] != "ok":
        return {"date": str(pd.Timestamp(day).date()), **plan}

    def risk(v):
        return "PEAK RISK" if v >= threshold_mw else ("ELEVATED" if v >= warn else "NORMAL")

    hourly = [{
        "hour": int(t.hour),
        "forecast_MW": round(float(f), 1),
        "optimized_MW": round(float(o), 1),
        "risk_before": risk(f),
        "risk_after": risk(o),
        "moved_out_MW": round(float(mo), 1),
        "moved_in_MW": round(float(mi), 1),
        "curtailed_MW": round(float(cu), 1),
    } for t, f, o, mo, mi, cu in zip(fc.index, plan["forecast"], plan["optimized"],
                                     plan["moved_out"], plan["moved_in"], plan["curtailed"])]
    return {
        "date": str(pd.Timestamp(day).date()),
        "threshold_MW": round(float(threshold_mw), 1),
        "parameters": opt_params,
        "summary": plan["summary"],
        "hourly": hourly,
        "moves": plan["moves"],
    }
