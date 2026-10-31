import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const browser = await chromium.launch({headless: true, executablePath: 'C:/Users/Asus/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'});
const context = await browser.newContext({
  viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  locale: 'es-AR', timezoneId: 'America/Argentina/Cordoba',
  geolocation: {latitude: -34.604463, longitude: -58.434711}, permissions: ['geolocation'],
});
const page = await context.newPage();
await mkdir('video/inventory/shots', {recursive: true});

async function state(name) {
  await page.waitForTimeout(3500);
  console.log(`\n=== ${name} ===\nURL ${page.url()}`);
  console.log((await page.locator('body').innerText()).slice(0, 12000));
  console.log('BUTTONS', await page.getByRole('button').allTextContents());
  console.log('LINKS', await page.getByRole('link').allTextContents());
  console.log('STORAGE', await page.evaluate(() => ({local: {...localStorage}, session: {...sessionStorage}})));
  await page.screenshot({path: `video/inventory/shots/recon-${name}.png`, fullPage: true});
}

async function tap(locator, label) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`missing ${label}`);
  const point = {x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2)};
  console.log('TAP', label, point);
  await locator.click();
  await page.waitForTimeout(3500);
}

await page.goto('https://demobondisok-ten.vercel.app', {waitUntil: 'networkidle', timeout: 90000});
await tap(page.getByRole('button').filter({hasText: 'Parque Centenario'}).first(), 'Historial 65 Parque Centenario');
await state('trip-options');
await tap(page.getByRole('button').filter({hasText: 'Directo · Línea 65'}).first(), 'Opción Directo Línea 65');
await state('trip-map-selected');

await tap(page.getByRole('link', {name: 'Ver el recorrido en el mapa'}), 'Ver el recorrido en el mapa');
await state('map-route');

const journeyButton = page.getByRole('button').filter({hasText: /Iniciar|Comenzar|Viaje|viaje/}).first();
if (await journeyButton.count()) {
  await tap(journeyButton, 'Modo viaje');
  await state('trip-mode-active');
}

await page.goto('https://demobondisok-ten.vercel.app/inicio', {waitUntil: 'networkidle', timeout: 90000});
await state('home-after-trip');
await browser.close();
