'use client';

import Link from 'next/link';
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
  /** Destino por arribo: /mapas en modo viaje con esa unidad enfocada. */
  arrivalHref?: (arrival: EstimacionLlegada) => string;
  /** Sin superficie/borde: el contenido flota sobre el fondo (Home A). */
  bare?: boolean;
  /** Sin fila de dirección (texto origen→destino + botón Cambiar): arribos directo. */
  hideDirectionRow?: boolean;
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
  arrivalHref,
  bare = false,
  hideDirectionRow = false,
  className,
}: LineArrivalsCardProps) {
  const { line, recorrido, stop, canSwitchDirection } = context;
  const stopLabel = shortStopName(stop.nombre);

  return (
    <section
      aria-label={`Línea ${line.numero}, parada ${stopLabel}`}
      className={cn(bare ? 'px-1 py-0' : 'home-surface rounded-3xl border border-hairline p-3', className)}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn('inline-flex shrink-0 items-center justify-center rounded-full px-3 text-center font-bold uppercase leading-tight tracking-[0.08em]', bare ? 'h-11 text-[9px]' : 'h-12 text-[10px]')}
          style={{
            background: `linear-gradient(150deg, color-mix(in srgb, ${line.color} 70%, white), ${line.color} 58%)`,
            color: line.textColor,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,.3), 0 10px 20px -12px ${line.color}`,
          }}
          aria-hidden="true"
        >
          Todas las paradas
        </span>
        <button
          type="button"
          onClick={onOpenStopPicker}
          aria-label={`Cambiar parada. Parada actual: ${stop.nombre}`}
          className="group min-w-0 flex-1 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue"
        >
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Tu parada</span>
          <span className="mt-0.5 block text-[17px] font-bold leading-tight text-ink break-words">
            {stopLabel}
            <ChevronDown
              className="ml-1 inline h-4 w-4 align-[-2px] text-text-muted transition-colors group-hover:text-ink"
              aria-hidden="true"
            />
          </span>
        </button>
      </div>

      {hideDirectionRow ? null : (
        <div className="mt-3 flex items-center gap-2">
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
      )}

      <div className={cn('home-well rounded-2xl px-3', bare ? 'mt-1.5 pb-2 pt-1.5' : 'mt-2 pb-2.5 pt-2', 'overflow-hidden')}>
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
          <ul aria-live="polite" className={cn('grid grid-cols-3 divide-x divide-hairline', bare ? 'mt-1.5' : 'mt-2')}>
            {arrivals.map((arrival, index) => {
              const href = arrivalHref?.(arrival);
              const body = (
                <>
                  <ArrivalValue arrival={arrival} first={index === 0} />
                  <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                    <Bus className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {arrival.simulated ? 'Estimado' : 'En recorrido'}
                  </span>
                </>
              );
              return (
                <li
                  key={`${stop.id}-${arrival.interno}`}
                  className={cn('home-eta', bare ? 'min-h-[50px]' : 'min-h-[56px]')}
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  {href ? (
                    <Link
                      href={href}
                      aria-label={`Seguir el colectivo ${arrival.interno} de la línea ${line.numero} en el mapa en vivo`}
                      className="flex h-full min-h-[inherit] w-full flex-col items-center justify-center gap-0.5 px-1 text-center transition-colors hover:bg-canvas-soft/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue"
                    >
                      {body}
                    </Link>
                  ) : (
                    <span className="flex h-full min-h-[inherit] w-full flex-col items-center justify-center gap-0.5 px-1 text-center">{body}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-text-muted">Buscando colectivos en camino…</p>
        )}
      </div>
    </section>
  );
}
