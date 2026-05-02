# HidroSSO — Guía de Integración para Apps

**Versión:** 1.0  
**Fecha:** 2026-04-27

Cómo conectar una nueva app Next.js al sistema SSO de Hidrobart.

---

## Resumen

Tu app NO maneja autenticación propia. El usuario llega ya autenticado desde HidroSSO con un launch token (`lt_xxxx`). Tu app lo intercambia por un `session_id`, lo guarda en cookie, y valida esa cookie en cada request.

Archivos que necesitas crear: **3**.

---

## 1. Variables de entorno

Agrega a tu `.env.local`:

```env
# URL del backend de HidroSSO
HIDROSSO_API_URL=https://auth-api.hidrobart.com

# URL del frontend de HidroSSO (para redirigir si no hay sesión)
NEXT_PUBLIC_HIDROSSO_URL=https://hidrosso.hidrobart.com
```

Para desarrollo local con la VM:
```env
HIDROSSO_API_URL=http://localhost:8010
NEXT_PUBLIC_HIDROSSO_URL=http://localhost:3010
```

---

## 2. Registrar la app en HidroSSO

En el backend de HidroSSO (`backend/app/routers/sso_router.py`), agregar tu app al diccionario `ALLOWED_APPS`:

```python
ALLOWED_APPS = {
    "costeo360":    "https://costeo360.hidrobart.com/auth/sso",
    "cortex":       "https://cortex.hidrobart.com/auth/sso",
    "unidum":       "https://unidum.hidrobart.com/auth/sso",
    "crm2":         "https://crm2.hidrobart.com/auth/sso",
    "hidropluspro": "https://hidropluspro.hidrobart.com/auth/sso",
    "miapp":        "https://miapp.hidrobart.com/auth/sso",  # ← nueva
}
```

Y agregar el botón en `frontend/data/apps.json` del proyecto HidroSSO:

```json
{
  "id": "miapp",
  "name": "Mi App",
  "sub": "miapp.hidrobart.com",
  "desc": "Descripción corta",
  "icon": "🔧",
  "url": "https://miapp.hidrobart.com",
  "tag": "NUEVO",
  "ssoId": "miapp",
  "active": true,
  "tier": "team",
  "order": 10
}
```

Hacer push y restart del backend y frontend de HidroSSO.

---

## 3. Archivo: middleware.ts

En la raíz de tu app Next.js (`middleware.ts`):

```typescript
/**
 * Middleware — Protección de rutas con sesión HidroSSO
 * Rutas públicas: /login, /auth/sso, /api/sso-entry
 * Todo lo demás requiere cookie hidrosso_sid.
 */
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/auth/sso",
  "/api/sso-entry",
  "/_next",
  "/favicon.ico",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  const sessionId = req.cookies.get("hidrosso_sid")?.value;
  if (!sessionId) {
    const hidrossoUrl =
      process.env.NEXT_PUBLIC_HIDROSSO_URL ?? "https://hidrosso.hidrobart.com";
    return NextResponse.redirect(hidrossoUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|images|icons|fonts).*)"],
};
```

---

## 4. Archivo: app/api/sso-entry/route.ts

```typescript
/**
 * GET /api/sso-entry?lt=lt_xxxx
 * Intercambia el launch token por session_id y setea la cookie hidrosso_sid.
 */
import { NextRequest, NextResponse } from "next/server";

const HIDROSSO_API =
  process.env.HIDROSSO_API_URL ?? "https://auth-api.hidrobart.com";

const POST_LOGIN_REDIRECT = "/dashboard";
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 horas

export async function GET(req: NextRequest) {
  const lt = req.nextUrl.searchParams.get("lt");

  if (!lt || !lt.startsWith("lt_")) {
    return redirectToLogin(req, "token_invalido");
  }

  let sessionId: string;
  try {
    const res = await fetch(
      `${HIDROSSO_API}/auth/sso-exchange?lt=${encodeURIComponent(lt)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5_000),
      }
    );

    if (!res.ok) {
      const detail = await res.json().then((d) => d?.detail ?? "error").catch(() => "error");
      console.error(`[sso-entry] sso-exchange falló: ${res.status} — ${detail}`);
      return redirectToLogin(req, res.status === 401 ? "token_expirado" : "sso_error");
    }

    const data = await res.json();
    sessionId = data.session_id;
    if (!sessionId) return redirectToLogin(req, "sso_error");

  } catch (err) {
    console.error("[sso-entry] No se pudo conectar con HidroSSO:", err);
    return redirectToLogin(req, "hidrosso_no_disponible");
  }

  const response = NextResponse.redirect(new URL(POST_LOGIN_REDIRECT, req.nextUrl.origin));
  response.cookies.set("hidrosso_sid", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return response;
}

function redirectToLogin(req: NextRequest, error: string): NextResponse {
  const loginUrl = new URL("/login", req.nextUrl.origin);
  loginUrl.searchParams.set("error", error);
  return NextResponse.redirect(loginUrl);
}
```

---

## 5. Archivo: app/auth/sso/page.tsx

Página que recibe el redirect de HidroSSO con el `lt` y llama al `sso-entry`:

```typescript
/**
 * /auth/sso?lt=lt_xxxx
 * Punto de entrada SSO — llama a /api/sso-entry para intercambiar el token.
 */
import { redirect } from "next/navigation";

interface Props {
  searchParams: { lt?: string };
}

export default function SsoPage({ searchParams }: Props) {
  const lt = searchParams.lt;
  if (!lt) redirect("/login?error=token_invalido");

  // Redirigir al API route que maneja el intercambio server-side
  redirect(`/api/sso-entry?lt=${encodeURIComponent(lt)}`);
}
```

---

## 6. Archivo: app/login/page.tsx (mínimo)

Página de error que recibe el query param `?error=`:

```typescript
"use client";
import { useSearchParams } from "next/navigation";

const ERRORES: Record<string, string> = {
  token_invalido:       "El enlace de acceso no es válido.",
  token_expirado:       "El enlace expiró (60s). Vuelve a HidroSSO e intenta de nuevo.",
  sso_error:            "Error al validar la sesión. Contacta a soporte.",
  hidrosso_no_disponible: "HidroSSO no está disponible. Intenta más tarde.",
};

export default function LoginPage() {
  const params = useSearchParams();
  const error = params.get("error") ?? "";
  const msg = ERRORES[error] ?? "Acceso no autorizado.";

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Hidrobart — Acceso</h1>
      <p>{msg}</p>
      <a href={process.env.NEXT_PUBLIC_HIDROSSO_URL ?? "https://hidrosso.hidrobart.com"}>
        → Ir a HidroSSO
      </a>
    </main>
  );
}
```

---

## 7. Validar sesión en páginas/APIs (opcional)

Si tu app necesita leer los datos del usuario autenticado (nombre, email, roles):

```typescript
// lib/session.ts
export async function getHidroSession(sid: string) {
  const HIDROSSO_API = process.env.HIDROSSO_API_URL ?? "https://auth-api.hidrobart.com";
  const res = await fetch(`${HIDROSSO_API}/auth/session-info?sid=${sid}`, {
    signal: AbortSignal.timeout(3_000),
  });
  if (!res.ok) return null;
  return res.json();
}

// En un Server Component o Route Handler:
import { cookies } from "next/headers";
import { getHidroSession } from "@/lib/session";

const sid = cookies().get("hidrosso_sid")?.value;
const session = sid ? await getHidroSession(sid) : null;
if (!session) redirect("/login?error=sso_error");

const { name, email, roles } = session;
```

---

## Errores posibles y qué significan

| Error en URL | Causa | Solución para el usuario |
|-------------|-------|--------------------------|
| `token_invalido` | El `lt` no tiene el formato correcto | Volver a HidroSSO y hacer clic de nuevo |
| `token_expirado` | Pasaron más de 60s desde que HidroSSO generó el token | Volver a HidroSSO y hacer clic de nuevo |
| `sso_error` | El backend de HidroSSO retornó error al intercambiar | Reportar a soporte — revisar logs de `hidrosso-api` |
| `hidrosso_no_disponible` | La app no pudo conectar con el backend de HidroSSO | Revisar que `hidrosso-api` esté corriendo en PM2 |

---

## Checklist de integración

- [ ] App registrada en `ALLOWED_APPS` en `sso_router.py` de HidroSSO
- [ ] Botón agregado en `apps.json` del dashboard de HidroSSO
- [ ] `HIDROSSO_API_URL` y `NEXT_PUBLIC_HIDROSSO_URL` en `.env`
- [ ] `middleware.ts` protegiendo rutas privadas
- [ ] `app/api/sso-entry/route.ts` creado
- [ ] `app/auth/sso/page.tsx` creado
- [ ] `app/login/page.tsx` con mensajes de error
- [ ] Push a HidroSSO + restart `hidrosso-api` y `hidrosso-frontend`
- [ ] Build y deploy de la nueva app
- [ ] Prueba del flujo completo end-to-end
