"use client";

import { motion, useReducedMotion } from "motion/react";
import { Bus, ArrowRight } from "lucide-react";
import type { ActiveBusInTransit } from "@/lib/services/stop-schedule-service";

interface InlineBusIndicatorProps {
  bus: ActiveBusInTransit;
  color?: string;
}

/**
 * InlineBusIndicator — Representación viva del colectivo navegando en el riel vertical.
 * Se intercala dinámicamente entre dos paradas consecutivas (Sugerencia 1).
 */
export function InlineBusIndicator({
  bus,
  color = "#0EA5E9",
}: InlineBusIndicatorProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative py-1 my-0.5">
      {/* 1. Continuación del riel vertical de fondo */}
      <div
        className="absolute left-[28px] -translate-x-1/2 top-0 bottom-0 w-[2px] bg-hairline z-0"
        aria-hidden="true"
      />

      {/* 2. Pastilla de Colectivo en Viaje */}
      <motion.div
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-canvas border border-hairline"
      >
        {/* Dot / Icono del colectivo */}
        <div className="flex items-center justify-center shrink-0 w-7 h-7 relative z-10">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white"
            style={{ backgroundColor: color }}
          >
            <Bus className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Datos de la unidad y destino inmediato */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink truncate">
              Unidad {bus.unitId}
            </span>
            <span className="text-[11px] font-medium text-text-muted tabular-nums">
              {bus.speedKmh} km/h
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-text-muted truncate">
            <span>Hacia</span>
            <ArrowRight className="w-2.5 h-2.5 text-text-muted shrink-0" />
            <span className="font-medium text-ink truncate">
              {bus.toStop.nombre}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
