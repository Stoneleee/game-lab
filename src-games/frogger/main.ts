import { run, rr, circle, text, rnd, pick, W, H } from '../_lib/engine';
type Lane = { type: 'grass' | 'road' | 'river'; v: number; objs: { x: number; w: number; c: string }[] };
const RH = 90, BASE = 1120;
let dx0 = 0, dy0 = 0, lanes: Lane[] = [], fr = 0, fx = 360, cam = 0, maxR = 0, hop = 0;
function lane(r: number): Lane {
  if (!lanes[r]) {
    const type = r < 3 ? 'grass' : pick(['road', 'road', 'river', 'grass'] as const);
    const v = (Math.random() < 0.5 ? -1 : 1) * rnd(90, 160 + Math.min(200, r * 4));
    const objs = [];
    if (type !== 'grass') { const w = type === 'road' ? rnd(90, 160) : rnd(180, 280); const gap = type === 'road' ? rnd(220, 380) : rnd(140, 230); for (let x = rnd(-200, 0); x < 1100; x += w + gap) objs.push({ x, w, c: type === 'road' ? pick(['#ff6b6b', '#5b8def', '#ffc857', '#b388ff']) : '#8b5a2b' }); }
    lanes[r] = { type, v, objs };
  }
  return lanes[r];
}
const sy = (r: number) => BASE - (r - cam) * RH;
run({
  id: 'frogger', name: '过马路', bg: '#6fbf5a', accent: '#ffc857',
  help: ['点击向前跳，左右滑动横移', '躲开车辆，河里要踩着木头', '别落在屏幕后面太久'],
  start() { lanes = []; fr = 0; fx = 360; cam = 0; maxR = 0; hop = 0; },
  down(x, y) { dx0 = x; dy0 = y; },
  up(x, y) { if (Math.hypot(x - dx0, y - dy0) < 40) { fr++; hop = 0.12; } },
  swipe(d) { if (d === 'L') fx = Math.max(45, fx - 80); else if (d === 'R') fx = Math.min(W - 45, fx + 80); else if (d === 'U') fr++; else if (d === 'D' && fr > 0) fr--; hop = 0.12; },
  key(k) { if (k === ' ') { fr++; hop = 0.12; } },
  update(dt, g) {
    hop -= dt;
    for (let r = Math.max(0, Math.floor(cam) - 2); r < cam + 16; r++) { const L = lane(r); for (const o of L.objs) { o.x += L.v * dt; if (L.v > 0 && o.x > 1100) o.x -= 1400; if (L.v < 0 && o.x + o.w < -380) o.x += 1400; } }
    if (fr > maxR) { g.add(fr - maxR); maxR = fr; }
    cam += dt * Math.min(1.2, 0.25 + g.time / 120); cam = Math.max(cam, fr - 6);
    const L = lane(fr);
    if (hop <= 0) {
      if (L.type === 'road' && L.objs.some(o => fx > o.x - 25 && fx < o.x + o.w + 25)) return g.over('被车撞了');
      if (L.type === 'river') { const log = L.objs.find(o => fx > o.x && fx < o.x + o.w); if (!log) return g.over('掉进河里'); fx += L.v * dt; if (fx < 0 || fx > W) return g.over('被冲走了'); }
    }
    if (sy(fr) > H + 20) return g.over('太慢了');
  },
  draw(c) {
    for (let r = Math.max(0, Math.floor(cam) - 2); r < cam + 14; r++) {
      const L = lane(r), y = sy(r);
      c.fillStyle = L.type === 'road' ? '#3d3f4a' : L.type === 'river' ? '#3fa7d6' : (r % 2 ? '#6fbf5a' : '#7ccb66'); c.fillRect(0, y - RH / 2, W, RH);
      if (L.type === 'road') for (let x = 0; x < W; x += 80) c.fillStyle = '#ffffff55', c.fillRect(x, y + RH / 2 - 4, 40, 4);
      for (const o of L.objs) rr(c, o.x, y - 30, o.w, 60, L.type === 'road' ? 14 : 24, o.c);
    }
    const y = sy(fr) - (hop > 0 ? 18 : 0);
    circle(c, fx, y, 30, '#4caf50'); circle(c, fx - 12, y - 18, 10, '#fff'); circle(c, fx + 12, y - 18, 10, '#fff'); circle(c, fx - 12, y - 18, 5, '#000'); circle(c, fx + 12, y - 18, 5, '#000');
  },
});
