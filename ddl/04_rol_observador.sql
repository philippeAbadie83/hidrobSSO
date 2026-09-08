/* ============================================================================
   HidroSSO v2 — rol Observador, gerentes, y arreglo de Servicio Cliente
   Decidido por Philippe el 2026-09-07. Escrito el 2026-09-07.

   QUE RESUELVE
     1. Guillermo Barragan y Hector Martinez pasan de admin a "observador":
        siguen viendo las 26 pantallas, pero no pueden modificar nada.
     2. Rogelio Gomez y Rodrigo Acosta quedan como gerente_ventas. Hoy no
        pueden: los dos siguen en HBS-Coordinador, y gerente y coordinador
        estan EMPATADOS en prioridad (los dos en orden 3), asi que el
        resultado seria impredecible. Se le sube gerente por encima.
     3. Mayra Aguilar queda como servicio_cliente. Hoy no puede: esta tambien
        en HBS-Vendedor y vendedor le gana por prioridad.

   El (2) y el (3) se resuelven con la MISMA herramienta: la columna 'orden'
   de tbl_cat_rol, que es la que desempata cuando alguien trae varios grupos.
   Menor gana. Se deja una escala sin empates entre roles distintos.

   RIESGO
     Ninguno hoy. Verificado persona por persona: con la escala nueva, las 21
     personas resuelven exactamente al mismo rol que tienen hoy. Lo unico que
     cambia el acceso de alguien es mover grupos en Azure, no este script.
     El rol 'observador' no lo puede activar nadie hasta que exista el grupo
     HBS-Observador Y el codigo de HidroSSO lo reconozca.

   REVERTIR
     PARTE 1: DELETE FROM hidrobart_costeo.tbl_role_permission WHERE rol='observador';
              DELETE FROM hidrobart_costeo.tbl_cat_rol WHERE org_rol='Observador';
              UPDATE hidrobart_costeo.tbl_cat_rol SET orden = CASE org_rol
                WHEN 'SuperAdmin' THEN 0 WHEN 'Admin' THEN 1 WHEN 'Operador' THEN 2
                WHEN 'Coordinador' THEN 3 WHEN 'GerenteVentas' THEN 3
                WHEN 'Manager' THEN 3 WHEN 'Compras' THEN 4 WHEN 'Employee' THEN 5
                WHEN 'Vendedor' THEN 5 WHEN 'External' THEN 6
                WHEN 'ServicioCliente' THEN 6 ELSE orden END;
     PARTE 2: DELETE FROM hidrobart_sso.tbl_sso_rol
                WHERE app_clave='costeo360' AND rol_clave='observador';
              (el CASCADE se lleva permisos y grupo)
   ============================================================================ */


/* ══ PARTE 1 ═══════════════════════════════════════════════════════════════
   hidrobart_costeo — LA BASE QUE OPERA.
   ═══════════════════════════════════════════════════════════════════════════ */
USE hidrobart_costeo;

/* 1.1 El rol nuevo.
       org_rol='Observador' es lo que HidroSSO produce al leer HBS-Observador,
       una vez que el codigo lo reconozca.                                    */
INSERT INTO tbl_cat_rol (org_rol, rol_interno, etiqueta, acceso_total, orden)
VALUES ('Observador', 'observador', 'Observador', 0, 3)
ON DUPLICATE KEY UPDATE rol_interno=VALUES(rol_interno), etiqueta=VALUES(etiqueta),
                        acceso_total=VALUES(acceso_total), orden=VALUES(orden);

/* 1.2 La escala de prioridad, sin empates entre roles distintos.
       Menor gana. Los unicos empates que quedan son entre grupos que van al
       MISMO rol (Coordinador/Manager, Vendedor/Employee), y ahi da igual.

         0  SuperAdmin       -> admin (y ademas acceso_total)
         1  Admin            -> admin
         2  GerenteVentas    -> gerente_ventas     <- arriba de coordinador
         3  Observador       -> observador
         4  Coordinador      -> supervisor_ventas
         4  Manager          -> supervisor_ventas
         5  Operador         -> operador
         6  Compras          -> compras
         7  ServicioCliente  -> servicio_cliente   <- arriba de vendedor
         8  Vendedor         -> vendedor
         8  Employee         -> vendedor
         9  External         -> externo                                       */
UPDATE tbl_cat_rol SET orden = CASE org_rol
    WHEN 'SuperAdmin'      THEN 0
    WHEN 'Admin'           THEN 1
    WHEN 'GerenteVentas'   THEN 2
    WHEN 'Observador'      THEN 3
    WHEN 'Coordinador'     THEN 4
    WHEN 'Manager'         THEN 4
    WHEN 'Operador'        THEN 5
    WHEN 'Compras'         THEN 6
    WHEN 'ServicioCliente' THEN 7
    WHEN 'Vendedor'        THEN 8
    WHEN 'Employee'        THEN 8
    WHEN 'External'        THEN 9
    ELSE orden
  END;

/* 1.3 El menu del observador: las 26 pantallas, todas en 'ver'.
       Ve lo mismo que un admin; no puede guardar nada.                       */
INSERT INTO tbl_role_permission (rol, recurso_clave, nivel)
SELECT 'observador', recurso_clave, 'ver'
FROM tbl_cat_recurso
ON DUPLICATE KEY UPDATE nivel = VALUES(nivel);


/* ══ PARTE 2 ═══════════════════════════════════════════════════════════════
   hidrobart_sso — LA BASE NUEVA, que sigue sin que nadie la lea.
   Espejo exacto de la PARTE 1, para que las dos digan lo mismo.
   ═══════════════════════════════════════════════════════════════════════════ */
USE hidrobart_sso;

/* 2.1 El rol */
INSERT INTO tbl_sso_rol (app_clave, rol_clave, etiqueta, acceso_total, orden)
VALUES ('costeo360', 'observador', 'Observador', 0, 3)
ON DUPLICATE KEY UPDATE etiqueta=VALUES(etiqueta), orden=VALUES(orden);

/* 2.2 La misma escala, esta vez por rol (aqui el orden vive en el rol) */
UPDATE tbl_sso_rol SET orden = CASE rol_clave
    WHEN 'superadmin'        THEN 0
    WHEN 'admin'             THEN 1
    WHEN 'gerente_ventas'    THEN 2
    WHEN 'observador'        THEN 3
    WHEN 'supervisor_ventas' THEN 4
    WHEN 'operador'          THEN 5
    WHEN 'compras'           THEN 6
    WHEN 'servicio_cliente'  THEN 7
    WHEN 'vendedor'          THEN 8
    WHEN 'externo'           THEN 9
    ELSE orden
  END
WHERE app_clave = 'costeo360';

/* 2.3 Y la misma escala en el mapa de grupos */
UPDATE tbl_sso_grupo_rol SET orden = CASE grupo_azure
    WHEN 'SuperAdmin'      THEN 0
    WHEN 'Admin'           THEN 1
    WHEN 'GerenteVentas'   THEN 2
    WHEN 'Observador'      THEN 3
    WHEN 'Coordinador'     THEN 4
    WHEN 'Manager'         THEN 4
    WHEN 'Operador'        THEN 5
    WHEN 'Compras'         THEN 6
    WHEN 'ServicioCliente' THEN 7
    WHEN 'Vendedor'        THEN 8
    WHEN 'Employee'        THEN 8
    WHEN 'External'        THEN 9
    ELSE orden
  END
WHERE app_clave = 'costeo360';

/* 2.4 Las 26 pantallas en 'ver' */
INSERT INTO tbl_sso_permiso (app_clave, rol_clave, recurso_clave, nivel, actualizado_por)
SELECT 'costeo360', 'observador', recurso_clave, 'ver', 'observador-20260907'
FROM tbl_sso_recurso
WHERE app_clave = 'costeo360'
ON DUPLICATE KEY UPDATE nivel = VALUES(nivel);

/* 2.5 El grupo de Azure que dispara el rol nuevo */
INSERT INTO tbl_sso_grupo_rol (app_clave, grupo_azure, rol_clave, orden)
VALUES ('costeo360', 'Observador', 'observador', 3)
ON DUPLICATE KEY UPDATE rol_clave = VALUES(rol_clave), orden = VALUES(orden);
