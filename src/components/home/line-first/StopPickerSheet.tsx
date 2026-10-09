'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LineFirstContext } from '@/lib/home/line-first';

interface StopPickerSheetProps {
  open: boolean;
  context: LineFirstContext;
  onClose: () => void;
  onSelectStop: (stopId: string) => void;
  onSelectRamal: (ramalId: string) => void;
}

/**
 * Elegí tu parada dentro del recorrido (lista tipo diagrama + buscador).
 * El diagrama completo de la línea sigue disponible desde acá.
 */
export function StopPickerSheet({ open, context, onClose, onSelectStop, onSelectRamal }: StopPickerSheetProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { line, ramal, recorrido, stop, stops } = context;

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  const visibleStops = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return stops;
    return stops.filter((s) => `${s.nombre} ${s.direccion ?? ''}`.toLowerCase().includes(normalized));
  }, [query, stops]);

  if (!open) return null;

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="stop-picker-title"
        className="home-rise flex max-h-[85dvh] w-full max-w-[420px] flex-col rounded-t-3xl border border-hairline bg-canvas p-4 shadow-2xl sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="stop-picker-title" className="text-lg font-bold text-ink">
              Elegí tu parada · Línea {line.numero}
            </h2>
            <p className="mt-0.5 text-sm text-text-muted line-clamp-1">
              {recorrido.origen} → {recorrido.destino}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-canvas-soft text-text-muted hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {line.ramales.length > 1 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-text-muted">Ramal</p>
            <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {line.ramales.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelectRamal(r.id)}
                  aria-pressed={r.id === ramal.id}
                  title={r.nombre}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    r.id === ramal.id
                      ? 'border-transparent bg-electric-blue text-white'
                      : 'border-hairline bg-canvas-soft text-ink hover:bg-field',
                  )}
                >
                  {r.codigo && r.codigo.length <= 2 ? `Ramal ${r.codigo}` : r.codigo || r.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="relative mt-3 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            inputMode="search"
            placeholder="Buscá tu parada. Ej. Hospital Naval"
            aria-label="Nombre de la parada"
            className="min-h-[48px] w-full rounded-xl border border-hairline bg-canvas-soft py-2 pl-10 pr-3 text-base text-ink outline-none focus:ring-2 focus:ring-ink/20"
          />
        </label>

        <ol aria-live="polite" className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {visibleStops.map((s) => {
            const selected = s.id === stop.id;
            return (
              <li key={s.id} className="relative">
                <span aria-hidden="true" className="absolute bottom-0 left-[15px] top-0 w-0.5" style={{ backgroundColor: line.color, opacity: 0.35 }} />
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    onSelectStop(s.id);
                  }}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'relative flex min-h-[52px] w-full items-center gap-3 rounded-xl py-2 pl-1 pr-2 text-left transition-colors hover:bg-canvas-soft',
                    selected && 'bg-canvas-soft',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="z-10 h-[22px] w-[22px] shrink-0 rounded-full border-[3px] bg-canvas"
                    style={{ borderColor: line.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm leading-tight text-ink break-words', selected && 'font-bold')}>
                      {s.nombre}
                    </span>
                    {s.direccion && <span className="block text-xs text-text-muted line-clamp-1">{s.direccion}</span>}
                  </span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-electric-blue" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
          {visibleStops.length === 0 && (
            <li className="rounded-xl bg-canvas-soft p-3 text-sm text-text-muted">
              No encontramos esa parada en este sentido. Probá cambiando la dirección.
            </li>
          )}
        </ol>

        <Link
          href={`/diagrama/${line.id}`}
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-2xl border border-hairline bg-canvas-soft text-sm font-semibold text-ink hover:bg-field"
        >
          Ver diagrama completo de la línea {line.numero}
        </Link>
      </section>
    </div>
  );
}
