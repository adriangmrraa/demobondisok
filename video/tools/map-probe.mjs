// ¿Qué mueve realmente el mapa? Prueba mouse drag, wheel y botones de la UI,
// comparando screenshots para probar que el contenido cambió.
import {chromium} from '@playwright/test';
import sharp from 'sharp';

const LIVE = 'https://demobondisok-ten.vercel.app';
const CHROMIUM = 'C:/Users/Asus/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const browser = await chromium.launch({headless: true, executablePath: CHROMIUM});
const ctx = await browser.newContext({
  viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  locale: 'es-AR', timezoneId: 'America/Argentina/Cordoba',
  geolocation: {latitude: -34.6063, longitude: -58.4352}, permissions: ['geolocation'],
});
const page = await ctx.newPage();
await page.goto(`${LIVE}/mapas`, {waitUntil: 'networkidle', timeout: 90000});
await page.waitForTimeout(4000);

const map = page.locator('.maplibregl-map').first();
const shot = async (tag) => {
  const png = await map.screenshot({path: `C:/Users/Asus/orca/workspaces/demobondisok/video-explicativo-vertical/video/out/probe-map-${tag}.png`});
  const stats = await sharp(png).stats();
  const raw = await sharp(png).greyscale().raw().toBuffer({resolveWithObject: true});
  return {sum: raw.data.reduce((a, b) => a + b, 0), w: raw.info.width, h: raw.info.height};
};
const diff = (a, b) => Math.abs(a.sum - b.sum) / (a.w * a.h);

// controles reales del mapa
const controls = await page.evaluate(() => [...document.querySelectorAll('.maplibregl-ctrl button, button[aria-label], .maplibregl-ctrl a')]
  .map((el) => ({tag: el.tagName, label: (el.getAttribute('aria-label') || el.title || el.textContent || '').trim().slice(0, 50), cls: (el.className || '').toString().slice(0, 40)}))
  .filter((c) => c.label));
console.log('CONTROLES:', JSON.stringify(controls, null, 1));

// ¿hay instancia de mapa accesible?
const hasMapApi = await page.evaluate(() => ({
  keys: Object.keys(window).filter((k) => /^(map|__map|maplibre|mapbox)/i.test(k)),
  hasMaplibre: typeof window.maplibregl !== 'undefined',
}));
console.log('MAP API:', JSON.stringify(hasMapApi));

const a = await shot('a');

// 1) mouse drag
const box = await map.boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 3;
await page.mouse.move(cx, cy);
await page.mouse.down();
for (let i = 0; i <= 20; i++) { await page.mouse.move(cx - i * 8, cy - i * 5); await page.waitForTimeout(30); }
await page.mouse.up();
await page.waitForTimeout(900);
const b = await shot('b');
console.log('MOUSE DRAG diff:', diff(a, b).toFixed(2));

// 2) wheel zoom
await page.mouse.move(cx, cy);
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -80); await page.waitForTimeout(60); }
await page.waitForTimeout(900);
const c = await shot('c');
console.log('WHEEL ZOOM diff:', diff(b, c).toFixed(2));

// 3) touch drag
await page.touchscreen.tap(cx, cy);
await page.waitForTimeout(300);
const d1 = await shot('d1');
await page.evaluate(async ({cx, cy}) => {
  const el = document.querySelector('.maplibregl-canvas');
  const send = (type, x, y) => {
    const t = new Touch({identifier: 1, target: el, clientX: x, clientY: y});
    el.dispatchEvent(new TouchEvent(type, {touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true}));
  };
  send('touchstart', cx, cy);
  for (let i = 1; i <= 20; i++) { send('touchmove', cx - i * 8, cy - i * 5); await new Promise((r) => setTimeout(r, 30)); }
  send('touchend', cx - 160, cy - 100);
}, {cx, cy});
await page.waitForTimeout(900);
const d2 = await shot('d2');
console.log('TOUCH DRAG diff:', diff(d1, d2).toFixed(2));

// 4) botones de la UI (zoom in/out reales)
const labels = await page.evaluate(() => [...document.querySelectorAll('button')]
  .map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim())
  .filter((t) => t && t.length < 40));
console.log('BOTONES:', JSON.stringify([...new Set(labels)].slice(0, 40)));

await browser.close();
