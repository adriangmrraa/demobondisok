// ¿El paneo mueve el mapa de verdad? Dos capturas y diff de píxeles.
import {chromium} from '@playwright/test';
import sharp from 'sharp';

const LIVE = 'https://demobondisok-ten.vercel.app';
const browser = await chromium.launch({headless: true, executablePath: 'C:/Users/Asus/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'});
const page = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
await page.goto(`${LIVE}/mapas`, {waitUntil: 'networkidle', timeout: 90000});
await page.waitForTimeout(3000);

const canvases = await page.evaluate(() => [...document.querySelectorAll('canvas')].map((c) => `${c.className}|${c.width}x${c.height}`));
console.log('canvases:', canvases);

const rawA = await page.screenshot();
await page.waitForTimeout(300);

// el pan() EXACTO de capture3.mjs
await page.evaluate(async () => {
  const el = document.querySelector('.maplibregl-canvas');
  if (!el) { console.log('NO MAPLIBRE CANVAS'); return; }
  const cx = 195;
  const cy = 280;
  const dx = -150;
  const dy = 95;
  const steps = 60;
  const ms = 2600;
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
});
await page.waitForTimeout(400);
const rawB = await page.screenshot();

const a = await sharp(rawA).greyscale().raw().toBuffer();
const b = await sharp(rawB).greyscale().raw().toBuffer();
let sum = 0;
let big = 0;
for (let i = 0; i < a.length; i += 1) {
  const d = Math.abs(a[i] - b[i]);
  sum += d;
  if (d > 12) big += 1;
}
console.log(`px=${a.length} diff medio=${(sum / a.length).toFixed(2)} px cambiados(>12)=${((100 * big) / a.length).toFixed(1)}%`);

// segundo control: zoom in por botón
const zoomin = page.getByRole('button', {name: 'Zoom in'}).first();
await zoomin.click().catch(() => {});
await page.waitForTimeout(900);
const rawC = await page.screenshot();
const c = await sharp(rawC).greyscale().raw().toBuffer();
let sum2 = 0;
for (let i = 0; i < b.length; i += 1) sum2 += Math.abs(b[i] - c[i]);
console.log(`zoom in: diff medio=${(sum2 / b.length).toFixed(2)}`);

await browser.close();
