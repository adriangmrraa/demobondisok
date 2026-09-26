/**
 * QA determinista del parser de intents del Asistente del Home (INC-1).
 *
 * Ejecutar:  npx tsx scripts/qa-assistant-intents.mts
 *
 * Cubre parseAssistantQuery (keywords, tildes/mayúsculas, línea, destino)
 * y resolveAssistantQuery contra el feed GPS vivo (mock/live.ts) con la
 * ubicación simulada de referencia. Sin navegador, sin UI.
 */

import {
  parseAssistantQuery,
  resolveAssistantQuery,
  nearbyStopsFor,
  type AssistantQuery,
  type AssistantAnswer,
} from "@/lib/services/assistant-intent-service";
import { getCurrentPositions } from "@/mock/live";
import { getUserLocation } from "@/lib/config/user-location";

interface ParseCase {
  raw: string;
  intent: string;
  lineaNumero?: string;
  destinoContains?: string;
}

const PARSE_CASES: ParseCase[] = [
  { raw: "¿Cuándo llega el próximo colectivo?", intent: "next_arrival" },
  { raw: "cuando pasa el 194", intent: "next_arrival", lineaNumero: "194" },
  { raw: "QUE LLEGA A LA PARADA", intent: "next_arrival" }, // mayúsculas + sin tildes
  { raw: "¿Cuál es la parada más cercana?", intent: "nearest_stop" },
  { raw: "parada cerca mia", intent: "nearest_stop" },
  { raw: "¿Cómo llego a Once?", intent: "trip_plan", destinoContains: "once" },
  { raw: "como voy al obelisco", intent: "trip_plan", destinoContains: "obelisco" },
  { raw: "¿Cuánto me falta para tomar el colectivo?", intent: "walk_timing" },
  { raw: "me da tiempo a caminar al 65?", intent: "walk_timing", lineaNumero: "65" },
  { raw: "xyzzy plugh", intent: "unknown" },
  { raw: "", intent: "unknown" },
];

let failures = 0;

function checkParse(c: ParseCase): void {
  const q = parseAssistantQuery(c.raw);
  const problems: string[] = [];
  if (q.intent !== c.intent) problems.push(`intent=${q.intent} esperado=${c.intent}`);
  if (c.lineaNumero && q.lineaNumero !== c.lineaNumero)
    problems.push(`linea=${q.lineaNumero ?? "-"} esperada=${c.lineaNumero}`);
  if (c.destinoContains) {
    const dest = (q.destinoText ?? "").toLowerCase();
    if (!dest.includes(c.destinoContains))
      problems.push(`destino="${q.destinoText ?? "-"}" no contiene "${c.destinoContains}"`);
  }
  if (problems.length) {
    failures++;
    console.error(`✗ "${c.raw}" → ${problems.join("; ")}`);
  } else {
    console.log(`✓ "${c.raw}" → ${q.intent}${q.lineaNumero ? ` línea ${q.lineaNumero}` : ""}${q.destinoText ? ` destino="${q.destinoText}"` : ""}`);
  }
}

// ─── Resolución con datos vivos ─────────────────────────────────────────────

async function resolveChecks(): Promise<void> {
  const ref = getUserLocation();
  const positions = getCurrentPositions();
  const ctx = { ref, positions };

  const cases: Array<{ q: AssistantQuery; expectKind: AssistantAnswer["kind"] }> = [
    { q: { intent: "next_arrival" }, expectKind: "arrivals" },
    { q: { intent: "nearest_stop" }, expectKind: "nearby-stops" },
    { q: { intent: "walk_timing" }, expectKind: "walk-timing" },
    { q: { intent: "trip_plan", destinoText: "once" }, expectKind: "trip" },
    { q: { intent: "trip_plan", destinoText: "zzz-inexistente" }, expectKind: "clarify" },
    { q: { intent: "unknown" }, expectKind: "clarify" },
  ];

  for (const c of cases) {
    const a = resolveAssistantQuery(c.q, ctx);
    if (a.kind !== c.expectKind) {
      failures++;
      console.error(`✗ resolve ${JSON.stringify(c.q)} → kind=${a.kind} esperado=${c.expectKind} ("${a.headline}")`);
    } else {
      console.log(`✓ resolve ${c.q.intent}${c.q.destinoText ? ` "${c.q.destinoText}"` : ""} → ${a.kind}: ${a.headline}`);
    }
  }

  // El destino inexistente NO debe resolver a Parque Centenario (antipatrón).
  const bad = resolveAssistantQuery({ intent: "trip_plan", destinoText: "tierra del fuego" }, ctx);
  if (bad.kind === "trip" && bad.destination.lat === ref.lat && bad.destination.lng === ref.lng) {
    failures++;
    console.error("✗ REGRESIÓN: destino imposible resolvió a la ubicación simulada");
  } else {
    console.log(`✓ destino imposible no cae en la ubicación simulada (${bad.kind})`);
  }

  // ─── Wizard PBI-020: paso 2 (paradas) y guía compuesta paso 2+3 ───
  const nearby = nearbyStopsFor(ctx, 3);
  if (nearby.length === 0 || !nearby[0].parada.id) {
    failures++;
    console.error("✗ nearbyStopsFor no devolvió paradas");
  } else {
    console.log(`✓ nearbyStopsFor → ${nearby.length} paradas (1ª: ${nearby[0].parada.nombre}, ${nearby[0].distanceMeters} m)`);
  }

  const guide = resolveAssistantQuery(
    { intent: "trip_plan", destinoText: "once", originStopId: nearby[0]?.parada.id ?? "stop-65-05" },
    ctx,
  );
  if (guide.kind !== "trip-guide" || guide.originStop.id !== (nearby[0]?.parada.id ?? "stop-65-05")) {
    failures++;
    console.error(`✗ wizard guide → kind=${guide.kind} ("${guide.headline}")`);
  } else {
    console.log(`✓ wizard guide → trip-guide: ${guide.headline} · ${guide.arrivals.length} llegadas · trip=${guide.trip ? "sí" : "no"}`);
  }

  const guideBadDest = resolveAssistantQuery(
    { intent: "trip_plan", destinoText: "zzz-inexistente", originStopId: "stop-65-05" },
    ctx,
  );
  if (guideBadDest.kind !== "clarify") {
    failures++;
    console.error(`✗ wizard guide con destino imposible → ${guideBadDest.kind}`);
  } else {
    console.log(`✓ wizard guide destino imposible → clarify (${guideBadDest.candidates.length} candidatos)`);
  }
}

for (const c of PARSE_CASES) checkParse(c);
await resolveChecks();

if (failures > 0) {
  console.error(`\nQA assistant-intents: ${failures} fallo(s)`);
  process.exit(1);
}
console.log("\nQA assistant-intents: OK");
