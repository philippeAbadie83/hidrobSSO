"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import HidrobartLogo from "@/components/HidrobartLogo";
import { AlertTriangle, ArrowLeft, Mail } from "lucide-react";

const ERROR_MESSAGES: Record<string, { title: string; message: string }> = {
  OAuthSignin: {
    title: "Error al conectar con Microsoft",
    message: "No se pudo iniciar el proceso de login. Por favor intente nuevamente.",
  },
  OAuthCallback: {
    title: "Error en la autorización",
    message: "Microsoft no pudo completar la autorización. Intente nuevamente.",
  },
  AccessDenied: {
    title: "Acceso Denegado",
    message:
      "Su cuenta no pertenece a un dominio Hidrobart autorizado. Solo se permiten cuentas @hidrobart.com, @hidrobart.com.mx y @hidrobart.com.br",
  },
  Configuration: {
    title: "Error de Configuración",
    message: "El sistema de autenticación tiene un error de configuración. Contacte a IT.",
  },
  Default: {
    title: "Error de Autenticación",
    message: "Ocurrió un error inesperado. Por favor intente nuevamente o contacte soporte.",
  },
};

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error") || "Default";
  const error = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.Default;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-hidrobart-radial">
      {/* Fondo */}
      <div className="fixed inset-0 bg-hidrobart-radial" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <HidrobartLogo size="md" variant="light" />
        </div>

        {/* Error card */}
        <div className="glass-card p-8 text-center">
          {/* Ícono de error */}
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-400/30 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>

          <h1 className="font-display text-xl font-bold text-white mb-3">
            {error.title}
          </h1>
          <p className="text-white/60 text-sm leading-relaxed mb-6">
            {error.message}
          </p>

          {/* Acciones */}
          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              className="btn-primary flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al login
            </Link>

            <a
              href="mailto:it@hidrobart.com"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm transition-all"
            >
              <Mail className="w-4 h-4" />
              Contactar soporte IT
            </a>
          </div>
        </div>

        <p className="text-center text-white/25 text-xs mt-4">
          Error: {errorCode}
        </p>
      </div>
    </div>
  );
}
