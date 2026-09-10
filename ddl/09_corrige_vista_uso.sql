/* ============================================================================
   HidroSSO v2 — corrige vw_sso_permiso_vs_uso
   2026-09-10

   EL ERROR
     La vista contaba las aperturas con COUNT(b.id) sobre un LEFT JOIN a
     tbl_sso_permiso. Como cada pantalla tiene una fila por rol (10 en
     costeo360), cada evento de la bitacora se contaba diez veces. Con 92
     eventos reales reportaba 126 aperturas de una sola pantalla.
     Se vio porque el total no cuadraba: la suma daba mas que los eventos
     que existen.

   EL ARREGLO
     Cada cifra se calcula en su propia subconsulta, sin joins que
     multipliquen. Mas lento en teoria, irrelevante a este volumen, y
     correcto.

   ADEMAS: 'personas_con_acceso' se retira.
     Se apoyaba en tbl_sso_asignacion, que esta vacia y probablemente siga
     asi: hoy el acceso lo resuelven los grupos de Azure, no asignaciones
     por persona. Una columna que siempre dice 0 no informa, engana.
     En su lugar va 'roles_con_acceso', que si se puede contar y contesta
     la misma pregunta desde el otro lado.

   RIESGO
     Ninguno. Solo redefine una vista de lectura.
   ============================================================================ */
USE hidrobart_sso;

CREATE OR REPLACE VIEW vw_sso_permiso_vs_uso AS
SELECT
  c.app_clave,
  c.recurso_clave,
  c.etiqueta,
  c.seccion,

  /* A cuantos roles se les abrio esta pantalla */
  (SELECT COUNT(*)
     FROM tbl_sso_permiso pm
     JOIN tbl_sso_rol r ON r.app_clave = pm.app_clave AND r.rol_clave = pm.rol_clave
    WHERE pm.app_clave = c.app_clave
      AND pm.recurso_clave = c.recurso_clave
      AND pm.nivel <> 'ninguno'
      AND r.activo = 1)                                AS roles_con_acceso,

  /* Cuanta gente distinta la abrio de verdad */
  (SELECT COUNT(DISTINCT b.email)
     FROM tbl_sso_bitacora b
    WHERE b.app_clave = c.app_clave
      AND b.recurso_clave = c.recurso_clave
      AND b.evento = 'pantalla')                       AS personas_que_la_abrieron,

  /* Cuantas veces se abrio */
  (SELECT COUNT(*)
     FROM tbl_sso_bitacora b
    WHERE b.app_clave = c.app_clave
      AND b.recurso_clave = c.recurso_clave
      AND b.evento = 'pantalla')                       AS veces_abierta,

  /* Cuando fue la ultima vez. NULL = nunca */
  (SELECT MAX(b.creado_en)
     FROM tbl_sso_bitacora b
    WHERE b.app_clave = c.app_clave
      AND b.recurso_clave = c.recurso_clave
      AND b.evento = 'pantalla')                       AS ultima_apertura

FROM tbl_sso_recurso c
WHERE c.activo = 1;
