import { webkit, devices } from '@playwright/test';

const url = process.argv[2] ?? 'https://demobondisok-ten.vercel.app/mapas';
const out = process.argv[3] ?? 'C:/Users/Usuario/AppData/Local/Temp/opencode/verify-webkit.png';
const iPhone = devices['iPhone 11'] ?? {
  viewport: { width: 414, height: 715 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1',
};
console.log('device:', iPhone.viewport?.width + 'x' + iPhone.viewport?.height, 'dpr=' + iPhone.deviceScaleFactor);

const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ ...iPhone });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 250));
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 250)));
page.on('requestfailed', (r) =>
  errors.push('REQFAIL: ' + r.url().slice(0, 120) + ' ' + (r.failure()?.errorText ?? ''))
);

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(12000);

const info = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  const r = c ? c.getBoundingClientRect() : null;
  return {
    canvas: c ? { cssW: r.width, cssH: r.height, w: c.width, h: c.height } : null,
    text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 180),
    hasInlineTranslate: !!document.querySelector('[style*="translateZ"], [style*="translate3d"]'),
  };
});

await page.screenshot({ path: out });
console.log(JSON.stringify({ info, errors: errors.slice(0, 8) }, null, 2));
await browser.close();
