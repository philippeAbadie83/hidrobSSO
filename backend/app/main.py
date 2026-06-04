"""
Hidrobart Auth Service — FastAPI
Sistema centralizado de autenticación con MS365 / Azure AD
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.routers import auth, users, sso_router as sso
from app.services.redis_service import redis_service

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / Shutdown del servidor."""
    # Startup
    logger.info("🚀 Iniciando Hidrobart Auth Service...")
    redis_ok = await redis_service.ping()
    if redis_ok:
        logger.info("✅ Redis conectado correctamente")
    else:
        logger.warning("⚠️  Redis no disponible — sesiones no funcionarán")

    yield  # App corriendo

    # Shutdown
    logger.info("🛑 Cerrando Hidrobart Auth Service...")
    await redis_service.close()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
## Hidrobart Institutional Login Service

Sistema centralizado de autenticación basado en **Microsoft 365 / Azure AD**.

### Características
- ✅ SSO con Microsoft 365 (multi-tenant)
- ✅ Sesiones en Redis con TTL deslizante
- ✅ Roles de 3 niveles: Organización · Funcional · Proceso
- ✅ Multi-dominio: hidrobart.com | .com.mx | .com.br
- ✅ Endpoint de validación compartido para todas las apps

### Flujo de autenticación
1. App llama `POST /auth/login-url` → obtiene URL de Azure AD
2. Usuario hace login en Microsoft
3. Azure AD redirige con `code` → `POST /auth/callback`
4. Se crea sesión en Redis y se retorna JWT
5. Cada request de las apps valida con `POST /auth/validate`
    """,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

# ── Trusted Hosts ─────────────────────────────────────────────────────────────
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"],  # Ajustar en producción
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(sso.router)


# ── Health & Info ─────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
    }


@app.get("/health", tags=["Health"])
async def health():
    redis_ok = await redis_service.ping()
    return JSONResponse(
        status_code=200 if redis_ok else 503,
        content={
            "status": "healthy" if redis_ok else "degraded",
            "redis": "connected" if redis_ok else "disconnected",
            "version": settings.APP_VERSION,
        },
    )
