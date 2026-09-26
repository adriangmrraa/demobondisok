/**
 * Motor de GPS Simulado — La Nueva Metropol
 *
 * Simulación de alta fidelidad para Línea 65 (La Nueva Metropol S.A.):
 * - 24 unidades activas reales simultáneas navegando sobre la traza oficial de 36.06 km.
 * - Frecuencia real en hora pico: 5 minutos entre unidades (Ley de Little calibrada).
 * - Curva cinemática de frenado progresivo: desaceleración en los 45 metros previos a cada parada.
 * - Dwell Time estricto: detención obligatoria de 20 segundos a 0 km/h para ascenso/descenso.
 * - Aceleración progresiva de salida en los primeros 25 metros.
 * - Emisión GTFS-RT a 1 Hz; suavizado visual a 60fps con dead-reckoning en el cliente.
 */

import type { VehiclePosition, Unsubscribe } from '@/lib/data-service';
import { MOCK_ROUTES, MOCK_UNITS, MOCK_STOPS, MOCK_LINE_STOPS } from './data';

// ─── Configuración Cinemática y Operativa ───────────────────

const TICK_INTERVAL_MS = 1000;
export const DWELL_TIME_SECONDS = 20; // 20s fijos en cada parada (regla de negocio estricta)
export const SCHEDULED_CYCLE_SECONDS = 7200; // 120 min (2 horas) para el circuito completo oficial
const BRAKING_DISTANCE_M = 45; // Zona de desaceleración progresiva
const ACCEL_DISTANCE_M = 25; // Zona de aceleración progresiva de salida
const MIN_STOP_APPROACH_SPEED_KMH = 3.5;
const INITIAL_DEPARTURE_SPEED_KMH = 6.0;
const HEADING_AHEAD_M = 15;

// ─── Utilidades geográficas ────────────────────────────────

function distanceMeters(a: [number, number], b: [number, number]): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = (lat2 - lat1) * 111320;
  const dLng = (lng2 - lng1) * 111320 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** Rumbo (0-360°, 0=norte) de un punto hacia otro */
function bearingDeg(from: [number, number], to: [number, number]): number {
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const dLng = lng2 - lng1;
  const dLat = lat2 - lat1;
  return ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ─── Precálculo de rutas ───────────────────────────────────

interface RouteCache {
  points: [number, number][];
  cumLength: number[];
  totalLength: number;
}

function buildRouteCache(route: [number, number][]): RouteCache {
  const cumLength: number[] = [0];
  let total = 0;

  for (let i = 0; i < route.length - 1; i++) {
    total += distanceMeters(route[i]!, route[i + 1]!);
    cumLength.push(total);
  }

  // Si la ruta es un circuito cerrado (como la Línea 65), conectar el último con el primero
  const lastPoint = route[route.length - 1];
  const firstPoint = route[0];
  if (lastPoint && firstPoint) {
    const closingDist = distanceMeters(lastPoint, firstPoint);
    if (closingDist > 0 && closingDist < 200) {
      total += closingDist;
      cumLength.push(total);
    }
  }

  return { points: route, cumLength, totalLength: total };
}

function positionAtDistance(
  cache: RouteCache,
  dist: number,
): { lng: number; lat: number } {
  const { points, cumLength, totalLength } = cache;
  if (totalLength <= 0 || points.length === 0) {
    return { lng: -58.4250, lat: -34.5950 };
  }
  const d = ((dist % totalLength) + totalLength) % totalLength;

  let segIdx = 0;
  for (let i = 0; i < cumLength.length - 1; i++) {
    if (d >= cumLength[i]! && d < cumLength[i + 1]!) {
      segIdx = i;
      break;
    }
  }

  const segStart = cumLength[segIdx] ?? 0;
  const segEnd = cumLength[segIdx + 1] ?? segStart;
  const segLen = segEnd - segStart;
  const t = segLen > 0 ? (d - segStart) / segLen : 0;

  const from = points[segIdx % points.length] ?? points[0]!;
  const to = points[(segIdx + 1) % points.length] ?? from;

  return { lng: lerp(from[0], to[0], t), lat: lerp(from[1], to[1], t) };
}

/**
 * Heading suave: rumbo hacia un punto ~15m adelante en la ruta.
 */
function headingAtDistance(cache: RouteCache, dist: number): number {
  const from = positionAtDistance(cache, dist);
  const ahead = positionAtDistance(cache, dist + HEADING_AHEAD_M);
  return bearingDeg([from.lng, from.lat], [ahead.lng, ahead.lat]);
}

// ─── Estado por vehículo & Dwell Time ──────────────────────

export interface LineStopOnRoute {
  id: string;
  name: string;
  lat: number;
  lng: number;
  alongM: number;
}

type MovementState = 'IN_TRANSIT' | 'DWELLING';

interface VehicleState {
  lineId: string;
  unitId: string;
  routeCache: RouteCache;
  distanceTraveled: number; // metros
  speed: number; // km/h
  lat: number;
  lng: number;
  heading: number;
  prevLat: number;
  prevLng: number;
  prevHeading: number;
  movementState: MovementState;
  dwellRemainingSeconds: number; // Temporizador de 20s
  currentStopIndex: number;
  targetStopIndex: number;
  transitSpeedKmh: number;
  currentStopId: string | null;
  lastStopAlongM: number;
}

const stopsByLineCache: Record<string, LineStopOnRoute[]> = {};
const routeCacheByLine: Record<string, RouteCache> = {};

function projectStopOnRoute(routeCache: RouteCache, stop: { lat: number; lng: number }): number {
  const { points, cumLength } = routeCache;
  let bestDist = Infinity;
  let bestAlongM = 0;

  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const segLen = (cumLength[i + 1] ?? cumLength[i] ?? 0) - (cumLength[i] ?? 0);
    if (segLen <= 0 && i < points.length - 1) continue;

    const dLat = b[1] - a[1];
    const dLng = b[0] - a[0];
    const pLat = stop.lat - a[1];
    const pLng = stop.lng - a[0];

    const dot = pLng * dLng + pLat * dLat;
    const lenSq = dLng * dLng + dLat * dLat;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, dot / lenSq)) : 0;

    const projLng = a[0] + dLng * t;
    const projLat = a[1] + dLat * t;
    const d = distanceMeters([stop.lng, stop.lat], [projLng, projLat]);

    if (d < bestDist) {
      bestDist = d;
      bestAlongM = (cumLength[i] ?? 0) + (segLen > 0 ? segLen * t : 0);
    }
  }

  return bestAlongM;
}

function getLineStopsOnRoute(targetId: string, routeCache: RouteCache): LineStopOnRoute[] {
  if (stopsByLineCache[targetId]) return stopsByLineCache[targetId]!;

  let stopIds: string[] = [];
  if (MOCK_LINE_STOPS[targetId]) {
    stopIds = MOCK_LINE_STOPS[targetId]!;
  } else {
    stopIds = MOCK_STOPS.filter((s) => s.lineIds.includes(targetId)).map((s) => s.id);
  }

  const matched = stopIds
    .map((id) => MOCK_STOPS.find((s) => s.id === id))
    .filter((s): s is (typeof MOCK_STOPS)[number] => Boolean(s));

  const projected: LineStopOnRoute[] = matched.map((s) => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    alongM: projectStopOnRoute(routeCache, s),
  }));

  // Ordenar secuencialmente a lo largo de la traza
  projected.sort((a, b) => a.alongM - b.alongM);
  stopsByLineCache[targetId] = projected;
  return projected;
}

function computeTransitSpeed(routeCache: RouteCache, stopsCount: number, speedOverride?: number): number {
  if (speedOverride !== undefined) return speedOverride;
  const totalLength = routeCache.totalLength;
  const totalDwellSec = Math.max(0, stopsCount * DWELL_TIME_SECONDS);
  const totalTransitSec = Math.max(60, SCHEDULED_CYCLE_SECONDS - totalDwellSec);
  // v (km/h) = (distancia / tiempo_segundos) * 3.6
  const baseKmh = (totalLength / totalTransitSec) * 3.6;
  return Math.round(baseKmh * 10) / 10;
}

function createVehicle(
  lineId: string,
  unitId: string,
  routeCache: RouteCache,
  stops: LineStopOnRoute[],
  speedOverride?: number,
  distOverride?: number,
): VehicleState {
  const transitSpeedKmh = computeTransitSpeed(routeCache, stops.length, speedOverride);
  const totalLength = routeCache.totalLength || 1000;
  const startDist = distOverride ?? Math.random() * totalLength;
  const normalizedDist = ((startDist % totalLength) + totalLength) % totalLength;

  // Encontrar la próxima parada en el recorrido
  let targetIdx = 0;
  for (let i = 0; i < stops.length; i++) {
    if (stops[i]!.alongM >= normalizedDist) {
      targetIdx = i;
      break;
    }
  }

  const prevIdx = (targetIdx - 1 + stops.length) % stops.length;
  const targetStop = stops[targetIdx];
  const isRightAtStop = targetStop && Math.abs(normalizedDist - targetStop.alongM) <= 3;

  const pos = positionAtDistance(routeCache, normalizedDist);
  const heading = headingAtDistance(routeCache, normalizedDist);

  return {
    lineId,
    unitId,
    routeCache,
    distanceTraveled: normalizedDist,
    speed: isRightAtStop ? 0 : transitSpeedKmh,
    lat: pos.lat,
    lng: pos.lng,
    heading,
    prevLat: pos.lat,
    prevLng: pos.lng,
    prevHeading: heading,
    movementState: isRightAtStop ? 'DWELLING' : 'IN_TRANSIT',
    dwellRemainingSeconds: isRightAtStop ? DWELL_TIME_SECONDS : 0,
    currentStopIndex: isRightAtStop ? targetIdx : prevIdx,
    targetStopIndex: isRightAtStop ? (targetIdx + 1) % stops.length : targetIdx,
    transitSpeedKmh,
    currentStopId: isRightAtStop && targetStop ? targetStop.id : null,
    lastStopAlongM: isRightAtStop && targetStop ? targetStop.alongM : 0,
  };
}

function advanceVehicle(state: VehicleState, stops: LineStopOnRoute[]): VehicleState {
  const totalLength = state.routeCache.totalLength;
  if (totalLength <= 0 || stops.length === 0) {
    return state;
  }

  // 1. Estado DWELLING: Colectivo detenido en parada por 20 segundos fijos a 0 km/h
  if (state.movementState === 'DWELLING') {
    const remainingDwell = state.dwellRemainingSeconds - 1;

    if (remainingDwell <= 0) {
      // Reanuda la marcha saliendo suavemente con aceleración inicial
      return {
        ...state,
        movementState: 'IN_TRANSIT',
        dwellRemainingSeconds: 0,
        speed: INITIAL_DEPARTURE_SPEED_KMH,
        currentStopId: null,
      };
    }

    // Permanece estrictamente inmóvil en la parada con velocidad 0 km/h
    return {
      ...state,
      dwellRemainingSeconds: remainingDwell,
      speed: 0,
      prevLat: state.lat,
      prevLng: state.lng,
      prevHeading: state.heading,
    };
  }

  // 2. Estado IN_TRANSIT: Viaje hacia la siguiente parada con cinemática de frenado y aceleración
  const targetStop = stops[state.targetStopIndex] ?? stops[0]!;
  const distToTarget = ((targetStop.alongM - state.distanceTraveled) % totalLength + totalLength) % totalLength;
  const cruiseSpeed = state.transitSpeedKmh;

  // Comprobar si en este tick llega o hace snap a la parada
  const metersThisTick = state.speed / 3.6;
  if (distToTarget <= metersThisTick || distToTarget <= 2.5) {
    const stopPos = positionAtDistance(state.routeCache, targetStop.alongM);
    const stopHeading = headingAtDistance(state.routeCache, targetStop.alongM);

    return {
      ...state,
      distanceTraveled: targetStop.alongM,
      movementState: 'DWELLING',
      dwellRemainingSeconds: DWELL_TIME_SECONDS, // Exactamente 20 segundos obligatorios
      currentStopIndex: state.targetStopIndex,
      targetStopIndex: (state.targetStopIndex + 1) % stops.length,
      currentStopId: targetStop.id,
      lastStopAlongM: targetStop.alongM,
      speed: 0, // Inmediatamente 0 km/h en la parada
      lat: stopPos.lat,
      lng: stopPos.lng,
      heading: stopHeading,
      prevLat: state.lat,
      prevLng: state.lng,
      prevHeading: state.heading,
    };
  }

  // Curva Cinemática de Velocidad:
  let currentSpeed = cruiseSpeed;

  if (distToTarget <= BRAKING_DISTANCE_M) {
    // Zona de desaceleración / frenado progresivo previo a la parada
    const brakingFactor = Math.sqrt(distToTarget / BRAKING_DISTANCE_M);
    currentSpeed = Math.max(
      MIN_STOP_APPROACH_SPEED_KMH,
      Math.round(cruiseSpeed * brakingFactor * 10) / 10,
    );
  } else {
    // Zona de aceleración progresiva tras dejar la última parada
    const distSinceLast = ((state.distanceTraveled - state.lastStopAlongM) % totalLength + totalLength) % totalLength;
    if (distSinceLast <= ACCEL_DISTANCE_M && state.lastStopAlongM > 0) {
      const accelFactor = distSinceLast / ACCEL_DISTANCE_M;
      currentSpeed = Math.min(
        cruiseSpeed,
        Math.round((INITIAL_DEPARTURE_SPEED_KMH + (cruiseSpeed - INITIAL_DEPARTURE_SPEED_KMH) * accelFactor) * 10) / 10,
      );
    }
  }

  // Avanza normalmente a lo largo de la traza oficial
  const tickMoveMeters = currentSpeed / 3.6;
  const newDist = (state.distanceTraveled + tickMoveMeters) % totalLength;
  const pos = positionAtDistance(state.routeCache, newDist);
  const heading = headingAtDistance(state.routeCache, newDist);

  return {
    ...state,
    distanceTraveled: newDist,
    prevLat: state.lat,
    prevLng: state.lng,
    prevHeading: state.heading,
    lat: pos.lat,
    lng: pos.lng,
    heading,
    speed: currentSpeed,
    currentStopId: null,
  };
}

// ─── API pública ───────────────────────────────────────────

const vehicles: VehicleState[] = [];
let tickIntervalId: ReturnType<typeof setInterval> | null = null;
let subscribers: ((positions: VehiclePosition[]) => void)[] = [];

function initializeVehicles(): void {
  vehicles.length = 0;

  for (const [lineId, unitIds] of Object.entries(MOCK_UNITS)) {
    // Agrupar unidades por ramal para que cada coche circule sobre la traza exacta de su ramal
    const unitsByRamal: Record<string, string[]> = {};
    for (const unitId of unitIds) {
      const ramalId = getRamalForUnit(lineId, unitId) || lineId;
      if (!unitsByRamal[ramalId]) unitsByRamal[ramalId] = [];
      unitsByRamal[ramalId].push(unitId);
    }

    for (const [ramalId, rUnits] of Object.entries(unitsByRamal)) {
      const route = MOCK_ROUTES[ramalId] || MOCK_ROUTES[lineId];
      if (!route || route.length < 2) continue;

      const routeCache = buildRouteCache(route);
      routeCacheByLine[ramalId] = routeCache;
      const stops = getLineStopsOnRoute(ramalId, routeCache);
      stopsByLineCache[ramalId] = stops;
      const count = rUnits.length;

      rUnits.forEach((unitId, idx) => {
        // Espaciado equitativo a lo largo de la traza de este ramal específico
        const spacedDist = (idx / Math.max(1, count)) * routeCache.totalLength;
        vehicles.push(createVehicle(lineId, unitId, routeCache, stops, undefined, spacedDist));
      });
    }

    // Ruta de fallback por línea
    const defaultRoute = MOCK_ROUTES[lineId];
    if (defaultRoute && defaultRoute.length >= 2) {
      routeCacheByLine[lineId] = buildRouteCache(defaultRoute);
    }
  }
}

export function getRamalForUnit(lineId: string, unitId: string): string {
  if (lineId === 'line-65') return 'ramal-65-troncal';
  if (lineId === 'line-194') {
    const num = parseInt(unitId, 10);
    if (num >= 100 && num < 200) return 'ramal-194-a';
    if (num >= 200 && num < 300) return 'ramal-194-h';
    if (num >= 300 && num < 400) return 'ramal-194-b';
    if (num >= 400 && num < 450) return 'ramal-194-d';
    if (num >= 450 && num < 470) return 'ramal-194-e';
    if (num >= 470 && num < 500) return 'ramal-194-g';
    if (num >= 500 && num < 600) return 'ramal-194-f';
    if (num >= 600 && num < 700) return 'ramal-194-i';
    return 'ramal-194-h';
  }
  return '';
}

function tick(): void {
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i]!;
    const ramalId = getRamalForUnit(v.lineId, v.unitId);
    const stops = stopsByLineCache[ramalId] || stopsByLineCache[v.lineId] || [];
    vehicles[i] = advanceVehicle(v, stops);
  }

  const positions: VehiclePosition[] = vehicles.map((v) => {
    const ramalId = getRamalForUnit(v.lineId, v.unitId);
    const halfLen = (routeCacheByLine[ramalId]?.totalLength ?? routeCacheByLine[v.lineId]?.totalLength ?? 38000) / 2;
    return {
      lineId: v.lineId,
      ramalId,
      unitId: v.unitId,
      lat: v.lat,
      lng: v.lng,
      heading: v.heading,
      speed: v.speed,
      timestamp: Date.now(),
      isDwelling: v.movementState === 'DWELLING',
      dwellRemainingSeconds: v.dwellRemainingSeconds,
      currentStopId: v.currentStopId,
      direction: (v.distanceTraveled < halfLen ? 'ida' : 'vuelta') as 'ida' | 'vuelta',
    };
  });

  for (const cb of subscribers) {
    cb(positions);
  }
}

/**
 * Suscribirse a posiciones de vehículos (feed 1 Hz).
 * Retorna función para desuscribirse.
 */
export function subscribeToPositions(
  lineIds: string[],
  cb: (positions: VehiclePosition[]) => void,
): Unsubscribe {
  if (subscribers.length === 0) {
    initializeVehicles();
    tickIntervalId = setInterval(tick, TICK_INTERVAL_MS);
    // Primer tick inmediato
    tick();
  }

  const filteredCb = (positions: VehiclePosition[]) => {
    cb(positions.filter((p) => lineIds.includes(p.lineId)));
  };

  subscribers.push(filteredCb);

  return () => {
    subscribers = subscribers.filter((s) => s !== filteredCb);
    if (subscribers.length === 0) {
      if (tickIntervalId) {
        clearInterval(tickIntervalId);
        tickIntervalId = null;
      }
    }
  };
}

export function getCurrentPositions(): VehiclePosition[] {
  return vehicles.map((v) => ({
    lineId: v.lineId,
    unitId: v.unitId,
    lat: v.lat,
    lng: v.lng,
    heading: v.heading,
    speed: v.speed,
    timestamp: Date.now(),
    isDwelling: v.movementState === 'DWELLING',
    dwellRemainingSeconds: v.dwellRemainingSeconds,
    currentStopId: v.currentStopId,
    direction: (v.distanceTraveled < 19040 ? 'ida' : 'vuelta') as 'ida' | 'vuelta',
  }));
}
