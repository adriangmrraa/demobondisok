// ¿Qué hace la tarjeta frame a frame? Abre el compositor y mira el DOM real.
import {chromium} from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const HERE = 'C:/Users/Asus/orca/workspaces/demobondisok/video-explicativo-vertical/video/render';
const MIME = {'.html': 'text/html; charset=utf-8', '.json': 'application/json', '.mp4': 'video/mp4'};
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = url.startsWith('/capture/')
    ? path.join('C:/Users/Asus/orca/workspaces/demobondisok/video-explicativo-vertical/video/capture2', url.slice(9))
    : path.join(HERE, url.replace('/render/', '') || 'compositor.html');
  try {
    const stat = fs.statSync(file);
    res.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Content-Length': stat.size, 'Accept-Ranges': 'bytes'});
    fs.createReadStream(file).pipe(res);
  } catch (e) { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const cfg = JSON.parse(fs.readFileSync(path.join(HERE, 'timeline.json'), 'utf8'));
const browser = await chromium.launch({headless: true, executablePath: 'C:/Users/Asus/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'});
const page = await browser.newPage({viewport: {width: 1080, height: 1920}, deviceScaleFactor: 1});
await page.goto(`http://127.0.0.1:${port}/render/compositor.html`, {waitUntil: 'load'});
await page.evaluate((c) => window.setFps(c.fps), cfg);
await page.evaluate((c) => window.boot(c), cfg);

for (const t of [213.2, 214.0, 215.0, 216.5, 218.0, 219.9]) {
  await page.evaluate((tt) => window.setTime(tt), t);
  const info = await page.evaluate(() => {
    const card = document.getElementById('card');
    const rows = [...document.querySelectorAll('#cardRows .row')].map((el) => ({
      id: el.id,
      op: getComputedStyle(el).opacity,
      tr: getComputedStyle(el).transform,
      text: el.textContent.trim().slice(0, 40),
    }));
    return {
      cardVisible: card.classList.contains('visible'),
      cardVis: getComputedStyle(card).visibility,
      cardTransform: card.style.transform,
      kicker: document.getElementById('cardKicker').textContent,
      kickerOp: getComputedStyle(document.getElementById('cardKicker')).opacity,
      head: document.getElementById('cardHead').textContent.slice(0, 40),
      headOp: getComputedStyle(document.getElementById('cardHead')).opacity,
      rows,
      contentOp: getComputedStyle(document.getElementById('content')).opacity,
      phoneDisp: getComputedStyle(document.getElementById('phone')).display,
    };
  });
  console.log(t, JSON.stringify(info));
}

const shot = await page.screenshot({path: 'C:/Users/Asus/orca/workspaces/demobondisok/video-explicativo-vertical/video/out/card-probe.png'});
console.log('screenshot bytes', shot.length);
await browser.close();
server.close();
