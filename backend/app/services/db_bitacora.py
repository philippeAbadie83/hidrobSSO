"""
services/db_bitacora.py — SOLO SQL para la bitácora y el registro de personas.

Regla de esta capa: **escribir nunca puede tronar hacia arriba.** Una bitácora
que rompe un login es peor que no tener bitácora. Por eso las escrituras
capturan cualquier error, lo dejan en el log y devuelven False. Las lecturas
sí levantan BaseNoDisponible, porque ahí quien pregunta merece un 503 honesto
en vez de una lista vacía que parezca "no hay nada".
"""
import logging
from typing import Optional

from sqlalchemy import text

from app.core.db_sso import get_engine
from app.services.db_permisos import BaseNoDisponible

logger = logging.getLogger(__name__)


# ── Escritura — a prueba de fallos ────────────────────────────────────────────

def _escribir(sql: str, params: dict) -> bool:
    try:
        with get_engine().begin() as cn:
            cn.execute(text(sql), params)
        return True
    except Exception as e:
        # A propósito no se relanza: el login vale más que su bitácora.
        logger.warning(f"bitacora: no se pudo escribir ({e})")
        return False


def registrar(
    evento: str,
    email: str | None = None,
    app_clave: str | None = None,
    recurso_clave: str | None = None,
    rol_clave: str | None = None,
    session_id: str | None = None,
    detalle: str | None = None,
    ip: str | None = None,
    navegador: str | None = None,
) -> bool:
    """Un renglón en la bitácora. Devuelve False si no se pudo, nunca lanza."""
    return _escribir(
        "INSERT INTO tbl_sso_bitacora "
        "(evento, email, app_clave, recurso_clave, rol_clave, session_id, "
        " detalle, ip, navegador) "
        "VALUES (:evento, :email, :app, :recurso, :rol, :sid, "
        "        :detalle, :ip, :nav)",
        {
            "evento": evento,
            "email": (email or None),
            "app": (app_clave or None),
            "recurso": (recurso_clave or None),
            "rol": (rol_clave or None),
            "sid": (session_id or None)[:64] if session_id else None,
            "detalle": (detalle or None) and detalle[:300],
            "ip": (ip or None) and ip[:45],
            "nav": (navegador or None) and navegador[:300],
        },
    )


def upsert_persona(
    email: str,
    nombre: str,
    azure_uuid: str | None = None,
    puesto: str | None = None,
    area: str | None = None,
    grupos_azure: str | None = None,
    ip: str | None = None,
) -> bool:
    """Crea o actualiza a la persona en cada login.

    primer_login se pone una sola vez (COALESCE lo respeta), ultimo_login y
    el contador se actualizan siempre. Nadie captura esta tabla a mano.

    grupos_azure es lo que hace consultable al SSO sin sesión: hoy los grupos
    de alguien solo existen dentro de su sesión de Redis, que muere a las 8 h.
    """
    return _escribir(
        "INSERT INTO tbl_sso_persona "
        "(email, azure_uuid, nombre, puesto, area, grupos_azure, ultima_ip, "
        " primer_login, ultimo_login, logins) "
        "VALUES (:email, :uuid, :nombre, :puesto, :area, :grupos, :ip, "
        "        NOW(), NOW(), 1) "
        "ON DUPLICATE KEY UPDATE "
        "  azure_uuid   = COALESCE(VALUES(azure_uuid), azure_uuid), "
        "  nombre       = VALUES(nombre), "
        "  puesto       = COALESCE(VALUES(puesto), puesto), "
        "  area         = COALESCE(VALUES(area), area), "
        "  grupos_azure = VALUES(grupos_azure), "
        "  ultima_ip    = VALUES(ultima_ip), "
        "  primer_login = COALESCE(primer_login, NOW()), "
        "  ultimo_login = NOW(), "
        "  logins       = logins + 1",
        {
            "email": email[:150],
            "uuid": (azure_uuid or None) and azure_uuid[:60],
            "nombre": (nombre or email)[:120],
            "puesto": (puesto or None) and puesto[:80],
            "area": (area or None) and area[:60],
            "grupos": (grupos_azure or None) and grupos_azure[:400],
            "ip": (ip or None) and ip[:45],
        },
    )


# ── Lectura — aquí sí conviene el 503 ─────────────────────────────────────────

def _todos(sql: str, params: dict | None = None) -> list[dict]:
    try:
        with get_engine().connect() as cn:
            return [dict(f) for f in cn.execute(text(sql), params or {}).mappings()]
    except Exception as e:
        logger.warning(f"hidrobart_sso no disponible: {e}")
        raise BaseNoDisponible(str(e)) from e


def consultar(
    email: Optional[str] = None,
    app_clave: Optional[str] = None,
    evento: Optional[str] = None,
    dias: int = 7,
    limite: int = 200,
) -> list[dict]:
    """Los eventos más recientes, con los filtros que se le den."""
    cond = ["b.creado_en >= NOW() - INTERVAL :dias DAY"]
    params: dict = {"dias": max(1, min(dias, 365)), "limite": max(1, min(limite, 2000))}
    if email:
        cond.append("b.email = :email");        params["email"] = email
    if app_clave:
        cond.append("b.app_clave = :app");      params["app"] = app_clave
    if evento:
        cond.append("b.evento = :evento");      params["evento"] = evento
    return _todos(
        "SELECT b.id, b.evento, b.email, b.app_clave, b.recurso_clave, "
        "       b.rol_clave, b.detalle, b.ip, b.creado_en "
        "FROM tbl_sso_bitacora b "
        f"WHERE {' AND '.join(cond)} "
        "ORDER BY b.creado_en DESC LIMIT :limite",
        params,
    )


def personas() -> list[dict]:
    """Quiénes han entrado alguna vez, y cuándo fue la última."""
    return _todos(
        "SELECT email, nombre, puesto, area, grupos_azure, logins, "
        "       primer_login, ultimo_login, ultima_ip, activo "
        "FROM tbl_sso_persona ORDER BY ultimo_login DESC"
    )


def actividad_hoy() -> list[dict]:
    return _todos("SELECT * FROM vw_sso_actividad_hoy")


def permiso_vs_uso(app_clave: str) -> list[dict]:
    """Permiso otorgado contra permiso usado. La consulta que justifica que
    recurso_clave sea la misma llave en permisos y en bitácora."""
    return _todos(
        "SELECT * FROM vw_sso_permiso_vs_uso WHERE app_clave = :app "
        "ORDER BY personas_que_la_abrieron ASC, recurso_clave",
        {"app": app_clave},
    )
