"""
Servicio de Roles — combina roles de Azure AD + roles funcionales + roles de proceso
Arquitectura de 3 capas:
  1. OrgRoles    → Azure AD Groups (quién es en la organización)
  2. FuncRoles   → DB local (qué área/función tiene asignada)
  3. ProcessRoles→ DB local (qué puede hacer en cada módulo/app)
"""
import json
import logging
from typing import Optional
from datetime import datetime, timezone

from app.services.redis_service import redis_service
from app.models.user import UserRoles

logger = logging.getLogger(__name__)

# ── Mapa de roles funcionales predefinidos ────────────────────────────────────
# En producción esto viene de la DB; aquí está hardcodeado como fallback
DEFAULT_FUNCTIONAL_ROLES: dict[str, list[str]] = {
    # {email_pattern: [roles_funcionales]}
}

# Módulos del sistema Hidrobart
MODULES = [
    "hidroplus",        # App principal
    "portal_emp",       # Portal empleados
    "ops_dashboard",    # Dashboard operacional
    "mantenimiento",    # Módulo mantenimiento
    "compras",          # Módulo compras
    "rrhh",             # Recursos humanos
    "reportes",         # Reportes y BI
    "configuracion",    # Configuración del sistema
]

# Permisos posibles por módulo
PERMISSIONS = ["leer", "escribir", "aprobar", "administrar", "reportar", "configurar"]

# ── Permisos por rol de organización (defaults) ───────────────────────────────
ORG_ROLE_DEFAULT_PERMISSIONS: dict[str, dict[str, list[str]]] = {
    "SuperAdmin": {module: PERMISSIONS for module in MODULES},
    "Admin": {module: ["leer", "escribir", "aprobar", "reportar"] for module in MODULES},
    "Manager": {
        "hidroplus": ["leer", "escribir", "aprobar", "reportar"],
        "portal_emp": ["leer", "escribir"],
        "ops_dashboard": ["leer", "reportar"],
        "mantenimiento": ["leer", "escribir", "aprobar"],
        "compras": ["leer", "aprobar"],
        "rrhh": ["leer"],
        "reportes": ["leer", "reportar"],
        "configuracion": [],
    },
    "Employee": {
        "hidroplus": ["leer", "escribir"],
        "portal_emp": ["leer", "escribir"],
        "ops_dashboard": ["leer"],
        "mantenimiento": ["leer", "escribir"],
        "compras": ["leer"],
        "rrhh": ["leer"],
        "reportes": ["leer"],
        "configuracion": [],
    },
    "External": {
        "hidroplus": ["leer"],
        "portal_emp": [],
        "ops_dashboard": [],
        "mantenimiento": ["leer"],
        "compras": [],
        "rrhh": [],
        "reportes": [],
        "configuracion": [],
    },
}


class RolesService:
    """Combina y gestiona el sistema completo de roles."""

    async def get_user_roles(
        self,
        user_id: str,
        org_roles: list[str],
        access_token: str,
    ) -> UserRoles:
        """
        Construye los roles completos del usuario combinando:
        1. Roles de org (Azure AD, ya calculados)
        2. Roles funcionales (caché Redis → DB)
        3. Permisos de proceso (calculados desde org + funcionales)
        """
        # Intentar desde caché primero
        cached = await redis_service.get_cached_roles(user_id)
        if cached:
            logger.info(f"Roles from cache for user {user_id[:8]}...")
            return UserRoles(**cached)

        # Calcular roles funcionales (en producción: query a DB)
        functional_roles = await self._get_functional_roles(user_id)

        # Calcular permisos de proceso basados en org + funcionales
        process_permissions = self._calculate_process_permissions(
            org_roles, functional_roles
        )

        roles = UserRoles(
            org=org_roles,
            functional=functional_roles,
            process=process_permissions,
        )

        # Cachear por 15 minutos
        await redis_service.cache_user_roles(user_id, roles.model_dump(), ttl=900)

        return roles

    async def _get_functional_roles(self, user_id: str) -> list[str]:
        """
        Obtiene roles funcionales del usuario desde DB.
        Por ahora devuelve lista vacía (se configura en admin).
        TODO: Integrar con tabla de roles en PostgreSQL.
        """
        # En producción:
        # result = await db.execute(
        #     "SELECT functional_role FROM user_roles WHERE user_id = ?", user_id
        # )
        # return [row.functional_role for row in result]
        return []

    def _calculate_process_permissions(
        self,
        org_roles: list[str],
        functional_roles: list[str],
    ) -> dict[str, list[str]]:
        """
        Calcula permisos por módulo combinando roles de org y funcionales.
        Principio: se aplica el conjunto MAYOR de permisos (least privilege override).
        """
        combined: dict[str, set[str]] = {m: set() for m in MODULES}

        # Aplicar permisos base según rol de org
        for org_role in org_roles:
            defaults = ORG_ROLE_DEFAULT_PERMISSIONS.get(org_role, {})
            for module, perms in defaults.items():
                combined[module].update(perms)

        # TODO: Aplicar ajustes por roles funcionales
        # (puede dar más o quitar permisos específicos)

        # Convertir a listas, eliminar módulos sin permisos
        return {
            module: sorted(list(perms))
            for module, perms in combined.items()
            if perms
        }

    async def assign_functional_roles(
        self,
        user_id: str,
        functional_roles: list[str],
        assigned_by: str,
    ) -> bool:
        """
        Asigna roles funcionales a un usuario.
        Invalida caché automáticamente.
        """
        try:
            # TODO: Persistir en DB
            # await db.execute(
            #     "INSERT OR REPLACE INTO user_roles ..."
            # )
            logger.info(
                f"Functional roles assigned to {user_id[:8]}: {functional_roles} "
                f"by {assigned_by}"
            )
            # Invalidar caché para forzar recálculo
            await redis_service.invalidate_user_roles(user_id)
            return True
        except Exception as e:
            logger.error(f"Error assigning roles: {e}")
            return False

    def check_permission(
        self,
        roles: UserRoles,
        module: str,
        permission: str,
    ) -> bool:
        """
        Verifica si el usuario tiene un permiso específico en un módulo.
        Ejemplo: check_permission(roles, "hidroplus", "aprobar")
        """
        module_perms = roles.process.get(module, [])
        return permission in module_perms

    def is_admin(self, roles: UserRoles) -> bool:
        return "SuperAdmin" in roles.org or "Admin" in roles.org

    def is_manager(self, roles: UserRoles) -> bool:
        return any(r in roles.org for r in ["SuperAdmin", "Admin", "Manager"])


# Singleton
roles_service = RolesService()
