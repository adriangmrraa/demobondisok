"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Clock, Footprints, ChevronDown, ChevronUp } from "lucide-react";
import type { StopLiveStatus } from "@/lib/services/stop-schedule-service";

interface StopSequenceItemProps {
  status: StopLiveStatus;
  isSelected: boolean;
  onSelect: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const SUBTE_COLORS: Record<string, string> = {
  A: "#00A3E0",
  B: "#E11D48",
  C: "#2563EB",
  D: "#16A34A",
  E: "#9333EA",
  H: "#FEA619",
};

/**
 * StopSequenceItem — Fila enriquecida de parada para la secuencia de la Línea 65.
 * Incorpora:
 * - Cuenta regresiva en vivo + hora exacta de arribo (ETA dual).
 * - Comparador de tiempo a pie (Walk feasibility).
 * - Badges de transbordo multimodal (Subte / Metrobús).
 * - Micro-acordeón con los próximos 3 horarios programados.
 */
export function StopSequenceItem({
  status,
  isSelected,
  onSelect,
  isFirst = false,
  isLast = false,
}: StopSequenceItemProps) {
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const {
    stop,
    etaMin,
    clockTime,
    isImminent,
    displayStatus,
    displayLabel,
    statusColor,
    walkComparison,
    scheduledNextSlots,
  } = status;

  const handleRowClick = () => {
    onSelect();
    setIsAccordionOpen((prev) => !prev);
  };

  return (
    <div className="relative">
      {/* 1. Riel vertical conectando las paradas */}
      <div
        className={`absolute left-[28px] -translate-x-1/2 w-[2px] bg-hairline z-0 ${
          isFirst ? "top-[28px] bottom-0" : isLast ? "top-0 h-[28px]" : "top-0 bottom-0"
        }`}
        aria-hidden="true"
      />

      {/* 2. Tarjeta interactiva de la parada */}
      <div
        onClick={handleRowClick}
        className={`relative z-10 min-h-[48px] flex flex-col p-2.5 rounded-[16px] cursor-pointer transition-colors ${
          isSelected
            ? "bg-canvas-soft border border-hairline"
            : "hover:bg-canvas-soft border border-transparent"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Nodo / Dot de la línea */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center shrink-0 w-7 h-7 relative z-10">
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                  isSelected
                    ? "bg-ink border-canvas ring-2 ring-ink"
                    : displayStatus === "en-parada"
                    ? "bg-ink border-canvas ring-2 ring-hairline animate-pulse"
                    : isImminent
                    ? "bg-ink border-canvas"
                    : "bg-canvas border-hairline"
                }`}
              />
            </div>

            {/* Nombre y dirección */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-ink truncate leading-tight">
                  {stop.nombre}
                </h4>
              </div>

              <p className="text-[11px] text-text-muted truncate mt-0.5">
                {stop.direccion}
              </p>

              {/* Transbordos Multimodales */}
              {stop.conexiones && (
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {stop.conexiones.subte?.map((lineaSubte) => (
                    <span
                      key={lineaSubte}
                      className="px-2 py-0.2 rounded-full text-[10px] font-bold text-white shadow-xs inline-flex items-center"
                      style={{ backgroundColor: SUBTE_COLORS[lineaSubte] || "#334155" }}
                      title={`Combinación Subte Línea ${lineaSubte}`}
                    >
                      {lineaSubte}
                    </span>
                  ))}

                  {stop.conexiones.metrobus && (
                    <span
                      className="px-2 py-0.2 rounded-full bg-canvas border border-hairline text-text-muted text-[10px] font-semibold"
                      title="Combinación con Metrobús 9 de Julio"
                    >
                      Metrobús
                    </span>
                  )}
                </div>
              )}

              {/* Factibilidad a Pie */}
              {walkComparison && (
                <div className="flex items-center gap-1 mt-1 text-[11px] font-medium text-text-muted">
                  <Footprints className="w-3 h-3 text-text-muted" />
                  <span>
                    {walkComparison.label} ({walkComparison.walkMin} min a pie)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Pastilla Lateral Derecha: Cuenta Regresiva + Hora (ETA Dual) */}
          <div className="flex flex-col items-end shrink-0 pl-1">
            <div className="px-2.5 py-0.5 rounded-full flex items-center gap-1.5 text-xs font-semibold bg-canvas border border-hairline text-ink">
              {displayStatus === "en-parada" ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-ink animate-pulse" />
                  <span>En parada</span>
                </>
              ) : displayStatus === "arribando" ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-ink animate-pulse" />
                  <span>Arribando</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-ink" />
                  <span>{displayLabel || `${etaMin} min`}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1 mt-1 text-[11px] font-normal text-text-muted">
              <Clock className="w-3 h-3" />
              <span>{clockTime} hs</span>
              {isAccordionOpen ? (
                <ChevronUp className="w-3 h-3 ml-0.5 text-text-muted" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-0.5 text-text-muted" />
              )}
            </div>
          </div>
        </div>

        {/* 3. Micro-Acordeón con los próximos 3 horarios programados */}
        <AnimatePresence>
          {isAccordionOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
              className="overflow-hidden pt-2.5 mt-2 border-t border-hairline-soft"
            >
              <div className="flex items-center justify-between text-[11px] font-medium text-text-muted mb-1.5">
                <span>Próximas pasadas programadas</span>
                <span className="text-ink font-semibold">Cada 15 min</span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {scheduledNextSlots.map((slot, idx) => (
                  <div
                    key={slot}
                    className={`px-3 py-1 rounded-full text-xs font-semibold tabular-nums ${
                      idx === 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-canvas border border-hairline text-ink"
                    }`}
                  >
                    {slot} hs
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
