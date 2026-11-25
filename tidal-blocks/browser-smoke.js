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
  const blocked = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('request', (req) => {
    const host = new URL(req.url()).hostname;
    if (host !== '127.0.0.1' && host !== 'localhost') blocked.push(req.url());
  });
  page.on('response', (res) => {
    if (res.status() >= 400) errors.push(`${res.status()} ${res.url()}`);
  });
  page.on('requestfailed', (req) => errors.push(`failed ${req.url()} ${req.failure()?.errorText || ''}`));
  return { errors, blocked };
}

async function layout(page) {
  return page.evaluate(() => {
    const cell = document.querySelector('.cell').getBoundingClientRect();
    const tide = document.querySelector('#tide').getBoundingClientRect();
    const seeds = document.querySelector('#seeds').getBoundingClientRect();
    return {
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      cellW: cell.width,
      cellH: cell.height,
      tideTop: tide.top,
      tideH: tide.height,
      seedsBottom: seeds.bottom,
    };
  });
}

async function playIntro(page, onCompress) {
  await page.locator('button.piece[data-shape="i2v"]').click();
  await page.locator('button.cell[data-r="4"][data-c="5"]').click();
  await page.waitForFunction(() => window.__TB.phase() === 'ready');
  await page.locator('#tide').click();
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('正在挤齐'));
  if (onCompress) await onCompress();
  await page.waitForFunction(() => window.__TB.settled() && window.__TB.phase() === 'won');
}

const server = await startServer();
const port = server.address().port;
const base = `http://127.0.0.1:${port}/tidal-blocks/`;
const browser = await chromium.launch({ headless: true });
const shots = [];

try {
  const desktop = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const deskWatch = track(desktop);
  await desktop.goto(base, { waitUntil: 'networkidle' });
  await desktop.waitForSelector('h1');
  assert.equal(await desktop.locator('h1').innerText(), '潮汐拼块');
  assert.match(await desktop.locator('#coach').innerText(), /竖二/);
  const compressShot = path.join(artifacts, 'tidal-blocks-desktop-compressed.png');
  await playIntro(desktop, async () => {
    const loose = await desktop.locator('.cell.loose').count();
    assert.ok(loose >= 6, `compressed board should still hold the blocks, saw ${loose}`);
    shots.push(compressShot);
    await desktop.screenshot({ path: compressShot, fullPage: true });
  });
  assert.match(await desktop.locator('#status').innerText(), /第 1 列/);
  assert.equal(await desktop.evaluate(() => window.__TB.lines()), 1);
  const best = await desktop.evaluate(() => JSON.parse(localStorage.getItem(window.__TB.storeKey)).best.intro);
  assert.equal(best, 100);
  shots.push(path.join(artifacts, 'tidal-blocks-desktop-cleared.png'));
  await desktop.screenshot({ path: shots.at(-1), fullPage: true });

  await desktop.locator('#undo').click();
  await desktop.waitForFunction(() => window.__TB.phase() === 'ready' && window.__TB.score() === 0);
  assert.match(await desktop.locator('#status').innerText(), /撤销/);
  await desktop.locator('#restart').click();
  await desktop.waitForFunction(() => window.__TB.phase() === 'place' && window.__TB.remaining().length === 1);

  await desktop.locator('button[data-seed="tight"]').click();
  await desktop.waitForFunction(() => window.__TB.seed() === 'tight' && window.__TB.phase() === 'place');
  await desktop.locator('button.piece[data-shape="dot"]').click();
  await desktop.locator('button.cell[data-r="5"][data-c="2"]').click();
  await desktop.waitForFunction(() => window.__TB.phase() === 'dead');
  assert.match(await desktop.locator('#status').innerText(), /死局/);
  assert.match(await desktop.locator('#status').innerText(), /横三/);
  shots.push(path.join(artifacts, 'tidal-blocks-deadlock.png'));
  await desktop.screenshot({ path: shots.at(-1), fullPage: true });
  await desktop.locator('#undo').click();
  await desktop.waitForFunction(() => window.__TB.phase() === 'place');
  await desktop.locator('button.piece[data-shape="dot"]').click();
  await desktop.locator('button.cell[data-r="4"][data-c="5"]').click();
  await desktop.locator('button.piece[data-shape="i3"]').click();
  await desktop.locator('button.cell[data-r="5"][data-c="1"]').click();
  await desktop.locator('#tide').click();
  await desktop.waitForFunction(() => window.__TB.settled() && window.__TB.phase() === 'won');

  await desktop.locator('button[data-seed="intro"]').click();
  await desktop.waitForFunction(() => window.__TB.seed() === 'intro' && window.__TB.phase() === 'place');
  await desktop.locator('#demo').click();
  await desktop.waitForFunction(() => window.__TB.phase() === 'ready');
  assert.match(await desktop.locator('#status').innerText(), /演示/);
  await desktop.locator('#undo').click();
  await desktop.waitForFunction(() => window.__TB.phase() === 'place');

  const box = await layout(desktop);
  assert.ok(box.scrollW <= box.clientW + 1, `desktop overflow ${box.scrollW}>${box.clientW}`);
  assert.ok(deskWatch.errors.length === 0, deskWatch.errors.join('\n'));
  assert.deepEqual(deskWatch.blocked, []);
  await desktop.close();

  const phone = await browser.newPage({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const phoneWatch = track(phone);
  await phone.goto(base, { waitUntil: 'networkidle' });
  await phone.waitForSelector('#board');
  const before = await layout(phone);
  assert.ok(before.scrollW <= before.clientW + 1, `phone overflow ${before.scrollW}>${before.clientW}`);
  assert.ok(before.cellW >= 40 && before.cellH >= 40, `cell ${before.cellW}x${before.cellH}`);
  await phone.locator('button.piece[data-shape="i2v"]').tap();
  await phone.locator('button.cell[data-r="4"][data-c="5"]').tap();
  shots.push(path.join(artifacts, 'tidal-blocks-mobile-preview.png'));
  await phone.screenshot({ path: shots.at(-1), fullPage: true });
  const previewGhosts = await phone.locator('.cell.ghost').count();
  assert.ok(previewGhosts >= 4, `expected tide ghosts, got ${previewGhosts}`);
  await phone.locator('#tide').scrollIntoViewIfNeeded();
  await phone.locator('#tide').tap();
  await phone.waitForFunction(() => window.__TB.settled() && window.__TB.phase() === 'won');
  const after = await layout(phone);
  assert.ok(after.scrollW <= after.clientW + 1, `phone overflow after ${after.scrollW}>${after.clientW}`);
  assert.ok(phoneWatch.errors.length === 0, phoneWatch.errors.join('\n'));
  assert.deepEqual(phoneWatch.blocked, []);
  await phone.close();

  console.log(JSON.stringify({ ok: true, shots, desktop: box, phone: before }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}
