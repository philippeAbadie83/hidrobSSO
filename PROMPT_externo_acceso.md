# PROMPT — Acceso de usuarios EXTERNOS a HidroSuite (rol HBS-Externo)

> Prompt autocontenido para trabajar este tema en una sesión aparte.
> Pegar tal cual en una nueva sesión de Cowork / Claude Code sobre el repo HidroSSO.

---

## Contexto del proyecto

**HidroSSO** = login institucional único con Microsoft 365 para todas las apps Hidrobart
(Costeo360, Cortex, Dashboard, Dir360, CRM v2, etc.). El usuario hace login UNA vez y entra
a las demás apps sin volver a poner credenciales.

- **Frontend:** Next.js 15 (App Router) — NextAuth + Azure AD — puerto 3010
- **Backend:** FastAPI + uvicorn — Redis (Azure Cache) — puerto 8010
- **Auth:** sesión compartida en Redis, cookie `hidrosso_sid`
- **Repo:** `philippeAbadie83/hidrobSSO` → local `C:\ClaudeCowork\hidroSSOv2`

**Reglas duras del proyecto:**
- NO Docker. Correr con `uvicorn` y `npm run dev`.
- Workflow: editar en VS Code local → `git push` → en VM `git pull` → build → `pm2 restart`.
  Nunca editar directo en la VM.
- Dominios válidos: hidrobart.com, hidrobart.com.mx, hidrobart.com.br.

## Roles (capa OrgRole, vienen de grupos Azure AD `HBS-*`)

SuperAdmin, Admin, Coordinador, Operador, Compras, Vendedor, CustomerSuccess,
Observador, **Externo**. Default sin grupo = Vendedor.

---

## El problema

El rol **HBS-Externo** (proveedores, consultores, clientes externos) **no puede usar el SSO
actual**. El SSO exige dos cosas:

1. Que la persona tenga cuenta **dentro del tenant Azure AD de Hidrobart**.
2. Que su correo sea de un dominio Hidrobart — el backend lo bloquea en
   `backend/app/core/security.py` → `is_allowed_domain()`.

Un externo normalmente no cumple ninguna: su correo es de otra empresa y no está en el tenant.
Sin cuenta M365 de Hidrobart, el flujo de Azure no lo reconoce o el backend lo rechaza.

## Puntos de código relevantes

- `backend/app/core/security.py` → `is_allowed_domain()` (bloqueo por dominio).
- `backend/app/services/azure_ad.py` → `map_groups_to_org_roles()` (HBS-Externo → rol Externo)
  y `get_user_groups()`.
- `backend/app/routers/sso_router.py` → `ALLOWED_APPS` (apps que aceptan SSO).
- `frontend/app/dashboard/page.tsx` → `canSee()` (qué apps ve cada rol).

## Opciones a evaluar (decidir cuál implementar)

### Opción 1 — Invitado B2B de Azure AD  ✅ recomendada
Invitar al externo como **guest** en el tenant Hidrobart. Conserva su correo propio pero
recibe una identidad de Azure; se le agrega al grupo `HBS-Externo` y **puede hacer SSO normal**.
- Cambios: relajar `is_allowed_domain()` para aceptar invitados (detectar `#EXT#` en el UPN
  o validar pertenencia al tenant en vez del dominio del correo).
- Acotar `HBS-Externo` a un set mínimo de apps (nuevo tier `external` en `apps.json` + `canSee`).
- Pros: reutiliza el SSO existente. Contras: hay que gestionar invitaciones B2B en Azure.

### Opción 2 — Portal aparte sin SSO
El externo nunca toca Azure; login propio (credenciales o magic link) limitado a una sola app.
- Pros: aislamiento total. Contras: construir un auth paralelo y mantenerlo.

### Opción 3 — Links por app con token temporal
Enlaces de un solo uso / con expiración a recursos puntuales, sin cuenta fija.
- Pros: cero gestión de cuentas. Contras: no sirve para acceso recurrente.

## Entregables esperados de la sesión

1. Decisión de opción (1 / 2 / 3) con justificación corta.
2. Diseño del flujo de auth para externos (diagrama de pasos).
3. Lista de cambios concretos por archivo (backend + frontend).
4. Definición de qué apps ve `HBS-Externo` (tier mínimo).
5. Plan de pruebas end-to-end con un usuario externo de prueba.

## Restricciones al implementar

- Respetar el workflow git (no editar en VM).
- No introducir Docker.
- Cambios chicos y reversibles; pedir VoBo entre pasos.
