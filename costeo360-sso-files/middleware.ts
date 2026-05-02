/**
 * Middleware de Costeo360 — Protección de rutas con sesión HidroSSO
 *
 * Rutas PÚBLICAS (no requieren cookie hidrosso_sid):
 *   /login          → página de error/bienvenida
 *   /auth/sso       → entrada del flujo SSO (recibe ?lt=)
 *   /api/sso-entry  → intercambia lt y setea la cookie
 *
 * Todo lo demás requiere la cookie hidrosso_sid válida.
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
      process.env.NEXT_PUBLIC_HIDROSSO_URL ?? "https://login.hidrobart.com";
    return NextResponse.redirect(hidrossoUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|images|icons|fonts).*)"],
};
