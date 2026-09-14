/* ============================================================================
   HidroSSO v2 — guardar los nombres crudos de los grupos de Azure
   2026-09-14

   POR QUE
     tbl_sso_persona.grupos_azure guarda las ETIQUETAS que produjo el mapeo
     —"Admin,Manager,Coordinador"—, no los grupos reales de la persona.

     Cuando Alberto Gomez aparecio como admin, la tabla decia "Admin" y no
     habia forma de saber DE DONDE salio: el mapeo buscaba palabras dentro
     del nombre de cualquier grupo, y un "Administracion" o un "Managers
     Comerciales" bastaban. Se diagnostico razonando, no consultando.

     Con los nombres crudos, la misma pregunta se contesta con un SELECT:
     "este grupo de rol no existe, entonces vino de otro lado".

   RIESGO
     Ninguno. Una columna nueva, opcional, que se llena en el siguiente
     login de cada persona.

   REVERTIR
     ALTER TABLE hidrobart_sso.tbl_sso_persona DROP COLUMN grupos_crudos;
   ============================================================================ */
USE hidrobart_sso;

/* MySQL 8 no soporta ADD COLUMN IF NOT EXISTS (eso es MariaDB), asi que se
   consulta el catalogo para que el script quede re-ejecutable.            */
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME   = 'tbl_sso_persona'
                  AND COLUMN_NAME  = 'grupos_crudos');
SET @sql := IF(@existe = 0,
  "ALTER TABLE tbl_sso_persona ADD COLUMN grupos_crudos VARCHAR(1000) NULL
     COMMENT 'nombres tal cual de los grupos de Azure, sin filtrar ni mapear'",
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

/* ── Vista: quien trae grupos que no son de rol ───────────────────────────── */
/* Los grupos de rol se llaman HBS-* o HB-*. Cualquier otro se ignora al
   resolver, pero verlos sirve para entender de donde salia el ruido.      */
CREATE OR REPLACE VIEW vw_sso_grupos_persona AS
SELECT email,
       nombre,
       grupos_azure   AS etiquetas_de_rol,
       grupos_crudos  AS todos_sus_grupos,
       ultimo_login
FROM tbl_sso_persona
ORDER BY nombre;
