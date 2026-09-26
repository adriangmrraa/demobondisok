import { ALERTAS_MOCK, LINEAS_MOCK, PARADAS_MOCK, RECORRIDOS_MOCK, VEHICULOS_INICIALES_MOCK, DATASET } from "@/lib/mock/amba-data";
import { MOCK_ROUTES } from "@/mock/data";
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

        const coords = MOCK_ROUTES[lId];
        const track = coords ? getRouteTrack(lId, coords) : null;
        if (!track) return;

        const { alongM: stopAlongM } = track.project(parada.lng, parada.lat);
        const totalLength = track.totalM;

        // Paradas de la línea para conteo de dwells intermedios
        const lineStops = PARADAS_MOCK.filter((p) => p.lineasIds.includes(lId)).map((s) => ({
          id: s.id,
          alongM: track.project(s.lng, s.lat).alongM,
        }));

        // Filtrar y ordenar unidades que se dirigen hacia esta parada
        const lineVehicles = positions
          .filter((p) => p.lineId === lId)
          .map((v) => {
            const { alongM: vehAlongM } = track.project(v.lng, v.lat);
            const distAhead = ((stopAlongM - vehAlongM) % totalLength + totalLength) % totalLength;
            return {
              ...v,
              vehAlongM,
              distAhead,
            };
          })
          .sort((a, b) => a.distAhead - b.distAhead);

        lineVehicles.slice(0, 3).forEach((veh, idx) => {
          const isAtStop = (veh.isDwelling && (veh.currentStopId === parada.id || veh.distAhead <= 25)) || veh.distAhead <= 12;

          let intermediateDwells = 0;
          if (!isAtStop) {
            for (const s of lineStops) {
              const d = ((s.alongM - veh.vehAlongM) % totalLength + totalLength) % totalLength;
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
        return liveLlegadas.sort((a, b) => a.minutos - b.minutos);
      }
    }

    // 2. Fallback determinístico (cuando no hay feed GPS activo)
    const deterministicHash = (str: string): number => {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = (h << 5) - h + str.charCodeAt(i);
        h |= 0;
      }
      return Math.abs(h);
    };

    const llegadas: EstimacionLlegada[] = [];
    parada.lineasIds.forEach((lId) => {
      const linea = LINEAS_MOCK.find((l) => l.id === lId);
      if (!linea) return;

      const seed = deterministicHash(paradaId + lId);
      const baseMin = (seed % 4) + 1;
      const interno1 = "25";
      const interno2 = "48";

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

      llegadas.push({
        lineaId: linea.id,
        lineaNumero: linea.numero,
        colorHex: directionColor,
        ramal: directionRamal,
        minutos: baseMin,
        distanciaMetros: baseMin * 310,
        interno: interno1,
        ocupacion: baseMin <= 2 ? "alta" : "media",
        displayStatus: baseMin <= 1 ? "en-parada" : baseMin <= 2 ? "arribando" : "minutos",
        displayLabel: baseMin <= 1 ? "En parada" : baseMin <= 2 ? "Arribando" : `${baseMin} min`,
      });

      if (linea.frecuenciaPicoMin > 0) {
        llegadas.push({
          lineaId: linea.id,
          lineaNumero: linea.numero,
          colorHex: directionColor,
          ramal: directionRamal,
          minutos: baseMin + linea.frecuenciaPicoMin,
          distanciaMetros: (baseMin + linea.frecuenciaPicoMin) * 310,
          interno: interno2,
          ocupacion: "baja",
          displayStatus: "minutos",
          displayLabel: `${baseMin + linea.frecuenciaPicoMin} min`,
        });
      }
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
