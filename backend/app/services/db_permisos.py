"""
services/db_permisos.py — SOLO SQL contra hidrobart_sso.

Aquí no vive ninguna regla de negocio: cada función es una consulta y
devuelve diccionarios pelones. Quién gana cuando alguien trae varios grupos,
o qué pasa si no hay asignación, se decide en bl_permisos.py.

Si la base no responde, se levanta BaseNoDisponible y quien llama decide.
Nunca se devuelve una respuesta a medias ni un valor inventado.
"""
import logging
from typing import Optional

from sqlalchemy import text

from app.core.db_sso import get_engine

logger = logging.getLogger(__name__)


class BaseNoDisponible(Exception):
    """hidrobart_sso no contesta."""


def _uno(sql: str, params: dict | None = None) -> Optional[dict]:
    try:
        with get_engine().connect() as cn:
            fila = cn.execute(text(sql), params or {}).mappings().first()
        return dict(fila) if fila else None
    except Exception as e:
        logger.warning(f"hidrobart_sso no disponible: {e}")
        raise BaseNoDisponible(str(e)) from e


def _todos(sql: str, params: dict | None = None) -> list[dict]:
    try:
        with get_engine().connect() as cn:
            return [dict(f) for f in cn.execute(text(sql), params or {}).mappings()]
    except Exception as e:
        logger.warning(f"hidrobart_sso no disponible: {e}")
        raise BaseNoDisponible(str(e)) from e


# ── Catálogo ──────────────────────────────────────────────────────────────────

def get_app(app_clave: str) -> Optional[dict]:
    return _uno(
        "SELECT app_clave, nombre, url_base, url_sso, rol_defecto, requiere_asig "
        "FROM tbl_sso_app WHERE app_clave = :app AND activo = 1",
        {"app": app_clave},
    )


def get_rol(app_clave: str, rol_clave: str) -> Optional[dict]:
    return _uno(
        "SELECT app_clave, rol_clave, etiqueta, acceso_total, orden "
        "FROM tbl_sso_rol WHERE app_clave = :app AND rol_clave = :rol AND activo = 1",
        {"app": app_clave, "rol": rol_clave},
    )


def get_recursos(app_clave: str, solo_menu: bool = False) -> list[dict]:
    """Las pantallas de la app. solo_menu=True omite las que no se dibujan."""
    filtro = " AND en_menu = 1" if solo_menu else ""
    return _todos(
        "SELECT recurso_clave, etiqueta, seccion, ruta, en_menu, orden "
        "FROM tbl_sso_recurso "
        f"WHERE app_clave = :app AND activo = 1{filtro} "
        "ORDER BY orden, recurso_clave",
        {"app": app_clave},
    )


# ── Las dos formas de llegar a un rol ─────────────────────────────────────────

def get_rol_por_asignacion(email: str, app_clave: str) -> Optional[str]:
    """La asignación explícita y vigente de esta persona para esta app."""
    fila = _uno(
        "SELECT a.rol_clave FROM tbl_sso_asignacion a "
        "JOIN tbl_sso_rol r ON r.app_clave = a.app_clave AND r.rol_clave = a.rol_clave "
        "WHERE a.email = :email AND a.app_clave = :app AND r.activo = 1 "
        "  AND a.vig_ini <= CURRENT_DATE "
        "  AND (a.vig_fin IS NULL OR a.vig_fin >= CURRENT_DATE)",
        {"email": email, "app": app_clave},
    )
    return fila["rol_clave"] if fila else None


def get_rol_por_grupo(org_roles: list[str], app_clave: str) -> Optional[dict]:
    """El rol de mayor privilegio entre los grupos de Azure que trae la sesión.

    Devuelve {rol_clave, acceso_total} — el acceso total sale de la fila del
    GRUPO, no del rol. Asi lo hizo Costeo360 desde siempre:

        grupo SuperAdmin -> rol "admin" + acceso_total 1
        grupo Admin      -> rol "admin" + acceso_total 0

    Los dos entran con el mismo rol y solo uno es god. Separarlos en dos
    roles distintos cambia el NOMBRE con el que entra el SuperAdmin, y ese
    nombre esta escrito a mano en las pantallas.

    Mismo criterio de desempate que sp_resolver_rol: gana acceso_total,
    luego el orden menor. El desempate final por rol_clave es para que dos
    filas empatadas den siempre el mismo resultado.
    """
    # Un parámetro numerado por grupo (:g0, :g1, ...). Los nombres los ponemos
    # nosotros, los valores los escapa SQLAlchemy.
    marcas = ", ".join(f":g{i}" for i in range(len(org_roles)))
    params: dict = {"app": app_clave}
    params.update({f"g{i}": g for i, g in enumerate(org_roles)})
    fila = _uno(
        "SELECT g.rol_clave, g.acceso_total FROM tbl_sso_grupo_rol g "
        "JOIN tbl_sso_rol r ON r.app_clave = g.app_clave AND r.rol_clave = g.rol_clave "
        "WHERE g.app_clave = :app AND g.activo = 1 AND r.activo = 1 "
        f"  AND g.grupo_azure IN ({marcas}) "
        "ORDER BY g.acceso_total DESC, r.orden ASC, g.rol_clave ASC LIMIT 1",
        params,
    )
    return dict(fila) if fila else None


# ── La matriz ─────────────────────────────────────────────────────────────────

def get_matriz(app_clave: str, rol_clave: str) -> dict[str, str]:
    """{recurso_clave: nivel} para TODAS las pantallas de la app.

    LEFT JOIN a propósito: una pantalla sin fila de permiso sale en 'ninguno'.
    Así una pantalla nueva nace cerrada, no abierta.
    """
    filas = _todos(
        "SELECT c.recurso_clave, COALESCE(p.nivel, 'ninguno') AS nivel "
        "FROM tbl_sso_recurso c "
        "LEFT JOIN tbl_sso_permiso p "
        "  ON p.app_clave = c.app_clave AND p.recurso_clave = c.recurso_clave "
        " AND p.rol_clave = :rol "
        "WHERE c.app_clave = :app AND c.activo = 1",
        {"rol": rol_clave, "app": app_clave},
    )
    return {f["recurso_clave"]: f["nivel"] for f in filas}


def get_apps() -> list[dict]:
    """Todas las apps activas del ecosistema."""
    return _todos(
        "SELECT app_clave, nombre, url_base, url_sso, rol_defecto, requiere_asig "
        "FROM tbl_sso_app WHERE activo = 1 ORDER BY app_clave"
    )


def get_roles(app_clave: str) -> list[dict]:
    """Los roles de una app, del más privilegiado al menos."""
    return _todos(
        "SELECT rol_clave, etiqueta, acceso_total, orden "
        "FROM tbl_sso_rol WHERE app_clave = :app AND activo = 1 "
        "ORDER BY acceso_total DESC, orden, rol_clave",
        {"app": app_clave},
    )


def get_grupos(app_clave: str) -> list[dict]:
    """El mapa grupo de Azure -> rol, de una app."""
    return _todos(
        "SELECT grupo_azure, rol_clave, orden "
        "FROM tbl_sso_grupo_rol WHERE app_clave = :app AND activo = 1 "
        "ORDER BY orden, grupo_azure",
        {"app": app_clave},
    )


def get_matriz_completa(app_clave: str) -> list[dict]:
    """La matriz entera rol x pantalla de una app, en filas planas."""
    return _todos(
        "SELECT p.rol_clave, p.recurso_clave, p.nivel "
        "FROM tbl_sso_permiso p "
        "JOIN tbl_sso_rol r ON r.app_clave = p.app_clave AND r.rol_clave = p.rol_clave "
        "JOIN tbl_sso_recurso c ON c.app_clave = p.app_clave "
        "  AND c.recurso_clave = p.recurso_clave "
        "WHERE p.app_clave = :app AND r.activo = 1 AND c.activo = 1 "
        "ORDER BY r.orden, r.rol_clave, c.orden, c.recurso_clave",
        {"app": app_clave},
    )


def get_asignacion(email: str, app_clave: str) -> Optional[dict]:
    """La asignación explícita de una persona, con su vigencia y quién la puso."""
    return _uno(
        "SELECT email, app_clave, rol_clave, vig_ini, vig_fin, asignado_por, nota "
        "FROM tbl_sso_asignacion WHERE email = :email AND app_clave = :app",
        {"email": email, "app": app_clave},
    )


def get_mosaicos(email: str, org_roles: list[str]) -> list[dict]:
    """Los mosaicos del portal que ve esta persona, en orden.

    Lo ve si alguna fila de tbl_sso_mosaico_acceso coincide: por grupo de
    Azure (tipo='grupo') o por su correo (tipo='persona'). Solo mosaicos
    visibles de apps activas. Quién VE el mosaico no decide quién ENTRA:
    eso sigue en tbl_sso_grupo_rol / tbl_sso_asignacion.
    """
    params: dict = {"email": email or ""}
    por_grupo = "0"
    if org_roles:
        marcas = ", ".join(f":g{i}" for i in range(len(org_roles)))
        params.update({f"g{i}": g for i, g in enumerate(org_roles)})
        por_grupo = f"(x.tipo = 'grupo' AND x.valor IN ({marcas}))"
    return _todos(
        "SELECT m.app_clave, a.nombre, a.url_base, m.subtitulo, m.descripcion, "
        "       m.icono, m.insignia, m.lanza, m.orden, m.version, m.version_fecha "
        "FROM tbl_sso_mosaico m "
        "JOIN tbl_sso_app a ON a.app_clave = m.app_clave "
        "WHERE m.visible = 1 AND a.activo = 1 "
        "  AND EXISTS (SELECT 1 FROM tbl_sso_mosaico_acceso x "
        "              WHERE x.app_clave = m.app_clave "
        f"               AND ({por_grupo} OR (x.tipo = 'persona' AND x.valor = :email))) "
        "ORDER BY m.orden, m.app_clave",
        params,
    )


def ping() -> bool:
    try:
        _uno("SELECT 1 AS ok")
        return True
    except Exception:
        return False
