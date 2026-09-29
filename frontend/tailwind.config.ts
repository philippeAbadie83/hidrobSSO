import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Paleta Hidrobart ─────────────────────────────
        hidrobart: {
          50:  "#e8f0fb",
          100: "#c5d8f5",
          200: "#9dbeed",
          300: "#72a2e4",
          400: "#508ed9",
          500: "#2b7ace",
          600: "#1E5FA8",  // Primary
          700: "#164d90",
          800: "#0E3B76",
          900: "#0A2349",  // Dark Navy
          950: "#061630",
        },
        // Agua / teal accent
        agua: {
          400: "#22C5D9",
          500: "#00A3C4",
          600: "#007D99",
        },
        // Amber para notificaciones / warnings
        hidroambar: {
          400: "#FFC94D",
          500: "#F5A623",
          600: "#D4870A",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Poppins", "Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "hidrobart-gradient": "linear-gradient(135deg, #0A2349 0%, #1E5FA8 50%, #00A3C4 100%)",
        "hidrobart-radial": "radial-gradient(ellipse at top left, #1E5FA8 0%, #0A2349 100%)",
        "glass-gradient": "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
      },
      boxShadow: {
        "hidrobart": "0 20px 60px -10px rgba(10, 35, 73, 0.4)",
        "card": "0 4px 24px -4px rgba(10, 35, 73, 0.12)",
        "glow": "0 0 40px rgba(30, 95, 168, 0.3)",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
