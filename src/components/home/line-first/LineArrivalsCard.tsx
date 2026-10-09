'use client';

import { ArrowLeftRight, Bus, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { shortStopName, type LineFirstContext } from '@/lib/home/line-first';
import type { EstimacionLlegada } from '@/types/transport';

interface LineArrivalsCardProps {
  context: LineFirstContext;
  arrivals: EstimacionLlegada[];
  frequencyMin: number;
  perHour: number;
  onToggleDirection: () => void;
  onOpenStopPicker: () => void;
  className?: string;
}

function arrivalLabel(arrival: EstimacionLlegada): string {
  return arrival.displayLabel ?? (arrival.minutos === 0 ? 'En parada' : `${arrival.minutos} min`);
}

/**
 * Línea · parada · sentido + próximos colectivos (docs/HOME-LINEA-FIRST.md §5).
 * Le habla a quien ya sabe qué colectivo toma: cuánto falta y cuántas opciones
 * hay ahora y en la próxima hora.
 */
export function LineArrivalsCard({
  context,
  arrivals,
  frequencyMin,
  perHour,
  onToggleDirection,
  onOpenStopPicker,
  className,
}: LineArrivalsCardProps) {
  const { line, recorrido, stop, canSwitchDirection } = context;
  const stopLabel = shortStopName(stop.nombre);

  return (
    <section
      aria-label={`Línea ${line.numero}, parada ${stopLabel}`}
      className={cn('rounded-2xl border border-hairline bg-canvas p-3', className)}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl font-black tabular-nums"
          style={{ backgroundColor: line.color, color: line.textColor }}
          aria-hidden="true"
        >
          {line.numero}
        </span>
        <button
          type="button"
          onClick={onOpenStopPicker}
          aria-label={`Cambiar parada. Parada actual: ${stop.nombre}`}
          className="min-w-0 flex-1 rounded-xl text-left transition-colors hover:bg-canvas-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue"
        >
          <span className="text-base font-bold leading-tight text-ink break-words">
            Línea {line.numero} · {stopLabel}
            <ChevronDown className="ml-1 inline h-4 w-4 align-[-2px] text-text-muted" aria-hidden="true" />
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-text-muted">
            {recorrido.origen} → {recorrido.destino}
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleDirection}
          disabled={!canSwitchDirection}
          aria-label={canSwitchDirection ? 'Cambiar dirección' : 'Este ramal tiene un solo sentido'}
          className="flex shrink-0 flex-col items-center gap-0.5 rounded-xl border border-electric-blue/30 bg-electric-blue/10 px-2 py-2 text-[11px] font-semibold leading-tight text-electric-blue transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100"
        >
          <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          <span className="text-center">
            Cambiar
            <br />
            dirección
          </span>
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-hairline-soft bg-canvas-soft px-3 py-2.5">
        <p className="text-sm font-semibold text-ink">Próximos colectivos en esta parada</p>
        {frequencyMin > 0 && (
          <p className="mt-0.5 text-xs text-text-muted">
            Pasa cada ~{frequencyMin} min · unos {perHour} en la próxima hora
          </p>
        )}
        {arrivals.length > 0 ? (
          <ul aria-live="polite" className="mt-2 grid grid-cols-3 divide-x divide-hairline">
            {arrivals.map((arrival) => (
              <li key={arrival.interno} className="flex items-center gap-1.5 px-2 first:pl-0 last:pr-0">
                <Bus className="h-5 w-5 shrink-0 text-electric-blue" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="whitespace-nowrap text-base font-extrabold leading-tight text-ink tabular-nums">
                    {arrivalLabel(arrival)}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {arrival.simulated ? 'Estimado' : 'En recorrido'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-text-muted">Buscando colectivos en camino…</p>
        )}
      </div>
    </section>
  );
}
