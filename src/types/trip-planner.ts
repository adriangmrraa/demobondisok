import { Parada } from "./transport";

export type TripStepType = "walk" | "ride" | "transfer";

export interface LocationPoint {
  id?: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  stopId?: string; // Presente si coincide con una parada de transporte
  isArbitrary?: boolean; // True si es una dirección o coordenada libre
  source?: "text" | "map" | "simulated" | "poi";
  /** Encuadre sugerido (calle/landmark) para fitBounds al elegir el punto. */
  focusBounds?: [[number, number], [number, number]];
}

export interface WalkingLeg {
  type: "walk";
  from: LocationPoint;
  to: LocationPoint;
  distanceMeters: number;
  durationMinutes: number;
  description: string;
  segmentCoordinates?: [number, number][];
}

export interface TransitLeg {
  type: "ride";
  lineaId: string;
  lineaNumero: string;
  lineaColor: string;
  lineaTextColor: string;
  ramalId: string;
  ramalCodigo: string;
  ramalNombre: string;
  recorridoId: string;
  sentido: "ida" | "vuelta";
  fromStop: Parada;
  toStop: Parada;
  intermediateStops: Parada[];
  stopCount: number;
  distanceKm: number;
  durationMinutes: number;
  description: string;
  segmentCoordinates?: [number, number][];
}

export interface TransferLeg {
  type: "transfer";
  fromStop: Parada;
  toStop: Parada;
  walkingDistanceMeters: number;
  durationMinutes: number;
  description: string;
  segmentCoordinates?: [number, number][];
}

export type TripLeg = WalkingLeg | TransitLeg | TransferLeg;

export interface TripSegmentItem {
  id: string;
  type: "walk" | "ride" | "transfer";
  color: string;
  isDashed: boolean;
  coordinates: [number, number][];
}

export interface TripStep {
  id: string;
  type: TripStepType;
  lineaId?: string;
  lineaNumero?: string;
  lineaColor?: string;
  lineaTextColor?: string;
  ramalCodigo?: string;
  ramalNombre?: string;
  fromStopId?: string;
  fromStopName: string;
  toStopId?: string;
  toStopName: string;
  stopCount?: number;
  durationMinutes: number;
  distanceMeters?: number;
  description: string;
  /** Índice en TripOption.legs para tap-to-focus (ausente en pseudo-steps "arrive"). */
  legIndex?: number;
}

export interface TripLineChip {
  id: string;
  numero: string;
  color: string;
  textColor: string;
}

export interface TripOption {
  id: string;
  title: string;
  totalDurationMinutes: number;
  transfersCount: number;
  walkDurationMinutes: number;
  walkDistanceMeters: number;
  transitDurationMinutes: number;
  generalizedCost: number;
  linesInvolved: TripLineChip[];
  legs: TripLeg[];
  steps: TripStep[];
  segments: TripSegmentItem[]; // Geometrías recortadas exactas para MapLibre
  usedStopIds: string[]; // IDs de las paradas efectivamente usadas en el viaje
  highlightLines: string[];
  origin: LocationPoint;
  destination: LocationPoint;
  originStopId?: string;
  destinationStopId?: string;
  originCoords: { lat: number; lng: number };
  destinationCoords: { lat: number; lng: number };
  transferStopCoords?: { lat: number; lng: number; color?: string } | null;
  bounds: [[number, number], [number, number]];
}

export interface TripPlanQuery {
  origin: LocationPoint;
  destination: LocationPoint;
}
