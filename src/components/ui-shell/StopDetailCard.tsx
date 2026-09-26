"use client";

import * as React from "react";
import { Parada, Linea, EstimacionLlegada } from "@/types/transport";
import { Bus, Clock, TrainFront, Compass, X } from "lucide-react";
import { DATASET } from "@/lib/mock/amba-data";

interface StopDetailCardProps {
  parada: Parada;
  linea?: Linea | null;
  selectedRamalId?: string | null;
  proximoArribo?: EstimacionLlegada | null;
  onClose?: () => void;
  className?: string;
}

/**
 * P2-8: Deriva el sentido desde el dataset, no por string-matching de IDs.
 * Busca recorridos que contienen la parada; si el ramal está seleccionado
 * filtra por él. Si hay ambigüedad (ida+vuelta), muestra ambos.
 */
function resolveSentido(
  paradaId: string,
  linea: Linea | null | undefined,
  selectedRamalId: string | null | undefined
): { isVuelta: boolean; isAmbiguous: boolean; destino: string | null } {
  if (!linea?.id) return { isVuelta: false, isAmbiguous: false, destino: null };
  const lineaData = DATASET.lineas.find((l) => l.id === linea.id);
  if (!lineaData) return { isVuelta: false, isAmbiguous: false, destino: null };

  const ramales = selectedRamalId
    ? lineaData.ramales.filter((r) => r.id === selectedRamalId)
    : lineaData.ramales;

  const sentidos = new Set<string>();
  let destino: string | null = null;
  for (const ramal of ramales) {
    for (const rec of ramal.recorridos) {
      if (rec.paradas.includes(paradaId)) {
        sentidos.add(rec.sentido);
        if (!destino) destino = rec.destino;
      }
    }
  }
  if (sentidos.size === 0) return { isVuelta: false, isAmbiguous: false, destino: null };
  if (sentidos.size > 1) return { isVuelta: false, isAmbiguous: true, destino };
  return { isVuelta: sentidos.has("vuelta"), isAmbiguous: false, destino };
}

/**
 * StopDetailCard — Ficha operativa embebida de detalle de parada.
 * Muestra exactamente la información solicitada sin ventanas emergentes:
 * 1. Nombre de la parada dominante + dirección + botón de cierre X
 * 2. Línea y empresa concesionaria (Línea 65 - La Nueva Metropol S.A.)
 * 3. Sentido de circulación con chip contextual (Ida / Vuelta)
 * 4. Frecuencia estimada pico
 * 5. Conexiones intermodales (Subte / Tren / Metrobús)
 * 6. Tarjeta de próximo colectivo en tiempo real con interno
 */
export function StopDetailCard({
  parada,
  linea,
  selectedRamalId,
  proximoArribo,
  onClose,
  className = "",
}: StopDetailCardProps) {
  const { isVuelta, isAmbiguous, destino } = resolveSentido(parada.id, linea, selectedRamalId);
  const sentidoTexto = isAmbiguous
    ? `Ida / Vuelta${destino ? ` · hacia ${destino}` : ""}`
    : isVuelta
    ? `Vuelta${destino ? ` hacia ${destino}` : ""}`
    : `Ida${destino ? ` hacia ${destino}` : ""}`;
  const sentidoBadgeClass = isVuelta
    ? "text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40"
    : "text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-900/50 bg-sky-50 dark:bg-sky-950/40";

  const hasConexiones = Boolean(
    parada.conexiones &&
      ((parada.conexiones.subte && parada.conexiones.subte.length > 0) ||
        (parada.conexiones.tren && parada.conexiones.tren.length > 0) ||
        parada.conexiones.metrobus)
  );

  return (
    <div
      className={`bg-canvas border border-hairline-soft rounded-[24px] p-5 space-y-3.5 transition-colors ${className}`}
    >
      {/* 1. Header con nombre dominante y botón de cierre */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold text-ink leading-snug">
            {parada.nombre}
          </h3>
          <p className="text-xs text-text-muted">
            {parada.direccion}
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            aria-label="Cerrar detalle de parada"
            className="p-1 rounded-full text-text-muted hover:text-ink hover:bg-canvas-soft transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. Línea y Sentido */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-muted font-normal">Línea</span>
          <span className="px-2.5 py-0.5 rounded-full border border-hairline text-xs font-bold text-ink bg-canvas-soft">
            {linea?.numero || "65"}
          </span>
          <span className="text-text-muted text-xs">
            {linea?.empresa || "La Nueva Metropol S.A."}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Compass className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span className="px-3 py-0.5 rounded-full border border-hairline text-xs font-medium text-ink bg-canvas-soft">
            {sentidoTexto}
          </span>
        </div>
      </div>

      {/* 3. Frecuencia estimada */}
      <div className="flex items-center justify-between py-1 border-t border-hairline-soft text-xs">
        <div className="flex items-center gap-2 text-text-muted">
          <Clock className="w-3.5 h-3.5" />
          <span>Frecuencia estimada</span>
        </div>
        <span className="font-semibold text-ink">
          {linea?.frecuenciaPicoMin ? `Cada ${linea.frecuenciaPicoMin} min (pico)` : "Cada 5 min (pico)"}
        </span>
      </div>

      {/* 4. Conexiones intermodales */}
      {hasConexiones && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-hairline-soft">
          <div className="flex items-center gap-1.5 text-text-muted text-xs font-semibold">
            <TrainFront className="w-3.5 h-3.5" />
            <span>Conexiones</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {parada.conexiones?.subte?.map((lineaSubte) => (
              <span
                key={lineaSubte}
                className="px-2.5 py-0.5 rounded-full bg-canvas-soft border border-hairline-soft text-ink text-xs font-semibold"
              >
                Subte {lineaSubte}
              </span>
            ))}
            {parada.conexiones?.tren?.map((lineaTren) => (
              <span
                key={lineaTren}
                className="px-2.5 py-0.5 rounded-full bg-canvas-soft border border-hairline-soft text-ink text-xs font-semibold"
              >
                Tren {lineaTren}
              </span>
            ))}
            {parada.conexiones?.metrobus && (
              <span className="px-2.5 py-0.5 rounded-full bg-canvas-soft border border-hairline-soft text-ink text-xs font-semibold">
                Metrobús
              </span>
            )}
          </div>
        </div>
      )}

      {/* 5. Próximo colectivo */}
      <div className="flex items-center justify-between rounded-[16px] bg-canvas-soft p-3 border border-hairline-soft">
        <div className="flex items-center gap-2 text-text-muted">
          <Bus className="w-3.5 h-3.5 text-ink" />
          <span className="text-xs font-medium">Próximo colectivo</span>
        </div>
        <div className="text-right">
          <span className="font-bold text-sm text-ink">
            {proximoArribo?.displayLabel || "5 min"}
          </span>
          {proximoArribo?.interno && (
            <span className="text-xs text-text-muted ml-1.5">
              (Unidad {proximoArribo.interno})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
