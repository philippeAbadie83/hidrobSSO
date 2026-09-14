/* ============================================================================
   HidroSSO v2 — el acceso total vuelve a la fila del grupo
   2026-09-14. Deshace una decision mia del ddl/03 que costo la tarde.

   QUE SE ROMPIO
     Costeo360 siempre resolvio asi, en tbl_cat_rol:

       grupo SuperAdmin  ->  rol interno "admin"  +  acceso_total = 1
       grupo Admin       ->  rol interno "admin"  +  acceso_total = 0

     Los dos daban el MISMO rol interno. La diferencia entre ser god o no
     vivia en la fila del GRUPO, no en el nombre del rol.

     Al copiar el catalogo a hidrobart_sso lo parti en dos roles distintos,
     'superadmin' y 'admin'. Eso cambio el nombre del rol con el que entra
     el SuperAdmin, y ese nombre estaba escrito a mano en 17 lugares del
     frontend y en 7 tuplas del backend. De ahi salieron, en cadena:
       Precio Lista vacio · 403 en Margenes y Reglas de Proveedor ·
       Precio Piso y Detalle Costo-Precio expulsando al SuperAdmin.

   QUE HACE ESTE SCRIPT
     Devuelve el modelo original: acceso_total pasa a la fila del grupo.

       grupo SuperAdmin  ->  rol "admin"  ·  acceso_total = 1
       grupo Admin       ->  rol "admin"  ·  acceso_total = 0

     El rol interno vuelve a llamarse "admin", asi que las 17 comparaciones
     vuelven a coincidir SIN tocar una linea de frontend. Y SuperAdmin sigue
     siendo el unico god, que es la regla que pidio Philippe.

   ESTO DEJA OBSOLETO al ddl/06, que hacia lo contrario. No correrlo.

   RIESGO
     El rol 'superadmin' desaparece. Quien tenga sesion abierta con ese rol
     sigue con el hasta que vuelva a entrar; su JWT ya esta firmado. Al
     re-entrar llega como "admin" con acceso total, que es lo correcto.

   REVERTIR
     Esta al final del archivo, comentado.
   ============================================================================ */
USE hidrobart_sso;

/* ── 1. La columna, en la fila del grupo ──────────────────────────────────── */
/* MySQL 8 no soporta ADD COLUMN IF NOT EXISTS; se consulta el catalogo. */
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME   = 'tbl_sso_grupo_rol'
                  AND COLUMN_NAME  = 'acceso_total');
SET @sql := IF(@existe = 0,
  "ALTER TABLE tbl_sso_grupo_rol ADD COLUMN acceso_total TINYINT(1) NOT NULL DEFAULT 0
     COMMENT '1 = este GRUPO entra con acceso total, aunque su rol no lo tenga'",
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

/* ── 2. SuperAdmin apunta a "admin" y trae el acceso total ────────────────── */
UPDATE tbl_sso_grupo_rol
   SET rol_clave = 'admin', acceso_total = 1, orden = 0
 WHERE grupo_azure = 'SuperAdmin';

/* Cualquier otro grupo: sin acceso total */
UPDATE tbl_sso_grupo_rol
   SET acceso_total = 0
 WHERE grupo_azure <> 'SuperAdmin';

/* ── 3. Ningun ROL lleva ya la bandera ────────────────────────────────────── */
/* Pasa a ser atributo del grupo. Un rol no es god por si mismo; lo es quien
   llega por la puerta correcta.                                             */
UPDATE tbl_sso_rol SET acceso_total = 0;

/* ── 4. Se retira el rol 'superadmin' ─────────────────────────────────────── */
/* El CASCADE se lleva sus permisos. Ya nadie apunta a el (paso 2).          */
DELETE FROM tbl_sso_rol WHERE rol_clave = 'superadmin';

/* ── 5. Comprobacion ──────────────────────────────────────────────────────── */
SELECT g.app_clave, g.grupo_azure, g.rol_clave,
       g.acceso_total AS god,
       r.etiqueta
  FROM tbl_sso_grupo_rol g
  JOIN tbl_sso_rol r ON r.app_clave = g.app_clave AND r.rol_clave = g.rol_clave
 WHERE g.grupo_azure IN ('SuperAdmin','Admin')
 ORDER BY g.app_clave, g.grupo_azure;

/* ── PARA REVERTIR ────────────────────────────────────────────────────────────
   UPDATE hidrobart_sso.tbl_sso_grupo_rol SET rol_clave='superadmin'
     WHERE grupo_azure='SuperAdmin';
   INSERT INTO hidrobart_sso.tbl_sso_rol (app_clave,rol_clave,etiqueta,acceso_total,orden)
     SELECT app_clave,'superadmin','SuperAdmin',1,0 FROM hidrobart_sso.tbl_sso_app;
   ... y volver a copiarle la matriz de admin.
   ──────────────────────────────────────────────────────────────────────────── */
