"""
grid_forecast.py
================
All-India electricity demand forecasting: weather aggregation, multi-horizon features,
and forecasting for any day 1-7 days after the newest demand data.

Used by BOTH the training notebook and the FastAPI backend, so features are always
computed the same way.  Dependencies: numpy, pandas.
"""
import numpy as np
import pandas as pd

# 11 cities, grouped by grid region. National demand reacts to heat in every region.
CITY_GROUPS = {
    "north": ["delhi", "lucknow", "jaipur", "chandigarh", "ludhiana"],
    "west": ["mumbai", "ahmedabad"],
    "south": ["chennai", "bengaluru", "hyderabad"],
    "east": ["kolkata"],
}
CITIES = [c for group in CITY_GROUPS.values() for c in group]
CDH_BASE, HDH_BASE = 24.0, 18.0


def aggregate_weather(long_df):
    """Turn per-city hourly weather (long format, Open-Meteo column names) into one
    row per hour with national averages + regional 'feels like' temperatures."""
    w = long_df.rename(columns={"temperature_2m": "temperature", "relative_humidity_2m": "humidity",
                                "apparent_temperature": "feels_like", "precipitation": "rain_mm"}).copy()
    w["datetime"] = pd.to_datetime(w["datetime"], format="ISO8601")
    w = w[w["city"].isin(CITIES)]
    w["cdh_city"] = (w["feels_like"] - CDH_BASE).clip(lower=0)     # cooling need per city
    w["hdh_city"] = (HDH_BASE - w["temperature"]).clip(lower=0)    # heating need per city

    nat = w.groupby("datetime")[["temperature", "humidity", "feels_like", "rain_mm", "cdh_city", "hdh_city"]].mean()
    nat.columns = ["nat_temp", "nat_humidity", "nat_feels", "nat_rain", "nat_cdh", "nat_hdh"]
    for region, cities in CITY_GROUPS.items():
        nat[f"feels_{region}"] = w[w["city"].isin(cities)].groupby("datetime")["feels_like"].mean()
    complete = w.groupby("datetime")["city"].nunique() == len(CITIES)  # only hours with all 11 cities
    return nat[complete.reindex(nat.index, fill_value=False)]


WEATHER_FEATURES = ["nat_temp", "nat_humidity", "nat_feels", "nat_rain", "nat_cdh", "nat_hdh",
                    "feels_north", "feels_west", "feels_south", "feels_east"]

SEASON_MAP = {12: 0, 1: 0, 2: 0, 3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 2, 10: 3, 11: 3}
CALENDAR_FEATURES = ["hour", "day_of_week", "month", "is_weekend", "season",
                     "hour_sin", "hour_cos", "doy_sin", "doy_cos"]
HORIZONS = range(1, 15)         # 1 to 14 days after the newest demand data


def week_lag(h):
    """Smallest whole number of weeks (in hours) that is at least h days back."""
    return 168 * int(np.ceil(h / 7))


def lag_hours(h):
    """Demand lags allowed for horizon h: nothing newer than h*24 hours before the target hour."""
    L, wk = 24 * h, week_lag(h)
    return sorted({L, L + 24, wk, wk + 168})


def base_col(h):
    """The model predicts the CHANGE from this lag (1 day ahead: yesterday; otherwise same weekday)."""
    return "lag_24" if h == 1 else f"lag_{week_lag(h)}"


def model_params(h):
    """Short horizons: a deeper model. Longer horizons: a simpler model that overfits less."""
    if h <= 2:
        return dict(n_estimators=600, learning_rate=0.05, max_depth=6, min_child_weight=1)
    return dict(n_estimators=200, learning_rate=0.05, max_depth=3, min_child_weight=50)


def feature_names(h):
    return CALENDAR_FEATURES + WEATHER_FEATURES + ["feels_change", "feels_change_wk",
            "roll_mean_24", "roll_max_24", "roll_mean_168"] + [f"lag_{k}" for k in lag_hours(h)]


def make_features(d, h):
    """d: hourly DataFrame (datetime index) with 'demand' + WEATHER_FEATURES.
    Returns d with every feature for horizon h. Nothing uses demand newer than t - 24h."""
    d = d.copy().astype(float)
    idx = d.index
    L, wk = 24 * h, week_lag(h)
    d["hour"] = idx.hour
    d["day_of_week"] = idx.dayofweek
    d["month"] = idx.month
    d["is_weekend"] = (idx.dayofweek >= 5).astype(int)
    d["season"] = d["month"].map(SEASON_MAP)
    d["hour_sin"] = np.sin(2 * np.pi * idx.hour / 24)
    d["hour_cos"] = np.cos(2 * np.pi * idx.hour / 24)
    d["doy_sin"] = np.sin(2 * np.pi * idx.dayofyear / 365.25)
    d["doy_cos"] = np.cos(2 * np.pi * idx.dayofyear / 365.25)

    for k in lag_hours(h):
        d[f"lag_{k}"] = d["demand"].shift(k)
    past = d["demand"].shift(L)                       # newest demand value we may use
    d["roll_mean_24"] = past.rolling(24).mean()
    d["roll_max_24"] = past.rolling(24).max()
    d["roll_mean_168"] = past.rolling(168).mean()
    d["feels_change"] = d["nat_feels"] - d["nat_feels"].shift(L)       # hotter/colder than then?
    d["feels_change_wk"] = d["nat_feels"] - d["nat_feels"].shift(wk)
    return d

def forecast_day(history, day, models, threshold_mw=None):
    """Forecast the 24 hours of `day`.

    history : hourly DataFrame with 'demand' (NaN where unknown) and WEATHER_FEATURES
              (weather must exist for `day`, e.g. from a weather forecast).
    models  : dict {h: fitted model} for h = 1..14 (each predicts demand - base_col(h)).
    Uses horizon h = days between `day` and the last day with complete demand data.
    Returns (pd.Series of 24 forecasts in MW, info dict).
    """
    day = pd.Timestamp(day).normalize()
    hours = pd.date_range(day, periods=24, freq="h")
    known = history["demand"].loc[: day - pd.Timedelta(hours=1)].dropna()
    if known.empty:
        raise ValueError("No demand history before this date.")
    # last calendar day whose 24 hours of demand are all known
    counts = known.groupby(known.index.normalize()).size()
    full_days = counts[counts >= 23].index
    if len(full_days) == 0:
        raise ValueError("No complete day of demand data found.")
    last_full = full_days.max()
    h = int((day - last_full).days)
    if h < 1 or h not in models:
        raise ValueError(f"Date is {h} days after the newest complete demand data ({last_full.date()}); "
                         f"forecasts are available 1-{max(models)} days ahead.")

    window = pd.date_range(day - pd.Timedelta(days=40), hours[-1], freq="h")
    d = history.reindex(window)[["demand"] + WEATHER_FEATURES].copy()
    d.loc[d.index > last_full + pd.Timedelta(hours=23), "demand"] = np.nan   # never peek past last_full
    X = make_features(d, h).loc[hours, feature_names(h)].astype(float)
    if X[WEATHER_FEATURES].isna().any().any():
        raise ValueError(f"Weather data missing for {day.date()}.")
    if X.isna().any().any():
        bad = X.columns[X.isna().any()].tolist()
        raise ValueError(f"Not enough continuous demand history before {day.date()} (missing: {bad}).")
    pred = models[h].predict(X) + X[base_col(h)].values
    return pd.Series(pred, index=hours, name="forecast_MW"), {"horizon_days": h, "last_demand_date": str(last_full.date())}


def rolling_threshold(demand, day, quantile=0.99, window_days=365, min_days=90):
    """Grid limit for `day` = the top-1% demand level of the past year (known data only).
    Keeps up with demand growth. Returns None if there isn't enough history."""
    day = pd.Timestamp(day).normalize()
    past = demand.loc[day - pd.Timedelta(days=window_days): day - pd.Timedelta(hours=1)].dropna()
    if len(past) < 24 * min_days:
        return None
    return float(past.quantile(quantile))
