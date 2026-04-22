"use client";
import { useState, useMemo }        from "react";
import { useSession, signOut }      from "next-auth/react";
import { useRouter }                from "next/navigation";
import { useEffect }                from "react";
import Image                        from "next/image";
import { LogOut, Loader2 }          from "lucide-react";
import { Montserrat }               from "next/font/google";
import ALL_APPS                     from "@/data/apps.json";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["400","500","600","700","800"] });

const LOGO    = "https://hidrobartmedia.blob.core.windows.net/imgs/logos/imagotipo_blanco-01.png";
const PATTERN = "https://hidrobartmedia.blob.core.windows.net/imgs/hbPatrones/patr%C3%B3n-1.png";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface App {
  id:     string;
  name:   string;
  sub:    string;
  desc:   string;
  icon:   string;
  url:    string;
  tag:    string;
  ssoId:  string | null;
  active: boolean;
  tier:   "public" | "team" | "admin";
  order:  number;
}

// ── Visibilidad por tier ───────────────────────────────────────────────────────
function canSee(app: App, orgRoles: string[]): boolean {
  if (app.tier === "public") return true;
  if (app.tier === "team")   return orgRoles.some(r => ["Manager","Admin","SuperAdmin"].includes(r));
  if (app.tier === "admin")  return orgRoles.some(r => ["Admin","SuperAdmin"].includes(r));
  return true;
}

// ── Colores de íconos — paleta HB ─────────────────────────────────────────────
const ICON_GRADIENT: Record<string, string> = {
  hidrosso:  "linear-gradient(135deg, #13294B 0%, #2C5697 100%)",
  cortex:    "linear-gradient(135deg, #3A5DAE 0%, #13294B 100%)",
  superset:  "linear-gradient(135deg, #0072CE 0%, #3A5DAE 100%)",
  unidum:    "linear-gradient(135deg, #6CACE4 0%, #3A5DAE 100%)",
  costeo:    "linear-gradient(135deg, #2C5697 0%, #0072CE 100%)",
  crm2:      "linear-gradient(135deg, #0072CE 0%, #13294B 100%)",
  crm1:      "linear-gradient(135deg, #3A5DAE 0%, #6CACE4 100%)",
  hidroplus: "linear-gradient(135deg, #6CACE4 0%, #2C5697 100%)",
};

// ── Estilos de badges ─────────────────────────────────────────────────────────
const TAG_STYLES: Record<string, string> = {
  ACTUALIZADO: "bg-green-50 text-green-700 border-green-200",
  PROTOTIPO:   "bg-yellow-50 text-yellow-700 border-yellow-200",
  IDEA:        "bg-purple-50 text-purple-700 border-purple-200",
  NUEVO:       "bg-blue-50 text-blue-700 border-blue-200",
};

const TIER_BADGE: Record<string, string> = {
  team:  "bg-sky-50 text-[#3A5DAE] border-sky-200",
  admin: "bg-red-50 text-red-600 border-red-200",
};

const ROLE_COLORS: Record<string, string> = {
  SuperAdmin: "bg-red-500/20 text-red-300 border-red-400/40",
  Admin:      "bg-orange-500/20 text-orange-300 border-orange-400/40",
  Manager:    "bg-yellow-500/20 text-yellow-300 border-yellow-400/40",
  Employee:   "bg-blue-500/20 text-blue-300 border-blue-400/40",
  External:   "bg-gray-500/20 text-gray-300 border-gray-400/40",
};

// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard2Page() {
  const { data: session, status } = useSession();
  const router                    = useRouter();
  const [launching, setLaunching] = useState<string | null>(null);
  const [ssoError,  setSsoError]  = useState<string | null>(null);

  // Saludo según hora
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#13294B" }}>
        <div className="w-10 h-10 border-2 border-white/20 border-t-[#6CACE4] rounded-full animate-spin" />
      </div>
    );
  }

  const user      = session.user as any;
  const orgRoles: string[] = user.roles?.org || [];
  const isAdmin   = orgRoles.some(r => ["Admin","SuperAdmin"].includes(r));
  const domain    = user.domain || user.email?.split("@")[1];

  const APPS       = (ALL_APPS as App[])
    .filter(app => app.active)
    .filter(app => canSee(app, orgRoles))
    .sort((a, b) => a.order - b.order);

  const DEPRECATED = (ALL_APPS as App[]).filter(app => !app.active);

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

  // ── Card content reutilizable ─────────────────────────────────────────────
  function CardContent({ app, isLaunching }: { app: App; isLaunching: boolean }) {
    const showTier = isAdmin && app.tier !== "public";
    return (
      <>
        {/* Ícono + badges */}
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-md flex-shrink-0"
            style={{ background: ICON_GRADIENT[app.id] ?? ICON_GRADIENT.hidrosso }}
          >
            {isLaunching ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : app.icon}
          </div>
          <div className="flex flex-wrap justify-end gap-1 ml-2 mt-0.5">
            {showTier && (
              <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${TIER_BADGE[app.tier]}`}>
                {app.tier === "team" ? "TEAM" : "ADMIN"}
              </span>
            )}
            {app.ssoId && (
              <span className="text-[10px] px-2 py-0.5 rounded border font-bold bg-[#eff6ff] text-[#0072CE] border-blue-200">
                SSO
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <p className="text-[15px] font-bold text-[#13294B] mb-0.5">{app.name}</p>
        <p className="text-[11px] font-semibold text-slate-500 mb-1.5">{app.sub}</p>
        <p className="text-[13px] font-medium text-slate-600 leading-relaxed">{app.desc}</p>

        {app.tag && (
          <span className={`inline-block mt-3 text-[10px] px-2 py-0.5 rounded border font-bold ${TAG_STYLES[app.tag] ?? ""}`}>
            {app.tag}
          </span>
        )}
      </>
    );
  }

  return (
    <div className={montserrat.className} style={{ minHeight: "100vh", background: "#c8d5e8" }}>

      {/* ══ HEADER ZONE ══════════════════════════════════════════════════════ */}
      <div
        style={{
          background:   "linear-gradient(180deg, #13294B 0%, #1a3a6b 100%)",
          boxShadow:    "0 6px 24px rgba(19,41,75,0.45)",
          position:     "relative",
          overflow:     "hidden",
          paddingBottom: "24px",
        }}
      >
        {/* Patrón hexagonal */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `url('${PATTERN}')`,
          backgroundSize: "260px", backgroundRepeat: "repeat",
          opacity: 0.05,
        }} />

        {/* Topbar */}
        <div className="relative z-10 flex items-center justify-between px-8 h-16 border-b border-white/[0.08]">

          {/* Marca */}
          <div className="flex items-center gap-3.5">
            <Image src={LOGO} alt="Hidrobart" width={120} height={30} className="object-contain" unoptimized priority />
            <div className="w-px h-5 bg-white/20" />
            <span className="text-white font-extrabold text-lg tracking-wide uppercase">
              hidro<span style={{ color: "#6CACE4" }}>BI</span>ntel
            </span>
          </div>

          {/* Usuario + roles + salir */}
          <div className="flex items-center gap-2.5">
            <span className="text-white text-sm font-semibold mr-1 hidden sm:block">
              {user.name?.split(" ")[0]}
            </span>
            {orgRoles.map(role => (
              <span key={role} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${ROLE_COLORS[role] ?? ROLE_COLORS.Employee}`}>
                🛡 {role}
              </span>
            ))}
            <div className="w-px h-4 bg-white/20 mx-1" />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/60 hover:text-white text-xs font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>

        {/* Bienvenida — una sola línea compacta */}
        <div className="relative z-10 flex items-baseline gap-2.5 flex-wrap px-8 pt-4">
          <p className="text-base font-semibold" style={{ color: "#6CACE4" }}>
            {greeting},
          </p>
          <h1 className="text-xl font-extrabold text-white tracking-tight">
            {user.name?.split(" ")[0]} 👋
          </h1>
          <span className="text-white/25 text-sm">·</span>
          <span className="text-white/40 text-sm font-medium">@{domain}</span>
        </div>
      </div>

      {/* ══ CONTENT ZONE ═════════════════════════════════════════════════════ */}
      <main className="px-8 pt-8 pb-12">

        {/* Error SSO */}
        {ssoError && (
          <div className="mb-5 p-4 rounded-xl text-sm flex items-center justify-between"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#dc2626" }}>
            <span>⚠️ {ssoError}</span>
            <button onClick={() => setSsoError(null)} className="ml-4 opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Label sección */}
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-5 pl-3 text-[#13294B]/70"
          style={{ borderLeft: "3px solid #6CACE4" }}>
          Sistemas activos
        </p>

        {/* Grid de apps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 mb-8">
          {APPS.map(app => {
            const isLaunching = launching === app.ssoId;
            const baseCard = "bg-white rounded-2xl p-5 transition-all duration-200 cursor-pointer block text-left w-full";
            const hoverCard = "hover:-translate-y-0.5 hover:shadow-xl hover:border-[#3A5DAE]";
            const cardStyle = {
              border:    "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(19,41,75,0.08), 0 1px 2px rgba(19,41,75,0.05)",
            };

            if (app.ssoId) {
              return (
                <button
                  key={app.id}
                  onClick={() => handleSSOLaunch(app.ssoId!, app.name)}
                  disabled={!!launching}
                  className={`${baseCard} ${hoverCard} disabled:opacity-60 disabled:cursor-not-allowed`}
                  style={cardStyle}
                >
                  <CardContent app={app} isLaunching={isLaunching} />
                </button>
              );
            }
            return (
              <a
                key={app.id}
                href={app.url}
                target={app.url !== "#" ? "_blank" : undefined}
                rel="noreferrer"
                className={`${baseCard} ${hoverCard}`}
                style={{ ...cardStyle, textDecoration: "none" }}
              >
                <CardContent app={app} isLaunching={false} />
              </a>
            );
          })}
        </div>

        {/* Nota admin — solo visible para admins */}
        {isAdmin && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl mb-8 text-xs font-semibold"
            style={{ background: "rgba(19,41,75,0.07)", border: "1px solid rgba(19,41,75,0.12)", color: "#3A5DAE" }}>
            <span>👁</span>
            <span>Vista SuperAdmin — ves todas las apps incluyendo las marcadas TEAM y ADMIN</span>
          </div>
        )}

        {/* Legado */}
        {DEPRECATED.length > 0 && (
          <>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-4 pl-3 text-[#13294B]/40"
              style={{ borderLeft: "3px solid #94a3b8" }}>
              Legado / Deprecado
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {DEPRECATED.map(app => (
                <div key={app.id} className="bg-white rounded-2xl p-5 opacity-40 cursor-not-allowed"
                  style={{ border: "1px solid #e2e8f0" }}>
                  <div className="w-12 h-12 rounded-xl bg-slate-400 flex items-center justify-center text-2xl mb-3">
                    {app.icon}
                  </div>
                  <p className="text-sm font-bold text-[#13294B] mb-0.5">{app.name}</p>
                  <p className="text-[11px] text-slate-400 mb-1.5">{app.sub}</p>
                  <p className="text-xs text-slate-400">{app.desc}</p>
                  <span className="inline-block mt-3 text-[10px] px-2 py-0.5 rounded border font-bold bg-slate-50 text-slate-400 border-slate-200">
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
