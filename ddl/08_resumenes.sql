/* ============================================================================
   HidroSSO v2 — los resumenes de la bitacora
   Pedidos por Philippe el 2026-09-09: "primero tenemos que generar un resumen
   de accesos, si no para que hacer la bitacora, por personas y app consumida".

   Tiene razon: una bitacora sin resumenes es un archivero que nadie abre.

   POR QUE VISTAS Y NO TABLAS DE RESUMEN
     Una vista se calcula al momento: siempre esta al dia y no hay nada que
     mantener ni ningun proceso que se pueda quedar atorado. Con ~460 mil
     filas al ano (la proyeccion a 50 personas) siguen siendo instantaneas
     gracias a los indices de tbl_sso_bitacora.
     Las tablas de resumen se justifican a partir de decenas de millones de
     filas. Ese dia se materializan estas mismas consultas y ya.

   NO SE BORRA NADA. El DELETE mensual que habia propuesto queda descartado:
   primero se resume, y solo entonces se decide si algo sobra.

   RIESGO
     Ninguno. Son cuatro vistas nuevas; no tocan datos ni tablas.

   REVERTIR
     DROP VIEW vw_sso_res_persona, vw_sso_res_app,
               vw_sso_res_persona_app, vw_sso_res_mes;
   ============================================================================ */
USE hidrobart_sso;

/* ── 1. POR PERSONA ───────────────────────────────────────────────────────── */
/* Quien entra, cada cuando, y que tanto se mueve por el ecosistema.          */
CREATE OR REPLACE VIEW vw_sso_res_persona AS
SELECT p.email,
       p.nombre,
       p.puesto,
       p.grupos_azure,
       p.logins                                         AS logins_totales,
       p.primer_login,
       p.ultimo_login,
       p.ultima_ip,
       DATEDIFF(CURDATE(), DATE(p.ultimo_login))        AS dias_sin_entrar,
       COUNT(DISTINCT b.app_clave)                      AS apps_usadas,
       COUNT(DISTINCT CONCAT(b.app_clave,'|',b.recurso_clave)) AS pantallas_usadas,
       SUM(b.evento = 'launch')                         AS saltos_a_apps,
       SUM(b.evento = 'pantalla')                       AS pantallas_abiertas,
       SUM(b.evento = 'login_fallido')                  AS intentos_fallidos
FROM tbl_sso_persona p
LEFT JOIN tbl_sso_bitacora b ON b.email = p.email
GROUP BY p.email, p.nombre, p.puesto, p.grupos_azure, p.logins,
         p.primer_login, p.ultimo_login, p.ultima_ip;

/* ── 2. POR APP ───────────────────────────────────────────────────────────── */
/* Cuanta gente usa cada app de verdad. La columna que importa es
   'personas_distintas': una app con 2 usuarios reales no justifica lo que
   cuesta mantenerla.                                                         */
CREATE OR REPLACE VIEW vw_sso_res_app AS
SELECT a.app_clave,
       a.nombre,
       COUNT(DISTINCT b.email)                          AS personas_distintas,
       SUM(b.evento = 'launch')                         AS entradas,
       SUM(b.evento = 'pantalla')                       AS pantallas_abiertas,
       COUNT(DISTINCT b.recurso_clave)                  AS pantallas_distintas,
       (SELECT COUNT(*) FROM tbl_sso_recurso r
         WHERE r.app_clave = a.app_clave AND r.activo = 1) AS pantallas_que_tiene,
       MIN(b.creado_en)                                 AS primer_uso,
       MAX(b.creado_en)                                 AS ultimo_uso,
       DATEDIFF(CURDATE(), DATE(MAX(b.creado_en)))      AS dias_sin_uso
FROM tbl_sso_app a
LEFT JOIN tbl_sso_bitacora b ON b.app_clave = a.app_clave
WHERE a.activo = 1
GROUP BY a.app_clave, a.nombre;

/* ── 3. POR PERSONA x APP ─────────────────────────────────────────────────── */
/* El cruce que pediste: quien usa que. Y con el LEFT JOIN al reves aparece
   tambien el caso interesante — quien TIENE acceso pero nunca entra.        */
CREATE OR REPLACE VIEW vw_sso_res_persona_app AS
SELECT b.email,
       p.nombre,
       b.app_clave,
       MAX(b.rol_clave)                                 AS rol,
       SUM(b.evento = 'launch')                         AS entradas,
       SUM(b.evento = 'pantalla')                       AS pantallas_abiertas,
       COUNT(DISTINCT b.recurso_clave)                  AS pantallas_distintas,
       MIN(b.creado_en)                                 AS primera_vez,
       MAX(b.creado_en)                                 AS ultima_vez,
       DATEDIFF(CURDATE(), DATE(MAX(b.creado_en)))      AS dias_sin_entrar
FROM tbl_sso_bitacora b
LEFT JOIN tbl_sso_persona p ON p.email = b.email
WHERE b.app_clave IS NOT NULL
GROUP BY b.email, p.nombre, b.app_clave;

/* ── 4. POR MES ───────────────────────────────────────────────────────────── */
/* La tendencia. Sirve para ver si una app esta creciendo o muriendose, que
   es una pregunta que hoy solo se contesta de oido.                          */
CREATE OR REPLACE VIEW vw_sso_res_mes AS
SELECT DATE_FORMAT(b.creado_en, '%Y-%m')                AS mes,
       COALESCE(b.app_clave, '(sin app)')               AS app_clave,
       COUNT(DISTINCT b.email)                          AS personas,
       SUM(b.evento = 'login')                          AS logins,
       SUM(b.evento = 'launch')                         AS entradas,
       SUM(b.evento = 'pantalla')                       AS pantallas,
       SUM(b.evento = 'login_fallido')                  AS fallidos,
       COUNT(*)                                         AS eventos
FROM tbl_sso_bitacora b
GROUP BY mes, app_clave;
