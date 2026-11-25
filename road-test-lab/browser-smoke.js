import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = '/opt/cursor/artifacts';
fs.mkdirSync(artifacts, { recursive: true });

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
};

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(root, rel);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end('no');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function watch(page, label) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(`${label} page: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`${label} console: ${msg.text()}`);
  });
  page.on('request', (req) => {
    const host = new URL(req.url()).hostname;
    if (host !== '127.0.0.1' && host !== 'localhost') errors.push(`${label} outbound: ${req.url()}`);
  });
  return errors;
}

async function painted(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#view');
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let min = 255;
    let max = 0;
    for (let i = 0; i < data.length; i += 16) {
      const shade = data[i] + data[i + 1] + data[i + 2];
      min = Math.min(min, shade);
      max = Math.max(max, shade);
    }
    return { width: canvas.width, height: canvas.height, spread: max - min };
  });
}

async function holdKey(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

async function until(page, pred, timeout = 8000) {
  await page.waitForFunction(pred, null, { timeout });
}

const server = await startServer();
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
const gameUrl = `${base}/road-test-lab/`;
let browser;
const notes = [];

try {
  for (const file of [
    '/road-test-lab/',
    '/road-test-lab/main.js',
    '/road-test-lab/sim.js',
    '/road-test-lab/session.js',
    '/road-test-lab/tracks.js',
    '/road-test-lab/style.css',
  ]) {
    const response = await fetch(base + file);
    assert.equal(response.status, 200, file);
    notes.push(`${file} 200`);
  }

  browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: '/tmp/road-video', size: { width: 1280, height: 800 } },
  });
  const page = await desktop.newPage();
  const desktopErrors = watch(page, 'desktop');
  await page.goto(gameUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.title(), '拼路试车场');
  await page.waitForFunction(() => window.__ROAD && window.__ROAD.phase() === 'ready');
  const paint = await painted(page);
  assert.ok(paint.width > 200 && paint.height > 100, JSON.stringify(paint));
  assert.ok(paint.spread > 30, `canvas looked blank ${paint.spread}`);

  await page.keyboard.down('ArrowRight');
  await until(page, () => window.__ROAD.phase() === 'fail');
  await page.keyboard.up('ArrowRight');
  assert.equal(await page.evaluate(() => window.__ROAD.trackId()), 'lip');
  assert.equal(await page.evaluate(() => window.__ROAD.editsLeft()), 1);
  assert.equal(await page.evaluate(() => window.__ROAD.ghost()), null);
  await page.screenshot({ path: path.join(artifacts, 'road-test-fail.png') });

  await page.locator('#pieces button[data-index="2"]').click();
  await page.locator('#rotate').click();
  assert.equal(await page.evaluate(() => window.__ROAD.pieces()[2].rot), 0);
  assert.equal(await page.evaluate(() => window.__ROAD.editsLeft()), 0);
  await page.locator('#rearm').click();
  const ghost = await page.evaluate(() => window.__ROAD.ghost());
  assert.equal(ghost.outcome, 'fail');
  assert.ok(ghost.n > 20);
  await page.screenshot({ path: path.join(artifacts, 'road-test-ghost.png') });

  await page.keyboard.down('ArrowRight');
  await until(page, () => window.__ROAD.phase() === 'win', 10000);
  await page.keyboard.up('ArrowRight');
  assert.ok(await page.evaluate(() => window.__ROAD.best()) > 0);
  await page.screenshot({ path: path.join(artifacts, 'road-test-win-lip.png') });
  notes.push('track lip won');

  await page.locator('#tracks button[data-track="1"]').click();
  assert.equal(await page.evaluate(() => window.__ROAD.trackId()), 'wall');
  assert.equal(await page.evaluate(() => window.__ROAD.ghost()), null);
  await page.keyboard.down('ArrowRight');
  await until(page, () => window.__ROAD.phase() === 'fail');
  await page.keyboard.up('ArrowRight');
  assert.equal(await page.evaluate(() => window.__ROAD.car().reason), 'wall');
  await page.locator('#pieces button[data-index="2"]').click();
  await page.locator('#edit button[data-type="ramp"]').click();
  assert.equal(await page.evaluate(() => window.__ROAD.pieces()[2].type), 'ramp');
  await page.locator('#rearm').click();
  await page.keyboard.down('ArrowRight');
  await until(page, () => window.__ROAD.phase() === 'win', 10000);
  await page.keyboard.up('ArrowRight');
  notes.push('track wall won');

  await page.locator('#tracks button[data-track="2"]').click();
  assert.equal(await page.evaluate(() => window.__ROAD.ghost()), null);
  await page.keyboard.down('ArrowRight');
  await until(page, () => window.__ROAD.phase() === 'fail');
  await page.keyboard.up('ArrowRight');
  await page.locator('#pieces button[data-index="3"]').click();
  await page.locator('#rotate').click();
  assert.equal(await page.evaluate(() => window.__ROAD.pieces()[3].rot), 1);
  await page.locator('#rearm').click();
  await page.keyboard.down('ArrowRight');
  await until(page, () => window.__ROAD.phase() === 'fail', 8000);
  await page.keyboard.up('ArrowRight');
  assert.notEqual(await page.evaluate(() => window.__ROAD.phase()), 'win');
  const fastGhost = await page.evaluate(() => window.__ROAD.ghost());
  assert.ok(fastGhost && fastGhost.n > 10);
  await page.locator('#rearm').click();
  await holdKey(page, 'ArrowRight', 700);
  await until(page, () => window.__ROAD.phase() === 'win', 10000);
  await page.screenshot({ path: path.join(artifacts, 'road-test-win-window.png') });
  notes.push('track window won');

  await page.locator('#tracks button[data-track="0"]').click();
  assert.equal(await page.evaluate(() => window.__ROAD.trackId()), 'lip');
  assert.equal(await page.evaluate(() => window.__ROAD.phase()), 'win');
  assert.equal(await page.evaluate(() => window.__ROAD.ghost().outcome), 'fail');
  assert.equal(desktopErrors.length, 0, desktopErrors.join('\n'));

  const video = page.video();
  await desktop.close();
  if (video) {
    const saved = await video.path();
    fs.copyFileSync(saved, path.join(artifacts, 'road-test-desktop.webm'));
    notes.push('video saved');
  }

  const phone = await browser.newContext({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  });
  const mobile = await phone.newPage();
  const mobileErrors = watch(mobile, 'mobile');
  await mobile.goto(gameUrl, { waitUntil: 'networkidle' });
  await mobile.evaluate(() => localStorage.clear());
  await mobile.reload({ waitUntil: 'networkidle' });
  const layout = await mobile.evaluate(() => {
    const throttle = document.querySelector('#throttle').getBoundingClientRect();
    const brake = document.querySelector('#brake').getBoundingClientRect();
    return {
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      throttleH: throttle.height,
      brakeH: brake.height,
      throttleW: throttle.width,
      overflow: getComputedStyle(document.body).overflow,
    };
  });
  assert.ok(layout.scrollW <= layout.innerW + 1, JSON.stringify(layout));
  assert.ok(layout.throttleH >= 64 && layout.brakeH >= 64, JSON.stringify(layout));
  assert.ok(layout.throttleW >= 120, JSON.stringify(layout));
  const before = await mobile.evaluate(() => window.__ROAD.car().x);
  await mobile.locator('#throttle').dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true });
  await mobile.waitForTimeout(500);
  const after = await mobile.evaluate(() => window.__ROAD.car().x);
  await mobile.locator('#throttle').dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true });
  assert.ok(after > before + 0.4, `throttle did not move the car ${before} -> ${after}`);
  await mobile.screenshot({ path: path.join(artifacts, 'road-test-mobile-360.png') });
  assert.equal(mobileErrors.length, 0, mobileErrors.join('\n'));
  notes.push('mobile 360 throttle moved the car');
  await phone.close();
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log(notes.join('\n'));
