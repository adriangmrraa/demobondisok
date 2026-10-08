/**
 * Helpers compartidos para detectar combinaciones de transporte
 * (tren / subte) en una parada por el nombre de la parada.
 *
 * Usado por el Diagrama de líneas (vista esquema) y por el
 * JourneyTimeline (modo viaje) para mostrar los badges de
 * "Combiná con [tren/subte]" en paradas relevantes.
 *
 * Limitación: la detección es heurística sobre el nombre. Un
 * dataset con campo explícito (transbordo: 'roca' | 'mitre' |
 * 'subte-A' | ...) sería más preciso.
 */

import { DATASET } from '@/lib/mock/amba-data';
import type { ParadaDefinition } from '@/types/transport';

export type CombinacionMode = 'tren' | 'subte' | 'metrobus';

export interface Combinacion {
  id: string;
  label: string;
  color: string;
  mode: CombinacionMode;
  /** Sentido por default (Norte, Sur, Constitución, etc.). */
  sentidoDefault: string;
}

interface CombinacionDef extends Combinacion {
  /** Regex que matchea el nombre de la parada (case-insensitive). */
  match: RegExp;
}

const TREN_LINES: CombinacionDef[] = [
  { id: 'roca', label: 'Roca', color: '#1D4ED8', mode: 'tren', sentidoDefault: 'Constitución', match: /\broca\b/i },
  { id: 'mitre', label: 'Mitre', color: '#7C3AED', mode: 'tren', sentidoDefault: 'Retiro', match: /\bmitre\b|\bff ?cc\b/i },
  { id: 'sarmiento', label: 'Sarmiento', color: '#0EA5E9', mode: 'tren', sentidoDefault: 'Once', match: /\bsarmiento\b/i },
  { id: 'sanmartin', label: 'San Martín', color: '#10B981', mode: 'tren', sentidoDefault: 'Retiro', match: /san mart[ií]n/i },
  { id: 'belgranonorte', label: 'Belgrano Norte', color: '#F59E0B', mode: 'tren', sentidoDefault: 'Retiro', match: /belgrano norte/i },
  { id: 'belgranosur', label: 'Belgrano Sur', color: '#22C55E', mode: 'tren', sentidoDefault: 'Constitución', match: /belgrano sur/i },
  { id: 'urquiza', label: 'Urquiza', color: '#A855F7', mode: 'tren', sentidoDefault: 'Retiro', match: /urquiza/i },
];

const SUBTE_LINES: CombinacionDef[] = [
  { id: 'A', label: 'Subte A', color: '#3B82F6', mode: 'subte', sentidoDefault: 'Plaza de Mayo', match: /subte\s*a\b/i },
  { id: 'B', label: 'Subte B', color: '#EF4444', mode: 'subte', sentidoDefault: 'Leandro N. Alem', match: /subte\s*b\b/i },
  { id: 'C', label: 'Subte C', color: '#0EA5E9', mode: 'subte', sentidoDefault: 'Constitución', match: /subte\s*c\b/i },
  { id: 'D', label: 'Subte D', color: '#10B981', mode: 'subte', sentidoDefault: 'Catedral', match: /subte\s*d\b/i },
  { id: 'E', label: 'Subte E', color: '#8B5CF6', mode: 'subte', sentidoDefault: 'Bolívar', match: /subte\s*e\b/i },
  { id: 'H', label: 'Subte H', color: '#FCD34D', mode: 'subte', sentidoDefault: 'Hospitales', match: /subte\s*h\b/i },
];

/** Devuelve las combinaciones detectadas en una parada por su nombre. */
export function combinacionesDeParada(nombre: string): Combinacion[] {
  const lower = nombre.toLowerCase();
  const out: Combinacion[] = [];
  for (const def of TREN_LINES) {
    if (def.match.test(lower)) {
      out.push({ id: def.id, label: def.label, color: def.color, mode: def.mode, sentidoDefault: def.sentidoDefault });
    }
  }
  for (const def of SUBTE_LINES) {
    if (def.match.test(lower)) {
      out.push({ id: def.id, label: def.label, color: def.color, mode: def.mode, sentidoDefault: def.sentidoDefault });
    }
  }
  return out;
}

// ─── Lookup estructurado por id de parada (dataset routes.json) ────────

const METROBUS_DEF: Combinacion = {
  id: 'metrobus',
  label: 'Metrobus',
  color: '#DC2626',
  mode: 'metrobus',
  sentidoDefault: '',
};

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const TREN_BY_LABEL = new Map(TREN_LINES.map((d) => [normalize(d.label), d]));
const SUBTE_BY_ID = new Map(SUBTE_LINES.map((d) => [d.id, d]));

const toCombinacion = (def: CombinacionDef): Combinacion => ({
  id: def.id,
  label: def.label,
  color: def.color,
  mode: def.mode,
  sentidoDefault: def.sentidoDefault,
});

function combinacionesDesdeConexiones(conexiones: ParadaDefinition['conexiones']): Combinacion[] {
  const out: Combinacion[] = [];
  for (const subte of conexiones?.subte ?? []) {
    const def = SUBTE_BY_ID.get(subte.toUpperCase());
    if (def) out.push(toCombinacion(def));
  }
  for (const tren of conexiones?.tren ?? []) {
    const def = TREN_BY_LABEL.get(normalize(tren));
    if (def) out.push(toCombinacion(def));
  }
  if (conexiones?.metrobus) out.push({ ...METROBUS_DEF });
  return out;
}

/**
 * Combinaciones de una parada del dataset por su `stopId` (stop-65-01, ...).
 * Usa el campo estructurado `conexiones` (subte/tren/metrobus) y cae al
 * matcheo por nombre si el dataset no declara nada.
 */
export function combinacionesDeParadaId(stopId: string): Combinacion[] {
  const def = DATASET.paradas[stopId];
  if (!def) return [];
  const estructuradas = combinacionesDesdeConexiones(def.conexiones);
  return estructuradas.length > 0 ? estructuradas : combinacionesDeParada(def.nombre);
}
