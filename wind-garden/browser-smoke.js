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
  '.svg': 'image/svg+xml',
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

function track(page, label, bucket) {
  page.on('pageerror', (err) => bucket.push(`${label} page: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') bucket.push(`${label} console: ${msg.text()}`);
  });
  page.on('request', (req) => {
    const host = new URL(req.url()).hostname;
    if (host !== '127.0.0.1') bucket.push(`${label} network: ${req.url()}`);
  });
}

async function point(page, selector) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, selector);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function tap(page, selector, touch) {
  const at = await point(page, selector);
  if (touch) await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
}

async function tapCell(page, x, y, touch) {
  const at = await page.evaluate(({ x, y }) => {
    const c = window.__WG.cellCenter(x, y);
    const r = document.getElementById('board').getBoundingClientRect();
    return { x: r.left + c.x, y: r.top + c.y };
  }, { x, y });
  if (touch) await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
}

async function waitIdle(page) {
  await page.waitForFunction(() => window.__WG && !window.__WG.busy());
}

async function fit(page) {
  return page.evaluate(() => {
    const ids = ['sow', 'rotate', 'undo', 'recycle', 'restart', 'mute', 'seed-flower', 'seed-hedge'];
    const boxes = {};
    for (const id of ids) {
      const r = document.getElementById(id).getBoundingClientRect();
      boxes[id] = { w: r.width, h: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    }
    const board = document.getElementById('board').getBoundingClientRect();
    return {
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      cell: window.__WG.layout().cell,
      board: { w: board.width, h: board.height, top: board.top },
      boxes,
      title: document.querySelector('h1').textContent,
      cause: document.getElementById('cause').textContent,
    };
  });
}

function assertFit(info, label) {
  assert.ok(info.scrollW <= info.innerW + 1, `${label} horizontal ${JSON.stringify(info)}`);
  assert.ok(info.cell >= 32, `${label} cell ${info.cell}`);
  for (const [id, box] of Object.entries(info.boxes)) {
    assert.ok(box.h >= 44, `${label} ${id} height ${box.h}`);
    assert.ok(box.w >= 44, `${label} ${id} width ${box.w}`);
    assert.ok(box.bottom <= info.innerH + 1, `${label} ${id} below fold ${box.bottom} > ${info.innerH}`);
    assert.ok(box.right <= info.innerW + 1, `${label} ${id} off right`);
  }
}

const server = await startServer();
const port = server.address().port;
const gameUrl = `http://127.0.0.1:${port}/wind-garden/`;
const errors = [];
let browser;

try {
  for (const file of ['/wind-garden/', '/wind-garden/main.js', '/wind-garden/sim.js', '/wind-garden/style.css', '/wind-garden/assets/favicon.svg']) {
    const response = await fetch(`http://127.0.0.1:${port}${file}`);
    assert.equal(response.status, 200, file);
  }

  browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    hasTouch: false,
    recordVideo: { dir: '/tmp/wg-video', size: { width: 1280, height: 800 } },
  });
  const page = await desktop.newPage();
  track(page, 'desktop', errors);
  await page.goto(gameUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => window.__WG.setAnimScale(0));
  assert.equal(await page.title(), '风吹小花园');
  assert.match(await page.locator('#cause').innerText(), /前方出界/);
  assert.equal(await page.evaluate(() => window.__WG.audio().want), false);

  const desktopFit = await fit(page);
  assertFit(desktopFit, 'desktop');
  await page.screenshot({ path: path.join(artifacts, 'wind-garden-desktop-start.png') });

  await tap(page, '#rotate', false);
  assert.match(await page.locator('#cause').innerText(), /朝东/);
  assert.match(await page.locator('#cause').innerText(), /花床/);
  const aimed = await page.evaluate(() => window.__WG.preview().trace.landing);
  assert.deepEqual(aimed, { x: 4, y: 2 });
  await page.screenshot({ path: path.join(artifacts, 'wind-garden-desktop-preview.png') });

  await tap(page, '#sow', false);
  await waitIdle(page);
  assert.equal(await page.evaluate(() => window.__WG.wish().done), true);
  assert.equal((await page.evaluate(() => window.__WG.plants())).length, 1);
  await page.screenshot({ path: path.join(artifacts, 'wind-garden-desktop-bloom.png') });

  await tap(page, '#undo', false);
  assert.equal(await page.evaluate(() => window.__WG.wish().done), false);
  assert.equal((await page.evaluate(() => window.__WG.plants())).length, 0);

  await tap(page, '#sow', false);
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => window.__WG.setAnimScale(0));
  assert.equal(await page.evaluate(() => window.__WG.wish().done), true);
  assert.equal((await page.evaluate(() => window.__WG.plants()))[0].kind, 'flower');

  await tap(page, '#restart', false);
  assert.equal((await page.evaluate(() => window.__WG.plants())).length, 0);
  assert.equal(await page.evaluate(() => window.__WG.dirs().fan), 'N');
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => window.__WG.setAnimScale(0));
  assert.equal((await page.evaluate(() => window.__WG.plants())).length, 0);
  assert.equal(await page.evaluate(() => window.__WG.dirs().fan), 'N');

  await tap(page, '#mute', false);
  const sounded = await page.evaluate(() => window.__WG.audio());
  await tap(page, '#mute', false);
  const muted = await page.evaluate(() => window.__WG.audio());
  assert.equal(muted.want, false);
  assert.equal(muted.muted, true);
  if (sounded.want) assert.equal(sounded.unlocked, true);

  await tap(page, '#gardens', false);
  await tap(page, 'button[data-garden="bend"]', false);
  await page.evaluate(() => window.__WG.setAnimScale(0));
  assert.equal(await page.evaluate(() => window.__WG.session.garden.id), 'bend');

  await tap(page, '#rotate', false);
  await tap(page, '#seed-hedge', false);
  await tap(page, '#sow', false);
  await waitIdle(page);
  assert.match(await page.locator('#cause').innerText(), /风路变了/);
  const beforeTurn = await page.evaluate(() => {
    const north = window.__WG.session.garden.fans.find((fan) => fan.id === 'north');
    return { dir: window.__WG.dirs().north, x: north.x, y: north.y };
  });
  assert.equal(beforeTurn.dir, 'E');
  await tapCell(page, beforeTurn.x, beforeTurn.y, false);
  assert.equal(await page.evaluate(() => window.__WG.dirs().north), 'E');
  assert.equal(await page.evaluate(() => window.__WG.session.fanId), 'north');
  await tap(page, '#rotate', false);
  const bent = await page.evaluate(() => window.__WG.preview());
  assert.equal(bent.trace.turns.length, 1);
  assert.equal(bent.trace.turns[0].blockKind, 'hedge');
  assert.deepEqual(bent.trace.landing, { x: 0, y: 1 });
  await tap(page, '#seed-flower', false);
  assert.match(await page.locator('#cause').innerText(), /挡住/);
  assert.match(await page.locator('#cause').innerText(), /花籽会落到花床/);
  await page.screenshot({ path: path.join(artifacts, 'wind-garden-desktop-bend.png') });
  await tap(page, '#sow', false);
  await waitIdle(page);
  assert.equal(await page.evaluate(() => window.__WG.wish().done), true);
  assert.match(await page.locator('#cause').innerText(), /花朵不挡风/);
  const stillBent = await page.evaluate(() => window.__WG.preview().trace.steps.map((step) => [step.x, step.y]));
  assert.deepEqual(stillBent, [[4, 1], [3, 1], [2, 1], [1, 1], [0, 1]]);
  await page.screenshot({ path: path.join(artifacts, 'wind-garden-desktop-flower.png') });

  await tapCell(page, 4, 2, false);
  await tap(page, '#recycle', false);
  const straight = await page.evaluate(() => window.__WG.preview().trace.landing);
  assert.deepEqual(straight, { x: 4, y: 5 });
  await tap(page, '#undo', false);
  assert.deepEqual(await page.evaluate(() => window.__WG.preview().trace.landing), { x: 0, y: 1 });

  await page.evaluate(() => new Promise((resolve) => {
    const start = performance.now();
    function loop(now) {
      if (now - start < 1200) requestAnimationFrame(loop);
      else resolve();
    }
    requestAnimationFrame(loop);
  }));
  const pace = await page.evaluate(() => ({ fps: window.__WG.fps(), maxGap: window.__WG.maxGap() }));
  assert.ok(pace.fps >= 30, JSON.stringify(pace));
  assert.ok(pace.maxGap < 250, JSON.stringify(pace));
  console.log('desktop pace', pace);

  await page.close();
  const video = await page.video().path();
  fs.copyFileSync(video, path.join(artifacts, 'wind-garden-desktop-bend.webm'));

  const phone = await browser.newContext({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const mobile = await phone.newPage();
  track(mobile, 'mobile', errors);
  await mobile.goto(gameUrl, { waitUntil: 'networkidle' });
  await mobile.evaluate(() => localStorage.clear());
  await mobile.reload({ waitUntil: 'networkidle' });
  await mobile.evaluate(() => window.__WG.setAnimScale(0));
  const phoneFit = await fit(mobile);
  assertFit(phoneFit, 'phone-740');
  await mobile.screenshot({ path: path.join(artifacts, 'wind-garden-mobile-start.png') });

  await tap(mobile, '#rotate', true);
  await tap(mobile, '#sow', true);
  await waitIdle(mobile);
  assert.equal(await mobile.evaluate(() => window.__WG.wish().done), true);
  await mobile.screenshot({ path: path.join(artifacts, 'wind-garden-mobile-bloom.png') });

  await tap(mobile, '#gardens', true);
  await tap(mobile, 'button[data-garden="fork"]', true);
  await mobile.evaluate(() => window.__WG.setAnimScale(0));
  await tap(mobile, '#rotate', true);
  await tapCell(mobile, 2, 0, true);
  await tap(mobile, '#rotate', true);
  await tap(mobile, '#seed-hedge', true);
  await tap(mobile, '#sow', true);
  await waitIdle(mobile);
  await tapCell(mobile, 0, 2, true);
  await tap(mobile, '#seed-flower', true);
  const forkPreview = await mobile.evaluate(() => window.__WG.preview());
  assert.equal(forkPreview.trace.turns[0].blockKind, 'hedge');
  assert.deepEqual(forkPreview.trace.landing, { x: 1, y: 5 });
  await mobile.screenshot({ path: path.join(artifacts, 'wind-garden-mobile-fork.png') });
  await tap(mobile, '#sow', true);
  await waitIdle(mobile);
  assert.equal(await mobile.evaluate(() => window.__WG.wish().done), true);
  assert.equal(await mobile.evaluate(() => window.__WG.plants().find((plant) => plant.kind === 'flower').x), 1);

  await mobile.setViewportSize({ width: 360, height: 640 });
  await mobile.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const shortFit = await fit(mobile);
  assertFit(shortFit, 'phone-640');
  await mobile.screenshot({ path: path.join(artifacts, 'wind-garden-mobile-640.png') });

  assert.deepEqual(errors, []);
  console.log('browser smoke ok');
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
