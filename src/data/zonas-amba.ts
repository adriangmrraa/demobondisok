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
    name: 'Microcentro / Puerto Madero',
    type: 'CABA',
    description: 'Casco histórico, Puerto Madero, área de transbordo principal (Subte B/C/D/E).',
    lineIds: ['line-65', 'line-109', 'line-151', 'line-195'],
    headerStops: ['Plaza Constitución', 'Correo Central', 'Retiro'],
  },
  {
    id: 'caba-caballito',
    name: 'Caballito / Flores',
    type: 'CABA',
    description: 'Barrios residenciales del centro-oeste, Av. Rivadavia (Subte A).',
    lineIds: ['line-136', 'line-151', 'line-163', 'line-181'],
    headerStops: ['Plaza Primera Junta, Caballito', 'Plaza Miserere (Once)', 'Estación Flores'],
  },
  {
    id: 'caba-belgrano',
    name: 'Belgrano / Núñez / Colegiales',
    type: 'CABA',
    description: 'Av. Cabildo, Barrio Chino, Barrancas de Belgrano (Subte D + Metrobús).',
    lineIds: ['line-65', 'line-151', 'line-365'],
    headerStops: ['Barrancas de Belgrano', 'Colegiales', 'Puente Saavedra'],
  },
  {
    id: 'caba-villa-crespo',
    name: 'Villa Crespo / Almagro',
    type: 'CABA',
    description: 'Av. Corrientes, Av. Córdoba. Conexión clave Subte B y tren San Martín.',
    lineIds: ['line-109', 'line-151', 'line-176'],
    headerStops: ['Villa Crespo', 'Facultad de Medicina', 'Estación Almagro'],
  },
  {
    id: 'gba-oeste',
    name: 'GBA Oeste (Merlo / Moreno / Ituzaingó)',
    type: 'GBA_OESTE',
    description: 'Corredor oeste por Av. Rivadavia y Ruta 40. Conexión a Sarmiento.',
    lineIds: ['line-136', 'line-163', 'line-181'],
    headerStops: ['Estación Merlo', 'Estación Ituzaingó', 'Estación Marcos Paz'],
  },
  {
    id: 'gba-norte',
    name: 'Norte AMBA (Pilar / Escobar / Zárate / Luján)',
    type: 'GBA_NORTE',
    description: 'Panamericana, Ruta 8 y Ruta 9. Barrios cerrados y cabeceras metropolitanas.',
    lineIds: ['line-194', 'line-176', 'line-365'],
    headerStops: ['Panamericana y Paraná', 'Estación Escobar', 'Estación Zárate', 'Luján'],
  },
  {
    id: 'gba-sur',
    name: 'Sur GBA (Avellaneda / Quilmes / La Plata)',
    type: 'GBA_SUR',
    description: 'Corredor sur por Av. Mitre / Hipólito Yrigoyen hasta La Plata.',
    lineIds: ['line-195'],
    headerStops: ['Dock Sud', 'Hudson', 'City Bell', 'La Plata'],
  },
];

/** Devuelve el subset de MOCK_LINES que están en una zona. */
export function lineasEnZona(zona: Zona) {
  return MOCK_LINES.filter((line) => zona.lineIds.includes(line.id));
}
