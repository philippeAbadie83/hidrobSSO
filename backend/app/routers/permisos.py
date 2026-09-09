"""
HidroSSO — Permisos del ecosistema, leídos de hidrobart_sso

La API no está hecha para un consumidor en particular. Hoy la llama Next.js;
mañana puede ser Superset, un notebook o un MCP. Por eso se separa en dos
grupos, y la sesión de navegador es UNA forma de preguntar, no la única:

  CATÁLOGO — no necesita sesión, no expone datos de personas
    GET /sso/apps                        las apps del ecosistema
    GET /sso/apps/{app}                  una app
    GET /sso/apps/{app}/roles            sus roles
    GET /sso/apps/{app}/recursos         sus pantallas
    GET /sso/apps/{app}/grupos           el mapa grupo de Azure -> rol
    GET /sso/apps/{app}/matriz           rol x pantalla, completa
    GET /sso/resolver?app=&org=A,B       qué rol dan esos grupos

  SESIÓN — la capa de conveniencia para un navegador con cookie
    GET /sso/sesion/permisos?sid=&app=   rol + matriz de quien tiene esa sesión
    GET /sso/sesion/menu?sid=&app=       lo mismo, ya filtrado para el sidebar

  GET /sso/salud                         ¿responde la base de permisos?

Esta capa es SOLO HTTP: lee parámetros, valida la sesión cuando aplica y
traduce a códigos de estado. Las reglas viven en services/bl_permisos y el
SQL en services/db_permisos.

Todo es ADITIVO: ningún endpoint que ya existía cambia.
"""
import logging

from fastapi import APIRouter, HTTPException, Path, Query

from app.services import bl_permisos
from app.services.db_permisos import BaseNoDisponible
from app.services.redis_service import redis_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sso", tags=["Permisos"])

_SIN_BASE = "Base de permisos no disponible"
_APP = Path(..., description="app_clave, p.ej. costeo360")


def _guardar(fn, *args, **kwargs):
    """Corre una consulta y traduce 'la base no responde' a un 503.

    Nunca se devuelve una respuesta a medias: o el dato es real, o es error
    explícito. Un menú vacío se leería como 'no tienes permisos', que es
    exactamente la confusión que hay que evitar.
    """
    try:
        return fn(*args, **kwargs)
    except BaseNoDisponible:
        raise HTTPException(status_code=503, detail=_SIN_BASE)


async def _sesion(sid: str) -> tuple[str, list[str]]:
    """(email, grupos de Azure) de una sesión viva. 401 si no lo está."""
    datos = await redis_service.get_session(sid)
    if not datos:
        raise HTTPException(status_code=401, detail="Sesión inválida o expirada")
    return datos.get("email", ""), list((datos.get("roles") or {}).get("org") or [])


def _existe(app_clave: str) -> dict:
    app = _guardar(bl_permisos.listar_apps)
    for a in app:
        if a["app_clave"] == app_clave:
            return a
    raise HTTPException(status_code=404, detail=f"App '{app_clave}' no encontrada")


# ══ CATÁLOGO ══════════════════════════════════════════════════════════════════

@router.get("/apps")
async def apps():
    """Las apps del ecosistema, con su modo de acceso."""
    return {"apps": _guardar(bl_permisos.listar_apps)}


@router.get("/apps/{app}")
async def app_una(app: str = _APP):
    return _existe(app)


@router.get("/apps/{app}/roles")
async def roles(app: str = _APP):
    """Los roles de la app, del más privilegiado al menos."""
    _existe(app)
    return {"app": app, "roles": _guardar(bl_permisos.listar_roles, app)}


@router.get("/apps/{app}/recursos")
async def recursos(
    app: str = _APP,
    solo_menu: bool = Query(False, description="omitir las que no se dibujan"),
):
    """Las pantallas de la app."""
    _existe(app)
    return {
        "app": app,
        "recursos": _guardar(bl_permisos.listar_recursos, app, solo_menu=solo_menu),
    }


@router.get("/apps/{app}/grupos")
async def grupos(app: str = _APP):
    """El mapa grupo de Azure → rol. Útil para auditar quién llega a dónde."""
    _existe(app)
    return {"app": app, "grupos": _guardar(bl_permisos.listar_grupos, app)}


@router.get("/apps/{app}/matriz")
async def matriz(app: str = _APP):
    """La matriz completa, pivoteada: {rol: {pantalla: nivel}}."""
    _existe(app)
    return {"app": app, "matriz": _guardar(bl_permisos.matriz, app)}


@router.get("/resolver")
async def resolver(
    app: str = Query(..., description="app_clave"),
    org: str = Query("", description="grupos de Azure separados por coma"),
):
    """Qué rol daría esta lista de grupos, sin necesidad de una sesión real.

    Es la pieza que hace verificable el cambio de fuente: se corre persona
    por persona con sus grupos y se compara contra el sistema viejo, sin
    pedirle a nadie que entre a la app. No recibe correo ni toca
    asignaciones, así que no expone datos de ninguna persona.
    """
    grupos_lista = [g.strip() for g in org.split(",") if g.strip()]
    r = _guardar(bl_permisos.acceso_completo, "", grupos_lista, app)
    return {
        "app": app,
        "org": grupos_lista,
        "rol": r["rol"],
        "etiqueta": r["etiqueta"],
        "acceso_total": r["acceso_total"],
        "origen": r["origen"],
        "entra": r["entra"],
        "abiertas": sorted(k for k, v in r["permisos"].items() if v != "ninguno"),
    }


# ══ SESIÓN ════════════════════════════════════════════════════════════════════

@router.get("/sesion/permisos")
async def sesion_permisos(
    sid: str = Query(..., description="session_id de HidroSSO"),
    app: str = Query(..., description="app_clave"),
):
    """El rol de quien tiene esta sesión, y qué puede hacer en cada pantalla."""
    email, org = await _sesion(sid)
    r = _guardar(bl_permisos.acceso_completo, email, org, app)
    if not r["entra"]:
        raise HTTPException(status_code=403, detail=f"Sin acceso a {app} ({r['origen']})")
    return {
        "email": email,
        "app": app,
        "rol": r["rol"],
        "etiqueta": r["etiqueta"],
        "acceso_total": r["acceso_total"],
        "origen": r["origen"],
        "permisos": r["permisos"],
    }


@router.get("/sesion/menu")
async def sesion_menu(
    sid: str = Query(...),
    app: str = Query(...),
):
    """Las pantallas del sidebar de quien tiene esta sesión."""
    email, org = await _sesion(sid)
    r = _guardar(bl_permisos.acceso_completo, email, org, app)
    if not r["entra"]:
        raise HTTPException(status_code=403, detail=f"Sin acceso a {app} ({r['origen']})")
    return {
        "email": email,
        "app": app,
        "rol": r["rol"],
        "etiqueta": r["etiqueta"],
        "menu": _guardar(bl_permisos.menu_de, app, r["permisos"]),
    }


# ══ SALUD ═════════════════════════════════════════════════════════════════════

@router.get("/salud")
async def salud():
    """¿Responde la base de permisos? Para monitoreo, no requiere sesión."""
    ok = bl_permisos.base_disponible()
    return {"base_permisos": "ok" if ok else "sin conexion", "disponible": ok}
