/**
 * RouteTimeline — Cronograma del recorrido en el panel del colectivo
 *
 * Línea de tiempo vertical: INICIO = círculo, FIN = cuadrado, cada parada
 * un punto, y el colectivo como dot vivo (color de línea + pulso
 * compartido de 1.8s con el mapa) insertado en su posición del trayecto.
 * Las paradas ya pasadas quedan atenuadas; la próxima va en negrita.
 */

'use client';

import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { StopAlongRoute } from '@/lib/map/route-progress';
import { cn } from '@/lib/utils';
import { Check, Bus } from 'lucide-react';

interface RouteTimelineProps {
  color: string;
  onColor: string;
  stops: StopAlongRoute[];
  busProgress: number;
  busAlongM: number;
  speedKmh: number;
  shortName: string;
}

const PULSE_ANIMATION = 'rutaba-live-pulse 1.8s ease-in-out infinite';

export function RouteTimeline({
  color,
  onColor,
  stops,
  busProgress,
  busAlongM,
  speedKmh,
  shortName,
}: RouteTimelineProps) {
  const reduceMotion = useReducedMotion();
  const busRowRef = useRef<HTMLDivElement>(null);
  const busIndex = stops.findIndex((s) => s.progress >= busProgress);

  useEffect(() => {
    busRowRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [busIndex, reduceMotion]);

  if (stops.length === 0) return null;

  const nextStop = busIndex >= 0 ? stops[busIndex] : null;
  const rows = stops.length + 1;
  const busRow = busIndex >= 0 ? busIndex : rows - 1;
  const fillPct = ((busRow + 0.5) / rows) * 100;

  const etaTo = (stop: StopAlongRoute): number =>
    Math.max(1, Math.round((Math.max(0, stop.alongM - busAlongM) / 1000 / (speedKmh || 15)) * 60));

  return (
    <div role="list" className="relative pl-1 select-none">
      {/* Rail base + relleno hasta el colectivo */}
      <div
        className="absolute bottom-4 left-[13px] top-4 w-0.5 rounded bg-zinc-200 dark:bg-zinc-800"
        aria-hidden="true"
      />
      <div
        className="absolute left-[13px] top-4 w-0.5 rounded transition-all duration-500"
        style={{ height: `calc(${fillPct}% - 16px)`, backgroundColor: color, maxHeight: 'calc(100% - 32px)' }}
        aria-hidden="true"
      />

      {/* INICIO — círculo */}
      <div role="listitem" className="relative z-10 flex items-center gap-3 pb-1">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white dark:bg-zinc-900 shadow-sm"
          style={{ border: `2.5px solid ${color}` }}
          aria-hidden="true"
        />
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Inicio del recorrido
        </p>
      </div>

      {/* Paradas + colectivo vivo */}
      <div className="relative">
        {stops.map((stop, index) => {
          const passed = stop.progress < busProgress;
          return (
            <div
              key={stop.id}
              role="listitem"
              className="relative z-10 flex items-center gap-3 py-1.5"
            >
              <span
                className="ml-[7px] h-2.5 w-2.5 shrink-0 rounded-full border-2 bg-white dark:bg-zinc-900 transition-colors"
                style={{
                  borderColor: color,
                  backgroundColor: passed ? color : undefined,
                }}
                aria-hidden="true"
              />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-sm transition-opacity',
                  passed
                    ? 'text-zinc-400 dark:text-zinc-500 opacity-60'
                    : stop === nextStop
                      ? 'font-bold text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-700 dark:text-zinc-300',
                )}
              >
                {stop.name}
              </span>
              {/* Cronograma real */}
              {passed ? (
                <Check className="w-4 h-4 text-emerald-500 opacity-70 shrink-0" aria-hidden="true" />
              ) : (
                <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
                  {etaTo(stop)} min
                </span>
              )}
              <span className="sr-only">Parada {index + 1} de {stops.length}</span>
            </div>
          );
        })}

        {/* Colectivo vivo: dot en el trayecto */}
        {busIndex >= 0 && (
          <motion.div
            ref={busRowRef}
            layout="position"
            className="relative z-10 flex items-center gap-3 py-1"
            transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeInOut' }}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center">
              <span
                className="h-4 w-4 rounded-full ring-4 ring-white dark:ring-zinc-900 shadow-md"
                style={{ backgroundColor: color, animation: reduceMotion ? undefined : PULSE_ANIMATION }}
                aria-hidden="true"
              />
            </span>
            <span
              className="flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold shadow-sm"
              style={{ backgroundColor: color, color: onColor }}
            >
              <Bus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Colectivo {shortName} en trayecto
            </span>
          </motion.div>
        )}
      </div>

      {/* FIN — cuadrado */}
      <div role="listitem" className="relative z-10 flex items-center gap-3 pt-1">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-white dark:bg-zinc-900 shadow-sm"
          style={{ border: `2.5px solid ${color}` }}
          aria-hidden="true"
        />
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Fin del recorrido
        </p>
      </div>
    </div>
  );
}
