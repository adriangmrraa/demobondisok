'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Footprints } from 'lucide-react';
import type { TripOption } from '@/types/trip-planner';

interface JourneyOptionListProps {
  options: TripOption[];
  selectedOptionId: string | null;
  onSelect: (optionId: string) => void;
}

export function JourneyOptionList({ options, selectedOptionId, onSelect }: JourneyOptionListProps) {
  return (
    <section aria-label="Alternativas de viaje" className="space-y-3">
      <Link href="/inicio" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-ink hover:text-electric-blue">
        <ArrowLeft className="size-4" /> Volver al inicio
      </Link>
      <div>
        <h2 className="text-lg font-black text-ink">Elegí cómo viajar</h2>
        <p className="text-sm text-text-muted">Compará las opciones antes de abrir el mapa.</p>
      </div>
      <div className="space-y-2">
        {options.map((option, index) => {
          const selected = option.id === selectedOptionId;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              aria-pressed={selected}
              style={{ '--home-delay': `${180 + index * 90}ms` } as CSSProperties}
              className={`home-rise w-full min-h-[104px] rounded-3xl border p-4 text-left transition-[box-shadow,transform,background-color] duration-200 active:scale-[0.99] ${
                selected
                  ? 'border-electric-blue bg-electric-blue/10 shadow-[0_14px_30px_-16px_rgba(0,102,255,0.55)] ring-1 ring-electric-blue/40'
                  : 'home-surface border-hairline hover:bg-canvas-soft'
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
                  <span
                    key={line.id}
                    className="rounded-full px-2.5 py-1 text-xs font-black"
                    style={{
                      background: `linear-gradient(150deg, color-mix(in srgb, ${line.color} 72%, white), ${line.color} 55%)`,
                      color: line.textColor,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,.3), 0 8px 16px -10px ${line.color}`,
                    }}
                  >
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
