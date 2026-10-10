"""
Login and access control.

- Users live in users.json. Only people added there (the authority's staff) can log in.
- Passwords are NEVER stored. We store a salted PBKDF2-SHA256 hash
  (Python standard library, no extra packages).
- On successful login the user receives a JWT access token. The frontend sends it
  on every request in the header:   Authorization: Bearer <token>
"""
import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import config

PBKDF2_ITERATIONS = 600_000


# ---------- password hashing ----------
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PBKDF2_ITERATIONS, base64.b64encode(salt).decode(), base64.b64encode(digest).decode())


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt_b64, hash_b64 = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(),
                                     base64.b64decode(salt_b64), int(iterations))
        return hmac.compare_digest(digest, base64.b64decode(hash_b64))   # constant-time
    except (ValueError, TypeError):
        return False


# A dummy hash so a login for an unknown email takes as long as for a real one
# (stops attackers discovering which emails exist by timing the response).
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


# ---------- user store ----------
def load_users() -> dict:
    if not config.USERS_FILE.exists():
        return {}
    users = json.loads(config.USERS_FILE.read_text())
    return {u["email"].lower(): u for u in users}


def authenticate(email: str, password: str):
    user = load_users().get(email.strip().lower())
    if user is None or not user.get("active", True):
        verify_password(password, _DUMMY_HASH)
        return None
    return user if verify_password(password, user["password_hash"]) else None


# ---------- JWT tokens ----------
def create_access_token(user: dict) -> tuple[str, int]:
    expires_in = config.TOKEN_EXPIRE_HOURS * 3600
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user["email"].lower(),
        "name": user.get("name", ""),
        "role": user.get("role", "operator"),
        "org": user.get("organization", ""),
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM), expires_in


_bearer = HTTPBearer(auto_error=False)


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    """FastAPI dependency: add `user = Depends(get_current_user)` to protect an endpoint."""
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                 detail="Not logged in or session expired",
                                 headers={"WWW-Authenticate": "Bearer"})
    if creds is None:
        raise unauthorized
    try:
        payload = jwt.decode(creds.credentials, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise unauthorized
    user = load_users().get(payload.get("sub", ""))
    if user is None or not user.get("active", True):      # account removed/disabled after login
        raise unauthorized
    return {"email": payload["sub"], "name": payload.get("name"), "role": payload.get("role"),
            "organization": payload.get("org")}
