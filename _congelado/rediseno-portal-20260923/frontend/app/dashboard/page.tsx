"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2, Moon, Sun, Minimize2, Maximize2 } from "lucide-react";
import ALL_APPS from "@/data/apps.json";
import HexIcon, { IsotipoHex, type HexGlyph } from "../../components/HexIcon";
import { useTheme } from "../../components/ThemeProvider";

/**
 * Portal hidroBIntel — v2
 *
 * Reescrito sobre los design tokens (hidrobintel-tokens.css). No hay un solo
 * HEX literal en este archivo: todos los colores salen de variables CSS, así que
 * la pantalla responde al tema y a la densidad sin tocar componentes.
 */

const PATTERN = "https://hidrobartmedia.blob.core.windows.net/imgs/hbPatrones/patr%C3%B3n-1.png";

// ── Tipos ────────────────────────────────────────────────────────────────────
interface App {
  id: string;
  name: string;
  sub: string;
  desc: string;
  icon: HexGlyph;
  module: string;
  url: string;
  tag: string;
  ssoId: string | null;
  active: boolean;
  tier: "public" | "team" | "admin";
  roles?: string[];
  order: number;
}

// ── Visibilidad por tier ─────────────────────────────────────────────────────
// El tier sólo controla si SE VE la tarjeta; los permisos finos viven en cada app.
const ROLES_ADMIN = ["SuperAdmin", "Admin"];
const ROLES_TEAM = [
  "SuperAdmin", "Admin", "Manager",
  "Coordinador", "Operador", "Compras", "Vendedor", "CustomerSuccess", "Observador",
];

function canSee(app: App, orgRoles: string[]): boolean {
  if (app.roles && app.roles.length) return orgRoles.some((r) => app.roles!.includes(r));
  if (app.tier === "public") return true;
  if (app.tier === "team") return orgRoles.some((r) => ROLES_TEAM.includes(r));
  if (app.tier === "admin") return orgRoles.some((r) => ROLES_ADMIN.includes(r));
  return true;
}

// ── Color por módulo → token de la paleta de catálogo ────────────────────────
const MODULE_TOKEN: Record<string, string> = {
  naranja:  "var(--hbp-cat-orange)",
  amarillo: "var(--hbp-cat-yellow)",
  verde:    "var(--hbp-cat-green)",
  vino:     "var(--hbp-cat-wine)",
  lila:     "var(--hbp-cat-lila)",
  metal:    "var(--hbp-cat-metal)",
  gris:     "var(--hbp-cat-gray)",
  celeste:  "var(--hbp-celeste)",
  flow:     "var(--hbp-flow)",
};

const moduleColor = (m: string) => MODULE_TOKEN[m] ?? "var(--hbp-flow)";

// ── Badges de estado ─────────────────────────────────────────────────────────
const TAG_CLASS: Record<string, string> = {
  ACTUALIZADO: "hb-badge--ok",
  PROTOTIPO:   "hb-badge--warn",
  IDEA:        "hb-badge--neutral",
  NUEVO:       "hb-badge--info",
  PRIVADO:     "hb-badge--warn",
};

/** Las rutas internas de hidroBIntel se abren en la misma pestaña. */
const esInterna = (url: string) => url.startsWith("/");

// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { theme, density, toggleTheme, toggleDensity } = useTheme();
  const [launching, setLaunching] = useState<string | null>(null);
  const [ssoError, setSsoError] = useState<string | null>(null);

  // El saludo se calcula en el cliente para no desincronizar con el render del servidor
  const [greeting, setGreeting] = useState("Hola");
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches");
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status === "loading" || !session) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--hb-canvas)" }}
      >
        <div
          className="w-10 h-10 rounded-full animate-spin"
          style={{
            border: "2px solid var(--hb-border)",
            borderTopColor: "var(--hb-accent-solid)",
          }}
        />
        <span className="sr-only">Verificando sesión…</span>
      </div>
    );
  }

  const user = session.user as any;
  const orgRoles: string[] = user.roles?.org || [];
  const isAdmin = orgRoles.some((r) => ROLES_ADMIN.includes(r));
  const domain = user.domain || user.email?.split("@")[1];

  const CATALOG = ALL_APPS as unknown as App[];

  const APPS = CATALOG
    .filter((a) => a.active)
    .filter((a) => canSee(a, orgRoles))
    .sort((a, b) => a.order - b.order);

  const DEPRECATED = CATALOG.filter((a) => !a.active);

  async function handleSSOLaunch(appId: string, appName: string) {
    setLaunching(appId);
    setSsoError(null);
    try {
      const res = await fetch(`/api/sso-launch?app=${appId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSsoError(err?.error ?? `No se pudo abrir ${appName}`);
        return;
      }
      const { redirect_url } = await res.json();
      window.open(redirect_url, "_blank", "noopener,noreferrer");
    } catch {
      setSsoError(`Error de red al abrir ${appName}`);
    } finally {
      setLaunching(null);
    }
  }

  // ── Contenido de tarjeta ───────────────────────────────────────────────────
  function CardBody({ app, isLaunching }: { app: App; isLaunching: boolean }) {
    const color = moduleColor(app.module);
    const showTier = isAdmin && app.tier !== "public";
    return (
      <>
        <div className="flex items-start justify-between mb-3">
          {isLaunching ? (
            <span
              className="grid place-items-center"
              style={{ width: 40, height: 46, color: "var(--hb-accent)" }}
            >
              <Loader2 className="w-6 h-6 animate-spin" />
            </span>
          ) : (
            <HexIcon glyph={app.icon} color={color} size={46} />
          )}
          <div className="flex flex-wrap justify-end gap-1">
            {showTier && (
              <span className={`hb-badge ${app.tier === "admin" ? "hb-badge--error" : "hb-badge--info"}`}>
                {app.tier === "team" ? "TEAM" : "ADMIN"}
              </span>
            )}
            {app.ssoId && <span className="hb-badge hb-badge--neutral">SSO</span>}
          </div>
        </div>

        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--hb-text)" }}>{app.name}</p>
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--hb-text-muted)",
            marginTop: 2,
            marginBottom: 6,
          }}
        >
          {app.sub}
        </p>
        <p style={{ fontSize: 13, color: "var(--hb-text-secondary)", lineHeight: 1.55 }}>
          {app.desc}
        </p>

        {app.tag && (
          <span className={`hb-badge ${TAG_CLASS[app.tag] ?? "hb-badge--neutral"}`} style={{ marginTop: 12 }}>
            {app.tag}
          </span>
        )}
      </>
    );
  }

  const cardStyle: React.CSSProperties = {
    background: "var(--hb-surface)",
    border: "1px solid var(--hb-border)",
    borderRadius: "var(--hb-radius-lg)",
    padding: "var(--hb-card-pad)",
    boxShadow: "var(--hb-shadow-sm)",
    textAlign: "left",
    width: "100%",
    display: "block",
    textDecoration: "none",
    transition: "transform var(--hb-dur) var(--hb-ease), box-shadow var(--hb-dur) var(--hb-ease), border-color var(--hb-dur) var(--hb-ease)",
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "var(--hb-text-muted)",
    borderLeft: "3px solid var(--hbp-celeste)",
    paddingLeft: 12,
    marginBottom: 20,
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--hb-canvas)" }}>

      {/* ══ CABECERA ═══════════════════════════════════════════════════════ */}
      <header
        style={{
          background: "var(--hb-rail-bg)",
          position: "relative",
          overflow: "hidden",
          paddingBottom: "var(--hb-s6)",
          boxShadow: "var(--hb-shadow)",
        }}
      >
        {/* Patrón hexagonal de marca */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage: `url('${PATTERN}')`,
            backgroundSize: "260px",
            backgroundRepeat: "repeat",
            opacity: 0.05,
          }}
        />

        {/* Topbar */}
        <div
          className="relative z-10 flex items-center gap-3 flex-wrap"
          style={{
            minHeight: "var(--hbc-topbar-h)",
            padding: "10px clamp(16px, 4vw, 32px)",
            borderBottom: "1px solid var(--hb-rail-border)",
          }}
        >
          {/* Marca */}
          <div className="flex items-center gap-3 mr-auto">
            <IsotipoHex size={34} />
            <span
              style={{
                color: "var(--hb-text-on-inverse)",
                fontWeight: 800,
                fontSize: 17,
                letterSpacing: "0.02em",
              }}
            >
              hidro<span style={{ color: "var(--hbp-celeste)" }}>BI</span>ntel
            </span>
          </div>

          {/* Preferencias de vista */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              className="grid place-items-center rounded-lg transition-colors"
              style={{
                width: 34,
                height: 34,
                color: "var(--hb-rail-fg)",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid var(--hb-rail-border)",
              }}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleDensity}
              title={density === "compact" ? "Vista cómoda" : "Vista compacta"}
              aria-label={density === "compact" ? "Cambiar a vista cómoda" : "Cambiar a vista compacta"}
              className="grid place-items-center rounded-lg transition-colors"
              style={{
                width: 34,
                height: 34,
                color: "var(--hb-rail-fg)",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid var(--hb-rail-border)",
              }}
            >
              {density === "compact" ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Roles */}
          <div className="hidden md:flex items-center gap-1.5">
            {orgRoles.map((role) => (
              <span
                key={role}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "3px 9px",
                  borderRadius: "var(--hb-radius-pill)",
                  color: ROLES_ADMIN.includes(role) ? "var(--hbp-cat-yellow)" : "var(--hbp-celeste)",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid var(--hb-rail-border)",
                }}
              >
                {role}
              </span>
            ))}
          </div>

          {/* Usuario + salir */}
          <div className="flex items-center gap-2">
            <span
              className="hidden sm:block"
              style={{ color: "var(--hb-text-on-inverse)", fontSize: 13, fontWeight: 600 }}
            >
              {user.name?.split(" ")[0]}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-1.5 rounded-lg transition-colors"
              style={{
                padding: "7px 12px",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--hb-rail-fg)",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid var(--hb-rail-border)",
              }}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>

        {/* Bienvenida */}
        <div
          className="relative z-10 flex items-baseline gap-2.5 flex-wrap"
          style={{ padding: "16px clamp(16px, 4vw, 32px) 0" }}
        >
          <p style={{ color: "var(--hbp-celeste)", fontSize: 15, fontWeight: 600 }}>{greeting},</p>
          <h1
            style={{
              color: "var(--hb-text-on-inverse)",
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "-0.01em",
            }}
          >
            {user.name?.split(" ")[0]}
          </h1>
          <span style={{ color: "var(--hb-text-inverse-muted)", fontSize: 13 }}>· @{domain}</span>
        </div>
      </header>

      {/* ══ CONTENIDO ══════════════════════════════════════════════════════ */}
      <main style={{ padding: "var(--hb-s8) clamp(16px, 4vw, 32px) var(--hb-s12)" }}>

        {ssoError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-4"
            style={{
              marginBottom: "var(--hb-s5)",
              padding: "var(--hb-s4)",
              borderRadius: "var(--hb-radius)",
              background: "var(--hb-error-bg)",
              border: "1px solid var(--hb-error)",
              color: "var(--hb-error)",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <span>{ssoError}</span>
            <button onClick={() => setSsoError(null)} aria-label="Cerrar aviso" className="opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        <p style={sectionLabel}>Sistemas activos</p>

        <div
          className="grid gap-3.5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", marginBottom: "var(--hb-s8)" }}
        >
          {APPS.map((app) => {
            const isLaunching = launching === app.ssoId;
            const color = moduleColor(app.module);
            const onHover = (e: React.MouseEvent<HTMLElement>, on: boolean) => {
              const el = e.currentTarget;
              el.style.transform = on ? "translateY(-3px)" : "";
              el.style.boxShadow = on ? "var(--hb-shadow)" : "var(--hb-shadow-sm)";
              el.style.borderColor = on ? color : "var(--hb-border)";
            };

            if (app.ssoId) {
              return (
                <button
                  key={app.id}
                  onClick={() => handleSSOLaunch(app.ssoId!, app.name)}
                  disabled={!!launching}
                  style={{ ...cardStyle, cursor: launching ? "not-allowed" : "pointer", opacity: launching && !isLaunching ? 0.6 : 1 }}
                  onMouseEnter={(e) => onHover(e, true)}
                  onMouseLeave={(e) => onHover(e, false)}
                >
                  <CardBody app={app} isLaunching={isLaunching} />
                </button>
              );
            }
            return (
              <a
                key={app.id}
                href={app.url}
                target={!esInterna(app.url) && app.url !== "#" ? "_blank" : undefined}
                rel={esInterna(app.url) ? undefined : "noreferrer"}
                style={{ ...cardStyle, cursor: "pointer" }}
                onMouseEnter={(e) => onHover(e, true)}
                onMouseLeave={(e) => onHover(e, false)}
              >
                <CardBody app={app} isLaunching={false} />
              </a>
            );
          })}
        </div>

        {isAdmin && (
          <div
            className="flex items-center gap-2.5"
            style={{
              padding: "12px 16px",
              borderRadius: "var(--hb-radius)",
              marginBottom: "var(--hb-s8)",
              fontSize: 12,
              fontWeight: 600,
              background: "var(--hb-accent-subtle)",
              border: "1px solid var(--hb-accent-border)",
              color: "var(--hb-accent)",
            }}
          >
            Vista SuperAdmin — ves todas las apps, incluidas las marcadas TEAM y ADMIN
          </div>
        )}

        {DEPRECATED.length > 0 && (
          <>
            <p style={{ ...sectionLabel, borderLeftColor: "var(--hb-border-strong)" }}>
              Legado / Deprecado
            </p>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
              {DEPRECATED.map((app) => (
                <div key={app.id} style={{ ...cardStyle, opacity: 0.45, cursor: "not-allowed" }}>
                  <div className="mb-3">
                    <HexIcon glyph={app.icon} color="var(--hb-text-muted)" size={46} />
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--hb-text)" }}>{app.name}</p>
                  <p style={{ fontSize: 11, color: "var(--hb-text-muted)", marginTop: 2 }}>{app.sub}</p>
                  <p style={{ fontSize: 12, color: "var(--hb-text-muted)", marginTop: 6 }}>{app.desc}</p>
                  <span className="hb-badge hb-badge--neutral" style={{ marginTop: 12 }}>
                    DEPRECATED
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
