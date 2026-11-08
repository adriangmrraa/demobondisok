// Frame-accurate compositor for the Demobondis explainer.
// Renders an HTML timeline (video inside a phone mock + animated copy) frame by
// frame with Playwright, pipes the JPEG frames straight into ffmpeg, and
// concatenates the chunks into the final MP4. No extra dependencies: it uses the
// Playwright that the repo already has.
import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');          // worktree root
const OUT_DIR = path.join(ROOT, 'video', 'out');
const WORKERS = Number(process.env.WORKERS || 3);
const FPS = Number(process.env.FPS || 30);
const CRF = Number(process.env.CRF || 20);
const LIMIT_FRAMES = process.env.LIMIT_FRAMES ? Number(process.env.LIMIT_FRAMES) : 0;
const START_FRAME = process.env.START_FRAME ? Number(process.env.START_FRAME) : 0;
const FINAL = process.env.FINAL || path.join(ROOT, 'video', 'entrega', 'demobondis-explicativo-vertical.mp4');

const cfg = JSON.parse(await fsp.readFile(path.join(HERE, 'timeline.json'), 'utf8'));

const MIME = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.mp4': 'video/mp4', '.png': 'image/png', '.jpg': 'image/jpeg' };

function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = decodeURIComponent(req.url.split('?')[0]);
      let file = url.startsWith('/capture/') ? path.join(ROOT, 'video', 'capture2', url.slice(9))
        : url.startsWith('/render/') ? path.join(HERE, url.slice(8))
        : path.join(HERE, url === '/' ? 'compositor.html' : url);
      const stat = await fsp.stat(file);
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      const range = req.headers.range;
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
        res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
        fs.createReadStream(file, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
      fs.createReadStream(file).pipe(res);
    } catch (e) {
      res.writeHead(404); res.end('not found');
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const ffmpegArgs = (out) => [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', String(CRF),
  '-pix_fmt', 'yuv420p', '-g', String(FPS * 2), '-movflags', '+faststart',
  out,
];

function ffmpegPipe(out) {
  const p = spawn('ffmpeg', ffmpegArgs(out), { stdio: ['pipe', 'inherit', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d.toString(); });
  const done = new Promise((resolve, reject) => {
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${err.slice(-800)}`))));
  });
  return { proc: p, done };
}

const write = (stream, buf) => new Promise((resolve, reject) => {
  if (stream.write(buf)) return resolve();
  stream.once('drain', resolve);
  stream.once('error', reject);
});

async function main() {
  await fsp.mkdir(OUT_DIR, { recursive: true });
  await fsp.mkdir(path.dirname(FINAL), { recursive: true });
  const server = await startServer();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/render/compositor.html`;

  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || 'C:/Users/Asus/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text'] });
  const context = await browser.newContext({ viewport: { width: cfg.width, height: cfg.height }, deviceScaleFactor: 1 });

  // ---- boot + layout self-check on a single page ----
  const probe = await context.newPage();
  await probe.goto(base, { waitUntil: 'load' });
  await probe.evaluate((c) => window.setFps(c.fps), cfg);
  const boot = await probe.evaluate((c) => window.boot(c), cfg);
  const meta = await probe.evaluate(() => window.meta());
  const measured = await probe.evaluate(() => window.measure());
  await fsp.writeFile(path.join(OUT_DIR, 'layout-report.json'), JSON.stringify({ boot, meta, measured }, null, 2));
  console.log(`total=${boot.total.toFixed(2)}s frames=${meta.frames} fonts=${boot.scenes.map((s) => s.font).join(',')}`);
  if (!measured.ok) {
    console.error('LAYOUT CHECK FAILED:\n' + measured.problems.join('\n'));
    await probe.close(); await browser.close(); server.close();
    process.exit(2);
  }
  // sample frames per scene to prove the DOM reacts (0 = blank/broken)
  if (process.env.PROBE) {
    const diag = [];
    for (const t of [0.4, 1.2, 6, 20]) {
      await probe.evaluate((tt) => window.setTime(tt), t);
      const st = await probe.evaluate(() => {
        const l0 = document.getElementById('L0_0');
        const l1 = document.getElementById('L0_1');
        const k = document.getElementById('kicker');
        const cs = (el) => { const c = getComputedStyle(el); const r = el.getBoundingClientRect(); return { op: c.opacity, fs: c.fontSize, vis: c.visibility, disp: c.display, color: c.color, top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), text: el.textContent.slice(0, 30) }; };
        return { l0: cs(l0), l1: cs(l1), kicker: cs(k), contentOp: getComputedStyle(document.getElementById('content')).opacity, videoTime: document.querySelector('#screen video.active')?.currentTime, videoDur: document.querySelector('#screen video.active')?.duration, videoReady: document.querySelector('#screen video.active')?.readyState };
      });
      const shot = path.join(OUT_DIR, `probe-${String(t).replace('.', '_')}.png`);
      await probe.screenshot({ path: shot });
      diag.push({ t, ...st, shot });
    }
    console.log(JSON.stringify(diag, null, 2));
    await probe.close(); await browser.close(); server.close();
    return;
  }
  await probe.close();

  const totalFrames = LIMIT_FRAMES || (meta.frames - START_FRAME);
  const per = Math.ceil(totalFrames / WORKERS);
  const chunks = [];
  const t0 = Date.now();
  let rendered = 0;

  await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
    const f0 = START_FRAME + w * per;
    const f1 = Math.min(START_FRAME + totalFrames, f0 + per);
    if (f0 >= f1) return;
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'load' });
    await page.evaluate((c) => window.setFps(c.fps), cfg);
    await page.evaluate((c) => window.boot(c), cfg);
    const out = path.join(OUT_DIR, `chunk-${String(w).padStart(2, '0')}.mp4`);
    chunks.push(out);
    const { proc, done } = ffmpegPipe(out);
    for (let f = f0; f < f1; f++) {
      await page.evaluate((t) => window.setTime(t), f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95, animations: 'disabled' });
      await write(proc.stdin, buf);
      rendered++;
      if (rendered % 150 === 0) {
        const el = (Date.now() - t0) / 1000;
        const rate = rendered / el;
        console.log(`frames ${rendered}/${totalFrames} · ${rate.toFixed(1)} fps · ETA ${Math.round((totalFrames - rendered) / rate)}s`);
      }
    }
    proc.stdin.end();
    await done;
    await page.close();
  }));

  await browser.close();
  server.close();

  // ---- concat in worker order ----
  const ordered = chunks.sort();
  const listFile = path.join(OUT_DIR, 'concat.txt');
  await fsp.writeFile(listFile, ordered.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
  await new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', FINAL], { stdio: 'inherit' });
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error('concat failed'))));
  });
  const st = await fsp.stat(FINAL);
  const ffp = await new Promise((resolve) => {
    let out = '';
    const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,pix_fmt', '-show_entries', 'stream=codec_type', '-show_entries', 'format=duration,size', '-of', 'json', FINAL]);
    p.stdout.on('data', (d) => { out += d.toString(); });
    p.on('close', (code) => resolve({ code, out }));
  });
  let info = {};
  try { info = JSON.parse(ffp.out); } catch (e) { info = { raw: ffp.out }; }
  const v = (info.streams || []).find((s) => s.codec_type === 'video') || {};
  const markerName = (LIMIT_FRAMES || START_FRAME) ? 'RENDER-DONE.partial.json' : 'RENDER-DONE.json';
  await fsp.writeFile(path.join(OUT_DIR, markerName), JSON.stringify({
    exitCode: 0,
    finishedAt: new Date().toISOString(),
    mp4Path: FINAL,
    framesRendered: totalFrames,
    workers: WORKERS,
    seconds: Math.round((Date.now() - t0) / 1000),
    ffprobe: {
      width: v.width, height: v.height, fps: v.r_frame_rate, codec: v.codec_name, pix_fmt: v.pix_fmt,
      duration: info.format ? Number(info.format.duration) : null,
      sizeMB: Number((st.size / 1048576).toFixed(2)),
      hasAudio: (info.streams || []).some((s) => s.codec_type === 'audio'),
    },
  }, null, 2));
  console.log(`DONE ${FINAL} ${(st.size / 1048576).toFixed(1)}MB in ${Math.round((Date.now() - t0) / 1000)}s`);
}

main().catch(async (e) => {
  console.error('RENDER FAILED:', e.message);
  try {
    await fsp.mkdir(OUT_DIR, { recursive: true });
    await fsp.writeFile(path.join(OUT_DIR, 'RENDER-FAILED.txt'), `failedAt: ${new Date().toISOString()}\n\n${e.message}\n`);
  } catch (err) { /* ignore */ }
  process.exit(1);
});
