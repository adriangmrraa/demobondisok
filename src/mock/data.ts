/**
 * Mock Data — Red de Transporte AMBA Calibrada
 * Línea 65 (Constitución – Barrancas de Belgrano) y Línea 194 (La Nueva Metropol / Chevallier).
 * Alimentado directamente por el dataset dimensional de @/data/routes.json (v2.0).
 */

import type { Line, Stop, Alert } from '@/lib/data-service';
import type { TransportNetworkDataset } from '@/types/transport';
import rawDataset from '@/data/routes.json';

export const DATASET = rawDataset as unknown as TransportNetworkDataset;

// ─── Rutas (Geometrías extraídas del dataset) ───────────────────────────
const extractedRoutes: Record<string, [number, number][]> = {};

for (const linea of DATASET.lineas) {
  for (const ramal of linea.ramales) {
    // Clave de ramal por defecto (primer recorrido del ramal)
    if (ramal.recorridos[0]) {
      extractedRoutes[ramal.id] = ramal.recorridos[0].coordenadas;
    }
    for (const rec of ramal.recorridos) {
      extractedRoutes[rec.id] = rec.coordenadas;
    }
  }
  // Clave de línea por defecto (primer recorrido del primer ramal)
  if (linea.ramales[0]?.recorridos[0]) {
    extractedRoutes[linea.id] = linea.ramales[0].recorridos[0].coordenadas;
  }
}

// Mantener compatibilidad con claves canónicas
export const MOCK_ROUTES: Record<string, [number, number][]> = {
  ...extractedRoutes,
  'line-65': extractedRoutes['line-65-ida'] || extractedRoutes['line-65'] || [],
  'line-194': extractedRoutes['line-194-a-ida'] || extractedRoutes['line-194'] || [],
};

// ─── Colores por Dirección y Ramal ─────────────────────────────────────
export const ROUTE_COLORS_BY_DIRECTION = {
  ida: {
    color: '#0284C7', // Azul Cerúleo
    colorLight: '#7DD3FC',
  },
  vuelta: {
    color: '#EA580C', // Naranja Intenso
    colorLight: '#FDBA74',
  },
};

export const RAMAL_COLORS: Record<string, string> = {
  'ramal-60-a': '#7C3AED',
  'ramal-65-troncal': '#0284C7',
  'ramal-194-a': '#06B6D4',
  'ramal-194-b': '#A855F7',
  'ramal-194-d': '#10B981',
  'ramal-194-e': '#84CC16',
  'ramal-194-f': '#3B82F6',
  'ramal-194-g': '#14B8A6',
  'ramal-194-h': '#6366F1',
  'ramal-194-i': '#EF4444',
};

// ─── Líneas Oficiales del Sistema ──────────────────────────────────────
export const MOCK_LINES: Line[] = DATASET.lineas.map((l) => ({
  id: l.id,
  name: l.nombre,
  shortName: l.numero,
  color: l.color,
  direction: l.ramales[0]?.nombre || l.nombre,
  frequency: l.frecuenciaPicoMin,
}));

// ─── Paradas Oficiales Calibradas ─────────────────────────────────────
export const MOCK_STOPS: Stop[] = Object.values(DATASET.paradas).map((p) => {
  // Calcular las líneas que pasan por esta parada
  const lineIds = DATASET.lineas
    .filter((l) =>
      l.ramales.some((r) =>
        r.recorridos.some((rec) => rec.paradas.includes(p.id))
      )
    )
    .map((l) => l.id);

  return {
    id: p.id,
    name: p.nombre,
    lat: p.lat,
    lng: p.lng,
    lineIds: lineIds.length > 0 ? lineIds : (p.id.startsWith('stop-65') ? ['line-65'] : ['line-194']),
  };
});

// ─── Secuencias Ordenadas de Paradas ──────────────────────────────────
export const MOCK_LINE_STOPS: Record<string, string[]> = {};

// Registrar por línea (combinando paradas únicas del ramal principal)
for (const linea of DATASET.lineas) {
  const principalRamal = linea.ramales[0];
  if (principalRamal) {
    const stopsSet = new Set<string>();
    principalRamal.recorridos.forEach((rec) => rec.paradas.forEach((pId) => stopsSet.add(pId)));
    MOCK_LINE_STOPS[linea.id] = Array.from(stopsSet);
  }
  // Registrar por cada ramal y recorrido
  for (const ramal of linea.ramales) {
    const ramalStops = new Set<string>();
    ramal.recorridos.forEach((rec) => {
      MOCK_LINE_STOPS[rec.id] = rec.paradas;
      rec.paradas.forEach((pId) => ramalStops.add(pId));
    });
    MOCK_LINE_STOPS[ramal.id] = Array.from(ramalStops);
  }
}

// ─── Flota Oficial de Unidades Activas ─────────────────────────────────
export const MOCK_UNITS: Record<string, string[]> = {
  'line-65': [
    '18', '20', '25', '28', '34', '39', '42', '45',
    '48', '51', '55', '58', '62', '65', '71', '74',
    '78', '82', '85', '89', '92', '95', '98', '101',
  ],
  'line-194': [
    // Ramal A (Once - Zárate Común x RP 6)
    '102', '105', '108', '112', '115', '120',
    // Ramal B (Once - Escobar Común)
    '302', '305', '308', '312',
    // Ramal D (Expreso Zárate Directo RN 9)
    '401', '404', '407',
    // Ramal E (Expreso Reconvertido Once - Zárate)
    '451', '454',
    // Ramal F (Expreso Plaza Italia - Escobar)
    '502', '505', '508',
    // Ramal G (Expreso Reconvertido Once - Zárate)
    '471', '474',
    // Ramal H (Once - Escobar Expreso Reconvertido)
    '201', '203', '205', '207', '210', '212', '215', '218',
    // Ramal I (Diferencial Retiro - Zárate)
    '601', '603'
  ],
  // sdd/trip-options-upgrade 1.2: 3rd-line data-only sim (corredor 65, DATASET-driven)
  'line-60': ['701', '703', '705'],
};

// ─── Alertas Oficiales de Servicio ────────────────────────────────────
export const MOCK_ALERTS: Alert[] = [
  {
    id: 'alert-65-001',
    lineId: 'line-65',
    type: 'delay',
    title: 'Operación Normal con Frecuencia de 5 min',
    description: 'Servicio regular La Nueva Metropol S.A. en ambos sentidos (Constitución - Barrancas).',
    severity: 'amber',
    timestamp: Date.now() - 1000 * 60 * 10,
    since: '08:00',
  },
  {
    id: 'alert-194-001',
    lineId: 'line-194',
    type: 'route_change',
    title: 'Servicio Expreso y Común en Operación',
    description: 'Línea 194 operando con 6 ramales activos en corredor Panamericana y Ruta 9.',
    severity: 'amber',
    timestamp: Date.now() - 1000 * 60 * 5,
    since: '05:00',
  },
];
