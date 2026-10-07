'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { LineBadge } from '@/components/ui/line-badge';
import { MOCK_LINES } from '@/mock/data';

interface LineLookupSheetProps {
  open: boolean;
  onClose: () => void;
}

export function LineLookupSheet({ open, onClose }: LineLookupSheetProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timeout);
  }, [open]);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return MOCK_LINES;
    return MOCK_LINES.filter((line) =>
      [line.shortName, line.name, line.direction].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [query]);

  const close = () => {
    setQuery('');
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 backdrop-blur-sm sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="line-lookup-title"
        className="w-full max-w-[420px] rounded-3xl border border-hairline bg-canvas p-4 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 id="line-lookup-title" className="text-lg font-bold text-ink">Buscar por línea</h2>
            <p className="mt-1 text-sm text-text-muted">Escribí el número para ver el recorrido sin abrir el mapa.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar búsqueda de línea" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-canvas-soft text-text-muted hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </header>
        <label className="relative mt-4 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            inputMode="numeric"
            placeholder="Ej. 65"
            aria-label="Número o nombre de línea"
            className="min-h-[48px] w-full rounded-xl border border-hairline bg-canvas-soft py-2 pl-10 pr-3 text-base text-ink outline-none focus:ring-2 focus:ring-ink/20"
          />
        </label>
        <ul aria-live="polite" className="mt-3 flex max-h-[320px] flex-col gap-2 overflow-y-auto">
          {matches.map((line) => (
            <li key={line.id} className="rounded-2xl border border-hairline-soft bg-canvas-soft p-3">
              <div className="flex items-start gap-3">
                <LineBadge shortName={line.shortName} color={line.color} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">Línea {line.shortName}</p>
                  <p className="mt-0.5 text-sm leading-snug text-text-muted">{line.direction}</p>
                  <p className="mt-1 text-xs font-medium text-text-muted">Resultado disponible: consultá sus paradas y próximos arribos.</p>
                </div>
              </div>
            </li>
          ))}
          {matches.length === 0 && <li className="rounded-xl bg-canvas-soft p-3 text-sm text-text-muted">No encontramos esa línea. Probá con 65 o 194.</li>}
        </ul>
      </section>
    </div>
  );
}