'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent, type ReactNode, type TouchEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CatalogLine } from '@/lib/home/line-first';

/** Ventana de tiempo (ms) entre dos taps para considerarlos "doble tap" en mobile. */
const DOUBLE_TAP_MS = 320;
/** Distancia mínima (px) para resolver el eje de un gesto de arrastre. */
const DRAG_THRESHOLD = 10;
/** Desplazamiento del hint idle: panea ~24px y vuelve. */
const IDLE_NUDGE_PX = 24;

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startLeft: number;
  axis: 'x' | 'y' | null;
  moved: boolean;
}

interface LineChipsProps {
  lines: CatalogLine[];
  selectedLineId: string | null;
  onSelect: (line: CatalogLine) => void;
  /**
   * Callback de confirmación: se dispara cuando el usuario hace DOBLE TAP
   * sobre una línea operativa. El padre decide si navega, muestra un toast,
   * o ambas cosas. Si se omite, no se hace nada en el doble tap.
   */
  onDoubleClickLine?: (lineId: string) => void;
  /** row: una fila con scroll horizontal · grid: todos los números desplegados. */
  layout?: 'row' | 'grid';
  /** Acción al final del carrusel (ej. "Ver todas"): no va encima, va en línea. */
  trailing?: ReactNode;
  /** Pulso del loop idle compartido del Home: cada incremento hace el nudge del carrusel. */
  idlePulse?: number;
}

export function LineChips({ lines, selectedLineId, onSelect, onDoubleClickLine, layout = 'row', trailing, idlePulse = 0 }: LineChipsProps) {
  const operational = lines.filter((line) => line.operational);
  const upcoming = lines.filter((line) => !line.operational);
  const chip = (line: CatalogLine, index: number, fill?: boolean) => (
    <Chip
      key={line.id}
      line={line}
      index={index}
      selected={line.id === selectedLineId}
      onSelect={onSelect}
      onDoubleClickLine={onDoubleClickLine}
      fill={fill}
    />
  );

  if (layout === 'grid') {
    return (
      <div aria-label="Líneas" className="flex flex-col gap-3">
        <div className="grid grid-cols-5 gap-2">{operational.map((line, i) => chip(line, i, true))}</div>
        {upcoming.length > 0 && (
          <>
            <GroupLabel>Próximamente</GroupLabel>
            <div className="grid grid-cols-5 gap-2">
              {upcoming.map((line, i) => chip(line, operational.length + i, true))}
            </div>
          </>
        )}
        {trailing && <div className="flex justify-end">{trailing}</div>}
      </div>
    );
  }

  return (
    <RowCarousel
      idlePulse={idlePulse}
      trailing={trailing}
      lineCount={operational.length + upcoming.length}
    >
      {operational.map((line, i) => chip(line, i))}
      {upcoming.length > 0 && (
        <span className="mx-1 flex shrink-0 items-center gap-2 self-stretch" aria-hidden="true">
          <span className="h-8 w-px bg-hairline" />
          <span className="[writing-mode:vertical-rl] rotate-180 text-[9px] font-bold uppercase tracking-[0.14em] text-text-faint">
            Pronto
          </span>
        </span>
      )}
      {upcoming.map((line, i) => chip(line, operational.length + i))}
    </RowCarousel>
  );
}

/**
 * Banda scrolleable del carrusel: pan por arrastre con bloqueo de eje, hint
 * idle (panea y vuelve) y flechas overlay que aparecen según el scroll
 * disponible. El arrastre NUNCA selecciona: la línea se elige solo por tap.
 */
function RowCarousel({ idlePulse, trailing, lineCount, children }: { idlePulse: number; trailing?: ReactNode; lineCount: number; children: ReactNode }) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const interactedRef = useRef(false);
  const [edges, setEdges] = useState({ left: false, right: false });

  const syncEdges = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft < max - 1;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    syncEdges();
    const observer = new ResizeObserver(syncEdges);
    observer.observe(el);
    el.addEventListener('scroll', syncEdges, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', syncEdges);
    };
  }, [syncEdges, lineCount]);

  // Hint idle: un nudge suave y vuelta. Se apaga para siempre tras el primer
  // gesto/tap y respeta "reducir movimiento".
  useEffect(() => {
    if (!idlePulse || interactedRef.current) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = rowRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) return;
    const start = el.scrollLeft;
    const target = Math.min(start + IDLE_NUDGE_PX, max);
    if (target <= start) return;
    el.scrollTo({ left: target, behavior: 'smooth' });
    const back = window.setTimeout(() => {
      el.scrollTo({ left: start, behavior: 'smooth' });
    }, 850);
    return () => window.clearTimeout(back);
  }, [idlePulse]);

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.axis === 'x' && drag.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 250);
    }
    dragRef.current = null;
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    interactedRef.current = true;
    // Touch: dejamos que el navegador haga el scroll horizontal NATIVO (fluido,
    // con inercia y bloqueo de eje propio). El JS solo panea con mouse.
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const el = rowRef.current;
    if (!el) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: el.scrollLeft,
      axis: null,
      moved: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = rowRef.current;
    if (!drag || !el || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (drag.axis === null) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        drag.axis = 'x';
        try {
          el.setPointerCapture(event.pointerId);
        } catch {
          // El puntero ya no está activo (touch cancelado): seguimos sin captura.
        }
      } else {
        drag.axis = 'y';
        return;
      }
    }
    if (drag.axis !== 'x') return;
    drag.moved = true;
    el.scrollLeft = drag.startLeft - dx;
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  const scrollByPage = (direction: 1 | -1) => {
    interactedRef.current = true;
    const el = rowRef.current;
    if (!el) return;
    const page = Math.max(el.clientWidth * 0.8, 120);
    el.scrollBy({ left: direction * page, behavior: 'smooth' });
  };

  return (
    <div className="relative -mx-4 -my-3.5">
      <div
        ref={rowRef}
        aria-label="Líneas"
        className={cn(
          'flex touch-pan-x touch-pan-y items-center gap-2 overflow-x-auto px-4 py-4 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          edges.left && 'carousel-fade-left',
          edges.right && 'carousel-fade-right',
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={() => {
          interactedRef.current = true;
        }}
        onClickCapture={handleClickCapture}
      >
        {children}
        {trailing}
      </div>
      {edges.left && (
        <button
          type="button"
          onClick={() => scrollByPage(-1)}
          aria-label="Desplazar líneas a la izquierda"
          className="absolute left-1 top-1/2 z-10 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-hairline bg-canvas/85 text-ink shadow-sm backdrop-blur-sm transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      {edges.right && (
        <button
          type="button"
          onClick={() => scrollByPage(1)}
          aria-label="Desplazar líneas a la derecha"
          className="absolute right-1 top-1/2 z-10 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-hairline bg-canvas/85 text-ink shadow-sm backdrop-blur-sm transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function Chip({
  line,
  index,
  selected,
  onSelect,
  onDoubleClickLine,
  fill,
}: {
  line: CatalogLine;
  index: number;
  selected: boolean;
  onSelect: (line: CatalogLine) => void;
  onDoubleClickLine?: (lineId: string) => void;
  fill?: boolean;
}) {
  const color = line.color ?? 'var(--electric-blue)';
  // Ref que registra el tiempo del último tap. Usado por onTouchStart para
  // detectar doble tap en mobile sin depender del delay de 300ms del
  // browser. En desktop, `onDoubleClick` sigue siendo el evento nativo.
  const lastTapRef = useRef<{ lineId: string; at: number } | null>(null);

  const handleDoubleTap = (lineId: string) => {
    if (!line.operational || !onDoubleClickLine) return;
    onDoubleClickLine(lineId);
  };

  const handleTouchStart = (event: TouchEvent<HTMLButtonElement>) => {
    if (event.touches.length !== 1) return; // ignorar multi-touch
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.lineId === line.id && now - last.at < DOUBLE_TAP_MS) {
      lastTapRef.current = null;
      handleDoubleTap(line.id);
      return;
    }
    lastTapRef.current = { lineId: line.id, at: now };
  };

  return (
    <button
      type="button"
      onClick={() => onSelect(line)}
      onDoubleClick={() => handleDoubleTap(line.id)}
      onTouchStart={handleTouchStart}
      aria-pressed={selected}
      aria-label={
        line.operational
          ? `Línea ${line.number}. Doble tap para ver su diagrama.`
          : `Línea ${line.number}, todavía no disponible en la demo`
      }
      style={
        {
          '--i': index,
          ...(selected
            ? {
                '--lc': color,
                background: `radial-gradient(56% 44% at 32% 18%, rgba(255,255,255,.42), transparent 62%), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='96' height='96' filter='url(%23n)' opacity='.05'/%3E%3C/svg%3E"), linear-gradient(150deg, color-mix(in srgb, ${color} 72%, white), ${color} 55%)`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,.34), inset 0 -7px 12px rgba(0,0,0,.26), 0 0 0 1px color-mix(in srgb, ${color} 42%, transparent), 0 10px 22px -10px ${color}`,
              }
            : {}),
        } as CSSProperties
      }
      className={cn(
        'home-chip shrink-0 rounded-full text-[17px] font-black italic tabular-nums transition-[background-color,color,box-shadow] duration-200 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        fill ? 'aspect-square w-full' : 'size-16',
        selected
          ? 'chip-halo text-white'
          : line.operational
            ? 'chip-orb border border-hairline bg-canvas/60 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.18),inset_0_-6px_12px_rgba(0,0,0,.12),0_6px_16px_-12px_rgba(0,0,0,.6)] hover:bg-canvas-soft'
            : 'border border-dashed border-hairline bg-transparent text-text-muted hover:text-ink',
      )}
    >
      {line.number}
    </button>
  );
}

function GroupLabel({ children }: { children: string }) {
  return <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-faint">{children}</span>;
}


