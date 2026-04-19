"""
Modelos de usuario y roles
"""
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ── Niveles de rol ──────────────────────────────────────────────────────────

class OrgRole(str, Enum):
    """Roles de organización (vienen de Azure AD groups)"""
    SUPER_ADMIN = "SuperAdmin"
    ADMIN = "Admin"
    MANAGER = "Manager"
    EMPLOYEE = "Employee"
    EXTERNAL = "External"


class FunctionalRole(str, Enum):
    """Roles funcionales por área (definidos en DB)"""
    # Hidrobart - áreas funcionales
    OPERATIONS = "Operaciones"
    MAINTENANCE = "Mantenimiento"
    ENGINEERING = "Ingenieria"
    FINANCE = "Finanzas"
    HR = "RecursosHumanos"
    SALES = "Ventas"
    LOGISTICS = "Logistica"
    IT = "TI"
    QUALITY = "Calidad"
    SAFETY = "SeguridadIndustrial"
    MANAGEMENT = "Gerencia"
    VIEWER = "Visualizador"


class ProcessRole(str, Enum):
    """Roles de proceso — qué puede hacer el usuario en cada módulo"""
    # Permisos granulares
    READ = "leer"
    WRITE = "escribir"
    APPROVE = "aprobar"
    ADMIN_MODULE = "administrar"
    REPORT = "reportar"
    CONFIGURE = "configurar"


# ── Modelos principales ──────────────────────────────────────────────────────

class UserRoles(BaseModel):
    """Estructura completa de roles de un usuario"""
    org: List[str] = []          # Azure AD groups (roles de org)
    functional: List[str] = []   # Roles funcionales (área)
    process: dict[str, List[str]] = {}  # {módulo: [permisos]}
    tenant: str = ""             # hidrobart.com | .mx | .br


class UserProfile(BaseModel):
    """Perfil de usuario autenticado"""
    id: str
    email: str
    name: str
    display_name: str
    given_name: Optional[str] = None
    surname: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    office_location: Optional[str] = None
    tenant: str
    domain: str
    avatar_url: Optional[str] = None
    roles: UserRoles = UserRoles()
    is_active: bool = True
    last_login: Optional[datetime] = None


class SessionData(BaseModel):
    """Datos almacenados en Redis para la sesión"""
    session_id: str
    user_id: str
    email: str
    name: str
    tenant: str
    roles: UserRoles
    access_token: str             # Microsoft access token (encriptado)
    refresh_token_hint: str       # Solo hint, el real en HttpOnly cookie
    created_at: datetime
    expires_at: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


# ── Request / Response ───────────────────────────────────────────────────────

class AuthCallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None
    session_state: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class ValidateTokenRequest(BaseModel):
    token: str


class ValidateTokenResponse(BaseModel):
    valid: bool
    user: Optional[UserProfile] = None
    roles: Optional[UserRoles] = None
    error: Optional[str] = None


class RoleAssignment(BaseModel):
    user_id: str
    functional_roles: List[str] = []
    process_permissions: dict[str, List[str]] = {}
    assigned_by: str
    notes: Optional[str] = None
