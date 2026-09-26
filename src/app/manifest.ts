import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "La Nueva Metropol • Colectivos en Vivo",
    short_name: "La Nueva Metropol",
    description: "Monitoreo en tiempo real de colectivos y paradas del AMBA",
    start_url: "/",
    display: "standalone",
    background_color: "#0A1020",
    theme_color: "#1D2B4F",
    orientation: "portrait",
    icons: [
      {
        src: "/metropol-icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/metropol-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/metropol-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
