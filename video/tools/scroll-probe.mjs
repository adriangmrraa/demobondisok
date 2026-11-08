// Sonda de scroll: qué elemento scrollea realmente en cada pantalla y hasta dónde.
import {chromium} from '@playwright/test';
import path from 'node:path';

const LIVE = 'https://demobondisok-ten.vercel.app';
const CHROMIUM = 'C:/Users/Asus/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const browser = await chromium.launch({headless: true, executablePath: CHROMIUM});

const routes = ['/inicio', '/diagrama', '/mapas'];

for (const route of routes) {
  const ctx = await browser.newContext({
    viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: 'es-AR', timezoneId: 'America/Argentina/Cordoba',
    geolocation: {latitude: -34.6063, longitude: -58.4352}, permissions: ['geolocation'],
  });
  const page = await ctx.newPage();
  await page.goto(`${LIVE}${route}`, {waitUntil: 'networkidle', timeout: 90000});
  await page.waitForTimeout(2500);
  const data = await page.evaluate(() => {
    const all = [...document.querySelectorAll('*')];
    const scrollables = all.filter((el) => {
      const s = getComputedStyle(el);
      return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 20;
    }).map((el) => ({
      tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), id: el.id || null,
      scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, max: el.scrollHeight - el.clientHeight,
    }));
    return {
      docMax: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      bodyMax: document.body.scrollHeight - document.body.clientHeight,
      innerHeight: window.innerHeight,
      scrollables,
      textSample: document.body.innerText.slice(0, 120).replace(/\n/g, ' | '),
    };
  });
  console.log(`\n=== ${route} ===`);
  console.log(JSON.stringify(data, null, 2));
  await ctx.close();
}

await browser.close();
