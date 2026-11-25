import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { SOLUTIONS, simulate } from './sim.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = '/opt/cursor/artifacts';
fs.mkdirSync(artifacts, { recursive: true });

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
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

function track(page) {
  const errors = [];
  const requests = [];
  page.on('pageerror', (err) => errors.push(`page: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('request', (req) => requests.push(req.url()));
  page.on('response', (res) => {
    if (res.status() >= 400) errors.push(`${res.status()} ${res.url()}`);
  });
  return { errors, requests };
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(artifacts, name) });
}

async function codeOf(page) {
  return page.locator('#status').getAttribute('data-code');
}

async function waitCode(page, code) {
  await page.waitForFunction((expected) => document.querySelector('#status').dataset.code === expected, code, { timeout: 8000 });
}

async function place(page, part, slot) {
  await page.locator(`#part-${part}`).scrollIntoViewIfNeeded();
  await page.locator(`#part-${part}`).click();
  await page.locator(`#slot-${slot}`).click();
}

async function tap(page, selector) {
  const target = page.locator(selector);
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44, `${selector} target ${JSON.stringify(box)}`);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function canvasStats(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#view');
    const context = canvas.getContext('2d');
    const image = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let ink = 0;
    let dark = 0;
    let amber = 0;
    for (let i = 0; i < image.length; i += 16) {
      const r = image[i];
      const g = image[i + 1];
      const b = image[i + 2];
      if (r + g + b > 30) ink += 1;
      if (r < 50 && g < 50 && b < 50) dark += 1;
      if (Math.abs(r - 226) < 28 && Math.abs(g - 162) < 28 && Math.abs(b - 26) < 36) amber += 1;
    }
    return { ink, dark, amber, width: canvas.width, height: canvas.height };
  });
}

const server = await startServer();
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
const gameUrl = `${base}/salvage-rover/`;
let browser;

try {
  for (const file of ['/salvage-rover/', '/salvage-rover/index.html']) {
    const response = await fetch(base + file);
    assert.equal(response.status, 200, file);
    assert.match(response.headers.get('content-type') || '', /text\/html/);
  }
  for (const file of ['/salvage-rover/main.js', '/salvage-rover/sim.js', '/salvage-rover/routes.js', '/salvage-rover/style.css']) {
    const response = await fetch(base + file);
    assert.equal(response.status, 200, file);
    const type = response.headers.get('content-type') || '';
    assert.equal(type.includes('text/html'), false, file);
  }
  const pageBody = await (await fetch(`${base}/salvage-rover/`)).text();
  assert.match(pageBody, /回收救援车/);
  assert.match(pageBody, /src="\.\/main\.js"/);

  browser = await chromium.launch({ headless: true });

  const animated = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'zh-CN',
    recordVideo: { dir: '/tmp/sr-video', size: { width: 1280, height: 800 } },
  });
  const show = await animated.newPage();
  const showLog = track(show);
  await show.emulateMedia({ reducedMotion: 'no-preference' });
  await show.goto(`${gameUrl}?fresh=1`, { waitUntil: 'networkidle' });
  await show.evaluate(() => localStorage.clear());
  await show.reload({ waitUntil: 'networkidle' });
  await show.waitForFunction(() => document.querySelector('#view').width > 100);
  assert.equal(await show.title(), '回收救援车');
  assert.match(await show.locator('#coach').innerText(), /后槽/);
  await place(show, 'battery', 'rear');
  await show.locator('#run').click();
  await waitCode(show, 'front-lift');
  assert.match(await show.locator('#status').innerText(), /前轮离地（前 2 \/ 后 3）/);
  const lifted = await canvasStats(show);
  assert.ok(lifted.dark > 20, `lift drawing ${JSON.stringify(lifted)}`);
  assert.ok(lifted.amber > 5, `battery drawing ${JSON.stringify(lifted)}`);
  await shot(show, 'salvage_rover_desktop_lift.png');
  await place(show, 'bed', 'front');
  await show.locator('#run').click();
  await waitCode(show, 'ok');
  assert.match(await show.locator('#status').innerText(), /带回 1 箱/);
  await shot(show, 'salvage_rover_desktop_success.png');
  const showCheck = await show.evaluate(() => {
    const snap = window.__SR.snapshot();
    const again = window.__SR.simulate(snap.assembly, snap.routeId);
    return { same: again.code === snap.code, code: snap.code, steps: again.frames.length };
  });
  assert.equal(showCheck.same, true);
  assert.equal(showCheck.code, 'ok');
  assert.equal(showCheck.steps, 10);
  assert.deepEqual(showLog.errors, []);
  const showVideo = show.video();
  await animated.close();
  fs.copyFileSync(await showVideo.path(), path.join(artifacts, 'salvage_rover_desktop_assemble_and_retry.webm'));

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'zh-CN' });
  const page = await desktop.newPage();
  const desktopLog = track(page);
  await page.goto(`${gameUrl}?instant=1`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await place(page, 'battery', 'rear');
  await page.locator('#run').click();
  await waitCode(page, 'front-lift');
  await page.locator('#reset').click();
  assert.match(await page.locator('#slot-mid').innerText(), /货箱/);
  assert.match(await page.locator('#slot-rear').innerText(), /空/);
  await page.locator('#run').click();
  await waitCode(page, 'no-drive');
  await place(page, 'battery', 'rear');
  await page.locator('#run').click();
  await waitCode(page, 'front-lift');
  await place(page, 'bed', 'front');
  await page.locator('#run').click();
  await waitCode(page, 'ok');
  await page.locator('#run').click();
  await waitCode(page, 'ok');
  assert.match(await page.locator('#status').innerText(), /带回 1 箱，电还剩 31/);
  assert.equal(await page.locator('#route-steep').isDisabled(), false);
  assert.equal(await page.locator('#route-mud').isDisabled(), true);

  await page.locator('#route-steep').click();
  await place(page, 'winch', 'front');
  await place(page, 'bed', 'mid');
  await place(page, 'battery', 'rear');
  assert.match(await page.locator('#load-value').innerText(), /2 箱/);
  await page.locator('#run').click();
  await waitCode(page, 'ok');
  assert.match(await page.locator('#status').innerText(), /带回 2 箱/);
  await page.locator('#load-inc').click();
  await page.locator('#run').click();
  await waitCode(page, 'energy');
  assert.match(await page.locator('#status').innerText(), /电量耗尽（这一步要 15，剩余 11）/);
  await shot(page, 'salvage_rover_desktop_energy.png');
  await page.locator('#load-dec').click();
  await page.locator('#run').click();
  await waitCode(page, 'ok');

  await page.locator('#route-mud').click();
  await place(page, 'winch', 'front');
  await place(page, 'bed', 'mid');
  await place(page, 'battery', 'rear');
  await page.locator('#run').click();
  await waitCode(page, 'mud');
  assert.match(await page.locator('#status').innerText(), /陷入软地/);
  await shot(page, 'salvage_rover_desktop_mud.png');
  await place(page, 'tracks', 'front');
  await page.locator('#run').click();
  await waitCode(page, 'ok');
  await page.locator('#load-inc').click();
  await page.locator('#run').click();
  await waitCode(page, 'energy');
  const mudCheck = await page.evaluate(() => {
    const snap = window.__SR.snapshot();
    return window.__SR.simulate(snap.assembly, snap.routeId).code === snap.code;
  });
  assert.equal(mudCheck, true);

  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#route-mud').isDisabled(), false);
  await page.locator('#wipe').click();
  assert.equal(await page.locator('#route-steep').isDisabled(), true);
  assert.match(await page.locator('#status').innerText(), /进度已清空/);
  for (const url of desktopLog.requests) assert.equal(new URL(url).hostname, '127.0.0.1', url);
  assert.deepEqual(desktopLog.errors, []);
  const solved = simulate(SOLUTIONS.mud, 'mud');
  assert.equal(solved.code, 'ok');
  await desktop.close();

  for (const viewport of [
    { width: 360, height: 740, shotName: 'salvage_rover_mobile_lift.png', successName: 'salvage_rover_mobile_success.png' },
    { width: 360, height: 640, shotName: null, successName: 'salvage_rover_mobile_640.png' },
  ]) {
    const phone = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
      locale: 'zh-CN',
    });
    const touch = await phone.newPage();
    const phoneLog = track(touch);
    await touch.goto(`${gameUrl}?instant=1`, { waitUntil: 'networkidle' });
    await touch.evaluate(() => localStorage.clear());
    await touch.reload({ waitUntil: 'networkidle' });
    const layout = await touch.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      overflow: getComputedStyle(document.body).overflow,
    }));
    assert.ok(layout.scrollW <= layout.innerW + 1, `horizontal overflow ${layout.scrollW} > ${layout.innerW}`);
    assert.equal(layout.overflow, 'hidden');
    await tap(touch, '#part-battery');
    await tap(touch, '#slot-rear');
    const runBox = await touch.locator('#run').boundingBox();
    assert.ok(runBox, 'run button missing');
    assert.ok(runBox.y >= 0 && runBox.y + runBox.height <= viewport.height + 1, `run button outside ${viewport.height}: ${JSON.stringify(runBox)}`);
    assert.ok(runBox.height >= 44 && runBox.width >= 44);
    if (viewport.shotName) await shot(touch, 'salvage_rover_mobile_workshop.png');
    await tap(touch, '#run');
    await waitCode(touch, 'front-lift');
    if (viewport.shotName) await shot(touch, viewport.shotName);
    await tap(touch, '#part-bed');
    await tap(touch, '#slot-front');
    await tap(touch, '#run');
    await waitCode(touch, 'ok');
    assert.match(await touch.locator('#status').innerText(), /带回 1 箱/);
    const stats = await canvasStats(touch);
    assert.ok(stats.ink > 100 && stats.dark > 10 && stats.amber > 5, JSON.stringify(stats));
    await shot(touch, viewport.successName);
    await touch.locator('#reset').click();
    assert.equal(await codeOf(touch), '');
    assert.match(await touch.locator('#slot-mid').innerText(), /货箱/);
    for (const url of phoneLog.requests) assert.equal(new URL(url).hostname, '127.0.0.1', url);
    assert.deepEqual(phoneLog.errors, [], `${viewport.width}x${viewport.height}`);
    await phone.close();
  }

  console.log('browser smoke ok');
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
