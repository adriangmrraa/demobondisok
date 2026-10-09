'use client';

import { useState } from 'react';
import { Bus, ChevronRight } from 'lucide-react';
import { shortStopName } from '@/lib/home/line-first';
import type { SeededRoute } from '@/lib/home/seeded-routes';
import type { Line, Stop } from '@/lib/data-service';
import type { EstimacionLlegada } from '@/types/transport';

export interface RecentTripItem {
  seed: SeededRoute;
  origin: Stop;
  destination: Stop;
  line: Line;
  arrival: EstimacionLlegada | null;
  alertLabel: string | null;
}

interface RecentTripsProps {
  items: RecentTripItem[];
  onStart: (seed: SeededRoute) => void;
}

const COLLAPSED_COUNT = 2;

function etaText(arrival: EstimacionLlegada | null): string {
  if (!arrival) return 'Sin datos';
  if (arrival.displayStatus === 'en-parada' || arrival.minutos === 0) return 'En la parada';
  if (arrival.displayStatus === 'arribando') return 'Llegando';
  return `Llega en ${arrival.minutos} min`;
}

/** "Tus últimos viajes": cada tarjeta inicia ese viaje (mismo flujo que el historial anterior). */
export function RecentTrips({ items, onStart }: RecentTripsProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, COLLAPSED_COUNT);

  return (
    <section aria-labelledby="recent-trips-title">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="recent-trips-title" className="text-[20px] font-bold text-ink">
          Tus últimos viajes
        </h2>
        {items.length > COLLAPSED_COUNT && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-0.5 text-sm font-semibold text-electric-blue"
          >
            {expanded ? 'Ver menos' : 'Ver todos'}
            <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? '-rotate-90' : ''}`} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {visible.map(({ seed, origin, destination, line, arrival, alertLabel }) => (
          <button
            key={seed.id}
            type="button"
            onClick={() => onStart(seed)}
            aria-label={`Iniciar viaje en la línea ${line.shortName} desde ${origin.name} hacia ${destination.name}. ${etaText(arrival)}${alertLabel ? `. Alerta: ${alertLabel}` : ''}`}
            className="flex min-h-[76px] items-center gap-2 rounded-2xl border border-hairline bg-canvas p-2.5 text-left transition-all hover:bg-canvas-soft active:scale-[0.99]"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-black tabular-nums text-white"
              style={{ backgroundColor: line.color }}
              aria-hidden="true"
            >
              {line.shortName}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-sm font-bold leading-tight text-ink line-clamp-2 break-words" title={origin.name}>
                {shortStopName(origin.name)}
              </span>
              <span className="text-[11px] text-text-muted line-clamp-1" title={destination.name}>
                hacia {shortStopName(destination.name)}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-ink">
                <Bus className="h-3.5 w-3.5 shrink-0 text-electric-blue" aria-hidden="true" />
                <span className="whitespace-nowrap">{etaText(arrival)}</span>
              </span>
              {alertLabel && (
                <span className="mt-1 inline-flex h-4 items-center rounded-full bg-[#d97706]/10 px-1.5 text-[9px] font-bold tracking-wider text-[#d97706] animate-pulse">
                  {alertLabel}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
