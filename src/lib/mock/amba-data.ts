import { AlertaServicio, Linea, Parada, Recorrido, VehiculoEnVivo, TransportNetworkDataset } from "@/types/transport";
import rawDataset from "@/data/routes.json";

export const DATASET = rawDataset as unknown as TransportNetworkDataset;

/**
 * Dataset AMBA — Red de Transporte Metropol (Líneas 65 y 194)
 * - Línea 65: Constitución – Barrancas de Belgrano (Circuito 36.06 km, 24 unidades, frec 5 min)
 * - Línea 194: Once – Zárate / Escobar / Campana / Plaza Italia / Retiro (6 ramales, frec pico 5 min)
 */

export const LINEAS_MOCK: Linea[] = DATASET.lineas.map((l) => ({
  id: l.id,
  numero: l.numero,
  nombre: l.nombre,
  empresa: l.empresa,
  colorHex: l.color,
  textColorHex: l.textColor,
  estado: "normal",
  frecuenciaPicoMin: l.frecuenciaPicoMin,
  mensajeEstado: l.mensajeEstado || `Servicio regular con frecuencia de ${l.frecuenciaPicoMin} min.`,
  ramales: l.ramales.map((r) => r.nombre),
  ramalesDetalle: l.ramales,
}));

// ─── Paradas Oficiales Calibradas al Eje de Calzada ───────────────────
export const PARADAS_MOCK: Parada[] = Object.values(DATASET.paradas).map((p) => {
  const lineasIds = DATASET.lineas
    .filter((l) =>
      l.ramales.some((r) =>
        r.recorridos.some((rec) => rec.paradas.includes(p.id))
      )
    )
    .map((l) => l.id);

  return {
    id: p.id,
    nombre: p.nombre,
    direccion: p.direccion || p.nombre,
    lat: p.lat,
    lng: p.lng,
    lineasIds: lineasIds.length > 0 ? lineasIds : (p.id.startsWith("stop-65") ? ["line-65"] : ["line-194"]),
    conexiones: p.conexiones,
  };
});

// ─── Recorridos Oficiales por Ramal ───────────────────────────────────
export const RECORRIDOS_MOCK: Recorrido[] = DATASET.lineas.flatMap((l) =>
  l.ramales.flatMap((r) =>
    r.recorridos.map((rec) => ({
      id: rec.id,
      lineaId: l.id,
      ramalId: r.id,
      ramal: `${r.nombre} (${rec.sentido === "ida" ? "Ida" : "Vuelta"})`,
      sentido: rec.sentido,
      origen: rec.origen,
      destino: rec.destino,
      descripcion: rec.descripcion,
      distanciaKm: rec.distanciaKm,
      paradasIds: rec.paradas,
      coordenadas: rec.coordenadas,
    }))
  )
);

// ─── Flota Inicial de Vehículos en Tiempo Real ────────────────────────
const UNIDADES_65 = [
  "18", "20", "25", "28", "34", "39", "42", "45",
  "48", "51", "55", "58", "62", "65", "71", "74",
  "78", "82", "85", "89", "92", "95", "98", "101"
];

const UNIDADES_194 = [
  // Ramal H (Expreso Once - Escobar)
  "201", "203", "205", "207", "210", "212", "215", "218",
  // Ramal A (Común Once - Zárate)
  "102", "105", "108", "112", "115", "120",
  // Ramal B (Común Once - Escobar)
  "302", "305", "308", "312",
  // Ramal D (Expreso Zárate Directo RN 9)
  "401", "404", "407",
  // Ramal F (Expreso Plaza Italia - Escobar)
  "502", "505", "508",
  // Ramal I (Diferencial Retiro - Zárate)
  "601", "603"
];

const paradas65 = PARADAS_MOCK.filter((p) => p.lineasIds.includes("line-65"));
const paradas194 = PARADAS_MOCK.filter((p) => p.lineasIds.includes("line-194"));

const vehiculos65: VehiculoEnVivo[] = UNIDADES_65.map((interno, idx) => {
  const stopTarget = paradas65[idx % paradas65.length]!;
  return {
    id: `veh-65-${interno}`,
    lineaId: "line-65",
    interno,
    lat: stopTarget.lat,
    lng: stopTarget.lng,
    bearing: 160,
    velocidadKmH: 19,
    sentido: idx < 12 ? "ida" : "vuelta",
    proximaParadaId: stopTarget.id,
    retrasoMinutos: 0,
    ocupacion: idx % 3 === 0 ? "alta" : idx % 2 === 0 ? "media" : "baja",
  };
});

const vehiculos194: VehiculoEnVivo[] = UNIDADES_194.map((interno, idx) => {
  const stopTarget = paradas194[idx % paradas194.length]!;
  return {
    id: `veh-194-${interno}`,
    lineaId: "line-194",
    interno,
    lat: stopTarget.lat,
    lng: stopTarget.lng,
    bearing: 330,
    velocidadKmH: 45,
    sentido: idx % 2 === 0 ? "ida" : "vuelta",
    proximaParadaId: stopTarget.id,
    retrasoMinutos: 0,
    ocupacion: idx % 3 === 0 ? "alta" : idx % 2 === 0 ? "media" : "baja",
  };
});

export const VEHICULOS_INICIALES_MOCK: VehiculoEnVivo[] = [...vehiculos65, ...vehiculos194];

// ─── Alertas de Servicio ──────────────────────────────────────────────
export const ALERTAS_MOCK: AlertaServicio[] = [
  {
    id: "alert-65-001",
    lineaId: "line-65",
    lineaNumero: "65",
    tipo: "informativo",
    titulo: "Frecuencia en tiempo real: 5 min",
    descripcion: "La Línea 65 cuenta con 24 unidades monitoreadas en vivo en ambos sentidos.",
    fechaHora: "08:00",
    afectaRamal: "Troncal Constitución - Barrancas",
    severidad: "amber",
    estado: "activa",
  },
  {
    id: "alert-194-001",
    lineaId: "line-194",
    lineaNumero: "194",
    tipo: "informativo",
    titulo: "Línea 194 Operando con Frecuencia Expreso",
    descripcion: "Ramal H (Once – Escobar) operando con 5 min de frecuencia pico. Ramales Zárate directos por RN 9 normales.",
    fechaHora: "07:30",
    afectaRamal: "Corredor Panamericana / RN 9",
    severidad: "amber",
    estado: "activa",
  },
];
