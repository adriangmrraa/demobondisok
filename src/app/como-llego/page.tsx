'use client';

import Link from 'next/link';
import { ArrowLeft, Search, Construction, MapPin, Map as MapIcon } from 'lucide-react';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ClassicTripActions, type ClassicTripAction } from '@/components/home/ClassicTripActions';
import { useRouter } from 'next/navigation';

/**
 * Wizard de planificación de viaje.
 *
 * Estado: placeholder que reusa ClassicTripActions de la home. El flujo
 * completo de "elegir origen → parada → destino" (AssistantWizard +
 * consent modal + place selector) vive en /inicio. Esta página expone
 * las 4 acciones clásicas para que el usuario pueda iniciar la búsqueda
 * desde el bottom nav, pero la integración completa con el mapa se hace
 * en una iteración siguiente.
 */
export default function ComoLlegoPage() {
  const router = useRouter();

  const handleClassicAction = (action: ClassicTripAction) => {
    if (action === 'line') {
      router.push('/inicio?action=line');
      return;
    }
    if (action === 'nearby') {
      router.push('/inicio?action=nearby');
      return;
    }
    if (action === 'destination') {
      router.push('/inicio?action=plan');
      return;
    }
    router.push('/mapas');
  };

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
          <h1 className="text-[22px] font-bold text-ink leading-tight">¿Cómo llego?</h1>
          <p className="text-xs text-text-muted">Planificá tu viaje</p>
        </div>
      </header>

      <main className="px-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[120px]">
        <section className="mt-4">
          <p className="text-sm font-semibold text-text-muted">Elegí cómo empezar</p>
          <p className="mt-1 text-xs text-text-muted leading-snug">
            Buscá por línea, por parada cercana con GPS, o planificá un viaje completo de A a B.
          </p>
          <div className="mt-3">
            <ClassicTripActions onSelect={handleClassicAction} />
          </div>
        </section>

        <section className="mt-6">
          <div className="bg-canvas border border-hairline rounded-3xl p-5 shadow-sm flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-2xl bg-electric-blue/10 flex items-center justify-center">
              <Construction className="w-5 h-5 text-electric-blue" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink leading-tight">Wizard completo en construcción</p>
              <p className="mt-1.5 text-xs text-text-muted leading-snug break-words">
                El flujo de planificación de 3 pasos (origen → parada → destino) se está
                integrando con el mapa en vivo. Por ahora podés usar las acciones de arriba, que
                abren el flujo desde la home.
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
                  <MapPin className="w-4 h-4 mr-1.5" aria-hidden="true" />
                  Ver diagrama de líneas
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
