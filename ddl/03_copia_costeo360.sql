/* ============================================================================
   HidroSSO v2 · Fase 1 — copia de Costeo360 a hidrobart_sso
   Escrito: 2026-09-07

   QUE HACE: copia las 3 tablas de permisos de Costeo360 a hidrobart_sso,
   etiquetadas como app_clave='costeo360'.

   QUE NO HACE: no escribe NADA en hidrobart_costeo. Solo lee de ahi.
   Costeo360 sigue leyendo sus propias tablas y no se entera de esto.
   Nadie consume hidrobart_sso todavia, asi que este script no puede
   cambiarle el acceso a ninguna persona.

   REVERTIR:  DELETE FROM hidrobart_sso.tbl_sso_app WHERE app_clave='costeo360';
              (el CASCADE se lleva roles, recursos y permisos)
   ============================================================================ */
USE hidrobart_sso;

/* ── 1. La app ────────────────────────────────────────────────────────────── */
/* rol_defecto='vendedor' y requiere_asig=0 replican sp_resolver_rol, que hoy
   devuelve 'vendedor' cuando la persona no trae ningun grupo conocido.        */
INSERT INTO tbl_sso_app (app_clave, nombre, url_base, url_sso, rol_defecto, requiere_asig)
VALUES ('costeo360', 'Costeo360',
        'https://costeo360.hidrobart.com',
        'https://costeo360.hidrobart.com/auth/sso',
        'vendedor', 0)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

/* ── 2. Los roles ─────────────────────────────────────────────────────────── */
/* En Costeo, acceso_total vive en el GRUPO de Azure (tbl_cat_rol.acceso_total),
   no en el rol. Aqui vive en el rol. Para no perder la diferencia ni regalarle
   acceso_total al grupo 'Admin', el rol de SuperAdmin se separa como
   'superadmin' con la misma matriz que 'admin'. Es la unica traduccion que
   este script hace; todo lo demas es copia literal.                           */
INSERT INTO tbl_sso_rol (app_clave, rol_clave, etiqueta, acceso_total, orden)
SELECT 'costeo360', r.rol_interno, MIN(r.etiqueta), 0, MIN(r.orden)
FROM hidrobart_costeo.tbl_cat_rol r
GROUP BY r.rol_interno
ON DUPLICATE KEY UPDATE etiqueta = VALUES(etiqueta);

INSERT INTO tbl_sso_rol (app_clave, rol_clave, etiqueta, acceso_total, orden)
VALUES ('costeo360', 'superadmin', 'SuperAdmin', 1, 0)
ON DUPLICATE KEY UPDATE etiqueta = VALUES(etiqueta);

/* ── 3. Los recursos (las 26 pantallas) ───────────────────────────────────── */
INSERT INTO tbl_sso_recurso (app_clave, recurso_clave, etiqueta, seccion, ruta, en_menu, orden)
SELECT 'costeo360', c.recurso_clave, c.etiqueta, c.seccion,
       CONCAT('/', c.recurso_clave), 1, c.orden
FROM hidrobart_costeo.tbl_cat_recurso c
ON DUPLICATE KEY UPDATE etiqueta = VALUES(etiqueta), seccion = VALUES(seccion),
                        orden = VALUES(orden);

/* ── 4. Base de la matriz: TODO en 'ninguno' ──────────────────────────────── */
/* Deny por defecto. Asi ninguna combinacion queda abierta por olvido, y las
   filas que Costeo no tiene (el rol 'externo' no tiene ni una) quedan cerradas,
   que es exactamente como se comportan hoy: sin fila = sin acceso.            */
INSERT INTO tbl_sso_permiso (app_clave, rol_clave, recurso_clave, nivel, actualizado_por)
SELECT 'costeo360', r.rol_clave, c.recurso_clave, 'ninguno', 'copia-costeo-20260907'
FROM tbl_sso_rol r
JOIN tbl_sso_recurso c ON c.app_clave = r.app_clave
WHERE r.app_clave = 'costeo360'
ON DUPLICATE KEY UPDATE nivel = nivel;

/* ── 5. Encima, la matriz real de Costeo360, tal cual ─────────────────────── */
INSERT INTO tbl_sso_permiso (app_clave, rol_clave, recurso_clave, nivel, actualizado_por)
SELECT 'costeo360', p.rol, p.recurso_clave, p.nivel, 'copia-costeo-20260907'
FROM hidrobart_costeo.tbl_role_permission p
ON DUPLICATE KEY UPDATE nivel = VALUES(nivel);

/* 'superadmin' hereda la matriz de 'admin' (ademas trae acceso_total=1) */
INSERT INTO tbl_sso_permiso (app_clave, rol_clave, recurso_clave, nivel, actualizado_por)
SELECT 'costeo360', 'superadmin', p.recurso_clave, p.nivel, 'copia-costeo-20260907'
FROM tbl_sso_permiso p
WHERE p.app_clave = 'costeo360' AND p.rol_clave = 'admin'
ON DUPLICATE KEY UPDATE nivel = VALUES(nivel);

/* ── 6. Grupo de Azure → rol ──────────────────────────────────────────────── */
INSERT INTO tbl_sso_grupo_rol (app_clave, grupo_azure, rol_clave, orden)
SELECT 'costeo360', r.org_rol,
       CASE WHEN r.acceso_total = 1 THEN 'superadmin' ELSE r.rol_interno END,
       r.orden
FROM hidrobart_costeo.tbl_cat_rol r
ON DUPLICATE KEY UPDATE rol_clave = VALUES(rol_clave), orden = VALUES(orden);
