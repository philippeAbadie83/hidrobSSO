/**
 * Middleware de autenticación — next-auth v5 (Auth.js)
 */
import { auth } from "./auth";
import { NextResponse } from "next/server";

const ALLOWED_DOMAINS = ["hidrobart.com", "hidrobart.com.mx", "hidrobart.com.br"];

export default auth((req) => {
  const token = req.auth;

  // No autenticado → al login
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Verificar dominio permitido
  const email = token.user?.email;
  if (email) {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!ALLOWED_DOMAINS.includes(domain)) {
      return NextResponse.redirect(
        new URL("/auth/error?error=AccessDenied", req.url)
      );
    }
  }

  // Headers de seguridad
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );

  return response;
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/api/protected/:path*",
  ],
};

