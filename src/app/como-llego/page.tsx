'use client';

import Link from 'next/link';
import { ArrowLeft, Navigation, MapPin, Search } from 'lucide-react';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ComoLlegoFlow } from '@/components/viaje/ComoLlegoFlow';
import { useAssistantSession } from '@/hooks/use-assistant-session';
import { useEffect } from 'react';

/**
 * Página dedicada del wizard "¿Cómo llego?".
 * Muestra un hero con CTA para iniciar el flujo. Al tocar "Empezar",
 * abre el LocationConsentModal (si no hay GPS) o el AssistantWizard
 * (si ya hay). Al confirmar el viaje, navega a /mapas.
 */
export default function ComoLlegoPage() {
  const { session, setConsentido } = useAssistantSession();

  useEffect(() => {
    // Si ya tenemos sesión activa, salimos del estado 'idle' para
    // que el ConsentModal no se reabra al volver a la página.
    if (session.consentido) {
      // El wizard se abrirá automáticamente via ComoLlegoFlow
    }
  }, [session.consentido]);

  const handleStart = () => {
    if (session.consentido) {
      setConsentido(true);
    } else {
      setConsentido(false);
    }
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
          <p className="text-xs text-text-muted">Planificá tu viaje de A a B</p>
        </div>
      </header>

      <main className="px-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[120px]">
        <section className="mt-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-electric-blue/10 flex items-center justify-center">
              <Navigation className="w-8 h-8 text-electric-blue" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-2xl font-black text-ink leading-tight">
              ¿A dónde vamos hoy?
            </h2>
            <p className="mt-2 text-sm text-text-muted leading-snug max-w-xs">
              Elegí tu ubicación, la parada donde vas a tomar el colectivo, y tu destino.
              Te mostramos el mejor recorrido, con llegadas en vivo y combinaciones.
            </p>
          </div>
        </section>

        <section className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleStart}
            className="w-full min-h-[56px] rounded-2xl bg-ink text-canvas text-base font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
          >
            <Search className="w-4 h-4" />
            Empezar
          </button>

          <div className="grid grid-cols-3 gap-2.5 mt-2">
            <Link
              href="/red-metro"
              className="flex flex-col items-center gap-2 bg-canvas-soft border border-hairline rounded-2xl py-3.5 px-2 hover:bg-field transition-colors active:scale-[0.98]"
            >
              <span className="w-9 h-9 rounded-full bg-canvas border border-hairline flex items-center justify-center">
                <MapPin className="w-4 h-4 text-ink" />
              </span>
              <span className="text-[10px] font-bold text-ink text-center leading-tight">Por línea</span>
            </Link>
            <Link
              href="/diagrama"
              className="flex flex-col items-center gap-2 bg-canvas-soft border border-hairline rounded-2xl py-3.5 px-2 hover:bg-field transition-colors active:scale-[0.98]"
            >
              <span className="w-9 h-9 rounded-full bg-canvas border border-hairline flex items-center justify-center">
                <Navigation className="w-4 h-4 text-ink" />
              </span>
              <span className="text-[10px] font-bold text-ink text-center leading-tight">Diagrama</span>
            </Link>
            <Link
              href="/mapas"
              className="flex flex-col items-center gap-2 bg-canvas-soft border border-hairline rounded-2xl py-3.5 px-2 hover:bg-field transition-colors active:scale-[0.98]"
            >
              <span className="w-9 h-9 rounded-full bg-canvas border border-hairline flex items-center justify-center">
                <MapPin className="w-4 h-4 text-ink" />
              </span>
              <span className="text-[10px] font-bold text-ink text-center leading-tight">Mapa en vivo</span>
            </Link>
          </div>
        </section>

        {session.consentido && session.lugar ? (
          <section className="mt-6 p-4 rounded-2xl bg-canvas-soft border border-hairline">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Última ubicación</p>
            <p className="mt-1 text-sm font-bold text-ink leading-tight">
              {session.lugar.name}
            </p>
            {session.lugar.address ? (
              <p className="text-xs text-text-muted mt-0.5 break-words">
                {session.lugar.address}
              </p>
            ) : null}
          </section>
        ) : null}
      </main>

      {/* Flujo de wizard embebido: consent + selector + assistant */}
      <ComoLlegoFlow />

      <div className="shrink-0 fixed bottom-0 left-0 right-0 z-40">
        <BottomNav />
      </div>
    </div>
  );
}
