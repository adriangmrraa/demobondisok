// Recaptura de escenas con movimiento continuo y sin relleno (v3, supersede capture2.mjs).
// Reglas:
//  1. El scroller se detecta UNA vez por página (es un <main> interno, no el body).
//  2. Velocidad de scroll constante: nunca se frena ni se detiene dentro de una toma.
//  3. Cero relleno: si la acción dura menos que el slot, se ajusta la velocidad con
//     setpts en la conversión; el video nunca muestra un frame congelado.
//  4. Autoverificación: mide movimiento por escena y reintenta si no alcanza.
import {chromium} from '@playwright/test';
import sharp from 'sharp';
import {mkdir, rename, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CAP = path.join(ROOT, 'capture2');
const RAW = path.join(CAP, 'raw');
const LIVE = 'https://demobondisok-ten.vercel.app';
const CHROMIUM = 'C:/Users/Asus/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const TRIP_MAP = `${LIVE}/mapas?trip=1&origen=Parque+Centenario+%2F+Hospital+Durand&origenLat=-34.604463&origenLng=-58.434711&destino=Barrancas+de+Belgrano+%28Cabecera+Norte%29&origenDireccion=Av.+D%C3%ADaz+V%C3%A9lez+y+Leopoldo+Marechal&origenParada=stop-65-05&paradaSubida=stop-65-05&opcion=direct-65-line-65-ida-stop-65-05-stop-65-09&linea=line-65&ramal=ramal-65-troncal&interno=62&etaMin=3`;

const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const ATTEMPTS = Number(process.env.ATTEMPTS || 3);

await mkdir(RAW, {recursive: true});
const browser = await chromium.launch({headless: true, executablePath: CHROMIUM});

function contextOptions(scene) {
  return {
    viewport: {width: 390, height: 844},
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Cordoba',
    geolocation: {latitude: -34.6063, longitude: -58.4352},
    permissions: ['geolocation'],
    recordVideo: {dir: path.join(RAW, `s${String(scene).padStart(2, '0')}`), size: {width: 780, height: 1688}},
  };
}

const sleep = (page, ms) => page.waitForTimeout(ms);

// ---------- dedo ----------
async function fingerIn(page, x, y) {
  await page.evaluate(({x, y}) => {
    document.getElementById('__vf__')?.remove();
    const dot = document.createElement('div');
    dot.id = '__vf__';
    Object.assign(dot.style, {
      position: 'fixed', left: `${x - 22}px`, top: `${y - 22}px`, width: '44px', height: '44px',
      borderRadius: '999px', background: 'rgba(255,255,255,.28)', border: '2px solid #1688ff',
      boxSizing: 'border-box', zIndex: '2147483647', pointerEvents: 'none',
      transform: 'scale(.55)', opacity: '.25',
      transition: 'transform 260ms cubic-bezier(.2,.8,.2,1), opacity 260ms ease',
      boxShadow: '0 6px 18px rgba(0,0,0,.28), 0 0 0 1px rgba(0,0,0,.12)',
    });
    document.body.appendChild(dot);
    requestAnimationFrame(() => { dot.style.transform = 'scale(1)'; dot.style.opacity = '1'; });
  }, {x, y});
  await sleep(page, 260);
}

async function fingerOut(page) {
  await page.evaluate(() => {
    const dot = document.getElementById('__vf__');
    if (!dot) return;
    dot.style.transform = 'scale(1.4)';
    dot.style.opacity = '0';
    setTimeout(() => dot.remove(), 260);
  });
  await sleep(page, 240);
}

async function tapAt(page, x, y) {
  await fingerIn(page, x, y);
  await page.touchscreen.tap(x, y);
  await sleep(page, 200);
  await fingerOut(page);
}

async function tap(page, locator) {
  // timeout corto: si el objetivo no existe, fallar rápido en vez de congelar la escena 30s
  await locator.waitFor({state: 'visible', timeout: 2500}).catch(() => {});
  const box = await locator.boundingBox({timeout: 2500}).catch(() => null);
  if (!box) return null;
  const x = Math.max(6, Math.min(384, Math.round(box.x + box.width / 2)));
  const y = Math.max(6, Math.min(838, Math.round(box.y + box.height / 2)));
  await tapAt(page, x, y);
  return {x, y};
}

async function doubleTap(page, locator) {
  await locator.waitFor({state: 'visible', timeout: 2500}).catch(() => {});
  const box = await locator.boundingBox({timeout: 2500}).catch(() => null);
  if (!box) return null;
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  await fingerIn(page, x, y);
  await page.touchscreen.tap(x, y);
  await sleep(page, 120);
  await page.touchscreen.tap(x, y);
  await sleep(page, 240);
  await fingerOut(page);
}

// ---------- scroller real, cacheado por página ----------
async function primeScroller(page) {
  await page.evaluate(() => {
    const cands = [...document.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el);
      return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 20;
    });
    const best = cands.sort((a, b) =>
      (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0] || document.scrollingElement;
    window.__sc = best;
    window.__scMax = Math.max(0, best.scrollHeight - best.clientHeight);
  });
  return page.evaluate(() => window.__scMax);
}

async function glideTo(page, top, duration) {
  await page.evaluate(({top, duration}) => new Promise((resolve) => {
    const sc = window.__sc || document.scrollingElement;
    const max = window.__scMax ?? (sc.scrollHeight - sc.clientHeight);
    const target = Math.max(0, Math.min(max, top));
    const start = sc.scrollTop;
    const delta = target - start;
    if (Math.abs(delta) < 2) return resolve();
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      sc.scrollTop = start + delta * p;
      if (p < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  }), {top, duration});
  await sleep(page, 120);
}

async function glideBy(page, delta, duration) {
  const at = await page.evaluate(() => (window.__sc || document.scrollingElement).scrollTop);
  await glideTo(page, at + delta, duration);
}

// ---------- mapa ----------
async function mapBox(page) {
  const map = page.locator('.maplibregl-map').first();
  if (!(await map.count())) throw new Error('sin mapa');
  const box = await map.boundingBox();
  if (!box) throw new Error('mapa sin caja');
  return box;
}

async function mapStats(page) {
  const png = await page.locator('.maplibregl-map').first().screenshot();
  const stats = await sharp(png).stats();
  return stats.channels.slice(0, 3).reduce((s, c) => s + c.stdev, 0) / 3;
}

async function mapReady(page, timeoutMs = 7000) {
  const started = Date.now();
  let variance = 0;
  while (Date.now() - started < timeoutMs) {
    await sleep(page, 300);
    variance = await mapStats(page);
    if (variance >= 12) return variance;
  }
  throw new Error(`MAP_TILES_FAILED variance=${variance.toFixed(1)}`);
}

async function pan(page, dx, dy, duration = 3000) {
  const box = await mapBox(page);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 3;
  const steps = Math.max(18, Math.round(duration / 28));
  await page.evaluate(async ({cx, cy, dx, dy, steps, ms}) => {
    const el = document.querySelector('.maplibregl-canvas');
    if (!el) return;
    const mk = (x, y) => new Touch({identifier: 1, target: el, clientX: x, clientY: y});
    const send = (type, x, y) => {
      const t = mk(x, y);
      const list = type === 'touchend' ? [] : [t];
      el.dispatchEvent(new TouchEvent(type, {touches: list, targetTouches: list, changedTouches: [t], bubbles: true, cancelable: true}));
    };
    send('touchstart', cx, cy);
    for (let i = 1; i <= steps; i += 1) {
      send('touchmove', cx + (dx * i) / steps, cy + (dy * i) / steps);
      await new Promise((r) => setTimeout(r, ms / steps));
    }
    send('touchend', cx + dx, cy + dy);
  }, {cx, cy, dx, dy, steps, ms: duration});
  await sleep(page, 220);
}

// control real del mapa por aria-label (acepta varios alias)
async function ctl(page, labels, wait = 850) {
  for (const label of [].concat(labels)) {
    const btn = page.getByRole('button', {name: label, exact: false}).first();
    if (await btn.count()) {
      await tap(page, btn).catch(() => {});
      await sleep(page, wait);
      return true;
    }
  }
  return false;
}

// un "beat" de mapa: zoom animado, paneo táctil, zoom out y posición simulada
async function mapBeat(page, {zooms = 2, panMs = 2600, dx = -150, dy = -95, dark = false} = {}) {
  for (let i = 0; i < zooms; i += 1) await ctl(page, 'Zoom in', 780);
  await pan(page, dx, dy, panMs);
  await ctl(page, 'Zoom out', 760);
  await ctl(page, ['Alternar mi posición simulada'], 700);
  if (dark) {
    await ctl(page, ['Cambiar a modo oscuro', 'Cambiar a modo claro'], 1500);
    await ctl(page, ['Cambiar a modo oscuro', 'Cambiar a modo claro'], 1500);
  }
}

async function zoom(page, ticks, ms = 1400) {
  const box = await mapBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const steps = 10;
  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, (ticks * 100) / steps);
    await sleep(page, Math.round(ms / steps));
  }
  await sleep(page, 350);
}

async function dragAt(page, x, y, dx, dy, ms = 1800) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps);
    await sleep(page, Math.round(ms / steps));
  }
  await page.mouse.up();
  await sleep(page, 450);
}

// /mapas no scrollea la página: el único scroll posible es dentro del panel del viaje.
async function dragPanel(page, dy, ms = 2000) {
  await dragAt(page, 195, 630, 0, dy, ms);
}

async function typeInto(page, locator, text) {
  await tap(page, locator);
  await sleep(page, 350);
  for (const ch of text) {
    await page.keyboard.type(ch);
    await sleep(page, 80);
  }
  await sleep(page, 420);
}

async function open(page, url = LIVE) {
  await page.goto(url, {waitUntil: 'networkidle', timeout: 90000});
  await page.waitForFunction(() => document.body.innerText.trim().length > 120, null, {timeout: 45000});
  await primeScroller(page);
  page.__mark = Date.now();
  return page.__mark;
}

const scenes = [
  {
    id: 1, seconds: 10, shows: 'Apertura real de la app',
    run: async (page) => {
      await open(page);
      const max = await page.evaluate(() => window.__scMax);
      await glideTo(page, Math.min(max, 170), 3600);
      await glideTo(page, 0, 2800);
      await glideTo(page, Math.min(max, 70), 2200);
    },
  },
  {
    id: 2, seconds: 14, shows: 'Inicio: planificación, accesos e historial',
    run: async (page) => {
      await open(page);
      const max = await page.evaluate(() => window.__scMax);
      await glideTo(page, max * 0.45, 4600);
      await glideTo(page, max * 0.9, 4200);
      await glideTo(page, max * 0.6, 3600);
    },
  },
  {
    id: 3, seconds: 16, shows: 'Cuatro caminos desde el inicio',
    run: async (page) => {
      await open(page);
      // camino 1: buscar línea → tipeo real → diagrama de la línea
      await tap(page, page.getByRole('button', {name: /Buscar línea/}).first());
      const input = page.locator('input[type="text"], input[type="search"], input:not([type])').first();
      if (await input.count()) await typeInto(page, input, '194');
      await tap(page, page.getByRole('link', {name: /Ver diagrama/}).first());
      await page.waitForLoadState('networkidle').catch(() => {});
      await primeScroller(page);
      await glideTo(page, 560, 2800);
      // camino 2: volver al inicio y entrar al mapa
      await tap(page, page.getByRole('link', {name: 'Inicio'}).first()).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await primeScroller(page);
      await tap(page, page.getByRole('button', {name: /Explorar mapa/}).first()).catch(() => {});
      await sleep(page, 1200);
      // camino 3: inicio → historial siempre visible → informe de servicio
      await tap(page, page.getByRole('link', {name: 'Inicio'}).first()).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await primeScroller(page);
      const max = await page.evaluate(() => window.__scMax);
      await glideTo(page, max * 0.62, 3200);
      await tap(page, page.getByText(/Demora en la línea 194/).first()).catch(() => {});
      await sleep(page, 900);
      await primeScroller(page);
      await glideTo(page, 640, 2800);
    },
  },
  {
    id: 4, seconds: 12, shows: 'Volver: historial y accesos siempre visibles',
    run: async (page) => {
      await open(page);
      await tap(page, page.getByRole('button').filter({hasText: 'Parque Centenario'}).first());
      await sleep(page, 1500);
      await primeScroller(page).catch(() => {});
      await glideBy(page, 340, 2000).catch(() => {});
      await page.goBack({waitUntil: 'networkidle'});
      await sleep(page, 700);
      await primeScroller(page);
      const max = await page.evaluate(() => window.__scMax);
      await glideTo(page, max * 0.62, 3200);
      await glideTo(page, max * 0.22, 2400);
    },
  },
  {
    id: 5, seconds: 40, shows: 'Llegar al mapa en 1, 2 y 3 toques',
    run: async (page) => {
      await open(page);
      await tap(page, page.getByRole('button', {name: /Explorar mapa/}));
      await mapReady(page);
      await mapBeat(page, {zooms: 2, panMs: 2800, dx: -150, dy: -95});
      await mapBeat(page, {zooms: 1, panMs: 2200, dx: 90, dy: 60});

      await tap(page, page.getByRole('link', {name: 'Inicio'}).first());
      await sleep(page, 1100);
      await primeScroller(page);
      await doubleTap(page, page.getByRole('link', {name: /Modo Viaje/}));
      await mapReady(page);
      await mapBeat(page, {zooms: 2, panMs: 2600, dx: 170, dy: 60});

      await tap(page, page.getByRole('link', {name: 'Inicio'}).first());
      await sleep(page, 1100);
      await primeScroller(page);
      await tap(page, page.getByRole('button').filter({hasText: 'Parque Centenario'}).first());
      await sleep(page, 1400);
      await tap(page, page.getByRole('button').filter({hasText: 'Directo · Línea 65'}).first());
      await sleep(page, 1300);
      await primeScroller(page);
      await glideBy(page, 430, 1800);
      await tap(page, page.getByRole('link', {name: 'Ver el recorrido en el mapa'}));
      await mapReady(page);
      await mapBeat(page, {zooms: 1, panMs: 2600, dx: -120, dy: 70, dark: true});
    },
  },
  {
    id: 6, seconds: 45, shows: 'El mapa: líneas, ramales, paradas y encuadre',
    run: async (page) => {
      await open(page, `${LIVE}/diagrama`);
      await glideTo(page, 620, 4200);
      await glideTo(page, 1300, 4200);
      await glideTo(page, 700, 3200);
      // al mapa en vivo sin recargar: dock → En vivo
      await tap(page, page.getByRole('link', {name: 'En vivo'}).first());
      await mapReady(page);
      await mapBeat(page, {zooms: 2, panMs: 3400, dx: -160, dy: -110});
      await mapBeat(page, {zooms: 1, panMs: 3000, dx: 130, dy: 80, dark: true});
      // recorrido elegido: inicio → historial → opción → mapa (navegación real)
      await tap(page, page.getByRole('link', {name: 'Inicio'}).first()).catch(() => {});
      await sleep(page, 800);
      await primeScroller(page);
      await tap(page, page.getByRole('button').filter({hasText: 'Parque Centenario'}).first());
      await sleep(page, 1200);
      await tap(page, page.getByRole('button').filter({hasText: 'Directo · Línea 65'}).first());
      await sleep(page, 1200);
      await primeScroller(page);
      await glideBy(page, 420, 1600);
      await tap(page, page.getByRole('link', {name: 'Ver el recorrido en el mapa'}));
      await mapReady(page);
      const pasos = page.getByRole('button', {name: 'Pasos', exact: true});
      if (await pasos.count()) {
        await tap(page, pasos);
        await sleep(page, 800);
        await glideBy(page, -300, 2000).catch(() => {});
      }
      await mapBeat(page, {zooms: 1, panMs: 2800, dx: -110, dy: 70});
    },
  },
  {
    id: 7, seconds: 45, shows: 'Modo Viaje: origen, destino, opciones y pasos',
    run: async (page) => {
      await open(page, `${LIVE}/mapas`);
      await mapReady(page);
      // bomba de movimiento: el mapa no anima solo, se panea durante TODO el guion
      let pumping = true;
      const pump = (async () => {
        let k = 0;
        while (pumping) {
          const dx = [150, -160, 130, -140][k % 4];
          const dy = [-95, 100, 85, -90][k % 4];
          await pan(page, dx, dy, 2400).catch(() => {});
          k += 1;
        }
      })();
      try {
        await zoom(page, 1.4, 2600);
        await tap(page, page.getByRole('button', {name: 'Abrir planificador de viaje'}));
        await sleep(page, 900);
        const escribir = page.getByRole('button', {name: /Escribir/}).first();
        if (await escribir.count()) {
          await tap(page, escribir);
          await sleep(page, 500);
          await page.keyboard.type('Aeroparque', {delay: 85}).catch(() => {});
          await sleep(page, 600);
          await page.keyboard.press('Escape').catch(() => {});
          await sleep(page, 250);
        }
        await tap(page, page.getByRole('button', {name: 'Plaza Constitución'}).first());
        await sleep(page, 1800);
        // tras calcular, el mapa queda alejado y sin detalle: acercar
        await ctl(page, 'Zoom in', 900);
        await tap(page, page.getByRole('button', {name: 'Opciones'}).first());
        await sleep(page, 1200);
        await tap(page, page.getByRole('button').filter({hasText: 'Barrancas'}).nth(1));
        await sleep(page, 1500);
        await ctl(page, 'Zoom in', 900);
        await tap(page, page.getByRole('button', {name: 'Pasos'}).first());
        await sleep(page, 1200);
        await dragPanel(page, -200, 1600);
        await ctl(page, ['Alternar mi posición simulada'], 1200);
        await ctl(page, ['Cambiar a modo oscuro', 'Cambiar a modo claro'], 1400);
        await tap(page, page.getByRole('button', {name: 'Opciones'}).first());
        await sleep(page, 1300);
        await ctl(page, ['Cambiar a modo oscuro', 'Cambiar a modo claro'], 1400);
        await tap(page, page.getByRole('button', {name: 'Pasos'}).first());
        await sleep(page, 1200);
        // relleno con cambios reales de cámara (los taps en controles nunca fallan)
        await ctl(page, 'Zoom in', 900);
        await ctl(page, 'Zoom in', 900);
        await ctl(page, 'Zoom out', 900);
        await ctl(page, ['Alternar mi posición simulada'], 1200);
        await ctl(page, 'Zoom in', 900);
        await ctl(page, ['Cambiar a modo oscuro', 'Cambiar a modo claro'], 1400);
        await ctl(page, 'Zoom out', 900);
        await ctl(page, ['Cambiar a modo oscuro', 'Cambiar a modo claro'], 1400);
        await ctl(page, 'Zoom in', 900);
        await ctl(page, 'Zoom out', 900);
        await ctl(page, ['Alternar mi posición simulada'], 1200);
      } finally {
        pumping = false;
        await pump.catch(() => {});
      }
    },
  },
  {
    id: 8, seconds: 31, shows: 'Cierre: producto vivo y desplegado',
    run: async (page) => {
      await open(page);
      const max = await page.evaluate(() => window.__scMax);
      await glideTo(page, max * 0.35, 2600);
      await tap(page, page.getByRole('button', {name: /Explorar mapa/}));
      await mapReady(page);
      await mapBeat(page, {zooms: 2, panMs: 3400, dx: -140, dy: -80});
      await tap(page, page.getByRole('link', {name: 'Diagrama'}).first());
      await sleep(page, 1500);
      await primeScroller(page);
      await glideTo(page, 780, 3200);
      await tap(page, page.getByRole('link', {name: 'En vivo'}).first());
      await mapReady(page);
      await mapBeat(page, {zooms: 2, panMs: 3200, dx: 120, dy: 70, dark: true});
    },
  },
];

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', args, {encoding: 'utf8'});
  if (result.status !== 0) throw new Error(result.stderr?.slice(-1200) || 'ffmpeg failed');
}

function probeDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], {encoding: 'utf8'});
  return Number(r.stdout.trim());
}

function motionStats(file, fps) {
  // muestreo cada 0.5 s: el ojo percibe movimiento lento, frame a frame no se detecta
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf',
    'fps=2,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-',
    '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 1 << 26});
  const values = [...r.stdout.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
  if (!values.length) return {frames: 0, motionPct: 0, longestStatic: 99};
  const moving = values.filter((v) => v > 0.8).length;
  let run = 0;
  let worst = 0;
  for (const v of values) {
    if (v > 0.8) { worst = Math.max(worst, run); run = 0; } else run += 1;
  }
  worst = Math.max(worst, run);
  return {frames: values.length, motionPct: Math.round((100 * moving) / values.length), longestStatic: +(worst / 2).toFixed(2)};
}

const log = [];

for (const scene of scenes) {
  if (ONLY && !ONLY.includes(scene.id)) continue;
  const tag = `s${String(scene.id).padStart(2, '0')}`;
  let done = false;
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS && !done; attempt += 1) {
    const ctx = await browser.newContext(contextOptions(scene.id));
    const createdAt = Date.now();
    const page = await ctx.newPage();
    const video = page.video();
    try {
      await scene.run(page);
      const mark = page.__mark || (createdAt + 3000);
      await ctx.close();
      const rawPath = await video.path();
      const webm = path.join(CAP, `${tag}.webm`);
      await rename(rawPath, webm);

      const rawDuration = probeDuration(webm);
      const markAt = Math.max(0, (mark - createdAt) / 1000 - 0.25);
      const usable = Math.max(1, rawDuration - markAt);
      const ratio = Math.max(0.85, Math.min(1.35, scene.seconds / usable));
      const take = Math.min(usable, scene.seconds / ratio);
      const ready = path.join(CAP, `${tag}-ready.mp4`);
      ffmpeg([
        '-y', '-ss', markAt.toFixed(3), '-t', take.toFixed(3), '-i', webm,
        '-filter:v', `setpts=PTS*${ratio.toFixed(4)},fps=30`,
        '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-g', '10', '-keyint_min', '10', '-sc_threshold', '0', '-movflags', '+faststart', ready,
      ]);
      const readyDuration = probeDuration(ready);
      const motion = motionStats(ready, 30);
      const entry = {
        scene: scene.id, shows: scene.shows, targetSeconds: scene.seconds,
        rawDuration: +rawDuration.toFixed(2), actionStart: +markAt.toFixed(2),
        usable: +usable.toFixed(2), speed: +ratio.toFixed(3),
        readyDuration: +readyDuration.toFixed(2), ...motion, attempt,
      };
      log.push(entry);
      console.log(`${tag} target=${scene.seconds}s raw=${rawDuration.toFixed(1)}s start=${markAt.toFixed(1)}s speed=${ratio.toFixed(2)}x -> ${readyDuration.toFixed(1)}s | motion=${motion.motionPct}% longestStatic=${motion.longestStatic}s`);
      if (motion.motionPct < 55 || motion.longestStatic > 3.0) {
        console.error(`${tag} MOVIMIENTO INSUFICIENTE — reintento`);
        continue;
      }
      done = true;
    } catch (error) {
      lastError = error;
      await ctx.close().catch(() => {});
      console.error(`${tag} intento ${attempt} falló: ${error.message}`);
    }
  }
  if (!done) console.error(`${tag} NO SE PUDO CONFIRMAR: ${lastError?.message || 'movimiento insuficiente'}`);
}

await browser.close();
await writeFile(path.join(CAP, 'capture2-log.json'), `${JSON.stringify(log, null, 2)}\n`);
console.log('log: video/capture2/capture2-log.json');
