"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import HidrobartLogo from "@/components/HidrobartLogo";
import {
  LogOut, User, Shield, Settings, BarChart3,
  Wrench, ShoppingCart, Users, FileText, Layers
} from "lucide-react";

// Definición de apps del ecosistema Hidrobart
const APPS = [
  { id: "hidroplus",    name: "HidroPlus",     desc: "Sistema principal",      icon: Layers,      color: "from-hidrobart-600 to-hidrobart-800",  module: "hidroplus" },
  { id: "portal_emp",  name: "Portal RH",     desc: "Empleados y RRHH",       icon: Users,       color: "from-teal-500 to-teal-700",            module: "portal_emp" },
  { id: "ops",         name: "Operaciones",   desc: "Dashboard operacional",  icon: BarChart3,   color: "from-blue-500 to-blue-700",            module: "ops_dashboard" },
  { id: "mant",        name: "Mantenimiento", desc: "Gestión de activos",     icon: Wrench,      color: "from-orange-500 to-orange-700",        module: "mantenimiento" },
  { id: "compras",     name: "Compras",       desc: "Adquisiciones",          icon: ShoppingCart,color: "from-purple-500 to-purple-700",        module: "compras" },
  { id: "reportes",    name: "Reportes",      desc: "Business Intelligence",  icon: FileText,    color: "from-green-500 to-green-700",          module: "reportes" },
];

// Color de badge por rol
const ROLE_COLORS: Record<string, string> = {
  SuperAdmin: "bg-red-500/20 text-red-300 border-red-400/30",
  Admin:      "bg-orange-500/20 text-orange-300 border-orange-400/30",
  Manager:    "bg-yellow-500/20 text-yellow-300 border-yellow-400/30",
  Employee:   "bg-blue-500/20 text-blue-300 border-blue-400/30",
  External:   "bg-gray-500/20 text-gray-300 border-gray-400/30",
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen bg-hidrobart-900 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-white/20 border-t-agua-400 rounded-full spinner" />
      </div>
    );
  }

  const user = session.user as any;
  const roles = user.roles || { org: ["Employee"], functional: [], process: {} };
  const orgRoles: string[] = roles.org || [];

  const getInitials = (name: string) =>
    name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() || "HB";

  const hasModuleAccess = (module: string) => {
    return Object.keys(roles.process || {}).includes(module) || orgRoles.includes("SuperAdmin");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-hidrobart-950 via-hidrobart-900 to-hidrobart-800">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-hidrobart-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <HidrobartLogo size="sm" variant="light" />

            <div className="flex items-center gap-3">
              {/* Avatar y nombre */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-hidrobart-600 flex items-center justify-center text-white text-xs font-bold">
                  {getInitials(user.name || "")}
                </div>
                <div className="hidden sm:block">
                  <p className="text-white text-sm font-medium leading-none">
                    {user.name?.split(" ")[0]}
                  </p>
                  <p className="text-white/40 text-xs">{user.email}</p>
                </div>
              </div>

              {/* Botón logout */}
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
        {/* ── Bienvenida ── */}
        <div className="mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Bienvenido, {user.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-white/50 mt-1">
            {user.jobTitle && `${user.jobTitle} · `}
            {user.department && `${user.department} · `}
            <span className="font-mono text-agua-400 text-sm">@{user.domain}</span>
          </p>
        </div>

        {/* ── Info card usuario ── */}
        <div className="glass-card p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-hidrobart-600/50 border border-white/20 flex items-center justify-center text-white text-xl font-bold font-display">
              {getInitials(user.name || "")}
            </div>
            <div>
              <p className="text-white font-semibold">{user.name}</p>
              <p className="text-white/40 text-sm">{user.email}</p>
            </div>
          </div>

          {/* Roles de org */}
          <div className="sm:ml-auto flex flex-wrap gap-2">
            {orgRoles.map((role) => (
              <span
                key={role}
                className={`role-badge border text-xs ${ROLE_COLORS[role] || ROLE_COLORS.Employee}`}
              >
                <Shield className="w-3 h-3" />
                {role}
              </span>
            ))}
          </div>
        </div>

        {/* ── Apps grid ── */}
        <h2 className="text-white/60 text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4" />
          Aplicaciones disponibles
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {APPS.map((app) => {
            const Icon = app.icon;
            const hasAccess = hasModuleAccess(app.module);
            const perms: string[] = roles.process?.[app.module] || [];

            return (
              <button
                key={app.id}
                disabled={!hasAccess}
                className={`
                  glass-card p-5 text-left transition-all duration-200 group
                  ${hasAccess
                    ? "hover:border-white/30 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                    : "opacity-40 cursor-not-allowed"
                  }
                `}
              >
                {/* Ícono con gradiente */}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center mb-3 shadow-md group-hover:shadow-lg transition-shadow`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>

                <h3 className="text-white font-semibold mb-0.5">{app.name}</h3>
                <p className="text-white/40 text-sm">{app.desc}</p>

                {/* Permisos */}
                {hasAccess && perms.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {perms.slice(0, 3).map((p) => (
                      <span key={p} className="text-[10px] px-1.5 py-0.5 bg-white/10 text-white/60 rounded">
                        {p}
                      </span>
                    ))}
                    {perms.length > 3 && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-white/10 text-white/40 rounded">
                        +{perms.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
