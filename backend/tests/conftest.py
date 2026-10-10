"""Test setup: temporary live-data folder + test users, and no network access."""
import json
import os
import sys
import tempfile
from pathlib import Path

TMP = Path(tempfile.mkdtemp(prefix="peakgrid_test_"))
os.environ["LIVE_DIR"] = str(TMP / "live")
os.environ["AUTO_REFRESH"] = "0"
os.environ["USERS_FILE"] = str(TMP / "users.json")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.auth import hash_password  # noqa: E402

(TMP / "users.json").write_text(json.dumps([
    {"email": "operator@gridauthority.demo", "name": "Demo Operator", "role": "planner",
     "organization": "Demo Grid Authority", "password_hash": hash_password("Demo@Grid2026"), "active": True},
    {"email": "viewer@gridauthority.demo", "name": "Viewer", "role": "operator",
     "organization": "Demo Grid Authority", "password_hash": hash_password("Viewer@Grid2026"), "active": True},
]))
