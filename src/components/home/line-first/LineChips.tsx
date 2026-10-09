'use client';

import { cn } from '@/lib/utils';
import type { CatalogLine } from '@/lib/home/line-first';

interface LineChipsProps {
  lines: CatalogLine[];
  selectedLineId: string | null;
  onSelect: (line: CatalogLine) => void;
  /** row: una fila con scroll horizontal · grid: todos los números desplegados. */
  layout?: 'row' | 'grid';
}

/** Los números de línea a la vista: pulsás tu línea (feedback Metropol). */
export function LineChips({ lines, selectedLineId, onSelect, layout = 'row' }: LineChipsProps) {
  return (
    <div
      role="list"
      aria-label="Líneas"
      className={cn(
        layout === 'row'
          ? '-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'grid grid-cols-5 gap-2',
      )}
    >
      {lines.map((line) => {
        const selected = line.id === selectedLineId;
        return (
          <div role="listitem" key={line.id} className={layout === 'row' ? 'snap-start shrink-0' : undefined}>
            <button
              type="button"
              onClick={() => onSelect(line)}
              aria-pressed={selected}
              aria-label={
                line.operational
                  ? `Línea ${line.number}`
                  : `Línea ${line.number}, todavía no disponible en la demo`
              }
              className={cn(
                'h-12 w-full min-w-[60px] rounded-xl border px-3 text-[17px] font-bold tabular-nums transition-all active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue',
                selected
                  ? 'border-transparent text-white shadow-[0_6px_18px_-6px_rgba(0,102,255,0.6)]'
                  : 'border-hairline bg-canvas-soft text-ink hover:bg-field',
                !line.operational && 'text-text-faint border-dashed',
              )}
              style={selected ? { backgroundColor: line.color ?? 'var(--electric-blue)' } : undefined}
            >
              {line.number}
            </button>
          </div>
        );
      })}
    </div>
  );
}
