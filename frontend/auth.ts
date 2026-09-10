import NextAuth from "next-auth";
import { headers } from "next/headers";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
const ALLOWED_DOMAINS = ["hidrobart.com", "hidrobart.com.mx", "hidrobart.com.br"];
const AUTH_API = process.env.NEXT_PUBLIC_AUTH_API ?? "http://localhost:8000";
/**
 * La IP y el navegador de quien esta entrando, para reenviarselos al backend.
 * Sin esto la bitacora registra a todo mundo entrando desde 127.0.0.1, que es
 * nginx, y deja de servir para auditar.
 * Devuelve {} si se llama fuera del contexto de una peticion.
 */
export async function cabecerasDelVisitante(): Promise<Record<string, string>> {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "";
    const ua = h.get("user-agent") ?? "";
    const out: Record<string, string> = {};
    if (ip) out["X-Forwarded-For"] = ip;
    if (ua) out["X-Client-User-Agent"] = ua;
    return out;
  } catch {
    return {};
  }
}

function isAllowedDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`,
      authorization: {
        params: { scope: "openid profile email User.Read GroupMember.Read.All" },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }: any) {
      return isAllowedDomain(user.email || "");
    },
    async jwt({ token, account, profile }: any) {
      const msToken = account?.access_token;
      if (account && profile) {
        token.oid = profile.oid;
        token.tid = profile.tid;
        token.domain = (profile.preferred_username || profile.email || "").split("@")[1];
      }
      if (msToken && !token.hidrobartSessionId) {
        try {
          // ms-login se llama de servidor a servidor, asi que el backend solo
          // veria 127.0.0.1. Se le reenvia la IP y el navegador REALES del
          // visitante para que la bitacora sirva de algo.
          const cab = await cabecerasDelVisitante();
          const res = await fetch(`${AUTH_API}/auth/ms-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...cab },
            body: JSON.stringify({ access_token: msToken }),
          });
          if (res.ok) {
            const data = await res.json();
            token.hidrobartSessionId = data.session_id;
            token.hidrobartRoles = data.roles;
            if (data.name) token.name = data.name;
          } else {
            token.hidrobartRoles = { org: ["Employee"], functional: [], process: {} };
          }
        } catch {
          token.hidrobartRoles = { org: ["Employee"], functional: [], process: {} };
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      session.user.id = token.oid || token.sub;
      session.user.oid = token.oid;
      session.user.tid = token.tid;
      session.user.domain = token.domain;
      session.user.roles = token.hidrobartRoles ?? { org: ["Employee"], functional: [], process: {} };
      (session as any).hidrobartSessionId = token.hidrobartSessionId;
      return session;
    },
  },
  pages: { signIn: "/login", error: "/auth/error" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
});

