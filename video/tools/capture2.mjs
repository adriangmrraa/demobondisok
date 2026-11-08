// Recaptura de escenas con movimiento continuo y sin relleno.
// Regla: cada segundo grabado tiene que tener movimiento. Si la acción dura menos
// que el slot de la escena, se ajusta la velocidad con setpts en la conversión;
// nunca se rellena con espera.
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

// ---------- dedo visible: aparece, pulsa, se va ----------
async function fingerIn(page, x, y) {
  await page.evaluate(({x, y}) => {
    document.getElementById('__vf__')?.remove();
    const dot = document.createElement('div');
    dot.id = '__vf__';
    Object.assign(dot.style, {
      position: 'fixed', left: `${x - 22}px`, top: `${y - 22}px`, width: '44px', height: '44px',
      borderRadius: '999px', background: 'rgba(255,255,255,.28)', border: '2px solid #1688ff',
      boxSizing: 'border-box', zIndex: '2147483647', pointerEvents: 'none',
      transform: 'scale(.55)', opacity: '.25', transition: 'transform 260ms cubic-bezier(.2,.8,.2,1), opacity 260ms ease',
      boxShadow: '0 6px 18px rgba(0,0,0,.28), 0 0 0 1px rgba(0,0,0,.12)',
    });
    document.body.appendChild(dot);
    requestAnimationFrame(() => { dot.style.transform = 'scale(1)'; dot.style.opacity = '1'; });
  }, {x, y});
  await sleep(page, 300);
}

async function fingerOut(page) {
  await page.evaluate(() => {
    const dot = document.getElementById('__vf__');
    if (!dot) return;
    dot.style.transform = 'scale(1.45)';
    dot.style.opacity = '0';
    setTimeout(() => dot.remove(), 280);
  });
  await sleep(page, 300);
}

async function tapAt(page, x, y) {
  await fingerIn(page, x, y);
  await page.touchscreen.tap(x, y);
  await sleep(page, 220);
  await fingerOut(page);
}

async function tap(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('tap target sin caja');
  const x = Math.max(6, Math.min(384, Math.round(box.x + box.width / 2)));
  const y = Math.max(6, Math.min(838, Math.round(box.y + box.height / 2)));
  await tapAt(page, x, y);
  return {x, y};
}

async function doubleTap(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('double tap target sin caja');
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  await fingerIn(page, x, y);
  await page.touchscreen.tap(x, y);
  await sleep(page, 130);
  await page.touchscreen.tap(x, y);
  await sleep(page, 260);
  await fingerOut(page);
}

// ---------- scroll suave real ----------
async function scrollTo(page, top, duration = 1600) {
  await page.evaluate(({top, duration}) => new Promise((resolve) => {
    const scroller = [...document.querySelectorAll('*')].find((el) => {
      const s = getComputedStyle(el);
      return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 80;
    }) ?? document.scrollingElement;
    const start = scroller.scrollTop;
    const delta = top - start;
    if (Math.abs(delta) < 2) return resolve();
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      scroller.scrollTop = start + delta * eased;
      if (p < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  }), {top, duration});
}

async function scrollBy(page, delta, duration = 1400) {
  const current = await page.evaluate(() => {
    const scroller = [...document.querySelectorAll('*')].find((el) => {
      const s = getComputedStyle(el);
      return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 80;
    }) ?? document.scrollingElement;
    return scroller.scrollTop;
  });
  await scrollTo(page, current + delta, duration);
}

// ---------- mapa: paneo y zoom con movimiento real ----------
async function mapBox(page) {
  const map = page.locator('.maplibregl-map').first();
  if (!(await map.count())) throw new Error('sin mapa');
  const box = await map.boundingBox();
  if (!box) throw new Error('mapa sin caja');
  return box;
}

async function mapStats(page) {
  const map = page.locator('.maplibregl-map').first();
  const png = await map.screenshot();
  const stats = await sharp(png).stats();
  return stats.channels.slice(0, 3).reduce((s, c) => s + c.stdev, 0) / 3;
}

async function mapReady(page, attempts = 4) {
  let variance = 0;
  for (let i = 0; i < attempts; i += 1) {
    await sleep(page, 1500);
    variance = await mapStats(page);
    if (variance >= 12) return variance;
  }
  throw new Error(`MAP_TILES_FAILED variance=${variance.toFixed(1)}`);
}

async function pan(page, dx, dy, duration = 3000) {
  const box = await mapBox(page);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 3;
  const steps = Math.max(12, Math.round(duration / 40));
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(cx + (dx * i) / steps, cy + (dy * i) / steps);
    await sleep(page, Math.round(duration / steps));
  }
  await page.mouse.up();
  await sleep(page, 200);
}

async function zoom(page, ticks, ms = 1200) {
  const box = await mapBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const steps = 8;
  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, (ticks * 100) / steps);
    await sleep(page, Math.round(ms / steps));
  }
  await sleep(page, 400);
}

async function typeInto(page, locator, text) {
  await tap(page, locator);
  await sleep(page, 400);
  for (const ch of text) {
    await page.keyboard.type(ch);
    await sleep(page, 85);
  }
  await sleep(page, 500);
}

async function open(page, url = LIVE) {
  await page.goto(url, {waitUntil: 'networkidle', timeout: 90000});
  await page.waitForLoadState('domcontentloaded');
}

const scenes = [
  {
    id: 1, seconds: 10, shows: 'Apertura real de la app',
    run: async (page) => {
      await open(page);
      await scrollTo(page, 130, 2600);
      await scrollTo(page, 0, 2200);
      await scrollTo(page, 90, 1800);
    },
  },
  {
    id: 2, seconds: 14, shows: 'Inicio: planificación, accesos e historial',
    run: async (page) => {
      await open(page);
      await scrollTo(page, 420, 3200);
      await scrollTo(page, 860, 3000);
      await scrollTo(page, 560, 2600);
    },
  },
  {
    id: 3, seconds: 16, shows: 'Cuatro caminos desde el inicio',
    run: async (page) => {
      await open(page);
      for (const name of [/Buscar línea/, /Explorar mapa/, /Paradas cerca/, /¿A dónde vas\?/]) {
        await tap(page, page.getByRole('button', {name}).first());
        await sleep(page, 520);
        await page.keyboard.press('Escape').catch(() => {});
        await page.locator('body').click({position: {x: 380, y: 30}}).catch(() => {});
        await sleep(page, 380);
      }
      await scrollTo(page, 520, 2600);
    },
  },
  {
    id: 4, seconds: 12, shows: 'Volver: historial y accesos siempre visibles',
    run: async (page) => {
      await open(page);
      await tap(page, page.getByRole('button').filter({hasText: 'Parque Centenario'}).first());
      await sleep(page, 1600);
      await tap(page, page.getByRole('link', {name: 'Inicio'}).first());
      await page.waitForURL(/inicio/, {timeout: 30000}).catch(() => {});
      await sleep(page, 900);
      await scrollTo(page, 520, 2400);
    },
  },
  {
    id: 5, seconds: 40, shows: 'Llegar al mapa en 1, 2 y 3 toques',
    run: async (page) => {
      await open(page);
      // 1 toque: mapa libre
      await tap(page, page.getByRole('button', {name: /Explorar mapa/}));
      await mapReady(page);
      await pan(page, -150, -90, 2600);
      await zoom(page, -4, 1400);
      await zoom(page, 3, 1200);
      // 2 toques: Modo Viaje
      await tap(page, page.getByRole('link', {name: 'Inicio'}).first());
      await sleep(page, 1200);
      await doubleTap(page, page.getByRole('link', {name: /Modo Viaje/}));
      await mapReady(page);
      await pan(page, 170, 60, 2400);
      await zoom(page, 2, 1200);
      // 3 toques: recorrido elegido
      await tap(page, page.getByRole('link', {name: 'Inicio'}).first());
      await sleep(page, 1200);
      await tap(page, page.getByRole('button').filter({hasText: 'Parque Centenario'}).first());
      await sleep(page, 1500);
      await tap(page, page.getByRole('button').filter({hasText: 'Directo · Línea 65'}).first());
      await sleep(page, 1400);
      await scrollBy(page, 420, 1600);
      await tap(page, page.getByRole('link', {name: 'Ver el recorrido en el mapa'}));
      await mapReady(page);
      await pan(page, -120, 70, 3000);
    },
  },
  {
    id: 6, seconds: 45, shows: 'El mapa: líneas, ramales, paradas y encuadre',
    run: async (page) => {
      await open(page, `${LIVE}/diagrama`);
      await scrollTo(page, 420, 3000);
      await scrollTo(page, 900, 3000);
      await tap(page, page.getByRole('button', {name: /Ver el recorrido/i}).first().or(page.getByText(/Línea 65/).first())).catch(() => {});
      await open(page, TRIP_MAP);
      await mapReady(page);
      await pan(page, -160, -110, 3400);
      await zoom(page, -3, 1500);
      await pan(page, 130, 80, 3000);
      await zoom(page, 3, 1500);
      const pasos = page.getByRole('button', {name: 'Pasos', exact: true});
      if (await pasos.count()) {
        await tap(page, pasos);
        await sleep(page, 900);
        await scrollBy(page, -380, 1800);
      }
      await pan(page, -90, 60, 2800);
    },
  },
  {
    id: 7, seconds: 45, shows: 'Modo Viaje: origen, destino, opciones y pasos',
    run: async (page) => {
      await open(page, `${LIVE}/mapas`);
      await mapReady(page);
      await doubleTap(page, page.getByRole('link', {name: /Modo Viaje/}));
      await sleep(page, 1400);
      await pan(page, -90, 50, 2200);
      const escribir = page.getByRole('button', {name: /Escribir/}).first();
      if (await escribir.count()) {
        await typeInto(page, escribir, 'Plaza Cons');
        await sleep(page, 700);
      }
      await tap(page, page.getByRole('button', {name: 'Plaza Constitución'}).first());
      await mapReady(page);
      await pan(page, 120, -70, 2600);
      await scrollBy(page, 300, 2000);
      const pasos = page.getByRole('button', {name: 'Pasos', exact: true});
      if (await pasos.count()) {
        await tap(page, pagetext(pasos));
        await sleep(page, 1000);
        await scrollBy(page, 420, 2600);
        await scrollBy(page, -260, 1800);
      }
      await zoom(page, -3, 1500);
      await pan(page, -110, 60, 2800);
    },
  },
  {
    id: 8, seconds: 31, shows: 'Cierre: producto vivo y desplegado',
    run: async (page) => {
      await open(page);
      await scrollTo(page, 300, 2200);
      await tap(page, page.getByRole('button', {name: /Explorar mapa/}));
      await mapReady(page);
      await pan(page, -140, -80, 3200);
      await tap(page, page.getByRole('link', {name: 'Diagrama'}).first());
      await sleep(page, 1600);
      await scrollTo(page, 700, 2800);
      await tap(page, page.getByRole('link', {name: 'En vivo'}).first());
      await mapReady(page);
      await zoom(page, 3, 1400);
      await pan(page, 120, 70, 3000);
    },
  },
];

function pagetext(locator) { return locator; }

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', args, {encoding: 'utf8'});
  if (result.status !== 0) throw new Error(result.stderr?.slice(-1200) || 'ffmpeg failed');
}

function probeDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], {encoding: 'utf8'});
  return Number(r.stdout.trim());
}

const log = [];

for (const scene of scenes) {
  if (ONLY && !ONLY.includes(scene.id)) continue;
  const tag = `s${String(scene.id).padStart(2, '0')}`;
  let done = false;
  let lastError;
  for (let attempt = 1; attempt <= 3 && !done; attempt += 1) {
    const ctx = await browser.newContext(contextOptions(scene.id));
    const createdAt = Date.now();
    const page = await ctx.newPage();
    const video = page.video();
    try {
      await scene.run(page);
      const actionSeconds = (Date.now() - createdAt) / 1000;
      await ctx.close();
      const rawPath = await video.path();
      const webm = path.join(CAP, `${tag}.webm`);
      await rename(rawPath, webm);

      const rawDuration = probeDuration(webm);
      // el arranque (carga + tiles) se recorta; el resto tiene que cubrir el slot
      const trimStart = Math.max(1.8, Math.min(6.5, rawDuration - actionSeconds + 1.2));
      const usable = rawDuration - trimStart;
      const ratio = Math.max(0.85, Math.min(1.45, scene.seconds / usable));
      const take = Math.min(usable, scene.seconds / ratio);
      const ready = path.join(CAP, `${tag}-ready.mp4`);
      ffmpeg([
        '-y', '-ss', String(trimStart), '-t', String(take), '-i', webm,
        '-filter:v', `setpts=PTS*${ratio.toFixed(4)},fps=30`,
        '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-g', '10', '-keyint_min', '10', '-sc_threshold', '0', '-movflags', '+faststart', ready,
      ]);
      const readyDuration = probeDuration(ready);
      log.push({scene: scene.id, shows: scene.shows, target: scene.seconds, rawDuration: +rawDuration.toFixed(2), trimStart: +trimStart.toFixed(2), usable: +usable.toFixed(2), speedRatio: +ratio.toFixed(3), readyDuration: +readyDuration.toFixed(2), attempt});
      console.log(`${tag} OK target=${scene.seconds}s raw=${rawDuration.toFixed(2)}s trim=${trimStart.toFixed(2)}s speed=${ratio.toFixed(2)}x ready=${readyDuration.toFixed(2)}s`);
      done = true;
    } catch (error) {
      lastError = error;
      await ctx.close().catch(() => {});
      console.error(`${tag} intento ${attempt} falló: ${error.message}`);
    }
  }
  if (!done) console.error(`${tag} NO SE PUDO: ${lastError?.message}`);
}

await browser.close();
await writeFile(path.join(CAP, 'capture2-log.json'), `${JSON.stringify(log, null, 2)}\n`);
console.log('log escrito en capture2/capture2-log.json');
