/**
 * Dataset de zonas AMBA para la vista "Red Metro" del bottom nav.
 *
 * Mapea zonas geográficas del Área Metropolitana de Buenos Aires a las
 * líneas de colectivo de Metropol que las atraviesan, más algunas
 * paradas cabeceras de ejemplo (de `metropol.json`).
 *
 * NO es un dataset GIS exhaustivo. Es un mapeo conceptual derivado
 * de los `summary` de cada línea (origen → destino) en
 * `src/data/metropol.json`. Suficiente para un demo navegable.
 *
 * Estructura por zona:
 *  - id, name, type ('CABA' | 'GBA'), description corta
 *  - lineIds: IDs de líneas que pasan (referencian a MOCK_LINES del
 *    dataset dinámico de routes.json)
 *  - headerStops: nombres de paradas cabeceras representativas
 */

import { MOCK_LINES } from '@/mock/data';

export type ZonaType = 'CABA' | 'GBA_NORTE' | 'GBA_OESTE' | 'GBA_SUR' | 'GBA_ESTE' | 'INTERIOR';

export interface Zona {
  id: string;
  name: string;
  type: ZonaType;
  description: string;
  /** IDs de línea que pasan por la zona (de routes.json). */
  lineIds: string[];
  /** Nombres de paradas cabeceras representativas. */
  headerStops: string[];
}

export const ZONAS_AMBA: Zona[] = [
  {
    id: 'caba-centro',
    name: 'Centro / Constitución',
    type: 'CABA',
    description: 'Casco histórico, Plaza Constitución, área de transbordo principal.',
    lineIds: ['line-65'],
    headerStops: ['Plaza Constitución', 'Estación Constitución', 'Hospital Garraham'],
  },
  {
    id: 'caba-caballito',
    name: 'Caballito / Flores',
    type: 'CABA',
    description: 'Barrios residenciales del centro-oeste, Av. Rivadavia.',
    lineIds: ['line-136'],
    headerStops: ['Estación Primera Junta, Caballito', 'Estación Flores', 'Estación Floresta'],
  },
  {
    id: 'caba-belgrano',
    name: 'Belgrano / Núñez',
    type: 'CABA',
    description: 'Barrio chino, Av. Cabildo, Barrancas de Belgrano.',
    lineIds: ['line-65'],
    headerStops: ['Barrancas de Belgrano', 'Barrio Chino Estación', 'Av. Cabildo y Juramento'],
  },
  {
    id: 'gba-oeste',
    name: 'GBA Oeste',
    type: 'GBA_OESTE',
    description: 'Merlo, Moreno, Ituzaingó, Marcos Paz. Av. Rivadavia y Ruta 40.',
    lineIds: ['line-136'],
    headerStops: ['Estación Merlo', 'Estación Ituzaingó', 'Estación Marcos Paz'],
  },
  {
    id: 'gba-norte',
    name: 'Pilar / Escobar / Zárate',
    type: 'GBA_NORTE',
    description: 'Panamericana y Ruta 8/9. Centros comerciales y barrios cerrados.',
    lineIds: ['line-194'],
    headerStops: ['Panamericana y Paraná', 'Estación Escobar', 'Estación Zárate'],
  },
  {
    id: 'gba-sur',
    name: 'Avellaneda / Quilmes',
    type: 'GBA_SUR',
    description: 'Sur del GBA, conexión CABA por Av. Mitre / Av. Hipólito Yrigoyen.',
    lineIds: ['line-195'],
    headerStops: ['Estación Avellaneda', 'Estación Quilmes', 'Estación Berazategui'],
  },
];

/** Devuelve el subset de MOCK_LINES que están en una zona. */
export function lineasEnZona(zona: Zona) {
  return MOCK_LINES.filter((line) => zona.lineIds.includes(line.id));
}
