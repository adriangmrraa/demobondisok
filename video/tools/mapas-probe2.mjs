// Recorre el flujo real de /mapas a 390x844 y reporta qué se puede filmar.
import {chromium} from '@playwright/test';

const LIVE = 'https://demobondisok-ten.vercel.app';
const browser = await chromium.launch({headless: true, executablePath: 'C:/Users/Asus/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'});
const page = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2});
await page.goto(`${LIVE}/mapas`, {waitUntil: 'networkidle', timeout: 90000});
await page.waitForTimeout(2500);

const snap = async (label) => {
  const d = await page.evaluate(() => ({
    text: document.body.innerText.replace(/\n{2,}/g, '\n').slice(0, 900),
    scrollH: document.documentElement.scrollHeight,
    viewH: window.innerHeight,
    clickables: [...document.querySelectorAll('button, a, [role="button"], input')]
      .map((el) => `${el.tagName.toLowerCase()}:${(el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 55)}`)
      .filter((s) => s.length > 6)
      .slice(0, 30),
  }));
  console.log(`\n===== ${label} ===== scroll=${d.scrollH}/${d.viewH}`);
  console.log(d.text);
  console.log('-- clickeables:', d.clickables.join(' | '));
  return d;
};

// 1) buscar una calle en el buscador del mapa
const input = page.locator('input').first();
console.log('inputs:', await page.locator('input').count());
await input.click().catch(() => {});
await input.fill('Corrientes 1200').catch(() => {});
await page.waitForTimeout(1800);
await snap('busqueda Corrientes 1200');

// 2) abrir el planificador
await page.getByRole('button', {name: 'Abrir planificador de viaje'}).click().catch((e) => console.log('err planif', e.message));
await page.waitForTimeout(1800);
await snap('planificador abierto');

// 3) si hay campos, cargar origen y destino
const inputs = await page.locator('input').count();
console.log('\ninputs tras abrir planificador:', inputs);
if (inputs >= 2) {
  await page.locator('input').nth(0).fill('Parque Centenario').catch(() => {});
  await page.waitForTimeout(1200);
  await snap('origen escrito');
  await page.locator('input').nth(1).fill('Aeroparque').catch(() => {});
  await page.waitForTimeout(1200);
  await snap('destino escrito');
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(2500);
  await snap('resultado del viaje');
}

await browser.close();
