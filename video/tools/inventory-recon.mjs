import {chromium} from '@playwright/test';

const LIVE = 'https://demobondisok-ten.vercel.app';
const EXECUTABLE = 'C:/Users/Asus/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const browser = await chromium.launch({headless: true, executablePath: EXECUTABLE});

async function context() {
  return browser.newContext({
    viewport: {width: 390, height: 844},
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Cordoba',
    geolocation: {latitude: -34.6063, longitude: -58.4352},
    permissions: ['geolocation'],
  });
}

async function openHome() {
  const ctx = await context();
  const page = await ctx.newPage();
  await page.goto(LIVE, {waitUntil: 'networkidle', timeout: 90_000});
  await page.waitForTimeout(3000);
  return {ctx, page};
}

async function snapshot(page, name) {
  console.log(`\n=== ${name} ===`);
  console.log('URL', page.url());
  console.log((await page.locator('body').innerText()).slice(0, 9000));
  console.log('BUTTONS', await page.getByRole('button').allTextContents());
  console.log('LINKS', await page.getByRole('link').allTextContents());
  await page.screenshot({path: `video/inventory/shots/recon-${name}.png`, fullPage: true});
}

async function tap(page, locator, label) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`No bounding box for ${label}`);
  const point = {x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2)};
  console.log('TAP', label, point);
  await locator.click();
  await page.waitForTimeout(3500);
  return point;
}

await import('node:fs/promises').then((fs) => fs.mkdir('video/inventory/shots', {recursive: true}));

for (const flow of ['history', 'search-line', 'nearby', 'alert', 'nav-diagram']) {
  const {ctx, page} = await openHome();
  try {
    if (flow === 'home') await snapshot(page, 'home');
    if (flow === 'plan') {
      await tap(page, page.getByRole('button', {name: /¿A dónde vas\?/}), '¿A dónde vas?');
      await snapshot(page, 'plan-trip');
    }
    if (flow === 'explore') {
      await tap(page, page.getByRole('button', {name: /Explorar mapa/}), 'Explorar mapa');
      await snapshot(page, 'explore-map');
    }
    if (flow === 'history') {
      await tap(page, page.getByRole('button').filter({hasText: 'Parque Centenario'}).first(), 'Historial 65 Parque Centenario');
      await snapshot(page, 'history-trip');
    }
    if (flow === 'search-line') {
      await tap(page, page.getByRole('button', {name: /Buscar línea/}), 'Buscar línea');
      await snapshot(page, 'line-lookup');
    }
    if (flow === 'nearby') {
      await tap(page, page.getByRole('button', {name: /Paradas cerca/}), 'Paradas cerca');
      await snapshot(page, 'nearby');
    }
    if (flow === 'alert') {
      await tap(page, page.getByRole('link', {name: /Demora en la línea 194/}), 'Alerta 194');
      await snapshot(page, 'alert-detail');
    }
    if (flow === 'nav-diagram') {
      await tap(page, page.getByRole('link', {name: 'Diagrama'}), 'Diagrama');
      await snapshot(page, 'diagram');
    }
  } finally {
    await ctx.close();
  }
}

await browser.close();
