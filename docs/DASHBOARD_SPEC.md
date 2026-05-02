# HidroSSO Dashboard — Schema & Design Spec
**Versión:** 1.0.03 · **Fecha:** 2026-04-21 · **Autor:** Philippe Abadie

---

## 1. Visión general

El dashboard de HidroSSO es el portal de entrada al ecosistema **hidroBIntel**. Cada app del ecosistema Hidrobart aparece como una tarjeta navegable. El sistema es **paramétrico**: las apps se definen en un archivo JSON externo, no en el código del componente.

---

## 2. Arquitectura de archivos

```
frontend/
├── app/
│   └── dashboard/
│       └── page.tsx          ← Componente principal (lee apps.json)
│   └── dashboardFirst/
│       └── page.tsx          ← Backup del dashboard anterior
└── data/
    └── apps.json             ← Fuente de verdad de las apps
```

---

## 3. Schema — `apps.json`

Cada entrada del array representa una app del ecosistema.

### 3.1 Campos

| Campo    | Tipo                          | Requerido | Descripción |
|----------|-------------------------------|-----------|-------------|
| `id`     | `string`                      | ✅        | Identificador único. Usado para mapear el gradiente del ícono. |
| `name`   | `string`                      | ✅        | Nombre visible en la tarjeta. |
| `sub`    | `string`                      | ✅        | Dominio mostrado debajo del nombre. |
| `desc`   | `string`                      | ✅        | Descripción corta de la app. |
| `icon`   | `string`                      | ✅        | Emoji que representa la app. |
| `url`    | `string`                      | ✅        | URL de destino. Usar `"#"` si no hay URL aún. |
| `tag`    | `string`                      | ✅        | Badge de estado. Vacío `""` o uno de los valores permitidos. |
| `ssoId`  | `string \| null`              | ✅        | ID del app en el backend SSO. `null` = link directo, string = lanza flujo SSO. |
| `active` | `boolean`                     | ✅        | `true` = app activa. `false` = aparece en sección Legado/Deprecado. |
| `tier`   | `"public" \| "team" \| "admin"` | ✅      | Nivel de visibilidad (ver sección 4). |
| `order`  | `number`                      | ✅        | Orden de aparición en el grid (ascendente). |

### 3.2 Valores permitidos para `tag`

| Valor        | Color          | Uso |
|--------------|----------------|-----|
| `""`         | —              | Sin badge de estado |
| `ACTUALIZADO`| Verde          | App recientemente actualizada |
| `NUEVO`      | Azul           | App recién incorporada |
| `PROTOTIPO`  | Amarillo       | En desarrollo, no production-ready |
| `IDEA`       | Púrpura        | Concepto, sin desarrollo real |

### 3.3 Ejemplo completo de entrada

```json
{
  "id":     "costeo",
  "name":   "Costeo360",
  "sub":    "costeo360.hidrobart.com",
  "desc":   "Costeo Hidrobart",
  "icon":   "💰",
  "url":    "https://costeo360.hidrobart.com",
  "tag":    "ACTUALIZADO",
  "ssoId":  "costeo360",
  "active": true,
  "tier":   "public",
  "order":  5
}
```

---

## 4. Sistema de visibilidad — Tiers

El campo `tier` controla qué usuarios ven cada app según su `orgRole` de Azure AD.

### 4.1 Tabla de acceso

| Tier       | Employee | Manager | Admin | SuperAdmin |
|------------|----------|---------|-------|------------|
| `public`   | ✅       | ✅      | ✅    | ✅         |
| `team`     | ❌       | ✅      | ✅    | ✅         |
| `admin`    | ❌       | ❌      | ✅    | ✅         |

### 4.2 Lógica del componente

```ts
function canSee(app: App, orgRoles: string[]): boolean {
  if (app.tier === "public") return true;
  if (app.tier === "team")   return orgRoles.some(r => ["Manager","Admin","SuperAdmin"].includes(r));
  if (app.tier === "admin")  return orgRoles.some(r => ["Admin","SuperAdmin"].includes(r));
  return true;
}
```

### 4.3 Tier actual de cada app

| App                   | Tier     | Razón |
|-----------------------|----------|-------|
| HidroSSO              | `public` | Producción general |
| Cortex                | `public` | Producción general |
| Dashboard Institucional | `team` | Solo gestión y arriba |
| UNIDUM Planificador   | `admin`  | Prototipo, solo Philippe ve |
| Costeo360             | `public` | Producción general con SSO |
| CRM Hidrobart         | `team`   | Solo gestión y arriba |
| CRM Pipeline          | `admin`  | Idea, solo Philippe ve |
| Hidro+                | `public` | Producción general |

### 4.4 Badge visual de tier

Los usuarios Admin/SuperAdmin ven un badge **TEAM** o **ADMIN** en las tarjetas correspondientes, permitiéndoles identificar qué ve cada perfil sin abrir el JSON.

---

## 5. Sistema SSO

Las apps con `ssoId` no abren una URL directamente — lanzan el flujo SSO del backend.

### 5.1 Flujo

```
Click tarjeta SSO
  → GET /api/sso-launch?app={ssoId}
  → Backend genera token de sesión temporal
  → Devuelve { redirect_url }
  → window.open(redirect_url, "_blank")
  → App destino intercambia token → sesión activa
```

### 5.2 Apps con SSO activo

| App           | ssoId      |
|---------------|------------|
| Costeo360     | `costeo360` |
| CRM Hidrobart | `crm2`      |

---

## 6. Diseño visual — Tokens Hidrobart

El dashboard sigue el **Layout Standard Hidrobart v1.1**. Fuente exclusiva: **Montserrat**.

### 6.1 Paleta de colores

| Token              | Hex       | Uso en dashboard |
|--------------------|-----------|-----------------|
| Carbón Activado    | `#13294B` | Header background, texto título de tarjeta |
| Azul Hidrobart     | `#3A5DAE` | Hover border de tarjetas, section label border |
| Celeste Hidrobart  | `#6CACE4` | "BI" en hidroBIntel, saludo, patrón overlay |
| Azul Resina        | `#2C5697` | Gradientes de íconos |
| Azul Flow          | `#0072CE` | Badge SSO, gradientes de íconos |
| Content BG         | `#c8d5e8` | Fondo área de apps |

### 6.2 Gradientes de íconos por app

| App ID      | Gradiente |
|-------------|-----------|
| `hidrosso`  | `#13294B → #2C5697` |
| `cortex`    | `#3A5DAE → #13294B` |
| `superset`  | `#0072CE → #3A5DAE` |
| `unidum`    | `#6CACE4 → #3A5DAE` |
| `costeo`    | `#2C5697 → #0072CE` |
| `crm2`      | `#0072CE → #13294B` |
| `crm1`      | `#3A5DAE → #6CACE4` |
| `hidroplus` | `#6CACE4 → #2C5697` |

### 6.3 Estructura visual de la página

```
┌─────────────────────────────────────────────────────┐
│  HEADER ZONE  (#13294B gradient + patrón hexagonal) │
│  ┌─────────────────────────────────────────────┐    │
│  │ [logo] | hidroBIntel  Philippe [roles] Salir│    │
│  └─────────────────────────────────────────────┘    │
│  Buenas tardes, Philippe 👋 · @hidrobart.com        │
├─────────────────────────────────────────────────────┤
│  CONTENT ZONE  (#c8d5e8)                            │
│  ▌SISTEMAS ACTIVOS                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │
│  │ App  │ │ App  │ │ App  │ │ App  │              │
│  │ card │ │ card │ │ card │ │ card │              │
│  └──────┘ └──────┘ └──────┘ └──────┘              │
└─────────────────────────────────────────────────────┘
```

---

## 7. Cómo agregar una nueva app

1. Abrir `frontend/data/apps.json`
2. Agregar una nueva entrada siguiendo el schema de la sección 3
3. Asignar un `id` único (snake_case, sin guiones)
4. Agregar el gradiente del ícono en `ICON_GRADIENT` dentro de `page.tsx`:
   ```ts
   miapp: "linear-gradient(135deg, #COLOR1 0%, #COLOR2 100%)",
   ```
5. Commit + push + pull en VM + build + pm2 restart

> **Fase 2 (futuro):** cuando el JSON se mueva al backend FastAPI (`GET /config/apps`), el paso 5 se simplifica a editar el JSON en el servidor — sin rebuild.

---

## 8. Cómo promover una app de tier

Cuando una app en `admin` o `team` esté lista para más usuarios:

```json
// Antes — solo admins la ven
{ "tier": "admin", "tag": "PROTOTIPO" }

// Después — todos la ven
{ "tier": "public", "tag": "ACTUALIZADO" }
```

Solo editar el JSON + commit + deploy. Sin cambios en código.

---

## 9. Roadmap

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | JSON en repo (`frontend/data/apps.json`) | ✅ Completado |
| 2 | Endpoint FastAPI `GET /config/apps` | ⏳ Pendiente |
| 3 | Panel admin UI para gestionar apps sin git | 💡 Idea |
