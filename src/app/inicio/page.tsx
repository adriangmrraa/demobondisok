/**
 * Pantalla Inicio — /inicio (port de colectivos-amba/src/app/inicio)
 *
 * Hero llegada destacada, paradas favoritas (localStorage), alertas y dock.
 * Tokens: DESIGN.MD (canvas/ink/hairline). Íconos: lucide-react.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bell,
  Bus,
  MapPin,
  RefreshCw,
  MapPinOff,
  AlertTriangle,
  Route,
  CheckCircle2,
} from 'lucide-react';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ArrivalCard } from '@/components/ui/arrival-card';
import { LineBadge } from '@/components/ui/line-badge';
import { AssistantBar } from '@/components/home/AssistantBar';
import { AssistantAnswerSheet } from '@/components/home/AssistantAnswerSheet';
import { tripMapUrl } from '@/components/home/AssistantAnswerCard';
import { requestDeviceLocation, SIMULATED_USER_LOCATION } from '@/lib/config/user-location';
import { nearbyStopsFor as findNearbyStops } from '@/lib/services/assistant-intent-service';
import { LocationConsentModal } from '@/components/home/LocationConsentModal';
import { PlaceSelector } from '@/components/home/PlaceSelector';
import { AssistantWizard } from '@/components/home/AssistantWizard';
import { MetropolRose } from '@/components/brand/metropol-logo';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { MOCK_STOPS, MOCK_LINES, MOCK_ALERTS } from '@/mock/data';
import { subscribeToPositions } from '@/mock/live';
import { useFavorites } from '@/hooks/use-favorites';
import { useAssistantSession } from '@/hooks/use-assistant-session';
import { assistantRefFromSession } from '@/lib/assistant-session';
import {
  nearbyStopsFor,
  parseAssistantQuery,
  resolveAssistantQuery,
  type AssistantAnswer,
  type AssistantIntent,
  type AssistantQuery,
} from '@/lib/services/assistant-intent-service';
import type { TripOption } from '@/types/trip-planner';
import type { VehiclePosition } from '@/lib/data-service';
import type { LocationPoint } from '@/types/trip-planner';

const ACTIVE_ALERTS = MOCK_ALERTS.filter((a) => a.status !== 'resolved');
const UNREAD_ALERTS = ACTIVE_ALERTS.length;
const ALL_LINE_IDS = MOCK_LINES.map((l) => l.id);

function hashOf(s: string): number {
  return [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
}

export default function HomePage() {
  const router = useRouter();
  const { favorites } = useFavorites();
  const [refreshKey, setRefreshKey] = useState(0);

  // ─── Asistente del inicio (PBI-017 + PBI-019): fases, permiso decorativo,
  //     selector de lugar y respuesta persistida que refresca con GPS live ───
  const [positions, setPositions] = useState<VehiclePosition[]>([]);
  // La consulta exhibida; la respuesta se DERIVA (useAnswer) para refrescar
  // con el GPS live sin setState dentro de un effect.
  const [activeQuery, setActiveQuery] = useState<AssistantQuery | null>(null);
  const [activeIntent, setActiveIntent] = useState<AssistantIntent | null>(null);
  // Parada en foco de la hoja → refinamiento contextual ("¿cuándo llega?" aquí).
  const [paradaRef, setParadaRef] = useState<string | undefined>(undefined);
  // Máquina de fases del flujo: idle → consent → selector → answer.
  const [phase, setPhase] = useState<'idle' | 'consent' | 'selector' | 'answer'>('idle');
  const [pendingQuery, setPendingQuery] = useState<AssistantQuery | null>(null);
  // Wizard de viaje en 3 pasos (PBI-020): overlay propio del chip "¿Cómo llego a…?".
  const [wizardOpen, setWizardOpen] = useState(false);
  // true = al terminar el selector de lugar, reabrir el wizard (paso 1 "Cambiar").
  const [wizardResume, setWizardResume] = useState(false);
  // El botón de próxima llegada comparte el mismo recorrido completo que Mi Viaje.
  const [wizardPurpose, setWizardPurpose] = useState<'next-arrival' | 'trip-plan'>('trip-plan');
  const { session, setConsentido, setLugar, setParadaSelId, setLastQuery } = useAssistantSession();

  useEffect(() => {
    const unsubscribe = subscribeToPositions(ALL_LINE_IDS, setPositions);
    return unsubscribe;
  }, []);

  const runAssistant = useCallback(
    (query: AssistantQuery, ctxOverride?: { paradaRef?: string }) => {
      setActiveIntent(query.intent);
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

  /** Gate de los 3 chips de ubicación: permiso → selector → respuesta. */
  const gateLocationQuery = useCallback(
    (query: AssistantQuery) => {
      setActiveIntent(query.intent);
      setParadaRef(undefined);
      if (!session.consentido) {
        setPendingQuery(query);
        setPhase('consent');
        return;
      }
      if (!session.lugar) {
        setPendingQuery(query);
        setPhase('selector');
        return;
      }
      runAssistant(query);
    },
    [session.consentido, session.lugar, runAssistant],
  );

  /**
   * §2 Wizard "¿Cómo llego a…?" en 3 pasos: ubicación → parada → destino.
   * Requiere el mismo gate de consentimiento/lugar que los chips de ubicación.
   * SIEMPRE muestra el wizard: si ya existe una guía completa (PBI-019), el
   * paso "Destino" se reanuda con la parada y el destino anteriores cargados
   * para confirmar o cambiar — nunca se los saltea.
   */
  const openTripWizard = useCallback((purpose: 'next-arrival' | 'trip-plan' = 'trip-plan') => {
    setWizardPurpose(purpose);
    setActiveIntent(purpose === 'next-arrival' ? 'next_arrival' : 'trip_plan');
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

  const handleChip = useCallback(
    (intent: AssistantIntent) => {
      // Toggle: volver a tocar el chip activo oculta la hoja SIN borrar el
      // estado (consentimiento + lugar + última consulta siguen en localStorage).
      if (intent === activeIntent && phase === 'answer') {
        setPhase('idle');
        return;
      }
      if (intent === 'trip_plan' || intent === 'next_arrival') {
        openTripWizard(intent === 'next_arrival' ? 'next-arrival' : 'trip-plan');
        return;
      }
      gateLocationQuery({ intent });
    },
    [activeIntent, phase, openTripWizard, gateLocationQuery],
  );

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
    setPendingQuery(null);
    setPhase('idle');
    setWizardResume(false);
    setWizardOpen(true);
  }, [positions, setConsentido, setLugar, setParadaSelId]);

  const handleConsentUseReal = useCallback(async () => {
    const location = await requestDeviceLocation();
    openWizardForLocation({ ...location, source: 'text' });
  }, [openWizardForLocation]);

  const handleConsentUseDemo = useCallback(() => {
    openWizardForLocation({ ...SIMULATED_USER_LOCATION, source: 'simulated' });
  }, [openWizardForLocation]);

  const handleConsentClose = useCallback(() => {
    setPhase('idle');
    setActiveIntent(null);
    setPendingQuery(null);
  }, []);

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
        setWizardOpen(true);
        return;
      }
      if (wizardPurpose === 'next-arrival') {
        setPendingQuery(null);
        setPhase('idle');
        setWizardOpen(true);
        return;
      }
      const query =
        pendingQuery ??
        (session.lastQuery
          ? {
              intent: session.lastQuery.intent,
              destinoText: session.lastQuery.destinoText,
              lineaNumero: session.lastQuery.lineaNumero,
            }
          : { intent: 'next_arrival' as const });
      setPendingQuery(null);
      // El snapshot de sesión se actualiza con el notify() de setLugar en el
      // mismo batch; el useMemo de answer resuelve ya con el lugar nuevo.
      runAssistant(query, { paradaRef: place.stopId });
    },
    [pendingQuery, session.lastQuery, setLugar, setParadaSelId, wizardResume, wizardPurpose, runAssistant],
  );

  const handlePlaceCancel = useCallback(() => {
    setPhase('idle');
    setActiveIntent(null);
    setPendingQuery(null);
    setWizardResume(false);
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
    (paradaId: string, destinoText: string) => {
      setWizardOpen(false);
      setParadaSelId(paradaId);
      runAssistant(
        { intent: 'trip_plan', destinoText, originStopId: paradaId },
        { paradaRef: paradaId },
      );
    },
    [setParadaSelId, runAssistant],
  );

  const handleWizardChangeLocation = useCallback(() => {
    setWizardOpen(false);
    setWizardResume(true);
    setPhase('selector');
  }, []);

  const handleWizardClose = useCallback(() => {
    setWizardOpen(false);
    setWizardResume(false);
    setActiveIntent(null);
  }, []);

  /**
   * §3: tocar el viaje en la hoja final cierra la hoja y navega al mapa con
   * trip=1 + origen + destino + línea/ramal → Modo Viaje con el recorrido
   * trazado, la línea resaltada y sus unidades activas a la vista.
   */
  const handleOpenTripOnMap = useCallback(
    (trip: TripOption, origin: LocationPoint, boardingStopId?: string, arrival?: import('@/types/transport').EstimacionLlegada) => {
      setPhase('idle');
      router.push(tripMapUrl(trip, origin, { boardingStopId: boardingStopId ?? origin.stopId, arrival }));
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

  const handleAskFreeText = useCallback(
    (text: string) => {
      const query = parseAssistantQuery(text);
      if (query.intent === 'next_arrival' || query.intent === 'nearest_stop' || query.intent === 'walk_timing') {
        gateLocationQuery(query);
        return;
      }
      // Trip con destino en texto libre y wizard ya completo: guía desde la
      // parada elegida; si no, viaje clásico desde el lugar de referencia.
      if (query.intent === 'trip_plan' && query.destinoText && session.paradaSelId) {
        runAssistant(
          { ...query, originStopId: session.paradaSelId },
          { paradaRef: session.paradaSelId },
        );
        return;
      }
      setParadaRef(undefined);
      runAssistant(query);
    },
    [gateLocationQuery, runAssistant, session.paradaSelId],
  );

  const closeAnswer = useCallback(() => {
    setActiveQuery(null);
    setActiveIntent(null);
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
   * el consentimiento. Reusa el mismo gate que los chips (openTripWizard).
   */
  const handleRepickDestination = useCallback(() => {
    openTripWizard('trip-plan');
  }, [openTripWizard]);

  const stops = useMemo(
    () =>
      favorites.flatMap((favorite) => {
        const stop = MOCK_STOPS.find((s) => s.id === favorite.stopId);
        if (!stop) return [];
        const arrivals = stop.lineIds
          .slice(0, 2)
          .map((lineId, i) => {
            const line = MOCK_LINES.find((l) => l.id === lineId);
            if (!line) return null;
            const etaMin =
              ((hashOf(stop.id + lineId) + refreshKey * 7 + i * 3) % 12) + 1;
            return { line, etaMin, live: true };
          })
          .filter((a) => a !== null);
        return [{ stop, arrivals }];
      }),
    [favorites, refreshKey],
  );

  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const hasStops = stops.length > 0;
  const nextArrival = hasStops ? stops[0].arrivals[0] : null;

  return (
    <div className="h-dvh bg-canvas flex flex-col overflow-hidden">
      <header className="px-4 pt-6 pb-2 bg-canvas flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            aria-label="Volver al inicio"
            className="-ml-2 h-12 w-12 flex items-center justify-center rounded-full text-ink hover:bg-canvas-soft active:scale-95 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <MetropolRose className="h-6 w-auto" />
          <div>
            <h1 className="text-[22px] font-bold text-ink leading-tight">
              Hola 👋
            </h1>
            <p className="text-sm font-semibold text-text-muted capitalize">
              {today}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {/* Campana de alertas — badge real con contador activo */}
          <Link
            href="/alertas"
            className="relative h-12 w-12 flex items-center justify-center rounded-full bg-canvas-soft hover:bg-field transition-colors"
            aria-label={`Ver alertas de servicio${UNREAD_ALERTS > 0 ? `, ${UNREAD_ALERTS} activas` : ''}`}
          >
            <Bell className="w-6 h-6 text-text-muted" />
            {UNREAD_ALERTS > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center border-2 border-canvas">
                {UNREAD_ALERTS}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="px-4 flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[104px]">
        {/* Asistente — caja de texto + preguntas sugeridas */}
        <div className="mt-2">
          <AssistantBar
            onIntent={handleChip}
            onFreeText={handleAskFreeText}
            activeIntent={activeIntent}
          />
        </div>

        {/* Llegada destacada */}
        {nextArrival && (
          <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(140deg,#0E2B7A_0%,#1D4ED8_100%)] p-5 text-white shadow-lg mt-2">
            <Bus className="absolute -right-4 -bottom-5 w-28 h-28 text-white/[0.07] pointer-events-none" />
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/55">
              Próxima llegada
            </p>
            <div className="flex items-end justify-between mt-3 relative z-10">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="h-8 px-2.5 rounded-lg bg-white text-[#0E2B7A] font-extrabold text-sm inline-flex items-center shadow-sm">
                    {nextArrival.line.shortName}
                  </span>
                  <span className="text-sm font-semibold text-white/85">
                    {nextArrival.line.direction}
                  </span>
                </div>
                <p className="text-xs text-white/60 mt-2">
                  {stops[0].stop.name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-5xl font-extrabold leading-none tracking-tight">
                  {nextArrival.etaMin}
                  <span className="text-base font-bold ml-1">min</span>
                </p>
                <span className="inline-flex items-center gap-1 mt-2 h-5 px-2 rounded-full bg-white/15 border border-white/20 text-[9px] font-bold tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#71EE8A] animate-pulse" />
                  EN VIVO
                </span>
              </div>
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[20px] font-semibold text-ink">Tus paradas</h2>
            <span className="text-xs text-text-muted bg-canvas-soft px-2 py-1 rounded-full border border-hairline-soft">
              {stops.length} {stops.length === 1 ? 'parada' : 'paradas'}
            </span>
          </div>

          {hasStops ? (
            <div className="flex flex-col gap-4">
              {stops.map(({ stop, arrivals }) => (
                <div
                  key={stop.id}
                  className="bg-canvas rounded-2xl border border-hairline shadow-sm overflow-hidden"
                >
                  <div className="flex items-center justify-between p-3 border-b border-hairline-soft">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-ink" />
                      <h3 className="text-lg font-bold text-ink">
                        {stop.name}
                      </h3>
                    </div>
                    <div className="flex gap-1">
                      {MOCK_LINES.filter((l) =>
                        stop.lineIds.includes(l.id),
                      ).map((line) => (
                        <LineBadge
                          key={line.id}
                          shortName={line.shortName}
                          size="sm"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="p-2">
                    <div className="flex flex-col gap-1">
                      {arrivals.map((arrival, i) => (
                        <ArrivalCard
                          key={`${arrival.line.id}-${i}`}
                          lineName={arrival.line.shortName}
                          lineDirection={arrival.line.direction}
                          lineColor={arrival.line.color}
                          etaMin={arrival.etaMin}
                          live={arrival.live}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="p-2 pt-0">
                    <button
                      onClick={() => router.push(`/parada/${stop.id}`)}
                      className="w-full h-10 text-sm font-semibold text-ink hover:bg-canvas-soft rounded-lg transition-colors"
                    >
                      Ver todas las llegadas
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-canvas rounded-xl border border-hairline p-8 text-center">
              <MapPinOff className="w-12 h-12 text-text-faint mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-ink mb-2">
                Sin paradas guardadas
              </h3>
              <p className="text-sm text-text-muted mb-4 max-w-[280px] mx-auto">
                Agregá tus paradas frecuentes para ver las llegadas al instante.
              </p>
              <button
                onClick={() => router.push('/mapas')}
                className="h-10 px-6 bg-ink text-canvas text-sm font-semibold rounded-lg hover:bg-ink-soft transition-colors active:scale-[0.98]"
              >
                Buscar paradas
              </button>
            </div>
          )}

          {hasStops && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <span className="text-xs text-text-faint">
                Última actualización:{' '}
                {new Date().toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                className="text-xs font-semibold text-ink hover:underline inline-flex items-center gap-1"
                aria-label="Actualizar llegadas"
              >
                <RefreshCw className="w-3 h-3" />
                Actualizar
              </button>
            </div>
          )}
        </section>

        {/* Alertas — primer incidente activo del catálogo */}
        {(() => {
          const firstAlert = ACTIVE_ALERTS[0];
          const firstLine = firstAlert
            ? MOCK_LINES.find((l) => l.id === firstAlert.lineId)
            : null;
          const AlertIcon =
            firstAlert?.type === 'route_change' ? Route : AlertTriangle;
          return (
            <section className="mt-1 mb-6">
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

      {/* Flujo PBI-019: permiso decorativo → selector de lugar */}
      {phase === 'consent' && (
        <LocationConsentModal
          onUseReal={handleConsentUseReal}
          onUseDemo={handleConsentUseDemo}
          onClose={handleConsentClose}
        />
      )}
      {phase === 'selector' && (
        <PlaceSelector onSelect={handlePlaceSelect} onCancel={handlePlaceCancel} />
      )}

      {/* §2 Wizard "¿Cómo llego a…?" en 3 pasos (PBI-020). Con guía previa
          persistida, reanuda en el paso Destino con los datos cargados. */}
      <AssistantWizard
        open={wizardOpen}
        locationName={assistantRefFromSession(session).name}
        nearbyStops={wizardNearbyStops}
        initialStep={wizardResumeGuide ? 'destino' : undefined}
        initialParadaId={wizardResumeGuide?.paradaId ?? null}
        initialDestino={wizardResumeGuide?.destino ?? null}
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
