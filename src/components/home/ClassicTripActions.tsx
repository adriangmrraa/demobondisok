'use client';

import { Map, MapPin, Navigation, Route } from 'lucide-react';

export type ClassicTripAction = 'line' | 'nearby' | 'destination' | 'map';

interface ClassicTripActionsProps {
  onSelect: (action: ClassicTripAction) => void;
}

const ACTIONS: Array<{
  id: ClassicTripAction;
  label: string;
  description: string;
  icon: typeof Route;
}> = [
  { id: 'line', label: 'Buscar línea', description: 'Ej. 65', icon: Route },
  { id: 'nearby', label: 'Paradas cerca', description: 'Usar mi ubicación', icon: MapPin },
  { id: 'destination', label: '¿A dónde vas?', description: 'Planear un viaje', icon: Navigation },
  { id: 'map', label: 'Explorar mapa', description: 'Ver la red', icon: Map },
];

export function ClassicTripActions({ onSelect }: ClassicTripActionsProps) {
  return (
    <section aria-labelledby="classic-trip-actions-title">
      <h2 id="classic-trip-actions-title" className="text-[20px] font-semibold text-ink">
        ¿Cómo querés buscar?
      </h2>
      <div className="mt-2 grid grid-cols-2 gap-2.5">
        {ACTIONS.map(({ id, label, description, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className="min-h-[92px] rounded-2xl border border-hairline bg-canvas p-3 text-left shadow-sm transition-all hover:bg-canvas-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 active:scale-[0.98]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-hairline bg-canvas-soft">
              <Icon className="h-4.5 w-4.5 text-ink" aria-hidden="true" />
            </span>
            <span className="mt-2 block text-sm font-bold text-ink">{label}</span>
            <span className="mt-0.5 block text-xs font-medium text-text-muted">{description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}