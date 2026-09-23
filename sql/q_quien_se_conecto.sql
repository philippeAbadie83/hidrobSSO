/* ============================================================================
   ¿Quién se conectó, y qué hizo?

   Para correrlo:
       ssh vm-hidrosuite
       mysql -t < ~/q_quien_se_conecto.sql
   o pegar directo en la consola de mysql que ya está abierta en la VM.

   OJO CON LA HORA
     MySQL guarda todo en UTC y la VM corre en CST (6 horas menos). Por eso
     cada consulta convierte con CONVERT_TZ antes de comparar o mostrar. Si
     se omite, "hoy" empieza a las 6 de la tarde de ayer y las horas salen
     corridas. Es el error fácil de cometer aquí.
   ============================================================================ */

USE hidrobart_sso;

/* ── 1. QUIÉN SE CONECTÓ HOY ──────────────────────────────────────────────── */
/* Una línea por persona: a qué hora llegó, hasta qué hora se le vio, cuántas
   pantallas abrió y desde qué IP.                                            */
SELECT b.email,
       TIME(CONVERT_TZ(MIN(b.creado_en),'UTC','America/Monterrey')) AS entro,
       TIME(CONVERT_TZ(MAX(b.creado_en),'UTC','America/Monterrey')) AS ultimo_movto,
       SUM(b.evento='login')    AS logins,
       SUM(b.evento='launch')   AS apps,
       SUM(b.evento='pantalla') AS pantallas,
       MAX(b.ip)                AS ip
  FROM tbl_sso_bitacora b
 WHERE DATE(CONVERT_TZ(b.creado_en,'UTC','America/Monterrey')) = CURDATE()
 GROUP BY b.email
 ORDER BY entro;


/* ── 2. LO MISMO, PERO DE OTRO DÍA ────────────────────────────────────────── */
/* Cambiar la fecha y listo.                                                   */
SELECT b.email,
       TIME(CONVERT_TZ(MIN(b.creado_en),'UTC','America/Monterrey')) AS entro,
       TIME(CONVERT_TZ(MAX(b.creado_en),'UTC','America/Monterrey')) AS ultimo_movto,
       SUM(b.evento='pantalla') AS pantallas,
       MAX(b.ip)                AS ip
  FROM tbl_sso_bitacora b
 WHERE DATE(CONVERT_TZ(b.creado_en,'UTC','America/Monterrey')) = '2026-09-14'
 GROUP BY b.email
 ORDER BY entro;


/* ── 3. EL DETALLE: PASO A PASO DE HOY ────────────────────────────────────── */
/* Cada movimiento en orden. Sirve para ver el recorrido de alguien: entró,
   saltó a tal app, abrió tal pantalla.                                       */
SELECT TIME(CONVERT_TZ(b.creado_en,'UTC','America/Monterrey')) AS hora,
       b.email, b.evento, b.app_clave, b.recurso_clave, b.ip
  FROM tbl_sso_bitacora b
 WHERE DATE(CONVERT_TZ(b.creado_en,'UTC','America/Monterrey')) = CURDATE()
 ORDER BY b.creado_en;


/* ── 4. UNA SOLA PERSONA, ÚLTIMOS 7 DÍAS ──────────────────────────────────── */
SELECT DATE(CONVERT_TZ(b.creado_en,'UTC','America/Monterrey')) AS dia,
       TIME(CONVERT_TZ(b.creado_en,'UTC','America/Monterrey')) AS hora,
       b.evento, b.app_clave, b.recurso_clave, b.ip
  FROM tbl_sso_bitacora b
 WHERE b.email = 'agomez@hidrobart.com.mx'
   AND b.creado_en >= NOW() - INTERVAL 7 DAY
 ORDER BY b.creado_en DESC;


/* ── 5. QUIÉN NO HA VUELTO A ENTRAR ───────────────────────────────────────── */
/* Útil después de cambiar permisos: quien no ha vuelto a entrar sigue con el
   rol viejo, porque su sesión ya estaba firmada.                             */
SELECT nombre, email,
       CONVERT_TZ(ultimo_login,'UTC','America/Monterrey') AS ultimo_login_cst,
       TIMESTAMPDIFF(HOUR, ultimo_login, NOW())           AS horas_sin_entrar,
       logins, grupos_azure
  FROM tbl_sso_persona
 ORDER BY ultimo_login;


/* ── 6. DE DÓNDE SE CONECTAN ──────────────────────────────────────────────── */
/* La IP de la oficina se repite en todos; una IP distinta es alguien fuera.  */
SELECT b.ip, COUNT(DISTINCT b.email) AS personas, COUNT(*) AS eventos,
       GROUP_CONCAT(DISTINCT b.email SEPARATOR ', ')      AS quienes,
       CONVERT_TZ(MAX(b.creado_en),'UTC','America/Monterrey') AS ultima_vez
  FROM tbl_sso_bitacora b
 WHERE b.creado_en >= NOW() - INTERVAL 30 DAY AND b.ip IS NOT NULL
 GROUP BY b.ip
 ORDER BY eventos DESC;


/* ── 7. PERMISO OTORGADO CONTRA PERMISO USADO ─────────────────────────────── */
/* La pregunta que justifica toda la bitácora: de los que TIENEN acceso a una
   pantalla, ¿cuántos la abren? Las de abajo de la lista son candidatas a
   quitarse del menú.                                                         */
SELECT * FROM vw_sso_permiso_vs_uso
 WHERE app_clave = 'costeo360'
 ORDER BY personas_que_la_abrieron ASC, recurso_clave;


/* ── LAS VISTAS DE RESUMEN QUE YA EXISTEN ─────────────────────────────────────
   No hace falta escribir la consulta; ya están hechas:

     vw_sso_actividad_hoy      lo que va del día
     vw_sso_res_persona        totales por persona
     vw_sso_res_app            totales por app
     vw_sso_res_persona_app    quién usa cuál app
     vw_sso_res_mes            por mes
     vw_sso_permiso_vs_uso     permiso otorgado contra usado

   Ejemplo:  SELECT * FROM vw_sso_res_persona ORDER BY ultimo_login DESC;
   ──────────────────────────────────────────────────────────────────────────── */
