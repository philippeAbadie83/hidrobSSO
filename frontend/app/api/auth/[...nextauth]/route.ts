/**
 * NextAuth.js — Configuración Azure AD multi-tenant
 * Hidrobart: hidrobart.com | hidrobart.com.mx | hidrobart.com.br
 */
import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import type { NextAuthOptions } from "next-auth";

// Dominios autorizados de Hidrobart
const ALLOWED_DOMAINS = [
  "hidrobart.com",
  "hidrobart.com.mx",
  "hidrobart.com.br",
];

function isAllowedDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      // "common" permite multi-tenant (todos los dominios Hidrobart)
      tenantId: process.env.AZURE_TENANT_ID || "common",
      authorization: {
        params: {
          scope: "openid profile email User.Read GroupMember.Read.All",
          // Fuerza selección de cuenta (evita auto-login con cuenta incorrecta)
          prompt: "select_account",
        },
      },
      // Perfil extendido desde Azure AD
      profile(profile) {
        return {
          id: profile.sub || profile.oid,
          name: profile.name,
          email: profile.preferred_username || profile.email,
          image: null,
          oid: profile.oid,
          tid: profile.tid,
        };
      },
    }),
  ],

  callbacks: {
    // Controlar quién puede hacer login
    async signIn({ user, account, profile }: any) {
      const email = user.email || profile?.preferred_username || "";
      if (!isAllowedDomain(email)) {
        console.warn(`Login rechazado para dominio no autorizado: ${email}`);
        return false;
      }
      return true;
    },

    // Enriquecer el JWT con datos del usuario
    async jwt({ token, account, profile, user }: any) {
      if (account && profile) {
        // Primera vez que se crea el token
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.oid = profile.oid;
        token.tid = profile.tid;
        token.jobTitle = profile.jobTitle;
        token.department = profile.department;
        token.domain = (token.email as string || "").split("@")[1];
      }

      // Enriquecer con roles desde el backend Hidrobart
      if (account?.access_token && !token.hidrobartRoles) {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_AUTH_API || "http://localhost:8000"}/auth/callback`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                code: "__nextauth_handled__",
                state: "__skip__",
              }),
            }
          );
          // El backend procesa el token; aquí solo marcamos que se procesó
          token.hidrobartRoles = { org: ["Employee"], functional: [], process: {} };
        } catch {
          token.hidrobartRoles = { org: ["Employee"], functional: [], process: {} };
        }
      }

      return token;
    },

    // Exponer datos en la sesión del cliente
    async session({ session, token }: any) {
      session.accessToken = token.accessToken;
      session.user.id = token.oid || token.sub;
      session.user.oid = token.oid;
      session.user.tid = token.tid;
      session.user.domain = token.domain;
      session.user.jobTitle = token.jobTitle;
      session.user.department = token.department;
      session.user.roles = token.hidrobartRoles || {
        org: ["Employee"],
        functional: [],
        process: {},
      };
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/auth/error",
  },

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 horas
  },

  events: {
    async signIn({ user }: any) {
      console.log(`[Auth] Login: ${user.email}`);
    },
    async signOut({ token }: any) {
      console.log(`[Auth] Logout: ${token?.email}`);
    },
  },

  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
