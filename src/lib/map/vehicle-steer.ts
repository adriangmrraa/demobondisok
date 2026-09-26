/**
 * vehicle-steer — rigging del eje delantero adaptado a sprites.
 *
 * El spec del asset 3D pide el eje delantero enlazado al vector de la
 * trayectoria. Con sprites MapLibre no hay huesos: la derivada del rumbo
 * (deg/s) se bucketea con histéresis a 3 sprites pre-bakeados (izquierda,
 * recto, derecha) y `icon-image` elige el correcto por feature. Sin
 * writes por frame extra: sale dentro del setData que ya corre por frame.
 *
 * Convención: delta positivo = giro a la derecha (heading crece).
 */

/** Delta de heading normalizado a [−180, 180). */
export function headingDelta(fromDeg: number, toDeg: number): number {
  return ((toDeg - fromDeg + 540) % 360) - 180;
}

/**
 * Suavizado exponencial de la tasa de giro (deg/s). `dtSec` acotado por
 * el caller; un dt grande (gap del RAF) degrada el rate por sí solo.
 */
export function smoothSteerRate(prevRate: number, deltaDeg: number, dtSec: number): number {
  const dt = Math.max(dtSec, 1 / 120);
  const instant = deltaDeg / dt;
  return prevRate + (instant - prevRate) * 0.65;
}

/** Umbrales de histéresis (deg/s): entra a giro > 30, vuelve a recto < 15. */
const ENTER_THRESHOLD = 30;
const EXIT_THRESHOLD = 15;

export type SteerBucket = -1 | 0 | 1;

/**
 * Bucket del volante con histéresis: en curvas largas no parpadea entre
 * recto y giro, y el swap de sprite ocurre pocas veces por recorrido.
 */
export function nextSteerBucket(prev: SteerBucket, rateDegPerSec: number): SteerBucket {
  if (prev === 0) {
    if (rateDegPerSec > ENTER_THRESHOLD) return 1;
    if (rateDegPerSec < -ENTER_THRESHOLD) return -1;
    return 0;
  }
  if (Math.abs(rateDegPerSec) < EXIT_THRESHOLD) return 0;
  return prev;
}
