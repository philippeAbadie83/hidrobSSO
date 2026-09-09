"""
services/bl_permisos.py — las reglas de quién entra con qué rol y qué ve.

Aquí no hay SQL. Todo lo que toca la base pasa por db_permisos.

Diferencia con Costeo360: allá la regla vive dentro de sp_resolver_rol, un
stored procedure. Aquí vive en Python, a propósito — HidroSSO le contesta a
varias apps y la regla tiene un escalón más (la asignación explícita, que
Costeo no tiene). Un SP por app terminaría duplicando la misma lógica.
"""
import logging

from app.services import db_permisos

logger = logging.getLogger(__name__)

NIVELES_VALIDOS = ("ninguno", "ver", "propio", "completo")


def resolver_rol(email: str, org_roles: list[str], app_clave: str) -> dict:
    """Con qué rol entra esta persona a esta app.

    El orden de precedencia, tal como quedó en ROLES_SCHEMA_v2 §3.1:

        1. ¿Tiene asignación vigente para esta app?  -> ese rol, y punto
        2. ¿No tiene, y la app exige asignación?     -> no entra
        3. ¿No tiene, y la app es abierta?           -> su grupo de Azure
        4. ¿Su grupo tampoco dice nada?              -> el rol_defecto de la app

    Devuelve siempre un dict, aunque no entre:
        {rol, etiqueta, acceso_total, origen, entra}

    'origen' dice por cuál de los cuatro caminos salió. Sirve para depurar y
    para el cotejo contra el sistema viejo.
    """
    app = db_permisos.get_app(app_clave)
    if not app:
        return _no_entra("app-desconocida")

    # 1. La asignación explícita siempre gana
    rol_clave = db_permisos.get_rol_por_asignacion(email, app_clave) if email else None
    origen = "asignacion"

    if not rol_clave:
        # 2. App cerrada y sin asignación = no entra
        if app["requiere_asig"]:
            return _no_entra("sin-asignacion")
        # 3. Red de seguridad: los grupos de Azure
        if org_roles:
            rol_clave = db_permisos.get_rol_por_grupo(org_roles, app_clave)
        origen = "grupo-azure"

    # 4. Último recurso: el rol por defecto de la app
    if not rol_clave:
        rol_clave = app["rol_defecto"]
        origen = "rol-defecto"

    if not rol_clave:
        return _no_entra("sin-rol")

    rol = db_permisos.get_rol(app_clave, rol_clave)
    if not rol:
        # El rol al que apunta está inactivo o ya no existe. No se inventa
        # uno de reemplazo: es un error de catálogo y hay que verlo.
        logger.warning(f"{app_clave}: el rol '{rol_clave}' no existe o está inactivo")
        return _no_entra(f"{origen}-rol-inactivo", rol=rol_clave)

    return {
        "rol": rol["rol_clave"],
        "etiqueta": rol["etiqueta"],
        "acceso_total": int(rol["acceso_total"]),
        "origen": origen,
        "entra": True,
    }


def permisos_de(app_clave: str, rol_clave: str, acceso_total: bool) -> dict[str, str]:
    """{pantalla: nivel} para este rol.

    acceso_total abre todo sin consultar la matriz — misma excepción que ya
    existe en Costeo360 para el SuperAdmin.
    """
    if acceso_total:
        recursos = db_permisos.get_recursos(app_clave)
        return {r["recurso_clave"]: "completo" for r in recursos}
    return db_permisos.get_matriz(app_clave, rol_clave)


def menu_de(app_clave: str, permisos: dict[str, str]) -> list[dict]:
    """Las pantallas que se dibujan en el sidebar, filtradas y ordenadas.

    Entran solo las que tienen en_menu=1 y un nivel distinto de 'ninguno'.
    Una pantalla con en_menu=0 sigue apareciendo en 'permisos' —la ruta se
    protege igual— pero no se dibuja.
    """
    recursos = db_permisos.get_recursos(app_clave, solo_menu=True)
    return [
        {**r, "nivel": permisos.get(r["recurso_clave"], "ninguno")}
        for r in recursos
        if permisos.get(r["recurso_clave"], "ninguno") != "ninguno"
    ]


def acceso_completo(email: str, org_roles: list[str], app_clave: str) -> dict:
    """Rol + matriz en una sola llamada. Es lo que consumen los endpoints."""
    rol = resolver_rol(email, org_roles, app_clave)
    matriz = (
        permisos_de(app_clave, rol["rol"], bool(rol["acceso_total"]))
        if rol["entra"] else {}
    )
    return {**rol, "permisos": matriz}


# ── Catálogo ──────────────────────────────────────────────────────────────────
# Lectura pura del catálogo. No depende de quién pregunte ni de una sesión:
# es el mismo dato para Next, para Superset o para un MCP.

def listar_apps() -> list[dict]:
    return db_permisos.get_apps()


def listar_roles(app_clave: str) -> list[dict]:
    return db_permisos.get_roles(app_clave)


def listar_recursos(app_clave: str, solo_menu: bool = False) -> list[dict]:
    return db_permisos.get_recursos(app_clave, solo_menu=solo_menu)


def listar_grupos(app_clave: str) -> list[dict]:
    return db_permisos.get_grupos(app_clave)


def matriz(app_clave: str) -> dict:
    """La matriz completa, ya pivoteada: {rol: {pantalla: nivel}}.

    Se pivotea aquí y no en SQL para no tener que reescribir la consulta
    cada vez que se agrega un rol.
    """
    salida: dict[str, dict[str, str]] = {}
    for f in db_permisos.get_matriz_completa(app_clave):
        salida.setdefault(f["rol_clave"], {})[f["recurso_clave"]] = f["nivel"]
    return salida


def asignacion_de(email: str, app_clave: str) -> dict | None:
    return db_permisos.get_asignacion(email, app_clave)


def base_disponible() -> bool:
    return db_permisos.ping()


def _no_entra(origen: str, rol: str | None = None) -> dict:
    return {"rol": rol, "etiqueta": None, "acceso_total": 0,
            "origen": origen, "entra": False}
