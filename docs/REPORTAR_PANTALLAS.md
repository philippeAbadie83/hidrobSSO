# Cómo reporta una app las pantallas que abre su gente

HidroSSO registra solo dos cosas: el **login** y el **salto a una app**. Eso lo
sabe porque pasa por él. Lo que no puede saber es **qué pantalla abriste una vez
adentro** — eso solo lo sabe la app.

Son unas 10 líneas por app, una sola vez.

---

## La regla que hace que esto sirva

> `recurso` tiene que ser **exactamente la misma llave** que usa el menú y que
> está en `tbl_sso_recurso.recurso_clave`.

No `lista_precios` en un lado y `precio-lista` en el otro. La misma.

De eso depende poder contestar la pregunta que hoy no se puede:

> *De los que **tienen** acceso a Precio Piso, ¿cuántos la abren de verdad?*

Permiso otorgado contra permiso usado, para limpiar accesos con datos en vez de
con intuición. Se consulta en `GET /sso/apps/{app}/uso`.

Ponerse de acuerdo en la llave ahora cuesta cero. Descubrirlo después significa
reescribir.

---

## El endpoint

```
POST https://hidrosso.hidrobart.com/api/sso/evento
Content-Type: application/json

{ "sid": "<session_id de HidroSSO>", "app": "costeo360", "recurso": "precio-lista" }
```

Contesta `202` de inmediato y escribe en segundo plano. **La app no debe esperar
la respuesta ni fallar si esto falla.** Es una bitácora, no un permiso.

---

## Next.js — App Router

`components/ReportarPantalla.tsx`

```tsx
"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const APP = "costeo360";                       // cambiar por app
const SSO = "https://hidrosso.hidrobart.com/api";

/** La ruta del navegador -> la llave del menu. Debe coincidir con
 *  tbl_sso_recurso.recurso_clave, si no el cruce permiso-vs-uso no cuadra. */
function llaveDe(ruta: string): string | null {
  const seg = ruta.split("/").filter(Boolean)[0];
  return seg ?? null;
}

export function ReportarPantalla({ sid }: { sid?: string }) {
  const ruta = usePathname();

  useEffect(() => {
    const recurso = llaveDe(ruta);
    if (!sid || !recurso) return;

    // keepalive: si la persona se va de inmediato, el evento igual sale.
    fetch(`${SSO}/sso/evento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sid, app: APP, recurso }),
      keepalive: true,
    }).catch(() => {});          // silencio a proposito: nunca molestar al usuario
  }, [ruta, sid]);

  return null;
}
```

Y en el layout, una línea:

```tsx
<ReportarPantalla sid={session?.hidrobartSessionId} />
```

---

## Cualquier otra cosa — Superset, un script, un MCP

```bash
curl -s -X POST https://hidrosso.hidrobart.com/api/sso/evento \
  -H 'Content-Type: application/json' \
  -d '{"sid":"'"$SID"'","app":"costeo360","recurso":"precio-lista"}'
```

---

## Qué se gana en cuanto una app lo reporta

| Consulta | Qué contesta |
|---|---|
| `GET /sso/resumen/personas` | Quién entra, cada cuándo, cuántas pantallas usa |
| `GET /sso/resumen/apps` | Cuánta gente usa cada app **de verdad** |
| `GET /sso/resumen/uso` | El cruce persona × app |
| `GET /sso/resumen/meses` | Si una app crece o se está muriendo |
| `GET /sso/apps/{app}/uso` | **Permiso otorgado contra permiso usado** |

Sin el evento de pantalla, las tres primeras funcionan a medias y las dos
últimas no dicen nada.

---

## Lo que NO hace esto

No es un mapa de calor. No guarda dónde le picaste dentro de la pantalla, ni
cuánto scrolleaste, ni cuánto tiempo te quedaste. Solo *entró a esta pantalla*.

Eso es a propósito: son ~400 filas al día para 50 personas y le caben a MySQL
sin despeinarse. Un mapa de calor son miles de eventos por sesión y ese sí
necesita otra base. Se construye el día que haya una pregunta concreta que lo
pida — no antes.
