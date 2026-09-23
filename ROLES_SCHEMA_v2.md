# HidroSSO — Roles, usuarios y apps · v2.0

**Fecha:** 24 de agosto de 2026 · **Continúa:** `ROLES_SCHEMA.md` v1.0 (21 abril 2026)
**Estado:** diseño para construir. Nada de esto está implementado todavía.

---

## 0. Qué cambia respecto a v1.0

La v1.0 definió bien las tres capas: **OrgRole** (rango en la organización), **FunctionalRole** (área) y **ProcessRole** (permisos por módulo). Ese modelo mental se conserva completo.

Lo que le faltaba, y es la razón por la que nunca se construyó:

| Faltaba en v1.0 | Se resuelve en v2.0 |
|---|---|
| No hay tablas. Todo era conceptual | Base de datos `hidrobart_sso` con 6 tablas y su DDL |
| Los módulos eran de la era HidroPlus (`hidroplus`, `portal_emp`, `ops_dashboard`) | Las apps reales: `costeo360`, `dir360`, `hbtrade360`, `unidum`, … |
| El rol se **deduce** del grupo de Azure. Una persona tiene un solo rol para todo | Se **asigna** por persona y por app. Alguien puede ser vendedor en una y operador en otra |
| `_get_functional_roles()` devuelve lista vacía con un `TODO` | La capa funcional se persiste o se retira del diseño (ver §7) |
| No se sabe quién pregunta: persona o aplicación | Identidad de aplicación con su propia credencial |

**Principio que ordena todo:** *todos entran por HidroSSO, y HidroSSO contesta quién es la persona y con qué rol entra a cada app.* La duración de la sesión (8 h) no es el problema y se conserva.

---

## 1. El nombre de la base

**`hidrobart_sso`**

Sigue la convención que ya existe: el esquema se llama como el sistema que lo posee — `hidrobart_costeo` es de Costeo360, `hidrobart_compras` de HBTrade360. Este es de HidroSSO.

Se descarta `hidrobart_permisos` porque la base guarda más que permisos: apps, personas, asignaciones y bitácora. El nombre se quedaría corto en tres meses.

**Convención obligatoria** (la auditoría encontró 4 colaciones distintas conviviendo, y eso ya causó un `ERROR 1267` en producción):

```
InnoDB · utf8mb4 · utf8mb4_0900_ai_ci · DATETIME en UTC
```

Sin excepciones. Toda tabla nueva se crea declarando la colación explícitamente.

---

## 2. Modelo de datos — 6 tablas

```
tbl_sso_app          las aplicaciones del ecosistema
tbl_sso_persona      quién es cada quien (ancla: el correo)
tbl_sso_rol          los roles, POR APP
tbl_sso_recurso      las pantallas, POR APP
tbl_sso_permiso      rol × pantalla → nivel
tbl_sso_asignacion   persona × app → rol
```

### 2.1 `tbl_sso_app` — reemplaza el diccionario `ALLOWED_APPS`

Hoy las apps están escritas duro en `sso_router.py:25-35`. Agregar una app exige tocar código y reiniciar.

```sql
CREATE TABLE tbl_sso_app (
  app_clave     VARCHAR(30)  NOT NULL,
  nombre        VARCHAR(80)  NOT NULL,
  url_base      VARCHAR(200) NOT NULL,
  url_sso       VARCHAR(200) NOT NULL COMMENT 'destino del launch token',
  rol_defecto   VARCHAR(30)  NULL COMMENT 'rol si la persona no tiene asignación',
  requiere_asig TINYINT(1)   NOT NULL DEFAULT 0
                COMMENT '1 = sin asignación explícita NO entra',
  activo        TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (app_clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

`requiere_asig` es la palanca que decide el modo de cada app:

- **`0` — abierta.** Quien tenga sesión entra, con `rol_defecto` o con lo que diga su grupo de Azure. Es como funciona todo hoy.
- **`1` — cerrada.** Sin renglón en `tbl_sso_asignacion`, no entra. Aquí es donde de verdad controlas quién ve qué.

Empezar todas en `0` y cerrarlas una por una conforme se pueblan las asignaciones. Así la migración no deja a nadie fuera.

### 2.2 `tbl_sso_persona` — el correo es la llave

```sql
CREATE TABLE tbl_sso_persona (
  email        VARCHAR(150) NOT NULL,
  azure_uuid   VARCHAR(60)  NULL COMMENT 'id de Azure AD (ms_profile.id)',
  nombre       VARCHAR(120) NOT NULL,
  puesto       VARCHAR(80)  NULL,
  area         VARCHAR(60)  NULL,
  activo       TINYINT(1)   NOT NULL DEFAULT 1,
  primer_login DATETIME     NULL,
  ultimo_login DATETIME     NULL,
  creado_en    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email),
  KEY ix_persona_uuid (azure_uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Por qué el correo y no el UUID de Azure:** ya es la convención del ecosistema. `costeo360-api/core/deps.py:22-33` lo dice: *"en BD (campos `*_by`, `*_user`, `log_by`) guardamos el EMAIL — es identificador único y estable"*. Y `hidrobart_master.tbl_vend_map` ya trae columna `email`. Con esto se amarran solos.

El renglón se crea o actualiza solo en cada `ms-login`. Nadie lo captura a mano.

**Lo que NO va aquí:** datos comerciales. El tipo de vendedor, su cuota, su territorio o su plan de trabajo pertenecen a `hidrobart_master.tbl_vend_map`, que ya es el registro de vendedores y ya tiene el correo para amarrar. Un esquema de identidad que empieza a guardar metas de venta deja de ser un esquema de identidad.

### 2.3 `tbl_sso_rol` — los roles son por app

```sql
CREATE TABLE tbl_sso_rol (
  app_clave    VARCHAR(30) NOT NULL,
  rol_clave    VARCHAR(30) NOT NULL,
  etiqueta     VARCHAR(60) NOT NULL,
  acceso_total TINYINT(1)  NOT NULL DEFAULT 0 COMMENT '1 = ve todo, salta la matriz',
  orden        INT         NOT NULL DEFAULT 0 COMMENT 'menor = más privilegio',
  activo       TINYINT(1)  NOT NULL DEFAULT 1,
  PRIMARY KEY (app_clave, rol_clave),
  CONSTRAINT fk_rol_app FOREIGN KEY (app_clave)
    REFERENCES tbl_sso_app(app_clave) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

Ésta es la diferencia de fondo con hoy. `operador` en Costeo360 y `operador` en HBTrade360 son roles **distintos** y cada uno define sus propias pantallas.

### 2.4 `tbl_sso_recurso` — las pantallas, por app

```sql
CREATE TABLE tbl_sso_recurso (
  app_clave     VARCHAR(30) NOT NULL,
  recurso_clave VARCHAR(40) NOT NULL COMMENT 'debe coincidir con item.key del menú',
  etiqueta      VARCHAR(80) NOT NULL,
  seccion       VARCHAR(30) NOT NULL,
  ruta          VARCHAR(120) NULL,
  orden         INT NOT NULL DEFAULT 0,
  activo        TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (app_clave, recurso_clave),
  CONSTRAINT fk_recurso_app FOREIGN KEY (app_clave)
    REFERENCES tbl_sso_app(app_clave) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

`recurso_clave` tiene que coincidir con la `key` del menú de cada app. En Costeo360 ya es así: `getNavFromPermisos()` en `lib/menu-config.ts:213` filtra por esa llave.

### 2.5 `tbl_sso_permiso` — la matriz

```sql
CREATE TABLE tbl_sso_permiso (
  app_clave     VARCHAR(30) NOT NULL,
  rol_clave     VARCHAR(30) NOT NULL,
  recurso_clave VARCHAR(40) NOT NULL,
  nivel         ENUM('ninguno','ver','completo') NOT NULL DEFAULT 'ninguno',
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  actualizado_por VARCHAR(150) NULL,
  PRIMARY KEY (app_clave, rol_clave, recurso_clave),
  CONSTRAINT fk_perm_rol FOREIGN KEY (app_clave, rol_clave)
    REFERENCES tbl_sso_rol(app_clave, rol_clave) ON DELETE CASCADE,
  CONSTRAINT fk_perm_recurso FOREIGN KEY (app_clave, recurso_clave)
    REFERENCES tbl_sso_recurso(app_clave, recurso_clave) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

Los tres niveles se conservan tal cual de Costeo360, para que la migración sea copiar y pegar.

### 2.6 `tbl_sso_asignacion` — la pieza nueva

```sql
CREATE TABLE tbl_sso_asignacion (
  email        VARCHAR(150) NOT NULL,
  app_clave    VARCHAR(30)  NOT NULL,
  rol_clave    VARCHAR(30)  NOT NULL,
  vig_ini      DATE         NOT NULL DEFAULT (CURRENT_DATE),
  vig_fin      DATE         NULL COMMENT 'NULL = sin vencimiento',
  asignado_por VARCHAR(150) NOT NULL,
  nota         VARCHAR(200) NULL,
  creado_en    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email, app_clave),
  CONSTRAINT fk_asig_persona FOREIGN KEY (email)
    REFERENCES tbl_sso_persona(email) ON DELETE CASCADE,
  CONSTRAINT fk_asig_rol FOREIGN KEY (app_clave, rol_clave)
    REFERENCES tbl_sso_rol(app_clave, rol_clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

Aquí es donde se resuelve lo de Rodrigo. Hoy es `Manager` en Azure, igual que Alberto Gómez, y los dos terminan como `supervisor_ventas`. Con esta tabla:

```sql
INSERT INTO tbl_sso_asignacion (email, app_clave, rol_clave, asignado_por) VALUES
  ('rodrigo@hidrobart.com',       'costeo360', 'gerente_ventas',    'philippe@hidrobart.com'),
  ('alberto.gomez@hidrobart.com', 'costeo360', 'supervisor_ventas', 'philippe@hidrobart.com');
```

Mismo grupo de Azure, roles distintos. Sin tocar Azure AD ni pedirle nada a sistemas.

---

## 3. Cómo resuelve HidroSSO

### 3.1 El orden de resolución

```
¿Tiene asignación vigente para esta app?
        │
        ├─ SÍ  → ese rol. Fin.
        │
        └─ NO  → ¿la app es requiere_asig = 1?
                   ├─ SÍ  → 403, no entra
                   └─ NO  → rol_defecto de la app,
                            o el mapeo del grupo de Azure
```

La asignación siempre gana. El grupo de Azure es la red de seguridad, no la fuente de verdad.

**Excepción que se conserva:** `acceso_total = 1` (SuperAdmin) salta la matriz de permisos. Ya funciona así en Costeo360 y no hay razón para cambiarlo.

### 3.2 Endpoints nuevos en HidroSSO

```
GET  /auth/session-info?sid=...&app=costeo360
     → agrega  rol_app  y  permisos: { recurso: nivel }

GET  /sso/menu?sid=...&app=costeo360
     → las pantallas que esa persona puede ver, ya filtradas y ordenadas

GET  /adm/apps · /adm/roles · /adm/recursos · /adm/permisos · /adm/asignaciones
     → CRUD del panel de administración
```

`session-info` gana el parámetro `app`. Sin él, se comporta como hoy — así nada se rompe durante la migración.

### 3.3 La sesión en Redis

Se conserva la estructura de v1.0 y se llena `process`, que hoy va vacío:

```json
{
  "email": "rodrigo@hidrobart.com",
  "roles": {
    "org": ["Manager"],
    "process": {
      "costeo360":  { "rol": "gerente_ventas", "acceso_total": 0 },
      "dir360":     { "rol": "vendedor",       "acceso_total": 0 },
      "hbtrade360": null
    }
  }
}
```

`null` significa que esa persona no entra a esa app. Se resuelve una vez al iniciar sesión y se guarda con la sesión. Cambiar un permiso invalida el caché de esa persona (`redis_service.invalidate_user_roles`, que ya existe).

### 3.4 Quién pregunta: persona o aplicación

Hoy `session-info` y `sso-launch` no verifican quién llama. Se agrega:

```sql
-- se agrega a tbl_sso_app
api_key_hash  VARCHAR(120) NULL COMMENT 'bcrypt de la llave de la app'
```

Cada app manda su llave en un encabezado. Sin llave válida, HidroSSO no contesta. Con eso HidroSSO sabe **quién pregunta** (la app) y **por quién pregunta** (el `sid`), que es justo lo que pediste.

---

## 4. Cómo lo consume cada app

El menú lo pinta la app con lo que le contesta HidroSSO:

```ts
const { rol_app, permisos } = await fetch(`/api/me?app=costeo360`).then(r => r.json())
const nav = navConfig
  .map(g => ({ ...g, items: g.items.filter(i => permisos[i.key] !== 'ninguno') }))
  .filter(g => g.items.length > 0)
```

Costeo360 ya hace exactamente esto en `lib/menu-config.ts:213`. Solo cambia de dónde vienen los permisos.

**Consecuencia:** `tbl_cat_rol`, `tbl_cat_recurso`, `tbl_role_permission` y el SP `sp_resolver_rol` **salen de `hidrobart_costeo`**. Costeo360 deja de tener catálogo propio y pregunta, como las demás.

---

## 5. Control en las FastAPI — decisión y su consecuencia

**Decisión de Philippe (24 ago 2026):** no se ponen validaciones de rol en los endpoints de FastAPI, porque las APIs se van a usar desde agentes de IA.

Queda registrado, y el diseño la respeta. Pero hay que dejar escrito qué implica, porque no es obvio:

**Esconder una opción del menú no es un control de acceso.** Si la API no valida, quien conozca la dirección entra, aunque no vea el botón.

El caso concreto está en el propio Costeo360. Existen tres vistas por rol —`vw_precio_lista_vendedor`, `vw_precio_lista_coordinador`, `vw_precio_lista_admin`— hechas precisamente para que un vendedor **no** vea el precio piso ni el costo. Sin validación en la API, un vendedor con sesión válida llama `GET /api/precios/lista-piso` y lo ve. El menú no se lo ofrece; la API se lo da.

### La solución que satisface las dos cosas

**El agente de IA no necesita que la API esté abierta. Necesita identidad propia.**

Se registra como una app más:

```sql
INSERT INTO tbl_sso_app (app_clave, nombre, url_base, url_sso, rol_defecto, requiere_asig)
VALUES ('agente_ia', 'Agente IA', '-', '-', 'agente', 0);

INSERT INTO tbl_sso_rol (app_clave, rol_clave, etiqueta, acceso_total, orden)
VALUES ('costeo360', 'agente', 'Agente IA', 0, 50);
```

El agente manda su propio token con su propio rol. FastAPI sigue validando. El agente entra a lo que le toca y nada más — y si mañana se sale de control, se apaga en una fila de la base sin tocar código.

**Sale más barato hacerlo así ahora que abrir todo y cerrarlo después**, porque cerrar después implica revisar 206 endpoints uno por uno.

Si aun así se decide dejar las APIs sin validación, la mitigación mínima es **que dejen de estar expuestas a internet**: hoy `nginx-costeo360.conf:24-25` publica `location /api/` completo. Debería contestar solo a Next.js desde localhost.

---

## 6. Migración — Costeo360 primero

| # | Paso | Riesgo | Cómo se verifica |
|---|---|---|---|
| 1 | Crear `hidrobart_sso` con las 6 tablas | Ninguno | Las tablas existen |
| 2 | Sembrar apps y personas desde Azure | Ninguno | 9 apps, N personas |
| 3 | Copiar los 6 roles y 14 recursos de Costeo360 con `app_clave='costeo360'` | Ninguno | Cuadran los conteos contra `tbl_cat_rol` |
| 4 | Copiar la matriz de permisos | Ninguno | Mismo número de filas |
| 5 | Agregar `gerente_ventas` como rol propio y asignarlo a Rodrigo | Bajo | Rodrigo ve lo suyo |
| 6 | HidroSSO expone `/sso/menu` y `session-info?app=` | Ninguno, es aditivo | Devuelve lo mismo que Costeo360 hoy |
| 7 | Costeo360 apunta a HidroSSO en vez de a su SP | **Medio** | Comparar menú antes/después, persona por persona |
| 8 | Marcar las tablas viejas de Costeo360 como obsoletas (no borrar) | Ninguno | Un mes de convivencia |
| 9 | Repetir 3-7 para Dir360 y HBTrade360 | Medio | Igual |
| 10 | Borrar las tablas viejas | Bajo | Ya nadie las consulta |

**Regla del paso 7:** antes de cambiar, sacar el menú que ve cada persona con el sistema viejo. Después de cambiar, sacarlo otra vez. Tienen que ser idénticos, salvo lo de Rodrigo, que cambia a propósito.

---

## 7. Lo que falta decidir

1. **¿La capa FunctionalRole sobrevive?** En v1.0 es una de las tres capas, pero `services/roles.py:118` nunca se implementó y devuelve vacío. Con la asignación por app, puede que ya no haga falta. **Recomendación: retirarla del diseño.** Dos capas que funcionan valen más que tres donde una está muerta.

2. **`gerente_ventas`: ¿qué ve que un supervisor no vea?** El rol se crea, pero su matriz de permisos hay que definirla. Sin eso, es un nombre distinto para lo mismo.

3. **Los tipos de vendedor** (mostrador, campo, KAM…). Si cambian lo que se ve en la app, son roles y van en `tbl_sso_rol`. Si solo dirigen metas y territorio, son un atributo y van en `hidrobart_master.tbl_vend_map`. **Pendiente de definir cuáles son.**

4. **¿Dónde vive `hidrobart_sso`?** El servidor MySQL de Hidrobart en Azure es lo natural, pero es un dato de plataforma en un servidor de una empresa. Decisión de Philippe.

5. **Revocación.** Hoy `costeo360-api/core/deps.py` solo verifica la firma del JWT, no consulta Redis: cerrar la sesión de alguien en HidroSSO no le quita el acceso a la API por hasta 8 horas. Con sesiones de 8 h es aceptable en operación normal. **Deja de serlo el día que alguien sale de la empresa.**

---

## 8. Lo que este diseño NO cambia

- El protocolo SSO (`ms-login` → `sso-launch` → `sso-exchange` → `session-info`) se conserva completo. Está bien hecho.
- La sesión sigue durando 8 horas.
- Azure AD sigue siendo quien dice quién es la persona.
- Los grupos `HB-*` siguen existiendo como red de seguridad.
- La cookie `hidrosso_sid` no cambia.

Lo único que cambia es **dónde vive la respuesta a "con qué rol entra esta persona a esta app"**: hoy la inventa cada app, mañana la contesta HidroSSO.
