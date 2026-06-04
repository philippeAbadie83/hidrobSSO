"""
Seguridad: JWT, validación de tokens Azure AD, hashing
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, Any
import httpx
import jwt
from jwt import PyJWKClient
from functools import lru_cache

from app.core.config import settings


# ── JWKS para validar tokens de Microsoft ────────────────────────────────────
MICROSOFT_JWKS_URI = (
    "https://login.microsoftonline.com/common/discovery/v2.0/keys"
)


@lru_cache(maxsize=1)
def get_jwks_client() -> PyJWKClient:
    return PyJWKClient(MICROSOFT_JWKS_URI, cache_keys=True)


def create_session_token(
    user_id: str,
    email: str,
    tenant: str,
    roles: dict,
    extra: dict | None = None,
) -> str:
    """Genera el JWT interno de sesión Hidrobart."""
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "tenant": tenant,
        "roles": roles,          # {"org": [...], "functional": [...], "process": [...]}
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "iss": "hidrobart-auth",
        "aud": "hidrobart-apps",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    """Genera refresh token de larga duración."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(seconds=settings.REFRESH_TOKEN_TTL_SECONDS),
        "iss": "hidrobart-auth",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_session_token(token: str) -> dict:
    """Decodifica y valida el JWT interno."""
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        audience="hidrobart-apps",
        issuer="hidrobart-auth",
    )


def validate_microsoft_token(id_token: str) -> dict:
    """Valida el id_token emitido por Azure AD usando JWKS público."""
    jwks_client = get_jwks_client()
    signing_key = jwks_client.get_signing_key_from_jwt(id_token)
    data = jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=settings.AZURE_CLIENT_ID,
        options={"verify_exp": True},
    )
    return data


def is_allowed_domain(email: str) -> bool:
    """Verifica que el email pertenece a un dominio Hidrobart autorizado."""
    domain = email.split("@")[-1].lower()
    return domain in [d.lower() for d in settings.ALLOWED_DOMAINS]


async def get_microsoft_graph_user(access_token: str) -> dict:
    """Obtiene perfil del usuario desde Microsoft Graph API."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()


async def get_user_groups(access_token: str) -> list[dict]:
    """Obtiene los grupos de Azure AD del usuario (roles de org)."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://graph.microsoft.com/v1.0/me/memberOf?$select=id,displayName,description",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("value", [])
