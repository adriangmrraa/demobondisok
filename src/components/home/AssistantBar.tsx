/**
 * AssistantBar — buscador de destinos indexados del Home.
 * Elegir una sugerencia abre inmediatamente el flujo de viaje.
 */

'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowUp, MapPin, Search, X } from 'lucide-react';
import { TripPlannerService } from '@/lib/services/trip-planner-service';
import type { LocationPoint } from '@/types/trip-planner';
import { cn } from '@/lib/utils';

interface AssistantBarProps {
  /** Destino indexado que el usuario eligió. */
  onSubmit: (destination: LocationPoint) => void;
  className?: string;
}

const SUGGESTIONS_ID = 'home-destination-suggestions';

export function AssistantBar({ onSubmit, className }: AssistantBarProps) {
  const [text, setText] = useState('');
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(
    () => (text.trim() ? TripPlannerService.searchLocations(text).slice(0, 6) : []),
    [text],
  );
  const suggestionsOpen = suggestions.length > 0;

  const selectDestination = (destination: LocationPoint) => {
    onSubmit(destination);
    setText('');
    setActiveSuggestionIndex(-1);
    setMessage('');
  };

  const submit = () => {
    const activeDestination = activeSuggestionIndex >= 0 ? suggestions[activeSuggestionIndex] : null;
    if (!activeDestination) {
      setMessage('Elegí uno de los destinos sugeridos para continuar.');
      return;
    }
    selectDestination(activeDestination);
  };

  const clear = () => {
    setText('');
    setActiveSuggestionIndex(-1);
    setMessage('');
    inputRef.current?.focus();
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="relative">
        <div
          className={cn(
            'group flex items-center gap-2 rounded-full bg-field border border-transparent px-3.5 transition-shadow',
            'focus-within:ring-2 focus-within:ring-ink/20',
          )}
        >
          <Search className="w-4 h-4 shrink-0 text-text-muted transition-colors group-focus-within:text-ink" />
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={SUGGESTIONS_ID}
            aria-expanded={suggestionsOpen}
            aria-activedescendant={activeSuggestionIndex >= 0 ? `${SUGGESTIONS_ID}-${activeSuggestionIndex}` : undefined}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setActiveSuggestionIndex(-1);
              setMessage('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && suggestionsOpen) {
                e.preventDefault();
                setActiveSuggestionIndex((index) => Math.min(index + 1, suggestions.length - 1));
              }
              if (e.key === 'ArrowUp' && suggestionsOpen) {
                e.preventDefault();
                setActiveSuggestionIndex((index) => Math.max(index - 1, 0));
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                if (activeSuggestionIndex >= 0) {
                  selectDestination(suggestions[activeSuggestionIndex]);
                  return;
                }
                submit();
              }
              if (e.key === 'Escape') clear();
            }}
            placeholder="¿A dónde querés ir?"
            aria-label="¿A dónde querés ir?"
            className="flex-1 min-w-0 bg-transparent min-h-[46px] text-sm text-ink placeholder:text-text-faint focus:outline-none"
          />
          {text.trim() && (
            <button
              type="button"
              onClick={clear}
              aria-label="Borrar destino"
              className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-text-muted hover:text-ink hover:bg-canvas-soft transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            aria-label="Iniciar viaje"
            className={cn(
              'w-8 h-8 shrink-0 rounded-full bg-ink text-canvas flex items-center justify-center active:scale-95 transition-all',
              activeSuggestionIndex < 0 && 'opacity-35',
            )}
          >
            <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        {suggestionsOpen && (
          <ul
            id={SUGGESTIONS_ID}
            role="listbox"
            aria-label="Destinos sugeridos"
            className="absolute z-30 left-0 right-0 top-[calc(100%+0.5rem)] rounded-2xl border border-hairline bg-canvas p-1.5 shadow-lg"
          >
            {suggestions.map((place, index) => (
              <li key={`${place.id ?? place.name}-${index}`} role="presentation">
                <button
                  id={`${SUGGESTIONS_ID}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={activeSuggestionIndex === index}
                  onMouseEnter={() => setActiveSuggestionIndex(index)}
                  onClick={() => selectDestination(place)}
                  className={cn(
                    'w-full rounded-xl px-3 py-2.5 text-left flex items-center gap-2.5 transition-colors',
                    activeSuggestionIndex === index ? 'bg-canvas-soft' : 'hover:bg-canvas-soft',
                  )}
                >
                  <MapPin className="w-4 h-4 shrink-0 text-electric-blue" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{place.name}</span>
                    {place.address && <span className="block truncate text-[11px] text-text-muted">{place.address}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p aria-live="polite" className={cn('text-xs text-text-muted', !message && 'sr-only')}>
        {message}
      </p>
    </div>
  );
}
