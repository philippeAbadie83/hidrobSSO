"""
Configuración central del sistema de autenticación Hidrobart
Multi-tenant: hidrobart.com | hidrobart.com.mx | hidrobart.com.br
"""
from pydantic_settings import BaseSettings
from typing import List
import secrets


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "Hidrobart Auth Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    SESSION_TTL_SECONDS: int = 28800        # 8 horas
    REFRESH_TOKEN_TTL_SECONDS: int = 604800  # 7 días

    # ── Azure AD ──────────────────────────────────────────────────────────────
    # App Registration en Azure (una sola app multi-tenant)
    AZURE_CLIENT_ID: str = ""
    AZURE_CLIENT_SECRET: str = ""
    AZURE_TENANT_ID: str = "common"         # "common" para multi-tenant
    AZURE_AUTHORITY: str = "https://login.microsoftonline.com/common"
    AZURE_SCOPE: List[str] = [
        "openid", "profile", "email",
        "User.Read",
        "GroupMember.Read.All",
    ]
    # Dominios permitidos (todos los de Hidrobart)
    ALLOWED_DOMAINS: List[str] = [
        "hidrobart.com",
        "hidrobart.com.mx",
        "hidrobart.com.br",
    ]
    # URL de retorno después del login (frontend)
    AZURE_REDIRECT_URI: str = "http://localhost:3000/api/auth/callback/azure-ad"

    # ── Redis ─────────────────────────────────────────────────────────────────
    # Redis NUEVO dedicado a sesiones de auth
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6380          # SSL port de Azure Cache for Redis
    REDIS_PASSWORD: str = ""
    REDIS_SSL: bool = True
    REDIS_DB: int = 0
    REDIS_KEY_PREFIX: str = "hidrobart:auth:"
    REDIS_SESSION_PREFIX: str = "session:"
    REDIS_ROLES_PREFIX: str = "roles:"
    REDIS_REFRESH_PREFIX: str = "refresh:"
    # True  = Azure Premium/Enterprise (OSS Cluster mode)
    # False = Redis standalone (local dev o Azure sin cluster)
    REDIS_CLUSTER_MODE: bool = True

    # ── CORS / Apps permitidas ────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://login.hidrobart.com",
        "https://portal.hidrobart.com",
        "https://ops.hidrobart.com",
        "https://login.hidrobart.com.mx",
        "https://login.hidrobart.com.br",
    ]

    # ── Base de datos roles funcionales ──────────────────────────────────────
    # Opcional: PostgreSQL para roles funcionales/proceso persistentes
    DATABASE_URL: str = "sqlite:///./hidrobart_roles.db"
    USE_DB_FOR_ROLES: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
