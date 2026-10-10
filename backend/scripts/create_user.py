"""
Add (or update) an authority user who is allowed to log in.

Run from the backend/ folder:
    python scripts/create_user.py --email planner@authority.gov --name "Asha Verma" --role planner
You'll be asked for the password (it is never shown or stored in plain text).

Disable a user:   python scripts/create_user.py --email planner@authority.gov --disable
List users:       python scripts/create_user.py --list
"""
import argparse
import getpass
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from app import config                      # noqa: E402
from app.auth import hash_password          # noqa: E402

p = argparse.ArgumentParser(description="Manage Peak-Grid users")
p.add_argument("--email")
p.add_argument("--name", default="")
p.add_argument("--role", default="operator", choices=["operator", "planner", "admin"])
p.add_argument("--organization", default="Grid Authority")
p.add_argument("--password", help="(optional) otherwise you'll be prompted")
p.add_argument("--disable", action="store_true")
p.add_argument("--list", action="store_true")
a = p.parse_args()

users = json.loads(config.USERS_FILE.read_text()) if config.USERS_FILE.exists() else []

if a.list:
    for u in users:
        print(f"{u['email']:<40} {u.get('role',''):<9} {'active' if u.get('active', True) else 'DISABLED'}  {u.get('name','')}")
    sys.exit()
if not a.email:
    p.error("--email is required")

email = a.email.strip().lower()
existing = next((u for u in users if u["email"].lower() == email), None)

if a.disable:
    if not existing:
        sys.exit(f"No user {email}")
    existing["active"] = False
else:
    pw = a.password or getpass.getpass("Password (min 10 characters): ")
    if len(pw) < 10:
        sys.exit("Password must be at least 10 characters.")
    record = {"email": email, "name": a.name, "role": a.role, "organization": a.organization,
              "password_hash": hash_password(pw), "active": True}
    if existing:
        existing.update(record)
    else:
        users.append(record)

config.USERS_FILE.write_text(json.dumps(users, indent=2))
print(f"Saved {email} -> {config.USERS_FILE}")
