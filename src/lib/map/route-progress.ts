/**
 * route-progress — Proyección de posiciones sobre el recorrido (mock)
 *
 * Pure module: convierte la polilínea de una línea en un "track" con
 * distancias acumuladas para proyectar cualquier punto (parada, colectivo
 * vivo) a "metros desde el inicio" y progreso 0..1. Con esto el modal
 * arma el cronograma: paradas ordenadas y el dot del bus en su lugar.
 *
 * Los recorridos mock son secuencias de coordenadas:
 * inicio = coords[0], fin = última coord — la línea de tiempo sigue el
 * ORDEN de la secuencia, aunque la geometría sea un circuito cerrado.
 *
 * Proyección equirectangular local (≈ metros) — suficiente a escala de
 * corredores urbanos; la precisión de esto es de demo, no de facturación.
 */

export interface RouteTrack {
  readonly totalM: number;
  /** Proyecta un punto: metros recorridos desde el inicio + total */
  project(lng: number, lat: number): { alongM: number; totalM: number };
}

const M_PER_DEG = 111_320;

interface Segment {
  /** extremos en metros locales (origen: primer punto) */
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** distancia acumulada al inicio del segmento */
  cum: number;
  len: number;
}

function toMeters(coords: [number, number][]): { x: number; y: number }[] {
  const [originLng] = coords[0] ?? [0];
  const cosLat = Math.cos((coords[0]?.[1] ?? 0) * (Math.PI / 180));
  return coords.map(([lng, lat]) => ({
    x: (lng - originLng) * M_PER_DEG * cosLat,
    y: (lat - (coords[0]?.[1] ?? 0)) * M_PER_DEG,
  }));
}

export function createRouteTrack(coords: [number, number][]): RouteTrack | null {
  if (coords.length < 2) return null;
  const pts = toMeters(coords);
  const segments: Segment[] = [];
  let totalM = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, cum: totalM, len });
    totalM += len;
  }
  if (totalM <= 0) return null;

  return {
    totalM,
    project(lng: number, lat: number) {
      // mismo marco local que el track (origen de coords[0])
      const [originLng, originLat] = coords[0]!;
      const cosLat = Math.cos(originLat * (Math.PI / 180));
      const px = (lng - originLng) * M_PER_DEG * cosLat;
      const py = (lat - originLat) * M_PER_DEG;

      let best = { d: Infinity, alongM: 0 };
      for (const seg of segments) {
        // proyección del punto sobre el segmento, clamp al segmento
        const vx = seg.bx - seg.ax;
        const vy = seg.by - seg.ay;
        const segLen2 = seg.len * seg.len;
        const t =
          segLen2 > 0
            ? Math.max(0, Math.min(1, ((px - seg.ax) * vx + (py - seg.ay) * vy) / segLen2))
            : 0;
        const cx = seg.ax + vx * t;
        const cy = seg.ay + vy * t;
        const d = Math.hypot(px - cx, py - cy);
        if (d < best.d) {
          best = { d, alongM: seg.cum + seg.len * t };
        }
      }
      return { alongM: best.alongM, totalM };
    },
  };
}

/** Track cacheado por línea (el mock no cambia en runtime) */
const trackCache = new Map<string, RouteTrack | null>();
export function getRouteTrack(lineId: string, coords: [number, number][]): RouteTrack | null {
  if (!trackCache.has(lineId)) {
    trackCache.set(lineId, createRouteTrack(coords));
  }
  return trackCache.get(lineId) ?? null;
}

/** Parada del mock (subconjunto que interesa) */
export interface SimpleStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface StopAlongRoute {
  id: string;
  name: string;
  /** metros desde el inicio */
  alongM: number;
  /** 0..1 */
  progress: number;
}

/** Paradas del recorrido ordenadas por distancia desde el inicio */
export function stopsAlongRoute(
  track: RouteTrack,
  stops: SimpleStop[],
): StopAlongRoute[] {
  return stops
    .map((s) => {
      const { alongM } = track.project(s.lng, s.lat);
      return {
        id: s.id,
        name: s.name,
        alongM,
        progress: Math.max(0, Math.min(1, alongM / track.totalM)),
      };
    })
    .sort((a, b) => a.alongM - b.alongM);
}

/** Progreso (0..1) del colectivo vivo sobre el recorrido */
export function busProgressOn(track: RouteTrack, position: { lng: number; lat: number }): number {
  const { alongM } = track.project(position.lng, position.lat);
  return Math.max(0, Math.min(1, alongM / track.totalM));
}
