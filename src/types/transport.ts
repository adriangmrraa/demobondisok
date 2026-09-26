/**
 * Contratos de dominio de Transporte para la maqueta AMBA.
 * Cumple con docs/fase implementacion oficial transportes.txt y docs/skill-maqueta-oficial.txt
 */

export type EstadoLinea = "normal" | "demoras" | "interrumpido";

export interface CoordenadaGPS {
  lat: number;
  lng: number;
}

export type GpsCoordinate = [number, number]; // [lng, lat] para GeoJSON / MapLibre

export interface ParadaDefinition {
  id: string;
  nombre: string;
  direccion?: string;
  lat: number;
  lng: number;
  conexiones?: {
    subte?: string[];
    tren?: string[];
    metrobus?: boolean;
  };
}

export interface RecorridoDefinition {
  id: string;
  sentido: "ida" | "vuelta";
  origen: string;
  destino: string;
  descripcion?: string;
  distanciaKm: number;
  color?: string;
  paradas: string[];
  coordenadas: [number, number][];
}

export interface RamalDefinition {
  id: string;
  codigo: string;
  nombre: string;
  cabeceraOrigen: string;
  cabeceraDestino: string;
  color: string;
  textColor?: string;
  recorridos: RecorridoDefinition[];
}

export interface LineaDefinition {
  id: string;
  numero: string;
  nombre: string;
  empresa: string;
  color: string;
  textColor: string;
  frecuenciaPicoMin: number;
  mensajeEstado?: string;
  ramales: RamalDefinition[];
}

export interface TransportNetworkDataset {
  version: string;
  updatedAt?: string;
  descripcion?: string;
  paradas: Record<string, ParadaDefinition>;
  lineas: LineaDefinition[];
}

export interface Ramal {
  id: string;
  nombre: string;
  codigo?: string;
  color?: string;
  textColor?: string;
  cabeceraOrigen?: string;
  cabeceraDestino?: string;
  sentido?: "ida" | "vuelta";
  recorridos?: Recorrido[];
}

export interface Linea {
  id: string;
  numero: string;
  nombre: string;
  empresa: string;
  colorHex: string;
  textColorHex: string;
  estado: EstadoLinea;
  mensajeEstado?: string;
  frecuenciaPicoMin: number;
  ramales: string[];
  ramalesDetalle?: RamalDefinition[];
}

// Alias de dominio en inglés conforme a skill-maqueta-oficial.txt
export type Line = Linea;

export interface Parada {
  id: string;
  nombre: string;
  direccion: string;
  lat: number;
  lng: number;
  lineasIds: string[];
  conexiones?: {
    subte?: string[];
    metrobus?: boolean;
    tren?: string[];
  };
}

export type Stop = Parada;

export interface Recorrido {
  id: string;
  lineaId: string;
  ramal: string;
  ramalId?: string;
  sentido: "ida" | "vuelta";
  origen?: string;
  destino?: string;
  descripcion?: string;
  distanciaKm?: number;
  paradasIds?: string[];
  coordenadas: [number, number][]; // [lng, lat] GeoJSON coordinates
}

export type Route = Recorrido;

export interface VehiculoEnVivo {
  id: string;
  lineaId: string;
  ramalId?: string;
  interno: string;
  lat: number;
  lng: number;
  bearing: number; // Rumbo en grados (0-360)
  velocidadKmH: number;
  sentido: "ida" | "vuelta";
  proximaParadaId: string;
  retrasoMinutos: number;
  ocupacion: "baja" | "media" | "alta";
}

export type Vehicle = VehiculoEnVivo;

export type TipoAlerta = "demora" | "corte" | "desvio" | "informativo";

export interface AlertaServicio {
  id: string;
  lineaId: string;
  lineaNumero: string;
  tipo: TipoAlerta;
  titulo: string;
  descripcion: string;
  fechaHora: string;
  afectaRamal?: string;
  severidad?: "amber" | "red" | "gray";
  estado?: "activa" | "resuelta";
}

export type ServiceAlert = AlertaServicio;

export interface EstimacionLlegada {
  lineaId: string;
  lineaNumero: string;
  colorHex: string;
  ramal: string;
  minutos: number;
  distanciaMetros: number;
  interno: string;
  ocupacion: "baja" | "media" | "alta";
  displayStatus?: "en-parada" | "arribando" | "minutos";
  displayLabel?: string;
}

export type Arrival = EstimacionLlegada;
