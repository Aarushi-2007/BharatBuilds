"""
All settings in one place. Values come from environment variables, with
sensible defaults for running locally.

Set them in the terminal before starting the server, e.g.
    export JWT_SECRET="a-long-random-string"
"""
import os
import secrets
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]          # .../backend

NATIONAL_DIR = Path(os.getenv("NATIONAL_DIR", BACKEND_DIR / "national"))   # models + base data from Notebook 3
LIVE_DIR = Path(os.getenv("LIVE_DIR", BACKEND_DIR / "data" / "live"))      # newer demand/weather fetched at runtime
USERS_FILE = Path(os.getenv("USERS_FILE", BACKEND_DIR / "users.json"))

# --- Live data ---
# Fetch the latest weather forecast + demand automatically when the server starts (in the background)
AUTO_REFRESH = os.getenv("AUTO_REFRESH", "1") == "1"
DEMAND_SOURCE_URL = os.getenv(
    "DEMAND_SOURCE_URL",
    "https://raw.githubusercontent.com/HalcyonVector/Grid-Sentinel/main/Dataset/study2_scada.csv")
WEATHER_API_URL = os.getenv("WEATHER_API_URL", "https://api.open-meteo.com/v1/forecast")
TIMEZONE = "Asia/Kolkata"

# --- Authentication ---
# If JWT_SECRET is not set, a random one is generated at startup. That's fine for
# local development, but everyone gets logged out when the server restarts.
# ALWAYS set JWT_SECRET in production (e.g. in AWS Secrets Manager / Lambda env vars).
JWT_SECRET = os.getenv("JWT_SECRET") or secrets.token_urlsafe(48)
JWT_SECRET_IS_RANDOM = os.getenv("JWT_SECRET") is None
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = int(os.getenv("TOKEN_EXPIRE_HOURS", "8"))   # one work shift
DATA_EDITOR_ROLES = {"planner", "admin"}                          # who may refresh/upload data

# --- CORS: which frontend URLs may call this API ---
ALLOWED_ORIGINS = [o.strip() for o in os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173"
).split(",") if o.strip()]

# Optional fixed grid limit (MW). If not set, a rolling limit is used:
# the top-1% demand level of the past 365 days before each date.
FIXED_THRESHOLD_MW = float(os.getenv("GRID_LIMIT_MW")) if os.getenv("GRID_LIMIT_MW") else None

REGION_NAME = "All-India"
