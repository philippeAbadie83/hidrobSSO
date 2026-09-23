"use client";

import { useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Moon, Sun, AlertTriangle } from "lucide-react";
import BOARD from "@/data/seguimiento.json";
import HexIcon, { IsotipoHex } from "../../components/HexIcon";
import { useTheme } from "../../components/ThemeProvider";

/**
 * Seguimiento de Apps — tablero privado de avance del ecosistema.
 *
 * Visible sólo para el rol SuperAdmin. Los datos viven en data/seguimiento.json
 * y se editan por git: sin base de datos, sin endpoint, sin backend que mantener.
 * Pensado para proyectarse en junta mientras Unidum no está listo.
 */

type Estado = "idea" | "diseno" | "desarrollo" | "vobo" | "produccion" | "pausado";

interface Proyecto {
  id: string;
  nombre: string;
  sub: string;
  modulo: string;
  estado: Estado;
  avance: number;
  resumen: string;
  siguiente: string;
  bloqueo: string | null;
}

interface Board {
  actualizado: string;
  nota?: string;
  proyectos: Proyecto[];
}

const ROL_PERMITIDO = "SuperAdmin";

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

const ESTADO_META: Record<Estado, { label: string; badge: string }> = {
  idea:       { label: "Idea",        badge: "hb-badge--neutral" },
  diseno:     { label: "En diseño",   badge: "hb-badge--neutral" },
  desarrollo: { label: "Desarrollo",  badge: "hb-badge--info" },
  vobo:       { label: "Espera VoBo", badge: "hb-badge--warn" },
  produccion: { label: "Producción",  badge: "hb-badge--ok" },
  pausado:    { label: "Pausado",     badge: "hb-badge--neutral" },
};

// Orden de lectura del tablero: primero lo que está más avanzado
const ORDEN: Estado[] = ["produccion", "vobo", "desarrollo", "diseno", "idea", "pausado"];

export default function SeguimientoPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const board = BOARD as unknown as Board;

  const orgRoles: string[] = (session?.user as any)?.roles?.org || [];
  const autorizado = orgRoles.includes(ROL_PERMITIDO);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && !autorizado) router.replace("/dashboard");
  }, [status, autorizado, router]);

  const resumen = useMemo(() => {
    const p = board.proyectos;
    const media = p.length ? Math.round(p.reduce((s, x) => s + x.avance, 0) / p.length) : 0;
    return {
      total: p.length,
      produccion: p.filter((x) => x.estado === "produccion").length,
      desarrollo: p.filter((x) => x.estado === "desarrollo").length,
      bloqueados: p.filter((x) => x.bloqueo).length,
      media,
    };
  }, [board]);

  const ordenados = useMemo(
    () =>
      [...board.proyectos].sort((a, b) => {
        const d = ORDEN.indexOf(a.estado) - ORDEN.indexOf(b.estado);
        return d !== 0 ? d : b.avance - a.avance;
      }),
    [board]
  );

  if (status === "loading" || !session || !autorizado) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--hb-canvas)" }}>
        <div
          className="w-10 h-10 rounded-full animate-spin"
          style={{ border: "2px solid var(--hb-border)", borderTopColor: "var(--hb-accent-solid)" }}
        />
      </div>
    );
  }

  const kpi = (etiqueta: string, valor: string | number, color: string) => (
    <div
      key={etiqueta}
      style={{
        background: "var(--hb-surface)",
        border: "1px solid var(--hb-border)",
        borderRadius: "var(--hb-radius-lg)",
        padding: "var(--hb-card-pad)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          width: 20,
          height: 23,
          background: color,
          clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
        }}
      />
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "var(--hb-text-muted)",
          paddingRight: 28,
        }}
      >
        {etiqueta}
      </p>
      <p
        className="tnum"
        style={{
          fontSize: "clamp(1.35rem, 1rem + 1.4vw, 1.9rem)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "var(--hb-text)",
          marginTop: 6,
        }}
      >
        {valor}
      </p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--hb-canvas)" }}>

      {/* ══ CABECERA ══════════════════════════════════════════════════════ */}
      <header style={{ background: "var(--hb-rail-bg)", boxShadow: "var(--hb-shadow)" }}>
        <div
          className="flex items-center gap-3 flex-wrap"
          style={{
            minHeight: "var(--hbc-topbar-h)",
            padding: "10px clamp(16px, 4vw, 32px)",
            borderBottom: "1px solid var(--hb-rail-border)",
          }}
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg"
            style={{
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--hb-rail-fg)",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid var(--hb-rail-border)",
              textDecoration: "none",
            }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Portal
          </Link>

          <div className="flex items-center gap-3 mr-auto ml-1">
            <IsotipoHex size={30} />
            <span style={{ color: "var(--hb-text-on-inverse)", fontWeight: 800, fontSize: 15 }}>
              Seguimiento de Apps
            </span>
            <span className="hb-badge hb-badge--warn hidden sm:inline-flex">Privado</span>
          </div>

          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            className="grid place-items-center rounded-lg"
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
        </div>

        <div style={{ padding: "14px clamp(16px, 4vw, 32px) 20px" }}>
          <p style={{ color: "var(--hb-text-inverse-muted)", fontSize: 13 }}>
            Estado del ecosistema · actualizado el{" "}
            <span style={{ color: "var(--hbp-celeste)", fontWeight: 600 }}>{board.actualizado}</span>
          </p>
        </div>
      </header>

      {/* ══ CONTENIDO ═════════════════════════════════════════════════════ */}
      <main style={{ padding: "var(--hb-s8) clamp(16px, 4vw, 32px) var(--hb-s12)" }}>

        {/* Resumen */}
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            marginBottom: "var(--hb-s8)",
          }}
        >
          {kpi("Proyectos", resumen.total, "var(--hbp-flow)")}
          {kpi("En producción", resumen.produccion, "var(--hbp-cat-green)")}
          {kpi("En desarrollo", resumen.desarrollo, "var(--hbp-celeste)")}
          {kpi("Con bloqueo", resumen.bloqueados, "var(--hbp-cat-orange)")}
          {kpi("Avance medio", `${resumen.media}%`, "var(--hbp-cat-yellow)")}
        </div>

        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--hb-text-muted)",
            borderLeft: "3px solid var(--hbp-celeste)",
            paddingLeft: 12,
            marginBottom: 20,
          }}
        >
          Proyectos
        </p>

        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {ordenados.map((p) => {
            const color = MODULE_TOKEN[p.modulo] ?? "var(--hbp-flow)";
            const meta = ESTADO_META[p.estado] ?? ESTADO_META.idea;
            return (
              <article
                key={p.id}
                style={{
                  background: "var(--hb-surface)",
                  border: "1px solid var(--hb-border)",
                  borderTop: `3px solid ${color}`,
                  borderRadius: "var(--hb-radius-lg)",
                  padding: "var(--hb-card-pad)",
                  boxShadow: "var(--hb-shadow-sm)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div className="flex items-start gap-3">
                  <HexIcon glyph="crecimiento" color={color} size={40} />
                  <div className="min-w-0 flex-1">
                    <p style={{ fontSize: 15, fontWeight: 700, color: "var(--hb-text)" }}>{p.nombre}</p>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--hb-text-muted)", marginTop: 2 }}>
                      {p.sub}
                    </p>
                  </div>
                  <span className={`hb-badge ${meta.badge}`}>{meta.label}</span>
                </div>

                {/* Barra de avance */}
                <div>
                  <div className="flex items-baseline justify-between" style={{ marginBottom: 5 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--hb-text-muted)",
                      }}
                    >
                      Avance
                    </span>
                    <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: "var(--hb-text)" }}>
                      {p.avance}%
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={p.avance}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Avance de ${p.nombre}`}
                    style={{
                      height: 7,
                      borderRadius: "var(--hb-radius-pill)",
                      background: "var(--hb-surface-sunken)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(0, Math.min(100, p.avance))}%`,
                        height: "100%",
                        background: color,
                        borderRadius: "var(--hb-radius-pill)",
                        transition: "width var(--hb-dur-slow) var(--hb-ease)",
                      }}
                    />
                  </div>
                </div>

                {p.resumen && (
                  <p style={{ fontSize: 13, color: "var(--hb-text-secondary)", lineHeight: 1.55 }}>{p.resumen}</p>
                )}

                <div
                  style={{
                    background: "var(--hb-surface-sunken)",
                    borderRadius: "var(--hb-radius)",
                    padding: "9px 12px",
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--hb-text-muted)",
                      marginBottom: 3,
                    }}
                  >
                    Lo que sigue
                  </p>
                  <p
                    style={{
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      color: p.siguiente ? "var(--hb-text)" : "var(--hb-text-muted)",
                      fontStyle: p.siguiente ? "normal" : "italic",
                    }}
                  >
                    {p.siguiente || "Por definir"}
                  </p>
                </div>

                {p.bloqueo && (
                  <p
                    className="flex items-start gap-2"
                    style={{ fontSize: 12, fontWeight: 600, color: "var(--hb-warn)", lineHeight: 1.45 }}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ marginTop: 2 }} />
                    {p.bloqueo}
                  </p>
                )}
              </article>
            );
          })}
        </div>

        <p style={{ fontSize: 11, color: "var(--hb-text-muted)", marginTop: 32, textAlign: "center" }}>
          Tablero privado · sólo SuperAdmin · se edita en <code>data/seguimiento.json</code> y sube por git
        </p>
      </main>
    </div>
  );
}
