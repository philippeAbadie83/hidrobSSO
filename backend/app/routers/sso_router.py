"""
HidroSSO — SSO Router
POST /auth/ms-login      → MS365 access_token → crea sesión en Redis
POST /auth/sso-launch    → session_id + app_id → launch token 60s
GET  /auth/sso-exchange  → lt → session_id (one-time)
GET  /auth/session-info  → session_id → user info + renueva TTL
"""
import json
import secrets
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from app.services.redis_service import redis_service
from app.services.azure_ad import azure_ad_service
from app.services.roles import roles_service
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["SSO"])

LAUNCH_TTL    = 60
LAUNCH_PREFIX = "sso_launch:"

ALLOWED_APPS = {
    "costeo360":    "https://costeo360.hidrobart.com/auth/sso",
    "cortex":       "https://cortex.hidrobart.com/auth/sso",
    "unidum":       "https://unidum.hidrobart.com/auth/sso",
    "crm2":         "https://crm2.hidrobart.com/auth/sso",
    "hidropluspro": "https://hidropluspro.hidrobart.com/auth/sso",
}

# ── Schemas ───────────────────────────────────────────────────────────────────
class MsLoginRequest(BaseModel):
    access_token: str

class SsoLaunchRequest(BaseModel):
    session_id: str
    app_id: str

class LaunchResponse(BaseModel):
    redirect_url: str

class ExchangeResponse(BaseModel):
    session_id: str


# ── 1. Login con token MS365 ──────────────────────────────────────────────────
@router.post("/ms-login")
async def ms_login(body: MsLoginRequest):
    """
    Acepta el access_token de MS365 (desde NextAuth),
    obtiene perfil + grupos via Graph, crea sesión en Redis.
    """
    try:
        ms_profile = await azure_ad_service.get_user_profile(body.access_token)
        ms_groups  = await azure_ad_service.get_user_groups(body.access_token)
    except Exception as e:
        logger.warning(f"ms-login: token inválido — {e}")
        raise HTTPException(status_code=401, detail="Token MS365 inválido")

    email = ms_profile.get("mail") or ms_profile.get("userPrincipalName", "")
    if not azure_ad_service.validate_user_domain(email):
        raise HTTPException(status_code=403, detail="Dominio no autorizado")

    user_id   = ms_profile.get("id", "")
    user_name = ms_profile.get("displayName", email.split("@")[0])
    tenant    = email.split("@")[1] if "@" in email else ""

    org_roles = azure_ad_service.map_groups_to_org_roles(ms_groups)
    roles     = await roles_service.get_user_roles(
        user_id=user_id, org_roles=org_roles, access_token=body.access_token
    )
    roles.tenant = tenant

    session_id   = secrets.token_urlsafe(32)
    session_data = {
        "session_id": session_id,
        "user_id":    user_id,
        "email":      email,
        "name":       user_name,
        "given_name": ms_profile.get("givenName", ""),
        "surname":    ms_profile.get("surname", ""),
        "job_title":  ms_profile.get("jobTitle", ""),
        "department": ms_profile.get("department", ""),
        "tenant":     tenant,
        "roles":      roles.model_dump(),
    }
    if not await redis_service.create_session(session_id, session_data):
        raise HTTPException(status_code=503, detail="Redis no disponible")

    # Índice user_id → session_id
    client = await redis_service.get_client()
    await client.setex(
        f"{settings.REDIS_KEY_PREFIX}user_session:{user_id}",
        settings.SESSION_TTL_SECONDS,
        session_id,
    )

    logger.info(f"ms-login OK: {email}")
    return {
        "session_id": session_id,
        "email":      email,
        "name":       user_name,
        "tenant":     tenant,
        "roles":      roles.model_dump(),
    }


# ── 2. Crear launch token ─────────────────────────────────────────────────────
@router.post("/sso-launch", response_model=LaunchResponse)
async def sso_launch(body: SsoLaunchRequest):
    """
    Crea un launch token de 60s para redirigir al usuario a otra app.
    Llamado desde Next.js de HidroSSO (server-to-server).
    """
    app_id = body.app_id.lower()
    if app_id not in ALLOWED_APPS:
        raise HTTPException(status_code=400, detail=f"App '{app_id}' no registrada")

    session = await redis_service.get_session(body.session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Sesión no encontrada o expirada")

    lt     = f"lt_{secrets.token_urlsafe(20)}"
    client = await redis_service.get_client()
    await client.setex(
        f"{settings.REDIS_KEY_PREFIX}{LAUNCH_PREFIX}{lt}",
        LAUNCH_TTL,
        json.dumps({
            "session_id": body.session_id,
            "app_id":     app_id,
            "issued_at":  datetime.now(timezone.utc).isoformat(),
        }),
    )
    logger.info(f"sso-launch: {app_id} lt={lt[:12]}...")
    return LaunchResponse(redirect_url=f"{ALLOWED_APPS[app_id]}?lt={lt}")


# ── 3. Intercambiar launch token ──────────────────────────────────────────────
@router.get("/sso-exchange", response_model=ExchangeResponse)
async def sso_exchange(lt: str = Query(...)):
    """
    Intercambia launch token (one-time, 60s) por session_id.
    Llamado server-to-server desde la app destino.
    """
    if not lt.startswith("lt_"):
        raise HTTPException(status_code=400, detail="Launch token inválido")

    client = await redis_service.get_client()
    key    = f"{settings.REDIS_KEY_PREFIX}{LAUNCH_PREFIX}{lt}"
    raw    = await client.get(key)
    if not raw:
        raise HTTPException(status_code=401, detail="Launch token expirado o ya usado")

    try:
        await client.delete(key)
    except Exception as e:
        # Azure Cache for Redis puede responder MOVED en cluster mode.
        # El token tiene TTL de 60s — expirará solo. Continuamos igual.
        logger.warning(f"sso-exchange: no se pudo borrar lt (expirará en {LAUNCH_TTL}s): {e}")
    data = json.loads(raw)
    logger.info(f"sso-exchange OK: app={data.get('app_id')}")
    return ExchangeResponse(session_id=data["session_id"])


# ── 4. Validar sesión ─────────────────────────────────────────────────────────
@router.get("/session-info")
async def session_info(sid: str = Query(...)):
    """
    Valida session_id y retorna info del usuario + renueva TTL.
    Usado por apps que necesitan validar la cookie hidrosso_sid.
    """
    session = await redis_service.get_session(sid)
    if not session:
        raise HTTPException(status_code=401, detail="Sesión no encontrada o expirada")

    await redis_service.refresh_session_ttl(sid)
    return {
        "valid":      True,
        "session_id": sid,
        "user_id":    session.get("user_id"),
        "email":      session.get("email"),
        "name":       session.get("name"),
        "tenant":     session.get("tenant"),
        "job_title":  session.get("job_title"),
        "department": session.get("department"),
        "roles":      session.get("roles", {}),
    }
