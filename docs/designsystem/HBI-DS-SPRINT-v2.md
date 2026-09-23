# hidroBIntel — Documento de trabajo: Design System v2 y modelo de sprint

> **Código:** HBI-DSS-v2.0.0 · **Fecha:** 2026-08-10 · **Autor:** Philippe Abadie / Evolve Consultores
> **Estado:** borrador de trabajo — pendiente de VoBo
> **Reemplaza a:** `HBLayoutApp/hidrobart-tokens.css v1.0.0` y la sección «Brand Guidelines» de `CLAUDE.md` (raíz)
> **Entregables asociados:** `hidrobintel-ds.html` (sistema vivo) · `hidrobintel-tokens.css` (fuente de verdad)

---

## 0. Contexto y encuadre

La plataforma se llama **hidroBIntel**. Hoy vive en `hidrosso.hidrobart.com` porque nació como el SSO;
el nombre correcto es el de la plataforma, no el del componente de autenticación. Este documento asume
el rename a **`hidrobintel.hidrobart.com`** y trata al SSO como un módulo dentro de la plataforma, no al revés.

El design system se distribuye **desde ahí** hacia Costeo360, CRM v2, Cliente360, HBTrade360,
Planificador, Cortex, Dashboard Institucional y Documentación.

### Qué se revisó para escribir esto

| Fuente | Qué aportó |
|---|---|
| `hidroBIntelApps/BrandKit/1.MANUAL HIDROBART.pdf` (32 págs) | Paleta oficial con Pantone/HEX, tipografías Nexa y Montserrat, extensiones visuales (hexágonos, 6 íconos conceptuales, patrones), reglas de uso de logo |
| `BrandKit/2. LOGOS`, `3. TIPOGRAFÍAS`, `4. EXTENSIONES VISUALES` | Assets disponibles: imagotipo, imagotipo secundario, isotipo (EPS/PNG), 9 cortes de Nexa, hexágonos en 6 colores, 18 íconos de producto, 6 íconos abstractos, 3 patrones |
| `CLAUDE.md` (raíz) | Estándar de layout vigente, decisiones de arquitectura, reglas «qué no hacer» |
| `HBLayoutApp/hidrobart-tokens.css` | Tokens v1 — base de la auditoría |
| `HBI-MAAPI-SPEC-v1.0.01.html` | Contrato de API para móvil y agentes de IA |
| `TASKS.md` (raíz) | Backlog real del ecosistema — insumo del roadmap de sprints |
| `_registro/proyectos.md` | Convención de documentación por proyecto y mapeo sesión → proyecto |
| `hidroSSOv2/frontend/data/apps.json` | Inventario de apps del portal |

> **Nota honesta sobre el modelo de sprint.** Revisé la documentación y **no existe hoy un modelo de sprint
> definido**. Lo que sí existe, y es bueno, es una convención de documentación por proyecto
> (`CLAUDE.md`, `TASKS.md`, `docs/BRIEF_TECNICO_*`, `docs/BITACORA_*`, `docs/handoff-*`, `docs/adr/`)
> más un skill de cierre de día que la alimenta. El modelo de la sección 5 **se construye encima de esa
> maquinaria**, no la sustituye.

---

## PARTE I — LOOK AND FEEL

## 1. Diagnóstico del estándar actual

El estándar v1 hizo bien lo difícil: unificar el layout y comprometerse con la paleta de marca.
Falla en la capa de abajo — la forma en que los valores están escritos hace imposible variar el sistema.

### 1.1 Defectos de accesibilidad (medidos, no opinados)

Ratios calculados con la fórmula de luminancia relativa de WCAG 2.1:

| Par | Ratio | Requisito AA | Veredicto |
|---|---|---|---|
| `--hb-text-muted #94a3b8` sobre blanco | **2.56:1** | 4.5:1 | ❌ Falla |
| `--hb-primary #0072CE` sobre `--hb-content-bg #f1f5f9` | **4.46:1** | 4.5:1 | ❌ Falla por poco |
| Celeste `#6CACE4` sobre blanco | **2.43:1** | 4.5:1 | ❌ Falla (como texto) |
| Amarillo `#DECD63` sobre blanco | **1.61:1** | 4.5:1 | ❌ Falla (como texto) |
| Verde `#A9C47F` sobre blanco | **1.93:1** | 4.5:1 | ❌ Falla (como texto) |
| Naranja `#ECA154` sobre blanco | **2.14:1** | 4.5:1 | ❌ Falla (como texto) |
| Azul Hidrobart `#3A5DAE` con texto blanco | 6.26:1 | 4.5:1 | ✅ |
| Carbón `#13294B` con texto blanco | 14.52:1 | 4.5:1 | ✅ |
| Azul Flow `#0072CE` con texto blanco | 4.89:1 | 4.5:1 | ✅ |

**D1** — `--hb-text-muted: #94a3b8` gobierna `.hb-label` (todas las etiquetas en mayúsculas de la UI),
placeholders y metadatos. Es el defecto de mayor alcance del sistema actual.
**Corrección:** `#5B6B7C` → 5.13:1.

**D2** — El acento primario está cumpliendo dos trabajos incompatibles: color de relleno de botón
(donde con texto blanco encima da 4.89:1 ✅) y color de texto de enlace (donde sobre el fondo gris del
área de contenido da 4.46:1 ❌).
**Corrección:** separarlos. `--hb-accent: #005FA8` (6.15:1) para texto, `--hb-accent-solid: #0072CE`
para relleno.

**D3** — Los colores de catálogo se están usando como si fueran de texto. Su función real es
**relleno con texto Carbón encima** (Carbón sobre Amarillo = 9.0:1 ✅).

### 1.2 Defectos estructurales

| # | Hallazgo | Consecuencia | Respuesta en v2 |
|---|---|---|---|
| D4 | Tokens de una sola capa: `--hb-blue` nombra el color, no el uso | Imposible cambiar de tema sin reescribir cada componente | 3 capas: primitivo → semántico → componente |
| D5 | Estilos en línea en el JSX (el patrón de página está documentado con `style={{...}}`) | Los valores se congelan en el markup; nada hereda del tema | Clases `.hb-*` + variables CSS |
| D6 | Regla «no full dark theme en el área de contenido» | Bloquea el modo oscuro solicitado | Se deroga; el **rail** permanece Carbón en ambos temas |
| D7 | Escala tipográfica en px fijos (11 → 36) | Ignora el tamaño de fuente del SO; no escala con densidad | `rem` + escala modular + KPI fluido con `clamp()` |
| D8 | Sin foco, estado vacío, carga ni error definidos | Cada app improvisa; teclado sin señal visible | `:focus-visible` global + patrones de estado |
| D9 | Íconos emoji en `apps.json` (🤖 📊 💰) | Render distinto por SO; cero marca | Hexágonos + íconos de las extensiones visuales del BrandKit |

### 1.3 El activo desaprovechado

El BrandKit trae un sistema visual completo que **hoy no se usa en ninguna app**:

- Hexágonos en 6 colores (SVG, EPS, PNG)
- 6 íconos conceptuales: crecimiento, flujo, sistema, excelencia, innovación, equipos
- 18 íconos de producto (ósmosis, cartuchos, portafiltros, tanques, válvulas, UV…)
- 3 patrones hexagonales

Mientras tanto, el portal identifica las apps con emoji. Es el hallazgo con mejor relación
esfuerzo/impacto de toda la auditoría.

---

## 2. Arquitectura del sistema v2

### 2.1 Tres capas de tokens

```
CAPA 1 · PRIMITIVOS   --hbp-*    valores crudos de marca. NUNCA en componentes.
CAPA 2 · SEMÁNTICOS   --hb-*     intención de uso. Cambian con tema y densidad.
CAPA 3 · COMPONENTE   --hbc-*    medidas de un componente concreto.
```

**Regla de oro:** un componente sólo consume capa 2 y 3. **Un HEX literal dentro de un componente es un bug.**
Si falta un token, se agrega al sistema — no se improvisa en la app.

El tema y la densidad se conmutan con atributos en el documento:

```html
<html lang="es" data-theme="light|dark" data-density="comfortable|compact">
```

### 2.2 Tema oscuro — los roles se invierten

Sobre superficie oscura, Azul Hidrobart `#3A5DAE` da **2.52:1**: inutilizable como texto o cabecera.
En dark, **Celeste toma el rol de acento legible**.

| Rol | Claro | Oscuro | Ratio en dark |
|---|---|---|---|
| Canvas | `#F5F8FB` | `#0A1729` | — |
| Superficie | `#FFFFFF` | `#122641` | — |
| Texto primario | `#13294B` | `#E8EFF7` | 13.1:1 |
| Texto secundario | `#41556B` | `#A9BDD4` | 7.9:1 |
| Texto atenuado | `#5B6B7C` | `#7E93AC` | 4.8:1 |
| Acento de texto | `#005FA8` | `#8FC4EE` | 8.2:1 |
| Cabecera de tabla | `#3A5DAE` + blanco | `#1B3557` + Celeste-300 | 6.7:1 |
| Rail de plataforma | `#13294B` | `#071223` | — |

La cabecera de tabla conserva la señal cognitiva («la cabecera es azul») sin deslumbrar ni fallar contraste.

### 2.3 Densidad

Una variable, `--hb-density`, multiplica toda la escala de espaciado.

| | Cómoda | Compacta |
|---|---|---|
| Cuerpo | 14px | 13px |
| Alto de control | 40px | 32px |
| Alto de fila | 48px | 34px |
| Padding de página | 32px | 20px |
| Uso | Dashboards, formularios, detalle | Costeo, pipeline, listados largos |

**Excepción no negociable:** por debajo de 768px todos los controles vuelven a 44px de alto mínimo
(WCAG 2.5.5). Ahorrar píxeles a costa del dedo no es una optimización.

### 2.4 AppShell — el cambio estructural

Hoy cada app tiene un sidebar Carbón de 260px y el portal es una pantalla aparte: **al entrar a una app,
el usuario siente que salió de hidroBIntel.**

v2 divide la navegación en dos capas:

```
┌──────┬────────────────┬────────────────────────────────────┐
│ RAIL │  SIDEBAR APP   │  TOPBAR: breadcrumb · rol · avatar │
│ 56px │     248px      ├────────────────────────────────────┤
│ Car- │  superficie    │  PAGE HEADER: título + ≤2 acciones │
│ bón  │  del tema      │  KPIs · filtros · tabla/cards      │
│ SIEM-│                │                                    │
│ PRE  │  navSections   │                                    │
└──────┴────────────────┴────────────────────────────────────┘
```

- **Rail de plataforma (56px):** siempre visible, siempre Carbón en ambos temas. Contiene el isotipo,
  el switcher de apps y preferencias. Cambiar de app deja de ser navegar; es conmutar.
- **Sidebar de app (248px):** adopta la superficie del tema. `navSections` sigue **hardcoded por app**
  — esa decisión de arquitectura se mantiene.

Esto resuelve tres cosas a la vez: continuidad entre apps, modo oscuro sin romper la identidad Carbón,
y un lugar natural para el estado global de sesión del SSO.

### 2.5 Color por módulo

Cada app recibe un color de la paleta de catálogo, usado en ícono, borde superior de card e indicador
del rail. **Nunca en texto ni en botones** — esos siguen en Azul Flow.

| App | Color | Token | Extensión visual |
|---|---|---|---|
| HBTrade360 | Naranja `#ECA154` | `--hbp-cat-orange` | flujo |
| Costeo360 | Amarillo `#DECD63` | `--hbp-cat-yellow` | crecimiento |
| Cliente360 | Azul Flow `#0072CE` | `--hbp-flow` | excelencia |
| CRM v2 | Verde `#A9C47F` | `--hbp-cat-green` | equipos |
| Cortex | Lila `#BA9CC5` | `--hbp-cat-lila` | innovación |
| Dashboard Institucional | Celeste `#6CACE4` | `--hbp-celeste` | sistema |
| Planificador | Vino `#672E45` | `--hbp-cat-wine` | crecimiento |
| Documentación | Metal `#7A99AC` | `--hbp-cat-metal` | sistema |
| DocProcesos | Gris `#566361` | `--hbp-cat-gray` | flujo |

---

## 3. Qué se mantiene y qué se deroga de v1

### Se mantiene

- El rail de plataforma es siempre Carbón `#13294B`
- Cabecera de tabla azul como señal cognitiva del equipo
- Breadcrumb «Módulo · Página» en el topbar
- Máximo dos botones en el encabezado de página (uno secundario + uno primario)
- Navegación declarada en código, no en JSON dinámico
- Montserrat como única tipografía de UI; Nexa sólo para el logo
- En móvil las tablas se convierten en cards — nunca scroll horizontal
- Logos desde el CDN `hidrobartmedia.blob.core.windows.net`

### Se deroga

| Regla v1 | Motivo |
|---|---|
| «No full dark theme en el área de contenido» | Se pide modo oscuro; se sustituye por «el rail permanece Carbón en ambos temas» |
| Sidebar Carbón de 260px en cada app | Pasa a superficie de tema; el Carbón se concentra en el rail |
| Estilos en línea dentro del JSX | Impiden que el tema se herede |
| `--hb-text-muted: #94a3b8` | Falla WCAG AA (2.56:1) |
| Íconos emoji en el portal | Render inconsistente, cero marca |

---

## 4. Reglas de datos

De esto vive el equipo, así que no se negocian:

1. Números a la derecha, texto a la izquierda.
2. `font-variant-numeric: tabular-nums` siempre — sin ancho fijo las cifras «bailan» al actualizarse.
3. Moneda con separador de miles y 2 decimales: `$ 1,284,900.00`.
4. **El color no es el único portador del estado.** Un badge lleva ícono + texto, no sólo fondo verde.
5. Cabecera de tabla sticky en listados largos.
6. Máximo 7 columnas visibles en desktop.
7. Gráficas: máximo 5 series categóricas; el resto se agrupa en «Otros».

---

## PARTE II — MODELO DE SPRINT

## 5. Modelo de sprint HB-SPRINT-001

### 5.1 Por qué una semana

El equipo de desarrollo es esencialmente **una persona más asistentes de IA**. En ese contexto:

- La velocidad de producción de código es alta; el cuello de botella es **la decisión y la validación**,
  no el tecleo.
- Un sprint de dos semanas acumula demasiadas decisiones sin cerrar antes de la primera demo.
- Ya existe un ritmo diario real: el skill de **cierre de día** genera bitácora, brief y handoff.

**Cadencia: 1 semana, lunes a viernes.** El sprint es la unidad de compromiso; el cierre de día es la
unidad de trazabilidad. No se duplica trabajo: el sprint *consume* lo que el cierre de día ya escribe.

### 5.2 Ceremonias (2 horas por semana en total)

| Cuándo | Qué | Duración | Salida |
|---|---|---|---|
| Lunes 9:00 | **Planeación** — elegir de 3 a 5 ítems de `TASKS.md`, escribir el Sprint Goal en una frase | 30 min | `docs/sprints/SPRINT_AAAAMMDD.md` con el plan |
| Diario, al terminar | **Cierre de día** — skill `cierre-dia` | automático | `BITACORA_*`, `BRIEF_TECNICO_*`, `handoff-*`, `TASKS.md` actualizado |
| Miércoles | **Punto de control** (opcional, sólo si algo se atoró) | 15 min | Renegociar alcance del sprint, no extenderlo |
| Viernes 16:00 | **Demo + Retro** — correr el DoD, mover ítems en `TASKS.md`, cerrar el sprint | 45 min | Sección de cierre en `SPRINT_AAAAMMDD.md` |

### 5.3 Capacidad: bloques, no puntos

Los story points no funcionan con un equipo de una persona. Se usa **bloques de ~2 horas de trabajo enfocado**.

- Una semana realista = **12 bloques** (no 20: hay operación, juntas y decisiones de negocio).
- Se comprometen como máximo **10 bloques**; los 2 restantes absorben lo imprevisto.
- Si un ítem no se puede estimar en bloques, no está listo para entrar al sprint (ver DoR).

### 5.4 Estados en TASKS.md

Se usa la convención que ya está declarada en `_registro/proyectos.md`:

| Símbolo | Significado | Regla |
|---|---|---|
| 🔥 **AHORA** | En el sprint actual | Máximo 5 ítems simultáneos |
| 🟡 **VoBo** | Terminado técnicamente, espera decisión de Philippe | No bloquea el cierre del sprint |
| 📋 **BACKLOG** | Priorizado pero no comprometido | Fuente de la planeación del lunes |
| ✅ **HECHO** | Cerrado y verificado con el DoD | Con fecha |
| 📎 **Ref** | Referencia, no es tarea | — |

`TASKS.md` **no es por día**: se actualiza en su lugar. Es el punto de entrada único.

### 5.5 Definition of Ready (para entrar al sprint)

Un ítem no entra si le falta alguno:

- [ ] **Objetivo de negocio** en una frase: quién lo usa y para qué.
- [ ] **Contrato de datos definido**: endpoint existente, o `HBI-MAAPI-SPEC` si es móvil/IA, o SP de MySQL si es escritura.
- [ ] **Pantalla mapeada a un patrón del DS**: listado, detalle, wizard, dashboard o formulario. Si no encaja en ninguno, primero se decide el patrón.
- [ ] **Criterio de aceptación verificable** (no «que se vea bien»).
- [ ] **Estimación en bloques** (1, 2, 3, 5 u 8; si da más de 8, se parte).

### 5.6 Definition of Done (para cerrar)

Checklist de 10 puntos. Los 4 primeros son del design system y son los que hoy se saltan:

- [ ] **1.** Cero HEX literales en componentes → `grep -rniE "#[0-9a-f]{6}" src/components/` sale vacío
- [ ] **2.** Funciona en `data-theme="light"` y `data-theme="dark"`
- [ ] **3.** Funciona en densidad cómoda y compacta
- [ ] **4.** Sin scroll horizontal en 360 / 768 / 1280 px; tablas → cards por debajo de 768px
- [ ] **5.** Contraste AA verificado (axe DevTools sin violaciones en ambos temas)
- [ ] **6.** Foco visible con teclado en toda la ruta principal
- [ ] **7.** Contrato de respuesta cumplido (`{ok, data, error, meta}` si toca MAAPI)
- [ ] **8.** Escrituras vía Stored Procedure, sin SQL inline de negocio
- [ ] **9.** Bitácora y handoff del día generados; `TASKS.md` movido a ✅
- [ ] **10.** Commit + push a GitHub; pull verificado en `hidroSuiteVM`

### 5.7 Artefactos por sprint

Se agrega **una sola cosa** a la convención existente:

```
<proyecto>/
├── CLAUDE.md                              ← contexto, acumulativo
├── TASKS.md                               ← backlog vivo, acumulativo
└── docs/
    ├── sprints/SPRINT_AAAAMMDD.md         ← NUEVO: plan + cierre del sprint
    ├── BRIEF_TECNICO_AAAAMMDD.md          ← uno por día (ya existe)
    ├── BITACORA_AAAAMMDD.md               ← uno por día (ya existe)
    ├── handoff-<proyecto>-AAAAMMDD.md     ← uno por día (ya existe)
    └── adr/ADR-NNNN-<slug>.md             ← cuando haya decisión de arquitectura
```

**Plantilla de `SPRINT_AAAAMMDD.md`:**

```markdown
# Sprint AAAAMMDD — <proyecto>
**Goal:** <una frase>
**Capacidad comprometida:** N bloques de 12

## Compromiso
| # | Ítem | Bloques | DoR ✔ | Resultado |
|---|------|---------|-------|-----------|

## Cierre (viernes)
- Entregado:
- No entregado y por qué:
- Decisiones tomadas (→ ADR si aplica):
- Deuda generada (→ BACKLOG):
- Ajuste para el siguiente sprint:
```

---

## 6. Roadmap propuesto — 6 sprints

Derivado del `TASKS.md` real del ecosistema. Un sprint por semana.

| Sprint | Foco | Entregable verificable | Insumo de TASKS.md |
|---|---|---|---|
| **S1** | **Fundación DS v2** | `hidrobintel-tokens.css` en el repo, `ThemeProvider` con persistencia de tema y densidad, `AppShell.tsx` (rail + sidebar) funcionando en hidroBIntel. Rename `hidrosso` → `hidrobintel`. | Layout estándar — aplicar a todo el ecosistema |
| **S2** | **Portal hidroBIntel** | Portal con hexágonos de marca, color por módulo, dark mode completo, filtro por `tier`/`roles`. `apps.json` migrado. | HidroSSO v2 — dashboard; apps.json |
| **S3** | **Costeo360 (piloto)** | Migración completa al AppShell. Es la referencia v3.0, así que valida el sistema contra la app más madura. Densidad compacta en listas de precio. | Costeo360 — VIQUA 2025/2026; integrar HidroSSO |
| **S4** | **CRM v2** | AppShell + dashboard + gráficos + roles y visibilidad. La app con más deuda de diseño. | CRMv2 — replicar diseños, dashboard, gráficos, roles |
| **S5** | **Cliente360 + HBTrade360** | Migración de ambas; validar que el sistema aguanta dos apps en paralelo sin ramificarse. | Layout estándar; HBTrade360 |
| **S6** | **Cockpit móvil (PWA)** | PWA sobre `HBI-MAAPI /api/v1/mobile/cockpit`, densidad táctil, tablas → cards, offline básico fuera de alcance. | Interfaces Mobile para todo el ecosistema |

**Fuera de alcance de estos 6 sprints** (siguen en backlog): MarketScout/ProspectScout (rediseño de BD
pendiente), Planificador (falta base de datos), Comercial-Facturas (formalización de proyecto).

---

## 7. Riesgos y decisiones abiertas

| # | Riesgo / decisión | Impacto | Propuesta |
|---|---|---|---|
| R1 | El rename `hidrosso` → `hidrobintel` toca DNS, Azure AD redirect URIs, CORS, `ALLOWED_APPS` y los SDK ya copiados en cada app | Alto — puede tumbar el login de todo el ecosistema | Hacerlo en S1 con `hidrosso.hidrobart.com` como alias permanente; nunca en la misma semana que una migración de app |
| R2 | Derogar «sidebar Carbón por app» contradice `CLAUDE.md` vigente | Medio — confusión en sesiones futuras de Cowork | Actualizar `CLAUDE.md` **el mismo día** que se aprueba este documento |
| R3 | Cuatro apps ya tienen SDK de SSO copiado (Costeo360, CRMv2, HidroPlus, UNIDUM) | Medio | Versionar el SDK y hacer que lea la URL base de `.env`, no hardcoded |
| R4 | Nexa es tipografía comercial | Bajo | Confirmado: sólo en el logo, que se sirve como imagen desde el CDN. UI en Montserrat |
| R5 | ¿La densidad es preferencia de usuario o por pantalla? | Bajo | Propuesta: preferencia de usuario guardada en el perfil del SSO, con override por pantalla en vistas operativas |
| R6 | El área de contenido pasa de `#f1f5f9` a `#F5F8FB` | Bajo | Es un ajuste de temperatura (tinte frío de marca), imperceptible al lado y consistente con Calypso |

### Decisiones que necesitan tu VoBo

1. **Rename a `hidrobintel.hidrobart.com`** — ¿en S1 o antes de empezar?
2. **Derogar la regla de dark theme** de `CLAUDE.md` — confirmado por tu petición, falta escribirlo.
3. **Rail global de 56px** — es el cambio de mayor impacto visual. ¿Va?
4. **Sustituir emoji por hexágonos** en el portal — requiere generar el sprite SVG desde el BrandKit.
5. **Orden del roadmap** — propuse Costeo360 antes que CRM v2 porque es la referencia validada; si CRM v2 urge más por negocio, se invierte.

---

## 8. Próximos pasos inmediatos

1. Revisar `hidrobintel-ds.html` con los switches de tema, densidad y viewport.
2. Marcar VoBo o cambios en las 5 decisiones de la sección 7.
3. Con eso cerrado: actualizar `CLAUDE.md` y `_registro/proyectos.md`, y abrir `SPRINT_20260810.md`.

---

*hidroBIntel — Hidrobart S.A. de C.V. · Evolve Consultores · Paleta y tipografía derivadas del Brand Guideline Hidrobart (La Trividad, 2025)*
