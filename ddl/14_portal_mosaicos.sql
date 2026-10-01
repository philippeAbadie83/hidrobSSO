/* ============================================================================
   HidroSSO v2 — Mosaicos del portal en tablas (fase 1, EN PARALELO)
   Decidido por Philippe el 2026-10-01. Escrito el 2026-10-01.
   ESTADO: BORRADOR para revisión. No correr hasta el visto bueno.

   QUE RESUELVE
     Hoy el portal decide qué mosaicos dibuja con frontend/data/apps.json y
     una lista de roles escrita en el código. Se pasa a dos tablas:
       tbl_sso_mosaico         cómo se ve cada mosaico
       tbl_sso_mosaico_acceso  quién lo ve: por grupo de Azure o por persona

     Quién VE el mosaico es independiente de quién ENTRA a la app (eso sigue
     en tbl_sso_grupo_rol / tbl_sso_asignacion). Ejemplo: cualquiera entra a
     Costeo360, pero Ventas no ve su mosaico.

   EN PARALELO
     Nadie lee esto todavía; el portal actual (/dashboard + apps.json) sigue
     igual. Ninguna tabla existente gana ni cambia columnas. Lo único que se
     agrega fuera de las tablas nuevas son 7 FILAS en tbl_sso_app (el
     catálogo), sin roles ni grupos: nadie "entra" por ellas.

   RIESGO
     Bajo. El lanzador SSO usa su propia lista en sso_router.py. Lo único
     visible: GET /sso/apps (catálogo) listará 10 apps en vez de 3.

   REVERTIR (en este orden)
     DROP TABLE tbl_sso_mosaico_acceso;
     DROP TABLE tbl_sso_mosaico;
     DELETE FROM tbl_sso_app WHERE app_clave IN
       ('crm2','hbtrade360','superset','unidum','cortex','docprocesos','docs');
   ============================================================================ */
USE hidrobart_sso;

/* 0. Cómo está hoy (solo lectura) */
SELECT app_clave, nombre, rol_defecto, requiere_asig FROM tbl_sso_app ORDER BY app_clave;


/* ── 1. Las 7 apps que faltan en el catálogo ──────────────────────────────
   requiere_asig=1 y sin rol por defecto: nadie entra por estas filas; solo
   existen para que el mosaico tenga su app. url_sso vacío = no entra con
   token, solo se abre la URL. INSERT IGNORE: si alguna existiera, no se toca. */
INSERT IGNORE INTO tbl_sso_app (app_clave, nombre, url_base, url_sso, rol_defecto, requiere_asig) VALUES
  ('crm2',        'CRM Hidrobart',               'https://crm2.hidrobart.com',         'https://crm2.hidrobart.com/auth/sso',       NULL, 1),
  ('hbtrade360',  'HBTrade360',                  'https://hbtrade360.hidrobart.com',   'https://hbtrade360.hidrobart.com/auth/sso', NULL, 1),
  ('superset',    'Dashboard Institucional',     'https://dashb.hidrobart.com',        '',                                          NULL, 1),
  ('unidum',      'Planificador',                'https://unidum.hidrobart.com',       '',                                          NULL, 1),
  ('cortex',      'Cortex',                      'https://cortex.hidrobart.com',       '',                                          NULL, 1),
  ('docprocesos', 'SCOR · Cadena de Suministro', 'https://docprocesos.hidrobart.com',  '',                                          NULL, 1),
  ('docs',        'Documentación',               'https://hidrosso.hidrobart.com/doc', '',                                          NULL, 1);


/* ── 2. Cómo se ve cada mosaico ───────────────────────────────────────────
   nombre y URL se leen de tbl_sso_app (no se repiten aquí).
   insignia solo para lo que no se deduce (NUEVO, PROTOTIPO). "ACTUALIZADO"
   lo calcula el portal con version_fecha.
   version = mayor.menor, sin build (ej. 1.7).                             */
CREATE TABLE IF NOT EXISTS tbl_sso_mosaico (
  app_clave       VARCHAR(30)  NOT NULL,
  subtitulo       VARCHAR(80)  NULL,
  descripcion     VARCHAR(200) NULL,
  icono           VARCHAR(40)  NULL,
  insignia        VARCHAR(20)  NULL COMMENT 'NUEVO / PROTOTIPO. ACTUALIZADO se calcula',
  lanza           ENUM('sso','enlace') NOT NULL DEFAULT 'enlace'
                  COMMENT 'sso = entra con launch token; enlace = abre url_base',
  orden           INT          NOT NULL DEFAULT 0,
  visible         TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '0 = apagado sin borrarlo',
  version         VARCHAR(20)  NULL COMMENT 'mayor.menor, sin build',
  version_fecha   DATE         NULL,
  creado_en       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  actualizado_por VARCHAR(150) NULL,
  PRIMARY KEY (app_clave),
  CONSTRAINT fk_mosaico_app FOREIGN KEY (app_clave)
    REFERENCES tbl_sso_app(app_clave) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* Los 10 mosaicos tal como se ven hoy (apps.json de producción, 2026-10-01).
   version / version_fecha vacíos hasta el siguiente despliegue de cada app. */
INSERT IGNORE INTO tbl_sso_mosaico (app_clave, subtitulo, descripcion, icono, insignia, lanza, orden, actualizado_por) VALUES
  ('hbtrade360', 'hbtrade360.hidrobart.com', 'Comercio exterior · Hidrobart', '🌎', 'NUEVO', 'sso', 1, 'ddl-14'),
  ('costeo360', 'costeo360.hidrobart.com', 'Costeo Hidrobart', '💰', NULL, 'sso', 2, 'ddl-14'),
  ('cliente360', 'cliente360.hidrobart.com', 'El cliente activo · historia, crédito, ventas e inteligencia comercial', '🧑‍💼', 'NUEVO', 'sso', 3, 'ddl-14'),
  ('crm2', 'crm2.hidrobart.com', 'Pipeline de ventas · CRM v2', '🤝', 'NUEVO', 'sso', 4, 'ddl-14'),
  ('docs', 'hidrosso.hidrobart.com/doc', 'hidroBIntel Docs · guías de correo, MFA, estándares y procesos', '📚', 'NUEVO', 'enlace', 5, 'ddl-14'),
  ('cortex', 'cortex.hidrobart.com', 'Cerebro de IA · Hidrobart', '🤖', NULL, 'enlace', 6, 'ddl-14'),
  ('superset', 'dashb.hidrobart.com', 'Business Intelligence · Superset', '📊', NULL, 'enlace', 7, 'ddl-14'),
  ('unidum', 'unidum.hidrobart.com', 'Planificador Hidrobart', '📅', 'PROTOTIPO', 'enlace', 8, 'ddl-14'),
  ('docprocesos', 'docprocesos.hidrobart.com', 'Mapa de procesos AS-IS · Cadena de Suministro (SCOR, minutas, RACI, riesgos, roles)', '🗺️', 'NUEVO', 'enlace', 9, 'ddl-14'),
  ('prospectscout', 'prospectscout.hidrobart.com', 'Depuracion de cartera y prospeccion', '🔎', 'NUEVO', 'sso', 10, 'ddl-14');


/* ── 3. Quién ve cada mosaico ─────────────────────────────────────────────
   tipo='grupo'   -> valor = rol de Azure tal como lo produce HidroSSO
                     (SuperAdmin, Admin, GerenteVentas, Observador, ...)
   tipo='persona' -> valor = correo con el que entra al portal
   Se ve el mosaico si CUALQUIERA de sus filas coincide con la persona.
   No exige que la persona exista en tbl_sso_persona: aplica en cuanto entre. */
CREATE TABLE IF NOT EXISTS tbl_sso_mosaico_acceso (
  app_clave    VARCHAR(30)  NOT NULL,
  tipo         ENUM('grupo','persona') NOT NULL,
  valor        VARCHAR(150) NOT NULL COMMENT 'rol de Azure o correo',
  asignado_por VARCHAR(150) NULL,
  creado_en    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (app_clave, tipo, valor),
  KEY ix_acceso_valor (tipo, valor),
  CONSTRAINT fk_acceso_mosaico FOREIGN KEY (app_clave)
    REFERENCES tbl_sso_mosaico(app_clave) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* La matriz acordada con Philippe el 2026-10-01.
   CRM2 queda "como hoy": los 9 roles team del portal actual (Philippe lo revisa).
   Manager y CustomerSuccess solo aparecen ahí por eso; CustomerSuccess no lo
   reconoce HidroSSO y es candidato a borrarse. */
INSERT IGNORE INTO tbl_sso_mosaico_acceso (app_clave, tipo, valor) VALUES
  ('costeo360', 'grupo', 'SuperAdmin'),
  ('cliente360', 'grupo', 'SuperAdmin'),
  ('cortex', 'grupo', 'SuperAdmin'),
  ('docprocesos', 'grupo', 'SuperAdmin'),
  ('superset', 'grupo', 'SuperAdmin'),
  ('hbtrade360', 'grupo', 'SuperAdmin'),
  ('unidum', 'grupo', 'SuperAdmin'),
  ('prospectscout', 'grupo', 'SuperAdmin'),
  ('docs', 'grupo', 'SuperAdmin'),
  ('crm2', 'grupo', 'SuperAdmin'),
  ('costeo360', 'grupo', 'Admin'),
  ('cliente360', 'grupo', 'Admin'),
  ('cortex', 'grupo', 'Admin'),
  ('docprocesos', 'grupo', 'Admin'),
  ('superset', 'grupo', 'Admin'),
  ('hbtrade360', 'grupo', 'Admin'),
  ('unidum', 'grupo', 'Admin'),
  ('prospectscout', 'grupo', 'Admin'),
  ('crm2', 'grupo', 'Admin'),
  ('costeo360', 'grupo', 'GerenteVentas'),
  ('cliente360', 'grupo', 'GerenteVentas'),
  ('cortex', 'grupo', 'GerenteVentas'),
  ('docprocesos', 'grupo', 'GerenteVentas'),
  ('superset', 'grupo', 'GerenteVentas'),
  ('prospectscout', 'grupo', 'GerenteVentas'),
  ('costeo360', 'grupo', 'Observador'),
  ('cliente360', 'grupo', 'Observador'),
  ('cortex', 'grupo', 'Observador'),
  ('docprocesos', 'grupo', 'Observador'),
  ('superset', 'grupo', 'Observador'),
  ('hbtrade360', 'grupo', 'Observador'),
  ('unidum', 'grupo', 'Observador'),
  ('prospectscout', 'grupo', 'Observador'),
  ('crm2', 'grupo', 'Observador'),
  ('costeo360', 'grupo', 'Compras'),
  ('cliente360', 'grupo', 'Compras'),
  ('cortex', 'grupo', 'Compras'),
  ('docprocesos', 'grupo', 'Compras'),
  ('superset', 'grupo', 'Compras'),
  ('hbtrade360', 'grupo', 'Compras'),
  ('unidum', 'grupo', 'Compras'),
  ('prospectscout', 'grupo', 'Compras'),
  ('crm2', 'grupo', 'Compras'),
  ('costeo360', 'grupo', 'Coordinador'),
  ('cliente360', 'grupo', 'Coordinador'),
  ('docprocesos', 'grupo', 'Coordinador'),
  ('prospectscout', 'grupo', 'Coordinador'),
  ('crm2', 'grupo', 'Coordinador'),
  ('cliente360', 'grupo', 'Vendedor'),
  ('docprocesos', 'grupo', 'Vendedor'),
  ('prospectscout', 'grupo', 'Vendedor'),
  ('crm2', 'grupo', 'Vendedor'),
  ('cliente360', 'grupo', 'ServicioCliente'),
  ('docprocesos', 'grupo', 'ServicioCliente'),
  ('prospectscout', 'grupo', 'ServicioCliente'),
  ('costeo360', 'grupo', 'Operador'),
  ('crm2', 'grupo', 'Operador'),
  ('crm2', 'grupo', 'Manager'),
  ('crm2', 'grupo', 'CustomerSuccess'),
  ('hbtrade360', 'persona', 'jrodriguez@hidrobart.com.mx');


/* ── 4. Verificación ──────────────────────────────────────────────────────── */
/* 4.1 La matriz como quedó: una fila por grupo/persona, una columna por mosaico */
SELECT x.tipo, x.valor,
  MAX(x.app_clave='costeo360')     AS costeo,
  MAX(x.app_clave='cliente360')    AS cliente,
  MAX(x.app_clave='cortex')        AS cortex,
  MAX(x.app_clave='docprocesos')   AS scor,
  MAX(x.app_clave='superset')      AS dashb,
  MAX(x.app_clave='hbtrade360')    AS hbtrade,
  MAX(x.app_clave='unidum')        AS planif,
  MAX(x.app_clave='prospectscout') AS prospect,
  MAX(x.app_clave='docs')          AS docs,
  MAX(x.app_clave='crm2')          AS crm2
FROM tbl_sso_mosaico_acceso x
GROUP BY x.tipo, x.valor
ORDER BY x.tipo, x.valor;

/* 4.2 Los 10 mosaicos: deben salir todos, con cuántos grupos/personas los ven */
SELECT m.orden, m.app_clave, a.nombre, m.lanza, m.insignia, m.visible,
       COUNT(x.valor) AS lo_ven
FROM tbl_sso_mosaico m
JOIN tbl_sso_app a ON a.app_clave = m.app_clave
LEFT JOIN tbl_sso_mosaico_acceso x ON x.app_clave = m.app_clave
GROUP BY m.orden, m.app_clave, a.nombre, m.lanza, m.insignia, m.visible
ORDER BY m.orden;
