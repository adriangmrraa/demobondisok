/**
 * Asistente del Home — Servicio de Intents (INC-1)
 *
 * Parser determinista SIN LLM: clasifica la pregunta del usuario final
 * (chips o texto libre en español rioplatense) en uno de cuatro intents y
 * resuelve la respuesta delegando a los servicios que ya existen:
 *   - next_arrival  → TransportService.getLlegadasPorParada (GPS live)
 *   - nearest_stop  → TripPlannerService.findCandidateStops (Haversine + caminata)
 *   - trip_plan     → resolveLocationPoint + TripPlannerService.planTrip
 *   - walk_timing   → calculateWalkFeasibility (¿llego caminando antes que el bondi?)
 *
 * Regla de oro: resolveLocationPoint === NUNCA puede degradarse al fallback
 * de Parque Centenario del ViajeHeader. Acá un destino no resuelto produce
 * `clarify` con candidatos, no un viaje desde el lugar equivocado.
 *
 * Módulo puro de lógica (no usa React ni DOM); todo es síncrono.
 */

import { normalizeText } from "@/lib/planner/geocoder";
import { TransportService } from "@/lib/services/transport-service";
import { TripPlannerService, type CandidateStop } from "@/lib/services/trip-planner-service";
import { calculateWalkFeasibility, type WalkFeasibility } from "@/lib/services/stop-schedule-service";
import type { EstimacionLlegada, Linea, Parada } from "@/types/transport";
import type { LocationPoint, TripOption } from "@/types/trip-planner";
import type { VehiclePosition } from "@/lib/data-service";
import type { UserLocation } from "@/lib/config/user-location";

// ─── Tipos del contrato Asistente ────────────────────────────────────────────

export type AssistantIntent =
  | "next_arrival"
  | "nearest_stop"
  | "trip_plan"
  | "walk_timing"
  | "unknown";

export interface AssistantQuery {
  intent: AssistantIntent;
  /** Parada de referencia explícita (refinamiento contextual desde el sheet). */
  paradaId?: string;
  /** Número de línea si la pregunta la menciona ("cuándo llega el 194"). */
  lineaNumero?: string;
  /** Texto de destino para trip_plan ("¿cómo llego a Once?"). */
  destinoText?: string;
  /**
   * Origen fijo del viaje (paso 2 del wizard, PBI-020). Cuando está presente
   * junto a destinoText, la respuesta es una guía compuesta (trip-guide) que
   * combina el viaje sugerido con las llegadas reales EN ESA parada.
   */
  originStopId?: string;
}

export interface NearbyStopItem {
  parada: Parada;
  distanceMeters: number;
  walkMinutes: number;
}

export type AssistantAnswer =
  | {
      kind: "arrivals";
      headline: string;
      parada: Parada;
      arrivals: EstimacionLlegada[];
    }
  | {
      kind: "nearby-stops";
      headline: string;
      stops: NearbyStopItem[];
    }
  | {
      kind: "trip";
      headline: string;
      origin: LocationPoint;
      destination: LocationPoint;
      trip: TripOption;
    }
  | {
      kind: "walk-timing";
      headline: string;
      parada: Parada;
      arrival: EstimacionLlegada;
      feasibility: WalkFeasibility;
    }
  | {
      kind: "clarify";
      headline: string;
      /** Candidatos de locations para "¿quisiste decir…?" (0 = sin candidatos). */
      candidates: LocationPoint[];
    }
  | {
      kind: "no-coverage";
      headline: string;
    }
  | {
      /** Resultado compuesto del wizard de 3 pasos (PBI-020): parada de origen
       *  elegida (paso 2) + destino (paso 3) → viaje sugerido + próximas
       *  llegadas reales en ESA parada, para el modal final. */
      kind: "trip-guide";
      headline: string;
      originStop: Parada;
      destination: LocationPoint;
      trip: TripOption | null;
      arrivals: EstimacionLlegada[];
    };

export interface AssistantContext {
  /** Ubicación de referencia (hoy simulada; ver user-location.ts). */
  ref: UserLocation;
  /** Parada en foco del sheet (refinamiento). */
  paradaRef?: string;
  /** Origen explícito del viaje (p. ej. la parada elegida en el wizard paso 2). */
  originPoint?: LocationPoint;
  /** Paradas favoritas del usuario (stopIds). */
  favorites?: string[];
  /** Última posición conocida del feed GPS live. */
  positions: VehiclePosition[];
}

// ─── Parser de intents ───────────────────────────────────────────────────────

/**
 * Prioridad de desempate deliberada:
 *  1. walk_timing: "¿me falta para tomar el colectivo?" menciona "colectivo"
 *     y a veces "llega"; sus keywords ("falta", "alcanza", "tiempo", "caminar")
 *     son las más específicas y van primero.
 *  2. next_arrival: "cuándo llega el próximo".
 *  3. nearest_stop: "parada más cercana".
 *  4. trip_plan: "cómo llego / voy a X" (la más genérica, va última).
 *  5. unknown.
 */
const INTENT_PATTERNS: Array<{ intent: AssistantIntent; re: RegExp }> = [
  { intent: "walk_timing", re: /\b(falta|alcanza|tiempo|caminando|caminar|me da tiempo|llego corriendo)\b/ },
  { intent: "next_arrival", re: /\b(llega|llegan|llegada|proxim|cuando pasa|cuando viene|que colectivo viene|cuando sale)\b/ },
  { intent: "nearest_stop", re: /\b(mas cercana|cerca|cercana|parada mas|estacion mas|donde hay una parada|parada cerca)\b/ },
  { intent: "trip_plan", re: /\b(llego a|llegar a|como llego|voy a|yendo a|me llevan a|como voy|como hago para llegar)\b/ },
];

const LINE_NUMBER_RE = /\b(\d{2,3})\b/;

/** Quita preposiciones/verbos de viaje para aislar el destino ("voy a once" → "once"). */
const DESTINO_STRIP_RE =
  /^(?:como\s+(?:llego|voy|hago para llegar)|llegar|voy|yendo|me llevan)\s+(?:al|a|hasta|por)?\s*/;

export function parseAssistantQuery(raw: string): AssistantQuery {
  const norm = normalizeText(raw);
  if (!norm) return { intent: "unknown" };

  let intent: AssistantIntent = "unknown";
  for (const { intent: candidate, re } of INTENT_PATTERNS) {
    if (re.test(norm)) {
      intent = candidate;
      break;
    }
  }

  // Número de línea válido: debe coincidir con una línea del catálogo (65 / 194).
  let lineaNumero: string | undefined;
  const lineMatch = LINE_NUMBER_RE.exec(norm);
  if (lineMatch) {
    const known = TransportService.getLines().find((l) => l.numero === lineMatch[1]);
    if (known) lineaNumero = known.numero;
  }

  let destinoText: string | undefined;
  if (intent === "trip_plan") {
    const preposition = /\b(?:a|hasta|por)\s+(.+)$/;
    const m = preposition.exec(norm);
    const tail = (m?.[1] ?? "").replace(/[?¿!.,]+$/g, "").trim();
    if (tail) {
      destinoText = tail.replace(DESTINO_STRIP_RE, "").trim() || tail;
    } else {
      // "voy a once" ya lo tomó la regex; fallback: quitar el prefijo verbal directo.
      const stripped = norm.replace(DESTINO_STRIP_RE, "").trim();
      if (stripped && stripped !== norm) destinoText = stripped;
    }
  }

  return { intent, ...(lineaNumero ? { lineaNumero } : {}), ...(destinoText ? { destinoText } : {}) };
}

// ─── Helpers de resolución ───────────────────────────────────────────────────

function refPoint(ref: UserLocation): LocationPoint {
  return { name: ref.name, lat: ref.lat, lng: ref.lng, isArbitrary: true, source: "simulated" };
}

function closestCandidateStops(ref: UserLocation, limit = 3): CandidateStop[] {
  return TripPlannerService.findCandidateStops(refPoint(ref)).slice(0, limit);
}

/** Parada de referencia: explícita (paradaRef) > favorita > más cercana a la ubicación. */
function referenceStop(ctx: AssistantContext): Parada | null {
  if (ctx.paradaRef) {
    const explicit = TripPlannerService.getStopById(ctx.paradaRef);
    if (explicit) return explicit;
  }
  if (ctx.favorites && ctx.favorites.length > 0) {
    const fav = TripPlannerService.getStopById(ctx.favorites[0]);
    if (fav) return fav;
  }
  const near = closestCandidateStops(ctx.ref, 1);
  return near[0]?.stop ?? null;
}

function lineByNumero(numero?: string): Linea | undefined {
  if (!numero) return undefined;
  return TransportService.getLines().find((l) => l.numero === numero);
}

/** Llega el primero: ordena por minutos ascendente y opcional filtro por línea. */
function topArrivals(stop: Parada, ctx: AssistantContext, lineaNumero?: string): EstimacionLlegada[] {
  let positions = ctx.positions;
  const linea = lineByNumero(lineaNumero);
  if (linea) positions = positions.filter((p) => p.lineId === linea.id);
  const arrivals = TransportService.getArrivals(stop.id, positions);
  const sorted = [...arrivals].sort((a, b) => a.minutos - b.minutos);
  return linea ? sorted.filter((a) => a.lineaNumero === linea.numero) : sorted;
}

// ─── Resolver ────────────────────────────────────────────────────────────────

export function resolveAssistantQuery(
  q: AssistantQuery,
  ctx: AssistantContext,
): AssistantAnswer {
  switch (q.intent) {
    case "next_arrival":
      return resolveNextArrival(q, ctx);
    case "nearest_stop":
      return resolveNearestStop(ctx);
    case "trip_plan":
      // Wizard completo (paso 2 + paso 3): guía compuesta parada→destino.
      if (q.originStopId && q.destinoText) {
        return resolveTripGuide(q.originStopId, q.destinoText, ctx);
      }
      return resolveTripPlan(q, ctx);
    case "walk_timing":
      return resolveWalkTiming(q, ctx);
    case "unknown":
    default:
      return {
        kind: "clarify",
        headline: "No te entendí. Tocá una pregunta sugerida o escribí un lugar.",
        candidates: [],
      };
  }
}

function resolveNextArrival(q: AssistantQuery, ctx: AssistantContext): AssistantAnswer {
  const stop = referenceStop(ctx);
  if (!stop) {
    return {
      kind: "no-coverage",
      headline: "Estás lejos de la red Metropol (líneas 65 y 194). Probá desde una zona cubierta.",
    };
  }
  const arrivals = topArrivals(stop, ctx, q.lineaNumero);
  if (arrivals.length === 0) {
    return {
      kind: "no-coverage",
      headline: q.lineaNumero
        ? `Por ahora no hay unidades de la línea ${q.lineaNumero} cerca de ${stop.nombre}.`
        : `No hay llegadas en vivo en ${stop.nombre}.`,
    };
  }
  return {
    kind: "arrivals",
    headline: `Próximos colectivos en ${stop.nombre}`,
    parada: stop,
    arrivals: arrivals.slice(0, 4),
  };
}

function resolveNearestStop(ctx: AssistantContext): AssistantAnswer {
  const stops = closestCandidateStops(ctx.ref, 3);
  if (stops.length === 0) {
    return {
      kind: "no-coverage",
      headline: "No encuentro paradas de la red cerca de tu ubicación.",
    };
  }
  return {
    kind: "nearby-stops",
    headline: `Paradas más cercanas a ${ctx.ref.name}`,
    stops: stops.map((c) => ({
      parada: c.stop,
      distanceMeters: c.distanceMeters,
      walkMinutes: c.walkMinutes,
    })),
  };
}

/**
 * sdd/trip-options-upgrade 2.4: reintenta planTrip sobre paradas candidatas
 * (≤6 por punta) antes de declarar no-coverage. Puro y acotado: como máximo
 * 6 orígenes × 1 destino + 1 origen × 6 destinos.
 */
function retryPlanAcrossCandidates(
  origin: LocationPoint,
  destination: LocationPoint,
  ctx: AssistantContext,
): TripOption[] | null {
  const oCands = TripPlannerService.findCandidateStops(origin).slice(0, 6);
  const dCands = TripPlannerService.findCandidateStops(destination).slice(0, 6);
  const tried = new Set<string>();
  const hits: TripOption[] = [];
  const pushHits = (o: LocationPoint, d: LocationPoint) => {
    const key = `${o.lat.toFixed(5)},${o.lng.toFixed(5)}>${d.lat.toFixed(5)},${d.lng.toFixed(5)}`;
    if (tried.has(key)) return;
    tried.add(key);
    const found = TripPlannerService.planTrip(o, d);
    if (found.length > 0) hits.push(...found.slice(0, 2));
  };
  for (const c of oCands) {
    pushHits({ name: c.stop.nombre, lat: c.stop.lat, lng: c.stop.lng, stopId: c.stop.id }, destination);
    if (hits.length > 0) break;
  }
  if (hits.length === 0) {
    for (const c of dCands) {
      pushHits(origin, { name: c.stop.nombre, lat: c.stop.lat, lng: c.stop.lng, stopId: c.stop.id });
      if (hits.length > 0) break;
    }
  }
  if (hits.length === 0) return null;
  return rankWorkingFirst(hits, ctx);
}

/**
 * sdd/trip-options-upgrade 2.4: ranking working-first — primero los viajes
 * cuya línea de abordaje tiene llegadas vivas en el feed, luego por costo
 * (transbordos, duración). No toca Pareto/top-5 del planner, solo ordena.
 */
function rankWorkingFirst(trips: TripOption[], ctx: AssistantContext): TripOption[] {
  if (trips.length <= 1 || ctx.positions.length === 0) return trips;
  const hasLive = (t: TripOption): boolean => {
    const ride = t.legs.find((leg) => leg.type === "ride");
    if (!ride) return false;
    const stopId = ride.fromStop.id;
    try {
      const arrivals = TransportService.getArrivals(stopId, ctx.positions);
      return arrivals.some((a) => a.lineaId === ride.lineaId);
    } catch {
      return false;
    }
  };
  return [...trips].sort((a, b) => Number(hasLive(b)) - Number(hasLive(a)));
}

function resolveTripPlan(q: AssistantQuery, ctx: AssistantContext): AssistantAnswer {
  const destText = q.destinoText?.trim();
  if (!destText) {
    return {
      kind: "clarify",
      headline: "¿A dónde querés ir? Escribí un lugar, por ejemplo: «cómo llego a Once».",
      candidates: [],
    };
  }

  const candidates = TripPlannerService.searchLocations(destText);
  const destination = TripPlannerService.resolveLocationPoint(destText);

  // Null-check explícito: NUNCA caer en el fallback "Parque Centenario" del planner.
  if (!destination) {
    return {
      kind: "clarify",
      headline: `No encontré «${destText}». ¿Quisiste decir…?`,
      candidates: candidates.slice(0, 3),
    };
  }

  const origin = ctx.originPoint ?? refPoint(ctx.ref);
  // sdd/trip-options-upgrade 2.4: retry multi-stop antes de no-coverage.
  // stop[0] puede dar vacío pero stop[1] del mismo trayecto sí combina.
  // Ranking working-first: hits con llegadas vivas primero, luego por costo.
  let trips = TripPlannerService.planTrip(origin, destination);
  if (trips.length === 0) {
    trips = retryPlanAcrossCandidates(origin, destination, ctx) ?? [];
  } else {
    trips = rankWorkingFirst(trips, ctx);
  }
  if (trips.length === 0) {
    return {
      kind: "no-coverage",
      headline: `No hay combinaciones en la red Metropol hacia ${destination.name}.`,
    };
  }
  const trip = trips[0];
  return {
    kind: "trip",
    headline: `A ${destination.name}: ${trip.totalDurationMinutes} min`,
    origin,
    destination,
    trip,
  };
}

function resolveWalkTiming(q: AssistantQuery, ctx: AssistantContext): AssistantAnswer {
  const stop = referenceStop(ctx);
  if (!stop) {
    return {
      kind: "no-coverage",
      headline: "No tengo una parada de referencia cerca para calcular tu caminata.",
    };
  }
  const [next] = topArrivals(stop, ctx, q.lineaNumero);
  if (!next) {
    return {
      kind: "no-coverage",
      headline: `No hay unidades en camino a ${stop.nombre} ahora mismo.`,
    };
  }
  const feasibility = calculateWalkFeasibility(
    { lat: ctx.ref.lat, lng: ctx.ref.lng },
    stop,
    next.minutos,
  );
  if (!feasibility) {
    return {
      kind: "clarify",
      headline: "Necesito tu ubicación para saber si llegás a pie.",
      candidates: [],
    };
  }
  return {
    kind: "walk-timing",
    headline: `${feasibility.label}: caminás ${feasibility.walkMin} min y el ${next.lineaNumero} llega en ${next.minutos} min`,
    parada: stop,
    arrival: next,
    feasibility,
  };
}

// ─── Wizard de 3 pasos (PBI-020): helpers del flujo ubicación→paradas→destino ─

/** Paso 2: paradas cercanas a la ubicación del wizard (ref o lugar elegido). */
export function nearbyStopsFor(ctx: AssistantContext, limit = 3): NearbyStopItem[] {
  return closestCandidateStops(ctx.ref, limit).map((c) => ({
    parada: c.stop,
    distanceMeters: c.distanceMeters,
    walkMinutes: c.walkMinutes,
  }));
}

/**
 * Paso final del wizard: origen = la parada elegida en el paso 2, destino =
 * texto validado en el paso 3. Combina el mejor viaje (o null si no hay
 * combinación) con las llegadas reales en ESA parada para el modal final.
 */
export function resolveTripGuide(
  stopId: string,
  destinoText: string,
  ctx: AssistantContext,
): AssistantAnswer {
  const stop = TripPlannerService.getStopById(stopId);
  if (!stop) {
    return { kind: 'clarify', headline: 'Esa parada ya no existe en la red.', candidates: [] };
  }
  const destination = TripPlannerService.resolveLocationPoint(destinoText);
  if (!destination) {
    return {
      kind: 'clarify',
      headline: `No encontré «${destinoText}». ¿Quisiste decir…?`,
      candidates: TripPlannerService.searchLocations(destinoText).slice(0, 3),
    };
  }
  const originPoint: LocationPoint = {
    id: stop.id,
    name: stop.nombre,
    address: stop.direccion,
    lat: stop.lat,
    lng: stop.lng,
    stopId: stop.id,
  };
  // sdd/trip-options-upgrade 2.4: retry sobre paradas candidatas del mismo
  // trayecto (≤6) antes de rendirse a no-coverage; ranking working-first.
  let trips = TripPlannerService.planTrip(originPoint, destination);
  if (trips.length === 0) {
    trips = retryPlanAcrossCandidates(originPoint, destination, ctx) ?? [];
  } else {
    trips = rankWorkingFirst(trips, ctx);
  }
  const trip = trips[0] ?? null;
  // Mostrar primero unidades que pertenecen al recorrido recomendado. Esto hace
  // que cada CTA represente el colectivo concreto que el usuario espera.
  const recommendedLineId = trip?.legs.find((leg) => leg.type === 'ride')?.lineaId;
  const allArrivals = topArrivals(stop, ctx);
  const matchingArrivals = recommendedLineId
    ? allArrivals.filter((arrival) => arrival.lineaId === recommendedLineId)
    : allArrivals;
  const arrivals = (matchingArrivals.length > 0 ? matchingArrivals : allArrivals).slice(0, 3);
  return {
    kind: 'trip-guide',
    headline: trip
      ? `De ${stop.nombre} a ${destination.name}: ${trip.totalDurationMinutes} min`
      : `Llegadas en ${stop.nombre} (no hay combinación a ${destination.name})`,
    originStop: stop,
    destination,
    trip,
    arrivals,
  };
}

// ─── Etiquetas de chips (copy es-AR para la UI) ──────────────────────────────

export const ASSISTANT_CHIPS: ReadonlyArray<{ intent: AssistantIntent; label: string }> = [
  { intent: "next_arrival", label: "¿Cuándo llega el próximo?" },
  { intent: "nearest_stop", label: "¿Parada más cercana?" },
  { intent: "trip_plan", label: "¿Cómo llego a…?" },
  { intent: "walk_timing", label: "¿Me da tiempo a caminar?" },
];
