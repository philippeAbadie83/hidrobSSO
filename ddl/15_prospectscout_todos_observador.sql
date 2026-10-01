/* ============================================================================
   HidroSSO v2 — ProspectScout: los grupos entran como Observador
   Decidido por Philippe el 2026-10-01. Escrito el 2026-10-01.
   ESTADO: BORRADOR para revisión. No correr hasta el visto bueno.

   QUE RESUELVE
     Hoy ProspectScout exige asignación (requiere_asig=1) y solo hay dos:
       philippe.abadie@hidrobart.com -> admin       (el único que ejecuta)
       rgomez@hidrobart.com          -> observador
     Philippe quiere que el resto entre a consultar, sin ejecutar.

     Se abre por GRUPO (no por rol por defecto), para que entren los mismos
     grupos que ven el mosaico y no cualquiera que tenga la URL:
       SuperAdmin, Admin, GerenteVentas, Observador, Compras,
       Coordinador, Vendedor, ServicioCliente  -> observador
     Las asignaciones siempre ganan: Philippe sigue como admin.

   OJO
     Vendedor y Coordinador ven TODOS los clientes: el filtro "solo sus
     clientes" (nivel 'propio') todavía no existe en ProspectScout. Aceptado
     por Philippe el 2026-10-01 como paso intermedio.
     ProspectScout recuerda la sesión 30 s; el cambio aplica en ese tiempo.

   REVERTIR
     DELETE FROM tbl_sso_grupo_rol WHERE app_clave='prospectscout';
     UPDATE tbl_sso_app SET requiere_asig=1, rol_defecto='observador'
       WHERE app_clave='prospectscout';
   ============================================================================ */
USE hidrobart_sso;

/* 0. Cómo está hoy */
SELECT app_clave, rol_defecto, requiere_asig FROM tbl_sso_app WHERE app_clave='prospectscout';
SELECT email, rol_clave FROM tbl_sso_asignacion WHERE app_clave='prospectscout';

/* 1. Los grupos que entran, todos como observador */
INSERT INTO tbl_sso_grupo_rol (app_clave, grupo_azure, rol_clave, orden) VALUES
  ('prospectscout', 'SuperAdmin',      'observador', 0),
  ('prospectscout', 'Admin',           'observador', 1),
  ('prospectscout', 'GerenteVentas',   'observador', 2),
  ('prospectscout', 'Observador',      'observador', 3),
  ('prospectscout', 'Coordinador',     'observador', 4),
  ('prospectscout', 'Compras',         'observador', 6),
  ('prospectscout', 'ServicioCliente', 'observador', 7),
  ('prospectscout', 'Vendedor',        'observador', 8)
ON DUPLICATE KEY UPDATE rol_clave = VALUES(rol_clave), orden = VALUES(orden);

/* 2. Se abre por grupo. Sin rol por defecto: quien no está en esos grupos
      ni tiene asignación, no entra. */
UPDATE tbl_sso_app SET requiere_asig = 0, rol_defecto = NULL
WHERE app_clave = 'prospectscout';

/* 3. Verificación */
SELECT app_clave, rol_defecto, requiere_asig FROM tbl_sso_app WHERE app_clave='prospectscout';
SELECT grupo_azure, rol_clave FROM tbl_sso_grupo_rol WHERE app_clave='prospectscout' ORDER BY orden;
SELECT email, rol_clave FROM tbl_sso_asignacion WHERE app_clave='prospectscout';
