/**
 * QA determinista del catálogo de líneas (PBI-033).
 *
 * Verifica que las 11 líneas operativas tengan datos consistentes:
 * - rutas en routes.json con paradas > 0 y ramales > 0
 * - flota activa en mock/data.ts > 0
 * - vehículos sembrados en lib/mock/amba-data.ts > 0
 * - zonas-amba.ts sin referencias huérfanas
 * - metropol.json con la línea (al menos)
 *
 * Uso:
 *   npx --yes tsx scripts/qa-catalogo.mts           # reporte (siempre imprime)
 *   npx --yes tsx scripts/qa-catalogo.mts --expect  # además aserta el baseline
 */

import { MOCK_LINES, MOCK_UNITS } from '@/mock/data';
import { DATASET, VEHICULOS_INICIALES_MOCK } from '@/lib/mock/amba-data';
import { ZONAS_AMBA } from '@/data/zonas-amba';
import metropolData from '@/data/metropol.json';

const EXPECT = process.argv.includes('--expect');

interface LineReport {
  id: string;
  numero: string;
  paradas: number;
  ramales: number;
  flota: number;
  vehiculosSembrados: number;
  cabeceraOrigen: string | null;
  cabeceraDestino: string | null;
  enMetropol: boolean;
  ok: boolean;
  issues: string[];
}

const metropolNumbers = new Set(
  (metropolData as { lines: Array<{ number: string }> }).lines.map((l) => l.number),
);

const reports: LineReport[] = MOCK_LINES.map((line) => {
  const lineaData = DATASET.lineas.find((l) => l.id === line.id);
  const ramalPrincipal = lineaData?.ramales[0];
  const paradasSet = new Set<string>();
  lineaData?.ramales.forEach((r) =>
    r.recorridos.forEach((rec) => rec.paradas.forEach((p) => paradasSet.add(p))),
  );
  const flota = MOCK_UNITS[line.id]?.length ?? 0;
  const vehSembrados = VEHICULOS_INICIALES_MOCK.filter((v) => v.lineaId === line.id).length;

  const issues: string[] = [];
  if ((lineaData?.ramales.length ?? 0) === 0) issues.push('sin ramales');
  if (paradasSet.size === 0) issues.push('sin paradas');
  if (flota === 0) issues.push('sin flota en MOCK_UNITS');
  if (vehSembrados === 0) issues.push('sin vehículos sembrados');
  if (!ramalPrincipal?.cabeceraOrigen) issues.push('sin cabeceraOrigen');
  if (!ramalPrincipal?.cabeceraDestino) issues.push('sin cabeceraDestino');

  return {
    id: line.id,
    numero: line.shortName,
    paradas: paradasSet.size,
    ramales: lineaData?.ramales.length ?? 0,
    flota,
    vehiculosSembrados: vehSembrados,
    cabeceraOrigen: ramalPrincipal?.cabeceraOrigen ?? null,
    cabeceraDestino: ramalPrincipal?.cabeceraDestino ?? null,
    enMetropol: metropolNumbers.has(line.shortName),
    ok: issues.length === 0,
    issues,
  };
});

// ─── Zonas AMBA huérfanas ────────────────────────────────────────────
const lineIdsActuales = new Set(MOCK_LINES.map((l) => l.id));
const zonasHuerfanas: string[] = [];
for (const zona of ZONAS_AMBA) {
  for (const lineId of zona.lineIds) {
    if (!lineIdsActuales.has(lineId)) {
      zonasHuerfanas.push(`${zona.id}: ${lineId}`);
    }
  }
}

// ─── Reporte ─────────────────────────────────────────────────────────
console.log(`\n═══ Catálogo de líneas (PBI-033) · ${reports.length} líneas ═══\n`);
for (const r of reports) {
  const status = r.ok ? '✔' : '✗';
  console.log(
    `${status} ${r.numero.padEnd(4)} | ${String(r.ramales).padStart(2)} ramales | ${String(r.paradas).padStart(3)} paradas | ${String(r.flota).padStart(2)} flota | ${String(r.vehiculosSembrados).padStart(2)} sembrados | metropol=${r.enMetropol ? '✓' : '✗'}`,
  );
  if (r.cabeceraOrigen && r.cabeceraDestino) {
    console.log(`     ${r.cabeceraOrigen} → ${r.cabeceraDestino}`);
  }
  if (r.issues.length > 0) {
    console.log(`     Issues: ${r.issues.join(', ')}`);
  }
}

console.log(`\n═══ Zonas AMBA ═══`);
console.log(`Total: ${ZONAS_AMBA.length} zonas`);
if (zonasHuerfanas.length > 0) {
  console.log(`✗ Referencias huérfanas: ${zonasHuerfanas.join(', ')}`);
} else {
  console.log(`✔ Sin referencias huérfanas`);
}

// ─── Aserciones (modo --expect) ──────────────────────────────────────
const failures: string[] = [];
for (const r of reports) {
  if (!r.ok) failures.push(`${r.numero}: ${r.issues.join(', ')}`);
}
if (zonasHuerfanas.length > 0) {
  failures.push(`Zonas huérfanas: ${zonasHuerfanas.join(', ')}`);
}
const sinMetropol = reports.filter((r) => !r.enMetropol);
if (sinMetropol.length > 0) {
  failures.push(`Sin entrada en metropol.json: ${sinMetropol.map((r) => r.numero).join(', ')}`);
}

console.log();
if (failures.length === 0) {
  console.log('✔ Todo OK');
} else {
  console.log(`✗ ${failures.length} falla(s):`);
  failures.forEach((f) => console.log(`  - ${f}`));
}

if (EXPECT && failures.length > 0) {
  process.exit(1);
}