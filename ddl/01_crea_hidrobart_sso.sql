/* ============================================================================
   HidroSSO v2 · Fase 1 — base de permisos del ecosistema
   Diseño aprobado por Philippe (2026-08-19) en ROLES_SCHEMA_v2.md
   Escrito y ejecutado: 2026-09-04

   FASE 1 = crear y sembrar. NADIE la consume todavía; el script es aditivo y
   no toca ningún objeto existente. Para revertir: DROP DATABASE hidrobart_sso;

   Dos cambios respecto al documento original (justificados abajo):
     1. nivel gana el valor 'propio'  → para "solo lo mío" (cotizaciones/cartera)
     2. tabla nueva tbl_sso_grupo_rol → la red de seguridad de Azure no tenía
        dónde vivir. Es el equivalente de hidrobart_costeo.tbl_cat_rol.org_rol,
        pero por app.
   ============================================================================ */

CREATE DATABASE IF NOT EXISTS hidrobart_sso
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE hidrobart_sso;

/* ── 1. Apps ──────────────────────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS tbl_sso_app (
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

/* ── 2. Personas (ancla: el correo) ───────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS tbl_sso_persona (
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

/* ── 3. Roles, POR APP ────────────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS tbl_sso_rol (
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

/* ── 4. Recursos = pantallas. recurso_clave DEBE ser la key del menú ──────── */
CREATE TABLE IF NOT EXISTS tbl_sso_recurso (
  app_clave     VARCHAR(30)  NOT NULL,
  recurso_clave VARCHAR(40)  NOT NULL COMMENT 'debe coincidir con item.key del menú',
  etiqueta      VARCHAR(80)  NOT NULL,
  seccion       VARCHAR(30)  NOT NULL,
  ruta          VARCHAR(120) NULL,
  en_menu       TINYINT(1)   NOT NULL DEFAULT 1
                COMMENT '0 = existe y se protege, pero no se dibuja en el sidebar',
  orden         INT          NOT NULL DEFAULT 0,
  activo        TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (app_clave, recurso_clave),
  CONSTRAINT fk_recurso_app FOREIGN KEY (app_clave)
    REFERENCES tbl_sso_app(app_clave) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ── 5. La matriz: rol × pantalla → nivel ─────────────────────────────────── */
/* CAMBIO 1 vs el documento: se agrega 'propio'.
   Sin él no se puede expresar "el vendedor entra al cotizador pero solo ve los
   suyos" — que es el hueco real que encontramos. Queda dentro del mismo modelo
   y editable desde tabla, en vez de un mecanismo aparte en código.            */
CREATE TABLE IF NOT EXISTS tbl_sso_permiso (
  app_clave       VARCHAR(30) NOT NULL,
  rol_clave       VARCHAR(30) NOT NULL,
  recurso_clave   VARCHAR(40) NOT NULL,
  nivel           ENUM('ninguno','ver','propio','completo') NOT NULL DEFAULT 'ninguno',
  actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  actualizado_por VARCHAR(150) NULL,
  PRIMARY KEY (app_clave, rol_clave, recurso_clave),
  CONSTRAINT fk_perm_rol FOREIGN KEY (app_clave, rol_clave)
    REFERENCES tbl_sso_rol(app_clave, rol_clave) ON DELETE CASCADE,
  CONSTRAINT fk_perm_recurso FOREIGN KEY (app_clave, recurso_clave)
    REFERENCES tbl_sso_recurso(app_clave, recurso_clave) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ── 6. Asignación explícita: persona × app → rol. Siempre gana ───────────── */
CREATE TABLE IF NOT EXISTS tbl_sso_asignacion (
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

/* ── 7. NUEVA: grupo de Azure → rol, por app ──────────────────────────────── */
/* CAMBIO 2 vs el documento: el diseño dice que el grupo de Azure es "la red de
   seguridad" cuando no hay asignación, pero no le dio dónde vivir. Esto es el
   equivalente de hidrobart_costeo.tbl_cat_rol.org_rol, ahora por app.
   Sin esta tabla nadie sin asignación explícita se puede resolver.            */
CREATE TABLE IF NOT EXISTS tbl_sso_grupo_rol (
  app_clave   VARCHAR(30) NOT NULL,
  grupo_azure VARCHAR(60) NOT NULL COMMENT 'nombre del grupo en Azure AD',
  rol_clave   VARCHAR(30) NOT NULL,
  orden       INT NOT NULL DEFAULT 0 COMMENT 'menor gana si la persona trae varios grupos',
  activo      TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (app_clave, grupo_azure),
  CONSTRAINT fk_grupo_rol FOREIGN KEY (app_clave, rol_clave)
    REFERENCES tbl_sso_rol(app_clave, rol_clave) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
