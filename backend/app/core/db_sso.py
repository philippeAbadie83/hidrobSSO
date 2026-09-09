"""
Conexión a hidrobart_sso — la base de permisos del ecosistema.

Mismo patrón que costeo360-api/core/db.py, dir360 y las demás: SQLAlchemy
por encima de PyMySQL, con SSL. El MySQL de Azure solo se alcanza desde la
red interna y aun así exige transporte seguro.

Dos diferencias deliberadas respecto a las otras apps, y por qué:

  1. Pool chico (5 + 10 en vez de 20 + 30). Aquí solo se sirven 4 endpoints
     de lectura para unas decenas de personas. HidroSSO es la pieza de la
     que cuelga todo el ecosistema; no tiene por qué reservar 50 conexiones.

  2. create_engine NO conecta al importarse — abre la primera conexión hasta
     que alguien pregunta. Si MySQL está caído, HidroSSO arranca igual y solo
     los endpoints de permisos contestan 503.
"""
import logging
import urllib.parse

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

from app.core.config import settings

logger = logging.getLogger(__name__)

_engine: Engine | None = None


def get_engine() -> Engine:
    """El engine, creado la primera vez que se pide (nunca al arrancar)."""
    global _engine
    if _engine is None:
        clave = urllib.parse.quote_plus(settings.SSO_DB_PASSWORD)
        url = (
            f"mysql+pymysql://{settings.SSO_DB_USER}:{clave}"
            f"@{settings.SSO_DB_HOST}:{settings.SSO_DB_PORT}/{settings.SSO_DB_NAME}"
            f"?charset=utf8mb4"
        )
        _engine = create_engine(
            url,
            pool_pre_ping=True,      # descarta conexiones muertas antes de usarlas
            pool_recycle=3600,       # Azure corta las inactivas; renovar cada hora
            pool_size=5,
            max_overflow=10,
            future=True,
            connect_args={
                "ssl": {"ssl": True},               # Azure MySQL lo exige
                "connect_timeout": settings.SSO_DB_TIMEOUT,
                "read_timeout": settings.SSO_DB_TIMEOUT,
            },
        )
        logger.info(
            f"Engine de permisos listo: {settings.SSO_DB_HOST}/{settings.SSO_DB_NAME}"
        )
    return _engine
