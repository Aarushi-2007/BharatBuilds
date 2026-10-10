"""
FluxGrid API — FastAPI backend for the Weather-Aware Peak-Demand Management System (All-India).

Endpoints
  GET  /               public   introduction to the system
  POST /login          public   authority staff log in -> access token
  GET  /dashboard      login    forecasts, peak risk, chart data (replay for past dates, live for today/future)
  GET  /optimization   login    the load-shifting plan to follow
  GET  /data/status    login    how fresh the demand + weather data are, which dates can be forecast
  POST /data/refresh   planner  fetch the latest weather forecast + demand data
  POST /data/upload    planner  upload newer demand data as CSV
  GET  /health         public   simple liveness check (used by AWS later)

Run (from the backend/ folder):   ../.venv/bin/python -m uvicorn app.main:app --reload
Interactive docs:                  http://127.0.0.1:8000/docs
"""
import logging
import threading
from contextlib import asynccontextmanager

from fastapi import Body, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import config
from .auth import authenticate, create_access_token, get_current_user
from .schemas import LoginRequest, TokenResponse, UserOut
from .services import DateNotAvailable, GridService

log = logging.getLogger("peak-grid")
MAX_UPLOAD_BYTES = 20 * 1024 * 1024


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.grid = GridService()           # load models + data ONCE at startup
    if config.AUTO_REFRESH:                  # fetch live weather + demand in the background
        threading.Thread(target=app.state.grid.refresh, daemon=True).start()
    if config.JWT_SECRET_IS_RANDOM:
        log.warning("JWT_SECRET not set - using a random secret; logins reset when the server restarts.")
    if not config.USERS_FILE.exists():
        log.warning("users.json not found - nobody can log in. Create a user: python scripts/create_user.py")
    yield


app = FastAPI(title="FluxGrid API",
              description="Weather-aware all-India electricity demand forecasting and peak-load optimisation.",
              version="2.0.0", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=config.ALLOWED_ORIGINS, allow_credentials=False,
                   allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])


@app.exception_handler(DateNotAvailable)
async def date_error_handler(request: Request, exc: DateNotAvailable):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


def grid(request: Request) -> GridService:
    return request.app.state.grid


def require_editor(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in config.DATA_EDITOR_ROLES:
        raise HTTPException(status_code=403, detail="Only planners or admins can change data.")
    return user


# ------------------------------------------------------------------ /
@app.get("/", tags=["Public"])
def home(request: Request):
    g = grid(request)
    st = g.status()
    m = g.cfg["test_metrics"]
    return {
        "name": "FluxGrid",
        "tagline": "Smarter energy. Smoother demand.",
        "problem": "Electricity demand spikes on hot days. Covering those few peak hours is expensive "
                   "and can force load-shedding.",
        "how_it_works": [
            {"step": 1, "title": "Forecast",
             "text": "XGBoost models predict all-India demand for every hour, from recent demand and the "
                     "weather forecast for 11 cities across India."},
            {"step": 2, "title": "Detect peaks",
             "text": "Hours above the grid limit (the top-1% demand level of the past year) are flagged PEAK RISK; "
                     "hours within 5% are ELEVATED."},
            {"step": 3, "title": "Optimise",
             "text": "A linear-programming optimiser shifts flexible load (pumps, EV charging, water heating, "
                     "pre-cooling) out of peak hours, never touching essential services."},
            {"step": 4, "title": "Act",
             "text": "Authority staff review the plan, adjust assumptions and issue instructions."},
        ],
        "region": config.REGION_NAME,
        "model_performance": {"day_ahead": m.get("1"), "week_ahead": m.get("7")},
        "data_freshness": {"newest_demand_day": st["newest_complete_demand_day"], "weather_until": st["weather_until"],
                           "today_available": st["today_available"]},
        "endpoints": {"login": "POST /login", "dashboard": "GET /dashboard?date=YYYY-MM-DD",
                      "optimization": "GET /optimization?date=YYYY-MM-DD", "data": "GET /data/status", "docs": "/docs"},
    }


# ------------------------------------------------------------------ /login
@app.post("/login", response_model=TokenResponse, tags=["Auth"])
def login(body: LoginRequest):
    user = authenticate(body.email, body.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token, expires_in = create_access_token(user)
    return TokenResponse(access_token=token, expires_in_seconds=expires_in,
                         user=UserOut(email=user["email"], name=user.get("name"),
                                      role=user.get("role"), organization=user.get("organization")))


# ------------------------------------------------------------------ /dashboard
@app.get("/dashboard", tags=["Authority"])
def dashboard(request: Request,
              date: str | None = Query(None, description="Day to forecast (YYYY-MM-DD). Default: today if available"),
              days: int = Query(1, ge=1, le=7, description="Number of consecutive days (1-7)"),
              user: dict = Depends(get_current_user)):
    g = grid(request)
    return {**g.dashboard(date or g.status()["default_date"], days), "user": user}


# ------------------------------------------------------------------ /optimization
@app.get("/optimization", tags=["Authority"])
def optimization(request: Request,
                 date: str | None = Query(None, description="Day to plan (YYYY-MM-DD). Default: today if available"),
                 flex_share: float | None = Query(None, ge=0.0, le=0.5, description="Share of demand that can be moved"),
                 max_shift_hours: int | None = Query(None, ge=1, le=12, description="Max hours a load may move"),
                 safety_margin_mw: float | None = Query(None, ge=0, le=50000, description="Plan this far below the limit"),
                 curtail_share: float | None = Query(None, ge=0.0, le=0.2, description="Max share that may be reduced"),
                 daily_energy_budget_mwh: float | None = Query(None, gt=0, description="Energy allowed for the day"),
                 user: dict = Depends(get_current_user)):
    g = grid(request)
    res = g.optimization(date or g.status()["default_date"], flex_share, max_shift_hours, safety_margin_mw,
                         curtail_share, daily_energy_budget_mwh)
    return {**res, "user": user}


# ------------------------------------------------------------------ /data
@app.get("/data/status", tags=["Data"])
def data_status(request: Request, user: dict = Depends(get_current_user)):
    return grid(request).status()


@app.post("/data/refresh", tags=["Data"])
def data_refresh(request: Request, weather: bool = Query(True), demand: bool = Query(True),
                 user: dict = Depends(require_editor)):
    g = grid(request)
    if g.refreshing:
        raise HTTPException(status_code=409, detail="A refresh is already running. Try again in a minute.")
    return g.refresh(weather=weather, demand=demand)


@app.post("/data/upload", tags=["Data"])
async def data_upload(request: Request, user: dict = Depends(require_editor),
                      csv_text: str = Body(..., media_type="text/csv",
                                           description="CSV with columns datetime,demand_MW (hourly or 15-min), "
                                                       "or date,time,demand_met_mw")):
    if len(csv_text.encode()) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB).")
    try:
        return grid(request).upload(csv_text, user["email"])
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ------------------------------------------------------------------ /health
@app.get("/health", tags=["Public"])
def health(request: Request):
    g = grid(request)
    return {"status": "ok", "models_loaded": len(g.prod), "backtest_models_loaded": len(g.backtest),
            "newest_demand_hour": str(g.data["demand"].last_valid_index())}
