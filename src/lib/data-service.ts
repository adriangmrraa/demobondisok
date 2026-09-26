/**
 * Data Service Domain Contracts
 * Contratos de datos para el motor de mapas, simulación GPS y UI Shell.
 */

export interface VehiclePosition {
  lineId: string;
  ramalId?: string;
  unitId: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  timestamp: number;
  isDwelling?: boolean;
  dwellRemainingSeconds?: number;
  currentStopId?: string | null;
  direction?: 'ida' | 'vuelta';
}

export interface Line {
  id: string;
  name: string;
  shortName: string;
  color: string;
  direction: string;
  frequency: number;
}

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lineIds: string[];
}

export interface Alert {
  id: string;
  lineId: string;
  type: 'delay' | 'suspension' | 'route_change';
  status?: 'active' | 'resolved';
  title: string;
  description: string;
  severity: 'amber' | 'red' | 'gray';
  timestamp: number;
  since?: string;
}

export type Unsubscribe = () => void;
