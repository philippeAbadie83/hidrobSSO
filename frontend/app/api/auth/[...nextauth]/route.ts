/**
 * NextAuth.js — Configuración Azure AD
 * Hidrobart: hidrobart.com | hidrobart.com.mx | hidrobart.com.br
 */
import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import type { NextAuthOptions } from "next-auth";

const ALLOWED_DOMAINS = ["hidrobart.com", "hidrobart.com.mx", "hidrobart.com.br"];
const AUTH_API        = process.env.NEXT_PUBLIC_AUTH_API ?? "http://localhost:8000";

function isAllowedDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId:     process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      tenantId:     process.env.AZURE_TENANT_ID || "common",
      authorization: {
        params: {
          scope:  "openid profile email User.Read GroupMember.Read.All",
          prompt: "select_account",
        },
      },
      profile(profile) {
        return {
          id:    profile.sub || profile.oid,
          name:  profile.name,
          email: profile.preferred_username || profile.email,
          image: null,
          oid:   profile.oid,
          tid:   profile.tid,
        };
      },
    }),
  ],

  callbacks: {
    async signIn({ user }: any) {
      const email = user.email || "";
      if (!isAllowedDomain(email)) {
        console.warn(`[Auth] Login rechazado: ${email}`);
        return false;
      }
      return true;
    },

    async jwt({ token, account, profile }: any) {
      // Primera autenticación: llega account + profile
      if (account && profile) {
        token.accessToken  = account.access_token;
        token.refreshToken = account.refresh_token;
        token.oid          = profile.oid;
        token.tid          = profile.tid;
        token.jobTitle     = profile.jobTitle;
        token.department   = profile.department;
        token.domain       = (profile.preferred_username || profile.email || "").split("@")[1];
      }

      // Crear sesión Hidrobart en Redis (solo la primera vez)
      if (account?.access_token && !token.hidrobartSessionId) {
        try {
          const res = await fetch(`${AUTH_API}/auth/ms-login`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ access_token: account.access_token }),
          });
          if (res.ok) {
            const data             = await res.json();
            token.hidrobartSessionId = data.session_id;   // ← NUNCA exponer al cliente
            token.hidrobartRoles     = data.roles;
            // Actualizar nombre con el que viene del Graph
            if (data.name) token.name = data.name;
          } else {
            const txt = await res.text();
            console.error(`[Auth] ms-login ${res.status}: ${txt}`);
            token.hidrobartRoles = { org: ["Employee"], functional: [], process: {} };
          }
        } catch (e) {
          console.error("[Auth] ms-login error:", e);
          token.hidrobartRoles = { org: ["Employee"], functional: [], process: {} };
        }
      }

      return token;
    },

    async session({ session, token }: any) {
      session.accessToken      = token.accessToken;
      session.user.id          = token.oid || token.sub;
      session.user.oid         = token.oid;
      session.user.tid         = token.tid;
      session.user.domain      = token.domain;
      session.user.jobTitle    = token.jobTitle;
      session.user.department  = token.department;
      session.user.roles       = token.hidrobartRoles ?? { org: ["Employee"], functional: [], process: {} };
      // hidrobartSessionId NO se expone al cliente — solo lo lee el servidor via getToken()
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error:  "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge:   8 * 60 * 60,
  },
  events: {
    async signIn({ user }: any) { console.log(`[Auth] Login:  ${user.email}`); },
    async signOut({ token }: any) { console.log(`[Auth] Logout: ${token?.email}`); },
  },
  debug:  process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
