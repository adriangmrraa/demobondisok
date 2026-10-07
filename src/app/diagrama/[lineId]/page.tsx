'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Train, Map as MapIcon, Bus } from 'lucide-react';
import { BottomNav } from '@/components/ui/bottom-nav';
import { MOCK_LINES } from '@/mock/data';
import { LineDisplay } from '@/components/ui/line-display';
import metropolData from '@/data/metropol.json';
import { combinacionesDeParada } from '@/lib/combinaciones';

interface PageProps {
  params: Promise<{ lineId: string }>;
}

export default function DiagramaLineaPage({ params }: PageProps) {
  const { lineId } = use(params);
  const line = MOCK_LINES.find((l) => l.id === lineId);
  if (!line) notFound();

  const data = metropolData as unknown as { lines: Array<{ number: string; recorridos: Array<{ summary?: string; paradas?: string[] }> }> };
  const rawLine = data.lines.find((l) => `line-${l.number}` === lineId);

  const recorridoPrincipal = rawLine?.recorridos[0];
  const paradas = useMemo(
    () => (recorridoPrincipal?.paradas ?? []) as string[],
    [recorridoPrincipal],
  );

  return (
    <div className="h-dvh bg-canvas flex flex-col overflow-hidden">
      <header className="px-4 pt-[calc(14px+env(safe-area-inset-top))] pb-3 bg-canvas flex items-center gap-3 shrink-0">
        <Link
          href="/diagrama"
          className="w-9 h-9 rounded-full bg-canvas-soft border border-hairline flex items-center justify-center text-ink hover:bg-field transition-colors active:scale-95"
          aria-label="Volver al diagrama"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-bold text-ink leading-tight">Diagrama</h1>
          <p className="text-xs text-text-muted truncate">Línea {line.shortName} · {line.name}</p>
        </div>
        <LineDisplay
          number={line.shortName}
          color={line.color}
          textColor={line.textColor}
          size="md"
          aria-label={`Línea ${line.shortName}`}
        />
      </header>

      <main className="px-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[120px]">
        {paradas.length === 0 ? (
          <section className="mt-4">
            <div className="bg-canvas border border-hairline rounded-3xl p-5 shadow-sm flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <MapIcon className="w-5 h-5 text-amber-500" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ink leading-tight">Sin paradas cargadas</p>
                <p className="mt-1 text-xs text-text-muted leading-snug break-words">
                  Esta línea no tiene paradas en el dataset. Para ver el recorrido, usá el mapa
                  en vivo o el asistente.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-4">
            <p className="text-sm font-semibold text-text-muted">
              Recorrido · {paradas.length} paradas
            </p>
            <p className="mt-1 text-xs text-text-muted leading-snug break-words">
              {recorridoPrincipal?.summary ?? `Recorrido principal de la línea ${line.shortName}.`}
            </p>
            <ol className="mt-4 relative">
              {/* Línea vertical del recorrido (rail) */}
              <span
                aria-hidden
                className="absolute left-[11px] top-3 bottom-3 w-1 rounded-full"
                style={{ backgroundColor: line.color }}
              />
              {paradas.map((parada, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === paradas.length - 1;
                const combinaciones = combinacionesDeParada(parada);
                return (
                  <li key={`${parada}-${idx}`} className="relative pl-9 pb-5 last:pb-0">
                    <span
                      className="absolute left-0 top-0.5 flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-canvas"
                      style={{ backgroundColor: line.color }}
                      aria-hidden="true"
                    >
                      <span className="h-2 w-2 rounded-full bg-canvas" />
                    </span>
                    <div className="flex flex-col gap-1.5">
                      <p
                        className="text-sm font-semibold text-ink leading-tight break-words"
                        title={parada}
                      >
                        {parada}
                        {isFirst ? <span className="ml-1.5 text-[10px] font-bold uppercase text-text-muted">Cabecera</span> : null}
                        {isLast && !isFirst ? <span className="ml-1.5 text-[10px] font-bold uppercase text-text-muted">Fin</span> : null}
                      </p>
                      {combinaciones.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {combinaciones.map((c) => (
                            <span
                              key={`${parada}-${c.id}`}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-canvas px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: c.color }}
                              title={`Combinación con ${c.label}`}
                            >
                              {c.mode === 'tren' ? (
                                <Train className="w-2.5 h-2.5" />
                              ) : (
                                <Bus className="w-2.5 h-2.5" />
                              )}
                              {c.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <section className="mt-6 mb-2">
          <Link
            href={`/mapas?linea=${line.id}`}
            className="inline-flex items-center justify-center gap-2 min-h-11 w-full rounded-2xl bg-ink text-canvas text-sm font-bold transition-colors active:scale-95"
          >
            <MapIcon className="w-4 h-4" aria-hidden="true" />
            Ver en el mapa
          </Link>
        </section>
      </main>

      <div className="shrink-0 fixed bottom-0 left-0 right-0 z-40">
        <BottomNav />
      </div>
    </div>
  );
}
