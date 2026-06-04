"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HidrobartLogo from "../../components/HidrobartLogo";
import MicrosoftLogo from "../../components/MicrosoftLogo";
import { Shield, Wifi, Globe, Lock } from "lucide-react";

function LoginContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const errorParam = searchParams.get("error");

  // Si ya está autenticado, redirigir
  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  // Mostrar error de autenticación
  useEffect(() => {
    if (errorParam) {
      const messages: Record<string, string> = {
        OAuthSignin: "Error al iniciar sesión con Microsoft.",
        OAuthCallback: "Error en el proceso de autorización.",
        OAuthAccountNotLinked: "Esta cuenta no está vinculada.",
        AccessDenied: "Acceso denegado. Solo cuentas @hidrobart.com",
        Configuration: "Error de configuración del servidor.",
        Default: "Error de autenticación. Intente nuevamente.",
      };
      setError(messages[errorParam] || messages.Default);
    }
  }, [errorParam]);

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn("microsoft-entra-id", {
        callbackUrl,
        redirect: true,
      });
    } catch (err) {
      setError("Error inesperado. Por favor intente nuevamente.");
      setLoading(false);
    }
  };

  if (status === "loading") {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* ── Fondo animado ── */}
      <Background />

      {/* ── Contenido principal ── */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header con logo */}
        <header className="flex items-center justify-between px-6 py-5 sm:px-8 lg:px-12">
          <HidrobartLogo size="sm" variant="light" />
          <div className="flex items-center gap-2 text-white/50 text-xs sm:text-sm">
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Acceso institucional multi-empresa</span>
            <span className="sm:hidden">Multi-empresa</span>
          </div>
        </header>

        {/* ── Área central ── */}
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md animate-in">
            {/* Card de login */}
            <div className="glass-card p-8 sm:p-10 shadow-hidrobart">
              {/* Logo grande centrado */}
              <div className="flex flex-col items-center mb-8">
                <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-4 shadow-glow">
                  <HidrobartLogo size="icon" variant="light" />
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-white text-center">
                  Portal Institucional
                </h1>
                <p className="text-white/60 text-sm mt-2 text-center">
                  Acceso unificado a todos los sistemas Hidrobart
                </p>
              </div>

              {/* Divisor */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/30 text-xs font-medium uppercase tracking-widest">
                  Ingresar con
                </span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Error message */}
              {error && (
                <div className="mb-5 p-3.5 rounded-xl bg-red-500/15 border border-red-400/30 text-red-300 text-sm flex items-start gap-2.5">
                  <span className="mt-0.5 flex-shrink-0">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Botón Microsoft */}
              <button
                onClick={handleMicrosoftLogin}
                disabled={loading}
                className="btn-microsoft group"
                aria-label="Iniciar sesión con Microsoft 365"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-hidrobart-600 rounded-full spinner" />
                    <span className="text-gray-600">Conectando con Microsoft...</span>
                  </>
                ) : (
                  <>
                    <MicrosoftLogo className="w-5 h-5 flex-shrink-0" />
                    <span className="text-gray-700">Iniciar sesión con Microsoft 365</span>
                  </>
                )}
              </button>

              {/* Dominios aceptados */}
              <div className="mt-5 p-3.5 rounded-xl bg-white/5 border border-white/10">
                <p className="text-white/40 text-xs text-center mb-2 uppercase tracking-wider font-medium">
                  Dominios autorizados
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {["@hidrobart.com", "@hidrobart.com.mx", "@hidrobart.com.br"].map((domain) => (
                    <span
                      key={domain}
                      className="px-2.5 py-1 bg-agua-500/20 border border-agua-500/30 rounded-full text-agua-400 text-xs font-mono"
                    >
                      {domain}
                    </span>
                  ))}
                </div>
              </div>

              {/* Info de seguridad */}
              <div className="mt-5 flex items-center justify-center gap-2 text-white/30 text-xs">
                <Lock className="w-3 h-3" />
                <span>Conexión segura · Sesión cifrada · SSO Microsoft 365</span>
              </div>
            </div>

            {/* Cards de características */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { icon: Shield, label: "Acceso Seguro", desc: "Azure AD" },
                { icon: Wifi, label: "Siempre Online", desc: "99.9% uptime" },
                { icon: Globe, label: "Multi-empresa", desc: "MX · BR · CO" },
              ].map(({ icon: Icon, label, desc }) => (
                <div
                  key={label}
                  className="glass-card p-3 text-center hover-lift"
                >
                  <Icon className="w-5 h-5 text-agua-400 mx-auto mb-1.5" />
                  <p className="text-white text-xs font-semibold">{label}</p>
                  <p className="text-white/40 text-[10px]">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="text-center py-5 px-4">
          <p className="text-white/25 text-xs">
            © {new Date().getFullYear()} Hidrobart · Todos los derechos reservados
          </p>
          <p className="text-white/15 text-[10px] mt-1">
            v1.0.0 · Soporte: it@hidrobart.com
          </p>
        </footer>
      </div>
    </div>
  );
}

// ── Componentes auxiliares ──────────────────────────────────────────────────

function Background() {
  return (
    <div className="fixed inset-0 z-0">
      {/* Gradiente base */}
      <div className="absolute inset-0 bg-hidrobart-radial" />

      {/* Orbes de luz */}
      <div className="absolute top-1/4 -left-32 w-80 h-80 rounded-full bg-hidrobart-600/20 blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-1/3 -right-32 w-96 h-96 rounded-full bg-agua-500/15 blur-3xl animate-pulse-slow [animation-delay:2s]" />
      <div className="absolute top-2/3 left-1/4 w-64 h-64 rounded-full bg-hidrobart-400/10 blur-3xl animate-pulse-slow [animation-delay:4s]" />

      {/* Grid sutil */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Olas decorativas */}
      <svg
        className="absolute bottom-0 left-0 w-full opacity-10"
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0 100 C360 0 720 200 1080 100 C1260 50 1380 120 1440 100 L1440 200 L0 200 Z"
          fill="#00A3C4"
        />
        <path
          d="M0 140 C300 80 600 180 900 130 C1100 95 1300 155 1440 140 L1440 200 L0 200 Z"
          fill="#1E5FA8"
          opacity="0.6"
        />
      </svg>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-hidrobart-900">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-3 border-white/20 border-t-agua-400 rounded-full spinner" />
        <p className="text-white/50 text-sm">Verificando sesión...</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-blue-950" />}>
      <LoginContent />
    </Suspense>
  );
}
