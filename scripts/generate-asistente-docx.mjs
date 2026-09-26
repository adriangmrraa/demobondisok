#!/usr/bin/env node
/**
 * generate-asistente-docx.mjs — Markdown → Word (.docx) para los docs del feature.
 * Uso: node scripts/generate-asistente-docx.mjs [src.md] [out.docx]
 * Defaults: docs/Asistente-Home.md → docs/Asistente-Home.docx
 * Requiere: docx (dependencies del proyecto) — no instalar.
 *
 * Conversor MD mínimo: encabezados (#..###), viñetas (- ) y numeradas (1. ),
 * tablas pipe, bloques de código (```), **negritas** inline y párrafos.
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType,
} from "docx";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const srcArg = process.argv[2] ?? "docs/Asistente-Home.md";
const SRC = path.resolve(ROOT, srcArg);
const OUT = process.argv[3]
  ? path.resolve(ROOT, process.argv[3])
  : SRC.replace(/\.md$/, ".docx");

if (!fs.existsSync(SRC)) {
  console.error(`[asistente-docx] No existe ${SRC}`);
  process.exit(1);
}

const NAVY = "1D2B4F";
const BLUE = "1D4ED8";

/** **negritas** → TextRuns */
function runs(text, base = {}) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part) => {
    const isBold = /^\*\*[^*]+\*\*$/.test(part);
    return new TextRun({
      text: isBold ? part.slice(2, -2) : part,
      bold: isBold ? true : base.bold,
      size: base.size ?? 20,
      font: base.font ?? "Calibri",
      color: base.color,
    });
  });
}

const title = (t) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 2000, after: 240 },
  children: [new TextRun({ text: t, bold: true, size: 56, font: "Calibri", color: NAVY })],
});
const h1 = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 },
  children: [new TextRun({ text: t, bold: true, size: 30, font: "Calibri", color: NAVY })],
});
const h2 = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 },
  children: [new TextRun({ text: t, bold: true, size: 24, font: "Calibri", color: BLUE })],
});
const para = (t) => new Paragraph({ spacing: { after: 120 }, children: runs(t) });
const bullet = (t) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: runs(t) });
const code = (t) => new Paragraph({
  spacing: { after: 20 },
  shading: { type: ShadingType.SOLID, color: "F1F5F9" },
  children: [new TextRun({ text: t || " ", size: 16, font: "Consolas" })],
});
const divider = () => new Paragraph({
  spacing: { before: 200, after: 200 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" } },
  children: [],
});
const cell = (text, header, widthDxa) => new TableCell({
  children: [new Paragraph({ children: runs(text, { size: 18, ...(header ? { bold: true, color: "FFFFFF" } : {}) }) })],
  ...(header ? { shading: { type: ShadingType.SOLID, color: NAVY } } : {}),
  width: { size: widthDxa, type: WidthType.DXA },
});
const mdTable = (rows) => new Table({
  rows: rows.map((r, i) => new TableRow({
    tableHeader: i === 0,
    children: r.map((c) => cell(c, i === 0, Math.floor(9000 / r.length))),
  })),
});
const splitRow = (line) => line.split("|").slice(1, -1).map((c) => c.trim());
const isSep = (line) => /^\|[\s:|-]+\|$/.test(line);

const md = fs.readFileSync(SRC, "utf-8").replace(/\r\n/g, "\n").split("\n");
const C = [];
let i = 0;
let firstH1 = true;

while (i < md.length) {
  const line = md[i];

  if (line.startsWith("```")) {
    i++;
    while (i < md.length && !md[i].startsWith("```")) { C.push(code(md[i])); i++; }
    i++; // cerrar bloque
    continue;
  }
  if (line.startsWith("|")) {
    const rows = [];
    while (i < md.length && md[i].startsWith("|")) {
      if (!isSep(md[i])) rows.push(splitRow(md[i]));
      i++;
    }
    C.push(mdTable(rows), para(""));
    continue;
  }
  if (line.startsWith("### ")) { C.push(h2(line.slice(4))); i++; continue; }
  if (line.startsWith("## ")) { C.push(h1(line.slice(3))); i++; continue; }
  if (line.startsWith("# ")) {
    if (firstH1) { C.push(title(line.slice(2))); firstH1 = false; }
    else C.push(h1(line.slice(2)));
    i++;
    continue;
  }
  if (/^[-*] /.test(line)) { C.push(bullet(line.slice(2))); i++; continue; }
  if (/^\d+\. /.test(line)) {
    const n = line.match(/^(\d+)\./)[1];
    C.push(new Paragraph({
      bullet: { level: 0 }, spacing: { after: 80 },
      children: runs(`${n}. ${line.replace(/^\d+\.\s*/, "")}`),
    }));
    i++;
    continue;
  }
  if (/^\*\*(Rama|PBI|Fecha|Estado)/.test(line)) { C.push(para(line)); i++; continue; }
  if (line.trim() === "") { i++; continue; }
  C.push(para(line));
  i++;
}

await Packer.toBuffer(new Document({
  styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
  sections: [{ children: C }],
})).then((buf) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buf);
  console.log(`[asistente-docx] OK → ${path.relative(ROOT, OUT)} (${buf.length} bytes)`);
});
