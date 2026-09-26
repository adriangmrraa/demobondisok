import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Estandar de rutas en español (/inicio); /home queda como link viejo del demo.
      { source: "/home", destination: "/inicio", permanent: false },
    ];
  },
};

export default nextConfig;
