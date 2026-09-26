#!/usr/bin/env node
/**
 * generate-geocoder-docx.mjs — Motor de búsqueda local → Word (.docx)
 * Uso: node scripts/generate-geocoder-docx.mjs
 * Requiere: docx (dependencies del proyecto) — no instalar.
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType,
} from "docx";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "docs", "Motor-Busqueda-Geocoder.docx");

const h1 = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 400, after: 200 },
  children: [new TextRun({ text: t, bold: true, size: 32, font: "Calibri" })],
});
const h2 = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 300, after: 150 },
  children: [new TextRun({ text: t, bold: true, size: 26, font: "Calibri", color: "1D2B4F" })],
});
const p = (t) => new Paragraph({
  spacing: { after: 120 },
  children: [new TextRun({ text: t, size: 20, font: "Calibri" })],
});
const bold = (l, t) => new Paragraph({
  spacing: { after: 120 },
  children: [
    new TextRun({ text: l, bold: true, size: 20, font: "Calibri" }),
    new TextRun({ text: t, size: 20, font: "Calibri" }),
  ],
});
const bullet = (t) => new Paragraph({
  bullet: { level: 0 },
  spacing: { after: 80 },
  children: [new TextRun({ text: t, size: 20, font: "Calibri" })],
});
const code = (t) => new Paragraph({
  spacing: { after: 80 },
  shading: { type: ShadingType.SOLID, color: "F1F5F9" },
  children: [new TextRun({ text: t, size: 18, font: "Consolas" })],
});
const divider = () => new Paragraph({
  spacing: { before: 200, after: 200 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" } },
  children: [],
});
const tr = (c) => new TableRow({
  children: c.map((v) => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: String(v), size: 18, font: "Calibri" })] })],
    width: { size: Math.floor(9000 / c.length), type: WidthType.DXA },
  })),
});
const th = (c) => new TableRow({
  tableHeader: true,
  children: c.map((v) => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: String(v), bold: true, size: 18, font: "Calibri", color: "FFFFFF" })] })],
    shading: { type: ShadingType.SOLID, color: "1D2B4F" },
    width: { size: Math.floor(9000 / c.length), type: WidthType.DXA },
  })),
});
const br = () => new Paragraph({ children: [new TextRun({ break: 1 })], pageBreakBefore: true });

const C = [];

// Portada
C.push(
  new Paragraph({ spacing: { before: 2400 }, children: [] }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: "Motor de búsqueda local", bold: true, size: 56, font: "Calibri", color: "1D2B4F" })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: "Geocoder en bundle para /mapas — sin OSM en runtime", size: 26, font: "Calibri", color: "475569" })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: "pre-mvp-transportes · rama fix/routes-home", size: 20, font: "Calibri", color: "94A3B8" })],
  }),
  divider(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: `Generado: ${new Date().toISOString().slice(0, 10)}`, size: 20, font: "Calibri", color: "64748B" })],
  }),
  br(),
);

// ─── SECCIÓN 1 ───────────────────────────────────────────────
C.push(h1("Sección 1 — El problema y las restricciones"));
C.push(h2("1.1 Qué necesitábamos"));
C.push(p("En Modo Viaje, el usuario debe poder escribir \"cabildo\", \"Obelisco\" o \"Parque Centenario\" y obtener un punto del mapa para armar origen/destino, sin depender de una parada fija del catálogo."));
C.push(h2("1.2 Restricciones del plan"));
C.push(bullet("Prohibido llamar a OSM / Nominatim / Google en runtime: el backend de geocoding no entra al alcance del pre-MVP."));
C.push(bullet("Todo debe vivir en el bundle del front: offline-friendly, cero costo de API, cero latencia de red."));
C.push(bullet("Firma tipo adapter: si mañana cambiamos la fuente (índice remoto, servicio propio), no se toca la UI."));
C.push(bullet("Módulo puro: geocoder sin fetch, sin DOM — testeable y reutilizable."));
C.push(h2("1.3 Qué NO es este motor"));
C.push(bullet("No es un geocoder mundial: solo AMBA (Buenos Aires y alrededores)."));
C.push(bullet("No resuelve alturas exactas tipo \"Av. Cabildo 2500\" con precisión de GPS: las direcciones arbitrarias se anclan al corredor de la vía."));
C.push(bullet("No consulta paradas en vivo: las paradas mock se inyectan como fuente en cada query."));
C.push(divider());

// ─── SECCIÓN 2 ───────────────────────────────────────────────
C.push(h1("Sección 2 — Cómo funciona el motor"));
C.push(h2("2.1 Normalización de texto"));
C.push(p("Antes de comparar cualquier cosa, todo pasa por normalizeText: minúsculas, sin acentos, trim."));
C.push(code('normalizeText("Constitución") → "constitucion"'));
C.push(code('normalizeText("  Av. Cabildo  ") → "av. cabildo"'));
C.push(p("Esto hace que \"Obelisco\", \"obelisco\" y \"OBELISCO\" matcheen lo mismo, y que \"Cabildo\" encuentre aliases como \"avenida cabildo\"."));
C.push(h2("2.2 Índices estáticos (en el bundle)"));
C.push(p("Dos arreglos exportados, curados a mano con coordenadas aproximadas del AMBA:"));
C.push(new Table({
  rows: [
    th(["Índice", "Qué contiene", "Grupo de ranking"]),
    tr(["LANDMARK_INDEX (~15)", "Obelisco, Casa Rosada, Teatro Colón, Parque Centenario…", "0 (prioridad máxima)"]),
    tr(["STREET_INDEX (~23)", "Av. Cabildo, Corrientes, Rivadavia, 9 de Julio… con bounds de corredor", "1"]),
    tr(["KNOWN_POIS (inyectado)", "POIs canónicos del planner (mismo objeto / stopId)", "2"]),
    tr(["PARADAS_MOCK (inyectado)", "Paradas de colectivo mock", "3"]),
  ],
}), p(""));
C.push(h2("2.3 Scoring: exacto > prefijo > incluye"));
C.push(p("scoreMatch compara la query normalizada contra name y aliases:"));
C.push(new Table({
  rows: [
    th(["Rank", "Criterio", "Ejemplo con \"cab\""]),
    tr(["0", "Igualdad exacta (name o alias)", "—"]),
    tr(["1", "Prefijo (startsWith)", "cab → Cabildo, Caballito"]),
    tr(["2", "Contiene (includes)", "cab → San Cristóbal…"]),
    tr(["3", "Solo matchea por address", "fallback"]),
  ],
}), p(""));
C.push(p("El score final es scoreMatch + grupo × 10. Así un landmark exacto siempre gana contra una calle que solo \"contiene\" el string, aunque el string de la calle sea más largo."));
C.push(h2("2.4 Flujo de searchGeocode(query, sources, limit)"));
C.push(bullet("1. normalizeText(query)."));
C.push(bullet("2. Recorre LANDMARK_INDEX (grupo 0), STREET_INDEX (grupo 1), luego sources.pois (2) y sources.stops (3)."));
C.push(bullet("3. consider() descarta no-match, deduplica por id y empuja a scored[]."));
C.push(bullet("4. Sort por rank asc, tie-break alfabético. slice(0, limit=10)."));
C.push(bullet("5. Query vacía → scoreMatch devuelve 3 para todos: cae a landmarks principales (los primeros del índice)."));
C.push(h2("2.5 Adaptación al contrato del planner"));
C.push(p("geoToLocationPoint(geo) convierte GeoResult → LocationPoint:"));
C.push(code("focusBounds: geo.bounds ?? boundsAround(lat, lng)"));
C.push(p("focusBounds es el rectángulo que MapCanvas usa en fitBounds al elegir el resultado (corredor completo de la avenida, no solo un punto)."));
C.push(p("kind: calle | direccion | landmark → isArbitrary: true (el planner puede preservar el texto libre del usuario)."));
C.push(divider());

// ─── SECCIÓN 3 ───────────────────────────────────────────────
C.push(br());
C.push(h1("Sección 3 — Integración con la UI y el planificador"));
C.push(h2("3.1 Capa de servicio"));
C.push(bold("TripPlannerService.searchLocations(query): ", "arma sources con KNOWN_POIS + PARADAS_MOCK, llama searchGeocode, mapea a LocationPoint. Query vacía → primeros 8 KNOWN_POIS."));
C.push(bold("TripPlannerService.resolveLocationPoint(input): ", "acepta string o LocationPoint. Primero busca parada por id; si no, searchLocations y toma el primer hit (si es arbitrary, respeta el texto tipeado)."));
C.push(h2("3.2 ViajeHeader (inputs de origen/destino)"));
C.push(bullet("searchQuery → debounce 300ms → debouncedQuery → useMemo(searchLocations)."));
C.push(bullet("Cada keystroke solo actualiza el input; el geocoder corre cada 300ms de inactividad (evita reflow/jank sobre el mapa WebGL)."));
C.push(bullet("Enter usa searchLocations(searchQuery) en vivo (sin esperar el debounce)."));
C.push(bullet("Seleccionar un resultado → onSelectOrigin / onSelectDestination con LocationPoint completo."));
C.push(h2("3.3 focusRequest y el mapa"));
C.push(p("En page.tsx, originLocation y destinationLocation alimentan un useMemo que arma focusRequest con nonce incremental solo si cambian lat/lng/nombre."));
C.push(p("MapCanvas, al ver un nonce nuevo, ejecuta fitBounds con focusBounds del LocationPoint: la cámara encuadra el corredor o el landmark elegido."));
C.push(bullet("Sin cambio de punto → sin nonce → sin resize de cámara (el dropdown no mueve el mapa)."));
C.push(h2("3.4 planTrip"));
C.push(bullet("resolveLocationPoint(origen) + resolveLocationPoint(destino) → puntos canónicos."));
C.push(bullet("Si falla la resolución → planTrip devuelve [] y la UI muestra \"No encontramos una combinación viable\"."));
C.push(bullet("Si OK → matching de líneas (ej. ~19 min directo Línea 65) + fitBounds del trayecto."));
C.push(h2("3.5 Semilla de origen (bugfix relacionado)"));
C.push(p("Al abrir Modo Viaje, si originLocation es null lo sembramos con Parque Centenario (KNOWN_POIS). Sin esto, hasPointsSelected queda en false y el panel queda pegado en \"Elegí tu destino\"."));
C.push(h2("3.6 Archivos clave"));
C.push(new Table({
  rows: [
    th(["Archivo", "Rol"]),
    tr(["src/lib/planner/geocoder.ts", "Motor puro: índices, normalize, score, searchGeocode, geoToLocationPoint"]),
    tr(["src/lib/services/trip-planner-service.ts", "Fachada: searchLocations, resolveLocationPoint, planTrip, KNOWN_POIS"]),
    tr(["src/components/viaje/ViajeHeader.tsx", "UI de búsqueda con debounce 300ms"]),
    tr(["src/app/mapas/page.tsx", "Orquestación focusRequest / fitBounds / Modo Viaje"]),
    tr(["src/components/map/MapCanvas.tsx", "Cámara, capas, ResizeObserver con rAF"]),
  ],
}), p(""));
C.push(divider());
C.push(bold("Demo en la reunión: ", "abrir /mapas → Modo Viaje → tipear \"cabildo\" → elegir Av. Cabildo → panel de viaje + encuadre de cámara."));
C.push(bold("Logs opcionales: ", "console.debug en ViajeHeader (selección), searchGeocode (top hits) y armar de sources en searchLocations."));

await Packer.toBuffer(new Document({
  styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
  sections: [{ children: C }],
})).then((buf) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buf);
  console.log(`[geocoder-docx] OK → ${path.relative(ROOT, OUT)} (${buf.length} bytes)`);
});
