"""
Live data: where the newest demand and weather come from.

  Weather  → Open-Meteo forecast API (free, no key): the last 14 days + the next 10 days, 11 cities
  Demand   → (a) Grid-Sentinel's daily-updated CSV of Grid-India's 15-minute all-India demand
             (b) CSV upload by authority staff (e.g. an export from their SCADA system)

Everything fetched is saved in LIVE_DIR so it survives a server restart.
Only Python's standard library is used for downloads (no extra packages).
"""
import io
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone

import pandas as pd

from . import config

def _gf():
    """Import grid_forecast lazily (it lives in backend/)."""
    import sys
    if str(config.BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(config.BACKEND_DIR))
    import grid_forecast
    return grid_forecast


DEMAND_FILE = "live_demand.csv"
WEATHER_FILE = "live_weather.csv"
LOG_FILE = "refresh_log.json"
MIN_MW, MAX_MW = 50_000, 500_000         # sanity range for all-India demand


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _log(event: dict):
    config.LIVE_DIR.mkdir(parents=True, exist_ok=True)
    path = config.LIVE_DIR / LOG_FILE
    log = json.loads(path.read_text()) if path.exists() else []
    log.insert(0, {"time_utc": _now(), **event})
    path.write_text(json.dumps(log[:30], indent=2))


def read_log():
    path = config.LIVE_DIR / LOG_FILE
    return json.loads(path.read_text()) if path.exists() else []


def _http_get(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "peak-grid/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


# ---------------------------------------------------------------- weather
def fetch_weather_forecast(past_days=14, forecast_days=10):
    """Hourly weather for the 11 cities from Open-Meteo, aggregated like the training data."""
    gf = _gf()
    coords = {
        "delhi": (28.61, 77.21), "lucknow": (26.85, 80.95), "jaipur": (26.91, 75.79),
        "chandigarh": (30.73, 76.78), "ludhiana": (30.90, 75.85), "mumbai": (19.08, 72.88),
        "ahmedabad": (23.02, 72.57), "kolkata": (22.57, 88.36), "chennai": (13.08, 80.27),
        "bengaluru": (12.97, 77.59), "hyderabad": (17.39, 78.49),
    }
    frames = []
    for city, (lat, lon) in coords.items():
        q = urllib.parse.urlencode({
            "latitude": lat, "longitude": lon, "timezone": config.TIMEZONE,
            "hourly": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation",
            "past_days": past_days, "forecast_days": forecast_days})
        js = json.loads(_http_get(f"{config.WEATHER_API_URL}?{q}"))
        df = pd.DataFrame(js["hourly"]).rename(columns={"time": "datetime"})
        df["city"] = city
        frames.append(df)
    return gf.aggregate_weather(pd.concat(frames, ignore_index=True)).dropna()


def save_weather(wide):
    config.LIVE_DIR.mkdir(parents=True, exist_ok=True)
    path = config.LIVE_DIR / WEATHER_FILE
    if path.exists():
        old = pd.read_csv(path, parse_dates=["datetime"], index_col="datetime")
        wide = pd.concat([old, wide])
        wide = wide[~wide.index.duplicated(keep="last")]      # newer forecast replaces older
    wide.sort_index().round(2).to_csv(path, index_label="datetime")
    return wide


# ---------------------------------------------------------------- demand
def scada_to_hourly(df):
    """15-minute rows (date, time, demand_met_mw) → hourly average (needs ≥3 of 4 blocks)."""
    ts = pd.to_datetime(df["date"].astype(str) + " " + df["time"].astype(str), errors="coerce")
    s = pd.Series(pd.to_numeric(df["demand_met_mw"], errors="coerce").values, index=ts).dropna()
    s = s[~s.index.duplicated()]
    h = s.resample("h").agg(["mean", "count"])
    return h.loc[h["count"] >= 3, "mean"].rename("demand")


def fetch_demand_github():
    raw = _http_get(config.DEMAND_SOURCE_URL, timeout=180)
    df = pd.read_csv(io.BytesIO(raw), usecols=["date", "time", "demand_met_mw"], low_memory=False)
    df = df[~df["date"].isin(["2024-11-20", "2025-04-01", "2025-10-02"])]   # documented corrupted days
    return scada_to_hourly(df)


def parse_uploaded_csv(text: str) -> pd.Series:
    """Accepts either:
       datetime,demand_MW            (hourly or 15-minute rows), or
       date,time,demand_met_mw       (Grid-India / Grid-Sentinel 15-minute format)."""
    df = pd.read_csv(io.StringIO(text))
    cols = {c.lower().strip(): c for c in df.columns}
    if {"date", "time", "demand_met_mw"} <= set(cols):
        s = scada_to_hourly(df.rename(columns={cols["date"]: "date", cols["time"]: "time",
                                               cols["demand_met_mw"]: "demand_met_mw"}))
    else:
        tcol = next((cols[c] for c in ("datetime", "timestamp", "time") if c in cols), None)
        vcol = next((cols[c] for c in ("demand_mw", "demand", "demand_met_mw", "mw") if c in cols), None)
        if tcol is None or vcol is None:
            raise ValueError("CSV needs columns 'datetime' and 'demand_MW' (or 'date','time','demand_met_mw').")
        ts = pd.to_datetime(df[tcol], errors="coerce")
        vals = pd.to_numeric(df[vcol], errors="coerce")
        if ts.isna().any():
            raise ValueError(f"{int(ts.isna().sum())} rows have an unreadable datetime.")
        s = pd.Series(vals.values, index=ts).dropna()
        s = s[~s.index.duplicated(keep="last")].sort_index()
        hourly = s.resample("h").agg(["mean", "count"])
        s = hourly.loc[hourly["count"] > 0, "mean"].rename("demand")
    if s.empty:
        raise ValueError("No valid demand rows found.")
    bad = s[(s < MIN_MW) | (s > MAX_MW)]
    if len(bad):
        raise ValueError(f"{len(bad)} values are outside {MIN_MW:,}–{MAX_MW:,} MW (all-India demand). "
                         f"First: {bad.index[0]} = {bad.iloc[0]:,.0f}. Is the unit MW?")
    return s


def save_demand(series):
    config.LIVE_DIR.mkdir(parents=True, exist_ok=True)
    path = config.LIVE_DIR / DEMAND_FILE
    if path.exists():
        old = pd.read_csv(path, parse_dates=["datetime"], index_col="datetime")["demand"]
        series = pd.concat([old, series])
        series = series[~series.index.duplicated(keep="last")]
    series.sort_index().round(1).to_frame("demand").to_csv(path, index_label="datetime")


def load_live():
    """Return (demand Series or None, weather DataFrame or None) saved in LIVE_DIR."""
    d = config.LIVE_DIR / DEMAND_FILE
    w = config.LIVE_DIR / WEATHER_FILE
    dem = pd.read_csv(d, parse_dates=["datetime"], index_col="datetime")["demand"] if d.exists() else None
    wea = pd.read_csv(w, parse_dates=["datetime"], index_col="datetime") if w.exists() else None
    return dem, wea
