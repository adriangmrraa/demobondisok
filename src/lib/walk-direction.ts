/**
 * Helpers para describir la dirección de un paso a pie.
 *
 * - `computeBearing(from, to)`: bearing geodésico (0-360°) de from a to.
 * - `walkDirectionLabel(bearing, userHeading?)`: descripción relativa al
 *   heading del usuario si está disponible, absoluta en caso contrario.
 *   Devuelve "a tu izquierda" / "al frente" / "a tu derecha" o
 *   "hacia el Noroeste" / "hacia el Norte" / etc.
 */

const COMPASS: Array<{ label: string; min: number; max: number }> = [
  { label: 'Norte', min: -22.5 + 360, max: 22.5 },
  { label: 'Noreste', min: 22.5, max: 67.5 },
  { label: 'Este', min: 67.5, max: 112.5 },
  { label: 'Sureste', min: 112.5, max: 157.5 },
  { label: 'Sur', min: 157.5, max: 202.5 },
  { label: 'Suroeste', min: 202.5, max: 247.5 },
  { label: 'Oeste', min: 247.5, max: 292.5 },
  { label: 'Noroeste', min: 292.5, max: 337.5 },
];

function normalizeAngle(deg: number): number {
  const value = deg % 360;
  return value < 0 ? value + 360 : value;
}

function compassLabel(bearing: number): string {
  const b = normalizeAngle(bearing);
  // Treat 0 as a 360-equivalent wrap: the first range (Norte) spans
  // 337.5-360 + 0-22.5, so we handle the wrap with the offset trick.
  for (const range of COMPASS) {
    if (range.min < 360) {
      if (b >= range.min && b < range.max) return range.label;
    } else {
      if (b >= range.min || b < range.max - 360) return range.label;
    }
  }
  return 'Norte';
}

/**
 * Bearing geodésico desde `from` hasta `to` en grados (0-360, donde 0 es
 * Norte, 90 es Este, 180 es Sur, 270 es Oeste). Usa una aproximación
 * planar de Mercator — suficiente para pasos a pie urbanos (< 5 km).
 */
export function computeBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return normalizeAngle((θ * 180) / Math.PI);
}

/**
 * Diferencia angular más corta entre dos bearings (rango -180..180).
 */
function bearingDelta(target: number, current: number): number {
  return normalizeAngle(target - current + 180) - 180;
}

/**
 * Etiqueta de dirección para un paso a pie.
 *
 * Si `userHeading` (en grados, 0 = Norte) está disponible, devuelve
 * una dirección relativa: "a tu izquierda" / "al frente" / "a tu derecha".
 * Si no, devuelve una dirección absoluta: "hacia el Norte" / etc.
 */
export function walkDirectionLabel(bearing: number, userHeading?: number | null): string {
  if (userHeading == null || !Number.isFinite(userHeading)) {
    return `hacia el ${compassLabel(bearing)}`;
  }
  const delta = bearingDelta(bearing, userHeading);
  const abs = Math.abs(delta);
  if (abs <= 30) return 'al frente';
  if (abs >= 150) return 'detrás tuyo';
  if (delta < 0) return 'a tu izquierda';
  return 'a tu derecha';
}

/**
 * Enriquece los steps de tipo "walk" y "transfer" con el bearing calculado a
 * partir de la polilínea del leg correspondiente. Devuelve nuevos steps
 * (no muta). Si el tramo no tiene desplazamiento real (ej: transbordo en la
 * misma parada) no se asigna bearing — nunca se inventa una dirección.
 */
export function enrichStepsWithBearing<T extends import('@/types/trip-planner').TripStep>(
  steps: readonly T[],
  legs: readonly import('@/types/trip-planner').TripLeg[],
): T[] {
  return steps.map((step) => {
    if (step.type !== 'walk' && step.type !== 'transfer') return step;
    const matchingLeg = legs.find(
      (l) =>
        (l.type === 'walk' && (l.to as { stopId?: string }).stopId === step.toStopId) ||
        (l.type === 'transfer' && l.toStop.id === step.toStopId),
    );
    const coords =
      matchingLeg && matchingLeg.type !== 'ride' ? matchingLeg.segmentCoordinates : undefined;
    if (!coords || coords.length < 2) {
      return step;
    }
    const from = coords[0];
    const to = coords[coords.length - 1];
    // Tramo sin desplazamiento (~< 1 m): no hay dirección real que indicar.
    if (Math.abs(to[0] - from[0]) < 1e-5 && Math.abs(to[1] - from[1]) < 1e-5) {
      return step;
    }
    return { ...step, walkBearing: computeBearing({ lat: from[1], lng: from[0] }, { lat: to[1], lng: to[0] }) };
  });
}
