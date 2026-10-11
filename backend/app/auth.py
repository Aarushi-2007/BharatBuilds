"""
Login and access control. Two modes, chosen by AUTH_MODE (see config.py):

- local    (default): users.json + our own JWTs, described below.
- cognito: AWS Cognito. /login signs in against the user pool and returns the Cognito
           ID token; every request is verified against the pool's public keys (JWKS).
           Roles come from Cognito groups (admin / planner / operator).

Local mode:

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


# ---------- AWS Cognito ----------
_jwk_client = None


def _jwks():
    global _jwk_client
    if _jwk_client is None:
        _jwk_client = jwt.PyJWKClient(config.COGNITO_JWKS_URL, cache_keys=True, lifespan=3600)
    return _jwk_client


def _secret_hash(username: str) -> str:
    msg = (username + config.COGNITO_APP_CLIENT_ID).encode()
    return base64.b64encode(hmac.new(config.COGNITO_APP_CLIENT_SECRET.encode(), msg, hashlib.sha256).digest()).decode()


def cognito_login(email: str, password: str) -> tuple[str, int, dict]:
    """Sign in with the user pool. Returns (id_token, expires_in_seconds, user).
    Raises HTTPException with a safe message on failure."""
    import boto3
    from botocore.exceptions import ClientError

    email = email.strip().lower()
    params = {"USERNAME": email, "PASSWORD": password}
    if config.COGNITO_APP_CLIENT_SECRET:
        params["SECRET_HASH"] = _secret_hash(email)
    try:
        res = boto3.client("cognito-idp", region_name=config.COGNITO_REGION).initiate_auth(
            ClientId=config.COGNITO_APP_CLIENT_ID, AuthFlow="USER_PASSWORD_AUTH", AuthParameters=params)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("NotAuthorizedException", "UserNotFoundException"):    # same message for both
            raise HTTPException(status_code=401, detail="Incorrect email or password")
        if code == "UserNotConfirmedException":
            raise HTTPException(status_code=403, detail="Account not confirmed yet. Check your email.")
        if code == "PasswordResetRequiredException":
            raise HTTPException(status_code=403, detail="Password reset required. Contact your administrator.")
        if code == "TooManyRequestsException" or code == "LimitExceededException":
            raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
        raise HTTPException(status_code=502, detail="Sign-in service unavailable")
    if "AuthenticationResult" not in res:     # e.g. NEW_PASSWORD_REQUIRED challenge
        raise HTTPException(status_code=403,
                            detail="Your account needs a permanent password. Contact your administrator.")
    auth = res["AuthenticationResult"]
    return auth["IdToken"], auth["ExpiresIn"], verify_cognito_token(auth["IdToken"])


def verify_cognito_token(token: str) -> dict:
    """Check signature, issuer, audience and expiry of a Cognito ID token; return our user dict."""
    key = _jwks().get_signing_key_from_jwt(token).key
    claims = jwt.decode(token, key, algorithms=["RS256"], audience=config.COGNITO_APP_CLIENT_ID,
                        issuer=config.COGNITO_ISSUER, options={"require": ["exp", "iss", "aud", "sub"]})
    if claims.get("token_use") != "id":
        raise jwt.InvalidTokenError("not an ID token")
    groups = claims.get("cognito:groups") or []
    role = next((r for r in config.ROLE_PRIORITY if r in groups), config.DEFAULT_ROLE)
    email = (claims.get("email") or claims.get("cognito:username") or claims["sub"]).lower()
    return {"email": email, "name": claims.get("name", ""), "role": role,
            "organization": claims.get("custom:organization", "")}


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
    if config.AUTH_MODE == "cognito":
        try:
            return verify_cognito_token(creds.credentials)
        except (jwt.PyJWTError, KeyError):
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
