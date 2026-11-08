import {chromium} from '@playwright/test';
import sharp from 'sharp';
import {mkdir, rename, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CAPTURE_DIR = path.join(ROOT, 'capture');
const RAW_DIR = path.join(CAPTURE_DIR, 'raw');
const LIVE = 'https://demobondisok-ten.vercel.app';
const CHROMIUM = 'C:/Users/Asus/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const TRIP_MAP = `${LIVE}/mapas?trip=1&origen=Parque+Centenario+%2F+Hospital+Durand&origenLat=-34.604463&origenLng=-58.434711&destino=Barrancas+de+Belgrano+%28Cabecera+Norte%29&origenDireccion=Av.+D%C3%ADaz+V%C3%A9lez+y+Leopoldo+Marechal&origenParada=stop-65-05&paradaSubida=stop-65-05&opcion=direct-65-line-65-ida-stop-65-05-stop-65-09&linea=line-65&ramal=ramal-65-troncal&interno=62&etaMin=3`;
const sceneDurations = [10, 18, 30, 25, 35, 38, 35, 22];
const startScene = Number(process.env.START_SCENE ?? 1);

await mkdir(RAW_DIR, {recursive: true});

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
    recordVideo: {dir: path.join(RAW_DIR, `scene-${String(scene).padStart(2, '0')}`), size: {width: 780, height: 1688}},
  };
}

async function settle(page, ms = 2500) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(ms);
}

async function finger(page, x, y, {tap = true} = {}) {
  await page.evaluate(({x, y}) => {
    document.getElementById('__video_finger__')?.remove();
    const dot = document.createElement('div');
    dot.id = '__video_finger__';
    Object.assign(dot.style, {
      position: 'fixed', left: `${x - 20}px`, top: `${y - 20}px`, width: '40px', height: '40px',
      borderRadius: '999px', background: 'rgba(255,255,255,.35)', border: '2px solid #1688ff',
      boxSizing: 'border-box', zIndex: '2147483647', pointerEvents: 'none',
      transform: 'scale(.72)', opacity: '.35', transition: 'transform 175ms ease, opacity 175ms ease',
      boxShadow: '0 0 0 1px rgba(0,0,0,.15)',
    });
    document.body.appendChild(dot);
    requestAnimationFrame(() => { dot.style.transform = 'scale(1.12)'; dot.style.opacity = '1'; });
  }, {x, y});
  await page.waitForTimeout(350);
  if (tap) await page.touchscreen.tap(x, y);
  await page.waitForTimeout(250);
  await page.evaluate(() => document.getElementById('__video_finger__')?.remove());
}

async function tapLocator(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('Tap target has no box');
  const x = Math.max(4, Math.min(386, Math.round(box.x + box.width / 2)));
  const y = Math.max(4, Math.min(840, Math.round(box.y + box.height / 2)));
  await finger(page, x, y);
  await page.waitForTimeout(1200);
  return {x, y};
}

async function doubleTapLocator(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('Double tap target has no box');
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  await finger(page, x, y, {tap: false});
  await page.waitForTimeout(120);
  await finger(page, x, y, {tap: false});
  await locator.dblclick({delay: 120});
  await page.waitForTimeout(1800);
}

async function smoothMainScroll(page, top, duration = 1600) {
  await page.evaluate(({top, duration}) => new Promise((resolve) => {
    const scroller = [...document.querySelectorAll('*')].find((el) => {
      const s = getComputedStyle(el);
      return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 80;
    }) ?? document.scrollingElement;
    const start = scroller.scrollTop;
    const delta = top - start;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      scroller.scrollTop = start + delta * eased;
      if (p < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  }), {top, duration});
  await page.waitForTimeout(500);
}

async function mapVariance(page) {
  const map = page.locator('.maplibregl-map').first();
  if (!(await map.count())) return 0;
  const png = await map.screenshot();
  const stats = await sharp(png).stats();
  return stats.channels.slice(0, 3).reduce((sum, channel) => sum + channel.stdev, 0) / 3;
}

async function ensureMapReady(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.waitForTimeout(1800);
    const variance = await mapVariance(page);
    if (variance >= 12) return variance;
  }
  throw new Error('MAP_VARIANCE_FAILED');
}

async function home(page) {
  await page.goto(LIVE, {waitUntil: 'networkidle', timeout: 90000});
  await settle(page, 2200);
}

const actions = [
  async (page) => {
    await home(page);
    await smoothMainScroll(page, 130, 1200);
    await smoothMainScroll(page, 0, 900);
  },
  async (page) => {
    await home(page);
    await smoothMainScroll(page, 560, 2600);
    await smoothMainScroll(page, 850, 1800);
    await smoothMainScroll(page, 360, 1800);
  },
  async (page) => {
    await home(page);
    for (const target of [
      page.getByRole('button', {name: /Buscar línea/}),
      page.getByRole('button', {name: /Paradas cerca/}),
      page.getByRole('button', {name: /¿A dónde vas\?/}),
      page.getByRole('button', {name: /Explorar mapa/}),
    ]) {
      const box = await target.boundingBox();
      if (box) await finger(page, Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2), {tap: false});
      await page.waitForTimeout(650);
    }
    await smoothMainScroll(page, 520, 2200);
  },
  async (page) => {
    await home(page);
    await tapLocator(page, page.getByRole('button').filter({hasText: 'Parque Centenario'}).first());
    await page.waitForTimeout(2200);
    await page.goBack({waitUntil: 'networkidle'});
    await settle(page, 1700);
    await smoothMainScroll(page, 500, 1800);
    await smoothMainScroll(page, 0, 1500);
  },
  async (page) => {
    await home(page);
    await tapLocator(page, page.getByRole('button', {name: /Explorar mapa/}));
    await ensureMapReady(page);
    await doubleTapLocator(page, page.getByRole('link', {name: /Modo Viaje/}));
    await ensureMapReady(page);
    await tapLocator(page, page.getByRole('button', {name: 'Cerrar modo Viaje'}));
    await tapLocator(page, page.getByRole('link', {name: 'Inicio'}));
    await tapLocator(page, page.getByRole('button').filter({hasText: 'Parque Centenario'}).first());
    await tapLocator(page, page.getByRole('button').filter({hasText: 'Directo · Línea 65'}).first());
    await tapLocator(page, page.getByRole('link', {name: 'Ver el recorrido en el mapa'}));
    await ensureMapReady(page);
  },
  async (page) => {
    await page.goto(`${LIVE}/diagrama`, {waitUntil: 'networkidle', timeout: 90000});
    await settle(page, 2500);
    await smoothMainScroll(page, 560, 2600);
    await smoothMainScroll(page, 1120, 2300);
    await page.goto(TRIP_MAP, {waitUntil: 'networkidle', timeout: 90000});
    await settle(page, 2200);
    await ensureMapReady(page);
    await tapLocator(page, page.getByRole('button', {name: 'Pasos', exact: true}));
  },
  async (page) => {
    await page.goto(`${LIVE}/mapas`, {waitUntil: 'networkidle', timeout: 90000});
    await settle(page, 2200);
    await ensureMapReady(page);
    await doubleTapLocator(page, page.getByRole('link', {name: /Modo Viaje/}));
    await tapLocator(page, page.getByRole('button', {name: 'Plaza Constitución'}));
    await ensureMapReady(page);
    const steps = page.getByRole('button', {name: 'Pasos', exact: true});
    if (await steps.count()) await tapLocator(page, steps);
  },
  async (page) => {
    await home(page);
    await smoothMainScroll(page, 480, 1500);
    await tapLocator(page, page.getByRole('link', {name: 'En vivo'}));
    await ensureMapReady(page);
    await page.goto(TRIP_MAP, {waitUntil: 'networkidle', timeout: 90000});
    await settle(page, 1800);
    await ensureMapReady(page);
  },
];

const manifest = [];

for (let index = 0; index < actions.length; index += 1) {
  const scene = index + 1;
  if (scene < startScene) continue;
  let completed = false;
  let lastError;
  for (let retry = 1; retry <= 3 && !completed; retry += 1) {
    const ctx = await browser.newContext(contextOptions(scene));
    const pageCreatedAt = Date.now();
    const page = await ctx.newPage();
    const video = page.video();
    try {
      await actions[index](page);
      const elapsed = Date.now() - pageCreatedAt;
      await page.waitForTimeout(Math.max(2000, (sceneDurations[index] + 4) * 1000 - elapsed));
      await ctx.close();
      const rawPath = await video.path();
      const webm = path.join(CAPTURE_DIR, `scene-${String(scene).padStart(2, '0')}.webm`);
      await rename(rawPath, webm);
      const mp4 = webm.replace(/\.webm$/, '.mp4');
      const ffmpeg = spawnSync('ffmpeg', ['-y', '-i', webm, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], {encoding: 'utf8'});
      if (ffmpeg.status !== 0) throw new Error(ffmpeg.stderr);
      const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', mp4], {encoding: 'utf8'});
      const duration = Number(probe.stdout.trim());
      manifest.push({scene, file: `scene-${String(scene).padStart(2, '0')}.mp4`, source: `scene-${String(scene).padStart(2, '0')}.webm`, frames: Math.floor(duration * 30), duration, trimStartSeconds: 3, targetDuration: sceneDurations[index], retry, shows: [
        'Live app opening', 'Home, navigation and history', 'First-arrival paths', 'Same home state after trip',
        'Real access paths and tap counts', 'Network diagram and selected map route', 'Modo Viaje', 'Live product closing montage',
      ][index]});
      completed = true;
      console.log(`Captured scene ${scene}: ${duration.toFixed(3)}s, retry ${retry}`);
    } catch (error) {
      lastError = error;
      await ctx.close().catch(() => {});
      console.error(`Scene ${scene} retry ${retry} failed:`, error.message);
    }
  }
  if (!completed) throw lastError;
}

await browser.close();
await writeFile(path.join(CAPTURE_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
