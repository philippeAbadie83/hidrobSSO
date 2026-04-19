/**
 * Middleware de autenticación — protege todas las rutas excepto login
 * Se ejecuta en el Edge Runtime (rápido, antes de renderizar)
 */
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Verificar dominio si el usuario está autenticado
    if (token?.email) {
      const domain = (token.email as string).split("@")[1]?.toLowerCase();
      const allowedDomains = ["hidrobart.com", "hidrobart.com.mx", "hidrobart.com.br"];

      if (!allowedDomains.includes(domain)) {
        const loginUrl = new URL("/auth/error?error=AccessDenied", req.url);
        return NextResponse.redirect(loginUrl);
      }
    }

    // Respuesta normal
    const response = NextResponse.next();

    // Headers de seguridad
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );

    return response;
  },
  {
    callbacks: {
      authorized({ token }) {
        return !!token;
      },
    },
  }
);

// Rutas que requieren autenticación
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/api/protected/:path*",
    // Excluir rutas públicas:
    // /login, /auth/*, /api/auth/*, /_next/*, /favicon.svg
  ],
};
