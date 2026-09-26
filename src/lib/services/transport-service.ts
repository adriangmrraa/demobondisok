import { ALERTAS_MOCK, LINEAS_MOCK, PARADAS_MOCK, RECORRIDOS_MOCK, VEHICULOS_INICIALES_MOCK, DATASET } from "@/lib/mock/amba-data";
import { MOCK_ROUTES } from "@/mock/data";
import { getRamalForUnit } from "@/mock/live";
import { getRouteTrack } from "@/lib/map/route-progress";
import type { VehiclePosition } from "@/lib/data-service";
import {
  AlertaServicio,
  EstimacionLlegada,
  Linea,
  Parada,
  Recorrido,
  VehiculoEnVivo,
  Line,
  Stop,
  Route,
  Vehicle,
  ServiceAlert,
  Arrival,
} from "@/types/transport";

export interface IDataService {
  getLineas(): Linea[];
  getLineaById(id: string): Linea | undefined;
  getParadas(lineaId?: string): Parada[];
  getRecorrido(lineaId: string): Recorrido | undefined;
  getRecorridosByLinea(lineaId: string): Recorrido[];
  getLlegadas(paradaId: string, positions?: VehiclePosition[]): EstimacionLlegada[];
  getVehiculos(lineaId?: string): VehiculoEnVivo[];
  getAlertas(lineaId?: string): AlertaServicio[];
}

// ─── W1: fidelidad de ETA por ramal ────────────────────────────────────────
// Una unidad física circula sobre la traza de SU ramal, no sobre la traza por
// defecto de la línea. Proyectar toda la flota de la 194 sobre `MOCK_ROUTES['line-194']`
// (geometría del ramal A) hacía que unidades físicamente en Zárate "envolvieran"
// a ≈0 en Once y se reportaran como "En parada". Ver sdd/eta-boarding-fidelity.

/** Ventana de dwell existente: dentro de ±25 m la parada no se considera pasada. */
const EPS_PASS_M = 25;

/** Ramal efectivo de una unidad: ramal vivo → derivado por interno → línea. */
function resolveRamalId(lineId: string, unitId: string, ramalId?: string): string {
  return ramalId || getRamalForUnit(lineId, unitId) || lineId;
}

/** Línea de rizo (circuito): un único ramal ⇒ se conserva la aritmética módulo. */
function isLoopLine(lineId: string): boolean {
  const linea = DATASET.lineas.find((l) => l.id === lineId);
  return (linea?.ramales.length ?? 0) === 1;
}

/** ¿La traza del ramal contiene la parada? (membresía por `recorrido.paradas`) */
function ramalServesStop(lineId: string, ramalId: string, stopId: string): boolean {
  const linea = DATASET.lineas.find((l) => l.id === lineId);
  const ramal = linea?.ramales.find((r) => r.id === ramalId);
  if (!ramal) return false;
  return ramal.recorridos.some((rec) => rec.paradas.includes(stopId));
}

/** Candidato de arribo: posición viva + su proyección sobre la traza del ramal. */
interface RamalCandidate extends VehiclePosition {
  vehAlongM: number;
  distAhead: number;
  totalLength: number;
  lineStops: { id: string; alongM: number }[];
}

// ─── W2′: frecuencia simulada ──────────────────────────────────────────────
// La flota curada es REAL y está CONGELADA. Cuando es genuinamente rala (p. ej.
// la 194: 30 unidades para 93 km), la lista de abordaje queda por debajo del tope
// de 3 filas por línea. Se COMPLETA con ETAs SINTÉTICOS derivados ÚNICAMENTE de la
// `frecuenciaPicoMin` curada: la próxima salida teórica es una frecuencia entera
// después. No se inventa densidad; no se lee reloj de pared (determinista).
// Ver sdd/eta-boarding-fidelity (W2′).

/**
 * Generador ÚNICO de arribos sintéticos. Lo usan tanto la rama viva (relleno por
 * línea) como el fallback sin GPS (§2), para evitar dos generadores divergentes.
 *
 * @param anchorMin ETA de referencia de la línea en la parada (0 si hay unidad "en parada").
 * @param count     Cuántas filas sintéticas agregar (tope: 3 − reales).
 * @param blocked   Minutos ya presentes en la parada (colisión cross-línea); se muta.
 * @param ctx       Ramal (texto de dirección) y color ya resueltos por la línea.
 */
function buildSimulatedArrivals(
  linea: Linea,
  anchorMin: number,
  count: number,
  blocked: Set<number>,
  ctx: { ramal: string; colorHex: string },
): EstimacionLlegada[] {
  const step = linea.frecuenciaPicoMin > 0 ? linea.frecuenciaPicoMin : 5;
  const rows: EstimacionLlegada[] = [];
  for (let k = 0; k < count; k++) {
    let v = anchorMin + step * (k + 1);
    // Colisión a nivel parada: correr una frecuencia hasta obtener un ETA único.
    while (blocked.has(v)) v += step;
    blocked.add(v);
    rows.push({
      lineaId: linea.id,
      lineaNumero: linea.numero,
      colorHex: ctx.colorHex,
      ramal: ctx.ramal,
      minutos: v,
      distanciaMetros: v * 310,
      interno: `SIM-${linea.id}-${k + 1}`,
      ocupacion: "baja",
      displayStatus: "minutos",
      displayLabel: `${v} min`,
      simulated: true,
    });
  }
  return rows;
}

/**
 * Post-proceso de la rama viva: (a) colapsa filas "agrupadas en la parada"
 * (stop-level, cross-línea) conservando la PRIMERA en orden de emisión
 * (`parada.lineasIds`) y (b) completa hasta el tope de 3 filas por línea con el
 * generador sintético. Sólo completa líneas con 1..2 filas reales: una línea sin
 * unidades (parada vacía) nunca se fabrica.
 */
function completeBoardingOptions(rows: EstimacionLlegada[], parada: Parada): EstimacionLlegada[] {
  const byLine = new Map<string, EstimacionLlegada[]>();
  for (const r of rows) {
    const bucket = byLine.get(r.lineaId);
    if (bucket) bucket.push(r);
    else byLine.set(r.lineaId, [r]);
  }

  // Orden de emisión = `parada.lineasIds` (el resto, si lo hubiera, al final).
  const order: string[] = parada.lineasIds.filter((id) => byLine.has(id));
  for (const id of byLine.keys()) {
    if (!order.includes(id)) order.push(id);
  }

  // (a) Colapso stop-level: la primera fila "en parada" se conserva; el resto cae.
  const collapsed = new Set<EstimacionLlegada>();
  let keptAtStop = false;
  for (const lineId of order) {
    for (const r of byLine.get(lineId)!) {
      if (r.displayStatus !== "en-parada") continue;
      if (!keptAtStop) keptAtStop = true;
      else collapsed.add(r);
    }
  }

  // Minutos ya presentes en la parada (todas las líneas) → anti-colisión.
  const blocked = new Set<number>();
  for (const r of rows) blocked.add(r.minutos);

  const out: EstimacionLlegada[] = [];
  for (const lineId of order) {
    const lineRows = byLine.get(lineId)!;
    const linea = LINEAS_MOCK.find((l) => l.id === lineId);
    const kept = lineRows.filter((r) => !collapsed.has(r));
    if (!linea || kept.length === 0) {
      // Línea desconocida o sin unidades: jamás fabricar arribos.
      out.push(...kept);
      continue;
    }

    out.push(...kept);
    const missing = 3 - kept.length;
    if (missing > 0) {
      // Anchor = fila real más cercana de la línea en la parada (0 si está en parada).
      const anchorMin = Math.min(...lineRows.map((r) => r.minutos));
      out.push(
        ...buildSimulatedArrivals(linea, anchorMin, missing, blocked, {
          ramal: kept[0].ramal,
          colorHex: kept[0].colorHex,
        }),
      );
    }
  }

  return out;
}

export class TransportService implements IDataService {
  public getLineas(): Linea[] {
    return LINEAS_MOCK;
  }

  public getLineaById(id: string): Linea | undefined {
    return LINEAS_MOCK.find((l) => l.id === id || l.numero === id);
  }

  public getParadas(lineaId?: string, ramalId?: string): Parada[] {
    if (!lineaId) return PARADAS_MOCK;
    if (ramalId) {
      const linea = LINEAS_MOCK.find((l) => l.id === lineaId);
      const ramal = linea?.ramalesDetalle?.find((r) => r.id === ramalId);
      if (ramal) {
        const stopIds = new Set(ramal.recorridos.flatMap((rec) => rec.paradas));
        return PARADAS_MOCK.filter((p) => stopIds.has(p.id));
      }
    }
    return PARADAS_MOCK.filter((p) => p.lineasIds.includes(lineaId));
  }

  public getRecorrido(lineaId: string): Recorrido | undefined {
    return RECORRIDOS_MOCK.find((r) => r.lineaId === lineaId);
  }

  public getRecorridosByLinea(lineaId: string): Recorrido[] {
    return RECORRIDOS_MOCK.filter((r) => r.lineaId === lineaId);
  }

  public getVehiculos(lineaId?: string): VehiculoEnVivo[] {
    if (!lineaId) return VEHICULOS_INICIALES_MOCK;
    return VEHICULOS_INICIALES_MOCK.filter((v) => v.lineaId === lineaId);
  }

  public getAlertas(lineaId?: string): AlertaServicio[] {
    if (!lineaId) return ALERTAS_MOCK;
    return ALERTAS_MOCK.filter((a) => a.lineaId === lineaId);
  }

  public getLlegadas(paradaId: string, positions?: VehiclePosition[]): EstimacionLlegada[] {
    const parada = PARADAS_MOCK.find((p) => p.id === paradaId);
    if (!parada) return [];

    // 1. Si disponemos de telemetría GPS viva, calcular arribos reales sincronizados con el mapa
    if (positions && positions.length > 0) {
      const liveLlegadas: EstimacionLlegada[] = [];

      parada.lineasIds.forEach((lId) => {
        const linea = LINEAS_MOCK.find((l) => l.id === lId);
        if (!linea) return;

        const loop = isLoopLine(lId);

        // W1: agrupar las unidades de la línea por su ramal EFECTIVO.
        const byRamal = new Map<string, VehiclePosition[]>();
        for (const p of positions) {
          if (p.lineId !== lId) continue;
          const rid = resolveRamalId(p.lineId, p.unitId, p.ramalId);
          const bucket = byRamal.get(rid);
          if (bucket) bucket.push(p);
          else byRamal.set(rid, [p]);
        }

        const candidates: RamalCandidate[] = [];

        for (const [ramalId, units] of byRamal) {
          // En líneas lineales sólo el ramal que sirve la parada puede aportar arribos.
          if (!loop && !ramalServesStop(lId, ramalId, parada.id)) continue;

          const coords = MOCK_ROUTES[ramalId] ?? MOCK_ROUTES[lId];
          const track = coords ? getRouteTrack(ramalId, coords) : null;
          if (!track) continue;

          const { alongM: stopAlongM } = track.project(parada.lng, parada.lat);
          const totalLength = track.totalM;

          // Paradas del ramal para conteo de dwells intermedios
          const lineStops = PARADAS_MOCK.filter((p) => p.lineasIds.includes(lId)).map((s) => ({
            id: s.id,
            alongM: track.project(s.lng, s.lat).alongM,
          }));

          for (const v of units) {
            const { alongM: vehAlongM } = track.project(v.lng, v.lat);
            // Loop: módulo (byte-idéntico a 65/60). Lineal: delta sin envolver,
            // para que una unidad en el extremo opuesto a la parada (delta == totalM)
            // no colapse a 0 y se reporte como "En parada".
            const delta = stopAlongM - vehAlongM;
            if (!loop && delta < -EPS_PASS_M) continue;
            const distAhead = loop
              ? ((delta % totalLength) + totalLength) % totalLength
              : delta;
            candidates.push({ ...v, vehAlongM, distAhead, totalLength, lineStops });
          }
        }

        candidates
          .sort((a, b) => a.distAhead - b.distAhead)
          .slice(0, 3)
          .forEach((veh) => {
            const isAtStop = (veh.isDwelling && (veh.currentStopId === parada.id || veh.distAhead <= 25)) || veh.distAhead <= 12;

            let intermediateDwells = 0;
            if (!isAtStop) {
              for (const s of veh.lineStops) {
                const d = ((s.alongM - veh.vehAlongM) % veh.totalLength + veh.totalLength) % veh.totalLength;
                if (d > 20 && d < veh.distAhead - 20) {
                  intermediateDwells += 20;
                }
              }
            }

            const speedMps = 19 / 3.6; // ~5.28 m/s
            const dwellAhead = veh.isDwelling ? (veh.dwellRemainingSeconds ?? 0) : 0;
            const etaSeconds = isAtStop ? 0 : Math.round(veh.distAhead / speedMps + intermediateDwells + dwellAhead);
            const etaMin = Math.ceil(etaSeconds / 60);

            let displayStatus: "en-parada" | "arribando" | "minutos";
            let displayLabel: string;

            if (isAtStop || etaSeconds <= 60) {
              displayStatus = "en-parada";
              displayLabel = "En parada";
            } else if (etaSeconds <= 120) {
              displayStatus = "arribando";
              displayLabel = "Arribando";
            } else {
              displayStatus = "minutos";
              displayLabel = `${etaMin} min`;
            }

            // P2-8: Derivar sentido desde datos, no por string-matching de IDs.
            // Prioridad: 1) direction del vehículo vivo, 2) ramal del vehículo,
            // 3) recorridos del dataset que contienen la parada.
            let isVuelta = veh.direction === "vuelta";
            let directionRamal = "";
            if (veh.ramalId) {
              const lineaData = DATASET.lineas.find((l) => l.id === linea.id);
              const ramalData = lineaData?.ramales.find((r) => r.id === veh.ramalId);
              const recData = ramalData?.recorridos.find((r) => r.paradas.includes(parada.id));
              if (recData) {
                isVuelta = recData.sentido === "vuelta";
                directionRamal = `${recData.origen} → ${recData.destino}`;
              }
            }
            if (!directionRamal) {
              directionRamal = isVuelta ? 'Barrancas → Constitución' : 'Constitución → Barrancas';
            }
            const directionColor = isVuelta ? '#EF4444' : '#0EA5E9';

            liveLlegadas.push({
              lineaId: linea.id,
              lineaNumero: linea.numero,
              colorHex: directionColor,
              ramal: directionRamal,
              minutos: isAtStop ? 0 : etaMin,
              distanciaMetros: Math.round(veh.distAhead),
              interno: veh.unitId,
              ocupacion: isAtStop ? "alta" : etaMin <= 3 ? "media" : "baja",
              displayStatus,
              displayLabel,
            });
          });
      });

      if (liveLlegadas.length > 0) {
        // W2′: colapsar agrupadas + completar líneas ralas (tope 3), luego ordenar.
        return completeBoardingOptions(liveLlegadas, parada).sort(
          (a, b) => a.minutos - b.minutos,
        );
      }
    }

    // 2. Fallback determinístico (cuando no hay feed GPS activo).
    // Delega en el MISMO generador sintético para no tener dos fuentes divergentes.
    const llegadas: EstimacionLlegada[] = [];
    const blockedFb = new Set<number>();
    parada.lineasIds.forEach((lId) => {
      const linea = LINEAS_MOCK.find((l) => l.id === lId);
      if (!linea) return;

      // P2-8 (fallback sin GPS): derivar del dataset.
      const lineaDataFb = DATASET.lineas.find((l) => l.id === linea.id);
      const recFb = lineaDataFb?.ramales
        .flatMap((r) => r.recorridos)
        .find((r) => r.paradas.includes(paradaId));
      const isVuelta = recFb?.sentido === "vuelta";
      const directionColor = isVuelta ? '#EF4444' : '#0EA5E9';
      const directionRamal = recFb
        ? `${recFb.origen} → ${recFb.destino}`
        : (isVuelta ? 'Barrancas → Constitución' : 'Constitución → Barrancas');

      llegadas.push(
        ...buildSimulatedArrivals(linea, 0, 2, blockedFb, {
          ramal: directionRamal,
          colorHex: directionColor,
        }),
      );
    });

    return llegadas.sort((a, b) => a.minutos - b.minutos);
  }

  // --- Aliases estáticos y de compatibilidad ---

  public static getLines(): Line[] {
    return LINEAS_MOCK;
  }

  public static getLine(id: string): Line | undefined {
    return LINEAS_MOCK.find((l) => l.id === id || l.numero === id);
  }

  public static getRoute(lineId: string): Route | undefined {
    return RECORRIDOS_MOCK.find((r) => r.lineaId === lineId);
  }

  public static getStops(lineId?: string): Stop[] {
    if (!lineId) return PARADAS_MOCK;
    return PARADAS_MOCK.filter((p) => p.lineasIds.includes(lineId));
  }

  public static getVehicles(lineId?: string): Vehicle[] {
    if (!lineId) return VEHICULOS_INICIALES_MOCK;
    return VEHICULOS_INICIALES_MOCK.filter((v) => v.lineaId === lineId);
  }

  public static getServiceAlerts(lineId?: string): ServiceAlert[] {
    if (!lineId) return ALERTAS_MOCK;
    return ALERTAS_MOCK.filter((a) => a.lineaId === lineId);
  }

  public static getArrivals(stopId: string, positions?: VehiclePosition[]): Arrival[] {
    return new TransportService().getLlegadas(stopId, positions);
  }

  public static getLineas(): Linea[] {
    return LINEAS_MOCK;
  }

  public static getLineaById(id: string): Linea | undefined {
    return LINEAS_MOCK.find((l) => l.id === id || l.numero === id);
  }

  public static getParadas(): Parada[] {
    return PARADAS_MOCK;
  }

  public static getParadasByLinea(lineaId: string): Parada[] {
    return PARADAS_MOCK.filter((p) => p.lineasIds.includes(lineaId));
  }

  public static getRecorridosByLinea(lineaId: string): Recorrido[] {
    return RECORRIDOS_MOCK.filter((r) => r.lineaId === lineaId);
  }

  public static getRamalesByLinea(lineaId: string) {
    const linea = LINEAS_MOCK.find((l) => l.id === lineaId);
    return linea?.ramalesDetalle ?? [];
  }

  public static getAlertas(): AlertaServicio[] {
    return ALERTAS_MOCK;
  }

  public static getAlertasByLinea(lineaId: string): AlertaServicio[] {
    return ALERTAS_MOCK.filter((a) => a.lineaId === lineaId);
  }

  public static getVehiculosIniciales(): VehiculoEnVivo[] {
    return VEHICULOS_INICIALES_MOCK;
  }

  public static getLlegadasPorParada(paradaId: string, positions?: VehiclePosition[]): EstimacionLlegada[] {
    return new TransportService().getLlegadas(paradaId, positions);
  }
}

export const transportService = new TransportService();
