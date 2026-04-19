/**
 * Hidrobart Auth SDK — TypeScript/Next.js
 * Copiar este archivo a cualquier app Next.js para integrarse con el login centralizado.
 *
 * USO:
 *   import { createHidrobartAuth } from '@/lib/hidrobart-auth'
 *   const auth = createHidrobartAuth({ authApiUrl: process.env.AUTH_API_URL })
 *   const result = await auth.validateToken(token)
 */

export interface HidrobartRoles {
  org: string[];
  functional: string[];
  process: Record<string, string[]>;
  tenant?: string;
}

export interface HidrobartUser {
  id: string;
  email: string;
  name: string;
  display_name?: string;
  job_title?: string;
  department?: string;
  tenant: string;
  domain: string;
  roles: HidrobartRoles;
}

export interface ValidateResult {
  valid: boolean;
  user?: HidrobartUser;
  roles?: HidrobartRoles;
  error?: string;
}

export interface AuthConfig {
  authApiUrl: string;
  loginUrl?: string;
  timeoutMs?: number;
}

export class HidrobartAuth {
  private config: Required<AuthConfig>;

  constructor(config: AuthConfig) {
    this.config = {
      authApiUrl: config.authApiUrl.replace(/\/$/, ""),
      loginUrl: config.loginUrl || "https://login.hidrobart.com",
      timeoutMs: config.timeoutMs || 5000,
    };
  }

  /**
   * Valida un token contra el servicio centralizado.
   * Llamar en cada request protegido.
   */
  async validateToken(token: string): Promise<ValidateResult> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const res = await fetch(`${this.config.authApiUrl}/auth/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        return { valid: false, error: `Auth service error: ${res.status}` };
      }

      return await res.json();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { valid: false, error: "Auth service timeout" };
      }
      return { valid: false, error: "Auth service unreachable" };
    }
  }

  /**
   * Obtiene perfil del usuario usando su access token.
   */
  async getMe(token: string): Promise<HidrobartUser | null> {
    try {
      const res = await fetch(`${this.config.authApiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Verifica permiso específico.
   * Ejemplo: auth.hasPermission(roles, "hidroplus", "aprobar")
   */
  hasPermission(roles: HidrobartRoles, module: string, permission: string): boolean {
    const perms = roles.process?.[module] || [];
    return perms.includes(permission);
  }

  isAdmin(roles: HidrobartRoles): boolean {
    return roles.org.includes("SuperAdmin") || roles.org.includes("Admin");
  }

  isManager(roles: HidrobartRoles): boolean {
    return ["SuperAdmin", "Admin", "Manager"].some((r) => roles.org.includes(r));
  }

  /**
   * URL a la que redirigir para login (con return URL).
   */
  getLoginUrl(returnTo?: string): string {
    const base = this.config.loginUrl;
    if (returnTo) {
      return `${base}/login?callbackUrl=${encodeURIComponent(returnTo)}`;
    }
    return `${base}/login`;
  }
}

export function createHidrobartAuth(config: AuthConfig): HidrobartAuth {
  return new HidrobartAuth(config);
}

// ── Helper para Next.js middleware ───────────────────────────────────────────

/**
 * Ejemplo de uso en middleware.ts de una app protegida:
 *
 * import { validateHidrobartSession } from '@/lib/hidrobart-auth'
 *
 * export async function middleware(request: NextRequest) {
 *   const token = request.cookies.get('hidrobart-token')?.value
 *     || request.headers.get('authorization')?.replace('Bearer ', '')
 *
 *   if (!token) {
 *     return NextResponse.redirect(new URL('/login', AUTH_URL))
 *   }
 *
 *   const result = await validateHidrobartSession(token)
 *   if (!result.valid) {
 *     return NextResponse.redirect(new URL('/login', AUTH_URL))
 *   }
 *
 *   // Pasar info del usuario a los headers
 *   const response = NextResponse.next()
 *   response.headers.set('x-user-id', result.user?.id || '')
 *   response.headers.set('x-user-email', result.user?.email || '')
 *   return response
 * }
 */
export async function validateHidrobartSession(
  token: string,
  authApiUrl?: string
): Promise<ValidateResult> {
  const url = authApiUrl || process.env.AUTH_API_URL || "http://localhost:8000";
  const auth = createHidrobartAuth({ authApiUrl: url });
  return auth.validateToken(token);
}
