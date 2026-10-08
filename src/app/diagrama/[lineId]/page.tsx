'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Bus, Map as MapIcon, Train, TramFront } from 'lucide-react';
import { BottomNav } from '@/components/ui/bottom-nav';
import { MOCK_LINES } from '@/mock/data';
import { LineDisplay } from '@/components/ui/line-display';
import metropolData from '@/data/metropol.json';
import { DATASET } from '@/lib/mock/amba-data';
import { combinacionesDeParadaId, type Combinacion } from '@/lib/combinaciones';
import type { ParadaDefinition, RecorridoDefinition } from '@/types/transport';

interface PageProps {
  params: Promise<{ lineId: string }>;
}

const COMBINACION_ICON = { tren: Train, subte: TramFront, metrobus: Bus } as const;

/** Parada → líneas que la usan (para marcar intercambios entre colectivos). */
const LINES_BY_STOP = new Map<string, string[]>();
for (const linea of DATASET.lineas) {
  for (const stopId of new Set(linea.ramales.flatMap((r) => r.recorridos.flatMap((rec) => rec.paradas)))) {
    LINES_BY_STOP.set(stopId, [...(LINES_BY_STOP.get(stopId) ?? []), linea.id]);
  }
}

function CombinacionChip({ combinacion }: { combinacion: Combinacion }) {
  const Icon = COMBINACION_ICON[combinacion.mode];
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold text-canvas px-2 py-0.5 rounded-full"
      style={{ backgroundColor: combinacion.color }}
      title={`Combinación con ${combinacion.label}`}
    >
      <Icon className="w-2.5 h-2.5" aria-hidden="true" />
      {combinacion.label}
    </span>
  );
}

/**
 * Detalle de línea del Diagrama (Prioridad 3).
 *
 * Rail vertical con las paradas del dataset en orden secuencial, badges de
 * combinación (subte/tren/metrobus desde `conexiones` estructuradas) y la
 * marca de intercambio cuando la parada también la usa la otra línea.
 * Cada parada con coordenadas navega al mapa centrado
 * (`/mapas?linea=<id>&parada=<id>`); una parada sin datos no es tappeable.
 * Para líneas con ramales (194) hay selector de ramal; con ambos sentidos
 * cargados (65, 194-A/B) selector ida/vuelta.
 */
export default function DiagramaLineaPage({ params }: PageProps) {
  const { lineId } = use(params);
  const line = MOCK_LINES.find((l) => l.id === lineId);
  const linea = DATASET.lineas.find((l) => l.id === lineId);
  if (!line || !linea) notFound();

  const [ramalId, setRamalId] = useState(linea.ramales[0]?.id ?? '');
  const [sentido, setSentido] = useState<'ida' | 'vuelta'>('ida');

  const ramal = linea.ramales.find((r) => r.id === ramalId) ?? linea.ramales[0];
  const recorrido: RecorridoDefinition | undefined =
    ramal?.recorridos.find((r) => r.sentido === sentido) ?? ramal?.recorridos[0];
  const tieneAmbosSentidos = !!ramal && ramal.recorridos.some((r) => r.sentido === 'ida') && ramal.recorridos.some((r) => r.sentido === 'vuelta');

  const paradas = (recorrido?.paradas ?? [])
    .map((id) => DATASET.paradas[id])
    .filter((p): p is ParadaDefinition => !!p);

  const data = metropolData as unknown as { lines: Array<{ number: string; recorridos: Array<{ summary?: string }> }> };
  const summary = data.lines.find((l) => `line-${l.number}` === lineId)?.recorridos[0]?.summary;

  const handleSelectRamal = (id: string) => {
    setRamalId(id);
    setSentido('ida');
  };

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
          <h1 className="text-[22px] font-bold text-ink leading-tight">Línea {line.shortName}</h1>
          <p className="text-xs text-text-muted line-clamp-2 break-words">{line.name}</p>
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
        {linea.ramales.length > 1 ? (
          <section className="mt-4" aria-label="Ramales de la línea">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Ramales</p>
            <div className="mt-2 flex gap-2 overflow-x-auto overscroll-contain pb-1 -mx-4 px-4" role="group" aria-label="Elegir ramal">
              {linea.ramales.map((r) => {
                const active = r.id === ramal?.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleSelectRamal(r.id)}
                    className={`shrink-0 min-h-11 px-3.5 rounded-2xl border text-xs font-bold transition-all active:scale-95 ${
                      active
                        ? 'border-transparent text-canvas'
                        : 'border-hairline bg-canvas text-ink hover:bg-canvas-soft'
                    }`}
                    style={active ? { backgroundColor: r.color || line.color } : undefined}
                  >
                    {r.codigo ? `Ramal ${r.codigo}` : r.nombre}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {paradas.length === 0 ? (
          <section className="mt-4">
            <div className="bg-canvas border border-hairline rounded-3xl p-5 shadow-sm flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <MapIcon className="w-5 h-5 text-amber-500" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ink leading-tight">Sin paradas cargadas</p>
                <p className="mt-1 text-xs text-text-muted leading-snug break-words">
                  Este recorrido no tiene paradas en el dataset. Para ver el trazado, usá el mapa
                  en vivo o el asistente.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-muted">
                  {ramal?.nombre ?? 'Recorrido'} · {paradas.length} paradas
                </p>
                <p className="mt-1 text-xs text-text-muted leading-snug break-words">
                  {recorrido ? `${recorrido.origen} → ${recorrido.destino}` : summary ?? `Recorrido de la línea ${line.shortName}.`}
                </p>
              </div>
              {tieneAmbosSentidos ? (
                <div className="shrink-0 inline-flex rounded-full border border-hairline bg-canvas-soft p-0.5" role="group" aria-label="Sentido del recorrido">
                  {(['ida', 'vuelta'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSentido(s)}
                      aria-pressed={sentido === s}
                      className={`min-h-9 px-3 rounded-full text-xs font-bold transition-all ${
                        sentido === s ? 'bg-ink text-canvas' : 'text-text-muted hover:text-ink'
                      }`}
                    >
                      {s === 'ida' ? 'Ida' : 'Vuelta'}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <ol className="mt-4 relative" aria-label={`Paradas de la línea ${line.shortName}`}>
              {/* Rail del recorrido */}
              <span
                aria-hidden
                className="absolute left-[11px] top-3 bottom-3 w-1 rounded-full"
                style={{ backgroundColor: line.color }}
              />
              {paradas.map((parada, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === paradas.length - 1;
                const combinaciones = combinacionesDeParadaId(parada.id);
                const otrasLineas = (LINES_BY_STOP.get(parada.id) ?? []).filter((id) => id !== lineId);
                const hasCoords = typeof parada.lat === 'number' && typeof parada.lng === 'number';

                const dot = (
                  <span
                    className="absolute left-0 top-1.5 flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-canvas"
                    style={{ backgroundColor: isFirst || isLast ? line.color : 'var(--canvas)', borderColor: line.color, borderWidth: isFirst || isLast ? 0 : 2 }}
                    aria-hidden="true"
                  >
                    {isFirst || isLast ? <span className="h-2 w-2 rounded-full bg-canvas" /> : null}
                  </span>
                );

                const body = (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-sm font-semibold text-ink leading-tight break-words">
                      {parada.nombre}
                      {isFirst ? <span className="ml-1.5 text-[10px] font-bold uppercase text-text-muted">Cabecera</span> : null}
                      {isLast && !isFirst ? <span className="ml-1.5 text-[10px] font-bold uppercase text-text-muted">Fin</span> : null}
                    </p>
                    {combinaciones.length > 0 || otrasLineas.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {combinaciones.map((c) => (
                          <CombinacionChip key={`${parada.id}-${c.id}`} combinacion={c} />
                        ))}
                        {otrasLineas.map((otraId) => {
                          const otra = MOCK_LINES.find((l) => l.id === otraId);
                          if (!otra) return null;
                          return (
                            <span
                              key={`${parada.id}-${otraId}`}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-canvas px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: otra.color }}
                              title={`Combinación con la línea ${otra.shortName}`}
                            >
                              <Bus className="w-2.5 h-2.5" aria-hidden="true" />
                              Línea {otra.shortName}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );

                return (
                  <li key={`${parada.id}-${idx}`} className="relative pl-9 pb-1.5 last:pb-0">
                    {dot}
                    {hasCoords ? (
                      <Link
                        href={`/mapas?linea=${line.id}&parada=${parada.id}`}
                        aria-label={`Ver la parada ${parada.nombre} en el mapa`}
                        className="block rounded-xl -mx-2 px-2 py-1.5 min-h-11 hover:bg-canvas-soft active:bg-field transition-colors"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="px-0 py-1.5 min-h-11">{body}</div>
                    )}
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
