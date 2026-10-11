"""Shapes of request/response bodies. FastAPI uses these for validation and for the /docs page."""
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str = Field(..., examples=["you@authority.gov"], max_length=254)
    password: str = Field(..., min_length=1, max_length=256)


class UserOut(BaseModel):
    email: str
    name: str | None = None
    role: str | None = None
    organization: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    user: UserOut
