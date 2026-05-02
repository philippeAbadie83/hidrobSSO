/**
 * /auth/sso — Costeo360
 *
 * Server component de entrada al flujo SSO desde HidroSSO.
 * Recibe el launch token (?lt=...) y redirige inmediatamente a la
 * API Route que hace el intercambio y setea la cookie.
 *
 * No hay estado cliente ni JavaScript — redirección pura en servidor.
 */
import { redirect } from "next/navigation";

interface SsoPageProps {
  searchParams: Promise<{ lt?: string }>;
}

export default async function SsoPage({ searchParams }: SsoPageProps) {
  const { lt } = await searchParams;

  if (!lt || !lt.startsWith("lt_")) {
    // Token ausente o malformado → login con mensaje de error
    redirect("/login?error=sso_token_invalido");
  }

  // Delegar a la API Route que hace el intercambio server-to-server
  redirect(`/api/sso-entry?lt=${encodeURIComponent(lt)}`);
}
