"""
HidroSSO — Bitácora de accesos

  ESCRITURA — la llama cada app al navegar
    POST /sso/evento              registra que alguien abrió una pantalla

  LECTURA — para consultar y auditar
    GET /sso/bitacora?email=&app=&evento=&dias=&limite=
    GET /sso/personas             quiénes han entrado y cuándo
    GET /sso/actividad            resumen de hoy
    GET /sso/apps/{app}/uso       permiso otorgado contra permiso usado

  RESUMENES — la bitacora servida ya masticada
    GET /sso/resumen/personas     quien entra, cada cuando, cuanto se mueve
    GET /sso/resumen/apps         cuanta gente usa cada app de verdad
    GET /sso/resumen/uso          el cruce persona x app
    GET /sso/resumen/meses        la tendencia mes a mes

El login y el salto entre apps se registran solos desde sso_router; una app
no tiene que hacer nada para eso. Lo único que sí debe reportar es qué
pantalla abrió su usuario, porque HidroSSO no puede saberlo.

Se guarda TODO el detalle con identidad real: es una herramienta interna y
no sale de la empresa. Decisión de Philippe, 2026-09-09.
"""
import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Path, Query, Request
from pydantic import BaseModel, Field

from app.services import bl_bitacora, bl_permisos
from app.services.db_permisos import BaseNoDisponible
from app.services.redis_service import redis_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sso", tags=["Bitácora"])

_SIN_BASE = "Base de permisos no disponible"


class EventoRequest(BaseModel):
    sid: str = Field(..., description="session_id de HidroSSO")
    app: str = Field(..., description="app_clave, p.ej. costeo360")
    recurso: str = Field(..., description="recurso_clave — la MISMA llave del menú")
    detalle: str | None = Field(None, max_length=300)


@router.post("/evento", status_code=202)
async def evento(body: EventoRequest, request: Request, tareas: BackgroundTasks):
    """Registra que alguien abrió una pantalla.

    Contesta 202 y escribe en segundo plano: la app que reporta no debe
    esperar a la bitácora ni fallar si ésta falla.

    `recurso` tiene que ser la misma llave que en tbl_sso_permiso. De eso
    depende poder cruzar después permiso otorgado contra permiso usado.
    """
    sesion = await redis_service.get_session(body.sid)
    if not sesion:
        raise HTTPException(status_code=401, detail="Sesión inválida o expirada")

    email = sesion.get("email", "")
    org = list((sesion.get("roles") or {}).get("org") or [])

    # El rol se guarda tal como estaba EN ESE MOMENTO. Si mañana cambia, la
    # bitácora sigue diciendo con qué rol entró aquel día.
    rol = None
    try:
        rol = bl_permisos.resolver_rol(email, org, body.app).get("rol")
    except BaseNoDisponible:
        pass  # sin rol es preferible a perder el evento

    tareas.add_task(bl_bitacora.anotar_pantalla, request, email, body.app,
                    body.recurso, rol, body.sid, body.detalle)
    return {"registrado": True}


@router.get("/bitacora")
async def bitacora(
    email: str | None = Query(None, description="filtrar por persona"),
    app: str | None = Query(None, description="filtrar por app"),
    evento: str | None = Query(None, description="login · launch · pantalla · ..."),
    dias: int = Query(7, ge=1, le=365),
    limite: int = Query(200, ge=1, le=2000),
):
    """Los eventos más recientes, del más nuevo al más viejo."""
    try:
        filas = bl_bitacora.consultar(email=email, app_clave=app, evento=evento,
                                      dias=dias, limite=limite)
    except BaseNoDisponible:
        raise HTTPException(status_code=503, detail=_SIN_BASE)
    return {"total": len(filas), "eventos": filas}


@router.get("/personas")
async def personas():
    """Quiénes han entrado alguna vez, con sus grupos y su último acceso.

    Esta lista se llena sola: nadie la captura. Cada ms-login crea o
    actualiza el renglón de esa persona.
    """
    try:
        filas = bl_bitacora.personas()
    except BaseNoDisponible:
        raise HTTPException(status_code=503, detail=_SIN_BASE)
    return {"total": len(filas), "personas": filas}


@router.get("/actividad")
async def actividad():
    """Resumen de hoy: quién entró, a cuántas apps y cuántas pantallas."""
    try:
        return {"hoy": bl_bitacora.actividad_hoy()}
    except BaseNoDisponible:
        raise HTTPException(status_code=503, detail=_SIN_BASE)


@router.get("/apps/{app}/uso")
async def uso(app: str = Path(..., description="app_clave")):
    """Permiso otorgado contra permiso usado, pantalla por pantalla.

    Es la consulta que hoy no se puede hacer: cuántas personas TIENEN acceso
    a cada pantalla contra cuántas la abren de verdad. Sirve para limpiar
    accesos con datos en vez de con intuición.
    """
    try:
        return {"app": app, "uso": bl_bitacora.permiso_vs_uso(app)}
    except BaseNoDisponible:
        raise HTTPException(status_code=503, detail=_SIN_BASE)


# ══ RESUMENES ═════════════════════════════════════════════════════════════════
# Son vistas de SQL, no tablas: se calculan al momento, siempre estan al dia y
# no hay ningun proceso que se pueda quedar atorado. A este volumen siguen
# siendo instantaneas. El dia que sean decenas de millones de filas, se
# materializan estas mismas consultas y los endpoints ni se enteran.

@router.get("/resumen/personas")
async def resumen_personas():
    """Quien entra, cada cuando, y que tanto se mueve por el ecosistema.

    Ojo a `dias_sin_entrar`: es la columna que delata cuentas que ya nadie
    usa y que siguen con acceso.
    """
    try:
        filas = bl_bitacora.res_persona()
    except BaseNoDisponible:
        raise HTTPException(status_code=503, detail=_SIN_BASE)
    return {"total": len(filas), "personas": filas}


@router.get("/resumen/apps")
async def resumen_apps():
    """Cuanta gente usa cada app de verdad.

    La columna que importa es `personas_distintas`. Una app con dos usuarios
    reales no justifica lo que cuesta mantenerla, y eso hoy solo se sabe de
    oido.
    """
    try:
        filas = bl_bitacora.res_app()
    except BaseNoDisponible:
        raise HTTPException(status_code=503, detail=_SIN_BASE)
    return {"total": len(filas), "apps": filas}


@router.get("/resumen/uso")
async def resumen_uso(
    email: str | None = Query(None, description="filtrar por persona"),
    app: str | None = Query(None, description="filtrar por app"),
):
    """El cruce persona x app: quien usa que, con que rol y desde cuando."""
    try:
        filas = bl_bitacora.res_persona_app(email=email, app_clave=app)
    except BaseNoDisponible:
        raise HTTPException(status_code=503, detail=_SIN_BASE)
    return {"total": len(filas), "uso": filas}


@router.get("/resumen/meses")
async def resumen_meses(meses: int = Query(12, ge=1, le=60)):
    """La tendencia mes a mes, por app. Para ver si algo crece o se muere."""
    try:
        filas = bl_bitacora.res_mes(meses)
    except BaseNoDisponible:
        raise HTTPException(status_code=503, detail=_SIN_BASE)
    return {"meses": meses, "total": len(filas), "resumen": filas}
