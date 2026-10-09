/**
 * Helpers puros del Home "línea primero" (docs/HOME-LINEA-FIRST.md §4).
 * Resuelven línea → ramal → recorrido (sentido) → parada sobre `routes.json`.
 * Seguros para el cliente: no importan el catálogo editorial.
 */
import { DATASET } from '@/mock/data';
import type {
  LineaDefinition,
  ParadaDefinition,
  RamalDefinition,
  RecorridoDefinition,
} from '@/types/transport';
import { SEEDED_ROUTES } from './seeded-routes';

/** Línea del catálogo del Home (armado en el servidor por `buildLineCatalog`). */
export interface CatalogLine {
  id: string;
  number: string;
  name: string;
  color: string | null;
  textColor: string | null;
  operational: boolean;
}

export interface LineFirstSelection {
  lineId: string;
  ramalId: string;
  recorridoId: string;
  stopId: string;
}

export interface LineFirstContext {
  line: LineaDefinition;
  ramal: RamalDefinition;
  recorrido: RecorridoDefinition;
  stop: ParadaDefinition;
  stops: ParadaDefinition[];
  canSwitchDirection: boolean;
}

type Bounds = [[number, number], [number, number]];

/** Radio del tramo que muestra el mapa preview alrededor de la parada. */
const STOP_AREA_RADIUS_M = 1500;

export function findLine(lineId: string): LineaDefinition | undefined {
  return DATASET.lineas.find((line) => line.id === lineId);
}

export function getStop(stopId: string): ParadaDefinition | undefined {
  return DATASET.paradas[stopId];
}

/** "Parque Centenario / Hospital Durand" → "Parque Centenario". */
export function shortStopName(name: string): string {
  return name.split(' / ')[0]!.replace(/\s*\([^)]*\)\s*$/, '').trim() || name;
}

function oppositeRecorrido(ramal: RamalDefinition, recorrido: RecorridoDefinition): RecorridoDefinition | undefined {
  return ramal.recorridos.find((rec) => rec.id !== recorrido.id && rec.sentido !== recorrido.sentido);
}

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const kx = 111_320 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot((a.lng - b.lng) * kx, (a.lat - b.lat) * 110_540);
}

/** La misma parada si el recorrido la tiene; si no, la más cercana del recorrido. */
function nearestStopIn(recorrido: RecorridoDefinition, stopId: string): string {
  if (recorrido.paradas.includes(stopId)) return stopId;
  const origin = getStop(stopId);
  if (!origin) return recorrido.paradas[0] ?? stopId;
  let best = recorrido.paradas[0] ?? stopId;
  let bestDistance = Infinity;
  for (const candidateId of recorrido.paradas) {
    const candidate = getStop(candidateId);
    if (!candidate) continue;
    const d = distanceM(origin, candidate);
    if (d < bestDistance) {
      bestDistance = d;
      best = candidateId;
    }
  }
  return best;
}

function recorridoForStop(line: LineaDefinition, stopId: string) {
  for (const ramal of line.ramales) {
    const recorrido = ramal.recorridos.find((rec) => rec.paradas.includes(stopId));
    if (recorrido) return { ramal, recorrido };
  }
  return null;
}

/** Selección inicial de una línea: el origen de su primer viaje demo o la parada media. */
export function defaultSelection(lineId: string): LineFirstSelection | null {
  const line = findLine(lineId);
  if (!line) return null;
  const preferredStopId = SEEDED_ROUTES.find((seed) => seed.lineId === lineId)?.originStopId;
  const preferred = preferredStopId ? recorridoForStop(line, preferredStopId) : null;
  if (preferred && preferredStopId) {
    return { lineId, ramalId: preferred.ramal.id, recorridoId: preferred.recorrido.id, stopId: preferredStopId };
  }
  const ramal = line.ramales[0];
  const recorrido = ramal?.recorridos[0];
  const stopId = recorrido?.paradas[Math.floor(recorrido.paradas.length / 2)];
  if (!ramal || !recorrido || !stopId) return null;
  return { lineId, ramalId: ramal.id, recorridoId: recorrido.id, stopId };
}

export function resolveContext(selection: LineFirstSelection | null): LineFirstContext | null {
  if (!selection) return null;
  const line = findLine(selection.lineId);
  const ramal = line?.ramales.find((r) => r.id === selection.ramalId);
  const recorrido = ramal?.recorridos.find((rec) => rec.id === selection.recorridoId);
  const stop = getStop(selection.stopId);
  if (!line || !ramal || !recorrido || !stop) return null;
  return {
    line,
    ramal,
    recorrido,
    stop,
    stops: recorrido.paradas.flatMap((id) => getStop(id) ?? []),
    canSwitchDirection: Boolean(oppositeRecorrido(ramal, recorrido)),
  };
}

/** Ida ↔ vuelta del mismo ramal; la parada salta a la más cercana del otro sentido. */
export function switchDirection(selection: LineFirstSelection): LineFirstSelection {
  const ctx = resolveContext(selection);
  const next = ctx ? oppositeRecorrido(ctx.ramal, ctx.recorrido) : undefined;
  if (!next) return selection;
  return { ...selection, recorridoId: next.id, stopId: nearestStopIn(next, selection.stopId) };
}

/** Cambia de ramal conservando el sentido si existe y la parada más cercana. */
export function switchRamal(selection: LineFirstSelection, ramalId: string): LineFirstSelection {
  const ctx = resolveContext(selection);
  const ramal = ctx?.line.ramales.find((r) => r.id === ramalId);
  if (!ctx || !ramal) return selection;
  const recorrido = ramal.recorridos.find((rec) => rec.sentido === ctx.recorrido.sentido) ?? ramal.recorridos[0];
  if (!recorrido) return selection;
  return { ...selection, ramalId, recorridoId: recorrido.id, stopId: nearestStopIn(recorrido, selection.stopId) };
}

/** Deep link existente de /mapas (?linea&ramal&parada). El ramal solo viaja si la línea tiene varios. */
export function mapHrefFor(ctx: LineFirstContext): string {
  // Serialización manual con orden alfabético para evitar hydration mismatch:
  // URLSearchParams.toString() puede reordenar keys entre Node.js SSR y
  // browser CSR. Mantener keys en orden fijo elimina la divergencia.
  const entries: [string, string][] = [['linea', ctx.line.id]];
  if (ctx.line.ramales.length > 1) entries.push(['ramal', ctx.ramal.id]);
  entries.push(['parada', ctx.stop.id]);
  entries.sort(([a], [b]) => a.localeCompare(b));
  const query = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `/mapas?${query}`;
}

function boundsOf(points: { lat: number; lng: number }[]): Bounds {
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

/** Recorrido completo del sentido elegido (variante B). */
export function routeBounds(ctx: LineFirstContext): Bounds {
  return boundsOf(ctx.recorrido.coordenadas.map(([lng, lat]) => ({ lat, lng })));
}

/** Tramo del recorrido alrededor de la parada (variante A). */
export function stopAreaBounds(ctx: LineFirstContext): Bounds {
  const near = ctx.recorrido.coordenadas
    .map(([lng, lat]) => ({ lat, lng }))
    .filter((point) => distanceM(point, ctx.stop) <= STOP_AREA_RADIUS_M);
  return boundsOf([ctx.stop, ...near]);
}
