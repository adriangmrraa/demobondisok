import type { EstimacionLlegada } from '@/types/transport';
import type { LocationPoint, TransitLeg, TripOption } from '@/types/trip-planner';
import type { RouteTrack } from '@/lib/map/route-progress';

/**
 * Portable trip state shared by Home and Mi Viaje. It intentionally lives in
 * the URL so a shared link or a browser refresh restores the same demo trip.
 */
export interface TripMapNavigationState {
  origin: LocationPoint;
  destinationName: string;
  boardingStopId?: string;
  selectedTripId?: string;
  lineId?: string;
  ramalId?: string;
  vehicleUnitId?: string;
  etaReferenceMs?: number;
  etaMinutes?: number;
}

function selectedRide(trip: TripOption): TransitLeg | undefined {
  return trip.legs.find((leg): leg is TransitLeg => leg.type === 'ride');
}

export function buildTripMapState(
  trip: TripOption,
  origin: LocationPoint,
  options: Pick<TripMapNavigationState, 'boardingStopId'> & { arrival?: EstimacionLlegada },
): TripMapNavigationState {
  const ride = selectedRide(trip);
  return {
    origin,
    destinationName: trip.destination.name,
    boardingStopId: options.boardingStopId ?? origin.stopId,
    selectedTripId: trip.id,
    lineId: options.arrival?.lineaId ?? ride?.lineaId,
    ramalId: ride?.ramalId,
    vehicleUnitId: options.arrival?.interno,
    etaReferenceMs: options.arrival ? Date.now() : undefined,
    etaMinutes: options.arrival?.minutos,
  };
}

export function tripMapUrlFromState(state: TripMapNavigationState): string {
  const params = new URLSearchParams({
    trip: '1',
    origen: state.origin.name,
    origenLat: String(state.origin.lat),
    origenLng: String(state.origin.lng),
    destino: state.destinationName,
  });
  if (state.origin.address) params.set('origenDireccion', state.origin.address);
  if (state.origin.stopId) params.set('origenParada', state.origin.stopId);
  if (state.boardingStopId) params.set('paradaSubida', state.boardingStopId);
  if (state.selectedTripId) params.set('opcion', state.selectedTripId);
  if (state.lineId) params.set('linea', state.lineId);
  if (state.ramalId) params.set('ramal', state.ramalId);
  if (state.vehicleUnitId) params.set('interno', state.vehicleUnitId);
  if (state.etaReferenceMs) params.set('etaRef', String(state.etaReferenceMs));
  if (state.etaMinutes !== undefined) params.set('etaMin', String(state.etaMinutes));
  return `/mapas?${params.toString()}`;
}

export function buildTripMapUrl(
  trip: TripOption,
  origin: LocationPoint,
  options: Pick<TripMapNavigationState, 'boardingStopId'> & { arrival?: EstimacionLlegada },
): string {
  return tripMapUrlFromState(buildTripMapState(trip, origin, options));
}

function finiteNumber(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Parses both the current portable contract and legacy Home/Mi Viaje links. */
export function parseTripMapState(params: URLSearchParams): TripMapNavigationState | null {
  if (params.get('trip') !== '1') return null;
  const originName = params.get('origen')?.trim();
  const destinationName = params.get('destino')?.trim();
  if (!originName || !destinationName) return null;

  const lat = finiteNumber(params.get('origenLat'));
  const lng = finiteNumber(params.get('origenLng'));
  return {
    origin: {
      name: originName,
      ...(lat !== null && lng !== null ? { lat, lng } : { lat: 0, lng: 0 }),
      ...(params.get('origenDireccion') ? { address: params.get('origenDireccion')! } : {}),
      ...(params.get('origenParada') ? { stopId: params.get('origenParada')! } : {}),
    },
    destinationName,
    boardingStopId: params.get('paradaSubida') ?? params.get('origenParada') ?? undefined,
    selectedTripId: params.get('opcion') ?? undefined,
    lineId: params.get('linea') ?? undefined,
    ramalId: params.get('ramal') ?? undefined,
    vehicleUnitId: params.get('interno') ?? undefined,
    etaReferenceMs: finiteNumber(params.get('etaRef')) ?? undefined,
    etaMinutes: finiteNumber(params.get('etaMin')) ?? undefined,
  };
}

// ─── trip-arrival-alert: arrival selectors (sdd/trip-arrival-alert 1.1–1.2) ─
// Pure geometric derivation from the live GPS tick vs `boardingStopId` along
// the existing route track. Same projection + circular modulo math as
// `TransportService.getLlegadasPorParada`; no routing/RAPTOR recompute.

/** Epsilon window: ARRIBANDO fires when the bus is this close (or sooner). */
export const ARRIVAL_EPS_M = 60;
/** Epsilon window in seconds (catches mock tick jumps like 0.4→0.0 min). */
export const ARRIVAL_EPS_S = 45;
/** Pass-detection window behind the stop along the circular track. */
export const PASS_WINDOW_M = 150;

/** Cruise speed shared with `TransportService.getLlegadasPorParada` (19 km/h). */
const ARRIVAL_SPEED_MPS = 19 / 3.6;

export interface ArrivalEta {
  /** Metres from the vehicle to the boarding stop along the track (modulo). */
  distAheadM: number;
  /** Seconds to the boarding stop at cruise speed (rounded, ≥ 0). */
  etaSeconds: number;
}

/**
 * ETA from the live vehicle position to the boarding stop.
 * Loop-wrap safe: `distAheadM` is modulo `track.totalM`, so a bus that just
 * passed the stop reports `≈ totalM` (not a negative gap).
 */
export function etaToBoardingStop(
  track: RouteTrack,
  veh: { lng: number; lat: number },
  stop: { lng: number; lat: number },
): ArrivalEta {
  const vehAlongM = track.project(veh.lng, veh.lat).alongM;
  const stopAlongM = track.project(stop.lng, stop.lat).alongM;
  const totalM = track.totalM;
  const distAheadM = ((stopAlongM - vehAlongM) % totalM + totalM) % totalM;
  const etaSeconds = Math.max(0, Math.round(distAheadM / ARRIVAL_SPEED_MPS));
  return { distAheadM, etaSeconds };
}

/**
 * True once the bus has travelled past the boarding stop: `distAheadM` has
 * wrapped into `[totalM − 150m, totalM)`. Gated on the ARRIBANDO latch so a
 * far-away bus (large `distAheadM`, no latch) can never false-fire.
 */
export function hasPassedStop(distAheadM: number, totalM: number, latched: boolean): boolean {
  if (!latched) return false;
  return distAheadM >= totalM - PASS_WINDOW_M && distAheadM < totalM;
}

/** Presentational arrival phase for the white card + minimized pill.
 * BOARDING dwell → transfer → VIAJANDO extension (sdd/trip-arrival-alert):
 * `PASSED` is the transient energy-transfer instant (white card pops + orb
 * rises toward the pill); `VIAJANDO_GREEN` is the brief boarding-confirmed
 * beat (green card); `VIAJANDO_YELLOW` is the riding phase (yellow card +
 * yellow pill color-sync) before the demo loops back to waiting. */
export type ArrivalPhase = 'NORMAL' | 'ARRIBANDO' | 'PASSED' | 'VIAJANDO_GREEN' | 'VIAJANDO_YELLOW';

// ─── trip-arrival-alert follow-up: boarding dwell → transfer → riding ────
// Demo flow /mapas?trip=1: ARRIBANDO must HOLD while the bus is at the stop
// (boarding simulation), then the PASSED transfer animation must play visibly,
// then the trip continues onboard for 1–2 stops before the next-bus selector
// is allowed to switch to a new incoming bus.

/** Minimum time ARRIBANDO stays red before PASSED may fire (boarding dwell). */
export const BOARDING_DWELL_MS = 5000;
/** How long PASSED (transfer-pop + pill-pulse handoff) stays visible. */
export const TRANSFER_MS = 2500;
/** How long the green VIAJANDO board-confirmed beat holds before the ride
 * turns yellow. Brief on purpose: green = "boarding confirmed", yellow = ride. */
export const VIAJANDO_GREEN_MS = 3000;
/** Shared yellow token for the VIAJANDO ride: card bg + pill flash use the
 * SAME value so they combine BY COLOR (card stays docked, pill stays on top).
 * #FFD60A on #141414 ≈ 12:1 (AAA); keep in sync with `--viajando-yellow`. */
export const VIAJANDO_YELLOW = '#FFD60A';
/** Stops ridden onboard before the demo loops back to a new bus. */
export const RIDING_STOPS = 2;
/** Fallback: release the ride even if stop counting stalls (sparse route). */
export const RIDING_TIMEOUT_MS = 90000;

/**
 * Pure ride-completion check: true once the user has ridden `RIDING_STOPS`
 * stops past the boarding stop, or the fallback timeout elapsed.
 */
export function hasCompletedRide(stopsRidden: number, elapsedMs: number): boolean {
  if (elapsedMs >= RIDING_TIMEOUT_MS) return true;
  return stopsRidden >= RIDING_STOPS;
}

/**
 * Pure onboard sub-phase from ms since boarding: PASSED (energy transfer)
 * → VIAJANDO_GREEN (boarding confirmed, brief) → VIAJANDO_YELLOW (riding).
 * Mirrors the `onboard` branch of the `arrivalPhase` memo in
 * `src/app/mapas/page.tsx`; kept pure here so the node harness can assert
 * the green→yellow timeline without rendering.
 */
export function viajandoSubPhase(elapsedMs: number): 'PASSED' | 'VIAJANDO_GREEN' | 'VIAJANDO_YELLOW' {
  if (elapsedMs < TRANSFER_MS) return 'PASSED';
  if (elapsedMs < TRANSFER_MS + VIAJANDO_GREEN_MS) return 'VIAJANDO_GREEN';
  return 'VIAJANDO_YELLOW';
}