/* ============================================================================
   Costeo360 — el Coordinador de Ventas deja de ver Panel de Issues
   Decision de Philippe, 2026-09-14.

   POR QUE
     Panel de Issues es una herramienta de operacion: se atienden y resuelven
     incidencias de carga y de precios. Un coordinador de ventas no opera eso.
     Se le habia quedado de la matriz original.

   QUE CAMBIA
     supervisor_ventas pasa de 5 pantallas a 4, todas de Ventas:
       Precio Lista · Precio Piso/Min · Precio Lista Potenciales · Cotizador Mixto

     Se toca en LAS DOS bases:
       hidrobart_sso     la que hoy alimenta el menu (desde v1.7.289)
       hidrobart_costeo  la que alimenta la pantalla "Roles y permisos"
     Si solo se tocara una, las dos dirian cosas distintas.

   NO se toca gerente_ventas ni servicio_cliente, que tambien lo tienen.
   Si tampoco deben verlo, se agregan a las dos sentencias.

   RIESGO
     Bajo y reversible. Quien tenga sesion abierta lo seguira viendo hasta
     que recargue: el menu se arma al cargar la pagina.

   REVERTIR
     UPDATE hidrobart_sso.tbl_sso_permiso SET nivel='completo'
       WHERE app_clave='costeo360' AND rol_clave='supervisor_ventas'
         AND recurso_clave='panel-issues';
     UPDATE hidrobart_costeo.tbl_role_permission SET nivel='completo'
       WHERE rol='supervisor_ventas' AND recurso_clave='panel-issues';
   ============================================================================ */

UPDATE hidrobart_sso.tbl_sso_permiso
   SET nivel = 'ninguno', actualizado_por = 'coordinador-sin-issues-20260914'
 WHERE app_clave     = 'costeo360'
   AND rol_clave     = 'supervisor_ventas'
   AND recurso_clave = 'panel-issues';

UPDATE hidrobart_costeo.tbl_role_permission
   SET nivel = 'ninguno'
 WHERE rol           = 'supervisor_ventas'
   AND recurso_clave = 'panel-issues';

/* Comprobacion: debe quedar en 4 pantallas, todas de la seccion ventas */
SELECT c.seccion, c.etiqueta AS ve, p.nivel
  FROM hidrobart_sso.tbl_sso_permiso p
  JOIN hidrobart_sso.tbl_sso_recurso c
    ON c.app_clave = p.app_clave AND c.recurso_clave = p.recurso_clave
 WHERE p.app_clave = 'costeo360'
   AND p.rol_clave = 'supervisor_ventas'
   AND p.nivel <> 'ninguno'
 ORDER BY c.orden;
