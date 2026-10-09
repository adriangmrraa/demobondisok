'use client';

import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { CatalogLine } from '@/lib/home/line-first';

interface LineChipsProps {
  lines: CatalogLine[];
  selectedLineId: string | null;
  onSelect: (line: CatalogLine) => void;
  /** row: una fila con scroll horizontal · grid: todos los números desplegados. */
  layout?: 'row' | 'grid';
  /** Acción al final del carrusel (ej. "Ver todas"): no va encima, va en línea. */
  trailing?: ReactNode;
}

function Chip({
  line,
  index,
  selected,
  onSelect,
  fill,
}: {
  line: CatalogLine;
  index: number;
  selected: boolean;
  onSelect: (line: CatalogLine) => void;
  fill?: boolean;
}) {
  const color = line.color ?? 'var(--electric-blue)';
  return (
    <button
      type="button"
      onClick={() => onSelect(line)}
      aria-pressed={selected}
      aria-label={line.operational ? `Línea ${line.number}` : `Línea ${line.number}, todavía no disponible en la demo`}
      style={
        {
          '--i': index,
          ...(selected
            ? {
                background: `linear-gradient(150deg, color-mix(in srgb, ${color} 72%, white), ${color} 55%)`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,.32), inset 0 -1px 0 rgba(0,0,0,.14), 0 0 0 1px color-mix(in srgb, ${color} 42%, transparent), 0 12px 26px -10px ${color}`,
              }
            : {}),
        } as CSSProperties
      }
      className={cn(
        'home-chip shrink-0 rounded-full text-[17px] font-bold tabular-nums transition-[background-color,color,box-shadow] duration-200 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        fill ? 'aspect-square w-full' : 'size-16',
        selected
          ? 'text-white'
          : line.operational
            ? 'border border-hairline bg-canvas/60 text-ink shadow-[0_6px_16px_-12px_rgba(0,0,0,.6)] hover:bg-canvas-soft'
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

/** Los números de línea a la vista: pulsás tu línea (feedback Metropol). */
export function LineChips({ lines, selectedLineId, onSelect, layout = 'row', trailing }: LineChipsProps) {
  const operational = lines.filter((line) => line.operational);
  const upcoming = lines.filter((line) => !line.operational);
  const chip = (line: CatalogLine, index: number, fill?: boolean) => (
    <Chip key={line.id} line={line} index={index} selected={line.id === selectedLineId} onSelect={onSelect} fill={fill} />
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
