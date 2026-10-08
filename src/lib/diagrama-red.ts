/**
 * Plano esquemático de la red — builder puro.
 *
 * Traduce el dataset calibrado (routes.json) a un diagrama tipo subte:
 * cada línea es un trazo suavizado por anchors curados y sus paradas
 * significativas se distribuyen a intervalos iguales por longitud de arco
 * (convención clásica de mapas esquemáticos: legibilidad > geografía).
 *
 * Solo se dibujan líneas operativas (65 y 194). La 194 se representa por
 * su ramal troncal (ramal A, Once → Zárate); el detalle por línea lista
 * el resto de ramales. Las paradas compartidas entre líneas se dibujan
 * como estaciones de intercambio (capsule) en el punto donde los trazos
 * se encuentran.
 */

import { DATASET } from '@/lib/mock/amba-data';
import { combinacionesDeParadaId, type Combinacion } from './combinaciones';

// ─── Tipos públicos ────────────────────────────────────────────────────

export interface SchematicPoint {
  x: number;
  y: number;
}

export type LabelSide = 'left' | 'right';

export interface SchematicNode extends SchematicPoint {
  stopId: string;
  nombre: string;
  labelSide: LabelSide;
  isCabecera: boolean;
  /** Combinaciones de la parada (chips de subte/tren/metrobus). */
  conexiones: Combinacion[];
}

export interface SchematicLine {
  lineId: string;
  numero: string;
  color: string;
  textColor: string;
  /** path `d` suavizado (Catmull-Rom → Bézier) del trazo. */
  pathD: string;
  nodes: SchematicNode[];
  /** Punto donde va el chip del número de línea (puede ir offset del trazo). */
  chipPoint: SchematicPoint;
}

export interface SchematicInterchange extends SchematicPoint {
  stopId: string;
  nombre: string;
  labelSide: LabelSide;
  conexiones: Combinacion[];
  /** Números de las líneas que se combinan acá (["65","194"]). */
  lineaNumeros: string[];
  /** Colores de esas líneas, para los ticks de la capsule. */
  lineaColores: string[];
}

export interface NetworkSchematic {
  viewBox: { width: number; height: number };
  lines: SchematicLine[];
  interchanges: SchematicInterchange[];
  /** Y del divisor esquemático CABA ↔ GBA (solo guía visual). */
  zonaDividerY: number;
}

// ─── Geometría ─────────────────────────────────────────────────────────

function smoothPath(points: SchematicPoint[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Punto sobre la polilínea `anchors` a la fracción `t` (0..1) de su longitud. */
function pointAtFraction(anchors: SchematicPoint[], t: number): SchematicPoint {
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < anchors.length - 1; i++) {
    const len = Math.hypot(anchors[i + 1].x - anchors[i].x, anchors[i + 1].y - anchors[i].y);
    segs.push(len);
    total += len;
  }
  let target = total * Math.min(1, Math.max(0, t));
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const f = segs[i] === 0 ? 0 : target / segs[i];
      return {
        x: anchors[i].x + (anchors[i + 1].x - anchors[i].x) * f,
        y: anchors[i].y + (anchors[i + 1].y - anchors[i].y) * f,
      };
    }
    target -= segs[i];
  }
  return anchors[anchors.length - 1];
}

// ─── Definición curada del esquema ─────────────────────────────────────

interface NodeDef {
  stopId: string;
  /** Label corto para el plano (el nombre completo va en el detalle). */
  label?: string;
  labelSide?: LabelSide;
}

interface LineDef {
  lineId: string;
  anchors: SchematicPoint[];
  nodes: NodeDef[];
  /** Fracción del trazo donde se dibuja el chip con el número. */
  chipT: number;
  /** Offset del chip respecto del trazo (para caer en espacio libre). */
  chipDx?: number;
  chipDy?: number;
}

const VIEW_W = 360;
const VIEW_H = 624;

/**
 * Línea 194 (ramal troncal): Plaza Miserere → Zárate.
 * Sube por el corredor norte; el límite CABA/GBA cae ~Puente Saavedra.
 */
const LINE_194: LineDef = {
  lineId: 'line-194',
  chipT: 0.715,
  anchors: [
    { x: 108, y: 584 },
    { x: 120, y: 548 },
    { x: 118, y: 508 },
    { x: 106, y: 468 },
    { x: 94, y: 430 },
    { x: 86, y: 394 },
    { x: 88, y: 358 },
    { x: 104, y: 330 },
    { x: 130, y: 296 },
    { x: 164, y: 262 },
    { x: 198, y: 230 },
    { x: 224, y: 194 },
    { x: 240, y: 148 },
    { x: 256, y: 98 },
    { x: 286, y: 54 },
  ],
  nodes: [
    { stopId: 'stop-194-once', label: 'Plaza Miserere', labelSide: 'left' },
    { stopId: 'stop-194-pueyrredon-corrientes', label: 'Pueyrredón y Corrientes', labelSide: 'left' },
    { stopId: 'stop-194-pueyrredon-santafe', label: 'Pueyrredón y Santa Fe', labelSide: 'left' },
    { stopId: 'stop-194-plaza-italia', label: 'Plaza Italia', labelSide: 'left' },
    { stopId: 'stop-194-pacifico', label: 'Pacífico', labelSide: 'left' },
    { stopId: 'stop-194-cabildo-carranza', label: 'Cabildo/Carranza', labelSide: 'left' },
    { stopId: 'stop-65-11' }, // intercambio (posición la define el punto de encuentro)
    { stopId: 'stop-194-cabildo-congreso', label: 'Cabildo y Congreso', labelSide: 'left' },
    { stopId: 'stop-194-puente-saavedra', labelSide: 'right' },
    { stopId: 'stop-194-panamericana-parana', label: 'Panamericana y Paraná', labelSide: 'right' },
    { stopId: 'stop-194-escobar-estacion', label: 'Estación Escobar', labelSide: 'right' },
    { stopId: 'stop-194-campana-centro', label: 'Campana Centro', labelSide: 'left' },
    { stopId: 'stop-194-zarate-transferencia', label: 'Terminal Zárate', labelSide: 'left' },
  ],
};

/**
 * Línea 65: Constitución → Barrancas de Belgrano, y el tramo de Cabildo
 * (sentido vuelta) que la conecta con la 194 en Av. Cabildo y Juramento.
 * El último anchor lo inyecta el builder con la posición del intercambio.
 */
const LINE_65_ANCHORS: SchematicPoint[] = [
  { x: 300, y: 560 },
  { x: 270, y: 538 },
  { x: 244, y: 512 },
  { x: 224, y: 484 },
  { x: 205, y: 454 },
  { x: 186, y: 424 },
  { x: 167, y: 394 },
  { x: 150, y: 366 },
];

const LINE_65_NODES: NodeDef[] = [
  { stopId: 'stop-65-01', label: 'Plaza Constitución', labelSide: 'left' },
  { stopId: 'stop-65-02', labelSide: 'right' },
  { stopId: 'stop-65-03', label: 'Hospital Muñiz', labelSide: 'right' },
  { stopId: 'stop-65-04', labelSide: 'right' },
  { stopId: 'stop-65-05', label: 'Parque Centenario', labelSide: 'right' },
  { stopId: 'stop-65-06', labelSide: 'right' },
  { stopId: 'stop-65-07', label: 'Corrientes y Scalabrini', labelSide: 'right' },
  { stopId: 'stop-65-08', label: 'Chacarita / Est. Lacroze', labelSide: 'right' },
  { stopId: 'stop-65-09', label: 'Barrancas de Belgrano', labelSide: 'right' },
  { stopId: 'stop-65-11' }, // intercambio (término del trazo)
];

/** Intercambio 65 ↔ 194: índice del nodo compartido dentro de la lista de la 194. */
const INTERCHANGE_STOP_ID = 'stop-65-11';
const INTERCHANGE_194_INDEX = LINE_194.nodes.findIndex((n) => n.stopId === INTERCHANGE_STOP_ID);

// ─── Builder ───────────────────────────────────────────────────────────

function lineaDef(lineId: string) {
  return DATASET.lineas.find((l) => l.id === lineId);
}

function cabeceraIds(lineId: string): Set<string> {
  const recorrido = lineaDef(lineId)?.ramales[0]?.recorridos[0];
  if (!recorrido || recorrido.paradas.length === 0) return new Set();
  return new Set([recorrido.paradas[0], recorrido.paradas[recorrido.paradas.length - 1]]);
}

function buildLine(def: Omit<LineDef, 'anchors'> & { anchors: SchematicPoint[] }): SchematicLine {
  const linea = lineaDef(def.lineId);
  const cabeceras = cabeceraIds(def.lineId);
  const lastNode = def.nodes.length - 1;
  const nodes = def.nodes.map((node, i) => {
    const pt = pointAtFraction(def.anchors, lastNode === 0 ? 0 : i / lastNode);
    const parada = DATASET.paradas[node.stopId];
    return {
      stopId: node.stopId,
      nombre: node.label ?? parada?.nombre ?? node.stopId,
      x: pt.x,
      y: pt.y,
      labelSide: node.labelSide ?? 'right',
      isCabecera: cabeceras.has(node.stopId),
      conexiones: combinacionesDeParadaId(node.stopId),
    };
  });
  const chipBase = pointAtFraction(def.anchors, def.chipT);
  return {
    lineId: def.lineId,
    numero: linea?.numero ?? def.lineId,
    color: linea?.color ?? '#1D2B4F',
    textColor: linea?.textColor ?? '#FFFFFF',
    pathD: smoothPath(def.anchors),
    nodes,
    chipPoint: { x: chipBase.x + (def.chipDx ?? 0), y: chipBase.y + (def.chipDy ?? 0) },
  };
}

/**
 * Construye el esquema de la red con las líneas operativas (65 y 194).
 * Solo incluye líneas definidas en LINE_DEFS — nunca simula cobertura.
 */
export function buildNetworkSchematic(): NetworkSchematic {
  // 1) La 194 define la posición del intercambio (nodo compartido).
  const line194 = buildLine(LINE_194);
  const interchangePoint = line194.nodes[INTERCHANGE_194_INDEX];

  // 2) La 65 termina su trazo exactamente en el punto del intercambio.
  const line65 = buildLine({
    lineId: 'line-65',
    chipT: 0.5,
    chipDx: -19,
    anchors: [...LINE_65_ANCHORS, { x: interchangePoint.x, y: interchangePoint.y }],
    nodes: LINE_65_NODES,
  });

  const interchanges: SchematicInterchange[] = [
    {
      stopId: interchangePoint.stopId,
      nombre: interchangePoint.nombre,
      x: interchangePoint.x,
      y: interchangePoint.y,
      labelSide: 'right',
      conexiones: interchangePoint.conexiones,
      lineaNumeros: [line65.numero, line194.numero],
      lineaColores: [line65.color, line194.color],
    },
  ];

  // Divisor CABA/GBA a la altura de Puente Saavedra (límite real de la ciudad).
  const saavedraIdx = LINE_194.nodes.findIndex((n) => n.stopId === 'stop-194-puente-saavedra');
  const zonaDividerY = saavedraIdx >= 0 ? line194.nodes[saavedraIdx].y - 18 : 320;

  // Los nodos de intercambio no se dibujan por línea: van en `interchanges`.
  for (const line of [line194, line65]) {
    line.nodes = line.nodes.filter((n) => n.stopId !== INTERCHANGE_STOP_ID);
  }

  return {
    viewBox: { width: VIEW_W, height: VIEW_H },
    lines: [line65, line194],
    interchanges,
    zonaDividerY,
  };
}
