# HidroSSO — Role Schema Specification
**Versión:** 1.0 | **Fecha:** 2026-04-21 | **Proyecto:** HidroSuite / Hidrobart

---

## Arquitectura de Roles: 3 Capas

El sistema usa 3 capas combinadas para determinar qué puede hacer cada usuario en cada app.

```
Azure AD Groups
      ↓
  CAPA 1: OrgRole       →  ¿Qué "rango" tiene en la organización?
  CAPA 2: FunctionalRole →  ¿A qué área/departamento pertenece?
  CAPA 3: ProcessRole    →  ¿Qué puede hacer en cada módulo?
```

---

## CAPA 1 — OrgRole (Rango Organizacional)

Viene de los **grupos de Azure AD** con prefijo `HB-`. El backend detecta la palabra clave en el nombre del grupo (case-insensitive).

### Grupos Azure AD → OrgRole

| Grupo Azure AD    | Palabra clave detectada       | OrgRole asignado |
|-------------------|-------------------------------|------------------|
| `HB-SuperAdmin`   | `superadmin`, `super_admin`   | `SuperAdmin`     |
| `HB-Admin`        | `admin`, `administrator`      | `Admin`          |
| `HB-Manager`      | `manager`, `gerente`          | `Manager`        |
| `HB-Employee`     | `employee`, `empleado`, `staff`, `colaborador` | `Employee` |
| `HB-External`     | `external`, `externo`, `proveedor` | `External`  |

> **Default:** Si el usuario no pertenece a ningún grupo mapeado, recibe `Employee`.

### Descripción de cada OrgRole

| OrgRole       | Descripción                                      | Acceso general                          |
|---------------|--------------------------------------------------|-----------------------------------------|
| `SuperAdmin`  | Dueños / dirección general                       | Todo, sin restricciones                 |
| `Admin`       | Administradores del sistema                      | Gestión de usuarios, configuración apps |
| `Manager`     | Gerentes y supervisores                          | Aprobaciones, reportes, sin configurar  |
| `Employee`    | Colaboradores estándar                           | Trabajo operativo diario                |
| `External`    | Proveedores / consultores externos               | Acceso mínimo y controlado              |

### Asignaciones actuales Hidrobart SA de CV

| Persona            | Puesto                       | OrgRole       | Grupo Azure AD    |
|--------------------|------------------------------|---------------|-------------------|
| Philippe           | Dueño                        | `SuperAdmin`  | `HB-SuperAdmin`   |
| Guillermo          | Dueño                        | `SuperAdmin`  | `HB-SuperAdmin`   |
| Héctor             | Administrador                | `Admin`       | `HB-Admin`        |
| Martín             | Gerente Administración       | `Manager`     | `HB-Manager`      |
| Rodrigo            | Gerente Ventas               | `Manager`     | `HB-Manager`      |
| Rodrigo Acosta     | Supervisor Ventas Químicos   | `Manager`     | `HB-Manager`      |
| Alberto Gómez      | Supervisor Ventas            | `Manager`     | `HB-Manager`      |
| Alberto Rodríguez  | Logística                    | `Employee`    | `HB-Employee`     |

---

## CAPA 2 — FunctionalRole (Área / Departamento)

Define a qué área pertenece el usuario. **No viene de Azure AD** — se asigna en la base de datos de cada app. Se combina con el OrgRole para afinar el acceso.

| FunctionalRole       | Área                        |
|----------------------|-----------------------------|
| `Ventas`             | Fuerza de ventas            |
| `Operaciones`        | Operaciones generales       |
| `Finanzas`           | Finanzas y administración   |
| `Logistica`          | Logística y almacén         |
| `Compras`            | Compras y proveeduría       |
| `RecursosHumanos`    | Recursos humanos            |
| `Mantenimiento`      | Mantenimiento industrial    |
| `Ingenieria`         | Ingeniería                  |
| `TI`                 | Tecnología de información   |
| `Calidad`            | Control de calidad          |
| `SeguridadIndustrial`| Seguridad industrial        |
| `Gerencia`           | Dirección / gerencia        |
| `Visualizador`       | Solo lectura transversal    |

### Combinación OrgRole + FunctionalRole — Ejemplos

| OrgRole    | FunctionalRole | Resultado práctico                              |
|------------|----------------|-------------------------------------------------|
| `Manager`  | `Ventas`       | Gerente de ventas — aprueba, reporta, gestiona  |
| `Manager`  | `Finanzas`     | Gerente admin — aprueba compras, ve finanzas    |
| `Employee` | `Ventas`       | Vendedor — crea cotizaciones, ve su pipeline    |
| `Employee` | `Logistica`    | Operador logística — registra movimientos       |
| `Admin`    | `Compras`      | Administra módulo de compras completo           |

---

## CAPA 3 — ProcessRole (Permisos por Módulo)

Permisos granulares que se aplican **dentro de cada módulo** de cada app.

### Permisos disponibles

| Permiso        | Código          | Descripción                              |
|----------------|-----------------|------------------------------------------|
| Leer           | `leer`          | Ver registros y datos                    |
| Escribir       | `escribir`      | Crear y editar registros                 |
| Aprobar        | `aprobar`       | Validar / autorizar registros            |
| Administrar    | `administrar`   | Configurar el módulo                     |
| Reportar       | `reportar`      | Exportar reportes y dashboards           |
| Configurar     | `configurar`    | Parámetros globales del sistema          |

### Módulos del sistema

| Módulo           | Clave             | Descripción                    |
|------------------|-------------------|--------------------------------|
| HidroPlus        | `hidroplus`       | App principal                  |
| Portal Empleado  | `portal_emp`      | Portal de colaboradores        |
| Ops Dashboard    | `ops_dashboard`   | Dashboard operativo            |
| Mantenimiento    | `mantenimiento`   | Gestión de mantenimiento       |
| Compras          | `compras`         | Módulo de compras              |
| RRHH             | `rrhh`            | Recursos humanos               |
| Reportes         | `reportes`        | Reportes y BI                  |
| Configuración    | `configuracion`   | Configuración del sistema      |

### Permisos por defecto según OrgRole

| Módulo           | SuperAdmin                                          | Admin                               | Manager                        | Employee          | External   |
|------------------|-----------------------------------------------------|-------------------------------------|--------------------------------|-------------------|------------|
| `hidroplus`      | leer, escribir, aprobar, administrar, reportar, configurar | leer, escribir, aprobar, reportar | leer, escribir, aprobar, reportar | leer, escribir | leer       |
| `portal_emp`     | todos                                               | leer, escribir, aprobar, reportar   | leer, escribir                 | leer, escribir    | —          |
| `ops_dashboard`  | todos                                               | leer, escribir, aprobar, reportar   | leer, reportar                 | leer              | —          |
| `mantenimiento`  | todos                                               | leer, escribir, aprobar, reportar   | leer, escribir, aprobar        | leer, escribir    | leer       |
| `compras`        | todos                                               | leer, escribir, aprobar, reportar   | leer, aprobar                  | leer              | —          |
| `rrhh`           | todos                                               | leer, escribir, aprobar, reportar   | leer                           | leer              | —          |
| `reportes`       | todos                                               | leer, escribir, aprobar, reportar   | leer, reportar                 | leer              | —          |
| `configuracion`  | todos                                               | leer, escribir, aprobar, reportar   | —                              | —                 | —          |

---

## Flujo completo de autenticación y roles

```
1. Usuario hace login en HidroSSO con cuenta Microsoft 365
           ↓
2. Backend consulta Azure AD Graph API
   → Obtiene perfil de usuario
   → Obtiene grupos del usuario (ej: HB-SuperAdmin)
           ↓
3. Backend mapea grupos → OrgRole
   "HB-SuperAdmin" contiene "superadmin" → OrgRole: SuperAdmin
           ↓
4. Se crea sesión en Redis (8h TTL)
   { user_id, email, roles: { org, functional, process }, tenant }
           ↓
5. Usuario ve Dashboard HidroSSO con badge de rol
           ↓
6. Usuario hace clic en app (ej: Costeo360)
   → /api/sso-launch genera launch token (60s, one-time)
   → Redirige a Costeo360 con ?lt=lt_xxxxx
           ↓
7. Costeo360 /api/sso-entry canjea el token
   → Llama a HidroSSO /auth/sso-exchange
   → Recibe session_id
   → Setea cookie hidrosso_sid (httpOnly, 8h)
           ↓
8. Costeo360 llama /auth/session-info para obtener roles
   → Recibe { roles: { org: ["SuperAdmin"], functional: [...], process: {...} } }
           ↓
9. Costeo360 aplica permisos según roles recibidos
```

---

## Estructura JSON de sesión en Redis

```json
{
  "session_id": "lt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "user_id": "azure-ad-user-object-id",
  "email": "philippe@hidrobart.com",
  "name": "Philippe",
  "tenant": "hidrobart.com",
  "roles": {
    "org": ["SuperAdmin"],
    "functional": ["Gerencia"],
    "process": {
      "hidroplus":     ["leer", "escribir", "aprobar", "administrar", "reportar", "configurar"],
      "portal_emp":    ["leer", "escribir", "aprobar", "administrar", "reportar", "configurar"],
      "ops_dashboard": ["leer", "escribir", "aprobar", "administrar", "reportar", "configurar"],
      "mantenimiento": ["leer", "escribir", "aprobar", "administrar", "reportar", "configurar"],
      "compras":       ["leer", "escribir", "aprobar", "administrar", "reportar", "configurar"],
      "rrhh":          ["leer", "escribir", "aprobar", "administrar", "reportar", "configurar"],
      "reportes":      ["leer", "escribir", "aprobar", "administrar", "reportar", "configurar"],
      "configuracion": ["leer", "escribir", "aprobar", "administrar", "reportar", "configurar"]
    }
  },
  "created_at": "2026-04-21T00:00:00Z"
}
```

---

## Implementación en apps (Costeo360 y otras)

Para que una app use los roles de HidroSSO debe:

### 1. Obtener roles del usuario
```typescript
// Llamar al endpoint de HidroSSO con la cookie hidrosso_sid
const res = await fetch(`${HIDROSSO_API}/auth/session-info`, {
  headers: { Cookie: `hidrosso_sid=${sessionId}` }
});
const { roles } = await res.json();
// roles.org = ["SuperAdmin"]
// roles.functional = ["Gerencia"]
// roles.process = { compras: ["leer","escribir",...] }
```

### 2. Verificar rol organizacional
```typescript
const isAdmin    = roles.org.includes("SuperAdmin") || roles.org.includes("Admin");
const isManager  = ["SuperAdmin","Admin","Manager"].some(r => roles.org.includes(r));
const isSuperAdmin = roles.org.includes("SuperAdmin");
```

### 3. Verificar permiso en módulo
```typescript
const canApprove = (module: string) =>
  roles.process[module]?.includes("aprobar") ?? false;

const canConfigure = (module: string) =>
  roles.process[module]?.includes("configurar") ?? false;
```

---

*Documento generado por HidroSSO — Hidrobart SA de CV*
