'use client';

import Link from 'next/link';
import { ArrowLeft, Map as MapIcon, Construction } from 'lucide-react';
import { BottomNav } from '@/components/ui/bottom-nav';

/**
 * Vista territorial con municipios coloreados por línea.
 *
 * Estado: placeholder. El cliente vio esta vista en el Replit original
 * pero el equipo de Fusa Labs no la construyó en este repo. Los datos
 * están disponibles (src/data/metropol.json con líneas y paradas,
 * src/data/routes.json con geometría) pero la implementación visual
 * con layout de municipios coloreados es trabajo pendiente (PBI-020).
 *
 * Mientras tanto, esta página muestra un placeholder con copy explicativo
 * y un CTA al mapa en vivo. El bottom nav sigue funcionando normalmente.
 */
export default function RedMetroPage() {
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
          <h1 className="text-[22px] font-bold text-ink leading-tight">Red Metro</h1>
          <p className="text-xs text-text-muted">Municipios y líneas del AMBA</p>
        </div>
      </header>

      <main className="px-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[120px]">
        <section className="mt-4">
          <div className="bg-canvas border border-hairline rounded-3xl p-5 shadow-sm flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-2xl bg-electric-blue/10 flex items-center justify-center">
              <Construction className="w-5 h-5 text-electric-blue" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink leading-tight">Vista en construcción</p>
              <p className="mt-1.5 text-xs text-text-muted leading-snug break-words">
                Estamos armando la vista territorial con los municipios coloreados según las líneas
                que pasan por cada uno. Mientras tanto, podés ver el mapa en vivo o consultar el
                diagrama de líneas.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  href="/mapas"
                  className="inline-flex items-center justify-center gap-2 min-h-11 rounded-2xl bg-ink text-canvas text-sm font-bold transition-colors active:scale-95"
                >
                  <MapIcon className="w-4 h-4" aria-hidden="true" />
                  Ver mapa en vivo
                </Link>
                <Link
                  href="/diagrama"
                  className="inline-flex items-center justify-center min-h-11 rounded-2xl bg-canvas-soft hover:bg-field border border-hairline text-ink text-sm font-bold transition-colors active:scale-95"
                >
                  Ver diagrama
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <div className="shrink-0 fixed bottom-0 left-0 right-0 z-40">
        <BottomNav />
      </div>
    </div>
  );
}
