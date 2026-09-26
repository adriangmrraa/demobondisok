/**
 * Servicio de Telemetría, Estimaciones de Arribo y Horarios por Parada
 * Arquitectura modular y pura para la Línea 65 (AMBA - La Nueva Metropol S.A.).
 */

import { Parada } from "@/types/transport";
import type { VehiclePosition } from "@/lib/data-service";
import { getRouteTrack } from "@/lib/map/route-progress";
import { MOCK_ROUTES } from "@/mock/data";

export interface WalkFeasibility {
  walkMin: number;
  walkDistanceM: number;
  status: "on-time" | "hurry" | "unreachable";
  label: string;
}

export interface StopLiveStatus {
  stop: Parada;
  stopIndex: number;
  alongM: number;
  nearestUnitId: string | null;
  distanceAheadM: number;
  etaMin: number;
  etaSeconds: number;
  clockTime: string; // "10:18"
  isImminent: boolean; // arribando o en parada
  isAtStop: boolean; // <= 1 min o dwelling
  displayStatus: "en-parada" | "arribando" | "minutos";
  displayLabel: string; // "En parada" | "Arribando" | "X min"
  statusColor: "emerald" | "amber" | "slate";
  walkComparison: WalkFeasibility | null;
  scheduledNextSlots: string[]; // ["10:18", "10:23", "10:28"]
}

export interface ActiveBusInTransit {
  unitId: string;
  speedKmh: number;
  alongM: number;
  fromStop: Parada;
  toStop: Parada;
  progressInSegment: number; // 0..1
}

const AVERAGE_BUS_SPEED_KMH = 19; // Velocidad comercial real calculada para ciclo de 120 min
const WALKING_SPEED_M_PER_MIN = 80; // ~4.8 km/h

/** Rumbo y distancia geodésica local en metros */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * 111320;
  const dLng = (lng2 - lng1) * 111320 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLng);
}

/** Formatear minutos absolutos a "HH:MM" */
function formatClockTime(date: Date, addMinutes: number): string {
  const future = new Date(date.getTime() + addMinutes * 60 * 1000);
  const h = String(future.getHours()).padStart(2, "0");
  const m = String(future.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Calcula los próximos horarios programados determinísticos para una parada
 * basándose en la frecuencia oficial de 5 minutos de la Línea 65.
 */
export function getScheduledSlotsForStop(
  stopAlongM: number,
  frequencyMin = 5,
  count = 4,
  referenceDate = new Date(),
): string[] {
  const currentTotalMin = referenceDate.getHours() * 60 + referenceDate.getMinutes();
  const travelFromStartMin = Math.round((stopAlongM / 1000 / AVERAGE_BUS_SPEED_KMH) * 60);

  // Primera salida del día: 04:30 (270 min)
  const startOfDayMin = 4 * 60 + 30 + travelFromStartMin;
  const slots: string[] = [];

  let slotMin = startOfDayMin;
  while (slotMin < 24 * 60 + 120) {
    if (slotMin >= currentTotalMin) {
      const h = String(Math.floor(slotMin / 60) % 24).padStart(2, "0");
      const m = String(slotMin % 60).padStart(2, "0");
      slots.push(`${h}:${m}`);
      if (slots.length >= count) break;
    }
    slotMin += frequencyMin;
  }

  return slots;
}

/**
 * Evalúa la factibilidad de que el usuario llegue a pie antes que el colectivo.
 */
export function calculateWalkFeasibility(
  userLocation: { lat: number; lng: number } | null,
  stop: Parada,
  busEtaMin: number,
): WalkFeasibility | null {
  if (!userLocation) return null;

  const distM = distanceMeters(userLocation.lat, userLocation.lng, stop.lat, stop.lng);
  const walkMin = Math.max(1, Math.round(distM / WALKING_SPEED_M_PER_MIN));

  if (walkMin <= busEtaMin - 1) {
    return {
      walkMin,
      walkDistanceM: Math.round(distM),
      status: "on-time",
      label: "Llegás bien",
    };
  }
  if (walkMin <= busEtaMin + 2) {
    return {
      walkMin,
      walkDistanceM: Math.round(distM),
      status: "hurry",
      label: "Apurate",
    };
  }
  return {
    walkMin,
    walkDistanceM: Math.round(distM),
    status: "unreachable",
    label: "Llegás al siguiente",
  };
}

/**
 * Computa el estado en vivo de todas las paradas de la Línea:
 * - Proyección exacta sobre el trazado oficial.
 * - Matching del colectivo más próximo que viaja hacia cada parada.
 * - ETA en minutos y reloj ("10:18 hs") incorporando paradas intermedias de 20s.
 * - Factibilidad a pie si hay GPS de usuario.
 * - Horarios programados con frecuencia de 5 minutos.
 */
export function computeLineStopStatuses(
  lineId: string,
  paradas: Parada[],
  positions: VehiclePosition[],
  userLocation: { lat: number; lng: number } | null = null,
  referenceDate = new Date(),
): {
  statuses: StopLiveStatus[];
  busesInTransit: ActiveBusInTransit[];
} {
  const coords = MOCK_ROUTES[lineId];
  if (!coords || coords.length < 2 || paradas.length === 0) {
    return { statuses: [], busesInTransit: [] };
  }

  const track = getRouteTrack(lineId, coords);
  if (!track) return { statuses: [], busesInTransit: [] };

  const totalLength = track.totalM;

  // 1. Proyectar paradas ordenadas a lo largo de la traza
  const projectedStops = paradas.map((stop, index) => {
    const { alongM } = track.project(stop.lng, stop.lat);
    return { stop, index, alongM };
  });

  // 2. Proyectar unidades activas de la línea
  const linePositions = positions.filter((p) => p.lineId === lineId);
  const projectedVehicles = linePositions.map((v) => {
    const { alongM } = track.project(v.lng, v.lat);
    return {
      unitId: v.unitId,
      speed: v.speed,
      alongM,
      isDwelling: Boolean(v.isDwelling),
      dwellRemainingSeconds: v.dwellRemainingSeconds ?? 0,
      currentStopId: v.currentStopId ?? null,
    };
  });

  // 3. Calcular ETA hacia cada parada buscando el colectivo upstream más cercano
  const statuses: StopLiveStatus[] = projectedStops.map(({ stop, index, alongM }) => {
    let nearestUnitId: string | null = null;
    let minDistanceAhead = Infinity;
    let effectiveSpeed = AVERAGE_BUS_SPEED_KMH;
    let nearestVehIsDwelling = false;
    let nearestVehDwellRemaining = 0;
    let nearestVehAlongM = 0;

    for (const veh of projectedVehicles) {
      // Distancia circular a recorrer por el colectivo hasta alcanzar la parada
      const distAhead = ((alongM - veh.alongM) % totalLength + totalLength) % totalLength;
      if (distAhead < minDistanceAhead) {
        minDistanceAhead = distAhead;
        nearestUnitId = veh.unitId;
        effectiveSpeed = veh.speed > 0 ? veh.speed : AVERAGE_BUS_SPEED_KMH;
        nearestVehIsDwelling = veh.isDwelling && (veh.currentStopId === stop.id || distAhead <= 25);
        nearestVehDwellRemaining = veh.dwellRemainingSeconds;
        nearestVehAlongM = veh.alongM;
      }
    }

    // Si no hay unidades activas registradas, usar fallback de frecuencia
    const distanceAheadM = minDistanceAhead === Infinity ? 1500 : minDistanceAhead;
    const isAtStop = nearestVehIsDwelling || distanceAheadM <= 12;

    // Contar paradas intermedias entre el colectivo y la parada objetivo (cada una suma 20s de dwell)
    let intermediateDwellsSec = 0;
    if (!isAtStop && minDistanceAhead !== Infinity) {
      for (const otherStop of projectedStops) {
        const d = ((otherStop.alongM - nearestVehAlongM) % totalLength + totalLength) % totalLength;
        if (d > 20 && d < distanceAheadM - 20) {
          intermediateDwellsSec += 20;
        }
      }
    }

    const cruiseSpeedMps = AVERAGE_BUS_SPEED_KMH / 3.6;
    const transitSeconds = Math.round(distanceAheadM / cruiseSpeedMps);
    const dwellAhead = nearestVehIsDwelling ? nearestVehDwellRemaining : 0;
    const etaSeconds = isAtStop ? 0 : transitSeconds + intermediateDwellsSec + dwellAhead;
    const etaMin = Math.ceil(etaSeconds / 60);

    // Regla de negocio estricta del usuario:
    // - Menor o igual a 1 min (o en parada): "En parada"
    // - Entre 1 y 2 min: "Arribando"
    // - Mayor a 2 min: "X min"
    let displayStatus: "en-parada" | "arribando" | "minutos";
    let displayLabel: string;
    let statusColor: "emerald" | "amber" | "slate";

    if (isAtStop || etaSeconds <= 60) {
      displayStatus = "en-parada";
      displayLabel = "En parada";
      statusColor = "emerald";
    } else if (etaSeconds <= 120) {
      displayStatus = "arribando";
      displayLabel = "Arribando";
      statusColor = "emerald";
    } else {
      displayStatus = "minutos";
      displayLabel = `${etaMin} min`;
      statusColor = etaMin <= 5 ? "emerald" : etaMin <= 10 ? "amber" : "slate";
    }

    const isImminent = displayStatus === "en-parada" || displayStatus === "arribando";
    const clockMinutesToAdd = displayStatus === "en-parada" ? 0 : displayStatus === "arribando" ? 1 : etaMin;
    const clockTime = formatClockTime(referenceDate, clockMinutesToAdd);
    const walkComparison = calculateWalkFeasibility(userLocation, stop, etaMin);
    const scheduledNextSlots = getScheduledSlotsForStop(alongM, 5, 4, referenceDate);

    return {
      stop,
      stopIndex: index,
      alongM,
      nearestUnitId,
      distanceAheadM: Math.round(distanceAheadM),
      etaMin,
      etaSeconds,
      clockTime,
      isImminent,
      isAtStop,
      displayStatus,
      displayLabel,
      statusColor,
      walkComparison,
      scheduledNextSlots,
    };
  });

  // 4. Detectar qué unidades están navegando entre dos paradas consecutivas
  const busesInTransit: ActiveBusInTransit[] = [];
  for (const veh of projectedVehicles) {
    for (let i = 0; i < projectedStops.length; i++) {
      const from = projectedStops[i]!;
      const to = projectedStops[(i + 1) % projectedStops.length]!;

      const segDist = ((to.alongM - from.alongM) % totalLength + totalLength) % totalLength;
      const progressDist = ((veh.alongM - from.alongM) % totalLength + totalLength) % totalLength;

      // Si el vehículo se encuentra dentro del segmento entre 'from' y 'to'
      if (progressDist > 10 && progressDist < segDist - 10) {
        busesInTransit.push({
          unitId: veh.unitId,
          speedKmh: Math.round(veh.speed),
          alongM: veh.alongM,
          fromStop: from.stop,
          toStop: to.stop,
          progressInSegment: progressDist / segDist,
        });
      }
    }
  }

  return { statuses, busesInTransit };
}
