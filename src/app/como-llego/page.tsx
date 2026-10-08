'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Navigation, Search, Sparkles } from 'lucide-react';
import { BottomNav } from '@/components/ui/bottom-nav';
import { LocationConsentModal } from '@/components/home/LocationConsentModal';
import { requestDeviceLocation, SIMULATED_USER_LOCATION } from '@/lib/config/user-location';
import { TripPlannerService } from '@/lib/services/trip-planner-service';
import { buildTripJourneyUrl } from '@/lib/trip-map-navigation';
import { useAssistantSession } from '@/hooks/use-assistant-session';
import type { LocationPoint } from '@/types/trip-planner';

const FEATURED_DESTINATIONS = [
  { name: 'Plaza Constitución', description: 'Constitución, CABA' },
  { name: 'Barrancas de Belgrano', description: 'Belgrano, CABA' },
  { name: 'Terminal Once', description: 'Plaza Miserere, CABA' },
  { name: 'Estación Escobar', description: 'Belén de Escobar' },
  { name: 'Campana Centro', description: 'Campana, GBA Norte' },
  { name: 'Centro de Transferencia de Zárate', description: 'Zárate, GBA Norte' },
] as const;

const ACTIVE_LINES = [
  { id: 'line-65', number: '65', color: '#159EE6', route: 'Plaza Constitución → Barrancas de Belgrano', operator: 'La Nueva Metropol' },
  { id: 'line-194', number: '194', color: '#E11D48', route: 'Plaza Miserere → Zárate', operator: 'La Nueva Metropol' },
] as const;

function locationLabel(place: LocationPoint | null, fallback: string) {
  return place?.name ?? fallback;
}

/** The location choice is explicit: entering this screen never opens its modal. */
export default function ComoLlegoPage() {
  const router = useRouter();
  const { setConsentido, setLugar, setParadaSelId } = useAssistantSession();
  const originInputRef = useRef<HTMLInputElement>(null);
  const [origin, setOrigin] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [originQuery, setOriginQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [planningError, setPlanningError] = useState<string | null>(null);

  // "Paradas cerca" es una acción explícita de ubicación y conserva su
  // apertura directa. Los demás accesos a /como-llego nunca abren el modal.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auto') !== '1') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('auto');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    const frame = window.requestAnimationFrame(() => setLocationModalOpen(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const originResults = useMemo(
    () => (originQuery.trim() && !origin ? TripPlannerService.searchLocations(originQuery).slice(0, 5) : []),
    [origin, originQuery],
  );
  const destinationResults = useMemo(
    () => (destinationQuery.trim() && !destination ? TripPlannerService.searchLocations(destinationQuery).slice(0, 5) : []),
    [destination, destinationQuery],
  );

  const selectOrigin = useCallback((place: LocationPoint) => {
    setOrigin(place);
    setOriginQuery(place.name);
    setConsentido(true);
    setLugar({ name: place.name, address: place.address, lat: place.lat, lng: place.lng, stopId: place.stopId });
    setParadaSelId(null);
    setPlanningError(null);
  }, [setConsentido, setLugar, setParadaSelId]);

  const selectDestination = useCallback((place: LocationPoint) => {
    setDestination(place);
    setDestinationQuery(place.name);
    setPlanningError(null);
  }, []);

  const handleUseRealLocation = useCallback(async () => {
    selectOrigin(await requestDeviceLocation());
    setLocationModalOpen(false);
  }, [selectOrigin]);

  const handleUseDemoLocation = useCallback(() => {
    selectOrigin(SIMULATED_USER_LOCATION);
    setLocationModalOpen(false);
  }, [selectOrigin]);

  const handleUseManualLocation = useCallback(() => {
    setLocationModalOpen(false);
    window.requestAnimationFrame(() => originInputRef.current?.focus());
  }, []);

  const planTrip = useCallback(() => {
    if (!origin) {
      setPlanningError('Elegí desde dónde salís: podés buscar un lugar o usar tu ubicación.');
      originInputRef.current?.focus();
      return;
    }
    if (!destination) {
      setPlanningError('Elegí un destino de los resultados de búsqueda o de los lugares destacados.');
      return;
    }
    const trip = TripPlannerService.planTrip(origin, destination)[0];
    if (!trip) {
      setPlanningError('No encontramos una combinación para ese recorrido. Probá con otro origen o destino.');
      return;
    }
    router.push(buildTripJourneyUrl(trip, origin, { boardingStopId: trip.originStopId }));
  }, [destination, origin, router]);

  const pickFeaturedDestination = useCallback((name: string) => {
    const place = TripPlannerService.searchLocations(name)[0];
    if (place) selectDestination(place);
  }, [selectDestination]);

  return (
    <div className="h-dvh bg-canvas flex flex-col overflow-hidden">
      <header className="px-4 pt-[calc(14px+env(safe-area-inset-top))] pb-3 bg-canvas flex items-center gap-3 shrink-0">
        <Link href="/inicio" className="w-9 h-9 rounded-full bg-canvas-soft border border-hairline flex items-center justify-center text-ink hover:bg-field transition-colors active:scale-95" aria-label="Volver al inicio">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-bold text-ink leading-tight">¿Cómo llego?</h1>
          <p className="text-xs text-text-muted">Planificá tu viaje de A a B</p>
        </div>
      </header>

      <main className="px-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[120px]">
        <section aria-label="Planificar viaje" className="mt-3 rounded-3xl border border-hairline bg-canvas-soft p-3 shadow-sm">
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" aria-hidden="true" />
            <input ref={originInputRef} type="text" value={locationLabel(origin, originQuery)} onChange={(event) => { setOrigin(null); setOriginQuery(event.target.value); setPlanningError(null); }} placeholder="Origen — ¿Dónde estás?" autoComplete="off" aria-label="Origen del viaje" className="w-full min-h-[54px] rounded-2xl border border-hairline bg-canvas pl-10 pr-4 text-sm font-medium text-ink placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-ink/20" />
          </div>
          {originResults.length > 0 ? <LocationResults results={originResults} onSelect={selectOrigin} /> : null}
          <button type="button" onClick={() => setLocationModalOpen(true)} className="mt-2 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-hairline bg-canvas px-3 text-xs font-bold text-ink transition-colors hover:bg-field active:scale-[0.98]">
            <Navigation className="h-4 w-4 text-electric-blue" aria-hidden="true" /> Usar mi ubicación
          </button>

          <div className="my-3 h-px bg-hairline" />

          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-500" aria-hidden="true" />
            <input type="text" value={locationLabel(destination, destinationQuery)} onChange={(event) => { setDestination(null); setDestinationQuery(event.target.value); setPlanningError(null); }} placeholder="Destino — ¿A dónde vas?" autoComplete="off" aria-label="Destino del viaje" className="w-full min-h-[54px] rounded-2xl border border-hairline bg-canvas pl-10 pr-4 text-sm font-medium text-ink placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-ink/20" />
          </div>
          {destinationResults.length > 0 ? <LocationResults results={destinationResults} onSelect={selectDestination} /> : null}
          {planningError ? <p role="alert" className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-200">{planningError}</p> : null}
          <button type="button" onClick={planTrip} className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 text-sm font-bold text-canvas transition-transform active:scale-[0.98]">
            <Search className="h-4 w-4" aria-hidden="true" /> Buscar cómo llegar
          </button>
        </section>

        <section aria-labelledby="featured-destinations-title" className="mt-6">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-electric-blue" aria-hidden="true" /><h2 id="featured-destinations-title" className="text-sm font-bold uppercase tracking-[0.12em] text-text-muted">Destinos destacados</h2></div>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {FEATURED_DESTINATIONS.map((place) => (
              <button key={place.name} type="button" onClick={() => pickFeaturedDestination(place.name)} className="min-h-[84px] rounded-2xl border border-hairline bg-canvas p-3 text-left shadow-sm transition-colors hover:bg-canvas-soft active:scale-[0.98]">
                <MapPin className="h-4 w-4 text-electric-blue" aria-hidden="true" /><span className="mt-2 block text-sm font-bold leading-tight text-ink">{place.name}</span><span className="mt-1 block text-[11px] leading-tight text-text-muted">{place.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="active-lines-title" className="mt-6">
          <h2 id="active-lines-title" className="text-sm font-bold uppercase tracking-[0.12em] text-text-muted">Líneas disponibles</h2>
          <div className="mt-3 flex flex-col gap-2">
            {ACTIVE_LINES.map((line) => (
              <button key={line.id} type="button" onClick={() => router.push(`/diagrama/${line.id}`)} aria-label={`Ver diagrama de la línea ${line.number}`} className="flex min-h-[70px] w-full items-center gap-3 rounded-2xl border border-hairline bg-canvas px-3 text-left shadow-sm transition-colors hover:bg-canvas-soft active:scale-[0.98]">
                <span className="flex h-10 min-w-10 items-center justify-center rounded-xl px-2 text-sm font-black text-white" style={{ backgroundColor: line.color }}>{line.number}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold leading-tight text-ink">{line.route}</span><span className="mt-1 block text-[11px] text-text-muted">{line.operator}</span></span>
              </button>
            ))}
          </div>
        </section>
      </main>

      {locationModalOpen ? <LocationConsentModal onUseReal={handleUseRealLocation} onUseDemo={handleUseDemoLocation} onUseManual={handleUseManualLocation} onClose={() => setLocationModalOpen(false)} /> : null}
      <div className="fixed bottom-0 left-0 right-0 z-40 shrink-0"><BottomNav /></div>
    </div>
  );
}

function LocationResults({ results, onSelect }: { results: LocationPoint[]; onSelect: (place: LocationPoint) => void }) {
  return (
    <ul className="mt-2 flex max-h-44 flex-col gap-1 overflow-y-auto rounded-2xl border border-hairline bg-canvas p-1.5">
      {results.map((place, index) => (
        <li key={`${place.name}-${index}`}><button type="button" onClick={() => onSelect(place)} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-canvas-soft">
          <MapPin className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" /><span className="min-w-0"><span className="block text-sm font-semibold text-ink">{place.name}</span>{place.address ? <span className="block truncate text-[11px] text-text-muted">{place.address}</span> : null}</span>
        </button></li>
      ))}
    </ul>
  );
}
