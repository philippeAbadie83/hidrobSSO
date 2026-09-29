/* ============================================================================
   HidroSSO v2 — ProspectScout: rol Observador y acceso de Rogelio Gomez
   Pedido por Philippe el 2026-09-29. Escrito el 2026-09-29.

   QUE RESUELVE
     Rogelio Gomez (rgomez@hidrobart.com) entra a ProspectScout a VER las
     operaciones (ejecuciones, empresas, evidencias, referidas), pero NO puede
     ejecutar: lanzar, reanudar, reinvestigar ni completar fichas.

     Se hace a nivel de menú/pantalla, como el resto del ecosistema:
     ProspectScout lee la matriz rol x pantalla de HidroSSO. Pantalla en
     'ninguno' no sale en el menú; en 'ver' se consulta pero los botones de
     ejecutar (Investigar, Reanudar, Completar, Investigar de nuevo) quedan
     apagados; en 'completo' se ejecuta.

   COMO CORRER
     Pegar en la consola mysql> de vm-hidrosuite. Es idempotente.
     Antes, correr el bloque 0 para ver cómo está hoy.

   REVERTIR
     DELETE FROM hidrobart_sso.tbl_sso_asignacion
       WHERE email='rgomez@hidrobart.com' AND app_clave='prospectscout';
     (el rol observador puede quedarse; no lo usa nadie más)
   ============================================================================ */
USE hidrobart_sso;

/* 0. Cómo está hoy (solo lectura) */
SELECT app_clave, rol_defecto, requiere_asig, activo FROM tbl_sso_app WHERE app_clave='prospectscout';
SELECT rol_clave, etiqueta, acceso_total, orden FROM tbl_sso_rol WHERE app_clave='prospectscout';
SELECT recurso_clave, etiqueta, en_menu FROM tbl_sso_recurso WHERE app_clave='prospectscout';
SELECT email, nombre, activo FROM tbl_sso_persona WHERE email='rgomez@hidrobart.com';
SELECT email, app_clave, rol_clave, vig_fin FROM tbl_sso_asignacion WHERE email='rgomez@hidrobart.com';

/* 1. El rol observador para ProspectScout (sin acceso total) */
INSERT INTO tbl_sso_rol (app_clave, rol_clave, etiqueta, acceso_total, orden)
VALUES ('prospectscout', 'observador', 'Observador', 0, 3)
ON DUPLICATE KEY UPDATE etiqueta=VALUES(etiqueta), acceso_total=0, activo=1;

/* 2. Las pantallas de ProspectScout. recurso_clave = 'pantalla' en menu.tsx.
      'empresa' no va en el menú (se abre desde una ejecución), pero se protege igual.
      Si ya existen, no se tocan. */
INSERT IGNORE INTO tbl_sso_recurso (app_clave, recurso_clave, etiqueta, seccion, ruta, en_menu, orden) VALUES
  ('prospectscout', 'seleccion',   'Seleccionar clientes', 'DEPURACIÓN',  '/seleccion',   1, 1),
  ('prospectscout', 'ejecuciones', 'Ejecuciones',          'DEPURACIÓN',  '/ejecuciones', 1, 2),
  ('prospectscout', 'empresa',     'Ficha de empresa',     'DEPURACIÓN',  '/empresa',     0, 3),
  ('prospectscout', 'referidas',   'Empresas referidas',   'PROSPECCIÓN', '/referidas',   1, 4),
  ('prospectscout', 'giros',       'Buscar por giro',      'PROSPECCIÓN', '/giros',       1, 5);

/* 2.1 Observador: todas en 'ver' -> ve el menú completo, botones de ejecutar apagados */
INSERT INTO tbl_sso_permiso (app_clave, rol_clave, recurso_clave, nivel, actualizado_por)
SELECT 'prospectscout', 'observador', recurso_clave, 'ver', 'observador-20260929'
FROM tbl_sso_recurso
WHERE app_clave = 'prospectscout'
ON DUPLICATE KEY UPDATE nivel = VALUES(nivel);

/* 2.2 admin y superadmin (si existen en la app): todas en 'completo'.
       Sin esto, en cuanto haya matriz, un admin sin acceso_total dejaría de
       poder ejecutar. Si ya tenían un nivel puesto, se respeta. */
INSERT IGNORE INTO tbl_sso_permiso (app_clave, rol_clave, recurso_clave, nivel, actualizado_por)
SELECT 'prospectscout', r.rol_clave, c.recurso_clave, 'completo', 'observador-20260929'
FROM tbl_sso_rol r
JOIN tbl_sso_recurso c ON c.app_clave = r.app_clave
WHERE r.app_clave = 'prospectscout' AND r.rol_clave IN ('admin', 'superadmin');

/* 2.3 Cualquier otro rol que ya exista en la app: todas en 'ver'.
       Hoy esos roles ven todo sin ejecutar; al aparecer las pantallas, sin
       fila quedarían en 'ninguno' con el menú vacío. Así siguen igual. */
INSERT IGNORE INTO tbl_sso_permiso (app_clave, rol_clave, recurso_clave, nivel, actualizado_por)
SELECT 'prospectscout', r.rol_clave, c.recurso_clave, 'ver', 'observador-20260929'
FROM tbl_sso_rol r
JOIN tbl_sso_recurso c ON c.app_clave = r.app_clave
WHERE r.app_clave = 'prospectscout' AND r.rol_clave NOT IN ('admin', 'superadmin', 'observador');

/* 2.4 La matriz como queda: rol x pantalla */
SELECT rol_clave, recurso_clave, nivel FROM tbl_sso_permiso
WHERE app_clave = 'prospectscout' ORDER BY rol_clave, recurso_clave;

/* 3. La persona (si ya existe, no se toca) */
INSERT IGNORE INTO tbl_sso_persona (email, nombre)
VALUES ('rgomez@hidrobart.com', 'Rogelio Gomez');

/* 4. La asignación explícita: siempre gana sobre su grupo de Azure */
INSERT INTO tbl_sso_asignacion (email, app_clave, rol_clave, asignado_por, nota)
VALUES ('rgomez@hidrobart.com', 'prospectscout', 'observador',
        'lphilippe.abadie822@gmail.com', 'Ver operaciones de ProspectScout, sin ejecutar')
ON DUPLICATE KEY UPDATE rol_clave=VALUES(rol_clave), vig_fin=NULL,
                        asignado_por=VALUES(asignado_por), nota=VALUES(nota);

/* 5. Verificación: debe salir observador, acceso_total 0 */
SELECT a.email, a.rol_clave, r.etiqueta, r.acceso_total, a.vig_ini, a.vig_fin
FROM tbl_sso_asignacion a
JOIN tbl_sso_rol r ON r.app_clave=a.app_clave AND r.rol_clave=a.rol_clave
WHERE a.email='rgomez@hidrobart.com' AND a.app_clave='prospectscout';
