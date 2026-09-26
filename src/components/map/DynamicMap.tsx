"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { MapCanvasProps } from "./MapCanvas";

const MapCanvasComponent = dynamic(
  () => import("./MapCanvas").then((m) => m.MapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span>Cargando mapa en vivo Metropol...</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">Conectando con la red satelital de transportes</p>
      </div>
    ),
  }
);

export default function DynamicMap(props: MapCanvasProps) {
  return <MapCanvasComponent {...props} />;
}
