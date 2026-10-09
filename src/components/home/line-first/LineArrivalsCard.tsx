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
  /** Sin superficie/borde: el contenido flota sobre el fondo (Home A). */
  bare?: boolean;
  className?: string;
}

/** "3 min" → valor grande + unidad chica; estados sin número quedan como texto. */
function ArrivalValue({ arrival, first }: { arrival: EstimacionLlegada; first: boolean }) {
  const status = arrival.displayStatus;
  if (status === 'en-parada' || status === 'arribando' || arrival.minutos === 0) {
    return (
      <span className={cn('text-[15px] font-extrabold leading-tight', first ? 'text-electric-blue' : 'text-ink')}>
        {status === 'arribando' ? 'Arribando' : 'En parada'}
      </span>
    );
  }
  return (
    <span className={cn('font-black leading-none tabular-nums tracking-tight text-ink', first ? 'text-[30px]' : 'text-[26px]')}>
      {arrival.minutos}
      <span className="ml-0.5 text-xs font-bold tracking-normal text-text-muted">min</span>
    </span>
  );
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
  bare = false,
  className,
}: LineArrivalsCardProps) {
  const { line, recorrido, stop, canSwitchDirection } = context;
  const stopLabel = shortStopName(stop.nombre);

  return (
    <section
      aria-label={`Línea ${line.numero}, parada ${stopLabel}`}
      className={cn(bare ? 'px-1 py-0' : 'home-surface rounded-3xl border border-hairline p-4', className)}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full text-xl font-black tabular-nums"
          style={{
            background: `linear-gradient(150deg, color-mix(in srgb, ${line.color} 70%, white), ${line.color} 58%)`,
            color: line.textColor,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,.3), 0 10px 20px -12px ${line.color}`,
          }}
          aria-hidden="true"
        >
          {line.numero}
        </span>
        <button
          type="button"
          onClick={onOpenStopPicker}
          aria-label={`Cambiar parada. Parada actual: ${stop.nombre}`}
          className="group min-w-0 flex-1 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue"
        >
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Tu parada</span>
          <span className="mt-0.5 block text-[17px] font-bold leading-tight text-ink break-words">
            Línea {line.numero} · {stopLabel}
            <ChevronDown
              className="ml-1 inline h-4 w-4 align-[-2px] text-text-muted transition-colors group-hover:text-ink"
              aria-hidden="true"
            />
          </span>
        </button>
      </div>

      <div className={cn('flex items-center gap-2', bare ? 'mt-2' : 'mt-3')}>
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-text-muted">
          {recorrido.origen} <span aria-hidden="true">→</span> {recorrido.destino}
        </p>
        <button
          type="button"
          onClick={onToggleDirection}
          disabled={!canSwitchDirection}
          aria-label={canSwitchDirection ? 'Cambiar dirección' : 'Este ramal tiene un solo sentido'}
          className="inline-flex size-[62px] shrink-0 items-center justify-center gap-1 rounded-full border border-electric-blue/40 bg-electric-blue/10 text-electric-blue transition-[background-color,transform] duration-150 hover:bg-electric-blue/15 active:scale-95 disabled:opacity-40 disabled:active:scale-100"
        >
          <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="text-[10px] font-bold leading-[1.05]">
            Cambiar<br />dirección
          </span>
        </button>
      </div>

      <div className={cn('home-well rounded-2xl px-3', bare ? 'mt-2 pb-2.5 pt-2' : 'mt-3 pb-3 pt-2.5')}>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
            <span className="home-live-dot absolute inset-0 rounded-full bg-emerald-500" />
          </span>
          <p className="text-sm font-semibold text-ink">Próximos colectivos en esta parada</p>
        </div>
        {frequencyMin > 0 && (
          <p className="mt-0.5 pl-4 text-xs text-text-muted">
            Pasa cada ~{frequencyMin} min · unos {perHour} en la próxima hora
          </p>
        )}
        {arrivals.length > 0 ? (
          <ul aria-live="polite" className={cn('grid grid-cols-3 divide-x divide-hairline', bare ? 'mt-2' : 'mt-3')}>
            {arrivals.map((arrival, index) => (
              <li
                key={`${stop.id}-${arrival.interno}`}
                className={cn('home-eta flex flex-col items-center justify-center gap-1 px-1 text-center', bare ? 'min-h-[56px]' : 'min-h-[64px]')}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <ArrivalValue arrival={arrival} first={index === 0} />
                <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                  <Bus className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {arrival.simulated ? 'Estimado' : 'En recorrido'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-text-muted">Buscando colectivos en camino…</p>
        )}
      </div>
    </section>
  );
}
