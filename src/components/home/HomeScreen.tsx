/**
 * Pantalla Inicio — /inicio (variante A) y /inicio/b (variante B)
 * (port de colectivos-amba/src/app/inicio)
 *
 * Línea primero (docs/HOME-LINEA-FIRST.md): elegí tu línea → parada →
 * próximos arribos, con el mapa como acción secundaria. Debajo del pliegue
 * siguen el asistente, los accesos clásicos y las alertas.
 * Tokens: DESIGN.MD (canvas/ink/hairline). Íconos: lucide-react.
 */

'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Route,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { BottomNav } from '@/components/ui/bottom-nav';
import { AssistantBar } from '@/components/home/AssistantBar';
import { AssistantAnswerSheet } from '@/components/home/AssistantAnswerSheet';
import { ClassicTripActions, type ClassicTripAction } from '@/components/home/ClassicTripActions';
import { LineLookupSheet } from '@/components/home/LineLookupSheet';
import { buildTripJourneyUrl } from '@/lib/trip-map-navigation';
import { requestDeviceLocation, SIMULATED_USER_LOCATION } from '@/lib/config/user-location';
import { nearbyStopsFor as findNearbyStops } from '@/lib/services/assistant-intent-service';
import { LocationConsentModal } from '@/components/home/LocationConsentModal';
import { FeatureTour, hasSeenFeatureTour } from '@/components/onboarding/FeatureTour';
import { PlaceSelector } from '@/components/home/PlaceSelector';
import { AssistantWizard } from '@/components/home/AssistantWizard';
import { MetropolRose } from '@/components/brand/metropol-logo';
import { LineChips } from '@/components/home/line-first/LineChips';
import { LinePreviewMap } from '@/components/home/line-first/LinePreviewMap';
import { LineArrivalsCard } from '@/components/home/line-first/LineArrivalsCard';
import { StopPickerSheet } from '@/components/home/line-first/StopPickerSheet';
import { RecentTrips } from '@/components/home/line-first/RecentTrips';
import { ViewMapCta } from '@/components/home/line-first/ViewMapCta';
import { useLineFirstSelection } from '@/hooks/use-line-first-selection';
import { routeBounds, stopAreaBounds, type CatalogLine } from '@/lib/home/line-first';
import { SEEDED_ROUTES, type SeededRoute } from '@/lib/home/seeded-routes';
import { MOCK_STOPS, MOCK_LINES, MOCK_ALERTS } from '@/mock/data';
import { subscribeToPositions } from '@/mock/live';
import { useFavorites } from '@/hooks/use-favorites';
import { useAssistantSession } from '@/hooks/use-assistant-session';
import { assistantRefFromSession } from '@/lib/assistant-session';
import { TripPlannerService } from '@/lib/services/trip-planner-service';
import { TransportService } from '@/lib/services/transport-service';
import {
  nearbyStopsFor,
  resolveAssistantQuery,
  type AssistantAnswer,
  type AssistantQuery,
} from '@/lib/services/assistant-intent-service';
import type { TripOption } from '@/types/trip-planner';
import type { VehiclePosition } from '@/lib/data-service';
import type { LocationPoint } from '@/types/trip-planner';

const ACTIVE_ALERTS = MOCK_ALERTS.filter((a) => a.status !== 'resolved');
const ALL_LINE_IDS = MOCK_LINES.map((l) => l.id);

/**
 * Aviso de alerta para un recorrido: si su línea tiene una alerta activa,
 * la tarjeta muestra un badge titilando ("RETRASO"/"DESVÍO"/"CORTE").
 * Solo Home: el mapa todavía NO refleja la demora (ver backlog en el .md).
 */
const ALERT_BADGE_LABEL: Record<string, string> = {
  delay: 'RETRASO',
  suspension: 'CORTE',
  route_change: 'DESVÍO',
};

function activeAlertLabelForLine(lineId: string): string | null {
  const alert = ACTIVE_ALERTS.find((a) => a.lineId === lineId && a.disrupcion);
  return alert ? (ALERT_BADGE_LABEL[alert.type] ?? 'ALERTA') : null;
}

const subscribeToNothing = () => () => {};
const formatToday = () =>
  new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * La fecha se resuelve solo en el cliente: la página se prerenderiza en el
 * build y una fecha de servidor no coincide con la del dispositivo (React #418).
 */
function useToday(): string | null {
  return useSyncExternalStore(subscribeToNothing, formatToday, () => null);
}

interface HomeScreenProps {
  /** a: imagen 1 (línea primero) · b: imagen 2 (últimos viajes primero, mapa grande). */
  variant: 'a' | 'b';
  /** Catálogo armado en el servidor (routes.json operativas + metropol.json próximamente). */
  catalog: CatalogLine[];
}

export function HomeScreen({ variant, catalog }: HomeScreenProps) {
  const router = useRouter();
  const { favorites } = useFavorites();

  // ─── Asistente del inicio (PBI-017 + PBI-019): fases, permiso decorativo,
  //     selector de lugar y respuesta persistida que refresca con GPS live ───
  const [positions, setPositions] = useState<VehiclePosition[]>([]);
  // La consulta exhibida; la respuesta se DERIVA (useAnswer) para refrescar
  // con el GPS live sin setState dentro de un effect.
  const [activeQuery, setActiveQuery] = useState<AssistantQuery | null>(null);
  // Parada en foco de la hoja → refinamiento contextual ("¿cuándo llega?" aquí).
  const [paradaRef, setParadaRef] = useState<string | undefined>(undefined);
  // Máquina de fases del flujo: idle → consent → selector → answer.
  const [phase, setPhase] = useState<'idle' | 'consent' | 'selector' | 'answer'>('idle');
  // Wizard de viaje en 3 pasos (PBI-020): overlay propio del chip "¿Cómo llego a…?".
  const [wizardOpen, setWizardOpen] = useState(false);
  const [lineLookupOpen, setLineLookupOpen] = useState(false);
  const [showFeatureTour, setShowFeatureTour] = useState(false);
  // true = al terminar el selector de lugar, reabrir el wizard (paso 1 "Cambiar").
  const [wizardResume, setWizardResume] = useState(false);
  // Destino elegido explícitamente en Home. Se conserva a través del gate de
  // ubicación para omitir el paso Destino, pero nunca se infiere de texto libre.
  const [pendingDestino, setPendingDestino] = useState<LocationPoint | null>(null);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const { session, setConsentido, setLugar, setParadaSelId, setLastQuery } = useAssistantSession();

  useEffect(() => {
    const unsubscribe = subscribeToPositions(ALL_LINE_IDS, setPositions);
    return unsubscribe;
  }, []);

  const runAssistant = useCallback(
    (query: AssistantQuery, ctxOverride?: { paradaRef?: string }) => {
      setActiveQuery(query);
      setPhase('answer');
      setLastQuery({
        intent: query.intent,
        destinoText: query.destinoText,
        lineaNumero: query.lineaNumero,
        originStopId: query.originStopId ?? ctxOverride?.paradaRef,
      });
      if (ctxOverride) setParadaRef(ctxOverride.paradaRef);
    },
    [setLastQuery],
  );

  // Respuesta derivada: se recalcula sola cuando llega el tick de GPS (1 Hz)
  // o cambia el contexto (lugar, parada en foco, favoritos).
  const answer = useMemo<AssistantAnswer | null>(() => {
    if (phase !== 'answer' || !activeQuery) return null;
    return resolveAssistantQuery(activeQuery, {
      ref: assistantRefFromSession(session),
      paradaRef,
      favorites: favorites.map((f) => f.stopId),
      positions,
    });
  }, [phase, activeQuery, session, paradaRef, favorites, positions]);

  /**
   * §2 Wizard de viaje en 3 pasos: ubicación → parada → destino.
   * Requiere el gate de consentimiento/lugar antes de abrirse.
   * SIEMPRE muestra el wizard: si ya existe una guía completa (PBI-019), el
   * paso "Destino" se reanuda con la parada y el destino anteriores cargados
   * para confirmar o cambiar — nunca se los saltea.
   */
  const openTripWizard = useCallback((destination?: LocationPoint) => {
    setPendingDestino(destination ?? null);
    setWizardError(null);
    setParadaRef(undefined);
    if (!session.consentido) {
      setWizardResume(true);
      setPhase('consent');
      return;
    }
    if (!session.lugar) {
      setWizardResume(true);
      setPhase('selector');
      return;
    }
    setWizardOpen(true);
  }, [session.consentido, session.lugar]);

  /** Reanudación del wizard con la última guía completa persistida. */
  const wizardResumeGuide =
    session.paradaSelId &&
    session.lastQuery?.intent === 'trip_plan' &&
    session.lastQuery.destinoText
      ? {
          paradaId: session.paradaSelId,
          destino: session.lastQuery.destinoText,
        }
      : null;

  // ─── Ubicación real o demo. La API se invoca exclusivamente desde el CTA. ───
  const openWizardForLocation = useCallback((location: LocationPoint) => {
    const nearby = findNearbyStops({
      ref: { lat: location.lat, lng: location.lng, name: location.name, isSimulated: Boolean(location.source === 'simulated') },
      favorites: [],
      positions,
    }, 1);
    if (nearby.length === 0) {
      throw new Error('No encontramos paradas de la red cerca de tu ubicación. Podés usar Parque Centenario.');
    }
    setConsentido(true);
    setLugar({ name: location.name, address: location.address, lat: location.lat, lng: location.lng, stopId: location.stopId });
    setParadaSelId(null);
    setPhase('idle');
    setWizardResume(false);
    setWizardError(null);
    setWizardOpen(true);
  }, [positions, setConsentido, setLugar, setParadaSelId]);

  const handleConsentUseReal = useCallback(async () => {
    const location = await requestDeviceLocation();
    openWizardForLocation({ ...location, source: 'text' });
    if (!hasSeenFeatureTour()) setShowFeatureTour(true);
  }, [openWizardForLocation]);

  const handleConsentUseDemo = useCallback(() => {
    openWizardForLocation({ ...SIMULATED_USER_LOCATION, source: 'simulated' });
    if (!hasSeenFeatureTour()) setShowFeatureTour(true);
  }, [openWizardForLocation]);

  const handleConsentClose = useCallback(() => {
    setPhase('idle');
    setPendingDestino(null);
  }, []);

  // Fallback manual del consentimiento: el selector de lugar reanuda el wizard
  // igual que un lugar confirmado (wizardResume ya viene true del gate).
  const handleConsentUseManual = useCallback(() => {
    setConsentido(true);
    setPhase('selector');
  }, [setConsentido]);

  // ─── Handler del selector de lugar ───
  const handlePlaceSelect = useCallback(
    (place: LocationPoint) => {
      const lugar = {
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        stopId: place.stopId,
      };
      setLugar(lugar);
      // Cambiar de lugar invalida la parada elegida en el wizard.
      setParadaSelId(null);
      // El wizard pidió "Cambiar ubicación": se reabre en el paso 1 con el
      // nuevo lugar, sin ejecutar la consulta de llegadas pendiente.
      if (wizardResume) {
        setWizardResume(false);
        setWizardError(null);
        setWizardOpen(true);
        return;
      }
      const query =
        session.lastQuery
          ? {
              intent: session.lastQuery.intent,
              destinoText: session.lastQuery.destinoText,
              lineaNumero: session.lastQuery.lineaNumero,
            }
          : { intent: 'next_arrival' as const };
      // El snapshot de sesión se actualiza con el notify() de setLugar en el
      // mismo batch; el useMemo de answer resuelve ya con el lugar nuevo.
      runAssistant(query, { paradaRef: place.stopId });
    },
    [session.lastQuery, setLugar, setParadaSelId, wizardResume, runAssistant],
  );

  const handlePlaceCancel = useCallback(() => {
    setPhase('idle');
    setWizardResume(false);
    setPendingDestino(null);
  }, []);

  // ─── Wizard de viaje (PBI-020) ───
  const wizardNearbyStops = useMemo(
    () =>
      nearbyStopsFor(
        {
          ref: assistantRefFromSession(session),
          favorites: favorites.map((f) => f.stopId),
          positions,
        },
        3,
      ),
    [session, favorites, positions],
  );

  const handleWizardComplete = useCallback(
    (paradaId: string, destinoText: string, selectedDestination?: LocationPoint) => {
      if (selectedDestination) {
        setWizardError(null);
        const trip = TripPlannerService.planTrip(paradaId, selectedDestination).find((option) =>
          option.legs.some((leg) => leg.type === 'ride' && leg.fromStop.id === paradaId),
        );
        if (!trip) {
          setWizardError('No encontramos un colectivo para ese destino desde esta parada. Elegí otra parada cercana.');
          return false;
        }
        setWizardOpen(false);
        setPendingDestino(null);
        setParadaSelId(paradaId);
        setPhase('idle');
        router.push(buildTripJourneyUrl(trip, trip.origin, { boardingStopId: paradaId }));
        return true;
      }
      setWizardOpen(false);
      setPendingDestino(null);
      setParadaSelId(paradaId);
      runAssistant(
        { intent: 'trip_plan', destinoText, originStopId: paradaId },
        { paradaRef: paradaId },
      );
      return true;
    },
    [router, setParadaSelId, runAssistant],
  );

  const handleWizardChangeLocation = useCallback(() => {
    setWizardOpen(false);
    setWizardResume(true);
    setPhase('selector');
  }, []);

  const handleWizardClose = useCallback(() => {
    setWizardOpen(false);
    setWizardResume(false);
    setPendingDestino(null);
  }, []);

  /**
   * §3: tocar el viaje en la hoja final cierra la hoja y navega al mapa con
   * trip=1 + origen + destino + línea/ramal → Modo Viaje con el recorrido
   * trazado, la línea resaltada y sus unidades activas a la vista.
   */
  const handleOpenTripOnMap = useCallback(
    (trip: TripOption, origin: LocationPoint, boardingStopId?: string, arrival?: import('@/types/transport').EstimacionLlegada) => {
      setPhase('idle');
      router.push(buildTripJourneyUrl(trip, origin, { boardingStopId: boardingStopId ?? origin.stopId, arrival }));
    },
    [router],
  );

  const handleAskArrivalsAt = useCallback(
    (stopId: string) => {
      setParadaRef(stopId);
      // setParadaRef es async: se pasa el foco explícito en el override de ctx.
      runAssistant({ intent: 'next_arrival', paradaId: stopId }, { paradaRef: stopId });
    },
    [runAssistant],
  );

  const handleSelectCandidate = useCallback(
    (candidate: LocationPoint) => {
      runAssistant({
        intent: 'trip_plan',
        destinoText: candidate.name,
        ...(session.paradaSelId ? { originStopId: session.paradaSelId } : {}),
      });
    },
    [runAssistant, session.paradaSelId],
  );

  /** El buscador es destino directo: no se pasa por el parser de preguntas. */
  const handleDestinationSearch = useCallback(
    (destination: LocationPoint) => {
      openTripWizard(destination);
    },
    [openTripWizard],
  );

  const handleClassicTripAction = useCallback((action: ClassicTripAction) => {
    if (action === 'line') {
      setLineLookupOpen(true);
      return;
    }
    // La pantalla de planificación nunca solicita la ubicación al entrar.
    // Cada acceso llega al mismo formulario; el pasajero la pide desde Origen.
    if (action === 'nearby' || action === 'destination') {
      router.push('/como-llego');
      return;
    }
    router.push('/mapas?explorar=1');
  }, [router]);

  /** Resultado del buscador de líneas: cierra la hoja y abre su diagrama. */
  const handleSelectLookupLine = useCallback(
    (lineId: string) => {
      setLineLookupOpen(false);
      router.push(`/diagrama/${lineId}`);
    },
    [router],
  );

  const closeAnswer = useCallback(() => {
    setActiveQuery(null);
    setParadaRef(undefined);
    setPhase('idle');
  }, []);

  /** "Cambiar lugar" desde la hoja: vuelve al selector sin pedir permiso. */
  const handleChangePlace = useCallback(() => {
    setPhase('selector');
  }, []);

  /**
   * sdd/trip-options-upgrade 2.5 (fix verify #4108): re-pick de destino desde el
   * estado zero-bus de la hoja de Home. Reabre el wizard "¿Cómo llego a…?" en el
   * paso Destino CONSERVANDO el origen: `wizardResumeGuide` reanuda con la parada
   * elegida (`session.paradaSelId`) y el último destino, sin resetear el lugar ni
   * el consentimiento.
   */
  const handleRepickDestination = useCallback(() => {
    openTripWizard();
  }, [openTripWizard]);

  /**
   * B2 · "Historial de paradas": cada recorrido demo se resuelve contra los
   * datos existentes (parada origen/destino + línea) y muestra la próxima
   * llegada del colectivo en la parada de abordaje. Se recalcula con el tick
   * de GPS (1 Hz) igual que el asistente.
   */
  const seededRoutes = useMemo(
    () =>
      SEEDED_ROUTES.flatMap((seed) => {
        const origin = MOCK_STOPS.find((s) => s.id === seed.originStopId);
        const destination = MOCK_STOPS.find((s) => s.id === seed.destinationStopId);
        const line = MOCK_LINES.find((l) => l.id === seed.lineId);
        if (!origin || !destination || !line) return [];
        const arrival =
          TransportService.getArrivals(seed.originStopId, positions)
            .filter((a) => a.lineaId === seed.lineId)
            .sort((a, b) => a.minutos - b.minutos)[0] ?? null;
        return [{ seed, origin, destination, line, arrival, alertLabel: activeAlertLabelForLine(seed.lineId) }];
      }),
    [positions],
  );

  // ─── Línea primero (docs/HOME-LINEA-FIRST.md): línea → parada → arribos ───
  const lineFirst = useLineFirstSelection(catalog, positions);
  const { context: lineContext, selectStop } = lineFirst;
  const [stopPickerOpen, setStopPickerOpen] = useState(false);
  const [showAllLines, setShowAllLines] = useState(false);
  const closeStopPicker = useCallback(() => setStopPickerOpen(false), []);
  const handlePickStop = useCallback(
    (stopId: string) => {
      selectStop(stopId);
      setStopPickerOpen(false);
    },
    [selectStop],
  );
  const previewBounds = useMemo(
    () => (lineContext ? (variant === 'a' ? stopAreaBounds(lineContext) : routeBounds(lineContext)) : null),
    [lineContext, variant],
  );

  /** Un tap en un recorrido demo inicia ese viaje en el mapa. */
  const startSeededTrip = useCallback(
    (seed: SeededRoute) => {
      const trip = TripPlannerService.planTrip(seed.originStopId, seed.destinationStopId).find(
        (option) =>
          option.legs.some(
            (leg) =>
              leg.type === 'ride' &&
              leg.lineaId === seed.lineId &&
              leg.fromStop.id === seed.originStopId,
          ),
      );
      if (!trip) return;
      router.push(buildTripJourneyUrl(trip, trip.origin, { boardingStopId: seed.originStopId }));
    },
    [router],
  );

  const today = useToday();

  return (
    <div className="home-backdrop h-dvh flex flex-col overflow-hidden">
      {/* Velo de apertura: cubre el primer paint y se disuelve mientras las
          secciones entran. pointer-events-none y se apaga con reduced-motion. */}
      <div className="home-veil" aria-hidden="true" />
      <header className="home-rise px-4 pt-6 pb-3 flex items-center gap-3 shrink-0">
        <MetropolRose className="h-9 w-auto shrink-0" />
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight tracking-tight text-ink">
            Hola <span className="home-wave" aria-hidden="true">👋</span>{' '}
            <span className="font-black italic">Elegí tu línea</span>
          </h1>
          <p className="mt-0.5 min-h-5 text-sm font-light capitalize text-text-muted">{today ?? ''}</p>
        </div>
      </header>

      <main className="px-4 flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[104px]">
        {variant === 'a' ? (
          <>
            {/* Variante A (imagen 1): Elegí tu línea → mapa del tramo → arribos → Ver mapa → últimos viajes */}
            <section aria-label="Elegí tu línea" className="flex flex-col gap-3">
              <LineChips lines={catalog} selectedLineId={lineFirst.selection?.lineId ?? null} onSelect={lineFirst.selectLine} />
              {lineFirst.notice && (
                <p role="status" className="home-fade rounded-2xl border border-hairline bg-canvas-soft px-3 py-2 text-sm text-text-muted">
                  {lineFirst.notice}
                </p>
              )}
              {lineContext && previewBounds && (
                <div style={{ '--home-delay': '260ms' } as CSSProperties}>
                  <LinePreviewMap
                    recorridoId={lineContext.recorrido.id}
                    stop={lineContext.stop}
                    color={lineContext.line.color}
                    positions={lineFirst.linePositions}
                    bounds={previewBounds}
                    href={lineFirst.mapHref}
                    ariaLabel={`Ver la línea ${lineContext.line.numero} en el mapa en vivo, parada ${lineContext.stop.nombre}`}
                    className="h-[196px]"
                  />
                </div>
              )}
              {lineContext && (
                <div className="home-rise" style={{ '--home-delay': '400ms' } as CSSProperties}>
                  <LineArrivalsCard
                    context={lineContext}
                    arrivals={lineFirst.arrivals}
                    frequencyMin={lineFirst.frequencyMin}
                    perHour={lineFirst.perHour}
                    onToggleDirection={lineFirst.toggleDirection}
                    onOpenStopPicker={() => setStopPickerOpen(true)}
                    bare
                  />
                </div>
              )}
            </section>

            {lineContext && (
              <div className="home-rise" style={{ '--home-delay': '540ms' } as CSSProperties}>
                <ViewMapCta href={lineFirst.mapHref} lineNumber={lineContext.line.numero} color={lineContext.line.color} />
              </div>
            )}

            <RecentTrips items={seededRoutes} onStart={startSeededTrip} revealOffset={620} />
          </>
        ) : (
          <>
            {/* Variante B (imagen 2): últimos viajes → Elegí una línea → mapa del recorrido + arribos */}
            <div className="mt-1">
              <RecentTrips items={seededRoutes} onStart={startSeededTrip} />
            </div>

            {/* Sin transform en la sección: es ancestro del mapa (incidente WebKit).
                Sin encabezado: "Elegí tu línea" ya vive en el header unificado;
                el carrusel arranca directo bajo las tarjetas de últimos viajes. */}
            <section aria-label="Elegí una línea">
              <LineChips
                lines={catalog}
                selectedLineId={lineFirst.selection?.lineId ?? null}
                onSelect={lineFirst.selectLine}
                layout={showAllLines ? 'grid' : 'row'}
                trailing={(
                  <button
                    type="button"
                    onClick={() => setShowAllLines((value) => !value)}
                    aria-expanded={showAllLines}
                    className="inline-flex shrink-0 items-center gap-0.5 self-center text-sm font-semibold text-electric-blue"
                  >
                    {showAllLines ? 'Ver menos' : 'Ver todas'}
                    <ChevronRight className={`h-4 w-4 transition-transform ${showAllLines ? '-rotate-90' : ''}`} aria-hidden="true" />
                  </button>
                )}
              />
              {lineFirst.notice && (
                <p role="status" className="home-fade mt-2 rounded-2xl border border-hairline bg-canvas-soft px-3 py-2 text-sm text-text-muted">
                  {lineFirst.notice}
                </p>
              )}
              {lineContext && (
                <div className="home-fade home-surface mt-3 overflow-hidden rounded-3xl border border-hairline" style={{ '--home-delay': '360ms' } as CSSProperties}>
                  {previewBounds && (
                    <LinePreviewMap
                      recorridoId={lineContext.recorrido.id}
                      stop={lineContext.stop}
                      color={lineContext.line.color}
                      positions={lineFirst.linePositions}
                      bounds={previewBounds}
                      href={lineFirst.mapHref}
                      ariaLabel={`Ver la línea ${lineContext.line.numero} en el mapa en vivo, parada ${lineContext.stop.nombre}`}
                      className="h-[300px] rounded-none border-0 shadow-none"
                    />
                  )}
                  <LineArrivalsCard
                    context={lineContext}
                    arrivals={lineFirst.arrivals}
                    frequencyMin={lineFirst.frequencyMin}
                    perHour={lineFirst.perHour}
                    onToggleDirection={lineFirst.toggleDirection}
                    onOpenStopPicker={() => setStopPickerOpen(true)}
                    className="rounded-none border-0 bg-none shadow-none"
                  />
                </div>
              )}
            </section>
          </>
        )}

        {/* Debajo del pliegue: todo lo que no figura en los bocetos sigue disponible */}
        <section className="home-rise mt-2" style={{ '--home-delay': '720ms' } as CSSProperties}>
          <p className="text-sm font-semibold text-text-muted">Planificá tu viaje</p>
          <div className="mt-2">
            <AssistantBar onSubmit={handleDestinationSearch} />
          </div>
        </section>

        <div className="home-rise" style={{ '--home-delay': '800ms' } as CSSProperties}>
          <ClassicTripActions onSelect={handleClassicTripAction} />
        </div>

        {/* Alertas — primer incidente activo del catálogo */}
        {(() => {
          const firstAlert = ACTIVE_ALERTS[0];
          const firstLine = firstAlert
            ? MOCK_LINES.find((l) => l.id === firstAlert.lineId)
            : null;
          const AlertIcon =
            firstAlert?.type === 'route_change' ? Route : AlertTriangle;
          return (
            <section className="home-rise mt-1 mb-6" style={{ '--home-delay': '880ms' } as CSSProperties}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[20px] font-semibold text-ink">
                  Alertas
                </h2>
                <Link
                  href="/alertas"
                  className="text-sm font-semibold text-ink hover:underline"
                >
                  Ver todas
                </Link>
              </div>
              {firstAlert && firstLine ? (
                <Link
                  href={`/alerta/${firstAlert.id}`}
                  aria-label={`Ver informe de ${firstAlert.title}, línea ${firstLine.shortName}`}
                  className="bg-canvas border border-hairline rounded-2xl p-4 flex items-start gap-3 shadow-sm hover:bg-canvas-soft active:scale-[0.99] transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-canvas-soft flex items-center justify-center flex-shrink-0">
                    <AlertIcon className="w-5 h-5 text-[#d97706]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink mb-1">
                      {firstAlert.title}
                    </p>
                    <p className="text-sm text-text-muted leading-snug">
                      Línea {firstLine.shortName}: {firstAlert.description}
                    </p>
                  </div>
                  <span className="h-8 px-3 flex items-center bg-canvas-soft text-ink font-semibold rounded-full text-xs shrink-0 self-center border border-hairline">
                    Ver
                  </span>
                </Link>
              ) : (
                <div className="bg-canvas border border-hairline rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                  <CheckCircle2 className="w-5 h-5 text-[#16a34a]" />
                  <p className="text-sm text-text-muted">
                    Sin alertas activas — todas las líneas circulan con
                    normalidad.
                  </p>
                </div>
              )}
            </section>
          );
        })()}
      </main>

      {/* Hoja de respuesta del asistente: fija sobre el dock, con colapso por arrastre.
          Solo visible en fase answer (PBI-019); al re-abrir el chip vuelve el mismo
          contexto persistido, refrescado con GPS live. */}
      {phase === 'answer' && answer && (
        <AssistantAnswerSheet
          answer={answer}
          contextLabel={session.lugar?.name}
          onChangePlace={session.consentido ? handleChangePlace : undefined}
          onClose={closeAnswer}
          onSelectCandidate={handleSelectCandidate}
          onAskArrivalsAt={handleAskArrivalsAt}
          onOpenTripOnMap={handleOpenTripOnMap}
          onRepickDestination={handleRepickDestination}
        />
      )}

      <LineLookupSheet open={lineLookupOpen} onClose={() => setLineLookupOpen(false)} onSelectLine={handleSelectLookupLine} />

      {lineContext && (
        <StopPickerSheet
          open={stopPickerOpen}
          context={lineContext}
          onClose={closeStopPicker}
          onSelectStop={handlePickStop}
          onSelectRamal={lineFirst.selectRamal}
        />
      )}

      {/* Flujo PBI-019: permiso decorativo → selector de lugar */}
      {phase === 'consent' && (
        <LocationConsentModal
          onUseReal={handleConsentUseReal}
          onUseDemo={handleConsentUseDemo}
          onUseManual={handleConsentUseManual}
          onClose={handleConsentClose}
        />
      )}
      {phase === 'selector' && (
        <PlaceSelector onSelect={handlePlaceSelect} onCancel={handlePlaceCancel} />
      )}

      {/* Tour de features (PBI-019): 3 pantallas, skipeable, persistente. */}
      <FeatureTour show={showFeatureTour} onClose={() => setShowFeatureTour(false)} />

      {/* §2 Wizard "¿Cómo llego a…?" en 3 pasos (PBI-020). Con guía previa
          persistida, reanuda en el paso Destino con los datos cargados. */}
      <AssistantWizard
        open={wizardOpen}
        locationName={assistantRefFromSession(session).name}
        nearbyStops={wizardNearbyStops}
        initialStep={!pendingDestino && wizardResumeGuide ? 'destino' : undefined}
        initialParadaId={!pendingDestino ? wizardResumeGuide?.paradaId ?? null : null}
        initialDestino={pendingDestino?.name ?? wizardResumeGuide?.destino ?? null}
        preselectedDestination={pendingDestino}
        submissionError={wizardError}
        onChangeLocation={handleWizardChangeLocation}
        onClose={handleWizardClose}
        onComplete={handleWizardComplete}
      />

      <div className="shrink-0 fixed bottom-0 left-0 right-0 z-40">
        <BottomNav />
      </div>
    </div>
  );
}
