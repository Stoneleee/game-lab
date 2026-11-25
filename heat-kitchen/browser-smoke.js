import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { BURNER } from './heat.js';

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

function track(page, label) {
  const errors = [];
  const hosts = new Set();
  page.on('pageerror', (err) => errors.push(`${label} page: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`${label} console: ${msg.text()}`);
  });
  page.on('request', (req) => {
    try { hosts.add(new URL(req.url()).host); } catch { hosts.add(req.url()); }
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (url.endsWith('/favicon.ico')) return;
    errors.push(`${label} network: ${url} ${req.failure()?.errorText || ''}`);
  });
  return { errors, hosts };
}

async function dump(page) {
  return page.evaluate(() => window.__HK.dump());
}

async function layout(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('button')];
    const boxes = nodes.map((el) => {
      const rect = el.getBoundingClientRect();
      return { id: el.id || el.dataset.kind || el.dataset.cell || el.tagName, w: rect.width, h: rect.height, l: rect.left, r: rect.right };
    });
    const small = boxes.filter((box) => box.id && (box.w < 44 || box.h < 44) && box.w > 0);
    return {
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      title: document.querySelector('h1').textContent,
      notice: document.querySelector('#notice').textContent,
      small,
      serveBottom: document.querySelector('#serve').getBoundingClientRect().bottom,
      pan: document.querySelector('#pan').getBoundingClientRect().width,
    };
  });
}

function mustOk(errors) {
  assert.deepEqual(errors, [], errors.join('\n'));
}

const server = await startServer();
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
let browser;
const report = [];

try {
  for (const file of ['/heat-kitchen/', '/heat-kitchen/main.js', '/heat-kitchen/game.js', '/heat-kitchen/heat.js', '/heat-kitchen/style.css']) {
    const response = await fetch(base + file);
    assert.equal(response.status, 200, file);
  }
  const games = await fetch(base + '/games.json').then((response) => response.json());
  assert.equal(games.some((game) => game.slug === 'heat-kitchen'), false);

  browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: artifacts, size: { width: 1280, height: 800 } } });
  const page = await desktop.newPage();
  const desk = track(page, 'desktop');
  await page.goto(`${base}/heat-kitchen/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#pan .cell');
  let box = await layout(page);
  assert.equal(box.title, '热力小食堂');
  assert.match(box.notice, /面饼/);
  assert.ok(box.scrollW <= box.innerW + 1, `desktop overflow ${box.scrollW}`);

  await page.locator('#sound').click();
  assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true');
  await page.locator('#sound').click();
  assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false');

  await page.locator('[data-kind="noodle"]').click();
  await page.locator('[data-cell="1,1"]').click();
  await page.waitForFunction(() => window.__HK.dump().foods.length === 1);
  const placed = await dump(page);
  assert.equal(placed.step, 'wait');
  const startTemp = placed.foods[0].temp;
  await page.waitForTimeout(1800);
  const cooked = await dump(page);
  assert.ok(cooked.foods[0].temp > startTemp, `timer did not heat ${startTemp} -> ${cooked.foods[0].temp}`);
  await page.screenshot({ path: path.join(artifacts, 'heat-kitchen-desktop-cook.png') });

  await page.evaluate(() => window.__HK.auto(false));
  await page.evaluate(() => {
    let guard = 0;
    while (window.__HK.dump().step === 'wait' && guard < 80) {
      window.__HK.tick(1);
      guard += 1;
    }
  });
  assert.equal((await dump(page)).step, 'serve');
  await page.locator('#serve').click();
  await page.waitForSelector('[data-action="begin"]');
  await page.screenshot({ path: path.join(artifacts, 'heat-kitchen-lesson.png') });
  await page.locator('[data-action="begin"]').click();
  const shift = await dump(page);
  assert.equal(shift.mode, 'shift');
  assert.equal(shift.score, 0);
  assert.equal(shift.foods.length, 0);
  assert.ok(shift.residue.every((value) => value === 0));

  await page.locator('[data-kind="noodle"]').click();
  await page.locator('[data-cell="1,1"]').click();
  await page.waitForFunction(() => window.__HK.dump().foods.some((food) => food.kind === 'noodle'));
  const alone = await page.evaluate(() => {
    const state = window.__HK.dump();
    const food = state.foods.find((item) => item.kind === 'noodle');
    return Number(document.querySelector(`.token[data-id="${food.id}"]`).dataset.gain);
  });
  await page.locator('[data-kind="egg"]').click();
  await page.locator('[data-cell="1,2"]').click();
  const shared = await page.evaluate(() => {
    const state = window.__HK.dump();
    const food = state.foods.find((item) => item.kind === 'noodle');
    return {
      gain: Number(document.querySelector(`.token[data-id="${food.id}"]`).dataset.gain),
      share: document.querySelector(`.token[data-kind="noodle"]`).dataset.share,
      notice: state.notice.text,
    };
  });
  assert.ok(shared.gain < alone, `sharing did not slow noodle ${alone} -> ${shared.gain}`);
  assert.notEqual(shared.share, '0');
  assert.match(shared.notice, /分走/);
  await page.screenshot({ path: path.join(artifacts, 'heat-kitchen-sharing.png') });
  const eggId = (await dump(page)).foods.find((food) => food.kind === 'egg').id;
  assert.equal(await page.evaluate((id) => window.__HK.discard(id), eggId), true);

  await page.evaluate(() => window.__HK.restart());
  const played = await page.evaluate(() => {
    const plan = [
      [['noodle', 1, 1]],
      [['noodle', 1, 1], ['egg', 1, 3]],
      [['greens', 1, 1], ['egg', 1, 3]],
      [['noodle', 1, 1], ['greens', 1, 3]],
    ];
    let guard = 0;
    while (window.__HK.dump().phase === 'play' && guard < 800) {
      guard += 1;
      const state = window.__HK.dump();
      const order = state.orderIndex;
      for (const [kind, r, c] of plan[order] || []) {
        if (!state.need[kind] || state.foods.some((food) => food.kind === kind)) continue;
        if (!window.__HK.place(kind, r, c)) return { ok: false, why: `place ${kind}`, state: window.__HK.dump() };
      }
      const now = window.__HK.dump();
      const ready = now.foods.find((food) => now.need[food.kind] && document.querySelector(`.token[data-id="${food.id}"]`)?.dataset.band === 'perfect');
      if (ready) {
        if (!window.__HK.serve(ready.id)) return { ok: false, why: 'serve', state: window.__HK.dump() };
        continue;
      }
      window.__HK.tick(1);
      const after = window.__HK.dump();
      if (after.orderIndex !== order && after.results.at(-1)?.how !== 'clear') {
        return { ok: false, why: `order ${order}`, state: after };
      }
    }
    const state = window.__HK.dump();
    return { ok: state.phase === 'result' && state.score >= 12, why: state.phase, state };
  });
  assert.equal(played.ok, true, JSON.stringify({ why: played.why, score: played.state.score, results: played.state.results }));
  let state = played.state;
  assert.equal(state.phase, 'result', `shift ended in ${state.phase} score ${state.score}`);
  assert.ok(state.score >= 12, `score ${state.score}`);
  await page.waitForSelector('[data-action="again"]');
  assert.match(await page.locator('#overlay-title').innerText(), /达标/);
  assert.doesNotMatch(await page.locator('#overlay-title').innerText(), /未达标/);
  await page.screenshot({ path: path.join(artifacts, 'heat-kitchen-success.png') });

  await page.locator('[data-action="again"]').click();
  const again = await dump(page);
  assert.equal(again.phase, 'play');
  assert.equal(again.score, 0);
  assert.equal(again.orderIndex, 0);
  assert.equal(again.foods.length, 0);
  assert.ok(again.residue.every((value) => value === 0));
  assert.equal(again.patience, again.patienceMax);

  await page.evaluate(() => {
    let guard = 0;
    while (window.__HK.dump().phase === 'play' && guard < 2000) {
      window.__HK.tick(1);
      guard += 1;
    }
  });
  const failed = await dump(page);
  assert.equal(failed.phase, 'result');
  assert.equal(failed.score, 0);
  assert.match(await page.locator('#overlay-title').innerText(), /未达标/);
  await page.screenshot({ path: path.join(artifacts, 'heat-kitchen-fail.png') });
  mustOk(desk.errors);
  for (const host of desk.hosts) assert.equal(host, `127.0.0.1:${port}`, `unexpected host ${host}`);

  const video = page.video();
  await desktop.close();
  if (video) {
    const saved = await video.path();
    fs.copyFileSync(saved, path.join(artifacts, 'heat-kitchen-desktop.webm'));
  }

  const phone = await browser.newContext({
    viewport: { width: 360, height: 640 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const mobile = await phone.newPage();
  const mob = track(mobile, 'mobile');
  await mobile.goto(`${base}/heat-kitchen/`, { waitUntil: 'networkidle' });
  await mobile.waitForSelector('#pan .cell');
  const phoneBox = await layout(mobile);
  assert.ok(phoneBox.scrollW <= phoneBox.innerW + 1, `mobile overflow ${phoneBox.scrollW} > ${phoneBox.innerW}`);
  assert.ok(phoneBox.serveBottom <= phoneBox.innerH + 1, `serve below fold ${phoneBox.serveBottom}`);
  const tiny = phoneBox.small.filter((item) => item.id !== 'H1' && !String(item.id).includes(','));
  assert.deepEqual(tiny, [], `small targets ${JSON.stringify(tiny)}`);
  const cell = phoneBox.small.find((item) => String(item.id).includes(','));
  assert.equal(cell, undefined, `small cell ${JSON.stringify(phoneBox.small.filter((item) => String(item.id).includes(',')))}`);

  const noodle = await mobile.locator('[data-kind="noodle"]').boundingBox();
  await mobile.touchscreen.tap(noodle.x + noodle.width / 2, noodle.y + noodle.height / 2);
  const hot = await mobile.locator('[data-cell="1,1"]').boundingBox();
  await mobile.touchscreen.tap(hot.x + hot.width / 2, hot.y + hot.height / 2);
  await mobile.waitForFunction(() => window.__HK.dump().foods.length === 1);
  await mobile.screenshot({ path: path.join(artifacts, 'heat-kitchen-mobile.png') });

  await mobile.evaluate(() => window.__HK.restart());
  const from = await mobile.locator('[data-kind="noodle"]').boundingBox();
  const to = await mobile.locator('[data-cell="1,2"]').boundingBox();
  const cdp = await phone.newCDPSession(mobile);
  const x1 = from.x + from.width / 2;
  const y1 = from.y + from.height / 2;
  const x2 = to.x + to.width / 2;
  const y2 = to.y + to.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
  for (let step = 1; step <= 6; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x1 + ((x2 - x1) * step) / 6, y: y1 + ((y2 - y1) * step) / 6 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mobile.waitForTimeout(200);
  const dragged = await dump(mobile);
  assert.equal(dragged.foods.length, 1, 'touch drag did not place the cake');
  assert.equal(dragged.foods[0].r, 1);
  assert.equal(dragged.foods[0].c, 2);
  assert.ok(BURNER[1][2] >= 4);
  await mobile.screenshot({ path: path.join(artifacts, 'heat-kitchen-mobile-drag.png') });
  mustOk(mob.errors);
  report.push({ desktop: 'pass', mobile: 'pass', score: state.score });
  await phone.close();
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log(JSON.stringify(report, null, 2));
