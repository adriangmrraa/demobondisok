#!/usr/bin/env node
/**
 * generate-backlog-docx.mjs — Exporta docs/backlog.json → Word (.docx)
 * Uso: node scripts/generate-backlog-docx.mjs
 * Requiere: docx (dependencies del proyecto) — no instalar.
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, TableRow, TableCell, Table,
  WidthType, ShadingType,
} from "docx";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const BACKLOG = path.join(ROOT, "docs", "backlog.json");

if (!fs.existsSync(BACKLOG)) {
  console.error(`[backlog] No existe ${BACKLOG}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(BACKLOG, "utf-8"));
const meta = data.meta ?? {};
const items = data.items ?? [];
const OUT = path.join(ROOT, meta.docx ?? "docs/Backlog.docx");

const STATUS_LABEL = { todo: "Por hacer", in_progress: "En curso", done: "Hecho" };
const STATUS_ORDER = ["in_progress", "todo", "done"];

const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, children: [new TextRun({ text: t, bold: true, size: 32, font: "Calibri" })] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 }, children: [new TextRun({ text: t, bold: true, size: 26, font: "Calibri", color: "1D4ED8" })] });
const p = (t) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: t, size: 20, font: "Calibri" })] });
const bold = (l, t) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: l, bold: true, size: 20, font: "Calibri" }), new TextRun({ text: t, size: 20, font: "Calibri" })] });
const bullet = (t) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text: t, size: 20, font: "Calibri" })] });
const divider = () => new Paragraph({ spacing: { before: 200, after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" } }, children: [] });
const tr = (c) => new TableRow({ children: c.map((v) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(v), size: 18, font: "Calibri" })] })], width: { size: Math.floor(9000 / c.length), type: WidthType.DXA } })) });
const th = (c) => new TableRow({ tableHeader: true, children: c.map((v) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(v), bold: true, size: 18, font: "Calibri", color: "FFFFFF" })] })], shading: { type: ShadingType.SOLID, color: "1D4ED8" }, width: { size: Math.floor(9000 / c.length), type: WidthType.DXA } })) });
const br = () => new Paragraph({ children: [new TextRun({ break: 1 })], pageBreakBefore: true });

const C = [];

// Portada
C.push(
  new Paragraph({ spacing: { before: 2400 }, children: [] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "Product Backlog", bold: true, size: 56, font: "Calibri", color: "1D4ED8" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: meta.project ?? "pre-mvp-transportes", size: 28, font: "Calibri", color: "475569" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: `Rama: ${meta.branch ?? "—"}`, size: 22, font: "Calibri", color: "94A3B8" })] }),
  divider(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: `Actualizado: ${meta.updated ?? new Date().toISOString().slice(0, 10)}`, size: 20, font: "Calibri", color: "64748B" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: `Total PBIs: ${items.length}`, size: 20, font: "Calibri", color: "64748B" })] }),
  br(),
);

// Resumen por estado
C.push(h1("1. Resumen"));
for (const st of STATUS_ORDER) {
  const group = items.filter((i) => i.status === st);
  if (!group.length) continue;
  C.push(h2(`${STATUS_LABEL[st] ?? st} (${group.length})`));
  C.push(new Table({
    rows: [
      th(["ID", "PBI", "Prioridad"]),
      ...group.map((i) => tr([i.id, i.title, i.priority ?? "P1"])),
    ],
  }), p(""));
}

// Detalle por PBI
C.push(br(), h1("2. Detalle de PBIs"));
for (const item of items) {
  C.push(h2(`${item.id} — ${item.title}`));
  C.push(bold("Estado: ", STATUS_LABEL[item.status] ?? item.status));
  C.push(bold("Prioridad: ", item.priority ?? "P1"));
  if (item.story) C.push(bold("Historia: ", item.story));
  if (item.acceptance?.length) {
    C.push(p("Criterios de aceptación:"));
    for (const a of item.acceptance) C.push(bullet(a));
  }
  if (item.notes) C.push(bold("Notas: ", item.notes));
  C.push(divider());
}

await Packer.toBuffer(new Document({
  styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
  sections: [{ children: C }],
})).then((buf) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buf);
  console.log(`[backlog] OK → ${path.relative(ROOT, OUT)} (${items.length} PBIs, ${buf.length} bytes)`);
});
