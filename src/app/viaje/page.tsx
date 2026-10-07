'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { Home, RotateCcw } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { JourneyGuide } from '@/components/viaje/JourneyGuide';
import { JourneyOptionList } from '@/components/viaje/JourneyOptionList';
import { TripPlannerService } from '@/lib/services/trip-planner-service';
import { parseTripMapState } from '@/lib/trip-map-navigation';

function remainingEta(etaMinutes: number | undefined, referenceMs: number | undefined): number | null {
  if (etaMinutes === undefined) return null;
  if (!referenceMs) return etaMinutes;
  return Math.max(0, etaMinutes - (Date.now() - referenceMs) / 60_000);
}

export default function JourneyPage() {
  return <Suspense fallback={<JourneyLoading />}><JourneyContent /></Suspense>;
}

function JourneyContent() {
  const searchParams = useSearchParams();
  const state = useMemo(() => parseTripMapState(new URLSearchParams(searchParams.toString())), [searchParams]);
  const options = useMemo(() => state ? TripPlannerService.planTrip(state.origin, state.destinationName) : [], [state]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  // Always start on alternatives: the URL may carry a prior map selection,
  // but this text-first route must let the passenger compare before choosing.
  const selectedOption = options.find((option) => option.id === selectedOptionId) ?? null;
  const etaMinutes = state ? remainingEta(state.etaMinutes, state.etaReferenceMs) : null;

  if (!state) {
    return <Recovery title="No pudimos abrir este viaje" detail="El enlace está incompleto. Volvé al inicio y buscá tu destino nuevamente." />;
  }
  if (options.length === 0) {
    return <Recovery title="No encontramos una combinación" detail={`Todavía no hay una ruta disponible hacia ${state.destinationName}. Probá con otro destino.`} />;
  }
  return (
    <main className="h-dvh overflow-y-auto bg-canvas px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(20px+env(safe-area-inset-top))]">
      <div className="mx-auto max-w-md">
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Tu viaje</p>
          <h1 className="mt-1 text-2xl font-black leading-tight text-ink">{state.origin.name} <span className="text-text-faint">→</span> <span className="break-words">{state.destinationName}</span></h1>
        </header>
        {selectedOption ? (
          <JourneyGuide option={selectedOption} state={state} etaMinutes={etaMinutes} onBackToOptions={() => setSelectedOptionId(null)} />
        ) : (
          <JourneyOptionList options={options} selectedOptionId={selectedOptionId} onSelect={setSelectedOptionId} />
        )}
      </div>
    </main>
  );
}

function JourneyLoading() {
  return <main className="flex h-dvh items-center justify-center bg-canvas"><p className="text-sm font-bold text-text-muted">Buscando alternativas…</p></main>;
}

function Recovery({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="flex h-dvh items-center justify-center bg-canvas p-5">
      <section className="w-full max-w-sm rounded-3xl border border-hairline bg-canvas p-6 text-center shadow-sm">
        <h1 className="text-xl font-black text-ink">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">{detail}</p>
        <Link href="/inicio" className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 text-sm font-bold text-canvas"><Home className="size-4" /> Volver al inicio</Link>
        <Link href="/inicio" className="mt-2 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-ink"><RotateCcw className="size-4" /> Buscar otro viaje</Link>
      </section>
    </main>
  );
}
