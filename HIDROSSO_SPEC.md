# HidroSSO — Especificación Técnica

**Versión:** 1.1  
**Fecha:** 2026-04-27  
**Estado:** Producción

---

## ¿Qué es HidroSSO?

HidroSSO es el sistema de login institucional único para todas las apps Hidrobart. El usuario se autentica **una sola vez** con su cuenta Microsoft 365 (`@hidrobart.com`, `@hidrobart.com.mx`, `@hidrobart.com.br`) y accede sin re-autenticarse a Costeo360, Cortex, Unidum, CRM2, HidroPlus Pro y cualquier app futura registrada.

---

## Stack

| Capa | Tecnología | Puerto | Proceso PM2 |
|------|-----------|--------|-------------|
| Frontend | Next.js 15 App Router + NextAuth | 3010 | `hidrosso-frontend` |
| Backend | FastAPI + uvicorn | 8010 | `hidrosso-api` |
| Sesiones | Azure Cache for Redis (SSL 6380) | — | — |
| Auth | Microsoft 365 / Azure AD multi-tenant | — | — |

**Dominio producción:** `https://hidrosso.hidrobart.com`  
**Backend API:** `https://auth-api.hidrobart.com`

---

## Arquitectura de roles

```
OrgRoles (grupos Azure AD)
    └── FunctionalRoles (base de datos)
            └── ProcessRoles (permisos por módulo)
```

Los roles se leen en el momento del login vía Microsoft Graph y se almacenan en la sesión de Redis. No se re-consultan en cada request.

---

## Flujo SSO completo

```
Usuario en HidroSSO dashboard
        │
        │  clic en app (ej. Costeo360)
        ▼
HidroSSO Frontend /api/sso-launch?app=costeo360
        │  (server-side: lee hidrobartSessionId del JWT de NextAuth)
        │
        ▼
HidroSSO Backend POST /auth/sso-launch
        │  crea launch token lt_xxxx (one-time, TTL 60s) en Redis
        │  devuelve redirect_url = https://costeo360.hidrobart.com/auth/sso?lt=lt_xxxx
        │
        ▼
Browser → https://costeo360.hidrobart.com/auth/sso?lt=lt_xxxx
        │  (página /auth/sso llama a /api/sso-entry en el cliente)
        │
        ▼
Costeo360 /api/sso-entry (server-side)
        │  llama a HidroSSO Backend GET /auth/sso-exchange?lt=lt_xxxx
        │  recibe session_id real
        │  setea cookie httpOnly hidrosso_sid=session_id
        │
        ▼
Redirect → /dashboard de Costeo360 ✅
```

---

## Endpoints del Backend (FastAPI)

### POST /auth/ms-login

Acepta el `access_token` de MS365 emitido por NextAuth. Obtiene perfil y grupos via Microsoft Graph, crea sesión en Redis.

**Body:**
```json
{ "access_token": "eyJ0eXAi..." }
```

**Response 200:**
```json
{
  "session_id": "DZS9pBP5pou...",
  "email": "philippe@hidrobart.com",
  "name": "Philippe Abadie",
  "tenant": "hidrobart.com",
  "roles": { ... }
}
```

**Errores:** 401 token inválido, 403 dominio no autorizado, 503 Redis no disponible.

---

### POST /auth/sso-launch

Crea un launch token de 60 segundos para redirigir al usuario a otra app. Llamado server-side desde el frontend de HidroSSO.

**Body:**
```json
{ "session_id": "DZS9pBP5pou...", "app_id": "costeo360" }
```

**Response 200:**
```json
{ "redirect_url": "https://costeo360.hidrobart.com/auth/sso?lt=lt_xxxx" }
```

**Errores:** 400 app no registrada, 401 sesión no encontrada o expirada.

**Apps registradas:** `costeo360`, `cortex`, `unidum`, `crm2`, `hidropluspro`

---

### GET /auth/sso-exchange?lt=lt_xxxx

Intercambia el launch token (one-time) por el `session_id` real. Llamado server-side desde la app destino.

**Response 200:**
```json
{ "session_id": "DZS9pBP5pou..." }
```

**Errores:** 400 token inválido, 401 token expirado o ya usado.

> **Nota operativa:** Azure Cache for Redis puede devolver `MOVED` en el `DELETE` del token si hay redistribución de slots. Esto se maneja silenciosamente — el token expira en 60s de todas formas. No afecta la funcionalidad.

---

### GET /auth/session-info?sid=xxxx

Valida el `session_id` y retorna info del usuario. Renueva el TTL (sliding expiration de 8 horas). Usado por las apps para verificar la cookie `hidrosso_sid`.

**Response 200:**
```json
{
  "valid": true,
  "session_id": "DZS9pBP5pou...",
  "email": "philippe@hidrobart.com",
  "name": "Philippe Abadie",
  "tenant": "hidrobart.com",
  "job_title": "Director General",
  "department": "Dirección",
  "roles": { ... }
}
```

**Errores:** 401 sesión no encontrada o expirada.

---

## Cookie de sesión

| Atributo | Valor |
|----------|-------|
| Nombre | `hidrosso_sid` |
| httpOnly | sí |
| secure | sí (producción) |
| sameSite | lax |
| maxAge | 28800s (8 horas) |
| path | / |

---

## Redis — Notas de operación

Azure Cache for Redis usa protocolo de cluster internamente aunque el endpoint sea único. El cliente Python se conecta en modo **standalone** al endpoint principal de Azure — funciona para la mayoría de operaciones. Los nodos internos del cluster (`52.237.x.x:8500`) **no son accesibles** desde la VM, por lo que `RedisCluster` no debe usarse.

Si aparecen errores `MOVED` en los logs del backend, son manejados en el `sso-exchange` y no afectan el flujo. Si aparecen `MOVED` en otras operaciones (ms-login, session-info), se debe revisar la configuración del tier de Redis en Azure Portal.

**TTLs:**

| Clave | TTL |
|-------|-----|
| Sesión de usuario | 8 horas (renovable) |
| Launch token SSO | 60 segundos |
| Caché de roles | 15 minutos |

---

## Variables de entorno — Backend

```env
REDIS_HOST=hidrobart-auth-redis.redis.cache.windows.net
REDIS_PORT=6380
REDIS_PASSWORD=<clave-azure>
REDIS_SSL=true
REDIS_DB=0
REDIS_CLUSTER_MODE=false   # standalone — ver nota de operación

AZURE_CLIENT_ID=<app-registration-id>
AZURE_CLIENT_SECRET=<secret>
AZURE_TENANT_ID=common

SESSION_TTL_SECONDS=28800
```

## Variables de entorno — Frontend

```env
NEXTAUTH_URL=https://hidrosso.hidrobart.com
NEXTAUTH_SECRET=<openssl rand -base64 32>

AZURE_CLIENT_ID=<app-registration-id>
AZURE_CLIENT_SECRET=<secret>
AZURE_TENANT_ID=common

NEXT_PUBLIC_AUTH_API=https://auth-api.hidrobart.com
NEXT_PUBLIC_APP_NAME=Hidrobart
NEXT_PUBLIC_APP_URL=https://hidrosso.hidrobart.com
```

---

## Postmortem — Incidente 2026-04-27

**Síntoma:** `sso_error` en Costeo360 al intentar acceder vía SSO desde HidroSSO.

**Causa raíz:** Azure Cache for Redis redistribuyó el slot 6300 a un nodo interno diferente. El cliente standalone no puede seguir el redirect `MOVED` para operaciones de escritura (`DELETE`). El endpoint `sso-exchange` no capturaba la excepción, retornando 500.

**Resolución:** Capturar la excepción `ResponseError` de Redis en el `DELETE` del launch token dentro de `sso_exchange`. El token expira en 60s de forma natural — sin impacto de seguridad.

**Qué no hacer:** No usar `RedisCluster` con Azure — los nodos internos no son accesibles desde la VM y Redis falla completamente al iniciar.

**Tiempo de resolución:** ~45 minutos (diagnóstico + fix + deploy).

---

## Workflow de desarrollo

1. Editar en VS Code local (`C:\ClaudeCowork\hidroSSOv2`)
2. `git push` al repositorio
3. En la VM: `git pull` → `pm2 restart hidrosso-api` (backend) o `npm run build` + `pm2 restart hidrosso-frontend` (frontend)
4. **Nunca editar directamente en el servidor** — rompe el historial y puede introducir syntax errors sin forma de revertir limpiamente.
