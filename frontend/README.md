# Peak-Grid frontend (React + Vite + Tailwind CSS + Recharts) — All-India

Dashboard for the electricity authority. Talks to the FastAPI backend in `../backend`.

| Page | URL | Login? | What it shows |
|---|---|---|---|
| Home | `/` | no | What Peak-Grid does, how it works, model accuracy |
| Login | `/login` | — | Sign-in for authority staff |
| Dashboard | `/dashboard?date=2026-05-21` | yes | Stat cards, hourly forecast vs actual (coloured by risk), grid limit, peak periods, forecast accuracy, weather, last 14 days, hourly table; 1/3/7-day view |
| Optimization | `/optimization?date=2026-05-21` | yes | Sliders for plan settings, before/after demand chart, where the load goes, action list, reality check |
| Data | `/data` | yes | Data freshness, refresh weather/demand, upload demand CSV, accuracy vs data age |

Also: dark mode toggle, mobile layout with slide-out menu, automatic logout when the session expires.

## Run it (two terminals)

**Terminal 1: backend** (from `peak-grid/backend`)
```bash
../.venv/bin/python -m uvicorn app.main:app --reload
```

**Terminal 2: frontend** (from `peak-grid/frontend`)
```bash
npm install        # first time only
npm run dev
```
Open **http://localhost:5173** → *Authority login* → *Fill in demo credentials* → *Sign in*. Use **Today/Tomorrow** for live forecasts or *Replay a past day…* to check accuracy.

Needs **Node.js 18 or newer** (`node --version`). Install from https://nodejs.org or `brew install node`.

## Configuration

Copy `.env.example` to `.env` to change settings:

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_URL` | `http://127.0.0.1:8000` | Where the backend runs (change to your AWS URL later) |
| `VITE_SHOW_DEMO_LOGIN` | `true` | Set to `false` to hide the demo-credentials box |

If you serve the frontend from a different address, add it to the backend's `ALLOWED_ORIGINS`.

## Structure

```
src/
├── api/client.js            all backend calls + login token handling
├── context/                 AuthContext (login state), ThemeContext (dark mode)
├── hooks/useSelectedDate.js selected date kept in the URL (?date=), shared by pages
├── components/
│   ├── layout/              Sidebar, Header, AppLayout
│   ├── ui/                  StatCard, Badge, DateControl, Icons, loading/error boxes
│   └── charts/              DemandChart, PlanChart, ShiftChart, WeatherChart, HistoryChart
└── pages/                   Home, Login, Dashboard, Optimization, NotFound
```

## Build for deployment

```bash
npm run build      # creates dist/ — static files you can host on AWS Amplify or S3 + CloudFront
```
