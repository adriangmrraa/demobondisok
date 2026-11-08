// ¿Qué hay REALMENTE en /mapas a 390x844? Sin adivinar.
import {chromium} from '@playwright/test';

const LIVE = 'https://demobondisok-ten.vercel.app';
const browser = await chromium.launch({headless: true, executablePath: 'C:/Users/Asus/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'});
const page = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2});
await page.goto(`${LIVE}/mapas`, {waitUntil: 'networkidle', timeout: 90000}).catch((e) => console.log('goto err', e.message));
await page.waitForTimeout(2500);

const dump = await page.evaluate(() => {
  const acc = (el) => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 70);
  const clickable = [...document.querySelectorAll('button, a, [role="button"], input')].map((el) => ({
    tag: el.tagName.toLowerCase(),
    acc: acc(el),
    ph: el.getAttribute('placeholder') || '',
  })).filter((x) => x.acc || x.ph);
  return {
    url: location.href,
    text: document.body.innerText.replace(/\n{2,}/g, '\n').slice(0, 1200),
    clickable: clickable.slice(0, 45),
    scrollH: document.documentElement.scrollHeight,
    viewH: window.innerHeight,
    mapEls: document.querySelectorAll('.maplibregl-map, .leaflet-container, canvas').length,
  };
});
console.log('URL', dump.url);
console.log('scroll', dump.scrollH, 'view', dump.viewH, 'mapEls', dump.mapEls);
console.log('--- TEXTO ---');
console.log(dump.text);
console.log('--- CLICKEABLES ---');
for (const c of dump.clickable) console.log(`[${c.tag}] ${c.acc}${c.ph ? ` (ph=${c.ph})` : ''}`);
await browser.close();
