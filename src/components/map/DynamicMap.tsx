"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";
import { Loader2, Map, Route } from "lucide-react";
import type { MapCanvasProps } from "./MapCanvas";

const MAP_LOAD_TIMEOUT_MS = 12_000;

const MapCanvasComponent = dynamic(
  () => import("./MapCanvas").then((module) => module.MapCanvas),
  {
    ssr: false,
    loading: () => <MapLoading />,
  },
);

interface DynamicMapProps extends MapCanvasProps {
  unavailableHref?: string;
  unavailableLabel?: string;
}

interface MapErrorBoundaryProps {
  children: ReactNode;
  onError: () => void;
}

interface MapErrorBoundaryState {
  hasError: boolean;
}

class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  state: MapErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

function MapLoading() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-slate-950 text-slate-300" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Loader2 className="size-5 animate-spin text-amber-500" aria-hidden="true" />
        <span>Cargando mapa en vivo…</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">Preparando el contexto del recorrido</p>
    </div>
  );
}

function MapUnavailable({ href, label }: { href: string; label: string }) {
  return (
    <section className="flex h-full w-full items-center justify-center bg-canvas p-5" role="alert" aria-live="assertive">
      <div className="w-full max-w-sm rounded-3xl border border-hairline bg-canvas p-6 text-center shadow-sm">
        <Map className="mx-auto size-8 text-text-muted" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-ink">El mapa no está disponible</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          Podés continuar con las indicaciones paso a paso sin perder tu viaje.
        </p>
        <Link
          href={href}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 text-sm font-bold text-canvas"
        >
          <Route className="size-4" aria-hidden="true" />
          {label}
        </Link>
      </div>
    </section>
  );
}

export default function DynamicMap({
  unavailableHref = "/inicio",
  unavailableLabel = "Volver al inicio",
  onMapReady,
  onMapUnavailable,
  ...mapProps
}: DynamicMapProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    if (status !== "loading") return;
    const timeoutId = window.setTimeout(() => setStatus("unavailable"), MAP_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [status]);

  const markReady = () => {
    setStatus("ready");
    onMapReady?.();
  };

  const markUnavailable = () => {
    setStatus("unavailable");
    onMapUnavailable?.();
  };

  if (status === "unavailable") {
    return <MapUnavailable href={unavailableHref} label={unavailableLabel} />;
  }

  return (
    <MapErrorBoundary onError={markUnavailable}>
      <MapCanvasComponent {...mapProps} onMapReady={markReady} onMapUnavailable={markUnavailable} />
    </MapErrorBoundary>
  );
}
