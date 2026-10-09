/**
 * B2 · "Historial de paradas": recorridos demo precargados que ya funcionan
 * sobre los datos existentes (líneas 65 y 194). Cada uno es un viaje
 * origen→destino independiente; un tap lo inicia en el mapa. `lineId` se fija
 * de forma explícita sobre las líneas activas del dataset.
 *
 * El Home "línea primero" también los usa como parada por defecto de cada
 * línea (el origen del primer viaje de esa línea).
 */
export interface SeededRoute {
  id: string;
  originStopId: string;
  destinationStopId: string;
  lineId: string;
}

export const SEEDED_ROUTES: SeededRoute[] = [
  {
    id: 'seed-65-centenario-barrancas',
    originStopId: 'stop-65-05',
    destinationStopId: 'stop-65-09',
    lineId: 'line-65',
  },
  {
    id: 'seed-194-once-escobar',
    originStopId: 'stop-194-once',
    destinationStopId: 'stop-194-escobar-estacion',
    lineId: 'line-194',
  },
  {
    id: 'seed-65-constitucion-barrancas',
    originStopId: 'stop-65-01',
    destinationStopId: 'stop-65-09',
    lineId: 'line-65',
  },
  {
    id: 'seed-194-once-zarate',
    originStopId: 'stop-194-once',
    destinationStopId: 'stop-194-zarate-transferencia',
    lineId: 'line-194',
  },
];
