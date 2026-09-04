/* ============================================================================
   HidroSSO v2 · Fase 1 — siembra de Cliente360
   Matriz aprobada por Philippe el 2026-09-03. Copia exacta de lo que hoy vive
   en directorio360-web/src/lib/menu-config.ts (RUTAS), para que el día que la
   app lea de aquí NADIE note ningún cambio.
   Costeo360 NO se toca: sigue con sus propias tablas hasta la fase 5.
   ============================================================================ */
USE hidrobart_sso;

/* ── App ──────────────────────────────────────────────────────────────────── */
INSERT INTO tbl_sso_app (app_clave, nombre, url_base, url_sso, rol_defecto, requiere_asig)
VALUES ('cliente360', 'Cliente360', 'https://cliente360.hidrobart.com',
        'https://cliente360.hidrobart.com/auth/sso', 'vendedor', 0)
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
/* requiere_asig=0 → nadie se queda fuera al encender. Se cierra después. */

/* ── Roles (los que Cliente360 usa hoy + gerente_ventas + externo) ───────── */
INSERT INTO tbl_sso_rol (app_clave, rol_clave, etiqueta, acceso_total, orden) VALUES
  ('cliente360','admin',            'Administrador',      1, 0),
  ('cliente360','operador',         'Operador',           0, 2),
  ('cliente360','gerente_ventas',   'Gerente Ventas',     0, 3),
  ('cliente360','supervisor_ventas','Coordinador Ventas', 0, 3),
  ('cliente360','vendedor',         'Ventas',             0, 5),
  ('cliente360','externo',          'Externo (sin acceso)',0, 6)
ON DUPLICATE KEY UPDATE etiqueta=VALUES(etiqueta);

/* ── Grupos de Azure → rol (copiado de hidrobart_costeo.tbl_cat_rol) ──────── */
INSERT INTO tbl_sso_grupo_rol (app_clave, grupo_azure, rol_clave, orden) VALUES
  ('cliente360','SuperAdmin',   'admin',             0),
  ('cliente360','Admin',        'admin',             0),
  ('cliente360','Operador',     'operador',          2),
  ('cliente360','GerenteVentas','gerente_ventas',    3),
  ('cliente360','Coordinador',  'supervisor_ventas', 3),
  ('cliente360','Manager',      'supervisor_ventas', 3),
  ('cliente360','Vendedor',     'vendedor',          5),
  ('cliente360','Employee',     'vendedor',          5),
  ('cliente360','External',     'externo',           6)
ON DUPLICATE KEY UPDATE rol_clave=VALUES(rol_clave);
/* GerenteVentas es el grupo que hoy Cliente360 NO reconoce: mapRole() lo tira
   al default 'vendedor'. Aquí ya queda resuelto sin tocar código. */

/* ── Recursos = las 12 pantallas. recurso_clave = key del menú ────────────── */
INSERT INTO tbl_sso_recurso (app_clave, recurso_clave, etiqueta, seccion, ruta, en_menu, orden) VALUES
  ('cliente360','directorio',        'Clientes general',        'directorio','/directorio',        1, 1),
  ('cliente360','credito-desc',      'Crédito y descuentos',    'directorio','/credito-descuentos',1, 2),
  ('cliente360','vendedores',        'Por Vendedor',            'directorio','/vendedores',        1, 3),
  ('cliente360','analisis-clientes', 'Clientes con venta',      'inteligencia','/analisis-clientes',1, 4),
  ('cliente360','precio-lista',      'Precio Lista',            'ventas','/precio-lista',          1,15),
  ('cliente360','precio-piso-lista', 'Precio Piso/Min y Lista', 'ventas','/precio-piso-lista',     1,16),
  ('cliente360','precio-lista-poten','Precio Lista Potenciales','ventas','/precio-lista-poten',    1,17),
  ('cliente360','cotizador',         'Cotizador',               'ventas','/cotizador',             1,18),
  ('cliente360','vend-map',          'Mapa de vendedores',      'sistema','/vend-map',             1,20),
  ('cliente360','dashb',             'Tablero ejecutivo',       'sistema','/dashb',                0,30),
  ('cliente360','ventas-costos',     'Ventas vs Costos',        'sistema','/ventas-costos',        0,31),
  ('cliente360','analisis-ventas',   'Análisis de ventas',      'sistema','/analisis-ventas',      0,32)
ON DUPLICATE KEY UPDATE etiqueta=VALUES(etiqueta), ruta=VALUES(ruta), en_menu=VALUES(en_menu);

/* ── La matriz ────────────────────────────────────────────────────────────── */
/* Se siembra en dos pasos: primero TODO en 'ninguno' (deny por defecto), luego
   se abre lo que la matriz aprobada permite. Así nada queda abierto por olvido. */
INSERT INTO tbl_sso_permiso (app_clave, rol_clave, recurso_clave, nivel, actualizado_por)
SELECT r.app_clave, r.rol_clave, c.recurso_clave, 'ninguno', 'siembra-20260904'
FROM tbl_sso_rol r
JOIN tbl_sso_recurso c ON c.app_clave = r.app_clave
WHERE r.app_clave = 'cliente360'
ON DUPLICATE KEY UPDATE nivel = nivel;

/* Abiertas a todos los roles de venta (admin, operador, gerente, coord, vendedor) */
UPDATE tbl_sso_permiso SET nivel='completo', actualizado_por='siembra-20260904'
WHERE app_clave='cliente360'
  AND rol_clave IN ('admin','operador','gerente_ventas','supervisor_ventas','vendedor')
  AND recurso_clave IN ('directorio','credito-desc','vendedores','analisis-clientes',
                        'precio-lista','precio-lista-poten','cotizador');

/* Precio Piso y Mapa de vendedores: coordinador y arriba. El vendedor NO.
   (Precio Piso es idéntico a como está en Costeo, de donde se sirve.)          */
UPDATE tbl_sso_permiso SET nivel='completo', actualizado_por='siembra-20260904'
WHERE app_clave='cliente360'
  AND rol_clave IN ('admin','operador','gerente_ventas','supervisor_ventas')
  AND recurso_clave IN ('precio-piso-lista','vend-map');

/* Costos, utilidad y margen: solo admin y operador.
   Regla heredada de la matriz de Costeo360.                                    */
UPDATE tbl_sso_permiso SET nivel='completo', actualizado_por='siembra-20260904'
WHERE app_clave='cliente360'
  AND rol_clave IN ('admin','operador')
  AND recurso_clave IN ('dashb','ventas-costos','analisis-ventas');

/* 'externo' se queda en 'ninguno' en todo — no se le abre nada. */
