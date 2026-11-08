// Replica la secuencia de la escena 07 sin grabar, imprimiendo qué pasa en cada paso.
import {chromium} from '@playwright/test';

const LIVE = 'https://demobondisok-ten.vercel.app';
const T0 = Date.now();
const log = (tag, extra = '') => console.log(`${((Date.now() - T0) / 1000).toFixed(1)}s ${tag} ${extra}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({headless: true, executablePath: 'C:/Users/Asus/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'});
const page = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2});
await page.goto(`${LIVE}/mapas`, {waitUntil: 'networkidle', timeout: 90000});
await sleep(2500);
log('abierta /mapas');

const state = async (tag) => {
  const d = await page.evaluate(() => ({
    head: document.body.innerText.replace(/\n{2,}/g, ' | ').slice(0, 260),
    hasModoViaje: document.body.innerText.includes('MODO VIAJE'),
    hasDestino: document.body.innerText.includes('Elegí tu destino'),
    hasViaje: document.body.innerText.includes('Viaje'),
    km: (document.body.innerText.match(/(\d+)\s*km/g) || []).join(','),
  }));
  log(tag, JSON.stringify(d));
};

// drag del mapa como en la escena
const drag = async (dx, dy, ms) => {
  const steps = 12;
  await page.mouse.move(195, 420);
  await page.mouse.down();
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(195 + (dx * i) / steps, 420 + (dy * i) / steps);
    await sleep(Math.round(ms / steps));
  }
  await page.mouse.up();
};

await drag(-130, 85, 2400);
await state('tras pan del mapa');

const btn = page.getByRole('button', {name: 'Abrir planificador de viaje'});
log('boton planificador', `count=${await btn.count()}`);
await btn.click({timeout: 5000}).catch((e) => log('ERROR click planificador', e.message.slice(0, 80)));
await sleep(1500);
await state('tras abrir planificador');

const escribir = page.getByRole('button', {name: /Escribir/}).first();
log('boton escribir', `count=${await page.getByRole('button', {name: /Escribir/}).count()}`);
await escribir.click({timeout: 5000}).catch((e) => log('ERROR click escribir', e.message.slice(0, 80)));
await sleep(800);
await state('tras tocar Escribir');

await page.keyboard.type('Aeroparque', {delay: 110}).catch((e) => log('ERROR tipeo', e.message.slice(0, 80)));
await sleep(1200);
await state('tras tipear Aeroparque');

await page.keyboard.press('Escape').catch(() => {});
await sleep(600);
await state('tras Escape');

const plaza = page.getByRole('button', {name: 'Plaza Constitución'}).first();
log('boton Plaza Constitucion', `count=${await plaza.count()}`);
await plaza.click({timeout: 5000}).catch((e) => log('ERROR click plaza', e.message.slice(0, 80)));
await sleep(2500);
await state('tras elegir destino');

// ¿dibujó recorrido? contar paths SVG del mapa
const paths = await page.evaluate(() => document.querySelectorAll('svg path, canvas').length);
log('paths/canvas en mapa', `n=${paths}`);

const inv = page.getByRole('button', {name: 'Invertir origen y destino'});
log('boton invertir', `count=${await inv.count()}`);
await inv.click({timeout: 5000}).catch((e) => log('ERROR click invertir', e.message.slice(0, 80)));
await sleep(2500);
await state('tras invertir');

// drag dentro del panel del viaje
await page.mouse.move(195, 630);
await page.mouse.down();
for (let i = 1; i <= 12; i += 1) {
  await page.mouse.move(195, 630 - (240 * i) / 12);
  await sleep(200);
}
await page.mouse.up();
await sleep(600);
await state('tras drag del panel');

const ctl = page.getByRole('button', {name: 'Alternar mi posición simulada'});
log('boton mi posicion', `count=${await ctl.count()}`);
await ctl.click({timeout: 5000}).catch((e) => log('ERROR click posicion', e.message.slice(0, 80)));
await sleep(1700);
await state('tras ubicacion simulada');

await browser.close();
