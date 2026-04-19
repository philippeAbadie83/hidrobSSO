import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Habilitar imágenes de Microsoft Graph (fotos de perfil)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "graph.microsoft.com",
      },
      {
        protocol: "https",
        hostname: "*.blob.core.windows.net",
      },
    ],
  },
  // Variables de entorno expuestas al cliente
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || "Hidrobart",
    NEXT_PUBLIC_AUTH_API: process.env.NEXT_PUBLIC_AUTH_API || "http://localhost:8000",
  },
};

export default nextConfig;
