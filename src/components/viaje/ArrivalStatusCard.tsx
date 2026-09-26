"use client";

import { useEffect, useRef } from "react";
import type { ArrivalPhase } from "@/lib/trip-map-navigation";

interface ArrivalStatusCardProps {
  phase: ArrivalPhase;
  minutes: number | null;
  lineNumber: string;
  unitId: string;
  nextStopName?: string;
  onDismiss: () => void;
}

const HAPTIC_BY_PHASE: Partial<Record<ArrivalPhase, number | number[]>> = {
  ARRIBANDO: 24,
  PASSED: [14, 34, 18],
  VIAJANDO_GREEN: 18,
};

function RollingDuration({ value }: { value: number }) {
  return (
    <span aria-label={`${value} minutos`} className="arrival-rolling-duration">
      <span key={value} className="arrival-rolling-duration__value">{value}</span>
      <span aria-hidden="true" className="arrival-rolling-duration__unit"> min</span>
    </span>
  );
}

/** Presentational shell: the parent retains the arrival state machine. */
export default function ArrivalStatusCard({
  phase,
  minutes,
  lineNumber,
  unitId,
  nextStopName,
  onDismiss,
}: ArrivalStatusCardProps) {
  const previousPhaseRef = useRef<ArrivalPhase>(phase);

  useEffect(() => {
    if (previousPhaseRef.current === phase) return;
    previousPhaseRef.current = phase;
    const pattern = HAPTIC_BY_PHASE[phase];
    if (pattern && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  }, [phase]);

  const isArriving = phase === "ARRIBANDO";
  const isRiding = phase === "VIAJANDO_GREEN" || phase === "VIAJANDO_YELLOW";
  const phaseClass = `arrival-card--${phase.toLowerCase().replaceAll("_", "-")}`;

  return (
    <div className="absolute left-4 right-4 top-[calc(max(14px,env(safe-area-inset-top))+72px+var(--trip-stack-gap,0px))] z-30 mx-auto max-w-[320px] pointer-events-none">
      <div aria-live="polite" data-arrival-phase={phase} className={`arrival-card pointer-events-auto relative mt-0 flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 ${phaseClass}`}>
        {phase === "PASSED" && (
          <span aria-hidden="true" className="arrival-energy-spectrum">
            <span className="arrival-energy-spectrum__aura" />
            <span className="arrival-energy-spectrum__ribbon" />
            <span className="arrival-energy-spectrum__comet" />
            <span className="arrival-energy-spectrum__spark arrival-energy-spectrum__spark--one" />
            <span className="arrival-energy-spectrum__spark arrival-energy-spectrum__spark--two" />
            <span className="arrival-energy-spectrum__spark arrival-energy-spectrum__spark--three" />
          </span>
        )}
        <div className="min-w-0">
          <p className="arrival-card__eyebrow">{isRiding ? "Viajando" : "Tu colectivo"}</p>
          {isArriving ? (
            <p className="truncate text-sm font-black tracking-wide">ARRIBANDO · Línea {lineNumber}</p>
          ) : isRiding ? (
            <p className="truncate text-sm font-bold">VIAJANDO · Línea {lineNumber} · coche {unitId}{nextStopName ? ` → ${nextStopName}` : ""}</p>
          ) : (
            <p className="truncate text-sm font-bold">Línea {lineNumber} · coche {unitId}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {phase === "NORMAL" && minutes !== null && <span data-arrival-eta className="arrival-card__eta"><RollingDuration value={minutes} /></span>}
          <button type="button" onClick={onDismiss} title="Salir de la vista de viaje (se conserva el viaje)" aria-label="Ocultar vista de viaje" className="arrival-card__dismiss w-6 h-6 rounded-full flex items-center justify-center shrink-0">
            <span aria-hidden="true" className="text-base leading-none">×</span>
          </button>
        </div>
      </div>
    </div>
  );
}