import type { Config } from "tailwindcss";

/**
 * hidroBIntel — Tailwind config v2
 * Fuente: Brand Guideline Hidrobart (La Trividad, 2025)
 *
 * Las llaves `hidrobart`, `agua` y `hidroambar` se conservan para no romper
 * el markup existente, pero sus VALORES ahora son los oficiales de marca.
 * La v1 usaba #1E5FA8 / #0A2349 / #00A3C4, que no pertenecen al BrandKit.
 *
 * Para código nuevo: preferir las utilidades `hb-*` de hidrobintel-tokens.css,
 * que sí reaccionan al tema y a la densidad.
 */
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Escala Azul Hidrobart → Carbón Activado ──────────────
        hidrobart: {
          50:  "#EAF1FA",
          100: "#C9DCF2",
          200: "#A3C2E8",
          300: "#7BA6DC",
          400: "#5B8CD0",
          500: "#3A5DAE", // Azul Hidrobart · PANTONE 7455 C
          600: "#2C5697", // Azul Resina   · PANTONE 7685 C
          700: "#23477E",
          800: "#1A3763",
          900: "#13294B", // Carbón Activado · PANTONE 2767 C
          950: "#0A1729",
        },
        // ── Celeste Hidrobart (antes "agua"/teal, fuera de marca) ─
        agua: {
          300: "#C8E1F6",
          400: "#8FC4EE",
          500: "#6CACE4", // Celeste Hidrobart · PANTONE 284 C
          600: "#3D95E0",
        },
        // ── Azul Flow — interactivos ─────────────────────────────
        flow: {
          300: "#5AA9E8",
          400: "#3D95E0",
          500: "#0072CE", // Azul Flow · PANTONE 285 C
          600: "#005FA8",
          700: "#004E8A",
          800: "#003F72",
        },
        // ── Naranja de catálogo (antes ámbar genérico) ───────────
        hidroambar: {
          400: "#F2B575",
          500: "#ECA154", // PANTONE 157 C
          600: "#C97F32",
        },
        // ── Paleta de catálogo — identidad por módulo ────────────
        catalogo: {
          gris:    "#566361",
          metal:   "#7A99AC",
          amarillo:"#DECD63",
          verde:   "#A9C47F",
          vino:    "#672E45",
          lila:    "#BA9CC5",
          naranja: "#ECA154",
        },
        calypso: "#DDE5ED", // Celeste Calypso · PANTONE 656 C
      },
      fontFamily: {
        sans:    ["var(--font-montserrat)", "Montserrat", "system-ui", "sans-serif"],
        display: ["var(--font-montserrat)", "Montserrat", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "hidrobart-gradient": "linear-gradient(135deg, #13294B 0%, #2C5697 55%, #0072CE 100%)",
        "hidrobart-radial":   "radial-gradient(ellipse at top left, #2C5697 0%, #13294B 70%)",
        "glass-gradient":     "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 100%)",
      },
      boxShadow: {
        hidrobart: "0 20px 60px -10px rgba(19, 41, 75, 0.45)",
        card:      "0 4px 24px -4px rgba(19, 41, 75, 0.12)",
        glow:      "0 0 40px rgba(108, 172, 228, 0.30)",
      },
      animation: {
        "fade-in":    "fadeIn 0.6s ease-out",
        "slide-up":   "slideUp 0.5s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float:        "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:  { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
