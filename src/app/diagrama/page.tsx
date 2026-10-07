'use client';

import Link from 'next/link';
import { ArrowLeft, Layers, Construction, Map as MapIcon } from 'lucide-react';
import { BottomNav } from '@/components/ui/bottom-nav';
import { MOCK_LINES } from '@/mock/data';

/**
 * Vista esquema de líneas (estilo Moovit/SUBE).
 *
 * Estado: placeholder con preview de las líneas disponibles. La vista
 * completa (esquema vertical con paradas en orden secuencial + badges
 * de combinación con tren/subte) es trabajo pendiente (PBI-021).
 *
 * Mientras tanto, esta página lista todas las líneas en formato card para
 * que el usuario pueda ver qué líneas existen y acceder al mapa en vivo.
 */
export default function DiagramaPage() {
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
          <p className="text-xs text-text-muted">Esquema de líneas del AMBA</p>
        </div>
      </header>

      <main className="px-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[120px]">
        <section className="mt-4">
          <div className="bg-canvas border border-hairline rounded-3xl p-5 shadow-sm flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-2xl bg-electric-blue/10 flex items-center justify-center">
              <Construction className="w-5 h-5 text-electric-blue" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink leading-tight">Esquema visual en construcción</p>
              <p className="mt-1.5 text-xs text-text-muted leading-snug break-words">
                Estamos armando el esquema vertical con paradas secuenciales estilo subte (línea
                por línea, con combinaciones tappeables). Mientras tanto, acá tenés la lista
                de líneas disponibles con acceso directo al mapa en vivo.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4">
          <h2 className="text-[20px] font-semibold text-ink">Líneas disponibles</h2>
          <p className="mt-1 text-xs text-text-muted">Tocá una línea para verla en el mapa en vivo</p>
          <div className="mt-3 flex flex-col gap-2.5">
            {MOCK_LINES.map((line) => (
              <Link
                key={line.id}
                href={`/mapas?linea=${line.id}`}
                className="flex items-center gap-3 bg-canvas border border-hairline rounded-2xl p-3.5 shadow-sm hover:bg-canvas-soft active:scale-[0.99] transition-all min-h-[64px]"
              >
                <span
                  className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-base shadow-sm"
                  style={{ backgroundColor: line.color }}
                  aria-hidden="true"
                >
                  {line.shortName}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink leading-tight">Línea {line.shortName}</p>
                  <p className="mt-0.5 text-xs text-text-muted truncate">{line.name}</p>
                </div>
                <span className="shrink-0 text-[10px] font-bold text-electric-blue px-2 py-0.5 rounded-full bg-electric-blue/10">
                  Ver mapa
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <div className="shrink-0 fixed bottom-0 left-0 right-0 z-40">
        <BottomNav />
      </div>
    </div>
  );
}
