// Website showcase recorder
// Buka website di browser asli (Chromium), scroll halus dari atas ke bawah,
// lalu render jadi video MP4 yang tajam (frame-by-frame, bukan screen record).
//
// Pakai:
//   node record.mjs https://websitelu.com
//   node record.mjs https://websitelu.com --mobile
//   node record.mjs https://websitelu.com --seconds=20 --fps=60 --out=hasil/demo.mp4
//
// Opsi:
//   --mobile        tampilan HP (390x844, retina 2x)
//   --seconds=14    durasi bagian scroll (default 14 detik)
//   --fps=30        frame per detik (30 atau 60)
//   --width=1920    lebar viewport desktop
//   --height=1080   tinggi viewport desktop
//   --out=file.mp4  nama file output

import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));

if (!url) {
  console.error('Pakai: node record.mjs <url> [--mobile] [--seconds=14] [--fps=30] [--out=file.mp4]');
  process.exit(1);
}

const opt = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};

const mobile = args.includes('--mobile');
const seconds = Number(opt('seconds', 14));
const fps = Number(opt('fps', 30));
const out = opt('out', mobile ? 'showcase-mobile.mp4' : 'showcase-desktop.mp4');

const viewport = mobile
  ? { width: 390, height: 844 }
  : { width: Number(opt('width', 1920)), height: Number(opt('height', 1080)) };
const deviceScaleFactor = mobile ? 2 : 1;

const easeInOut = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function runFfmpeg(framesDir, outFile) {
  return new Promise((resolve, reject) => {
    const p = spawn(
      ffmpegPath,
      [
        '-y',
        '-framerate', String(fps),
        '-i', path.join(framesDir, '%06d.jpg'),
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-crf', '16',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        outFile,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-800)))));
  });
}

const framesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-'));
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });

console.log(`Buka ${url} (${mobile ? 'mobile' : 'desktop'} ${viewport.width}x${viewport.height} @${deviceScaleFactor}x)`);

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    isMobile: mobile,
    hasTouch: mobile,
    userAgent: mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
      : undefined,
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  } catch {
    console.log('networkidle timeout, lanjut pakai load biasa...');
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  }
  await sleep(1500);

  // Pemanasan: scroll cepat ke bawah supaya gambar lazy-load & animasi scroll ke-trigger,
  // lalu balik ke atas.
  const warmHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < warmHeight; y += viewport.height * 0.6) {
    await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y);
    await sleep(150);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await sleep(1200);

  const maxScroll = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight
  );
  if (maxScroll <= 0) console.log('Halaman tidak bisa di-scroll (konten pas 1 layar).');

  const pauseFrames = Math.round(fps * 1.2);
  const scrollFrames = Math.max(1, Math.round(seconds * fps));
  const total = pauseFrames + scrollFrames + pauseFrames;
  let n = 0;

  const capture = async (y) => {
    await page.evaluate(
      (v) => window.scrollTo({ top: v, behavior: 'instant' }),
      Math.round(y)
    );
    // tunggu 2 frame render supaya posisi scroll benar-benar ter-paint
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    );
    n += 1;
    await page.screenshot({
      path: path.join(framesDir, String(n).padStart(6, '0') + '.jpg'),
      type: 'jpeg',
      quality: 95,
    });
    if (n % 30 === 0 || n === total) {
      process.stdout.write(`\rFrame ${n}/${total}`);
    }
  };

  for (let i = 0; i < pauseFrames; i++) await capture(0);
  for (let i = 0; i < scrollFrames; i++) {
    const t = scrollFrames === 1 ? 1 : i / (scrollFrames - 1);
    await capture(Math.max(0, maxScroll) * easeInOut(t));
  }
  for (let i = 0; i < pauseFrames; i++) await capture(Math.max(0, maxScroll));
  process.stdout.write('\n');

  await context.close();
} finally {
  await browser.close();
}

console.log('Render video...');
try {
  await runFfmpeg(framesDir, path.resolve(out));
  console.log(`Selesai: ${out}`);
} finally {
  fs.rmSync(framesDir, { recursive: true, force: true });
}
