# Peak-Grid backend (FastAPI) — All-India, live + replay

```
backend/
├── app/
│   ├── main.py        ← endpoints
│   ├── services.py    ← forecasting, peak detection, optimisation, data status
│   ├── live_data.py   ← fetches weather (Open-Meteo) + demand (Grid-Sentinel), CSV upload
│   ├── auth.py        ← password hashing + JWT login tokens
│   ├── schemas.py, config.py
├── grid_forecast.py   ← national features + 14 horizon models logic (from Notebook 3)
├── peak_optimizer.py  ← the load-shifting optimiser (from Notebook 2)
├── national/          ← production/h1..h14.pkl, backtest/h1..h14.pkl, national_history.csv, national_config.json
├── data/live/         ← newer demand/weather fetched or uploaded at runtime (created automatically)
├── users.json         ← who may log in (hashed passwords only)
├── scripts/create_user.py
└── tests/             ← pytest (runs offline: network calls are faked)
```

## Run

```bash
cd backend
../.venv/bin/python -m uvicorn app.main:app --reload
```
On startup it loads the models, then **fetches the latest weather forecast and demand data in the background** (set `AUTO_REFRESH=0` to disable). Docs: http://127.0.0.1:8000/docs

Demo login (local only): `operator@gridauthority.demo` / `Demo@Grid2026` (role: planner)

## How a date is forecast

| Date | Mode | Model |
|---|---|---|
| In the past, demand known | **Replay**: forecast vs actual | Backtest models for the test year (never saw those dates); production models before that |
| After the newest demand data (today, coming days) | **Live** | Production model for horizon *h* = days since the newest complete demand day (1–14) |

Forecasts need weather for the date (observed or forecast) and demand data **at most 14 days old**. Typical error: ~2.3% with 1-day-old data → ~4.5% with 2-week-old data (see `national/national_config.json` → `test_metrics`).

**Grid limit:** rolling — the top-1% demand level of the 365 days before each date (keeps up with demand growth). To use a fixed capacity instead: `export GRID_LIMIT_MW=250000`.

## Endpoints

| Method | Path | Who | What |
|---|---|---|---|
| GET | `/` | public | Introduction, accuracy, data freshness |
| POST | `/login` | public | `{email, password}` → token (8 h) |
| GET | `/dashboard?date=YYYY-MM-DD&days=1..7` | logged in | Hourly forecast, actual (replay), risk, peak periods, weather, accuracy, last 14 days. No date → today if available |
| GET | `/optimization?date=…&flex_share=0.1&max_shift_hours=3&safety_margin_mw=5000` | logged in | Load-shifting plan, action list, before/after, reality check (replay) |
| GET | `/data/status` | logged in | Newest demand day + age, weather range, forecastable dates, accuracy by horizon, recent activity |
| POST | `/data/refresh?weather=true&demand=true` | planner/admin | Fetch latest weather forecast + demand |
| POST | `/data/upload` (body: CSV text, `Content-Type: text/csv`) | planner/admin | Add newer demand data |
| GET | `/health` | public | Liveness |

**Upload format:** `datetime,demand_MW` (hourly or 15-min, all-India, MW), or Grid-India's `date,time,demand_met_mw`. Values outside 50,000–500,000 MW are rejected (catches GW/kW mix-ups).

## Data sources

- **Weather:** Open-Meteo forecast API (free, no key): last 14 days + next 10 days for 11 cities.
- **Demand:** Grid-India's daily reports (15-min, all-India), as converted to CSV by the Grid-Sentinel project on GitHub. It's updated by that project's daily job, and can lag by several days, so the newest demand data may be up to ~10 days old. For fresher data, upload a CSV (e.g. from the authority's SCADA system).

## Tests

```bash
../.venv/bin/python -m pytest -q      # 18 tests
```

## Users

```bash
../.venv/bin/python scripts/create_user.py --email you@authority.gov --name "Your Name" --role planner
../.venv/bin/python scripts/create_user.py --email operator@gridauthority.demo --disable   # before going public
```
Roles: `operator` (view only), `planner` and `admin` (can refresh/upload data).
