"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Parada, Linea, EstimacionLlegada } from "@/types/transport";
import { Bus, Clock, ArrowRightLeft, TrainFront, Compass } from "lucide-react";

interface StopDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parada: Parada | null;
  linea?: Linea | null;
  proximoArribo?: EstimacionLlegada | null;
}

/**
 * StopDetailDialog — Dialog modal de información de parada.
 * Implementación estricta del patrón shadcn/ui con Base UI:
 * Dialog → DialogContent → DialogHeader → DialogTitle / DialogDescription
 *
 * Jerarquía de información:
 * 1. Nombre dominante de la parada
 * 2. Dirección en DialogDescription
 * 3. Línea y empresa asociada
 * 4. Frecuencia oficial (5 min)
 * 5. Sentido de circulación (Ida hacia Barrancas / Vuelta hacia Constitución)
 * 6. Conexiones intermodales (Subte, Tren, Metrobús)
 * 7. Próximo arribo en vivo si existe telemetría
 */
export function StopDetailDialog({
  open,
  onOpenChange,
  parada,
  linea,
  proximoArribo,
}: StopDetailDialogProps) {
  if (!parada) return null;

  const isVuelta = parada.id.includes("stop-65-1") && parada.id !== "stop-65-01";
  const sentidoTexto = isVuelta
    ? "Vuelta hacia Plaza Constitución"
    : "Ida hacia Barrancas de Belgrano";

  const hasConexiones = Boolean(
    parada.conexiones &&
      ((parada.conexiones.subte && parada.conexiones.subte.length > 0) ||
        (parada.conexiones.tren && parada.conexiones.tren.length > 0) ||
        parada.conexiones.metrobus)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-5 gap-4">
        {/* Encabezado dominante */}
        <DialogHeader className="gap-1 text-left">
          <DialogTitle className="text-base sm:text-lg font-semibold text-ink leading-snug">
            {parada.nombre}
          </DialogTitle>
          <DialogDescription className="text-xs text-text-muted">
            {parada.direccion}
          </DialogDescription>
        </DialogHeader>

        {/* Ficha operativa escaneable */}
        <div className="flex flex-col gap-3 pt-1 text-xs">
          {/* Línea & Sentido */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hairline-soft pb-3">
            <div className="flex items-center gap-2">
              <span className="text-text-muted font-normal">Línea</span>
              <Badge variant="outline" className="font-bold text-xs px-2.5 py-0.5">
                {linea?.numero || "65"}
              </Badge>
              <span className="text-text-muted text-[11px]">
                {linea?.empresa || "La Nueva Metropol S.A."}
              </span>
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <Compass className="w-3.5 h-3.5 text-text-muted shrink-0" />
              <Badge variant="secondary" className="font-medium text-[11px]">
                {sentidoTexto}
              </Badge>
            </div>
          </div>

          {/* Frecuencia operativa */}
          <div className="flex items-center justify-between py-0.5">
            <div className="flex items-center gap-2 text-text-muted">
              <Clock className="w-3.5 h-3.5" />
              <span>Frecuencia estimada</span>
            </div>
            <span className="font-semibold text-ink">
              {linea?.frecuenciaPicoMin ? `Cada ${linea.frecuenciaPicoMin} min (pico)` : "Cada 5 min"}
            </span>
          </div>

          {/* Conexiones Intermodales */}
          {hasConexiones && (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-hairline-soft">
              <div className="flex items-center gap-1.5 text-text-muted font-semibold text-[11px]">
                <TrainFront className="w-3.5 h-3.5" />
                <span>Conexiones</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {parada.conexiones?.subte?.map((lineaSubte) => (
                  <Badge
                    key={lineaSubte}
                    variant="secondary"
                    className="text-[11px] font-semibold px-2.5 py-0.5"
                  >
                    Subte {lineaSubte}
                  </Badge>
                ))}
                {parada.conexiones?.tren?.map((lineaTren) => (
                  <Badge
                    key={lineaTren}
                    variant="secondary"
                    className="text-[11px] font-semibold px-2.5 py-0.5"
                  >
                    Tren {lineaTren}
                  </Badge>
                ))}
                {parada.conexiones?.metrobus && (
                  <Badge
                    variant="secondary"
                    className="text-[11px] font-semibold px-2.5 py-0.5"
                  >
                    Metrobús
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Próximo arribo en vivo si hay telemetría activa */}
          {proximoArribo && (
            <div className="flex items-center justify-between rounded-[16px] bg-canvas-soft p-3 mt-1 border border-hairline-soft">
              <div className="flex items-center gap-2 text-text-muted">
                <Bus className="w-3.5 h-3.5 text-ink" />
                <span className="font-medium text-xs">Próximo colectivo</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-sm text-ink">
                  {proximoArribo.displayLabel}
                </span>
                <span className="text-text-muted text-[11px] ml-1.5">
                  (Unidad {proximoArribo.interno})
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
