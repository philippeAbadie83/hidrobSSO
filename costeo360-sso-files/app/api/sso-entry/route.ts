/**
 * GET /api/sso-entry?lt=lt_xxxx — Costeo360
 *
 * Intercambia el launch token (one-time, 60s) emitido por HidroSSO
 * por el session_id real, setea la cookie hidrosso_sid y redirige
 * al dashboard de Costeo360.
 *
 * Flujo completo:
 *   HidroSSO frontend → /auth/sso?lt=... → (esta route) →
 *   HidroSSO backend /auth/sso-exchange → session_id →
 *   Set-Cookie: hidrosso_sid → redirect /dashboard
 */
import { NextRequest, NextResponse } from "next/server";

// URL del backend de HidroSSO (FastAPI puerto 8010 en VM)
const HIDROSSO_API =
  process.env.HIDROSSO_API_URL ?? "http://localhost:8010";

// Donde redirigir tras un login exitoso
const POST_LOGIN_REDIRECT = "/dashboard";

// Cookie válida durante 8 horas (mismo TTL que la sesión en Redis)
const COOKIE_MAX_AGE = 60 * 60 * 8;

export async function GET(req: NextRequest) {
  const lt = req.nextUrl.searchParams.get("lt");

  // ── 1. Validar presencia y formato del token ──────────────────────────────
  if (!lt || !lt.startsWith("lt_")) {
    return redirectToLogin(req, "token_invalido");
  }

  // ── 2. Intercambiar lt por session_id en HidroSSO ─────────────────────────
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
      const detail = await res
        .json()
        .then((d) => d?.detail ?? "error")
        .catch(() => "error");
      console.error(`[sso-entry] sso-exchange falló: ${res.status} — ${detail}`);
      return redirectToLogin(
        req,
        res.status === 401 ? "token_expirado" : "sso_error"
      );
    }

    const data = await res.json();
    sessionId = data.session_id;

    if (!sessionId) {
      console.error("[sso-entry] sso-exchange no devolvió session_id");
      return redirectToLogin(req, "sso_error");
    }
  } catch (err) {
    console.error("[sso-entry] No se pudo conectar con HidroSSO:", err);
    return redirectToLogin(req, "hidrosso_no_disponible");
  }

  // ── 3. Setear cookie y redirigir al dashboard ─────────────────────────────
  const baseUrl = req.nextUrl.origin;
  const response = NextResponse.redirect(
    new URL(POST_LOGIN_REDIRECT, baseUrl)
  );

  response.cookies.set("hidrosso_sid", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  console.info(`[sso-entry] SSO completado — sesión establecida`);
  return response;
}

// ── Helper ────────────────────────────────────────────────────────────────────
function redirectToLogin(req: NextRequest, error: string): NextResponse {
  const loginUrl = new URL("/login", req.nextUrl.origin);
  loginUrl.searchParams.set("error", error);
  return NextResponse.redirect(loginUrl);
}
