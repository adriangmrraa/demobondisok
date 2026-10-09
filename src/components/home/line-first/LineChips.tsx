'use client';

import { useRef, type CSSProperties, type ReactNode, type TouchEvent } from 'react';
import { cn } from '@/lib/utils';
import type { CatalogLine } from '@/lib/home/line-first';

/** Ventana de tiempo (ms) entre dos taps para considerarlos "doble tap" en mobile. */
const DOUBLE_TAP_MS = 320;

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
}

export function LineChips({ lines, selectedLineId, onSelect, onDoubleClickLine, layout = 'row', trailing }: LineChipsProps) {
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
    <div
      aria-label="Líneas"
      className="-mx-4 -my-3.5 flex items-center gap-2 overflow-x-auto px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
      {trailing}
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


