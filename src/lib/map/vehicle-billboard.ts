/**
 * Billboard del colectivo isométrico — rotación relativa a la cámara.
 *
 * El sprite isométrico (`busIsoSvg`) es un billboard en el plano de pantalla.
 * Al tratarse de un dibujo pseudo-3D (2.5D), tiene gravedad definida: techo
 * hacia arriba y ruedas hacia abajo.
 *
 * Si un vehículo se desplaza hacia la izquierda de la pantalla, una rotación pura
 * de 180° invierte el eje vertical, dejando las ruedas en el aire y el techo en el piso.
 *
 * Solución de motor gráfico (Dual-Billboard con reflexión horizontal):
 * - Cuando el rumbo relativo en pantalla va hacia la derecha ([-2°, 178°]):
 *   se utiliza el sprite estándar (frente a la derecha) con offset de -90°.
 * - Cuando el rumbo relativo en pantalla va hacia la izquierda ([-178°, -2°]):
 *   se utiliza el sprite espejado (frente a la izquierda) con offset de +90°.
 *
 * En ambos casos, la rotación resultante en pantalla queda SIEMPRE confinada
 * a [-90°, +90°]. Las ruedas NUNCA superan al techo y el colectivo avanza
 * fielmente sobre su trazado.
 */

/** Determina si el vehículo debe usar el sprite isométrico espejado hacia la izquierda. */
export function isIsoFlipped(headingDeg: number, camBearingDeg: number): boolean {
  const rel = normalizeDegrees(headingDeg - camBearingDeg);
  return rel < -2 && rel > -178;
}

/** Rotación de pantalla (deg clockwise) del billboard isométrico. */
export function isoBillboardRotation(headingDeg: number, camBearingDeg: number): number {
  const rel = normalizeDegrees(headingDeg - camBearingDeg);
  if (rel < -2 && rel > -178) {
    return normalizeDegrees(rel + 90);
  }
  return normalizeDegrees(rel - 90);
}

/**
 * Rotación map-aligned de la sombra: la elipse tiene su eje largo
 * horizontal, por lo que necesita el mismo offset de −90° para quedar
 * alineada al rumbo del vehículo sobre la calle.
 */
export function shadowRotation(headingDeg: number): number {
  return normalizeDegrees(headingDeg - 90);
}

export function normalizeDegrees(deg: number): number {
  return ((deg + 180) % 360 + 360) % 360 - 180;
}
