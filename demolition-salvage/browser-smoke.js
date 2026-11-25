import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { SOLUTIONS } from './solutions.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = '/opt/cursor/artifacts';
fs.mkdirSync(artifacts, { recursive: true });

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
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
  page.on('pageerror', (err) => errors.push(`${label} page: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`${label} console: ${msg.text()}`);
  });
  return errors;
}

async function shot(page, x, y) {
  await page.locator(`button.cell[data-x="${x}"][data-y="${y}"]`).click();
  await page.locator('#confirm').click();
  await page.waitForFunction(() => {
    const ds = window.__DS;
    return (ds.accepting() && ds.phase() !== 'play') || !ds.accepting();
  });
  await page.waitForFunction(() => window.__DS.accepting());
}

async function layout(page) {
  return page.evaluate(() => {
    const cell = document.querySelector('.cell').getBoundingClientRect();
    const confirm = document.querySelector('#confirm').getBoundingClientRect();
    const touch = new Event('touchmove', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(touch);
    return {
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      scrollY: window.scrollY,
      cell: cell.width,
      cellH: cell.height,
      confirmBottom: confirm.bottom,
      confirmH: confirm.height,
      overflow: getComputedStyle(document.body).overflow,
      touchAction: getComputedStyle(document.body).touchAction,
      prevented: touch.defaultPrevented,
      title: document.querySelector('h1').textContent,
    };
  });
}

const server = await startServer();
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
const gameUrl = `${base}/demolition-salvage/`;
let browser;
const results = [];

try {
  for (const file of ['/', '/games.json', '/demolition-salvage/', '/demolition-salvage/main.js', '/demolition-salvage/sim.js', '/demolition-salvage/style.css', '/switchmail/', '/flip-trap-m0/']) {
    const response = await fetch(base + file);
    assert.equal(response.status, 200, file);
    results.push(`${file} 200`);
  }
  const games = await (await fetch(`${base}/games.json`)).json();
  assert.ok(games.some((game) => game.slug === 'demolition-salvage'));
  assert.ok(games.some((game) => game.slug === 'stack-tower'));

  browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: '/tmp/ds-video', size: { width: 1280, height: 800 } },
  });
  const page = await desktop.newPage();
  const desktopErrors = track(page, 'desktop');
  await page.goto(gameUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.ent[data-kind="wood"]');
  assert.equal(await page.title(), '拆迁保全队');
  assert.match(await page.locator('h1').innerText(), /拆迁保全队/);

  const audioOff = await page.evaluate(() => window.__DS.audio());
  assert.equal(audioOff.want, false);
  assert.equal(audioOff.unlocked, false);
  assert.equal(audioOff.muted, true);
  await page.locator('#mute').click();
  const audioOn = await page.evaluate(() => window.__DS.audio());
  assert.equal(audioOn.want, true);
  assert.equal(audioOn.unlocked, true);
  assert.equal(audioOn.muted, false);
  assert.ok(audioOn.gain > 0);
  await page.locator('#mute').click();
  const audioMuted = await page.evaluate(() => window.__DS.audio());
  assert.equal(audioMuted.want, false);
  assert.equal(audioMuted.gain, 0);
  assert.equal(await page.locator('#mute').getAttribute('aria-pressed'), 'false');

  const desktopFit = await layout(page);
  assert.equal(desktopFit.title, '拆迁保全队');
  assert.ok(desktopFit.scrollW <= desktopFit.innerW + 1, JSON.stringify(desktopFit));
  assert.equal(desktopFit.scrollY, 0);
  assert.equal(desktopFit.overflow, 'hidden');
  assert.equal(desktopFit.touchAction, 'none');
  assert.equal(desktopFit.prevented, true);
  assert.ok(desktopFit.cell >= 44, JSON.stringify(desktopFit));
  assert.ok(desktopFit.confirmH >= 48);
  await page.screenshot({ path: path.join(artifacts, 'demolition-salvage-desktop-level1.png') });

  await page.locator('#levels').click();
  assert.equal(await page.locator('button[data-level="1"]').isDisabled(), true);
  assert.equal(await page.locator('button[data-level="0"]').isDisabled(), false);
  await page.screenshot({ path: path.join(artifacts, 'demolition-salvage-level-select.png') });
  await page.locator('#close-modal').click();

  await page.evaluate(() => window.__DS.setDelay(500));
  await page.locator('button.cell[data-x="2"][data-y="3"]').click();
  await page.screenshot({ path: path.join(artifacts, 'demolition-salvage-desktop-preview.png') });
  assert.match(await page.locator('#confirm').innerText(), /拆除/);
  await page.locator('#confirm').click();
  const duringHandle = await page.waitForFunction(() => {
    const falling = window.__DS.entities().find((block) => block.material === 'wood' && block.rubble);
    if (!falling || falling.y >= 3) return null;
    if (!document.getElementById('status').textContent.includes('坍落')) return null;
    if (window.__DS.phase() !== 'resolving' || window.__DS.reason() !== '') return null;
    return { phase: window.__DS.phase(), reason: window.__DS.reason(), y: falling.y, salvage: window.__DS.session.state.salvage };
  });
  const during = await duringHandle.jsonValue();
  assert.equal(during.phase, 'resolving');
  assert.equal(during.reason, '');
  assert.equal(during.salvage, 0);
  await page.screenshot({ path: path.join(artifacts, 'demolition-salvage-desktop-collapse.png') });
  await page.waitForFunction(() => window.__DS.phase() === 'won');
  assert.match(await page.locator('#banner-text').innerText(), /回收箱/);
  await page.screenshot({ path: path.join(artifacts, 'demolition-salvage-desktop-win.png') });

  await page.evaluate(() => window.__DS.setDelay(40));
  await page.locator('#next').click();
  await page.waitForFunction(() => window.__DS.session.state.name === '保住绿房');
  const level2Start = await page.evaluate(() => window.__DS.fingerprint());
  await shot(page, 3, 4);
  assert.equal(await page.evaluate(() => window.__DS.phase()), 'lost');
  assert.match(await page.locator('#banner-text').innerText(), /砸中/);
  const impact = await page.evaluate(() => {
    const ents = window.__DS.entities();
    const rooms = ents.filter((e) => e.material === 'protected');
    return {
      rooms: rooms.length,
      overlap: rooms.some((room) => ents.filter((e) => e.x === room.x && e.y === room.y).length > 1),
      sitting: ents.some((block) => rooms.some((room) => block.material !== 'protected' && block.x === room.x && block.y === room.y + 1)),
      salvage: window.__DS.session.state.salvage,
      goal: window.__DS.session.state.goal,
    };
  });
  assert.equal(impact.rooms, 2);
  assert.equal(impact.overlap, false);
  assert.equal(impact.sitting, true);
  assert.ok(impact.salvage >= impact.goal);
  await page.screenshot({ path: path.join(artifacts, 'demolition-salvage-protected-fail.png') });

  await page.locator('#undo').click();
  assert.equal(await page.evaluate(() => window.__DS.fingerprint()), level2Start);
  assert.equal(await page.evaluate(() => window.__DS.phase()), 'play');
  await shot(page, 3, 4);
  await page.locator('#restart').click();
  assert.equal(await page.evaluate(() => window.__DS.fingerprint()), level2Start);
  assert.equal(await page.locator('#banner').isHidden(), true);

  for (let index = 1; index < SOLUTIONS.length; index++) {
    if (index > 1) {
      await page.locator('#next').click();
      await page.waitForFunction((n) => window.__DS.session.levelIndex === n, index);
    }
    for (const [x, y] of SOLUTIONS[index].shots) await shot(page, x, y);
    assert.equal(await page.evaluate(() => window.__DS.phase()), 'won', `level ${index + 1}`);
  }
  assert.match(await page.locator('#next').innerText(), /选关/);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#levels');
  await page.locator('#levels').click();
  for (let index = 0; index < 6; index++) {
    const button = page.locator(`button[data-level="${index}"]`);
    assert.equal(await button.isDisabled(), false, `level ${index + 1} stayed locked`);
    assert.match(await button.innerText(), /已通过/);
  }
  await page.screenshot({ path: path.join(artifacts, 'demolition-salvage-progress.png') });

  assert.deepEqual(desktopErrors, []);
  const video = page.video();
  await desktop.close();
  const videoPath = await video.path();
  fs.copyFileSync(videoPath, path.join(artifacts, 'demolition-salvage-play.webm'));

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const phone = await mobile.newPage();
  const phoneErrors = track(phone, 'phone');
  await phone.goto(gameUrl, { waitUntil: 'networkidle' });
  await phone.evaluate(() => localStorage.clear());
  await phone.reload({ waitUntil: 'networkidle' });
  await phone.waitForSelector('.ent[data-kind="wood"]');
  await phone.evaluate(() => window.__DS.setDelay(0));
  const phoneFit = await layout(phone);
  assert.ok(phoneFit.scrollW <= phoneFit.innerW + 1, JSON.stringify(phoneFit));
  assert.equal(phoneFit.scrollY, 0);
  assert.equal(phoneFit.touchAction, 'none');
  assert.equal(phoneFit.prevented, true);
  assert.ok(phoneFit.cell >= 44, JSON.stringify(phoneFit));
  assert.ok(phoneFit.confirmBottom <= phoneFit.innerH + 1, JSON.stringify(phoneFit));
  assert.ok(phoneFit.confirmH >= 48);
  await phone.screenshot({ path: path.join(artifacts, 'demolition-salvage-mobile-level1.png') });

  await phone.setViewportSize({ width: 360, height: 640 });
  await phone.evaluate(() => window.__DS.debugGoto(5));
  await phone.waitForFunction(() => window.__DS.session.state.name === '关键两下');
  const tight = await layout(phone);
  assert.ok(tight.scrollW <= tight.innerW + 1, JSON.stringify(tight));
  assert.ok(tight.confirmBottom <= tight.innerH + 1, JSON.stringify(tight));
  assert.ok(tight.cell >= 32, JSON.stringify(tight));
  await phone.screenshot({ path: path.join(artifacts, 'demolition-salvage-mobile-level6.png') });

  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.evaluate(() => window.__DS.debugGoto(0));
  await phone.locator('button.cell[data-x="2"][data-y="3"]').tap();
  await phone.locator('#confirm').tap();
  await phone.waitForFunction(() => window.__DS.phase() === 'won');
  await phone.screenshot({ path: path.join(artifacts, 'demolition-salvage-mobile-win.png') });
  assert.deepEqual(phoneErrors, []);
  await mobile.close();

  console.log(results.join('\n'));
  console.log('browser smoke passed');
} finally {
  if (browser) await browser.close();
  server.close();
}
