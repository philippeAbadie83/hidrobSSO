"use client";
import { useState }                  from "react";
import { useSession, signOut }       from "next-auth/react";
import { useRouter }                 from "next/navigation";
import { useEffect }                 from "react";
import Image                         from "next/image";
import { LogOut, Loader2 }           from "lucide-react";

const LOGO = "https://hidrobartmedia.blob.core.windows.net/imgs/logos/imagotipo_blanco-01.png";

// ssoId = app_id que espera el backend en /auth/sso-launch
const APPS = [
  { id: "hidrosso",  name: "HidroSSO",               sub: "hidrosso.hidrobart.com",   desc: "Login institucional unificado MS365", icon: "🔐", color: "from-blue-700 to-blue-950",     url: "https://hidrosso.hidrobart.com",  tag: "",            ssoId: null       },
  { id: "cortex",    name: "Cortex",                  sub: "cortex.hidrobart.com",     desc: "Agentes IA · LibreChat",              icon: "🤖", color: "from-violet-600 to-violet-900", url: "https://cortex.hidrobart.com",    tag: "",            ssoId: null       },
  { id: "superset",  name: "Dashboard Institucional", sub: "superset",                 desc: "Business Intelligence · Superset",    icon: "📊", color: "from-orange-600 to-orange-900", url: "#",                               tag: "",            ssoId: null       },
  { id: "unidum",    name: "UNIDUM Planificador",     sub: "unidum.hidrobart.com",     desc: "Planificador Hidrobart",              icon: "📅", color: "from-cyan-600 to-cyan-900",     url: "#",                               tag: "PROTOTIPO",   ssoId: null       },
  { id: "costeo",    name: "Costeo360",               sub: "costeo360.hidrobart.com",  desc: "Costeo Hidrobart",                    icon: "💰", color: "from-green-600 to-green-900",   url: "https://costeo360.hidrobart.com", tag: "ACTUALIZADO", ssoId: "costeo360" },
  { id: "crm1",      name: "CRM Pipeline",            sub: "crm.hidrobart.com",        desc: "CRM Pipeline — Hidrobart Idea",       icon: "🔗", color: "from-blue-600 to-blue-900",     url: "#",                               tag: "IDEA",        ssoId: null       },
  { id: "crm2",      name: "CRM Hidrobart",           sub: "crm-hidrobart.com",        desc: "CRM Nuevo",                           icon: "🤝", color: "from-sky-600 to-sky-900",       url: "#",                               tag: "NUEVO",       ssoId: null       },
];

const DEPRECATED = [
  { id: "hidroplus", name: "HIDRO+", sub: "hidroplus (antiguo)", desc: "Sistema legacy — en proceso de retiro", icon: "💧" },
];

const TAG_STYLES: Record<string, string> = {
  ACTUALIZADO: "bg-green-500/20 text-green-300 border-green-500/30",
  PROTOTIPO:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  IDEA:        "bg-purple-500/20 text-purple-300 border-purple-500/30",
  NUEVO:       "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

const ROLE_COLORS: Record<string, string> = {
  SuperAdmin: "bg-red-500/20 text-red-300 border-red-400/30",
  Admin:      "bg-orange-500/20 text-orange-300 border-orange-400/30",
  Manager:    "bg-yellow-500/20 text-yellow-300 border-yellow-400/30",
  Employee:   "bg-blue-500/20 text-blue-300 border-blue-400/30",
  External:   "bg-gray-500/20 text-gray-300 border-gray-400/30",
};

function getInitials(name: string) {
  return name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() || "HB";
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router                    = useRouter();
  const [launching, setLaunching] = useState<string | null>(null);
  const [ssoError,  setSsoError]  = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  const user     = session.user as any;
  const orgRoles: string[] = user.roles?.org || [];

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-blue-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Image src={LOGO} alt="Hidrobart" width={120} height={30} className="object-contain" unoptimized priority />
              <div className="w-px h-5 bg-white/20" />
              <span className="text-white/50 text-sm font-semibold tracking-wide">hidroBIntel</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-white text-sm font-medium leading-none">{user.name?.split(" ")[0]}</p>
                <p className="text-white/40 text-xs">{user.email}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                {getInitials(user.name || "")}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 hover:text-white text-sm transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Bienvenida */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Bienvenido, {user.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-cyan-400 font-mono text-sm mt-1">
            @{user.domain || user.email?.split("@")[1]}
          </p>
        </div>

        {/* Error SSO */}
        {ssoError && (
          <div className="mb-4 p-4 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-sm flex items-center justify-between">
            <span>⚠️ {ssoError}</span>
            <button onClick={() => setSsoError(null)} className="ml-4 text-red-400 hover:text-red-200">✕</button>
          </div>
        )}

        {/* Perfil + roles */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/50 border border-white/20 flex items-center justify-center text-white text-xl font-bold">
              {getInitials(user.name || "")}
            </div>
            <div>
              <p className="text-white font-semibold">{user.name}</p>
              <p className="text-white/40 text-sm">{user.email}</p>
            </div>
          </div>
          <div className="sm:ml-auto flex flex-wrap gap-2">
            {orgRoles.map((role) => (
              <span key={role} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${ROLE_COLORS[role] || ROLE_COLORS.Employee}`}>
                🛡 {role}
              </span>
            ))}
          </div>
        </div>

        {/* Apps */}
        <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-4">Sistemas activos</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {APPS.map((app) => {
            const isLaunching = launching === app.ssoId;

            if (app.ssoId) {
              // ── Botón SSO ────────────────────────────────────────────────
              return (
                <button
                  key={app.id}
                  onClick={() => handleSSOLaunch(app.ssoId!, app.name)}
                  disabled={!!launching}
                  className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/25 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 text-left w-full disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center mb-3 shadow-md text-2xl`}>
                    {isLaunching ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : app.icon}
                  </div>
                  <div className="flex items-start justify-between">
                    <h3 className="text-white font-semibold mb-0.5">{app.name}</h3>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold ml-2 shrink-0">SSO</span>
                  </div>
                  <p className="text-white/30 text-xs font-mono mb-1">{app.sub}</p>
                  <p className="text-white/50 text-sm">{app.desc}</p>
                  {app.tag && (
                    <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded border font-semibold ${TAG_STYLES[app.tag]}`}>
                      {app.tag}
                    </span>
                  )}
                </button>
              );
            }

            // ── Link normal ──────────────────────────────────────────────
            return (
              
                key={app.id}
                href={app.url}
                target={app.url !== "#" ? "_blank" : undefined}
                rel="noreferrer"
                className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/25 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 block"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center mb-3 shadow-md text-2xl`}>
                  {app.icon}
                </div>
                <h3 className="text-white font-semibold mb-0.5">{app.name}</h3>
                <p className="text-white/30 text-xs font-mono mb-1">{app.sub}</p>
                <p className="text-white/50 text-sm">{app.desc}</p>
                {app.tag && (
                  <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded border font-semibold ${TAG_STYLES[app.tag]}`}>
                    {app.tag}
                  </span>
                )}
              </a>
            );
          })}
        </div>

        {/* Legado */}
        <p className="text-white/30 text-xs font-bold uppercase tracking-widest mb-4">Legado / Deprecado</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DEPRECATED.map((app) => (
            <div key={app.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 opacity-40 cursor-not-allowed">
              <div className="w-12 h-12 rounded-xl bg-gray-600 flex items-center justify-center mb-3 shadow-md text-2xl">
                {app.icon}
              </div>
              <h3 className="text-white font-semibold mb-0.5">{app.name}</h3>
              <p className="text-white/30 text-xs font-mono mb-1">{app.sub}</p>
              <p className="text-white/50 text-sm">{app.desc}</p>
              <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded border font-semibold bg-gray-500/20 text-gray-400 border-gray-500/30">
                DEPRECATED
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
