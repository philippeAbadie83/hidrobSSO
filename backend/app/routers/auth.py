"""
Router Auth — endpoints de autenticación
POST /auth/login-url   → genera URL de Azure AD
POST /auth/callback    → intercambia code por sesión
POST /auth/validate    → valida token (usado por todas las apps)
POST /auth/refresh     → renueva sesión
POST /auth/logout      → cierra sesión en Redis
GET  /auth/me          → perfil del usuario autenticado
"""
import secrets
import hashlib
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from app.core.config import settings
from app.core.security import (
    create_session_token,
    create_refresh_token,
    decode_session_token,
)
from app.services.azure_ad import azure_ad_service
from app.services.redis_service import redis_service
from app.services.roles import roles_service
from app.models.user import (
    UserProfile,
    UserRoles,
    ValidateTokenRequest,
    ValidateTokenResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Schemas locales ──────────────────────────────────────────────────────────

class LoginUrlRequest(BaseModel):
    redirect_uri: Optional[str] = None
    return_to: Optional[str] = None   # URL de la app que pide el login


class LoginUrlResponse(BaseModel):
    auth_url: str
    state: str


class CallbackRequest(BaseModel):
    code: str
    state: str
    redirect_uri: Optional[str] = None
    session_state: Optional[str] = None


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/login-url", response_model=LoginUrlResponse)
async def get_login_url(body: LoginUrlRequest, request: Request):
    """
    Genera la URL de login de Azure AD.
    El frontend llama este endpoint y redirige al usuario a la URL retornada.
    """
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    redirect_uri = body.redirect_uri or settings.AZURE_REDIRECT_URI

    # Guardar state en Redis (anti-CSRF, TTL 10 min)
    client = await redis_service.get_client()
    await client.setex(
        f"{settings.REDIS_KEY_PREFIX}oauth_state:{state}",
        600,
        nonce,
    )

    auth_url = azure_ad_service.get_authorization_url(
        redirect_uri=redirect_uri,
        state=state,
        nonce=nonce,
    )

    return LoginUrlResponse(auth_url=auth_url, state=state)


@router.post("/callback")
async def auth_callback(body: CallbackRequest, request: Request):
    """
    Callback de Azure AD.
    1. Valida state (anti-CSRF)
    2. Intercambia code por tokens Microsoft
    3. Obtiene perfil y grupos del usuario
    4. Crea sesión en Redis
    5. Genera JWT interno Hidrobart
    """
    # 1. Validar state anti-CSRF
    client = await redis_service.get_client()
    state_key = f"{settings.REDIS_KEY_PREFIX}oauth_state:{body.state}"
    stored_nonce = await client.get(state_key)

    if not stored_nonce:
        raise HTTPException(status_code=400, detail="State inválido o expirado")
    await client.delete(state_key)  # Use once

    # 2. Intercambiar code por tokens
    redirect_uri = body.redirect_uri or settings.AZURE_REDIRECT_URI
    try:
        token_result = await azure_ad_service.exchange_code_for_tokens(
            code=body.code,
            redirect_uri=redirect_uri,
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    access_token = token_result.get("access_token", "")
    id_token_claims = token_result.get("id_token_claims", {})

    # 3. Validar dominio Hidrobart
    email = id_token_claims.get(
        "preferred_username",
        id_token_claims.get("email", ""),
    )
    if not azure_ad_service.validate_user_domain(email):
        raise HTTPException(
            status_code=403,
            detail=f"Acceso no autorizado. Solo cuentas @hidrobart.com, @hidrobart.com.mx y @hidrobart.com.br",
        )

    # 4. Obtener perfil completo y grupos
    try:
        ms_profile = await azure_ad_service.get_user_profile(access_token)
        ms_groups = await azure_ad_service.get_user_groups(access_token)
    except Exception as e:
        logger.error(f"Graph API error: {e}")
        ms_profile = {}
        ms_groups = []

    # 5. Mapear grupos a roles de org
    org_roles = azure_ad_service.map_groups_to_org_roles(ms_groups)
    tenant = azure_ad_service.extract_tenant_from_claims(id_token_claims)
    user_id = id_token_claims.get("oid", id_token_claims.get("sub", ""))

    # 6. Obtener roles completos (org + funcionales + proceso)
    roles = await roles_service.get_user_roles(
        user_id=user_id,
        org_roles=org_roles,
        access_token=access_token,
    )
    roles.tenant = tenant

    # 7. Crear sesión en Redis
    session_id = secrets.token_urlsafe(32)
    session_data = {
        "session_id": session_id,
        "user_id": user_id,
        "email": email,
        "name": ms_profile.get("displayName", email.split("@")[0]),
        "given_name": ms_profile.get("givenName", ""),
        "surname": ms_profile.get("surname", ""),
        "job_title": ms_profile.get("jobTitle", ""),
        "department": ms_profile.get("department", ""),
        "tenant": tenant,
        "roles": roles.model_dump(),
        "ms_access_token": access_token[:20] + "...",  # No guardar completo
        "ip": request.client.host if request.client else "",
        "user_agent": request.headers.get("user-agent", ""),
    }
    await redis_service.create_session(session_id, session_data)

    # 8. Refresh token
    refresh_token = create_refresh_token(user_id)
    rt_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    await redis_service.store_refresh_token(user_id, rt_hash)

    # 9. JWT interno Hidrobart
    jwt_token = create_session_token(
        user_id=user_id,
        email=email,
        tenant=tenant,
        roles=roles.model_dump(),
        extra={
            "name": session_data["name"],
            "sid": session_id,
        },
    )

    return {
        "access_token": jwt_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": {
            "id": user_id,
            "email": email,
            "name": session_data["name"],
            "given_name": session_data["given_name"],
            "tenant": tenant,
            "job_title": session_data["job_title"],
            "department": session_data["department"],
            "roles": roles.model_dump(),
        },
    }


@router.post("/validate", response_model=ValidateTokenResponse)
async def validate_token(body: ValidateTokenRequest):
    """
    Valida un JWT de Hidrobart.
    TODAS las apps llaman este endpoint para validar tokens.
    Retorna el perfil y roles del usuario si el token es válido.
    """
    try:
        claims = decode_session_token(body.token)
        session_id = claims.get("sid", "")

        # Verificar que la sesión todavía existe en Redis
        session = await redis_service.get_session(session_id)
        if not session:
            return ValidateTokenResponse(
                valid=False,
                error="Sesión no encontrada o expirada",
            )

        # Extender TTL (sliding expiration)
        await redis_service.refresh_session_ttl(session_id)

        roles = UserRoles(**claims.get("roles", {}))
        profile = UserProfile(
            id=claims["sub"],
            email=claims["email"],
            name=claims.get("name", ""),
            display_name=claims.get("name", ""),
            tenant=claims.get("tenant", ""),
            domain=claims.get("email", "").split("@")[-1],
            roles=roles,
        )

        return ValidateTokenResponse(valid=True, user=profile, roles=roles)

    except Exception as e:
        logger.warning(f"Token validation failed: {e}")
        return ValidateTokenResponse(valid=False, error="Token inválido")


@router.post("/refresh")
async def refresh_token(body: RefreshRequest):
    """Renueva el access token usando el refresh token."""
    try:
        from app.core.security import decode_session_token
        import jwt

        claims = jwt.decode(
            body.refresh_token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_aud": False},
        )

        if claims.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token inválido")

        user_id = claims["sub"]
        rt_hash = hashlib.sha256(body.refresh_token.encode()).hexdigest()

        if not await redis_service.validate_refresh_token(user_id, rt_hash):
            raise HTTPException(status_code=401, detail="Refresh token inválido")

        # Obtener sesión actual
        # Buscar sesión del usuario (simplificado)
        # TODO: Mantener índice user_id → session_ids en Redis
        new_refresh = create_refresh_token(user_id)
        new_rt_hash = hashlib.sha256(new_refresh.encode()).hexdigest()
        await redis_service.store_refresh_token(user_id, new_rt_hash)

        return {
            "refresh_token": new_refresh,
            "message": "Refresh token renovado",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="No se pudo renovar la sesión")


@router.post("/logout")
async def logout(request: Request):
    """
    Cierra la sesión del usuario.
    Elimina sesión de Redis e invalida tokens.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")

    token = auth_header.split(" ")[1]
    try:
        claims = decode_session_token(token)
        session_id = claims.get("sid", "")
        user_id = claims.get("sub", "")

        await redis_service.delete_session(session_id)
        await redis_service.revoke_refresh_token(user_id)

        return {"message": "Sesión cerrada exitosamente"}
    except Exception:
        return {"message": "Sesión cerrada"}


@router.get("/me")
async def get_me(request: Request):
    """Retorna el perfil del usuario autenticado."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")

    token = auth_header.split(" ")[1]
    try:
        claims = decode_session_token(token)
        session_id = claims.get("sid", "")
        session = await redis_service.get_session(session_id)

        if not session:
            raise HTTPException(status_code=401, detail="Sesión expirada")

        return {
            "id": claims["sub"],
            "email": claims["email"],
            "name": claims.get("name", ""),
            "tenant": claims.get("tenant", ""),
            "roles": claims.get("roles", {}),
            "job_title": session.get("job_title", ""),
            "department": session.get("department", ""),
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")
