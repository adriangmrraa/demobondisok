'use client';

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type TouchEvent, type WheelEvent } from 'react';
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

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;
const LABEL_MAX_CHARS = 14;

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

  // ── ViewBox dimensionado por N ─────────────────────────────────────────────
  // 52px por parada garantiza que labels de 14 chars a 11.5px NO se superpongan.
  // Para 25 paradas → viewW ≈ 1324px → scroll horizontal natural.
  const minPerStop = 52;
  const viewW = Math.max(360, stops.length * minPerStop + 24);
  const viewH = 220;
  const padX = 14;
  const headerY = 22;
  const trackY = 120;
  const labelNameY = trackY + 26;
  const labelTipoY = trackY + 44;

  // Labels en dos filas alternadas (pares arriba, impares abajo): con el pitch
  // de 52px una sola fila superpone nombres vecinos; la segunda fila duplica
  // el ancho disponible por label a ~104px.
  const LABEL_ROW_B = 34;
  const labelNameYB = labelNameY + LABEL_ROW_B;
  const labelTipoYB = labelTipoY + LABEL_ROW_B;

  const trackX1 = padX;
  const trackX2 = viewW - padX;
  const span = trackX2 - trackX1;

  // Font base generoso: empieza en 13px (legible), escala a 10.5 si hay muchas.
  const labelNameFontSize =
    stops.length <= 6 ? 13
      : stops.length <= 10 ? 12
        : stops.length <= 16 ? 11
          : stops.length <= 22 ? 10.5
            : 10;
  const labelTipoFontSize = 9;

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

  const lastTouchXRef = useRef<number | null>(null);
  const lastPinchDistRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Cambios posteriores: scroll suave para feedback visual.
  useEffect(() => {
    if (isFirstScrollRef.current) return; // ya lo manejó useLayoutEffect
    if (!highlightStopId) return;
    centerActiveStop(true);
  }, [highlightStopId]);

  // Si el contenido entra en el contenedor, el pan se ignora (derivado en
  // render — no hace falta resetear el state con un efecto).
  const renderPanX = effectiveW <= containerWidth ? 0 : panX;

  // ── Handlers touch ───────────────────────────────────────────────────────
  const getTouchDist = (touches: React.TouchList): number => {
    const dx = touches[0]!.clientX - touches[1]!.clientX;
    const dy = touches[0]!.clientY - touches[1]!.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 1) {
      lastTouchXRef.current = event.touches[0]!.clientX;
      setIsDragging(true);
    } else if (event.touches.length === 2) {
      setIsDragging(true);
      lastPinchDistRef.current = getTouchDist(event.touches);
    }
  };

  const onTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    if (event.touches.length === 1 && lastTouchXRef.current !== null) {
      const dx = event.touches[0]!.clientX - lastTouchXRef.current;
      lastTouchXRef.current = event.touches[0]!.clientX;
      setPanX((prev) => clampPan(prev + dx));
    } else if (event.touches.length === 2 && lastPinchDistRef.current !== null) {
      const newDist = getTouchDist(event.touches);
      const ratio = newDist / lastPinchDistRef.current;
      lastPinchDistRef.current = newDist;
      setZoom((prev) => clampZoom(prev * ratio));
    }
  };

  const onTouchEnd = () => {
    lastTouchXRef.current = null;
    lastPinchDistRef.current = null;
    setIsDragging(false);
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 1 : -1;
    setZoom((prev) => clampZoom(prev + delta * ZOOM_STEP));
  };

  // ── Handlers botones ──────────────────────────────────────────────────────
  const zoomIn = () => setZoom((prev) => clampZoom(prev + ZOOM_STEP));
  const zoomOut = () => setZoom((prev) => clampZoom(prev - ZOOM_STEP));
  const reset = () => {
    setZoom(1);
    setPanX(0);
  };

  const isModified = zoom !== 1 || renderPanX !== 0;

  // ── Render ───────────────────────────────────────────────────────────────
  const transformStyle: CSSProperties = {
    transform: `translateX(${renderPanX}px) scale(${zoom})`,
    transformOrigin: '0 0',
    transition: isDragging ? 'none' : 'transform 200ms ease-out',
  };

  const firstStopName = stops[0]?.nombre ?? '';
  const lastStopName = stops[stops.length - 1]?.nombre ?? '';

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

        {/* Paradas */}
        {stops.map((stop, i) => {
          const x = positions[i]!;
          const isFirst = i === 0;
          const isLast = i === stops.length - 1;
          const isHead = isFirst || isLast || stop.tipo === 'CABECERA';
          const isHighlight = highlightStopId === stop.id;
          const dotSize = isHead ? 6 : 4;
          const nameY = i % 2 === 0 ? labelNameY : labelNameYB;
          const tipoY = i % 2 === 0 ? labelTipoY : labelTipoYB;

          return (
            <g key={`${stop.id}-${reactId}`}>
              {/* Halo del dot destacado */}
              {isHighlight && (
                <circle cx={x} cy={trackY} r={dotSize + 5} fill={color} opacity={0.35} aria-hidden="true" />
              )}

              {/* Dot: cabeceras más grandes + ring interior; intermedias hollow */}
              {isHead ? (
                <>
                  <circle cx={x} cy={trackY} r={dotSize} fill={color} aria-hidden="true" />
                  <circle cx={x} cy={trackY} r={dotSize - 2.2} fill="white" aria-hidden="true" />
                </>
              ) : (
                <circle
                  cx={x}
                  cy={trackY}
                  r={dotSize}
                  fill="white"
                  stroke={color}
                  strokeWidth={isHighlight ? 2.5 : 2}
                  aria-hidden="true"
                />
              )}

              {/* Ring del highlight */}
              {isHighlight && (
                <circle
                  cx={x}
                  cy={trackY}
                  r={dotSize + 3}
                  fill="none"
                  stroke="white"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              )}

              {/* Label nombre — SIEMPRE visible */}
              <text
                x={x}
                y={nameY}
                textAnchor="middle"
                className="fill-canvas"
                style={{ fontSize: labelNameFontSize, fontWeight: isHead ? 700 : 600 }}
              >
                {truncate(stop.nombre, LABEL_MAX_CHARS)}
              </text>
              {/* Label tipo (entre paréntesis, debajo del nombre) */}
              {stop.tipo && (
                <text
                  x={x}
                  y={tipoY}
                  textAnchor="middle"
                  className="fill-text-muted"
                  style={{ fontSize: labelTipoFontSize, fontWeight: 600, letterSpacing: '0.04em' }}
                >
                  {stop.tipo}
                </text>
              )}

              {/* Hit area invisible para tooltip on long-press */}
              <circle cx={x} cy={trackY} r={12} fill="transparent" style={{ cursor: 'pointer' }}>
                <title>{stop.nombre}{stop.tipo ? ` (${stop.tipo})` : ''}</title>
              </circle>
            </g>
          );
        })}
      </svg>

      {/* Marcadores de inicio/fin abajo (esquina del SVG) — más legibles
          que los labels pequeños */}
      <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
        <span className="truncate">◤ {truncate(firstStopName, 16)}</span>
        <span className="truncate text-right">{truncate(lastStopName, 16)} ◢</span>
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
