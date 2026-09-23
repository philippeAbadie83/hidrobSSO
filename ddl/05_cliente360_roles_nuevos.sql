/* ============================================================================
   HidroSSO v2 — Cliente360 se pone al dia con los roles nuevos
   Escrito: 2026-09-07

   POR QUE
     El 04 le dio a Costeo360 los roles 'observador' y la escala de prioridad
     sin empates. Cliente360 se quedo atras y tiene los mismos dos problemas:

     1. EMPATE: GerenteVentas y Coordinador estan los dos en orden 3. Rogelio
        Gomez y Rodrigo Acosta pertenecen a los dos grupos, asi que cual gana
        depende del orden que devuelva la base. Impredecible.

     2. ROLES QUE NO EXISTEN AQUI: cuando Guillermo y Hector salgan de
        HBS-Admin llegaran con la etiqueta 'Observador', y Mayra con
        'ServicioCliente'. Cliente360 no conoce ninguna de las dos, asi que
        caerian en rol_defecto='vendedor'. Guillermo y Hector pasarian de
        administrador a vendedor.

   QUE HACE
     Le da a cliente360 los dos roles que le faltan y la misma escala que ya
     tiene costeo360, para que las dos apps resuelvan igual.

   QUE VE CADA ROL NUEVO EN CLIENTE360
     observador       -> las 12 pantallas, todas en 'ver' (mismo criterio
                         que en Costeo360: ve todo, no modifica nada)
     servicio_cliente -> copia exacta de lo que ve vendedor hoy, para que
                         Mayra no cambie de menu al cambiar de rol

   RIESGO
     Ninguno hoy. Los roles nuevos no los puede activar nadie hasta que las
     personas salgan de HBS-Admin en Azure, y la escala no mueve a nadie
     (verificado: las 21 personas resuelven al mismo rol que hoy).

   REVERTIR
     DELETE FROM hidrobart_sso.tbl_sso_rol
       WHERE app_clave='cliente360' AND rol_clave IN ('observador','servicio_cliente');
     (el CASCADE se lleva permisos y grupos)
   ============================================================================ */
USE hidrobart_sso;

/* ── 1. Los dos roles que faltan ──────────────────────────────────────────── */
INSERT INTO tbl_sso_rol (app_clave, rol_clave, etiqueta, acceso_total, orden) VALUES
  ('cliente360', 'observador',       'Observador',       0, 3),
  ('cliente360', 'servicio_cliente', 'Servicio Cliente', 0, 7)
ON DUPLICATE KEY UPDATE etiqueta = VALUES(etiqueta), orden = VALUES(orden);

/* ── 2. La escala sin empates, la misma que costeo360 ─────────────────────── */
UPDATE tbl_sso_rol SET orden = CASE rol_clave
    WHEN 'admin'             THEN 1
    WHEN 'gerente_ventas'    THEN 2
    WHEN 'observador'        THEN 3
    WHEN 'supervisor_ventas' THEN 4
    WHEN 'operador'          THEN 5
    WHEN 'servicio_cliente'  THEN 7
    WHEN 'vendedor'          THEN 8
    WHEN 'externo'           THEN 9
    ELSE orden
  END
WHERE app_clave = 'cliente360';

UPDATE tbl_sso_grupo_rol SET orden = CASE grupo_azure
    WHEN 'SuperAdmin'      THEN 0
    WHEN 'Admin'           THEN 1
    WHEN 'GerenteVentas'   THEN 2
    WHEN 'Observador'      THEN 3
    WHEN 'Coordinador'     THEN 4
    WHEN 'Manager'         THEN 4
    WHEN 'Operador'        THEN 5
    WHEN 'ServicioCliente' THEN 7
    WHEN 'Vendedor'        THEN 8
    WHEN 'Employee'        THEN 8
    WHEN 'External'        THEN 9
    ELSE orden
  END
WHERE app_clave = 'cliente360';

/* ── 3. Menu del observador: las 12 pantallas en 'ver' ────────────────────── */
INSERT INTO tbl_sso_permiso (app_clave, rol_clave, recurso_clave, nivel, actualizado_por)
SELECT 'cliente360', 'observador', recurso_clave, 'ver', 'cliente360-roles-20260907'
FROM tbl_sso_recurso
WHERE app_clave = 'cliente360'
ON DUPLICATE KEY UPDATE nivel = VALUES(nivel);

/* ── 4. Menu de servicio_cliente: copia de vendedor ───────────────────────── */
/* Primero todo en 'ninguno' (deny por defecto), luego se copia vendedor.
   Asi ninguna pantalla queda abierta por olvido.                             */
INSERT INTO tbl_sso_permiso (app_clave, rol_clave, recurso_clave, nivel, actualizado_por)
SELECT 'cliente360', 'servicio_cliente', recurso_clave, 'ninguno', 'cliente360-roles-20260907'
FROM tbl_sso_recurso
WHERE app_clave = 'cliente360'
ON DUPLICATE KEY UPDATE nivel = nivel;

INSERT INTO tbl_sso_permiso (app_clave, rol_clave, recurso_clave, nivel, actualizado_por)
SELECT 'cliente360', 'servicio_cliente', p.recurso_clave, p.nivel, 'cliente360-roles-20260907'
FROM tbl_sso_permiso p
WHERE p.app_clave = 'cliente360' AND p.rol_clave = 'vendedor'
ON DUPLICATE KEY UPDATE nivel = VALUES(nivel);

/* ── 5. Los grupos de Azure que los disparan ──────────────────────────────── */
INSERT INTO tbl_sso_grupo_rol (app_clave, grupo_azure, rol_clave, orden) VALUES
  ('cliente360', 'Observador',      'observador',       3),
  ('cliente360', 'ServicioCliente', 'servicio_cliente', 7)
ON DUPLICATE KEY UPDATE rol_clave = VALUES(rol_clave), orden = VALUES(orden);
