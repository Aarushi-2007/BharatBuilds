"""
Automated tests for the API.  Run from the backend/ folder:   ../.venv/bin/python -m pytest -q
Network calls (weather API, GitHub) are replaced by fake data, so tests run offline.
"""
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import live_data
from app.main import app

PLANNER = {"email": "operator@gridauthority.demo", "password": "Demo@Grid2026"}
VIEWER = {"email": "viewer@gridauthority.demo", "password": "Viewer@Grid2026"}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def token(client, who):
    r = client.post("/login", json=who)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def planner(client):
    return token(client, PLANNER)


# ---------- public ----------
def test_home_and_health(client):
    assert client.get("/").json()["region"] == "All-India"
    h = client.get("/health").json()
    assert h["status"] == "ok" and h["models_loaded"] == 14


# ---------- login ----------
def test_login_wrong_password_and_unknown_user_look_the_same(client):
    a = client.post("/login", json={"email": PLANNER["email"], "password": "nope-nope-1"})
    b = client.post("/login", json={"email": "nobody@x.com", "password": "nope-nope-1"})
    assert a.status_code == b.status_code == 401 and a.json() == b.json()


@pytest.mark.parametrize("path", ["/dashboard", "/optimization", "/data/status"])
def test_requires_login(client, path):
    assert client.get(path).status_code == 401
    assert client.get(path, headers={"Authorization": "Bearer fake"}).status_code == 401


# ---------- dashboard ----------
def test_dashboard_replay_uses_honest_model(client, planner):
    day = client.get("/dashboard", params={"date": "2026-05-21"}, headers=planner).json()["days"][0]
    assert day["mode"] == "replay" and day["horizon_days"] == 1
    assert "backtest" in day["model_used"] and day["accuracy"] is not None
    assert len(day["hourly"]) == 24 and all(h["actual_MW"] is not None for h in day["hourly"])


def test_dashboard_live_beyond_newest_demand(client, planner):
    r = client.get("/dashboard", params={"date": "2026-09-30", "days": 3}, headers=planner).json()
    assert [d["horizon_days"] for d in r["days"]] == [1, 2, 3]
    assert all(d["mode"] == "live" and d["accuracy"] is None for d in r["days"])
    assert all(h["actual_MW"] is None for h in r["days"][0]["hourly"])


# ---------- optimization ----------
def test_optimization_replay_conserves_energy(client, planner):
    b = client.get("/optimization", params={"date": "2026-05-21"}, headers=planner).json()
    assert b["status"] == "ok" and len(b["actions"]) > 0 and b["replay_check"] is not None
    assert b["summary"]["optimized_peak_MW"] <= b["summary"]["original_peak_MW"]
    assert abs(sum(h["forecast_MW"] for h in b["hourly"]) - sum(h["optimized_MW"] for h in b["hourly"])) < 100


def test_optimization_quiet_day_no_actions(client, planner):
    b = client.get("/optimization", params={"date": "2026-10-02"}, headers=planner).json()
    assert b["status"] == "ok" and b["actions"] == []


def test_optimization_budget_infeasible(client, planner):
    b = client.get("/optimization", params={"date": "2026-05-21", "daily_energy_budget_mwh": 1000}, headers=planner).json()
    assert b["status"] == "infeasible"


@pytest.mark.parametrize("path,params", [("/dashboard", {"date": "2031-01-01"}), ("/dashboard", {"date": "nope"}),
                                         ("/optimization", {"date": "2026-05-21", "flex_share": 2})])
def test_bad_inputs(client, planner, path, params):
    assert client.get(path, params=params, headers=planner).status_code == 422


# ---------- data: status, upload, refresh ----------
def test_status(client, planner):
    s = client.get("/data/status", headers=planner).json()
    assert s["newest_complete_demand_day"] == "2026-09-29" and "accuracy_by_horizon" in s


def test_viewer_cannot_change_data(client):
    viewer = token(client, VIEWER)
    assert client.post("/data/refresh", headers=viewer).status_code == 403
    assert client.post("/data/upload", content="datetime,demand_MW\n", headers={**viewer, "Content-Type": "text/csv"}).status_code == 403


def test_upload_rejects_wrong_units(client, planner):
    csv = "datetime,demand_MW\n2026-09-30 00:00,180.5\n2026-09-30 01:00,175.2\n"   # GW instead of MW
    r = client.post("/data/upload", content=csv, headers={**planner, "Content-Type": "text/csv"})
    assert r.status_code == 422 and "MW" in r.json()["detail"]


def test_upload_makes_forecast_fresher(client, planner):
    # Fake "new" day: copy 29 Sep's hourly shape onto 30 Sep (TEST DATA ONLY)
    grid = client.app.state.grid
    prev = grid.data["demand"].loc["2026-09-29"]
    rows = "\n".join(f"{(t + pd.Timedelta(days=1)):%Y-%m-%d %H:%M},{v:.1f}" for t, v in prev.items())
    r = client.post("/data/upload", content="datetime,demand_MW\n" + rows, headers={**planner, "Content-Type": "text/csv"})
    assert r.status_code == 200, r.text
    assert r.json()["status"]["newest_complete_demand_day"] == "2026-09-30"
    day = client.get("/dashboard", params={"date": "2026-10-01"}, headers=planner).json()["days"][0]
    assert day["horizon_days"] == 1                     # fresher data -> 1-day-ahead model


def test_refresh_extends_forecast_range(client, planner, monkeypatch):
    grid = client.app.state.grid
    last_w = grid.data[["nat_temp"]].dropna().index.max()
    idx = pd.date_range(last_w - pd.Timedelta(days=14), last_w + pd.Timedelta(days=10), freq="h")
    fake = pd.DataFrame({c: np.resize(grid.data[c].dropna().values[-240:], len(idx))
                         for c in ["nat_temp", "nat_humidity", "nat_feels", "nat_rain", "nat_cdh", "nat_hdh",
                                   "feels_north", "feels_west", "feels_south", "feels_east"]}, index=idx)
    monkeypatch.setattr(live_data, "fetch_weather_forecast", lambda: fake)
    monkeypatch.setattr(live_data, "fetch_demand_github", lambda: pd.Series(dtype=float))
    r = client.post("/data/refresh", headers=planner)
    assert r.status_code == 200 and r.json()["weather"]["ok"] is True
    new_last = pd.Timestamp(r.json()["status"]["forecast_range"]["last"])
    assert new_last > last_w.normalize()
