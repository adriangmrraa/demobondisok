/**
 * vehicle-motion-engine — Motor único de movimiento por vehículo (plan §2)
 *
 * Módulo PURO y testeable: sin DOM, sin MapLibre, sin relojes globales.
 * Una instancia por vehículo. Consumidores: símbolo, cámara, trail y
 * tarjeta — todos leen LA MISMA posición renderizada (fuente única).
 *
 * Semántica:
 * - Ordena por timestamp: descarta muestras atrasadas (≤ último fix).
 * - Interpola prev→current y extrapola EN CORTO (dead-reckoning limitado)
 *   cuando el feed demora; heading fijo durante la extrapolación.
 * - Detecta teleports (saltos imposibles entre fixes) y los reconcilia
 *   con snap directo: nunca interpola el tramo (atravesaría manzanas).
 * - Estados: live → stale (feed demorado) → offline (feed muerto).
 *   Offline congela el último fix (no desaparece ni se mueve solo).
 *
 * Base de tiempo: la MISMA que los timestamps del feed (epoch ms).
 * El reloj del caller puede no ser monotónico (NTP): el engine lo
 * amarra internamente — un salto atrás nunca rebobina la animación.
 */

export type MotionStatus = 'live' | 'stale' | 'offline';

export interface MotionSample {
  lat: number;
  lng: number;
  heading: number;
  /** km/h — misma unidad que VehiclePosition */
  speed: number;
  /** epoch ms, base del feed */
  timestamp: number;
}

export interface MotionFrame {
  lng: number;
  lat: number;
  heading: number;
  speed: number;
  status: MotionStatus;
  /** La posición va más allá del último fix medido (predicha). */
  extrapolated: boolean;
  /** Este frame reconoce un teleport reconciliado (snap, sin lerp). */
  jumped: boolean;
}

export interface VehicleMotionOptions {
  /** Sin fixes nuevos por más de esto → 'stale' (ms). */
  staleMs?: number;
  /** Sin fixes nuevos por más de esto → 'offline' (ms). */
  offlineMs?: number;
  /** Techo de extrapolación más allá del último fix (ms). */
  maxExtrapolationMs?: number;
  /** Distancia entre fixes consecutivos mayor a esto = teleport (m). */
  teleportMeters?: number;
}

const DEFAULTS = {
  staleMs: 4000,
  offlineMs: 10000,
  maxExtrapolationMs: 1500,
  teleportMeters: 400,
} as const;

const METERS_PER_DEGREE_LAT = 111_320;

function distanceMeters(a: MotionSample, b: MotionSample): number {
  const dLat = (b.lat - a.lat) * METERS_PER_DEGREE_LAT;
  const dLng =
    (b.lng - a.lng) *
    METERS_PER_DEGREE_LAT *
    Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

function headingLerp(from: number, to: number, t: number): number {
  const d = ((to - from + 540) % 360) - 180;
  return (from + d * t + 360) % 360;
}

/** Proyecta un punto hacia adelante por un rumbo (grados) y distancia (m). */
function pointAhead(
  lat: number,
  lng: number,
  headingDeg: number,
  meters: number,
): { lat: number; lng: number } {
  const rad = (headingDeg * Math.PI) / 180;
  const lat2 = lat + (Math.cos(rad) * meters) / METERS_PER_DEGREE_LAT;
  const lng2 =
    lng +
    (Math.sin(rad) * meters) /
      (METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));
  return { lat: lat2, lng: lng2 };
}

export class VehicleMotion {
  private readonly opts: Required<VehicleMotionOptions>;
  private prev: MotionSample | null = null;
  private current: MotionSample | null = null;
  private teleported = false;
  private lastNow: number | null = null;

  constructor(options: VehicleMotionOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
  }

  /** Último fix crudo aceptado (verdad del feed), o null si no hay. */
  get fix(): MotionSample | null {
    return this.current;
  }

  /**
   * Ingresa un fix del feed. Muestras atrasadas (timestamp ≤ actual) se
   * descartan. Un salto imposible reconcilia con snap: nunca se interpola
   * a través de la ciudad.
   */
  push(sample: MotionSample): void {
    if (this.current && sample.timestamp <= this.current.timestamp) return;

    this.teleported = false;
    if (this.current) {
      if (distanceMeters(this.current, sample) > this.opts.teleportMeters) {
        this.prev = null;
        this.teleported = true;
      } else {
        this.prev = this.current;
      }
    }
    this.current = sample;
  }

  /**
   * Posición renderizada en el instante `now` (misma base que los
   * timestamps del feed). Devuelve null si todavía no hay datos.
   */
  frame(nowInput: number): MotionFrame | null {
    const cur = this.current;
    if (!cur) return null;

    // Reloj monotónico interno: el caller nunca rebobina la animación.
    const now =
      this.lastNow === null ? nowInput : Math.max(this.lastNow, nowInput);
    this.lastNow = now;

    const age = now - cur.timestamp;
    const status: MotionStatus =
      age > this.opts.offlineMs ? 'offline' : age > this.opts.staleMs ? 'stale' : 'live';

    let lng = cur.lng;
    let lat = cur.lat;
    let heading = cur.heading;
    const speed = cur.speed;
    let extrapolated = false;

    if (status !== 'offline') {
      if (this.prev && now < cur.timestamp) {
        // Reloj detrás del feed: completar el tramo prev→current.
        const span = cur.timestamp - this.prev.timestamp;
        const t = span > 0 ? (now - this.prev.timestamp) / span : 1;
        lng = this.prev.lng + (cur.lng - this.prev.lng) * t;
        lat = this.prev.lat + (cur.lat - this.prev.lat) * t;
        heading = headingLerp(this.prev.heading, cur.heading, t);
      } else if (now > cur.timestamp) {
        // Feed demorado: dead-reckoning corto y limitado por el rumbo.
        const over = Math.min(now - cur.timestamp, this.opts.maxExtrapolationMs);
        const meters = (speed / 3.6) * (over / 1000);
        const ahead = pointAhead(cur.lat, cur.lng, cur.heading, meters);
        lat = ahead.lat;
        lng = ahead.lng;
        extrapolated = true;
      }
    }

    return { lng, lat, heading, speed, status, extrapolated, jumped: this.teleported };
  }
}
