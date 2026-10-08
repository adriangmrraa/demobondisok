'use client';

import Link from 'next/link';
import { ArrowLeft, ChevronRight, Layers, Map as MapIcon } from 'lucide-react';
import { BottomNav } from '@/components/ui/bottom-nav';
import { MOCK_LINES } from '@/mock/data';
import { DATASET } from '@/lib/mock/amba-data';
import { buildNetworkSchematic } from '@/lib/diagrama-red';
import { NetworkSchematicView } from '@/components/diagrama/network-schematic';
import { LineDisplay } from '@/components/ui/line-display';

/**
 * Plano esquemático de la red Metropol (Prioridad 3).
 *
 * Reemplaza la lista plana de tarjetas por una vista de red: cada línea
 * operativa es un trazo del color oficial con nodos de paradas
 * significativas, cabeceras marcadas y la estación de intercambio donde
 * se cruzan. Tocar una línea (trazo o fila) abre su detalle.
 *
 * Solo se dibujan líneas con datos operativos completos (65 y 194); una
 * línea sin esquema disponible cae a la fila plana de acceso.
 */
export default function DiagramaPage() {
  const schematic = buildNetworkSchematic();
  const drawableLines = new Set(schematic.lines.map((l) => l.lineId));

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
          <h1 className="text-[22px] font-bold text-ink leading-tight">Diagrama</h1>
          <p className="text-xs text-text-muted">Plano esquemático de la red</p>
        </div>
      </header>

      <main className="px-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[120px]">
        <section className="mt-4">
          <div className="bg-canvas border border-hairline rounded-2xl p-3.5 shadow-sm flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-xl bg-electric-blue/10 flex items-center justify-center">
              <Layers className="w-4 h-4 text-electric-blue" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink leading-tight">Cómo leer el plano</p>
              <p className="mt-0.5 text-xs text-text-muted leading-snug break-words">
                Cada trazo de color es una línea. Los puntos grandes son cabeceras, las pastillas
                blancas marcan paradas con combinación (los chips bajo el nombre dicen con qué) y la
                pastilla doble es la estación donde se cruzan las líneas. Tocá un trazo para ver su
                recorrido completo.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4" aria-label="Esquema de la red">
          <div className="bg-canvas border border-hairline rounded-3xl px-2 py-3 shadow-sm">
            <NetworkSchematicView diagram={schematic} />
          </div>
          {/* Leyenda compacta */}
          <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1" aria-label="Leyenda del plano">
            <li className="flex items-center gap-1.5 text-[10px] font-semibold text-text-muted">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" aria-hidden="true" />
              Cabecera
            </li>
            <li className="flex items-center gap-1.5 text-[10px] font-semibold text-text-muted">
              <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-ink bg-canvas" aria-hidden="true" />
              Parada
            </li>
            <li className="flex items-center gap-1.5 text-[10px] font-semibold text-text-muted">
              <span className="inline-block h-2 w-3.5 rounded-full border-2 border-ink bg-canvas" aria-hidden="true" />
              Combinación
            </li>
            <li className="flex items-center gap-1.5 text-[10px] font-semibold text-text-muted">
              <span className="inline-flex h-3 w-6 items-center justify-center rounded-full border border-ink bg-canvas" aria-hidden="true">
                <span className="h-1.5 w-1.5 rounded-full bg-ink mx-px" />
                <span className="h-1.5 w-1.5 rounded-full bg-ink mx-px" />
              </span>
              Intercambio
            </li>
          </ul>
        </section>

        <section className="mt-5">
          <h2 className="text-[20px] font-semibold text-ink">Líneas disponibles</h2>
          <p className="mt-1 text-xs text-text-muted">Tocá una línea para ver su recorrido parada por parada</p>
          <div className="mt-3 flex flex-col gap-2.5">
            {MOCK_LINES.map((line) => {
              const lineaData = DATASET.lineas.find((l) => l.id === line.id);
              const ramalPrincipal = lineaData?.ramales[0];
              const ramalesCount = lineaData?.ramales.length ?? 0;
              const drawable = drawableLines.has(line.id);
              return (
                <Link
                  key={line.id}
                  href={`/diagrama/${line.id}`}
                  aria-label={`Ver el esquema de la línea ${line.shortName}`}
                  className="flex items-center gap-3 bg-canvas border border-hairline rounded-2xl p-3.5 shadow-sm hover:bg-canvas-soft active:scale-[0.99] transition-all min-h-[64px]"
                >
                  <LineDisplay
                    number={line.shortName}
                    color={line.color}
                    textColor={line.textColor}
                    size="md"
                    aria-label={`Línea ${line.shortName}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-ink leading-tight">Línea {line.shortName}</p>
                    <p className="mt-0.5 text-xs text-text-muted break-words">
                      {ramalPrincipal
                        ? `${ramalPrincipal.cabeceraOrigen} → ${ramalPrincipal.cabeceraDestino}`
                        : line.name}
                    </p>
                    {ramalesCount > 1 ? (
                      <p className="mt-0.5 text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                        {ramalesCount} ramales
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-electric-blue px-2 py-0.5 rounded-full bg-electric-blue/10">
                    {drawable ? 'Ver esquema' : 'Ver detalle'}
                    <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </div>
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

      <div className="shrink-0 fixed bottom-0 left-0 right-0 z-40">
        <BottomNav />
      </div>
    </div>
  );
}
