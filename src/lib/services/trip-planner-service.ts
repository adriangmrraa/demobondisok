import { PARADAS_MOCK, DATASET } from "@/lib/mock/amba-data";
import { Parada } from "@/types/transport";
import { searchGeocode, geoToLocationPoint } from "@/lib/planner/geocoder";
import {
  LocationPoint,
  TripOption,
  TripStep,
  TripLeg,
  WalkingLeg,
  TripSegmentItem,
  TripLineChip,
} from "@/types/trip-planner";

/** Velocidad promedio de caminata urbana: 75 metros por minuto (~4.5 km/h) */
const WALKING_METERS_PER_MINUTE = 75;

/** Penalización por transferencia en minutos para el costo generalizado (GTT) */
const TRANSFER_PENALTY_MINUTES = 10;
const TRANSFER_WAIT_MINUTES = 5;

/** Factor de ponderación del esfuerzo de caminata en GTT */
const WALK_PERCEPTION_FACTOR = 1.3;

/** Radio máximo de búsqueda de paradas para acceso y egreso a pie (metros) */
const MAX_ACCESS_WALK_METERS = 2000;

/** Radio máximo de caminata entre paradas para transbordo intermodal (metros) */
const MAX_TRANSFER_WALK_METERS = 850;

/**
 * Calcula la distancia ortodrómica aproximada (Haversine) entre dos coordenadas en metros.
 */
export function calculateDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);
  const h =
    sinHalfLat * sinHalfLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinHalfLng *
      sinHalfLng;
  return Math.round(2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

/**
 * Calcula el tiempo estimado de caminata en minutos.
 */
export function calculateWalkMinutes(meters: number): number {
  if (meters <= 25) return 0;
  return Math.max(1, Math.ceil(meters / WALKING_METERS_PER_MINUTE));
}

/**
 * P1-6: Caché lazy de distancias entre pares de paradas.
 * PARADAS_MOCK es estático; el loop interno de findTransferTrips recalculaba
 * el mismo haversine miles de veces por query. Con caché es O(1) amortizado.
 */
const STOP_PAIR_DISTANCE_CACHE = new Map<string, number>();

function stopPairKey(aId: string, bId: string): string {
  return aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
}

function getCachedStopDistance(a: Parada, b: Parada): number {
  if (a.id === b.id) return 0;
  const key = stopPairKey(a.id, b.id);
  let d = STOP_PAIR_DISTANCE_CACHE.get(key);
  if (d === undefined) {
    d = calculateDistanceMeters(a, b);
    STOP_PAIR_DISTANCE_CACHE.set(key, d);
  }
  return d;
}

/**
 * Recorta la geometría de un recorrido para devolver ÚNICAMENTE el tramo entre
 * la parada de subida y la de bajada, respetando la dirección de circulación.
 */
export function sliceRouteGeometry(
  coords: [number, number][],
  fromStop: { lat: number; lng: number },
  toStop: { lat: number; lng: number }
): [number, number][] {
  if (!coords || coords.length < 2) {
    return [
      [fromStop.lng, fromStop.lat],
      [toStop.lng, toStop.lat],
    ];
  }

  // Índice más cercano a la parada de inicio
  let minFromDist = Infinity;
  let fromIdx = 0;
  for (let i = 0; i < coords.length; i++) {
    const d = Math.hypot(coords[i][0] - fromStop.lng, coords[i][1] - fromStop.lat);
    if (d < minFromDist) {
      minFromDist = d;
      fromIdx = i;
    }
  }

  // Índice más cercano a la parada de fin
  let minToDist = Infinity;
  let toIdx = coords.length - 1;
  for (let i = 0; i < coords.length; i++) {
    const d = Math.hypot(coords[i][0] - toStop.lng, coords[i][1] - toStop.lat);
    if (d < minToDist) {
      minToDist = d;
      toIdx = i;
    }
  }

  if (fromIdx <= toIdx) {
    const sliced = coords.slice(fromIdx, toIdx + 1);
    return [
      [fromStop.lng, fromStop.lat],
      ...sliced,
      [toStop.lng, toStop.lat],
    ];
  } else {
    // P2-7: Proyección inconsistente (fromIdx > toIdx). Ocurre si la
    // geometría tiene loops o calles paralelas cercanas que confunden al
    // nearest-vertex. Antes se dibujaba desde fromIdx hasta el FIN de la
    // ruta (km de geometría incorrecta). Ahora: línea recta honesta entre
    // paradas. La ruta lógica sigue siendo correcta; solo la geometría
    // mostrada es simplificada en este edge case.
    return [
      [fromStop.lng, fromStop.lat],
      [toStop.lng, toStop.lat],
    ];
  }
}

export interface CandidateStop {
  stop: Parada;
  distanceMeters: number;
  walkMinutes: number;
}

/**
 * Catálogo local curado de puntos de interés, esquinas y paradas emblemáticas de AMBA.
 */
export const KNOWN_POIS: LocationPoint[] = [
  {
    name: "Manuel de la Torre y Av. Anta (Zárate)",
    address: "Manuel de la Torre y Av. Anta, Zárate",
    lat: -34.0990,
    lng: -59.0340,
    isArbitrary: true,
  },
  {
    name: "Av. Caseros y Bernardo de Irigoyen (Constitución)",
    address: "Av. Caseros y Bernardo de Irigoyen, Constitución",
    lat: -34.6278,
    lng: -58.3805,
    isArbitrary: true,
  },
  {
    name: "Parque Centenario",
    address: "Av. Díaz Vélez y Leopoldo Marechal, Caballito",
    lat: -34.604463,
    lng: -58.434711,
    stopId: "stop-65-05",
  },
  {
    name: "Hospital Durand",
    address: "Av. Díaz Vélez 5044, Caballito",
    lat: -34.6042,
    lng: -58.4335,
    isArbitrary: true,
  },
  {
    name: "Plaza Constitución",
    address: "Lima y Av. Brasil, Constitución",
    lat: -34.628772,
    lng: -58.379175,
    stopId: "stop-65-01",
  },
  {
    name: "Barrancas de Belgrano",
    address: "Virrey Vértiz y Juramento, Belgrano",
    lat: -34.558754,
    lng: -58.449503,
    stopId: "stop-65-09",
  },
  {
    name: "Av. Cabildo 2500 (Belgrano)",
    address: "Av. Cabildo 2500 entre Franklin D. Roosevelt y Monroe",
    lat: -34.55982,
    lng: -58.45891,
    isArbitrary: true,
  },
  {
    name: "Av. Cabildo y Juramento",
    address: "Av. Cabildo y Juramento (Metrobús Belgrano)",
    lat: -34.561988,
    lng: -58.456644,
    stopId: "stop-65-11",
  },
  {
    name: "Hospital Garrahan",
    address: "Pichincha y 15 de Noviembre, Parque Patricios",
    lat: -34.634219,
    lng: -58.390904,
    stopId: "stop-65-02",
  },
  {
    name: "Terminal Once (Plaza Miserere)",
    address: "Av. Rivadavia y Av. Pueyrredón, Balvanera",
    lat: -34.611364,
    lng: -58.407392,
    stopId: "stop-194-once",
  },
  {
    name: "Plaza Italia / La Rural",
    address: "Av. Santa Fe y Thames, Palermo",
    lat: -34.580952,
    lng: -58.420515,
    stopId: "stop-194-plaza-italia",
  },
  {
    name: "Puente Saavedra",
    address: "Av. Cabildo y Av. General Paz, Saavedra",
    lat: -34.538691,
    lng: -58.47466,
    stopId: "stop-194-puente-saavedra",
  },
  {
    name: "Unicenter Shopping (Panamericana y Paraná)",
    address: "Panamericana y Paraná, Martínez",
    lat: -34.509143,
    lng: -58.528079,
    stopId: "stop-194-panamericana-parana",
  },
  {
    name: "Estación Escobar",
    address: "Spadaccini y Rivadavia, Belén de Escobar",
    lat: -34.350204,
    lng: -58.795756,
    stopId: "stop-194-escobar-estacion",
  },
  {
    name: "Campana Centro",
    address: "Av. Varela y Jean Jaurès, Campana",
    lat: -34.165112,
    lng: -58.95998,
    stopId: "stop-194-campana-centro",
  },
  {
    name: "Centro de Transferencia de Zárate",
    address: "Av. Antártida Argentina y De la Torre, Zárate",
    lat: -34.097175,
    lng: -59.037046,
    stopId: "stop-194-zarate-transferencia",
  },
  {
    name: "Chacarita / Estación Federico Lacroze",
    address: "Av. Corrientes y Av. Federico Lacroze",
    lat: -34.587089,
    lng: -58.454842,
    stopId: "stop-65-08",
  },
  {
    name: "Centro de Transbordo Pacífico",
    address: "Av. Santa Fe y Av. Bullrich, Palermo",
    lat: -34.578271,
    lng: -58.425786,
    stopId: "stop-194-pacifico",
  },
];

export class TripPlannerService {
  
  public static createMapLocationPoint(
    lat: number,
    lng: number,
    labelRole: "Origen" | "Destino"
  ): LocationPoint {
    let closestKnown = "";
    let minD = 75;
    for (const poi of KNOWN_POIS) {
      const d = calculateDistanceMeters({ lat, lng }, poi);
      if (d < minD) {
        minD = d;
        closestKnown = poi.name;
      }
    }
    if (!closestKnown) {
      for (const p of PARADAS_MOCK) {
        const d = calculateDistanceMeters({ lat, lng }, p);
        if (d < minD) {
          minD = d;
          closestKnown = `Cerca de ${p.nombre}`;
        }
      }
    }

    const name = closestKnown
      ? `${labelRole}: ${closestKnown}`
      : `${labelRole} en mapa (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

    return {
      name,
      address: `Coordenadas: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      lat,
      lng,
      isArbitrary: true,
      source: "map",
    };
  }

  public static getStops(): Parada[] {
    return PARADAS_MOCK;
  }

  public static getStopById(id: string): Parada | undefined {
    return PARADAS_MOCK.find((p) => p.id === id);
  }

  public static getClosestStop(lat: number, lng: number): Parada {
    let closest = PARADAS_MOCK[0];
    let minDistance = Number.MAX_VALUE;

    for (const p of PARADAS_MOCK) {
      const d = calculateDistanceMeters({ lat, lng }, { lat: p.lat, lng: p.lng });
      if (d < minDistance) {
        minDistance = d;
        closest = p;
      }
    }

    return closest;
  }

  /**
   * Resuelve texto de búsqueda contra calles, landmarks, POIs y paradas.
   * Fuente local (geocoder): sin llamadas runtime a OSM.
   */
  public static searchLocations(query: string): LocationPoint[] {
    const q = query.trim();
    if (!q) {
      return KNOWN_POIS.slice(0, 8);
    }

    const geos = searchGeocode(
      q,
      {
        pois: KNOWN_POIS.map((p) => ({
          id: p.id ?? p.name,
          name: p.name,
          address: p.address,
          lat: p.lat,
          lng: p.lng,
          stopId: p.stopId,
        })),
        stops: PARADAS_MOCK.map((p) => ({
          id: p.id,
          name: p.nombre,
          address: p.direccion,
          lat: p.lat,
          lng: p.lng,
        })),
      },
      10,
    );

    return geos.map((g) => {
      const point = geoToLocationPoint(g);
      // Preservar POIs canónicos del planner (mismo objeto / mismo stopId)
      if (g.kind === "poi" || g.kind === "parada") {
        const known =
          KNOWN_POIS.find((p) => p.name === g.name) ??
          (() => {
            const stop = PARADAS_MOCK.find((p) => p.id === g.stopId);
            if (!stop) return null;
            return {
              id: stop.id,
              name: stop.nombre,
              address: stop.direccion,
              lat: stop.lat,
              lng: stop.lng,
              stopId: stop.id,
            } as LocationPoint;
          })();
        if (known) {
          return { ...known, focusBounds: point.focusBounds };
        }
      }
      return point as LocationPoint;
    });
  }

  /**
   * Resuelve un string o LocationPoint a una ubicación geográfica canónica.
   * Soporta direcciones y texto libre sin obligar a elegir una parada.
   */
  public static resolveLocationPoint(input: string | LocationPoint): LocationPoint | null {
    if (typeof input === "object" && input !== null) {
      return input;
    }

    const clean = input.trim();
    if (!clean) return null;

    // Buscar coincidencia en parada por ID
    const stop = this.getStopById(clean);
    if (stop) {
      return {
        id: stop.id,
        name: stop.nombre,
        address: stop.direccion,
        lat: stop.lat,
        lng: stop.lng,
        stopId: stop.id,
      };
    }

    // Geocoder local: calles ("Cabildo"), landmarks ("Obelisco"), POIs, paradas.
    const geoHits = this.searchLocations(clean);
    if (geoHits.length > 0) {
      const first = geoHits[0];
      // Preservar el texto tipeado por el usuario como name si es la mejor coincidencia libre
      if (first.isArbitrary) {
        return { ...first, name: clean };
      }
      return first;
    }

    return null;
  }

  /**
   * Encuentra paradas candidatas dentro del radio peatonal de acceso/egreso.
   */
  public static findCandidateStops(point: LocationPoint): CandidateStop[] {
    const scored = PARADAS_MOCK.map((p) => {
      const dist = calculateDistanceMeters(point, { lat: p.lat, lng: p.lng });
      return {
        stop: p,
        distanceMeters: dist,
        walkMinutes: calculateWalkMinutes(dist),
      };
    }).sort((a, b) => a.distanceMeters - b.distanceMeters);

    // Solo admitir paradas a distancia caminable realista (<= MAX_ACCESS_WALK_METERS)
    const inRadius = scored.filter((c) => c.distanceMeters <= MAX_ACCESS_WALK_METERS);
    return inRadius.slice(0, 6);
  }

  /**
   * PLANIFICADOR DE VIAJES MULTICRITERIO.
   */
  public static planTrip(
    originInput: string | LocationPoint,
    destinationInput: string | LocationPoint
  ): TripOption[] {
    const origin = this.resolveLocationPoint(originInput);
    const destination = this.resolveLocationPoint(destinationInput);

    if (!origin || !destination) {
      return [];
    }

    const directDistance = calculateDistanceMeters(origin, destination);
    if (directDistance <= 25) {
      return [];
    }

    const rawOptions: TripOption[] = [];

    // ─── CASO: Caminata Directa (Decisión Caminar vs Colectivo) ────────
    // Si la distancia total entre origen y destino es caminable (<= 1200 m),
    // se evalúa la caminata directa (ej: Parque Centenario a Hospital Durand).
    if (directDistance <= 1200) {
      const walkMin = calculateWalkMinutes(directDistance);
      const walkLeg: WalkingLeg = {
        type: "walk",
        from: origin,
        to: destination,
        distanceMeters: directDistance,
        durationMinutes: walkMin,
        description: `Caminar ${directDistance} m directo hasta ${destination.name}`,
        segmentCoordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
      };

      const walkStep: TripStep = {
        id: `step-direct-walk`,
        type: "walk",
        fromStopName: origin.name,
        toStopName: destination.name,
        distanceMeters: directDistance,
        durationMinutes: walkMin,
        description: `Caminar ${directDistance} m hasta tu destino (${walkMin} min)`,
      };

      const walkSegment: TripSegmentItem = {
        id: `seg-direct-walk`,
        type: "walk",
        color: "#0066FF",
        isDashed: true,
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
      };

      rawOptions.push({
        id: `direct-walk-${directDistance}`,
        title: "Directo a pie",
        totalDurationMinutes: walkMin,
        transfersCount: 0,
        walkDurationMinutes: walkMin,
        walkDistanceMeters: directDistance,
        transitDurationMinutes: 0,
        generalizedCost: walkMin * WALK_PERCEPTION_FACTOR,
        linesInvolved: [],
        legs: [walkLeg],
        steps: [walkStep],
        segments: [walkSegment],
        highlightLines: [],
        origin,
        destination,
        originCoords: { lat: origin.lat, lng: origin.lng },
        destinationCoords: { lat: destination.lat, lng: destination.lng },
        transferStopCoords: null,
        bounds: this.computeBounds([origin, destination]),
        usedStopIds: [],
      });
    }

    const originCandidates = this.findCandidateStops(origin);
    const destCandidates = this.findCandidateStops(destination);

    if (originCandidates.length > 0 && destCandidates.length > 0) {
      // Ronda 1: Recorridos Directos (0 combinaciones)
      const directTrips = this.findDirectTrips(origin, destination, originCandidates, destCandidates);
      rawOptions.push(...directTrips);

      // Ronda 2: Combinaciones (1 combinación)
      const transferTrips = this.findTransferTrips(origin, destination, originCandidates, destCandidates);
      rawOptions.push(...transferTrips);

      // P1-4, Ronda 3: Doble combinación (2 transbordos).
      // Solo si hay pocas opciones (evita explosión combinatoria en el
      // caso común). Con 56 paradas el costo es aceptable como fallback.
      if (rawOptions.length < 3) {
        const twoTransferTrips = this.findTwoTransferTrips(origin, destination, originCandidates, destCandidates);
        rawOptions.push(...twoTransferTrips);
      }
    }

    if (rawOptions.length === 0) {
      return [];
    }

    // Vincular steps con legs para tap-to-focus (los "arrive" no tienen leg).
    // Invariante: cada legs.push es inmediatamente seguido de su steps.push.
    for (const opt of rawOptions) {
      let li = 0;
      for (const step of opt.steps) {
        if (step.id.startsWith("step-arrive-")) continue;
        step.legIndex = li++;
      }
    }

    // P1-5: Pareto real sobre (transfers, duración, caminata).
    // 1) Dedup exacto (misma combinación líneas+paradas usadas).
    // 2) Filtro Pareto: solo no-dominadas.
    // 3) Orden lexicográfico (transfers, duración) y top-5.
    const deduplicated = this.deduplicateOptions(rawOptions);
    const pareto = this.paretoFilter(deduplicated);
    pareto.sort(
      (a, b) =>
        a.transfersCount - b.transfersCount ||
        a.totalDurationMinutes - b.totalDurationMinutes
    );

    return pareto.slice(0, 5);
  }

  /**
   * P1-5: Filtro de Pareto sobre (transfers, duración total, distancia a pie).
   * A domina a B si A es mejor-o-igual en los 3 criterios y estrictamente
   * mejor en al menos uno. Devuelve solo las no-dominadas.
   */
  private static paretoFilter(options: TripOption[]): TripOption[] {
    return options.filter((a) => {
      for (const b of options) {
        if (a === b) continue;
        const bBetterOrEqual =
          b.transfersCount <= a.transfersCount &&
          b.totalDurationMinutes <= a.totalDurationMinutes &&
          b.walkDistanceMeters <= a.walkDistanceMeters;
        const bStrictlyBetter =
          b.transfersCount < a.transfersCount ||
          b.totalDurationMinutes < a.totalDurationMinutes ||
          b.walkDistanceMeters < a.walkDistanceMeters;
        if (bBetterOrEqual && bStrictlyBetter) return false; // a dominada
      }
      return true;
    });
  }

  private static findDirectTrips(
    origin: LocationPoint,
    destination: LocationPoint,
    originCandidates: CandidateStop[],
    destCandidates: CandidateStop[]
  ): TripOption[] {
    const options: TripOption[] = [];

    for (const oCand of originCandidates) {
      for (const dCand of destCandidates) {
        if (oCand.stop.id === dCand.stop.id) continue;

        for (const linea of DATASET.lineas) {
          for (const ramal of linea.ramales) {
            for (const rec of ramal.recorridos) {
              const fromIndex = rec.paradas.indexOf(oCand.stop.id);
              const toIndex = rec.paradas.indexOf(dCand.stop.id);

              // P0-1: El orden de índices IMPLICA el sentido declarado.
              // rec.paradas está ordenado en dirección de rec.sentido por
              // construcción (ver ESTANDAR-LINEAS-RAMALES.md §2.2).
              // fromIndex < toIndex ⟺ viaje en dirección rec.sentido.
              // No inferir sentido por ID (frágil); usar rec.sentido.
              if (fromIndex !== -1 && toIndex !== -1 && fromIndex < toIndex) {
                const stopCount = toIndex - fromIndex;
                const intermediateStopIds = rec.paradas.slice(fromIndex, toIndex + 1);
                const intermediateStops = intermediateStopIds
                  .map((sId) => PARADAS_MOCK.find((p) => p.id === sId)!)
                  .filter(Boolean);

                const rideMinutes = Math.max(4, Math.round(stopCount * 2.4));
                const totalWalkMeters = oCand.distanceMeters + dCand.distanceMeters;
                const totalWalkMinutes = oCand.walkMinutes + dCand.walkMinutes;
                const totalDuration = totalWalkMinutes + rideMinutes;
                const generalizedCost =
                  totalWalkMinutes * WALK_PERCEPTION_FACTOR + rideMinutes;

                const lineChip: TripLineChip = {
                  id: linea.id,
                  numero: linea.numero,
                  color: linea.color,
                  textColor: linea.textColor,
                };

                const steps: TripStep[] = [];
                const legs: TripLeg[] = [];
                const segments: TripSegmentItem[] = [];

                // 1. Caminata de acceso
                if (oCand.distanceMeters > 25) {
                  const walkCoords: [number, number][] = [
                    [origin.lng, origin.lat],
                    [oCand.stop.lng, oCand.stop.lat],
                  ];
                  legs.push({
                    type: "walk",
                    from: origin,
                    to: {
                      name: oCand.stop.nombre,
                      lat: oCand.stop.lat,
                      lng: oCand.stop.lng,
                      stopId: oCand.stop.id,
                    },
                    distanceMeters: oCand.distanceMeters,
                    durationMinutes: oCand.walkMinutes,
                    description: `Caminar ${oCand.distanceMeters} m hasta ${oCand.stop.nombre}`,
                    segmentCoordinates: walkCoords,
                  });
                  steps.push({
                    id: `step-walk-o-${oCand.stop.id}`,
                    type: "walk",
                    fromStopName: origin.name,
                    toStopName: oCand.stop.nombre,
                    toStopId: oCand.stop.id,
                    distanceMeters: oCand.distanceMeters,
                    durationMinutes: oCand.walkMinutes,
                    description: `Caminar ${oCand.distanceMeters} m hasta ${oCand.stop.nombre}`,
                  });
                  segments.push({
                    id: `seg-walk-access-${oCand.stop.id}`,
                    type: "walk",
                    color: "#0066FF",
                    isDashed: true,
                    coordinates: walkCoords,
                  });
                }

                // 2. Tramo en colectivo (GEOMETRÍA RECORTADA)
                const rideGeometry = sliceRouteGeometry(rec.coordenadas, oCand.stop, dCand.stop);

                legs.push({
                  type: "ride",
                  lineaId: linea.id,
                  lineaNumero: linea.numero,
                  lineaColor: linea.color,
                  lineaTextColor: linea.textColor,
                  ramalId: ramal.id,
                  ramalCodigo: ramal.codigo,
                  ramalNombre: ramal.nombre,
                  recorridoId: rec.id,
                  sentido: rec.sentido,
                  fromStop: oCand.stop,
                  toStop: dCand.stop,
                  intermediateStops,
                  stopCount,
                  distanceKm: Math.round(rec.distanciaKm * (stopCount / rec.paradas.length) * 10) / 10,
                  durationMinutes: rideMinutes,
                  description: `Tomar Línea ${linea.numero} (${ramal.codigo}) en dirección a ${dCand.stop.nombre} (${stopCount} paradas)`,
                  segmentCoordinates: rideGeometry,
                });
                steps.push({
                  id: `step-ride-${linea.id}-${rec.id}`,
                  type: "ride",
                  lineaId: linea.id,
                  lineaNumero: linea.numero,
                  lineaColor: linea.color,
                  lineaTextColor: linea.textColor,
                  ramalCodigo: ramal.codigo,
                  ramalNombre: ramal.nombre,
                  fromStopId: oCand.stop.id,
                  fromStopName: oCand.stop.nombre,
                  toStopId: dCand.stop.id,
                  toStopName: dCand.stop.nombre,
                  stopCount,
                  durationMinutes: rideMinutes,
                  description: `Tomar Línea ${linea.numero} (Ramal ${ramal.codigo}) hasta ${dCand.stop.nombre} (${stopCount} paradas)`,
                });
                segments.push({
                  id: `seg-ride-${linea.id}-${rec.id}`,
                  type: "ride",
                  color: linea.color,
                  isDashed: false,
                  coordinates: rideGeometry,
                });

                // 3. Caminata de egreso
                if (dCand.distanceMeters > 25) {
                  const egressCoords: [number, number][] = [
                    [dCand.stop.lng, dCand.stop.lat],
                    [destination.lng, destination.lat],
                  ];
                  legs.push({
                    type: "walk",
                    from: {
                      name: dCand.stop.nombre,
                      lat: dCand.stop.lat,
                      lng: dCand.stop.lng,
                      stopId: dCand.stop.id,
                    },
                    to: destination,
                    distanceMeters: dCand.distanceMeters,
                    durationMinutes: dCand.walkMinutes,
                    description: `Bajar en ${dCand.stop.nombre} y caminar ${dCand.distanceMeters} m hasta tu destino`,
                    segmentCoordinates: egressCoords,
                  });
                  steps.push({
                    id: `step-walk-d-${dCand.stop.id}`,
                    type: "walk",
                    fromStopId: dCand.stop.id,
                    fromStopName: dCand.stop.nombre,
                    toStopName: destination.name,
                    distanceMeters: dCand.distanceMeters,
                    durationMinutes: dCand.walkMinutes,
                    description: `Bajar en ${dCand.stop.nombre} y caminar ${dCand.distanceMeters} m al destino final`,
                  });
                  segments.push({
                    id: `seg-walk-egress-${dCand.stop.id}`,
                    type: "walk",
                    color: "#0066FF",
                    isDashed: true,
                    coordinates: egressCoords,
                  });
                } else {
                  steps.push({
                    id: `step-arrive-${dCand.stop.id}`,
                    type: "walk",
                    fromStopId: dCand.stop.id,
                    fromStopName: dCand.stop.nombre,
                    toStopName: destination.name,
                    durationMinutes: 1,
                    description: `Bajar en ${dCand.stop.nombre} (destino)`,
                  });
                }

                const bounds = this.computeBounds([
                  origin,
                  destination,
                  oCand.stop,
                  dCand.stop,
                ]);

                options.push({
                  id: `direct-${linea.numero}-${rec.id}-${oCand.stop.id}-${dCand.stop.id}`,
                  title: `Directo · Línea ${linea.numero} (${ramal.codigo})`,
                  totalDurationMinutes: totalDuration,
                  transfersCount: 0,
                  walkDurationMinutes: totalWalkMinutes,
                  walkDistanceMeters: totalWalkMeters,
                  transitDurationMinutes: rideMinutes,
                  generalizedCost,
                  linesInvolved: [lineChip],
                  legs,
                  steps,
                  segments,
                  highlightLines: [linea.id, rec.id],
                  origin,
                  destination,
                  originStopId: oCand.stop.id,
                  destinationStopId: dCand.stop.id,
                  originCoords: { lat: origin.lat, lng: origin.lng },
                  destinationCoords: { lat: destination.lat, lng: destination.lng },
                  transferStopCoords: null,
                  bounds,
                  usedStopIds: [oCand.stop.id, dCand.stop.id],
                });
              }
            }
          }
        }
      }
    }

    return options;
  }

  private static findTransferTrips(
    origin: LocationPoint,
    destination: LocationPoint,
    originCandidates: CandidateStop[],
    destCandidates: CandidateStop[]
  ): TripOption[] {
    const options: TripOption[] = [];

    for (const oCand of originCandidates) {
      for (const dCand of destCandidates) {
        if (oCand.stop.id === dCand.stop.id) continue;

        // Línea 1
        for (const linea1 of DATASET.lineas) {
          for (const ramal1 of linea1.ramales) {
            for (const rec1 of ramal1.recorridos) {
              const idxO = rec1.paradas.indexOf(oCand.stop.id);
              if (idxO === -1) continue;

              for (let k = idxO + 1; k < rec1.paradas.length; k++) {
                const tStopId1 = rec1.paradas[k];
                const tStop1 = PARADAS_MOCK.find((p) => p.id === tStopId1);
                if (!tStop1) continue;

                // Línea 2
                // P0-2: NO bloquear por línea. Dos ramales distintos de la
                // misma línea SÍ son combinables (ej: 194-A → 194-D).
                // Solo se bloquea el mismo recorrido exacto (redundante).
                for (const linea2 of DATASET.lineas) {
                  for (const ramal2 of linea2.ramales) {
                    for (const rec2 of ramal2.recorridos) {
                      if (rec2.id === rec1.id) continue;
                      const idxD = rec2.paradas.indexOf(dCand.stop.id);
                      if (idxD === -1) continue;

                      for (let m = 0; m < idxD; m++) {
                        const tStopId2 = rec2.paradas[m];
                        const tStop2 = PARADAS_MOCK.find((p) => p.id === tStopId2);
                        if (!tStop2) continue;

                        const transferDist = getCachedStopDistance(tStop1, tStop2);

                        if (transferDist <= MAX_TRANSFER_WALK_METERS) {
                          const stopCount1 = k - idxO;
                          const stopCount2 = idxD - m;
                          const ride1Min = Math.max(3, Math.round(stopCount1 * 2.3));
                          const ride2Min = Math.max(3, Math.round(stopCount2 * 2.3));
                          const transferWalkMin = calculateWalkMinutes(transferDist);

                          const totalWalkMeters =
                            oCand.distanceMeters + transferDist + dCand.distanceMeters;
                          const totalWalkMinutes =
                            oCand.walkMinutes + transferWalkMin + dCand.walkMinutes;
                          const totalDuration =
                            totalWalkMinutes +
                            ride1Min +
                            ride2Min +
                            TRANSFER_WAIT_MINUTES;

                          const generalizedCost =
                            totalWalkMinutes * WALK_PERCEPTION_FACTOR +
                            ride1Min +
                            ride2Min +
                            TRANSFER_WAIT_MINUTES +
                            TRANSFER_PENALTY_MINUTES;

                          const linesInvolved: TripLineChip[] = [
                            {
                              id: linea1.id,
                              numero: linea1.numero,
                              color: linea1.color,
                              textColor: linea1.textColor,
                            },
                            {
                              id: linea2.id,
                              numero: linea2.numero,
                              color: linea2.color,
                              textColor: linea2.textColor,
                            },
                          ];

                          const steps: TripStep[] = [];
                          const legs: TripLeg[] = [];
                          const segments: TripSegmentItem[] = [];

                          // 1. Caminata inicial
                          if (oCand.distanceMeters > 25) {
                            const walkCoords: [number, number][] = [
                              [origin.lng, origin.lat],
                              [oCand.stop.lng, oCand.stop.lat],
                            ];
                            legs.push({
                              type: "walk",
                              from: origin,
                              to: {
                                name: oCand.stop.nombre,
                                lat: oCand.stop.lat,
                                lng: oCand.stop.lng,
                                stopId: oCand.stop.id,
                              },
                              distanceMeters: oCand.distanceMeters,
                              durationMinutes: oCand.walkMinutes,
                              description: `Caminar ${oCand.distanceMeters} m hasta ${oCand.stop.nombre}`,
                              segmentCoordinates: walkCoords,
                            });
                            steps.push({
                              id: `step-walk-o-${oCand.stop.id}`,
                              type: "walk",
                              fromStopName: origin.name,
                              toStopName: oCand.stop.nombre,
                              toStopId: oCand.stop.id,
                              distanceMeters: oCand.distanceMeters,
                              durationMinutes: oCand.walkMinutes,
                              description: `Caminar ${oCand.distanceMeters} m hasta ${oCand.stop.nombre}`,
                            });
                            segments.push({
                              id: `seg-walk-access-${oCand.stop.id}`,
                              type: "walk",
                              color: "#0066FF",
                              isDashed: true,
                              coordinates: walkCoords,
                            });
                          }

                          // 2. Colectivo Línea 1 (GEOMETRÍA RECORTADA)
                          const intermediateStops1 = rec1.paradas
                            .slice(idxO, k + 1)
                            .map((id) => PARADAS_MOCK.find((p) => p.id === id)!)
                            .filter(Boolean);

                          const rideGeometry1 = sliceRouteGeometry(rec1.coordenadas, oCand.stop, tStop1);

                          legs.push({
                            type: "ride",
                            lineaId: linea1.id,
                            lineaNumero: linea1.numero,
                            lineaColor: linea1.color,
                            lineaTextColor: linea1.textColor,
                            ramalId: ramal1.id,
                            ramalCodigo: ramal1.codigo,
                            ramalNombre: ramal1.nombre,
                            recorridoId: rec1.id,
                            sentido: rec1.sentido,
                            fromStop: oCand.stop,
                            toStop: tStop1,
                            intermediateStops: intermediateStops1,
                            stopCount: stopCount1,
                            distanceKm: 0,
                            durationMinutes: ride1Min,
                            description: `Tomar Línea ${linea1.numero} hasta ${tStop1.nombre}`,
                            segmentCoordinates: rideGeometry1,
                          });
                          steps.push({
                            id: `step-ride-1-${linea1.id}`,
                            type: "ride",
                            lineaId: linea1.id,
                            lineaNumero: linea1.numero,
                            lineaColor: linea1.color,
                            lineaTextColor: linea1.textColor,
                            ramalCodigo: ramal1.codigo,
                            ramalNombre: ramal1.nombre,
                            fromStopId: oCand.stop.id,
                            fromStopName: oCand.stop.nombre,
                            toStopId: tStop1.id,
                            toStopName: tStop1.nombre,
                            stopCount: stopCount1,
                            durationMinutes: ride1Min,
                            description: `Tomar Línea ${linea1.numero} (${ramal1.codigo}) hasta ${tStop1.nombre} (${stopCount1} paradas)`,
                          });
                          segments.push({
                            id: `seg-ride-1-${linea1.id}`,
                            type: "ride",
                            color: linea1.color,
                            isDashed: false,
                            coordinates: rideGeometry1,
                          });

                          // 3. Transbordo (a pie si las paradas son distintas)
                          const transferDesc =
                            tStopId1 === tStopId2
                              ? `Bajar en ${tStop1.nombre} y combinar con Línea ${linea2.numero}`
                              : `Bajar en ${tStop1.nombre}, caminar ${transferDist} m a ${tStop2.nombre} y combinar con Línea ${linea2.numero}`;

                          const transferCoords: [number, number][] = [
                            [tStop1.lng, tStop1.lat],
                            [tStop2.lng, tStop2.lat],
                          ];

                          legs.push({
                            type: "transfer",
                            fromStop: tStop1,
                            toStop: tStop2,
                            walkingDistanceMeters: transferDist,
                            durationMinutes: transferWalkMin + TRANSFER_WAIT_MINUTES,
                            description: transferDesc,
                            segmentCoordinates: transferCoords,
                          });
                          steps.push({
                            id: `step-trans-${tStop1.id}-${tStop2.id}`,
                            type: "transfer",
                            fromStopId: tStop1.id,
                            fromStopName: tStop1.nombre,
                            toStopId: tStop2.id,
                            toStopName: tStop2.nombre,
                            distanceMeters: transferDist,
                            durationMinutes: transferWalkMin + TRANSFER_WAIT_MINUTES,
                            description: transferDesc,
                          });
                          if (transferDist > 15) {
                            segments.push({
                              id: `seg-trans-${tStop1.id}-${tStop2.id}`,
                              type: "transfer",
                              color: "#EA580C",
                              isDashed: true,
                              coordinates: transferCoords,
                            });
                          }

                          // 4. Colectivo Línea 2 (GEOMETRÍA RECORTADA)
                          const intermediateStops2 = rec2.paradas
                            .slice(m, idxD + 1)
                            .map((id) => PARADAS_MOCK.find((p) => p.id === id)!)
                            .filter(Boolean);

                          const rideGeometry2 = sliceRouteGeometry(rec2.coordenadas, tStop2, dCand.stop);

                          legs.push({
                            type: "ride",
                            lineaId: linea2.id,
                            lineaNumero: linea2.numero,
                            lineaColor: linea2.color,
                            lineaTextColor: linea2.textColor,
                            ramalId: ramal2.id,
                            ramalCodigo: ramal2.codigo,
                            ramalNombre: ramal2.nombre,
                            recorridoId: rec2.id,
                            sentido: rec2.sentido,
                            fromStop: tStop2,
                            toStop: dCand.stop,
                            intermediateStops: intermediateStops2,
                            stopCount: stopCount2,
                            distanceKm: 0,
                            durationMinutes: ride2Min,
                            description: `Tomar Línea ${linea2.numero} hasta ${dCand.stop.nombre}`,
                            segmentCoordinates: rideGeometry2,
                          });
                          steps.push({
                            id: `step-ride-2-${linea2.id}`,
                            type: "ride",
                            lineaId: linea2.id,
                            lineaNumero: linea2.numero,
                            lineaColor: linea2.color,
                            lineaTextColor: linea2.textColor,
                            ramalCodigo: ramal2.codigo,
                            ramalNombre: ramal2.nombre,
                            fromStopId: tStop2.id,
                            fromStopName: tStop2.nombre,
                            toStopId: dCand.stop.id,
                            toStopName: dCand.stop.nombre,
                            stopCount: stopCount2,
                            durationMinutes: ride2Min,
                            description: `Tomar Línea ${linea2.numero} (${ramal2.codigo}) hasta ${dCand.stop.nombre} (${stopCount2} paradas)`,
                          });
                          segments.push({
                            id: `seg-ride-2-${linea2.id}`,
                            type: "ride",
                            color: linea2.color,
                            isDashed: false,
                            coordinates: rideGeometry2,
                          });

                          // 5. Caminata final
                          if (dCand.distanceMeters > 25) {
                            const egressCoords: [number, number][] = [
                              [dCand.stop.lng, dCand.stop.lat],
                              [destination.lng, destination.lat],
                            ];
                            legs.push({
                              type: "walk",
                              from: {
                                name: dCand.stop.nombre,
                                lat: dCand.stop.lat,
                                lng: dCand.stop.lng,
                                stopId: dCand.stop.id,
                              },
                              to: destination,
                              distanceMeters: dCand.distanceMeters,
                              durationMinutes: dCand.walkMinutes,
                              description: `Bajar en ${dCand.stop.nombre} y caminar ${dCand.distanceMeters} m hasta tu destino`,
                              segmentCoordinates: egressCoords,
                            });
                            steps.push({
                              id: `step-walk-d-${dCand.stop.id}`,
                              type: "walk",
                              fromStopId: dCand.stop.id,
                              fromStopName: dCand.stop.nombre,
                              toStopName: destination.name,
                              distanceMeters: dCand.distanceMeters,
                              durationMinutes: dCand.walkMinutes,
                              description: `Bajar en ${dCand.stop.nombre} y caminar ${dCand.distanceMeters} m al destino final`,
                            });
                            segments.push({
                              id: `seg-walk-egress-${dCand.stop.id}`,
                              type: "walk",
                              color: "#0066FF",
                              isDashed: true,
                              coordinates: egressCoords,
                            });
                          } else {
                            steps.push({
                              id: `step-arrive-${dCand.stop.id}`,
                              type: "walk",
                              fromStopId: dCand.stop.id,
                              fromStopName: dCand.stop.nombre,
                              toStopName: destination.name,
                              durationMinutes: 1,
                              description: `Bajar en ${dCand.stop.nombre} (destino)`,
                            });
                          }

                          const bounds = this.computeBounds([
                            origin,
                            destination,
                            oCand.stop,
                            tStop1,
                            tStop2,
                            dCand.stop,
                          ]);

                          options.push({
                            id: `transfer-${linea1.numero}-${linea2.numero}-${oCand.stop.id}-${dCand.stop.id}-${tStop1.id}-${rec1.id}-${rec2.id}`,
                            title: `Combinación · ${linea1.numero} (${ramal1.codigo}) ➔ ${linea2.numero} (${ramal2.codigo}) (en ${tStop1.nombre})`,
                            totalDurationMinutes: totalDuration,
                            transfersCount: 1,
                            walkDurationMinutes: totalWalkMinutes,
                            walkDistanceMeters: totalWalkMeters,
                            transitDurationMinutes: ride1Min + ride2Min,
                            generalizedCost,
                            linesInvolved,
                            legs,
                            steps,
                            segments,
                            highlightLines: [linea1.id, linea2.id, rec1.id, rec2.id],
                            origin,
                            destination,
                            originStopId: oCand.stop.id,
                            destinationStopId: dCand.stop.id,
                            originCoords: { lat: origin.lat, lng: origin.lng },
                            destinationCoords: { lat: destination.lat, lng: destination.lng },
                            transferStopCoords: {
                              lat: tStop1.lat,
                              lng: tStop1.lng,
                              color: linea2.color,
                            },
                            bounds,
                          usedStopIds: [oCand.stop.id, tStop1.id, tStop2.id, dCand.stop.id],
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return options;
  }

  /**
   * P1-4: Doble combinación (2 transbordos).
   * A → L1 → T1 → L2 → T2 → L3 → B.
   * Solo corre como fallback (cuando 0+1 transfers dan <3 opciones).
   * Permite intra-línea (distinto recorrido) igual que findTransferTrips.
   */
  private static findTwoTransferTrips(
    origin: LocationPoint,
    destination: LocationPoint,
    originCandidates: CandidateStop[],
    destCandidates: CandidateStop[]
  ): TripOption[] {
    const options: TripOption[] = [];

    for (const oCand of originCandidates) {
      for (const dCand of destCandidates) {
        if (oCand.stop.id === dCand.stop.id) continue;

        for (const linea1 of DATASET.lineas) {
          for (const ramal1 of linea1.ramales) {
            for (const rec1 of ramal1.recorridos) {
              const idxO = rec1.paradas.indexOf(oCand.stop.id);
              if (idxO === -1) continue;

              for (let k = idxO + 1; k < rec1.paradas.length; k++) {
                const tAId = rec1.paradas[k];
                const tA = PARADAS_MOCK.find((p) => p.id === tAId);
                if (!tA) continue;

                for (const linea2 of DATASET.lineas) {
                  for (const ramal2 of linea2.ramales) {
                    for (const rec2 of ramal2.recorridos) {
                      if (rec2.id === rec1.id) continue;
                      const idxT1 = rec2.paradas.indexOf(tAId);
                      // Transfer 1: misma parada o cercana (≤850m)
                      // Buscar punto de abordaje en rec2 cercano a tA
                      let board2Idx = idxT1;
                      let board2Stop = idxT1 !== -1 ? tA : null;
                      if (idxT1 === -1) {
                        // tA no está en rec2: buscar parada cercana en rec2
                        let bestD = Infinity;
                        for (let b = 0; b < rec2.paradas.length; b++) {
                          const bs = PARADAS_MOCK.find((p) => p.id === rec2.paradas[b]);
                          if (!bs) continue;
                          const d = getCachedStopDistance(tA, bs);
                          if (d < bestD && d <= MAX_TRANSFER_WALK_METERS) {
                            bestD = d;
                            board2Idx = b;
                            board2Stop = bs;
                          }
                        }
                        if (!board2Stop) continue;
                      }

                      for (let m = board2Idx + 1; m < rec2.paradas.length; m++) {
                        const tCId = rec2.paradas[m];
                        const tC = PARADAS_MOCK.find((p) => p.id === tCId);
                        if (!tC) continue;

                        for (const linea3 of DATASET.lineas) {
                          for (const ramal3 of linea3.ramales) {
                            for (const rec3 of ramal3.recorridos) {
                              if (rec3.id === rec2.id || rec3.id === rec1.id) continue;
                              const idxD = rec3.paradas.indexOf(dCand.stop.id);
                              if (idxD === -1) continue;
                              // Transfer 2: buscar abordaje en rec3 cercano a tC
                              let board3Idx = rec3.paradas.indexOf(tCId);
                              let board3Stop: Parada | null = board3Idx !== -1 ? tC : null;
                              if (board3Idx === -1) {
                                let bestD = Infinity;
                                for (let b = 0; b < idxD; b++) {
                                  const bs = PARADAS_MOCK.find((p) => p.id === rec3.paradas[b]);
                                  if (!bs) continue;
                                  const d = getCachedStopDistance(tC, bs);
                                  if (d < bestD && d <= MAX_TRANSFER_WALK_METERS) {
                                    bestD = d;
                                    board3Idx = b;
                                    board3Stop = bs;
                                  }
                                }
                                if (!board3Stop) continue;
                              }
                              if (board3Idx >= idxD) continue;
                              if (!board2Stop || !board3Stop) continue;

                              const t1Dist = board2Stop.id === tA.id ? 0 : getCachedStopDistance(tA, board2Stop);
                              const t2Dist = board3Stop.id === tC.id ? 0 : getCachedStopDistance(tC, board3Stop);
                              if (t1Dist > MAX_TRANSFER_WALK_METERS || t2Dist > MAX_TRANSFER_WALK_METERS) continue;

                              // Costos
                              const s1 = k - idxO;
                              const s2 = m - board2Idx;
                              const s3 = idxD - board3Idx;
                              const r1 = Math.max(3, Math.round(s1 * 2.3));
                              const r2 = Math.max(3, Math.round(s2 * 2.3));
                              const r3 = Math.max(3, Math.round(s3 * 2.3));
                              const t1Walk = calculateWalkMinutes(t1Dist);
                              const t2Walk = calculateWalkMinutes(t2Dist);
                              const totalWalkM = oCand.distanceMeters + t1Dist + t2Dist + dCand.distanceMeters;
                              const totalWalkMin = oCand.walkMinutes + t1Walk + t2Walk + dCand.walkMinutes;
                              const totalDur = totalWalkMin + r1 + r2 + r3 + TRANSFER_WAIT_MINUTES * 2;
                              const gCost =
                                totalWalkMin * WALK_PERCEPTION_FACTOR + r1 + r2 + r3 +
                                TRANSFER_WAIT_MINUTES * 2 + TRANSFER_PENALTY_MINUTES * 2;

                              const g1 = sliceRouteGeometry(rec1.coordenadas, oCand.stop, tA);
                              const g2 = sliceRouteGeometry(rec2.coordenadas, board2Stop, tC);
                              const g3 = sliceRouteGeometry(rec3.coordenadas, board3Stop, dCand.stop);

                              const legs: TripLeg[] = [];
                              const steps: TripStep[] = [];
                              const segments: TripSegmentItem[] = [];

                              if (oCand.distanceMeters > 25) {
                                legs.push({ type: "walk", from: origin, to: { name: oCand.stop.nombre, lat: oCand.stop.lat, lng: oCand.stop.lng, stopId: oCand.stop.id }, distanceMeters: oCand.distanceMeters, durationMinutes: oCand.walkMinutes, description: `Caminar ${oCand.distanceMeters} m hasta ${oCand.stop.nombre}`, segmentCoordinates: [[origin.lng, origin.lat], [oCand.stop.lng, oCand.stop.lat]] });
                                steps.push({ id: `step-walk-o-${oCand.stop.id}`, type: "walk", fromStopName: origin.name, toStopName: oCand.stop.nombre, toStopId: oCand.stop.id, distanceMeters: oCand.distanceMeters, durationMinutes: oCand.walkMinutes, description: `Caminar ${oCand.distanceMeters} m hasta ${oCand.stop.nombre}` });
                              }
                              legs.push({ type: "ride", lineaId: linea1.id, lineaNumero: linea1.numero, lineaColor: linea1.color, lineaTextColor: linea1.textColor, ramalId: ramal1.id, ramalCodigo: ramal1.codigo, ramalNombre: ramal1.nombre, recorridoId: rec1.id, sentido: rec1.sentido, fromStop: oCand.stop, toStop: tA, intermediateStops: [], stopCount: s1, distanceKm: 0, durationMinutes: r1, description: `Tomar Línea ${linea1.numero} (${ramal1.codigo}) hasta ${tA.nombre}`, segmentCoordinates: g1 });
                              steps.push({ id: `step-ride-1-${linea1.id}`, type: "ride", lineaId: linea1.id, lineaNumero: linea1.numero, lineaColor: linea1.color, lineaTextColor: linea1.textColor, ramalCodigo: ramal1.codigo, ramalNombre: ramal1.nombre, fromStopId: oCand.stop.id, fromStopName: oCand.stop.nombre, toStopId: tA.id, toStopName: tA.nombre, stopCount: s1, durationMinutes: r1, description: `Tomar Línea ${linea1.numero} (${ramal1.codigo}) hasta ${tA.nombre} (${s1} paradas)` });
                              segments.push({ id: `seg-ride-1-${linea1.id}`, type: "ride", color: linea1.color, isDashed: false, coordinates: g1 });

                              legs.push({ type: "transfer", fromStop: tA, toStop: board2Stop, walkingDistanceMeters: t1Dist, durationMinutes: t1Walk + TRANSFER_WAIT_MINUTES, description: tA.id === board2Stop.id ? `Combinar con Línea ${linea2.numero} en ${tA.nombre}` : `Caminar ${t1Dist} m a ${board2Stop.nombre} y combinar con Línea ${linea2.numero}`, segmentCoordinates: [[tA.lng, tA.lat], [board2Stop.lng, board2Stop.lat]] });
                              steps.push({ id: `step-t1-${tA.id}`, type: "transfer", fromStopId: tA.id, fromStopName: tA.nombre, toStopId: board2Stop.id, toStopName: board2Stop.nombre, distanceMeters: t1Dist, durationMinutes: t1Walk + TRANSFER_WAIT_MINUTES, description: `Transbordo a Línea ${linea2.numero}` });

                              legs.push({ type: "ride", lineaId: linea2.id, lineaNumero: linea2.numero, lineaColor: linea2.color, lineaTextColor: linea2.textColor, ramalId: ramal2.id, ramalCodigo: ramal2.codigo, ramalNombre: ramal2.nombre, recorridoId: rec2.id, sentido: rec2.sentido, fromStop: board2Stop, toStop: tC, intermediateStops: [], stopCount: s2, distanceKm: 0, durationMinutes: r2, description: `Tomar Línea ${linea2.numero} (${ramal2.codigo}) hasta ${tC.nombre}`, segmentCoordinates: g2 });
                              steps.push({ id: `step-ride-2-${linea2.id}`, type: "ride", lineaId: linea2.id, lineaNumero: linea2.numero, lineaColor: linea2.color, lineaTextColor: linea2.textColor, ramalCodigo: ramal2.codigo, ramalNombre: ramal2.nombre, fromStopId: board2Stop.id, fromStopName: board2Stop.nombre, toStopId: tC.id, toStopName: tC.nombre, stopCount: s2, durationMinutes: r2, description: `Tomar Línea ${linea2.numero} (${ramal2.codigo}) hasta ${tC.nombre} (${s2} paradas)` });
                              segments.push({ id: `seg-ride-2-${linea2.id}`, type: "ride", color: linea2.color, isDashed: false, coordinates: g2 });

                              legs.push({ type: "transfer", fromStop: tC, toStop: board3Stop, walkingDistanceMeters: t2Dist, durationMinutes: t2Walk + TRANSFER_WAIT_MINUTES, description: tC.id === board3Stop.id ? `Combinar con Línea ${linea3.numero} en ${tC.nombre}` : `Caminar ${t2Dist} m a ${board3Stop.nombre} y combinar con Línea ${linea3.numero}`, segmentCoordinates: [[tC.lng, tC.lat], [board3Stop.lng, board3Stop.lat]] });
                              steps.push({ id: `step-t2-${tC.id}`, type: "transfer", fromStopId: tC.id, fromStopName: tC.nombre, toStopId: board3Stop.id, toStopName: board3Stop.nombre, distanceMeters: t2Dist, durationMinutes: t2Walk + TRANSFER_WAIT_MINUTES, description: `Transbordo a Línea ${linea3.numero}` });

                              legs.push({ type: "ride", lineaId: linea3.id, lineaNumero: linea3.numero, lineaColor: linea3.color, lineaTextColor: linea3.textColor, ramalId: ramal3.id, ramalCodigo: ramal3.codigo, ramalNombre: ramal3.nombre, recorridoId: rec3.id, sentido: rec3.sentido, fromStop: board3Stop, toStop: dCand.stop, intermediateStops: [], stopCount: s3, distanceKm: 0, durationMinutes: r3, description: `Tomar Línea ${linea3.numero} (${ramal3.codigo}) hasta ${dCand.stop.nombre}`, segmentCoordinates: g3 });
                              steps.push({ id: `step-ride-3-${linea3.id}`, type: "ride", lineaId: linea3.id, lineaNumero: linea3.numero, lineaColor: linea3.color, lineaTextColor: linea3.textColor, ramalCodigo: ramal3.codigo, ramalNombre: ramal3.nombre, fromStopId: board3Stop.id, fromStopName: board3Stop.nombre, toStopId: dCand.stop.id, toStopName: dCand.stop.nombre, stopCount: s3, durationMinutes: r3, description: `Tomar Línea ${linea3.numero} (${ramal3.codigo}) hasta ${dCand.stop.nombre} (${s3} paradas)` });
                              segments.push({ id: `seg-ride-3-${linea3.id}`, type: "ride", color: linea3.color, isDashed: false, coordinates: g3 });

                              if (dCand.distanceMeters > 25) {
                                legs.push({ type: "walk", from: { name: dCand.stop.nombre, lat: dCand.stop.lat, lng: dCand.stop.lng, stopId: dCand.stop.id }, to: destination, distanceMeters: dCand.distanceMeters, durationMinutes: dCand.walkMinutes, description: `Caminar ${dCand.distanceMeters} m al destino`, segmentCoordinates: [[dCand.stop.lng, dCand.stop.lat], [destination.lng, destination.lat]] });
                                steps.push({ id: `step-walk-d-${dCand.stop.id}`, type: "walk", fromStopId: dCand.stop.id, fromStopName: dCand.stop.nombre, toStopName: destination.name, distanceMeters: dCand.distanceMeters, durationMinutes: dCand.walkMinutes, description: `Caminar ${dCand.distanceMeters} m al destino` });
                              }

                              options.push({
                                id: `transfer2-${linea1.numero}-${linea2.numero}-${linea3.numero}-${oCand.stop.id}-${dCand.stop.id}-${tA.id}-${tC.id}-${rec1.id}-${rec2.id}-${rec3.id}`,
                                title: `Combinación · ${linea1.numero} (${ramal1.codigo}) ➔ ${linea2.numero} (${ramal2.codigo}) ➔ ${linea3.numero} (${ramal3.codigo})`,
                                totalDurationMinutes: totalDur,
                                transfersCount: 2,
                                walkDurationMinutes: totalWalkMin,
                                walkDistanceMeters: totalWalkM,
                                transitDurationMinutes: r1 + r2 + r3,
                                generalizedCost: gCost,
                                linesInvolved: [
                                  { id: linea1.id, numero: linea1.numero, color: linea1.color, textColor: linea1.textColor },
                                  { id: linea2.id, numero: linea2.numero, color: linea2.color, textColor: linea2.textColor },
                                  { id: linea3.id, numero: linea3.numero, color: linea3.color, textColor: linea3.textColor },
                                ],
                                legs, steps, segments,
                                highlightLines: [linea1.id, linea2.id, linea3.id, rec1.id, rec2.id, rec3.id],
                                origin, destination,
                                originStopId: oCand.stop.id,
                                destinationStopId: dCand.stop.id,
                                originCoords: { lat: origin.lat, lng: origin.lng },
                                destinationCoords: { lat: destination.lat, lng: destination.lng },
                                transferStopCoords: { lat: tA.lat, lng: tA.lng, color: linea2.color },
                                bounds: this.computeBounds([origin, destination, oCand.stop, tA, tC, dCand.stop]),
                                usedStopIds: [oCand.stop.id, tA.id, board2Stop.id, tC.id, board3Stop.id, dCand.stop.id],
                              });
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return options;
  }

  private static deduplicateOptions(options: TripOption[]): TripOption[] {
    const seen = new Map<string, TripOption>();

    for (const opt of options) {
      // P1-5: Clave por líneas + paradas usadas (incluye punto de transbordo).
      // Dos "65 → 194" con distinto transbordo NO son duplicadas; el filtro
      // Pareto decide cuál sobrevive. Solo colapsa idénticas exactas.
      const linesKey = opt.linesInvolved.map((l) => l.numero).join("-") || "walk-only";
      const stopsKey = [...opt.usedStopIds].sort().join(",");
      const key = `${opt.transfersCount}-${linesKey}-${stopsKey}`;

      const existing = seen.get(key);
      if (!existing || opt.generalizedCost < existing.generalizedCost) {
        seen.set(key, opt);
      }
    }

    return Array.from(seen.values());
  }

  private static computeBounds(
    points: Array<{ lat: number; lng: number }>
  ): [[number, number], [number, number]] {
    if (points.length === 0) {
      return [
        [-58.55, -34.65],
        [-58.35, -34.55],
      ];
    }

    let minLng = points[0].lng;
    let maxLng = points[0].lng;
    let minLat = points[0].lat;
    let maxLat = points[0].lat;

    for (const p of points) {
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
    }

    const spanLng = Math.max(maxLng - minLng, 0.012);
    const spanLat = Math.max(maxLat - minLat, 0.012);

    return [
      [minLng - spanLng * 0.15, minLat - spanLat * 0.15],
      [maxLng + spanLng * 0.15, maxLat + spanLat * 0.15],
    ];
  }
}
