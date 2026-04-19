"""
Hidrobart Auth SDK — Python/FastAPI
Copiar este archivo a cualquier app FastAPI para integrarse con el login centralizado.

USO:
    from hidrobart_auth import HidrobartAuthDep, require_permission

    @app.get("/mi-ruta")
    async def mi_ruta(user = Depends(HidrobartAuthDep)):
        return {"mensaje": f"Hola {user.email}"}

    @app.post("/aprobar")
    async def aprobar(user = Depends(require_permission("hidroplus", "aprobar"))):
        return {"ok": True}
"""
import httpx
import logging
from dataclasses import dataclass, field
from typing import Optional
from functools import lru_cache
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)


@dataclass
class HidrobartRoles:
    org: list[str] = field(default_factory=list)
    functional: list[str] = field(default_factory=list)
    process: dict[str, list[str]] = field(default_factory=dict)
    tenant: str = ""


@dataclass
class HidrobartUser:
    id: str
    email: str
    name: str
    tenant: str
    domain: str
    roles: HidrobartRoles
    job_title: str = ""
    department: str = ""


class HidrobartAuthClient:
    def __init__(self, auth_api_url: str, timeout: float = 5.0):
        self.auth_api_url = auth_api_url.rstrip("/")
        self.timeout = timeout

    async def validate_token(self, token: str) -> Optional[HidrobartUser]:
        """Valida token contra el servicio central de auth."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    f"{self.auth_api_url}/auth/validate",
                    json={"token": token},
                )
                if resp.status_code != 200:
                    return None
                data = resp.json()
                if not data.get("valid"):
                    return None

                user_data = data.get("user", {})
                roles_data = data.get("roles", {})

                return HidrobartUser(
                    id=user_data.get("id", ""),
                    email=user_data.get("email", ""),
                    name=user_data.get("name", ""),
                    tenant=user_data.get("tenant", ""),
                    domain=user_data.get("domain", ""),
                    job_title=user_data.get("job_title", ""),
                    department=user_data.get("department", ""),
                    roles=HidrobartRoles(
                        org=roles_data.get("org", []),
                        functional=roles_data.get("functional", []),
                        process=roles_data.get("process", {}),
                        tenant=roles_data.get("tenant", ""),
                    ),
                )
        except Exception as e:
            logger.warning(f"Auth validation error: {e}")
            return None

    def has_permission(self, user: HidrobartUser, module: str, permission: str) -> bool:
        return permission in user.roles.process.get(module, [])

    def is_admin(self, user: HidrobartUser) -> bool:
        return any(r in user.roles.org for r in ["SuperAdmin", "Admin"])

    def is_manager(self, user: HidrobartUser) -> bool:
        return any(r in user.roles.org for r in ["SuperAdmin", "Admin", "Manager"])


# ── FastAPI Dependencies ──────────────────────────────────────────────────────

import os

_auth_client: Optional[HidrobartAuthClient] = None

def get_auth_client() -> HidrobartAuthClient:
    global _auth_client
    if _auth_client is None:
        url = os.getenv("AUTH_API_URL", "http://localhost:8000")
        _auth_client = HidrobartAuthClient(auth_api_url=url)
    return _auth_client


bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    auth_client: HidrobartAuthClient = Depends(get_auth_client),
) -> HidrobartUser:
    """Dependency: obtiene y valida el usuario del Bearer token."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Token de autenticación requerido")

    user = await auth_client.validate_token(credentials.credentials)
    if not user:
        raise HTTPException(status_code=401, detail="Token inválido o sesión expirada")

    return user


# Alias
HidrobartAuthDep = Depends(get_current_user)


def require_permission(module: str, permission: str):
    """
    Dependency factory: requiere un permiso específico.

    Ejemplo:
        @app.get("/ruta")
        async def ruta(user = Depends(require_permission("hidroplus", "aprobar"))):
            ...
    """
    async def _dep(
        user: HidrobartUser = Depends(get_current_user),
        auth_client: HidrobartAuthClient = Depends(get_auth_client),
    ) -> HidrobartUser:
        if not auth_client.has_permission(user, module, permission):
            raise HTTPException(
                status_code=403,
                detail=f"Sin permiso '{permission}' en módulo '{module}'",
            )
        return user

    return Depends(_dep)


def require_admin():
    """Dependency: requiere rol Admin o SuperAdmin."""
    async def _dep(
        user: HidrobartUser = Depends(get_current_user),
        auth_client: HidrobartAuthClient = Depends(get_auth_client),
    ) -> HidrobartUser:
        if not auth_client.is_admin(user):
            raise HTTPException(status_code=403, detail="Acceso restringido a administradores")
        return user

    return Depends(_dep)
