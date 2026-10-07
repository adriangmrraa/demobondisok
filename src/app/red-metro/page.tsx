'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Map as MapIcon, X, Bus, ChevronRight } from 'lucide-react';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ZONAS_AMBA, lineasEnZona, type Zona } from '@/data/zonas-amba';
import { LineBadge } from '@/components/ui/line-badge';
import { LineDisplay } from '@/components/ui/line-display';

const ZONA_TYPE_LABEL: Record<Zona['type'], string> = {
  CABA: 'CABA',
  GBA_NORTE: 'GBA Norte',
  GBA_OESTE: 'GBA Oeste',
  GBA_SUR: 'GBA Sur',
  GBA_ESTE: 'GBA Este',
  INTERIOR: 'Interior',
};

const ZONA_TYPE_ACCENT: Record<Zona['type'], string> = {
  CABA: 'border-electric-blue/30 bg-electric-blue/5',
  GBA_NORTE: 'border-emerald-500/30 bg-emerald-500/5',
  GBA_OESTE: 'border-amber-500/30 bg-amber-500/5',
  GBA_SUR: 'border-rose-500/30 bg-rose-500/5',
  GBA_ESTE: 'border-violet-500/30 bg-violet-500/5',
  INTERIOR: 'border-cyan-500/30 bg-cyan-500/5',
};

export default function RedMetroPage() {
  const [selectedZona, setSelectedZona] = useState<Zona | null>(null);
  const lineas = selectedZona ? lineasEnZona(selectedZona) : [];

  return (
    <div className="h-dvh bg-canvas flex flex-col overflow-hidden">
      <header className="px-4 pt-[calc(14px+env(safe-area-inset-top))] pb-3 bg-canvas flex items-center gap-3 shrink-0">
        <Link
          href="/inicio"
          className="w-9 h-9 rounded-full bg-canvas-soft border border-hairline flex items-center justify-center text-ink hover:bg-field transition-colors active:scale-95"
          aria-label="Volver al inicio"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-bold text-ink leading-tight">Red Metropol</h1>
          <p className="text-xs text-text-muted">Zonas del AMBA y líneas que las conectan</p>
        </div>
      </header>

      <main className="px-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[120px]">
        <section className="mt-4">
          <p className="text-sm font-semibold text-text-muted">Mapa esquemático</p>
          <p className="mt-1 text-xs text-text-muted leading-snug">
            Tocá una zona para ver las líneas que la conectan y las paradas cabeceras. Para el
            recorrido en tiempo real, usá el mapa en vivo.
          </p>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-3">
          {ZONAS_AMBA.map((zona) => {
            const lineasZona = lineasEnZona(zona);
            return (
              <button
                key={zona.id}
                type="button"
                onClick={() => setSelectedZona(zona)}
                className={`w-full text-left rounded-2xl border-2 p-4 transition-all active:scale-[0.99] hover:shadow-md ${
                  ZONA_TYPE_ACCENT[zona.type]
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                      {ZONA_TYPE_LABEL[zona.type]}
                    </span>
                    <h2 className="mt-0.5 text-base font-bold text-ink leading-tight">
                      {zona.name}
                    </h2>
                    <p className="mt-1 text-xs text-text-muted leading-snug break-words line-clamp-2">
                      {zona.description}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-text-muted shrink-0 mt-1" aria-hidden="true" />
                </div>
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  {lineasZona.map((line) => (
                    <LineBadge
                      key={line.id}
                      shortName={line.shortName}
                      color={line.color}
                      size="sm"
                    />
                  ))}
                  {lineasZona.length === 0 ? (
                    <span className="text-xs text-text-muted">Sin líneas</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </section>

        <section className="mt-6 mb-2">
          <Link
            href="/mapas"
            className="inline-flex items-center justify-center gap-2 min-h-11 w-full rounded-2xl bg-ink text-canvas text-sm font-bold transition-colors active:scale-95"
          >
            <MapIcon className="w-4 h-4" aria-hidden="true" />
            Ver mapa en vivo
          </Link>
        </section>
      </main>

      {/* Sheet de detalle de zona */}
      {selectedZona ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle de ${selectedZona.name}`}
          className="fixed inset-0 z-[60] bg-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedZona(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-canvas rounded-t-3xl sm:rounded-3xl border border-hairline shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45)] overflow-hidden"
          >
            <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-hairline-soft">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                  {ZONA_TYPE_LABEL[selectedZona.type]}
                </span>
                <h2 className="mt-0.5 text-xl font-black text-ink leading-tight">
                  {selectedZona.name}
                </h2>
                <p className="mt-1 text-xs text-text-muted leading-snug break-words">
                  {selectedZona.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedZona(null)}
                aria-label="Cerrar"
                className="shrink-0 w-8 h-8 rounded-full bg-canvas-soft hover:bg-field flex items-center justify-center text-text-muted hover:text-ink transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[60dvh] overflow-y-auto overscroll-contain">
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
                Líneas que pasan
              </h3>
              {lineas.length > 0 ? (
                <div className="mt-2 flex flex-col gap-2">
                  {lineas.map((line) => (
                    <Link
                      key={line.id}
                      href={`/mapas?linea=${line.id}`}
                      onClick={() => setSelectedZona(null)}
                      className="flex items-center gap-3 bg-canvas-soft border border-hairline rounded-2xl p-3 hover:bg-field transition-colors min-h-[56px]"
                    >
                      <LineDisplay
                        number={line.shortName}
                        color={line.color}
                        textColor={line.textColor}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-ink leading-tight">Línea {line.shortName}</p>
                        <p className="text-xs text-text-muted line-clamp-2 break-words">{line.name}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted shrink-0" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-text-muted">No hay líneas configuradas para esta zona.</p>
              )}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
                Paradas cabeceras
              </h3>
              <ul className="mt-2 space-y-1">
                {selectedZona.headerStops.map((stop, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm text-ink"
                  >
                    <Bus className="w-3.5 h-3.5 text-text-muted shrink-0" aria-hidden="true" />
                    <span className="break-words">{stop}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="px-5 pb-5 pt-3 border-t border-hairline-soft">
              <Link
                href="/mapas"
                onClick={() => setSelectedZona(null)}
                className="inline-flex items-center justify-center gap-2 min-h-11 w-full rounded-2xl bg-ink text-canvas text-sm font-bold transition-colors active:scale-95"
              >
                <MapIcon className="w-4 h-4" aria-hidden="true" />
                Ver mapa en vivo
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="shrink-0 fixed bottom-0 left-0 right-0 z-40">
        <BottomNav />
      </div>
    </div>
  );
}
