/* ============================================================================
   HidroSSO v2 — bitacora de accesos y registro de personas
   Decidido por Philippe el 2026-09-09. Se guarda TODO el detalle con
   identidad real: es una herramienta interna y no sale de la empresa.

   QUE RESUELVE
     "saber quien hizo login, que fecha, y a donde entra"
     Y de pasada llena tbl_sso_persona, que lleva vacia desde que se creo
     la base y es la pieza que bloquea todo lo demas: sin personas
     registradas no se pueden crear asignaciones (la FK las exige) ni
     preguntar por correo sin una sesion abierta.

   POR QUE AQUI Y NO EN CLICKHOUSE
     El volumen no lo amerita: 21 personas x ~20 pantallas al dia son unas
     400 filas diarias, 150 mil al ano. MySQL ni se entera. ClickHouse
     existe para millones por hora. El dia que se quiera el mapa de calor
     DENTRO de cada pantalla —donde pican, no que abren— eso si va aparte.

   LA REGLA QUE HACE QUE ESTO SIRVA
     recurso_clave es LA MISMA llave que en tbl_sso_permiso. Por eso se
     puede cruzar permiso otorgado contra permiso usado:
       "de los que TIENEN acceso a Precio Piso, quienes la abren?"
     Si manana llega el mapa de calor, empata solo.

   RIESGO
     Ninguno. Tabla nueva que nadie lee, y columnas nuevas en una tabla
     vacia. Ademas el codigo escribe en segundo plano y con try/except:
     si MySQL se cae, el login sigue funcionando y solo se pierde el
     renglon de bitacora.

   REVERTIR
     DROP TABLE hidrobart_sso.tbl_sso_bitacora;
     ALTER TABLE hidrobart_sso.tbl_sso_persona
       DROP COLUMN grupos_azure, DROP COLUMN ultima_ip, DROP COLUMN logins;
   ============================================================================ */
USE hidrobart_sso;

/* ── 1. La bitacora ───────────────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS tbl_sso_bitacora (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  evento        ENUM('login','login_fallido','launch','pantalla',
                     'permiso','logout','error') NOT NULL,
  email         VARCHAR(150) NULL COMMENT 'NULL solo si el login fallo antes de saber quien era',
  app_clave     VARCHAR(30)  NULL COMMENT 'a que app: launch, pantalla',
  recurso_clave VARCHAR(40)  NULL COMMENT 'que pantalla. MISMA llave que tbl_sso_permiso',
  rol_clave     VARCHAR(30)  NULL COMMENT 'con que rol entro, al momento del evento',
  session_id    VARCHAR(64)  NULL COMMENT 'para reconstruir una sesion completa',
  detalle       VARCHAR(300) NULL COMMENT 'el porque de un fallo, o el permiso que cambio',
  ip            VARCHAR(45)  NULL COMMENT '45 = cabe una IPv6',
  navegador     VARCHAR(300) NULL COMMENT 'user-agent completo',
  creado_en     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  /* Los cuatro indices responden las cuatro preguntas que se van a hacer:
     que hizo esta persona, que paso en esta app, cuantos logins hubo,
     y que paso en tal rango de fechas.                                      */
  KEY ix_bit_persona (email, creado_en),
  KEY ix_bit_app     (app_clave, creado_en),
  KEY ix_bit_evento  (evento, creado_en),
  KEY ix_bit_fecha   (creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/* Sin llave foranea a tbl_sso_persona a proposito: una bitacora nunca debe
   poder rechazar un renglon. Si alguien entra con un correo que todavia no
   esta registrado, el evento se guarda igual.                              */

/* ── 2. Lo que le faltaba a tbl_sso_persona ───────────────────────────────── */
/* La tabla esta vacia, asi que esto no toca ningun dato.
   grupos_azure es la columna que desbloquea preguntar por correo SIN una
   sesion abierta: hoy los grupos de alguien solo existen dentro de su
   sesion de Redis, que muere a las 8 horas.                                */
/* Nota: MySQL 8 NO soporta ADD COLUMN IF NOT EXISTS —eso es de MariaDB—,
   asi que cada columna se agrega solo si falta, consultando el catalogo.
   Es mas verboso pero deja el script re-ejecutable sin tronar.            */

SET @t := 'tbl_sso_persona';

SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t
                  AND COLUMN_NAME = 'grupos_azure');
SET @sql := IF(@existe = 0,
  "ALTER TABLE tbl_sso_persona ADD COLUMN grupos_azure VARCHAR(400) NULL
     COMMENT 'etiquetas que produjo HidroSSO en el ultimo login, separadas por coma'",
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t
                  AND COLUMN_NAME = 'ultima_ip');
SET @sql := IF(@existe = 0,
  "ALTER TABLE tbl_sso_persona ADD COLUMN ultima_ip VARCHAR(45) NULL",
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t
                  AND COLUMN_NAME = 'logins');
SET @sql := IF(@existe = 0,
  "ALTER TABLE tbl_sso_persona ADD COLUMN logins INT NOT NULL DEFAULT 0
     COMMENT 'cuantas veces ha entrado en total'",
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

/* ── 3. Vista de cortesia: quien entro hoy ────────────────────────────────── */
CREATE OR REPLACE VIEW vw_sso_actividad_hoy AS
SELECT b.email,
       p.nombre,
       COUNT(*)                                          AS eventos,
       SUM(b.evento = 'login')                           AS logins,
       COUNT(DISTINCT NULLIF(b.app_clave, ''))           AS apps_distintas,
       COUNT(DISTINCT NULLIF(b.recurso_clave, ''))       AS pantallas_distintas,
       MIN(b.creado_en)                                  AS primera,
       MAX(b.creado_en)                                  AS ultima
FROM tbl_sso_bitacora b
LEFT JOIN tbl_sso_persona p ON p.email = b.email
WHERE b.creado_en >= CURDATE()
GROUP BY b.email, p.nombre
ORDER BY ultima DESC;

/* ── 4. Vista que justifica la llave compartida ───────────────────────────── */
/* Permiso otorgado contra permiso usado, por app y pantalla. Es la consulta
   que no se puede hacer hoy y que sirve para limpiar accesos con datos en
   vez de con intuicion.                                                     */
CREATE OR REPLACE VIEW vw_sso_permiso_vs_uso AS
SELECT c.app_clave,
       c.recurso_clave,
       c.etiqueta,
       COUNT(DISTINCT a.email)  AS personas_con_acceso,
       COUNT(DISTINCT b.email)  AS personas_que_la_abrieron,
       COUNT(b.id)              AS veces_abierta
FROM tbl_sso_recurso c
LEFT JOIN tbl_sso_permiso pm
       ON pm.app_clave = c.app_clave AND pm.recurso_clave = c.recurso_clave
      AND pm.nivel <> 'ninguno'
LEFT JOIN tbl_sso_asignacion a
       ON a.app_clave = pm.app_clave AND a.rol_clave = pm.rol_clave
LEFT JOIN tbl_sso_bitacora b
       ON b.app_clave = c.app_clave AND b.recurso_clave = c.recurso_clave
      AND b.evento = 'pantalla'
WHERE c.activo = 1
GROUP BY c.app_clave, c.recurso_clave, c.etiqueta;
