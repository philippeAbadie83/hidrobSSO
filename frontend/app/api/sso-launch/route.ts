/**
 * GET /api/sso-launch?app=costeo360
 * Lee el session_id del JWT de NextAuth (server-side) y crea un launch token
 * de 60s via el FastAPI de HidroSSO. Devuelve la URL de redirección.
 */
import { NextRequest, NextResponse } from "next/server";
import { getToken }                  from "next-auth/jwt";

const AUTH_API = process.env.NEXT_PUBLIC_AUTH_API ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  // 1. Leer el JWT completo (server-side — hidrobartSessionId NO está en session.user)
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const sessionId = token.hidrobartSessionId as string | undefined;
  if (!sessionId) {
    return NextResponse.json(
      { error: "Sesión Hidrobart no disponible — vuelve a iniciar sesión" },
      { status: 401 }
    );
  }

  // 2. App destino
  const app = req.nextUrl.searchParams.get("app")?.toLowerCase();
  if (!app) {
    return NextResponse.json({ error: "Parámetro 'app' requerido" }, { status: 400 });
  }

  // 3. Pedir launch token al FastAPI
  try {
    const res = await fetch(`${AUTH_API}/auth/sso-launch`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ session_id: sessionId, app_id: app }),
      signal:  AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err?.detail ?? "Error al generar acceso" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ redirect_url: data.redirect_url });
  } catch {
    return NextResponse.json(
      { error: "No se pudo conectar con HidroSSO backend" },
      { status: 503 }
    );
  }
}
