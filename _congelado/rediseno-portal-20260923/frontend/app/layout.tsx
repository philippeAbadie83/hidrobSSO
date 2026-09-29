import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./hidrobintel-tokens.css";
import "./globals.css";
import { AuthProvider } from "../components/AuthProvider";
import { ThemeProvider, THEME_INIT_SCRIPT } from "../components/ThemeProvider";

/**
 * Montserrat es la única tipografía de interfaz del estándar Hidrobart.
 * Nexa es la tipografía del logo (comercial) y sólo aparece en el imagotipo,
 * que se sirve como imagen desde el CDN.
 */
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "hidroBIntel — Plataforma Hidrobart",
  description: "Acceso centralizado a las aplicaciones corporativas Hidrobart",
  applicationName: "hidroBIntel",
  authors: [{ name: "Hidrobart IT" }],
  robots: "noindex, nofollow",
  // Los iconos NO se declaran aquí. Next 15 los toma solos de los archivos
  // app/favicon.ico, app/icon.png y app/apple-icon.png, y genera los <link>.
  // Antes esto apuntaba a /favicon.svg y /apple-touch-icon.png, que nunca
  // existieron (no hay carpeta public/) y daban 404.
  // Los tres se generaron del isotipo oficial del CDN, sin deformarlo.
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale: 1 impedía el zoom del usuario (WCAG 1.4.4). Se retira.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F8FB" },
    { media: "(prefers-color-scheme: dark)", color: "#0A1729" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={montserrat.variable}
      data-theme="light"
      data-density="comfortable"
      suppressHydrationWarning
    >
      <head>
        {/* Aplica el tema guardado antes del primer paint — evita el flash */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
