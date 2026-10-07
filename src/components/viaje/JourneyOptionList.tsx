'use client';

import { ArrowRight, Footprints } from 'lucide-react';
import type { TripOption } from '@/types/trip-planner';

interface JourneyOptionListProps {
  options: TripOption[];
  selectedOptionId: string | null;
  onSelect: (optionId: string) => void;
}

export function JourneyOptionList({ options, selectedOptionId, onSelect }: JourneyOptionListProps) {
  return (
    <section aria-label="Alternativas de viaje" className="space-y-3">
      <div>
        <h2 className="text-lg font-black text-ink">Elegí cómo viajar</h2>
        <p className="text-sm text-text-muted">Compará las opciones antes de abrir el mapa.</p>
      </div>
      <div className="space-y-2">
        {options.map((option) => {
          const selected = option.id === selectedOptionId;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              aria-pressed={selected}
              className={`w-full min-h-[104px] rounded-2xl border p-4 text-left transition-colors active:scale-[0.99] ${
                selected ? 'border-electric-blue bg-electric-blue/10 ring-1 ring-electric-blue/30' : 'border-hairline bg-canvas hover:bg-canvas-soft'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xl font-black tabular-nums text-ink">{option.totalDurationMinutes} min</p>
                  <p className="mt-0.5 text-sm font-semibold leading-snug text-ink">{option.title}</p>
                </div>
                <ArrowRight className="mt-1 size-5 shrink-0 text-text-muted" aria-hidden />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {option.linesInvolved.length > 0 ? option.linesInvolved.map((line) => (
                  <span key={line.id} className="rounded-full px-2.5 py-1 text-xs font-black" style={{ backgroundColor: line.color, color: line.textColor }}>
                    {line.numero}
                  </span>
                )) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-canvas-soft px-2.5 py-1 text-xs font-bold text-ink"><Footprints className="size-3" /> A pie</span>
                )}
                <span className="text-xs font-medium text-text-muted">
                  {option.transfersCount === 0 ? 'Directo' : `${option.transfersCount} transbordo${option.transfersCount > 1 ? 's' : ''}`}
                  {' · '}{option.walkDurationMinutes} min a pie
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
