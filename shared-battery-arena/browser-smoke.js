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

function watch(page, label, requests) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(`${label} page: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`${label} console: ${msg.text()}`);
  });
  page.on('request', (req) => requests.push(`${label} ${req.url()}`));
  return errors;
}

async function shot(page, name) {
  const file = path.join(artifacts, name);
  await page.screenshot({ path: file });
  return file;
}

const TO_PLAYWRIGHT = {
  KeyW: 'w',
  KeyA: 'a',
  KeyS: 's',
  KeyD: 'd',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  ShiftLeft: 'Shift',
  Space: 'Space',
  KeyK: 'k',
  KeyL: 'l',
};

async function releaseKeys(page) {
  for (const name of new Set(Object.values(TO_PLAYWRIGHT))) {
    await page.keyboard.up(name).catch(() => {});
  }
}

async function applyKeys(page, want, held) {
  for (const code of [...held]) {
    if (!want.has(code)) {
      await page.keyboard.up(TO_PLAYWRIGHT[code]);
      held.delete(code);
    }
  }
  for (const code of want) {
    if (!held.has(code)) {
      await page.keyboard.down(TO_PLAYWRIGHT[code]);
      held.add(code);
    }
  }
}

function chaseKeys(snap, local) {
  const want = new Set();
  if (local) want.add('ArrowDown');
  if (snap.phase !== 'play') return want;
  const me = snap.players[0];
  const ball = snap.ball;
  const behind = me.x < ball.x + 8;
  const distBall = Math.hypot(ball.x - me.x, ball.y - me.y);
  const close = distBall < 22 + 13 + 20 && behind;
  const dx = close ? ball.x - me.x : ball.x - 36 - me.x;
  const dy = close ? ball.y - me.y : ball.y - me.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  const right = local ? 'KeyD' : 'ArrowRight';
  const left = local ? 'KeyA' : 'ArrowLeft';
  const down = local ? 'KeyS' : 'ArrowDown';
  const up = local ? 'KeyW' : 'ArrowUp';
  if (nx > 0.28) want.add(right);
  if (nx < -0.28) want.add(left);
  if (ny > 0.28) want.add(down);
  if (ny < -0.28) want.add(up);
  if (!local && dist > 90 && snap.sprintArmed && snap.battery > 45) want.add('ShiftLeft');
  if (close) want.add('Space');
  return want;
}

async function play(page, { local, goals, timeoutMs }) {
  const held = new Set();
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    last = await page.evaluate(() => window.__ARENA.snapshot());
    if (last.phase === 'ended' && last.score[0] >= goals) {
      await releaseKeys(page);
      return last;
    }
    if (!local && last.score[0] >= goals && last.phase !== 'tutorial') {
      await releaseKeys(page);
      return last;
    }
    await applyKeys(page, chaseKeys(last, local), held);
    await page.waitForTimeout(40);
  }
  await releaseKeys(page);
  return last;
}

const server = await startServer();
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;
const gameUrl = `${origin}/shared-battery-arena/`;
const requests = [];
const report = { origin, pages: [] };
let browser;

try {
  browser = await chromium.launch({ headless: true });

  const desktop = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: artifacts, size: { width: 1280, height: 800 } },
  });
  const desk = await desktop.newPage();
  const deskErrors = watch(desk, 'desktop', requests);
  const deskRes = await desk.goto(gameUrl, { waitUntil: 'networkidle' });
  assert.equal(deskRes.status(), 200);
  await desk.waitForFunction(() => window.__ARENA && window.__ARENA.snapshot().phase === 'tutorial');
  report.pages.push({ name: 'desktop-tutorial', shot: await shot(desk, 'shared-battery-desktop-tutorial.png') });

  await desk.locator('#skip').click();
  await desk.waitForFunction(() => window.__ARENA.snapshot().phase === 'play');
  await desk.keyboard.down('ArrowRight');
  await desk.keyboard.down('Shift');
  await desk.waitForTimeout(900);
  let mid = await desk.evaluate(() => ({
    snap: window.__ARENA.snapshot(),
    spend: document.querySelector('#spend').textContent,
  }));
  assert.ok(mid.snap.players[0].x > 190, `car did not move: ${mid.snap.players[0].x}`);
  assert.ok(mid.snap.battery < 90, `sprint did not drain shared battery: ${mid.snap.battery}`);
  assert.match(mid.spend, /花电/);
  report.pages.push({
    name: 'desktop-sprint',
    battery: mid.snap.battery,
    shot: await shot(desk, 'shared-battery-desktop-sprint.png'),
  });
  await desk.keyboard.up('ArrowRight');
  await desk.keyboard.up('Shift');

  const versus = await play(desk, { local: false, goals: 1, timeoutMs: 55000 });
  assert.ok(versus.score[0] >= 1, `no goal versus AI ${JSON.stringify(versus)}`);
  report.pages.push({
    name: 'desktop-goal',
    score: versus.score,
    battery: versus.battery,
    shot: await shot(desk, 'shared-battery-desktop-goal.png'),
  });

  await desk.locator('#mode-local').click();
  await desk.waitForFunction(() => {
    const snap = window.__ARENA.snapshot();
    return snap.mode === 'local' && snap.phase === 'play' && snap.score[0] === 0 && snap.battery === 100;
  });
  const finished = await play(desk, { local: true, goals: 3, timeoutMs: 90000 });
  assert.equal(finished.phase, 'ended', JSON.stringify(finished));
  assert.equal(finished.winner, 0);
  assert.equal(finished.score[0], 3);
  const endCopy = await desk.locator('#spend').textContent();
  assert.match(endCopy, /赢了/);
  assert.match(endCopy, /不是联网/);
  report.pages.push({
    name: 'desktop-match-end',
    score: finished.score,
    shot: await shot(desk, 'shared-battery-desktop-match-end.png'),
  });

  await desk.locator('#restart').click();
  const reset = await desk.evaluate(() => window.__ARENA.snapshot());
  assert.equal(reset.phase, 'play');
  assert.deepEqual(reset.score, [0, 0]);
  assert.equal(reset.battery, 100);
  assert.equal(reset.players[0].vx, 0);
  assert.equal(reset.players[1].vy, 0);
  assert.equal(reset.ball.vx, 0);
  assert.equal(reset.ball.vy, 0);
  assert.equal(reset.time, 0);

  assert.deepEqual(deskErrors, []);
  const deskVideo = desk.video();
  await desktop.close();
  if (deskVideo) await deskVideo.saveAs(path.join(artifacts, 'shared-battery-desktop.webm'));

  const phone = await browser.newContext({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
    recordVideo: { dir: artifacts, size: { width: 360, height: 740 } },
  });
  const mob = await phone.newPage();
  const mobErrors = watch(mob, 'mobile', requests);
  const mobRes = await mob.goto(gameUrl, { waitUntil: 'networkidle' });
  assert.equal(mobRes.status(), 200);
  await mob.waitForFunction(() => window.__ARENA && window.__ARENA.snapshot().phase === 'tutorial');
  const layout = await mob.evaluate(() => {
    const sprint = document.querySelector('#sprint').getBoundingClientRect();
    const kick = document.querySelector('#kick').getBoundingClientRect();
    const stick = document.querySelector('#stick').getBoundingClientRect();
    const note = document.querySelector('#note').textContent;
    return {
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      sprintH: sprint.height,
      kickH: kick.height,
      stickW: stick.width,
      note,
      overflow: getComputedStyle(document.body).overflow,
    };
  });
  assert.ok(layout.scrollW <= layout.innerW + 1, JSON.stringify(layout));
  assert.ok(layout.sprintH >= 64, JSON.stringify(layout));
  assert.ok(layout.kickH >= 64, JSON.stringify(layout));
  assert.ok(layout.stickW >= 88, JSON.stringify(layout));
  assert.match(layout.note, /不是联网/);
  report.pages.push({ name: 'mobile-tutorial', layout, shot: await shot(mob, 'shared-battery-mobile-360.png') });

  await mob.locator('#skip').click();
  await mob.waitForFunction(() => window.__ARENA.snapshot().phase === 'play');
  const cdp = await phone.newCDPSession(mob);
  const stickBox = await mob.locator('#stick').boundingBox();
  const sprintBox = await mob.locator('#sprint').boundingBox();
  const cx = stickBox.x + stickBox.width / 2;
  const cy = stickBox.y + stickBox.height / 2;
  const sx = sprintBox.x + sprintBox.width / 2;
  const sy = sprintBox.y + sprintBox.height / 2;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: cx + stickBox.width * 0.28, y: cy, id: 1, radiusX: 8, radiusY: 8, force: 1 },
      { x: sx, y: sy, id: 2, radiusX: 8, radiusY: 8, force: 1 },
    ],
  });
  await mob.waitForTimeout(1000);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  const touched = await mob.evaluate(() => ({
    snap: window.__ARENA.snapshot(),
    spend: document.querySelector('#spend').textContent,
  }));
  assert.ok(touched.snap.players[0].x > 185, `touch stick did not move the car ${touched.snap.players[0].x}`);
  assert.ok(touched.snap.battery < 92, `touch sprint did not drain ${touched.snap.battery}`);
  report.pages.push({
    name: 'mobile-touch',
    x: touched.snap.players[0].x,
    battery: touched.snap.battery,
    spend: touched.spend,
    shot: await shot(mob, 'shared-battery-mobile-touch.png'),
  });

  await mob.locator('#restart').click();
  await mob.waitForFunction(() => {
    const snap = window.__ARENA.snapshot();
    return snap.phase === 'play' && snap.score[0] === 0 && snap.battery === 100 && snap.players[0].x === 168;
  });
  const mobileGoal = await play(mob, { local: false, goals: 1, timeoutMs: 55000 });
  assert.ok(mobileGoal.score[0] >= 1, `mobile did not score ${JSON.stringify(mobileGoal)}`);
  report.pages.push({
    name: 'mobile-goal',
    score: mobileGoal.score,
    shot: await shot(mob, 'shared-battery-mobile-goal.png'),
  });
  assert.deepEqual(mobErrors, []);
  const mobVideo = mob.video();
  await phone.close();
  if (mobVideo) await mobVideo.saveAs(path.join(artifacts, 'shared-battery-mobile.webm'));

  const external = requests.filter((line) => !line.includes(origin));
  assert.deepEqual(external, [], `external requests: ${external.join('\n')}`);
  report.requests = requests;
  report.ok = true;
  fs.writeFileSync(path.join(artifacts, 'shared-battery-smoke.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
