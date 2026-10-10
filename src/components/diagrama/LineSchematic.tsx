'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';

interface LineSchematicStop {
  id: string;
  nombre: string;
  tipo?: string;
}

interface LineSchematicProps {
  origin: string;
  eta?: string;
  color: string;
  stops: LineSchematicStop[];
  highlightStopId?: string;
  className?: string;
}

/**
 * Ancho fijo por parada (w-32 = 128px en Tailwind). El `paddingInline: calc(50% - 64px)`
 * del scroller depende de este valor: padding = (viewport - stopWidth) / 2.
 * Si cambiás STOP_W_CLASSES, actualizá también el `-64px` del padding.
 */
const STOP_W_CLASSES = 'w-32 sm:w-32';
const STOP_W_PX = 128;
const STOP_W_HALF_PX = STOP_W_PX / 2;

/** Tamaño del dot para paradas cabecera (inicio/fin). Intermedias usan 12px. */
const DOT_SIZE_HEAD = 14;

/**
 * Diagrama Lineal Horizontal de UNA línea.
 *
 * Arquitectura (centrado vertical con top-1/2):
 *   - Contenedor scrollable: `overflow-x-auto snap-x snap-mandatory` + padding
 *     lateral `paddingInline: calc(50%-64px)` para que la PRIMERA y la ÚLTIMA
 *     estación también puedan quedar exactamente al centro de la pantalla
 *     cuando estén activas.
 *   - Cada parada es un `<li>` con `h-full` (llena la altura del <ul>) y el
 *     dot posicionado en `top-1/2 -translate-y-1/2` → siempre en el centro
 *     vertical del componente, sin importar la altura del scroller.
 *   - Track line: dos `<div>` absolutos (halo + línea principal) en
 *     `top-1/2 -translate-y-1/2` del scroller → pasa EXACTAMENTE por el
 *     centro del dot. Sin hardcodear píxeles: funciona para cualquier altura
 *     (200px en variant A, 220px en variant B, etc).
 *   - Auto-scroll programático: `useLayoutEffect` (en mount, instantáneo) +
 *     `useEffect` (en cambios de `highlightStopId`, smooth). El centrado se
 *     hace con cálculo manual de `offsetLeft` + `container.scrollTo`, no con
 *     `scrollIntoView` (que es relativo al viewport).
 */
export function LineSchematic({
  origin,
  eta,
  color,
  stops,
  highlightStopId,
  className,
}: LineSchematicProps) {
  const reactId = useId();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLLIElement | null>(null);
  // True hasta el primer auto-scroll; se usa para diferenciar mount (instant)
  // de cambios posteriores (smooth). Evita el "salto" visual en la carga.
  const isFirstScrollRef = useRef(true);

  const firstStopName = stops[0]?.nombre ?? '';
  const lastStopName = stops[stops.length - 1]?.nombre ?? '';

  // ── Stop activo (memo para no recalcular en cada render) ────────────────
  const activeIndex = useMemo(
    () => stops.findIndex((s) => s.id === highlightStopId),
    [stops, highlightStopId],
  );

  /**
   * Centra el stop activo en el SCROLLER (no en el viewport del browser).
   *
   * Cálculo manual con `offsetLeft` en vez de `scrollIntoView({ inline: 'center' })`
   * por estas razones:
   *   1. Determinístico: no depende del `offsetParent` ni de cómo el browser
   *      interpreta `scroll-padding-inline` (Safari y Chrome se comportan distinto).
   *   2. Relativo al contenedor: centra respecto al scroller de la card, no
   *      respecto al viewport (que puede tener zoom, devtools, etc).
   *   3. Incluye el padding lateral del <ul>: la primera/última parada puede
   *      quedar al centro gracias al `paddingInline: calc(50% - 64px)`.
   *
   * Fórmula:
   *   scrollLeft = offsetLeft - (containerWidth / 2) + (itemWidth / 2)
   *
   *   - `offsetLeft`        = x del borde izquierdo del <li> relativo al scroller
   *                          (YA incluye el padding-inline del <ul>).
   *   - `containerWidth/2`  = centro visible del scroller.
   *   - `itemWidth/2`       = mitad del ancho del stop; desplaza la fórmula
   *                          desde el borde izquierdo al CENTRO del stop.
   *
   *   Ejemplo con scroller de 360px, stop de 128px, primer stop:
   *     offsetLeft = 116 (padding-left 116px del <ul>)
   *     scrollLeft = 116 - 180 + 64 = 0  → no hace falta scroll, ya está al centro.
   *
   *   Ejemplo con el 5° stop (0-indexed = 4):
   *     offsetLeft = 116 + 4*128 = 628
   *     scrollLeft = 628 - 180 + 64 = 512 → scrollea 512px para centrarlo.
   *
   * - En mount → `behavior: 'auto'` (instantáneo, sin parpadeo).
   * - En cambios → `behavior: 'smooth'` (animación perceptible al cambiar de
   *   parada activa via toggle de dirección / sheet picker).
   */
  const centerActiveStop = (smooth: boolean) => {
    const el = activeItemRef.current;
    const container = scrollerRef.current;
    if (!el || !container) return;

    const scrollLeft =
      el.offsetLeft - (container.clientWidth / 2) + (el.clientWidth / 2);

    container.scrollTo({
      left: Math.max(0, scrollLeft),
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  // Mount: centrado instantáneo (sin parpadeo en la carga inicial).
  useLayoutEffect(() => {
    if (!highlightStopId) return;
    centerActiveStop(false);
    isFirstScrollRef.current = false;
  }, [highlightStopId]);

  // Cambios posteriores: scroll suave para feedback visual.
  useEffect(() => {
    if (isFirstScrollRef.current) return; // ya lo manejó useLayoutEffect
    if (!highlightStopId) return;
    centerActiveStop(true);
  }, [highlightStopId]);

  return (
    <div
      className={cn(
        'relative h-full w-full select-none overflow-hidden',
        className,
      )}
      role="application"
      aria-label="Diagrama lineal de la línea. Desliza horizontalmente para ver todas las paradas."
    >
      {/* ── Header: origin (izq) / eta (der) ─────────────────────────── */}
      <div className="pointer-events-none absolute left-3 right-3 top-2 z-20 flex items-start justify-between gap-2 text-xs">
        <p className="truncate font-bold text-ink">{origin}</p>
        {eta && (
          <p className="shrink-0 rounded-full bg-canvas/80 px-2 py-0.5 text-[10px] font-semibold text-text-muted backdrop-blur-md">
            {eta}
          </p>
        )}
      </div>

      {/* ── Scroller horizontal ─────────────────────────────────────── */}
      <div
        ref={scrollerRef}
        className="absolute inset-0 overflow-x-auto overflow-y-hidden snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden motion-reduce:scroll-auto"
        style={{
          // Scroll-padding: cuando snap-center empuja el primer/último stop al
          // centro, queremos que la "snap area" esté a `64px` del borde. Es el
          // complemento del padding lateral del <ul> (juntos permiten centrar
          // extremos sin que se peguen al borde del scroller).
          scrollPaddingInline: `${STOP_W_HALF_PX}px`,
        }}
      >
        {/*
          Padding horizontal `calc(50% - 64px)` en cada extremo:
          - 50% = mitad del viewport
          - 64px = mitad del ancho de parada (w-32 / 2)
          Resultado: la primera y la última parada tienen "espacio virtual"
          igual a la mitad del contenedor, así pueden quedar exactamente
          al centro de la pantalla cuando estén activas (snap-center + scrollIntoView).
        */}
        <ul
          className="flex h-full flex-row items-stretch justify-start"
          style={{
            minWidth: 'max-content',
            paddingInline: `calc(50% - ${STOP_W_HALF_PX}px)`,
          }}
          aria-label={`Paradas de la línea: ${stops.map((s) => s.nombre).join(', ')}`}
        >
          {stops.map((stop, i) => {
            const isFirst = i === 0;
            const isLast = i === stops.length - 1;
            const isHead = isFirst || isLast || stop.tipo === 'CABECERA';
            const isHighlight = highlightStopId === stop.id;
            const dotSize = isHead ? DOT_SIZE_HEAD : 12;

            return (
              <li
                key={`${stop.id}-${reactId}`}
                ref={isHighlight ? activeItemRef : null}
                data-stop-id={stop.id}
                className={cn(
                  'relative h-full shrink-0 snap-center px-1',
                  'transition-transform duration-300 ease-out',
                  STOP_W_CLASSES,
                  isHighlight && 'scale-105',
                )}
                style={{ minWidth: STOP_W_PX }}
              >
                {/* Dot: posicionado en `top-1/2 -translate-y-1/2` del <li>.
                    Como el <li> es `h-full` (llena el <ul> que llena el scroller),
                    el dot queda EXACTAMENTE en el centro vertical del componente,
                    sin importar la altura del scroller. */}
                <div
                  className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                  style={{ width: dotSize + 8, height: dotSize + 8 }}
                >
                  {/* Halo del highlight (anillo blanco animado) */}
                  {isHighlight && (
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full motion-safe:animate-pulse"
                      style={{
                        background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`,
                      }}
                    />
                  )}

                  <span
                    aria-hidden="true"
                    className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      width: dotSize,
                      height: dotSize,
                      backgroundColor: isHead ? color : 'white',
                      borderColor: color,
                      borderStyle: 'solid',
                      borderWidth: isHead ? 0 : isHighlight ? 3 : 2,
                      boxShadow: isHighlight
                        ? `0 0 0 2px white, 0 0 0 4px ${color}55`
                        : isHead
                          ? `0 0 0 2px ${color}`
                          : undefined,
                    }}
                  >
                    {isHead && (
                      <span
                        className="absolute left-1/2 top-1/2 block h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                </div>

                {/* Contenido DEBAJO del dot: label, sub-label, badge.
                    Posicionado a `top-1/2` (centro) + `mt-2` (8px debajo del dot). */}
                <div className="absolute inset-x-0 top-1/2 mt-2 flex flex-col items-center text-center">
                  <p
                    title={stop.nombre}
                    className={cn(
                      'block w-full truncate px-1 text-[10px] leading-tight sm:text-[11px]',
                      isHighlight
                        ? 'font-bold text-white'
                        : isHead
                          ? 'font-bold text-slate-300'
                          : 'font-medium text-slate-400',
                    )}
                  >
                    {stop.nombre}
                  </p>

                  {stop.tipo && stops.length <= 14 && (
                    <span
                      className={cn(
                        'mt-0.5 block w-full truncate text-[9px] font-semibold uppercase tracking-[0.08em]',
                        isHighlight ? 'text-slate-300' : 'text-slate-500',
                      )}
                    >
                      {stop.tipo}
                    </span>
                  )}

                  {(isFirst || isLast) && (
                    <span className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-text-muted">
                      {isFirst ? '◤ Inicio' : 'Fin ◢'}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* ── Track line (detrás de los dots) ────────────────────────
            Posicionado en `top-1/2 -translate-y-1/2` del scroller: pasa
            EXACTAMENTE por el centro vertical de cada dot (que también está
            en `top-1/2` de su <li> h-full). Sin píxeles hardcodeados:
            funciona para cualquier altura del componente. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full"
          style={{
            height: 8,
            background: color,
            opacity: 0.2,
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full"
          style={{
            height: 2.5,
            background: color,
          }}
        />
      </div>

      {/* ── Footer: ◤ origin / last ◢ ────────────────────────────── */}
      <div className="pointer-events-none absolute bottom-2 left-3 right-3 z-20 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
        <span className="truncate" title={firstStopName}>
          ◤ {truncate(firstStopName, 16)}
        </span>
        <span className="truncate text-right" title={lastStopName}>
          {truncate(lastStopName, 16)} ◢
        </span>
      </div>

      {/* ── Indicador de posición (chip sutil con el índice activo) ─── */}
      {activeIndex >= 0 && stops.length > 1 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full border border-hairline/40 bg-canvas/85 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-text-muted backdrop-blur-md"
        >
          {activeIndex + 1} / {stops.length}
        </div>
      )}
    </div>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trim() + '…';
}
