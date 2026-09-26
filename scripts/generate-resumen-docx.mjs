#!/usr/bin/env node
/**
 * generate-resumen-docx.mjs — Resumen del trabajo en pre-mvp-transportes → Word (.docx)
 * Uso: node scripts/generate-resumen-docx.mjs
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
const OUT = path.join(ROOT, "docs", "Resumen-Trabajo-Equipo.docx");

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
    children: [new TextRun({ text: "Resumen de trabajo", bold: true, size: 56, font: "Calibri", color: "1D2B4F" })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: "Rutas · Organización · Fix del flash · Branding · Ver parada", size: 26, font: "Calibri", color: "475569" })],
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
  p("Este documento resume, en lenguaje natural, lo que hicimos en el pre-MVP de transportes. Está pensado para el equipo: sin tecnicismos innecesarios, pero con la evidencia y los archivos justamente donde hay que mirarlos."),
  br(),
);

// ─── SECCIÓN 1 ───────────────────────────────────────────────
C.push(h1("1. Reestructura de rutas"));
C.push(p("Antes la app tenía todo mezclado en pocas páginas. La reestructura separó cada módulo en su propia ruta, con una landing clara en la raíz y navegación unificada abajo."));
C.push(h2("1.1 Mapa de rutas"));
C.push(new Table({
  rows: [
    th(["Ruta", "Qué es"]),
    tr(["/", "Landing pública: presentación del producto, no es más la home de la app"]),
    tr(["/home", "Home de la app (port de colectivos-amba/inicio): estado de líneas, carrusel de flota"]),
    tr(["/mapas", "Mapa + Modo Viaje (planificador origen/destino) + geocoder local"]),
    tr(["/alertas", "Listado de alertas de servicio"]),
    tr(["/alerta/[id]", "Detalle de una alerta (tramos afectados, scroll propio)"]),
    tr(["/parada/[id]", "Detalle de parada (horarios, líneas que pasan)"]),
  ],
}), p(""));
C.push(h2("1.2 Navegación unificada"));
C.push(bullet("Bottom nav nuevo (src/components/ui/bottom-nav.tsx) con 3 módulos: Inicio, Mapas, Alertas."));
C.push(bold("Se reemplazó ", "src/components/navigation/BottomNavBar.tsx (borrado): una sola fuente de verdad para los ítems y el estado activo."));
C.push(bullet("La landing (/) no muestra la bottom nav de la app: es marketing, no producto."));
C.push(h2("1.3 Por qué importa"));
C.push(bullet("Cada módulo se puede abrir, testear y deployear por separado."));
C.push(bullet("La raíz queda libre para la landing (onboarding / demo para el equipo)."));
C.push(bullet("El detalle (alerta/parada) es una ruta real con params, no un modal encima de otra pantalla."));
C.push(divider());

// ─── SECCIÓN 2 ───────────────────────────────────────────────
C.push(h1("2. Organización y buenas prácticas"));
C.push(h2("2.1 Backlog como fuente de verdad"));
  C.push(bullet("docs/backlog.json: 16 PBIs, todos en estado done en fix/routes-home."));
C.push(bullet("Se genera Word con scripts/generate-backlog-docx.mjs → docs/Backlog-fix-home.docx."));
C.push(bullet("Criterio: si no está en el backlog, no se hizo (o no se contó)."));
C.push(h2("2.2 Estructura del código"));
C.push(code("src/app/        → rutas (App Router)"));
C.push(code("src/components/ → UI (brand/, theme/, ui/, ui-shell/, map/, viaje/)"));
C.push(code("src/lib/        → lógica de negocio (services/, planner/, theme.ts)"));
C.push(code("src/hooks/      → hooks reutilizables"));
C.push(code("src/types/      → tipos compartidos"));
C.push(code("scripts/        → generadores de docs (.mjs)"));
C.push(h2("2.3 Convenciones de trabajo"));
C.push(bullet("Nunca build después de cambios: verificación solo con tsc --noEmit (exit 0)."));
C.push(bullet("lint con rtk falla por JSON parse del tool — no se usa como gate."));
C.push(bullet("Commits convencionales, sin \"Co-Authored-By\" ni atribución de AI; solo cuando el equipo lo pide."));
C.push(bullet("NDA: no exponer imágenes, metropol.json crudo ni narrativa interna en docs compartidos."));
C.push(bullet("Geocoding 100% local (índice en bundle): el plan prohíbe llamar a OSM en runtime."));
C.push(h2("2.4 Docs generados"));
C.push(new Table({
  rows: [
    th(["Script", "Salida"]),
    tr(["scripts/generate-backlog-docx.mjs", "docs/Backlog-fix-home.docx"]),
    tr(["scripts/generate-geocoder-docx.mjs", "docs/Motor-Busqueda-Geocoder.docx"]),
    tr(["scripts/generate-resumen-docx.mjs", "docs/Resumen-Trabajo-Equipo.docx (este)"]),
  ],
}), p(""));
C.push(divider());

// ─── SECCIÓN 3 ───────────────────────────────────────────────
C.push(br());
C.push(h1("3. Fix del flash (FOUC / hydration)"));
C.push(p("El problema: al abrir la app se veía un parpadeo — la página arrancaba clara y saltaba a oscura (o al revés), en /mapas el mapa titilaba al abrir Modo Viaje o tipear el destino, y tocar \"Ver\" en una parada no movía el mapa ni bajaba el modal. Detrás había tres bugs distintos."));
C.push(h2("3.1 Flash de tema (FOUC + hydration mismatch)"));
C.push(bold("Síntoma: ", "página clara un instante → oscuro; y error de hydration en ThemeToggle."));
C.push(bold("Causa raíz: ", "React renderizaba distinto en servidor y en cliente. El ThemeProvider leía document.documentElement en el useState initializer: en el servidor no hay document, así que devolvía un valor; en el cliente otro."));
C.push(bold("Solución (3 piezas): ", ""));
C.push(bullet("themeInitScript en layout.tsx: script inline que pinta la clase real del tema en <html> ANTES de que React hidrate. Cero frames en blanco."));
C.push(bullet("ThemeProvider: resolvedTheme arranca en \"dark\" (igual en SSR y primer render del cliente), y recién en useEffect sincroniza con el DOM que el script ya pintó."));
C.push(bullet("Regla: nunca branchear sobre document dentro de useState initializer. El primer render debe ser idéntico en servidor y cliente."));
C.push(code("resolvedTheme: string = \"dark\"  // SSR consistente"));
C.push(code("useEffect(() => { sync from document.documentElement }, [])"));
C.push(h2("3.2 Titileo del mapa en /mapas"));
C.push(bold("Síntoma: ", "al abrir el modal Modo Viaje o tipear en \"¿A dónde vas?\", el mapa WebGL atrás parpadea / hay layout loop."));
C.push(bold("Causas: ", "(a) backdrop-blur sobre el canvas WebGL, (b) fitBounds de seed al abrir el modal, (c) ResizeObserver sin coalescer."));
C.push(bold("Solución: ", ""));
C.push(bullet("Eliminado backdrop-blur de todos los overlays que quedan encima del mapa (el blur fuerza repaints caros del canvas)."));
C.push(bullet("Suprimido el fitBounds de seed al abrir Modo Viaje: pre-marca lastFocusKeyRef y los handlers de selección resetean la key para que no se re-dispare."));
C.push(bullet("ResizeObserver → map.resize() coalesced con requestAnimationFrame + check de tamaño (no resize en cada tecla)."));
C.push(bullet("Debounce de búsqueda: 300ms; Enter usa el geocoder en vivo sin esperar el debounce."));
C.push(bullet("Contenedor del mapa en capa GPU (will-change / translateZ)."));
C.push(h2("3.3 Fix de \"Ver\" en el modal de paradas"));
C.push(p("El problema: tocábamos \"Ver\" en la lista de paradas y… no pasaba casi nada. El mapa no se movía y el modal seguía tapando la mitad de la pantalla, así que ni veías la parada que acababas de elegir."));
C.push(bold("Síntoma: ", "tap en \"Ver\" → el modal quedaba en full (58dvh, más de la mitad) y la cámara no volaba al stop."));
C.push(bold("Causas (tres, todas juntas): ", ""));
C.push(bullet("El modal \"expanded\" era 58dvh: más de la mitad de la pantalla, tapaba el stop en el mapa."));
C.push(bullet("El effect de flyTo usaba un ref de padding que llegaba tarde: mandaba 140 cuando corresponde 360 (espacio para que el modal abierto no tape el punto)."));
C.push(bullet("Si tocabas \"Ver\" en la MISMA parada dos veces, selectedStopId no cambiaba → el effect no se re-disparaba → el mapa no se movía."));
C.push(bold("Solución: ", ""));
C.push(bullet("Nuevo estado half en LiveTransportBubble: \"Ver\" baja el modal a 40dvh (menos de la mitad). Ciclo: full (58dvh) → collapsed (74px) → full; desde half el grip vuelve a full sin colapsar."));
C.push(bullet("handleVerParada hace setHalf(true) batcheado — OJO: un useEffect que hiciera setHalf(!collapsed) pisaba ese valor; se eliminó."));
C.push(bullet("stopFocusNonce: handleSelectParada lo incrementa; MapCanvas lo tiene en las deps del effect → el flyTo se re-dispara aunque selectedStopId no cambie."));
C.push(bullet("cameraBottomPadding = 360 con parada seleccionada (sino 140, o 220 en Modo Viaje): el prop se lee directo en el effect, no el ref (que llegaba tarde)."));
C.push(code("stopFocusNonce++  // en handleSelectParada"));
C.push(code("cameraBottomPadding = isTripMode ? 220 : selectedParada ? 360 : 140"));
C.push(h2("3.4 Semilla de origen (relacionado)"));
C.push(p("Al abrir Modo Viaje, si originLocation era null lo sembramos con Parque Centenario. Sin eso, hasPointsSelected quedaba en false y el panel se pegaba en \"Elegí tu destino\" pese a tener destino."));
C.push(divider());
C.push(bold("Cómo verificarlo a mano: ", "abrir / en hard refresh → no debe parpadear; abrir /mapas → Modo Viaje → tipear destino → el mapa atrás no debe titilar; en el modal de paradas, tocar \"Ver\" → el mapa vuela a la parada y el modal baja a <50dvh."));

// ─── SECCIÓN 4 ───────────────────────────────────────────────
C.push(br());
C.push(h1("4. Branding Metropol con modos oscuro/claro"));
C.push(h2("4.1 Paleta"));
C.push(new Table({
  rows: [
    th(["Token", "Hex", "Uso"]),
    tr(["Navy", "#1D2B4F", "Principal: headings, header de tablas, fondo de marca"]),
    tr(["Rojo Metropol", "#E30613", "Acento / logo (modo claro)"]),
    tr(["Verde", "#228135", "Acento secundario del logo"]),
    tr(["Canvas / ink / hairline", "DESIGN.MD", "Tokens de superficie, texto y bordes en ambos temas"]),
  ],
}), p(""));
C.push(h2("4.2 Logo"));
C.push(bullet("src/components/brand/metropol-logo.tsx: variantes full (color) y mono (un solo tono)."));
C.push(bullet("El modo mono se usa sobre fondos oscuros donde el rojo/navy pierde contraste."));
C.push(bullet("Assets en public/: metropol-logo.svg, metropol-icon.png (reemplaza al icon.svg genérico)."));
C.push(h2("4.3 Tema oscuro / claro"));
C.push(bullet("ThemeProvider + ThemeToggle (botón 44px táctil) en el shell."));
C.push(bullet("Clase en <html>: dark / light, pintada por themeInitScript antes del hydrate (ver sección 3)."));
C.push(bullet("Manifest y metadata actualizados: manifest.ts, public/manifest.json, metadata en layout.tsx (Metropol, no \"Next.js\" genérico)."));
C.push(bullet("src/lib/theme.ts: helpers de tokens compartidos (se consume desde UI y desde el script de init)."));
C.push(h2("4.4 Assets y estructura de marca"));
C.push(code("src/components/brand/     → MetropolLogo, FleetCarousel"));
C.push(code("src/data/metropol.json   → contenido de marca (NO exponer crudo fuera del equipo)"));
C.push(code("docs/metropol/           → material de referencia interno"));
C.push(code("public/images/           → imágenes optimizadas"));
C.push(h2("4.5 Qué se ve hoy"));
C.push(bullet("Landing (/): hero con logo Metropol, carrusel de flota, paleta navy + acentos."));
C.push(bullet("App (/home, /mapas, /alertas): header y bottom nav coherentes con la marca en ambos temas."));
C.push(bullet("Toggle de tema respeta la preferencia del sistema en el primer load (via themeInitScript + matchMedia)."));
C.push(divider());

// Cierre
C.push(h1("Estado general"));
C.push(new Table({
  rows: [
    th(["Tema", "Estado"]),
    tr(["Reestructura de rutas", "Hecho (landing /, home, mapas, alertas, detalle)"]),
    tr(["Organización / backlog", "Hecho — 16/16 PBIs done en fix/routes-home"]),
    tr(["Fix flash FOUC + hydration", "Hecho — themeInitScript + SSR consistente"]),
    tr(["Titileo mapa WebGL", "Hecho — sin backdrop-blur, seed fitBounds suprimido, rAF"]),
    tr(["Ver parada (modal + flyTo)", "Hecho — half a 40dvh, stopFocusNonce, padding 360"]),
    tr(["Branding dark/light", "Hecho — paleta, logo, toggle, manifest/metadata"]),
    tr(["Commits", "Pendiente de pedido explícito del equipo"]),
  ],
}), p(""));
C.push(bold("Branch: ", "fix/routes-home (sin commitear todavía)."));
C.push(bold("Verificación: ", "rtk npx tsc --noEmit → exit 0. No se corre build por convención del equipo."));

await Packer.toBuffer(new Document({
  styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
  sections: [{ children: C }],
})).then((buf) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buf);
  console.log(`[resumen-docx] OK → ${path.relative(ROOT, OUT)} (${buf.length} bytes)`);
});
