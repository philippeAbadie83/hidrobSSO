"""
services/bl_bitacora.py — qué se registra y con qué reglas.

Aquí no hay SQL. Todo lo que toca la base pasa por db_bitacora.

Principio que ordena este archivo: **la bitácora es un testigo, no un
guardia.** Observa y anota; nunca decide, nunca bloquea, nunca hace fallar
lo que está observando. Por eso todas las funciones de registro devuelven
bool y ninguna lanza.
"""
import logging

from app.services import db_bitacora

logger = logging.getLogger(__name__)

EVENTOS = ("login", "login_fallido", "launch", "pantalla",
           "permiso", "logout", "error")


def _ip(request) -> str | None:
    """La IP real del visitante.

    nginx va al frente, así que request.client.host siempre sería 127.0.0.1.
    X-Forwarded-For trae la cadena completa y el primer valor es el original.
    """
    if request is None:
        return None
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    real = request.headers.get("x-real-ip", "")
    if real:
        return real.strip()
    return getattr(getattr(request, "client", None), "host", None)


def _navegador(request) -> str | None:
    return request.headers.get("user-agent") if request is not None else None


def anotar(evento: str, request=None, **datos) -> bool:
    """Registra un evento. La IP y el navegador se sacan solos de la petición."""
    if evento not in EVENTOS:
        logger.warning(f"bitacora: evento desconocido '{evento}'")
        return False
    return db_bitacora.registrar(
        evento=evento,
        ip=_ip(request),
        navegador=_navegador(request),
        **datos,
    )


def anotar_login(request, email: str, nombre: str, ms_profile: dict,
                 org_roles: list[str], session_id: str) -> None:
    """Lo que pasa en cada ms-login: se registra a la persona y el evento.

    Se llama en segundo plano (BackgroundTasks) para no meterle ni un
    milisegundo de espera al login. Y aunque MySQL esté caído, lo peor que
    pasa es que se pierda el renglón: la sesión ya se creó en Redis.
    """
    grupos = ",".join(org_roles or [])
    db_bitacora.upsert_persona(
        email=email,
        nombre=nombre,
        azure_uuid=(ms_profile or {}).get("id"),
        puesto=(ms_profile or {}).get("jobTitle"),
        area=(ms_profile or {}).get("department"),
        grupos_azure=grupos,
        ip=_ip(request),
    )
    anotar("login", request, email=email, session_id=session_id, detalle=grupos)


def anotar_launch(request, email: str, app_clave: str, session_id: str) -> None:
    """Alguien saltó del portal a una app del ecosistema."""
    anotar("launch", request, email=email, app_clave=app_clave,
           session_id=session_id)


def anotar_pantalla(request, email: str, app_clave: str, recurso_clave: str,
                    rol_clave: str | None = None, session_id: str | None = None,
                    detalle: str | None = None) -> None:
    """Alguien abrió una pantalla dentro de una app.

    recurso_clave DEBE ser la misma llave que en tbl_sso_permiso. De eso
    depende poder cruzar permiso otorgado contra permiso usado.
    """
    anotar("pantalla", request, email=email, app_clave=app_clave,
           recurso_clave=recurso_clave, rol_clave=rol_clave,
           session_id=session_id, detalle=detalle)


def anotar_fallo(request, motivo: str, email: str | None = None) -> None:
    anotar("login_fallido", request, email=email, detalle=motivo)


def anotar_logout(request, email: str, session_id: str | None = None) -> None:
    anotar("logout", request, email=email, session_id=session_id)


# ── Consulta ──────────────────────────────────────────────────────────────────

def consultar(**filtros) -> list[dict]:
    return db_bitacora.consultar(**filtros)


def personas() -> list[dict]:
    return db_bitacora.personas()


def actividad_hoy() -> list[dict]:
    return db_bitacora.actividad_hoy()


def permiso_vs_uso(app_clave: str) -> list[dict]:
    return db_bitacora.permiso_vs_uso(app_clave)
