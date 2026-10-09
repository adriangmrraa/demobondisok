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
 * - ViewBox dimensionado por N de paradas (52px cada una) → labels legibles
 *   sin escala (NO usamos preserveAspectRatio para que el font no se reduzca).
 * - Scroll horizontal nativo cuando el viewBox excede el wrapper.
 * - Pan con 1 dedo, pinch zoom con 2 dedos, wheel zoom en desktop.
 * - Cabecera de inicio/fin en los extremos del track.
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

  // ── Posiciones ────────────────────────────────────────────────────────────
  const innerPad = Math.min(span * 0.06, 28);
  const usable = span - innerPad * 2;
  const positions = useMemo(
    () =>
      stops.map((_, i) => {
        if (stops.length === 1) return (trackX1 + trackX2) / 2;
        return trackX1 + innerPad + (usable * i) / (stops.length - 1);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stops.length, innerPad, usable, trackX1, trackX2],
  );

  // ── Estado pan/zoom ───────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const lastTouchXRef = useRef<number | null>(null);
  const lastPinchDistRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // ResizeObserver
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;
    const update = () => setContainerWidth(node.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // ── Clamps ────────────────────────────────────────────────────────────────
  const effectiveW = viewW * zoom;
  const minPanX = Math.min(0, containerWidth - effectiveW);
  const maxPanX = 0;
  const clampPan = (x: number): number => Math.max(minPanX, Math.min(maxPanX, x));
  const clampZoom = (z: number): number => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

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
      ref={wrapperRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onWheel={onWheel}
      className={cn('relative h-full w-full select-none touch-pan-y', className)}
      role="application"
      aria-label="Diagrama lineal de la línea. Desliza para navegar, pellizca para zoom."
    >
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        width={viewW}
        height={viewH}
        style={transformStyle}
        role="img"
        aria-label={`Diagrama lineal de la línea con ${stops.length} paradas, de ${origin}`}
        preserveAspectRatio="xMinYMid meet"
      >
        {/* Cabecera: origen → destino */}
        <text
          x={padX}
          y={headerY}
          className="fill-canvas"
          style={{ fontSize: 13, fontWeight: 700 }}
        >
          {origin}
        </text>
        {eta && (
          <text
            x={viewW - padX}
            y={headerY}
            textAnchor="end"
            className="fill-text-muted"
            style={{ fontSize: 11, fontWeight: 500 }}
          >
            {eta}
          </text>
        )}

        {/* MARCADORES DE INICIO Y FIN (cabeceras) — labels grandes arriba de los
            dots extremos para que sean inequívocos */}
        {stops[0] && (
          <text
            x={positions[0]!}
            y={headerY}
            textAnchor="start"
            className="fill-text-muted"
            style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em' }}
          >
            ◤ INICIO
          </text>
        )}
        {stops[stops.length - 1] && (
          <text
            x={positions[stops.length - 1]!}
            y={headerY}
            textAnchor="end"
            className="fill-text-muted"
            style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em' }}
          >
            FIN ◢
          </text>
        )}

        {/* Track halo */}
        <line
          x1={trackX1}
          x2={trackX2}
          y1={trackY}
          y2={trackY}
          stroke={color}
          strokeWidth={8}
          opacity={0.2}
          aria-hidden="true"
        />
        {/* Track principal */}
        <line
          x1={trackX1}
          x2={trackX2}
          y1={trackY}
          y2={trackY}
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          aria-hidden="true"
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

      {/* Controles de zoom */}
      <div className="pointer-events-auto absolute right-2 top-2 flex flex-col gap-1">
        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= ZOOM_MAX}
          aria-label="Acercar"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline/60 bg-canvas/90 text-ink shadow-sm backdrop-blur-md transition-colors hover:bg-canvas active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PlusIcon />
        </button>
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN}
          aria-label="Alejar"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline/60 bg-canvas/90 text-ink shadow-sm backdrop-blur-md transition-colors hover:bg-canvas active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MinusIcon />
        </button>
        {isModified && (
          <button
            type="button"
            onClick={reset}
            aria-label="Restablecer zoom"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-electric-blue/40 bg-electric-blue/10 text-electric-blue backdrop-blur-md transition-colors hover:bg-electric-blue/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue"
          >
            <ResetIcon />
          </button>
        )}
      </div>

      {/* Indicador de zoom */}
      {isModified && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-hairline/40 bg-canvas/80 px-2 py-0.5 text-[10px] font-semibold text-text-muted backdrop-blur-md">
          {zoom.toFixed(2).replace(/\.?0+$/, '')}x
        </div>
      )}
    </div>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trim() + '…';
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <line x1="7" y1="3" x2="7" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 7a4 4 0 1 0 1.2-2.85" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M3 3v2.5h2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}