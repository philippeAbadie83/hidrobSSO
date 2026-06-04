import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
const ALLOWED_DOMAINS = ["hidrobart.com", "hidrobart.com.mx", "hidrobart.com.br"];
const AUTH_API = process.env.NEXT_PUBLIC_AUTH_API ?? "http://localhost:8000";
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
          const res = await fetch(`${AUTH_API}/auth/ms-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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

