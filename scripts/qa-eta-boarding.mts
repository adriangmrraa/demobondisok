/**
 * QA determinista del ETA de abordaje.
 *
 * SDD `eta-boarding-fidelity` · Commit C1 (fundación: harness + baseline congelado).
 *
 * Objetivo: capturar la línea base ANTES de tocar la rama viva de `getLlegadas`
 * para poder probar, fila por fila, que W1 (proyección por ramal) no cambia la 65
 * y que W2′ (frecuencia simulada) completa las paradas densas de la 194.
 *
 * Uso:
 *   npx --yes tsx scripts/qa-eta-boarding.mts            # reporte (siempre imprime)
 *   npx --yes tsx scripts/qa-eta-boarding.mts --expect   # además aserta el baseline
 *
 * Características:
 * - Ejercita la rama VIVA de `getLlegadas` pasando posiciones reales de la flota
 *   simulada (no el fallback sin GPS). La flota se inicializa con un único tick
 *   síncrono de `subscribeToPositions` y se desuscribe enseguida.
 * - Determinista: no lee reloj de pared; misma entrada → misma salida.
 * - Sale con código ≠ 0 si una aserción falla (modo `--expect`).
 */

import { subscribeToPositions, getCurrentPositions, getRamalForUnit } from "@/mock/live";
import { MOCK_UNITS } from "@/mock/data";
import { TransportService } from "@/lib/services/transport-service";
import { buildBoardingOptions, type BoardingOptionRow } from "@/lib/services/trip-boarding-options";
import { TripPlannerService } from "@/lib/services/trip-planner-service";
import type { VehiclePosition } from "@/lib/data-service";
import type { EstimacionLlegada } from "@/types/transport";

const EXPECT = process.argv.includes("--expect");

// ─── Flota simulada: un único tick síncrono, luego se corta el intervalo ────
// getCurrentPositions() devuelve el fleet module-level SOLO después de que
// subscribeToPositions lo inicialice; el primer tick es síncrono.
const ALL_LINE_IDS = Object.keys(MOCK_UNITS);

function snapshotFleet(): VehiclePosition[] {
  const unsubscribe = subscribeToPositions(ALL_LINE_IDS, () => {});
  try {
    return getCurrentPositions();
  } finally {
    unsubscribe();
  }
}

const positions = snapshotFleet();

// ─── Paradas de referencia ──────────────────────────────────────────────────

const REFERENCE_STOPS = [
  "stop-65-05",
  "stop-65-01",
  "stop-65-09",
  "stop-194-once",
  "stop-194-escobar-estacion",
  "stop-194-zarate-transferencia",
] as const;

// ─── Semillas de "Historial de paradas" (B2) ────────────────────────────────

interface SeedRoute {
  id: string;
  boardingStopId: string;
  destinationStopId: string;
  lineId: string;
}

const SEEDS: SeedRoute[] = [
  {
    id: "seed-65-centenario-barrancas",
    boardingStopId: "stop-65-05",
    destinationStopId: "stop-65-09",
    lineId: "line-65",
  },
  {
    id: "seed-65-constitucion-barrancas",
    boardingStopId: "stop-65-01",
    destinationStopId: "stop-65-09",
    lineId: "line-65",
  },
  {
    id: "seed-194-once-escobar",
    boardingStopId: "stop-194-once",
    destinationStopId: "stop-194-escobar-estacion",
    lineId: "line-194",
  },
  {
    id: "seed-194-once-zarate",
    boardingStopId: "stop-194-once",
    destinationStopId: "stop-194-zarate-transferencia",
    lineId: "line-194",
  },
];

// ─── Top-3 congelado que el mapa mostraría por semilla (diseño W2′) ──────────
// `buildBoardingOptions` no se toca: deriva del orden same-nearest / same-late /
// other-line sobre las llegadas de la parada de subida.

const SEED_EXPECT: Record<string, number[]> = {
  "seed-65-centenario-barrancas": [3, 5, 8],
  "seed-65-constitucion-barrancas": [0, 3, 6],
  "seed-194-once-escobar": [0, 5, 23],
  "seed-194-once-zarate": [0, 5, 23],
};

// ─── Formato y lectura de llegadas ──────────────────────────────────────────

function ramalTag(lineId: string, interno: string): string {
  const ramalId = getRamalForUnit(lineId, interno);
  return ramalId ? ramalId.replace(/^ramal-(?:65|194)-/, "") : "-";
}

function labelOf(a: EstimacionLlegada): string {
  return a.displayLabel ?? `${a.minutos} min`;
}

function formatArrival(a: EstimacionLlegada): string {
  return `${a.interno}[${ramalTag(a.lineaId, a.interno)}] = ${labelOf(a)}`;
}

function byMinutes(a: EstimacionLlegada, b: EstimacionLlegada): number {
  return a.minutos - b.minutos;
}

/** Rama viva: posiciones reales de la flota simulada. */
function liveArrivals(stopId: string): EstimacionLlegada[] {
  return [...TransportService.getArrivals(stopId, positions)].sort(byMinutes);
}

/** Sin posiciones → `getLlegadas` cae deliberadamente al generador §2 (sin GPS). */
function fallbackArrivals(stopId: string): EstimacionLlegada[] {
  return [...TransportService.getArrivals(stopId)].sort(byMinutes);
}

/**
 * El fallback sin GPS (§2) emite SÓLO filas sintéticas (`simulated:true`). La
 * rama viva, en cambio, siempre parte de al menos una unidad real por parada
 * servida. Si TODAS las filas son sintéticas, sospechamos del fallback.
 */
function looksLikeFallback(rows: EstimacionLlegada[]): boolean {
  return rows.length > 0 && rows.every((a) => a.simulated === true);
}

/** Confirma que la parada se resolvió por la rama viva, no por el fallback. */
function livePathExercised(stopId: string): boolean {
  const live = liveArrivals(stopId);
  if (positions.length === 0 || live.length === 0) return false;
  if (looksLikeFallback(live)) return false;
  return JSON.stringify(live) !== JSON.stringify(fallbackArrivals(stopId));
}

/** Top-3 que mostraría el mapa: mismo camino que `mapas/page.tsx`. */
function seedBoardingRows(seed: SeedRoute): BoardingOptionRow[] {
  const arrivals = TransportService.getLlegadasPorParada(seed.boardingStopId, positions);
  const trip =
    TripPlannerService.planTrip(seed.boardingStopId, seed.destinationStopId).find((option) =>
      option.legs.some(
        (leg) =>
          leg.type === "ride" &&
          leg.lineaId === seed.lineId &&
          leg.fromStop.id === seed.boardingStopId,
      ),
    ) ?? null;
  return buildBoardingOptions(trip, arrivals);
}

// ─── Baseline congelado (t = 0) ─────────────────────────────────────────────
// W1 (proyección por ramal, `203a6f6`) fijó los 194 sin fantasma. W2′ (frecuencia
// simulada) RE-CONGELA las paradas donde el colapso stop-level + el relleno
// sintético cambian la lista. La 65 (`stop-65-05`) DEBE quedar byte-idéntica.
// Valores del diseño W2′ (DATA-FROZEN). Si el motor rinde otro número, el
// harness falla y NO se fuerzan los valores: se reporta la discrepancia.
//
// NOTA DE FIDELIDAD: la línea base real difiere de los valores estimados en el
// brief SDD. Motivos verificados:
//   - `stop-65-05`/`stop-65-01` son paradas de la 65 → 3 filas (la línea 60 se
//     eliminó del dataset; antes aportaba otras 3 unidades al mismo stop).
//   - `stop-194-once` sólo es servida por `line-194` y cada línea aporta como
//     máximo 3 (`slice(0,3)`), por lo que un "5× En parada" es inalcanzable.
// Se congela lo medido, que es determinista y reproducible.

interface FrozenStop {
  stopId: string;
  minutos: number[];
  labels: string[];
  note: string;
}

const FROZEN_BASELINE: FrozenStop[] = [
  {
    stopId: "stop-65-05",
    minutos: [3, 5, 8],
    labels: ["3 min", "5 min", "8 min"],
    note: "HARD FREEZE · 3×line-65 (baja de la línea 60; flota solo 65/194); W2′ no lo toca (ninguna línea es rala)",
  },
  {
    stopId: "stop-65-01",
    minutos: [0, 3, 6],
    labels: ["En parada", "3 min", "6 min"],
    note: "18 en parada · 101/98 proyectados (sin colapso 701: la línea 60 no existe en el dataset)",
  },
  {
    stopId: "stop-65-09",
    minutos: [0, 3, 6],
    labels: ["En parada", "3 min", "6 min"],
    note: "idéntica a stop-65-01 · misma flota 65, sin bump anti-colisión de la 60",
  },
  {
    stopId: "stop-194-once",
    minutos: [0, 5, 23],
    labels: ["En parada", "5 min", "23 min"],
    note: "302[b] bunched → SIM 5 (frecuencia 5) · 102[a] real conservada",
  },
  {
    stopId: "stop-194-escobar-estacion",
    minutos: [0, 5, 19],
    labels: ["En parada", "5 min", "19 min"],
    note: "502[f] bunched → SIM 5 (frecuencia 5) · 201[h] real conservada",
  },
  {
    stopId: "stop-194-zarate-transferencia",
    minutos: [0, 5, 10],
    labels: ["En parada", "5 min", "10 min"],
    note: "601[i] conservada; 471[g]→SIM 5 y 401[d]→SIM 10 (frecuencia 5)",
  },
];

// ─── Reporte ────────────────────────────────────────────────────────────────

let failures = 0;

function fail(message: string): void {
  failures++;
  console.error(`✗ ${message}`);
}

console.log("ETA boarding QA — baseline snapshot (t = 0, determinista)");
console.log(`fleet: ${positions.length} posiciones · líneas: ${ALL_LINE_IDS.join(", ")}`);
console.log("");

console.log("── Paradas de referencia (rama viva de getLlegadas) ──────────");
for (const stopId of REFERENCE_STOPS) {
  const live = liveArrivals(stopId);
  const liveOk = livePathExercised(stopId);
  console.log(`${stopId}  [${liveOk ? "live" : "FALLBACK?"}]`);
  if (live.length === 0) {
    console.log("  (sin llegadas)");
  } else {
    for (const a of live) console.log(`  ${formatArrival(a)}`);
  }
  if (!liveOk) fail(`${stopId}: la rama viva no se ejerció (posible fallback sin GPS)`);
}
console.log("");

console.log("── Semillas Historial: top-3 que mostraría el mapa ──────────");
for (const seed of SEEDS) {
  const rows = seedBoardingRows(seed);
  console.log(`${seed.id}  parada=${seed.boardingStopId} línea=${seed.lineId}`);
  if (rows.length === 0) {
    console.log("  (sin opciones)");
  } else {
    rows.forEach((row, idx) => {
      console.log(
        `  #${idx + 1} ${row.interno}[${ramalTag(row.lineaId, row.interno)}] = ${row.displayLabel} (${row.kind})`,
      );
    });
  }
}
console.log("");

// ─── Aserciones del baseline (modo --expect) ────────────────────────────────

if (EXPECT) {
  console.log("── Aserciones (--expect) ────────────────────────────────────");
  for (const frozen of FROZEN_BASELINE) {
    const live = liveArrivals(frozen.stopId);
    const minutos = live.map((a) => a.minutos);
    const labels = live.map(labelOf);
    const okMin = JSON.stringify(minutos) === JSON.stringify(frozen.minutos);
    const okLbl = JSON.stringify(labels) === JSON.stringify(frozen.labels);
    if (okMin && okLbl) {
      console.log(`✓ ${frozen.stopId} = ${frozen.labels.join(" | ")} · ${frozen.note}`);
    } else {
      fail(
        `${frozen.stopId}\n     esperado minutos=${JSON.stringify(frozen.minutos)} labels=${JSON.stringify(frozen.labels)}` +
          `\n     obtenido minutos=${JSON.stringify(minutos)} labels=${JSON.stringify(labels)}`,
      );
    }
  }

  // Invariante stop-level: a lo sumo UNA fila "En parada" por parada.
  for (const frozen of FROZEN_BASELINE) {
    const atStop = liveArrivals(frozen.stopId).filter(
      (a) => a.displayStatus === "en-parada",
    ).length;
    if (atStop <= 1) {
      console.log(`✓ ${frozen.stopId} · ≤1 fila "En parada" (${atStop})`);
    } else {
      fail(`${frozen.stopId}: ${atStop} filas "En parada" (se esperaba ≤1 tras el colapso)`);
    }
  }

  // Top-3 de las 4 semillas Historial (mismo camino que `mapas/page.tsx`).
  for (const seed of SEEDS) {
    const minutos = seedBoardingRows(seed).map((r) => r.etaMin);
    const expected = SEED_EXPECT[seed.id];
    if (JSON.stringify(minutos) === JSON.stringify(expected)) {
      console.log(`✓ ${seed.id} top-3 = ${minutos.join(" / ")}`);
    } else {
      fail(
        `${seed.id} top-3\n     esperado=${JSON.stringify(expected)}\n     obtenido=${JSON.stringify(minutos)}`,
      );
    }
  }

  // Determinismo: dos lecturas consecutivas → byte-idénticas (sin reloj de pared).
  const detA = REFERENCE_STOPS.map((s) => JSON.stringify(liveArrivals(s))).join("|");
  const detB = REFERENCE_STOPS.map((s) => JSON.stringify(liveArrivals(s))).join("|");
  if (detA === detB) {
    console.log("✓ determinismo ×2 (salida byte-idéntica)");
  } else {
    fail("determinismo: dos corridas consecutivas difieren");
  }
  console.log("");
}

// ─── Salida ─────────────────────────────────────────────────────────────────

if (EXPECT && failures > 0) {
  console.error(`QA eta-boarding: ${failures} fallo(s)`);
  process.exit(1);
}

console.log(
  EXPECT ? "QA eta-boarding: baseline OK" : "QA eta-boarding: reporte OK (usá --expect para asertar)",
);
