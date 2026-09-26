/**
 * PlaceSelector — PBI-019
 * Combo de "¿dónde estás esperando el colectivo?" para el asistente de
 * /inicio. Autocomplete sobre el geocoder local (searchLocations: avenidas
 * del STREET_INDEX, KNOWN_POIS y paradas del dataset). Quick chips de
 * avenidas para la demo sin tipear. Enter elige el primer match, Escape
 * cancela. Sin debounce extra: /inicio no corre un canvas WebGL detrás.
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, MapPin, CornerDownLeft } from 'lucide-react';
import { TripPlannerService } from '@/lib/services/trip-planner-service';
import type { LocationPoint } from '@/types/trip-planner';
import { cn } from '@/lib/utils';

interface PlaceSelectorProps {
  onSelect: (place: LocationPoint) => void;
  onCancel: () => void;
}

/** Avenidas/lugares mockeados para la demo (resueltos vía geocoder al tocar). */
const QUICK_PLACES = [
  'Av. Cabildo',
  'Av. Corrientes',
  'Av. Rivadavia',
  'Av. Santa Fe',
  '9 de Julio',
  'Parque Centenario',
] as const;

export function PlaceSelector({ onSelect, onCancel }: PlaceSelectorProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const results = useMemo(
    () => TripPlannerService.searchLocations(query).slice(0, 8),
    [query],
  );

  const choose = (place: LocationPoint) => onSelect(place);

  const chooseQuick = (label: string) => {
    const resolved =
      TripPlannerService.searchLocations(label)[0] ?? {
        name: label,
        lat: 0,
        lng: 0,
      };
    if (Number.isFinite(resolved.lat) && resolved.lat !== 0) choose(resolved);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-selector-title"
        className="w-full max-w-[360px] bg-canvas border border-hairline rounded-3xl p-4 shadow-[0_16px_45px_-6px_rgba(16,29,61,0.35)] animate-in fade-in slide-in-from-bottom-4 duration-200"
      >
        <h2 id="place-selector-title" className="text-base font-bold text-ink">
          ¿Dónde estás esperando el colectivo?
        </h2>

        <div className="group relative mt-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted transition-colors group-focus-within:text-ink pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (results[0]) choose(results[0]);
              }
            }}
            placeholder="Escribí una avenida o lugar (ej: Cabildo, Once)…"
            aria-label="Buscar avenida o lugar"
            autoComplete="off"
            className="w-full min-h-[46px] rounded-full bg-field border border-transparent pl-10 pr-11 text-sm text-ink placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-ink/20"
          />
          {query.trim() && results[0] && (
            <button
              type="button"
              onClick={() => choose(results[0])}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full text-electric-blue hover:opacity-80 flex items-center justify-center"
              aria-label={`Usar ${results[0].name}`}
              title={`Usar ${results[0].name}`}
            >
              <CornerDownLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Resultados o quick chips de avenidas para la demo */}
        {query.trim() ? (
          <ul className="mt-2 max-h-[240px] overflow-y-auto overscroll-contain no-scrollbar flex flex-col gap-1">
            {results.map((place, i) => (
              <li key={`${place.name}-${i}`}>
                <button
                  type="button"
                  onClick={() => choose(place)}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-canvas-soft active:scale-[0.99] transition-colors flex items-center gap-2.5"
                >
                  <span className="w-7 h-7 rounded-full bg-canvas-soft border border-hairline flex items-center justify-center shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-ink" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-ink truncate">
                      {place.name}
                    </span>
                    {place.address && (
                      <span className="block text-xs text-text-muted truncate">
                        {place.address}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-3 py-2 text-sm text-text-muted">
                No encuentro ese lugar. Probá con otra avenida o tocá una de abajo.
              </li>
            )}
          </ul>
        ) : (
          <div className="mt-3">
            <p className="text-xs font-semibold text-text-muted">Populares para la demo:</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_PLACES.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => chooseQuick(label)}
                  className={cn(
                    'min-h-[40px] px-3.5 rounded-full bg-canvas-soft hover:bg-field border border-hairline',
                    'text-xs font-semibold text-ink active:scale-[0.97] transition-all',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="mt-4 w-full min-h-[40px] text-sm font-semibold text-text-muted hover:text-ink hover:bg-canvas-soft rounded-xl transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
