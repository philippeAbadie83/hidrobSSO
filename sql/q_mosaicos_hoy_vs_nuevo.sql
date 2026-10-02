/* ============================================================================
   Portal: qué mosaicos ve cada persona HOY y cuáles vería con las tablas nuevas
   Fase 2 del cambio a mosaicos en tablas. 2026-10-02. Solo lectura.

   HOY   = la regla del portal actual: frontend/data/apps.json + ROLES_TEAM de
           frontend/app/dashboard/page.tsx (copiada aquí tal cual, al 2026-10-02).
           '*' = mosaico público, lo ve todo el que entra.
   NUEVO = tbl_sso_mosaico_acceso (por grupo o por persona), solo mosaicos visibles.

   Los grupos de cada persona salen de tbl_sso_persona.grupos_azure, que se
   llena en cada login. Quien no ha entrado desde que existe esa columna sale
   sin grupos: su "hoy" son solo los públicos.

   Columnas: gana = lo verá y hoy no · pierde = lo ve hoy y ya no lo verá.
   ============================================================================ */
USE hidrobart_sso;

WITH hoy (app_clave, grupo) AS (
    SELECT 'costeo360', '*'
    UNION ALL SELECT 'cliente360', '*'
    UNION ALL SELECT 'cortex', '*'
    UNION ALL SELECT 'docprocesos', '*'
    UNION ALL SELECT 'crm2', 'SuperAdmin'
    UNION ALL SELECT 'crm2', 'Admin'
    UNION ALL SELECT 'crm2', 'Manager'
    UNION ALL SELECT 'crm2', 'Coordinador'
    UNION ALL SELECT 'crm2', 'Operador'
    UNION ALL SELECT 'crm2', 'Compras'
    UNION ALL SELECT 'crm2', 'Vendedor'
    UNION ALL SELECT 'crm2', 'CustomerSuccess'
    UNION ALL SELECT 'crm2', 'Observador'
    UNION ALL SELECT 'docs', 'SuperAdmin'
    UNION ALL SELECT 'hbtrade360', 'SuperAdmin'
    UNION ALL SELECT 'hbtrade360', 'Admin'
    UNION ALL SELECT 'hbtrade360', 'Operador'
    UNION ALL SELECT 'hbtrade360', 'Compras'
    UNION ALL SELECT 'unidum', 'SuperAdmin'
    UNION ALL SELECT 'unidum', 'Admin'
    UNION ALL SELECT 'superset', 'SuperAdmin'
    UNION ALL SELECT 'superset', 'Admin'
    UNION ALL SELECT 'superset', 'Manager'
    UNION ALL SELECT 'superset', 'Coordinador'
    UNION ALL SELECT 'superset', 'Operador'
    UNION ALL SELECT 'superset', 'Compras'
    UNION ALL SELECT 'superset', 'Vendedor'
    UNION ALL SELECT 'superset', 'CustomerSuccess'
    UNION ALL SELECT 'superset', 'Observador'
    UNION ALL SELECT 'superset', 'GerenteVentas'
    UNION ALL SELECT 'prospectscout', 'SuperAdmin'
    UNION ALL SELECT 'prospectscout', 'Admin'
    UNION ALL SELECT 'prospectscout', 'Manager'
    UNION ALL SELECT 'prospectscout', 'Coordinador'
    UNION ALL SELECT 'prospectscout', 'Operador'
    UNION ALL SELECT 'prospectscout', 'Compras'
    UNION ALL SELECT 'prospectscout', 'Vendedor'
    UNION ALL SELECT 'prospectscout', 'CustomerSuccess'
    UNION ALL SELECT 'prospectscout', 'Observador'
    UNION ALL SELECT 'prospectscout', 'GerenteVentas'
),
p AS (
    SELECT email, nombre, REPLACE(IFNULL(grupos_azure, ''), ' ', '') AS grupos, ultimo_login
    FROM tbl_sso_persona
    WHERE activo = 1
),
ve_hoy AS (
    SELECT DISTINCT p.email, h.app_clave
    FROM p JOIN hoy h ON h.grupo = '*' OR FIND_IN_SET(h.grupo, p.grupos)
),
ve_nuevo AS (
    SELECT DISTINCT p.email, x.app_clave
    FROM p
    JOIN tbl_sso_mosaico_acceso x
      ON (x.tipo = 'grupo'   AND FIND_IN_SET(x.valor, p.grupos))
      OR (x.tipo = 'persona' AND x.valor = p.email)
    JOIN tbl_sso_mosaico m ON m.app_clave = x.app_clave AND m.visible = 1
)
SELECT p.email, p.nombre, p.grupos, DATE(p.ultimo_login) AS ultimo_login,
       (SELECT GROUP_CONCAT(n.app_clave ORDER BY n.app_clave)
          FROM ve_nuevo n
         WHERE n.email = p.email
           AND NOT EXISTS (SELECT 1 FROM ve_hoy h WHERE h.email = n.email AND h.app_clave = n.app_clave)
       ) AS gana,
       (SELECT GROUP_CONCAT(h.app_clave ORDER BY h.app_clave)
          FROM ve_hoy h
         WHERE h.email = p.email
           AND NOT EXISTS (SELECT 1 FROM ve_nuevo n WHERE n.email = h.email AND n.app_clave = h.app_clave)
       ) AS pierde
FROM p
ORDER BY (SELECT COUNT(*) FROM ve_hoy h WHERE h.email = p.email) = 0, p.grupos, p.email;
