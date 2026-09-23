"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

/**
 * hidroBIntel — ThemeProvider
 *
 * Conmuta `data-theme` y `data-density` en <html>. Todo el design system
 * reacciona a esos dos atributos, así que no hace falta tocar componentes
 * para cambiar de tema o de densidad.
 *
 * La preferencia se guarda en localStorage. El script inline de layout.tsx
 * la aplica antes del primer paint para evitar el parpadeo de tema.
 */

export type Theme = "light" | "dark";
export type Density = "comfortable" | "compact";

const THEME_KEY = "hbi-theme";
const DENSITY_KEY = "hbi-density";

interface ThemeCtx {
  theme: Theme;
  density: Density;
  setTheme: (t: Theme) => void;
  setDensity: (d: Density) => void;
  toggleTheme: () => void;
  toggleDensity: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [density, setDensityState] = useState<Density>("comfortable");

  // Sincroniza el estado de React con lo que el script inline ya puso en <html>
  useEffect(() => {
    const root = document.documentElement;
    const t = (root.getAttribute("data-theme") as Theme) || "light";
    const d = (root.getAttribute("data-density") as Density) || "comfortable";
    setThemeState(t);
    setDensityState(d);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* modo privado: la preferencia sólo dura la sesión */
    }
    setThemeState(t);
  }, []);

  const setDensity = useCallback((d: Density) => {
    document.documentElement.setAttribute("data-density", d);
    try {
      localStorage.setItem(DENSITY_KEY, d);
    } catch {
      /* idem */
    }
    setDensityState(d);
  }, []);

  const toggleTheme = useCallback(
    () => setTheme(theme === "dark" ? "light" : "dark"),
    [theme, setTheme]
  );

  const toggleDensity = useCallback(
    () => setDensity(density === "compact" ? "comfortable" : "compact"),
    [density, setDensity]
  );

  return (
    <Ctx.Provider value={{ theme, density, setTheme, setDensity, toggleTheme, toggleDensity }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}

/**
 * Script que corre antes del primer paint. Lee la preferencia guardada
 * (o la del sistema operativo) y la aplica al <html>.
 */
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem('${THEME_KEY}');
    if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var d = localStorage.getItem('${DENSITY_KEY}') || 'comfortable';
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.setAttribute('data-density', d);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-density', 'comfortable');
  }
})();
`;
