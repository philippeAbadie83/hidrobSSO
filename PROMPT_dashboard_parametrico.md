# Prompt — Dashboard Paramétrico HidroSSO

## Contexto

El dashboard de HidroSSO (`frontend/app/dashboard/page.tsx`) muestra las apps del ecosistema Hidrobart como tarjetas. Actualmente el array `APPS` está hardcodeado en el componente React. El objetivo es sacarlo a un JSON externo para poder actualizar apps, URLs, orden y tags sin tocar código ni hacer rebuild.

---

## Modelo de visibilidad — 3 tiers

Un solo campo `tier` en cada entrada del JSON controla quién ve qué:

| Tier | Quién lo ve | Uso típico |
|------|-------------|------------|
| `"public"` | Todos (Employee, Manager, Admin, SuperAdmin) | Apps de producción para toda la empresa |
| `"team"` | Manager + Admin + SuperAdmin | Herramientas internas, apps de área, no aptas para externos |
| `"admin"` | Admin + SuperAdmin únicamente | Prototipos, ideas, apps en desarrollo, configuración |

El componente ya recibe `orgRoles` desde la sesión de Azure AD. El filtro son 4 líneas:

```ts
function canSee(app: App, orgRoles: string[]) {
  if (app.tier === "public") return true;
  if (app.tier === "team")   return orgRoles.some(r => ["Manager","Admin","SuperAdmin"].includes(r));
  if (app.tier === "admin")  return orgRoles.some(r => ["Admin","SuperAdmin"].includes(r));
  return true;
}
```

---

## Esquema del JSON

Cada entrada en `frontend/data/apps.json`:

```json
{
  "id":      "string — identificador único",
  "name":    "string — nombre visible en la tarjeta",
  "sub":     "string — dominio mostrado debajo del nombre",
  "desc":    "string — descripción corta",
  "icon":    "string — emoji",
  "color":   "string — clases Tailwind del gradiente (from-X to-Y)",
  "url":     "string — URL directa (si no tiene SSO)",
  "tag":     "string — vacío o: ACTUALIZADO | PROTOTIPO | IDEA | NUEVO",
  "ssoId":   "string | null — si tiene valor, lanza flujo SSO en vez de abrir URL",
  "active":  "boolean — false mueve la app a sección Legado/Deprecado",
  "tier":    "string — public | team | admin",
  "order":   "number — orden de aparición en el grid"
}
```

---

## El JSON con las apps actuales

```json
[
  {
    "id":     "hidrosso",
    "name":   "HidroSSO",
    "sub":    "hidrosso.hidrobart.com",
    "desc":   "Login institucional unificado MS365",
    "icon":   "🔐",
    "color":  "from-blue-700 to-blue-950",
    "url":    "https://hidrosso.hidrobart.com",
    "tag":    "",
    "ssoId":  null,
    "active": true,
    "tier":   "public",
    "order":  1
  },
  {
    "id":     "cortex",
    "name":   "Cortex",
    "sub":    "cortex.hidrobart.com",
    "desc":   "Cerebro de IA · Hidrobart",
    "icon":   "🤖",
    "color":  "from-violet-600 to-violet-900",
    "url":    "https://cortex.hidrobart.com",
    "tag":    "",
    "ssoId":  null,
    "active": true,
    "tier":   "public",
    "order":  2
  },
  {
    "id":     "superset",
    "name":   "Dashboard Institucional",
    "sub":    "dashb.hidrobart.com",
    "desc":   "Business Intelligence · Superset",
    "icon":   "📊",
    "color":  "from-orange-600 to-orange-900",
    "url":    "https://dashb.hidrobart.com",
    "tag":    "",
    "ssoId":  null,
    "active": true,
    "tier":   "team",
    "order":  3
  },
  {
    "id":     "unidum",
    "name":   "UNIDUM Planificador",
    "sub":    "unidum.hidrobart.com",
    "desc":   "Planificador Hidrobart",
    "icon":   "📅",
    "color":  "from-cyan-600 to-cyan-900",
    "url":    "https://unidum.hidrobart.com",
    "tag":    "PROTOTIPO",
    "ssoId":  null,
    "active": true,
    "tier":   "admin",
    "order":  4
  },
  {
    "id":     "costeo",
    "name":   "Costeo360",
    "sub":    "costeo360.hidrobart.com",
    "desc":   "Costeo Hidrobart",
    "icon":   "💰",
    "color":  "from-green-600 to-green-900",
    "url":    "https://costeo360.hidrobart.com",
    "tag":    "ACTUALIZADO",
    "ssoId":  "costeo360",
    "active": true,
    "tier":   "public",
    "order":  5
  },
  {
    "id":     "crm2",
    "name":   "CRM Hidrobart",
    "sub":    "crm2.hidrobart.com",
    "desc":   "Pipeline de ventas · CRM v2",
    "icon":   "🤝",
    "color":  "from-sky-600 to-sky-900",
    "url":    "https://crm2.hidrobart.com",
    "tag":    "NUEVO",
    "ssoId":  "crm2",
    "active": true,
    "tier":   "team",
    "order":  6
  },
  {
    "id":     "crm1",
    "name":   "CRM Pipeline",
    "sub":    "crm.hidrobart.com",
    "desc":   "CRM Pipeline — Hidrobart Idea",
    "icon":   "🔗",
    "color":  "from-blue-600 to-blue-900",
    "url":    "#",
    "tag":    "IDEA",
    "ssoId":  null,
    "active": true,
    "tier":   "admin",
    "order":  7
  },
  {
    "id":     "hidroplus",
    "name":   "Hidro+",
    "sub":    "hidroplus.hidrobart.com",
    "desc":   "Portal Hidro+ · Acceso institucional",
    "icon":   "💧",
    "color":  "from-teal-600 to-teal-900",
    "url":    "https://hidroplus.hidrobart.com",
    "tag":    "",
    "ssoId":  null,
    "active": true,
    "tier":   "public",
    "order":  8
  }
]
```

---

## Quién ve qué — resumen

| App | Employee | Manager | Admin / SuperAdmin |
|-----|----------|---------|-------------------|
| HidroSSO | ✅ | ✅ | ✅ |
| Cortex | ✅ | ✅ | ✅ |
| Dashboard Institucional | ❌ | ✅ | ✅ |
| UNIDUM Planificador | ❌ | ❌ | ✅ |
| Costeo360 | ✅ | ✅ | ✅ |
| CRM Hidrobart | ❌ | ✅ | ✅ |
| CRM Pipeline | ❌ | ❌ | ✅ |
| Hidro+ | ✅ | ✅ | ✅ |

> Para mover una app de `admin` a `public` cuando salga a producción: cambiar el `tier` en el JSON y listo, sin tocar código.

---

## Implementación en el componente

```ts
import ALL_APPS from "@/data/apps.json";

// Dentro del componente, después de obtener orgRoles:
const APPS = ALL_APPS
  .filter(app => app.active)
  .filter(app => canSee(app, orgRoles))
  .sort((a, b) => a.order - b.order);

const DEPRECATED = ALL_APPS.filter(app => !app.active);
```

---

## Fase 2 — Endpoint FastAPI (cuando se necesite)

Mover el JSON a `backend/data/apps.json` y crear `GET /config/apps`.
El filtro por tier lo aplica el backend según el token de sesión.
Actualizar las apps pasa a ser editar un archivo en el servidor — sin rebuild del frontend.

Migración desde Fase 1: reemplazar el `import` estático por un `useEffect + fetch`. Cambio mínimo.
