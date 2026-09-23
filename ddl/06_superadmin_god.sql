/* ============================================================================
   HidroSSO v2 — SuperAdmin es god en TODAS las apps, y nadie más
   Regla de Philippe, 2026-09-08.

   EL PROBLEMA QUE ARREGLA
     cliente360 mandaba los grupos SuperAdmin Y Admin al mismo rol 'admin',
     y ese rol traia acceso_total=1. Resultado: cualquiera del grupo Admin
     (Itzel, Martin, Guillermo, Hector) era god en Cliente360, no solo el
     SuperAdmin. costeo360 ya estaba bien porque el 03 separo los dos roles.

   LA REGLA, DE AQUI EN ADELANTE
     - Cada app tiene un rol 'superadmin' con acceso_total=1 y orden 0.
     - El grupo de Azure 'SuperAdmin' (que sale tanto de HB-SuperAdmin como
       de HBS-SuperAdmin) apunta a ese rol.
     - NINGUN otro rol lleva acceso_total.

   Es re-ejecutable: cada vez que se dé de alta una app nueva en
   tbl_sso_app, correr este script otra vez la deja cumpliendo la regla.

   RIESGO
     Ninguno hoy: nadie lee hidrobart_sso todavia. Y aunque se leyera, el
     SuperAdmin no pierde nada — solo deja de regalarse el acceso total al
     grupo Admin, que es justo lo que se quiere.
   ============================================================================ */
USE hidrobart_sso;

/* ── 1. Un rol 'superadmin' en cada app ───────────────────────────────────── */
INSERT INTO tbl_sso_rol (app_clave, rol_clave, etiqueta, acceso_total, orden)
SELECT a.app_clave, 'superadmin', 'SuperAdmin', 1, 0
FROM tbl_sso_app a
ON DUPLICATE KEY UPDATE etiqueta = VALUES(etiqueta), acceso_total = 1, orden = 0;

/* ── 2. El grupo SuperAdmin apunta ahi, en cada app ───────────────────────── */
INSERT INTO tbl_sso_grupo_rol (app_clave, grupo_azure, rol_clave, orden)
SELECT a.app_clave, 'SuperAdmin', 'superadmin', 0
FROM tbl_sso_app a
ON DUPLICATE KEY UPDATE rol_clave = 'superadmin', orden = 0;

/* ── 3. Su matriz: copia de la de admin ───────────────────────────────────── */
/* Con acceso_total=1 la matriz ni se consulta, pero si algun dia se apaga
   la bandera, el superadmin degrada a admin en vez de quedarse sin nada.    */
INSERT INTO tbl_sso_permiso (app_clave, rol_clave, recurso_clave, nivel, actualizado_por)
SELECT p.app_clave, 'superadmin', p.recurso_clave, p.nivel, 'superadmin-god-20260908'
FROM tbl_sso_permiso p
WHERE p.rol_clave = 'admin'
ON DUPLICATE KEY UPDATE nivel = VALUES(nivel);

/* ── 4. Nadie mas es god ──────────────────────────────────────────────────── */
UPDATE tbl_sso_rol SET acceso_total = 0 WHERE rol_clave <> 'superadmin';
