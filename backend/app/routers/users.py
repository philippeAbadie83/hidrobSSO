"""
Router Users — gestión de usuarios y roles
GET  /users/roles/{user_id}          → obtiene roles del usuario
PUT  /users/roles/{user_id}          → asigna roles funcionales
GET  /users/permissions/{module}     → permisos en un módulo específico
GET  /users/sessions                 → sesiones activas (solo admins)
"""
import logging
from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional

from app.core.security import decode_session_token
from app.services.redis_service import redis_service
from app.services.roles import roles_service
from app.models.user import RoleAssignment, UserRoles

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["Users & Roles"])


# ── Dependency ────────────────────────────────────────────────────────────────

async def get_current_user(request: Request) -> dict:
    """Extrae y valida el usuario del JWT."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")

    token = auth_header.split(" ")[1]
    try:
        claims = decode_session_token(token)
        session = await redis_service.get_session(claims.get("sid", ""))
        if not session:
            raise HTTPException(status_code=401, detail="Sesión expirada")
        return claims
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")


async def require_admin(claims: dict = Depends(get_current_user)) -> dict:
    """Solo admins pueden acceder."""
    roles = claims.get("roles", {}).get("org", [])
    if not any(r in roles for r in ["SuperAdmin", "Admin"]):
        raise HTTPException(status_code=403, detail="Acceso restringido a administradores")
    return claims


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/roles/{user_id}")
async def get_user_roles(
    user_id: str,
    claims: dict = Depends(get_current_user),
):
    """Obtiene los roles de un usuario específico."""
    # Solo el propio usuario o un admin puede ver los roles
    if claims["sub"] != user_id and not roles_service.is_admin(
        UserRoles(**claims.get("roles", {}))
    ):
        raise HTTPException(status_code=403, detail="Sin permiso")

    cached = await redis_service.get_cached_roles(user_id)
    if cached:
        return {"user_id": user_id, "roles": cached}

    return {
        "user_id": user_id,
        "roles": claims.get("roles", {}),
        "from_cache": False,
    }


@router.put("/roles/{user_id}")
async def assign_roles(
    user_id: str,
    assignment: RoleAssignment,
    claims: dict = Depends(require_admin),
):
    """
    Asigna roles funcionales y permisos de proceso a un usuario.
    Solo administradores pueden ejecutar este endpoint.
    """
    success = await roles_service.assign_functional_roles(
        user_id=user_id,
        functional_roles=assignment.functional_roles,
        assigned_by=claims["email"],
    )

    if not success:
        raise HTTPException(status_code=500, detail="Error al asignar roles")

    return {
        "message": f"Roles asignados exitosamente a {user_id}",
        "assigned_roles": assignment.functional_roles,
        "assigned_by": claims["email"],
    }


@router.get("/permissions/{module}")
async def check_module_permission(
    module: str,
    permission: str,
    claims: dict = Depends(get_current_user),
):
    """
    Verifica si el usuario tiene un permiso específico en un módulo.
    Útil para apps que necesitan verificar permisos granulares.
    """
    roles = UserRoles(**claims.get("roles", {}))
    has_permission = roles_service.check_permission(roles, module, permission)

    return {
        "user_id": claims["sub"],
        "module": module,
        "permission": permission,
        "allowed": has_permission,
    }


@router.get("/permissions/summary")
async def get_permissions_summary(claims: dict = Depends(get_current_user)):
    """Retorna resumen completo de permisos del usuario actual."""
    roles = UserRoles(**claims.get("roles", {}))
    return {
        "user_id": claims["sub"],
        "email": claims["email"],
        "roles": roles.model_dump(),
        "is_admin": roles_service.is_admin(roles),
        "is_manager": roles_service.is_manager(roles),
    }


@router.get("/sessions/active")
async def get_active_sessions(claims: dict = Depends(require_admin)):
    """Lista sesiones activas (solo admins). Para auditoría."""
    # En producción: escanear Redis con pattern matching
    return {
        "message": "Endpoint disponible para auditoría de sesiones",
        "note": "Implementar scan de Redis con patrón hidrobart:auth:session:*",
    }


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    claims: dict = Depends(require_admin),
):
    """Revoca una sesión específica (solo admins). Para security incidents."""
    success = await redis_service.delete_session(session_id)
    if success:
        return {"message": f"Sesión {session_id[:8]}... revocada"}
    raise HTTPException(status_code=404, detail="Sesión no encontrada")
