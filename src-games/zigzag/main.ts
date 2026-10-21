import { run, circle, text, ri } from '../_lib/engine';
const S = 56;
let cells = new Set<string>(), path: [number, number][] = [], bu = 0.5, bv = 0.5, dir = 0, spd = 2.6, cam = 0, camX = 0, gu = 0, gv = 0, best = 0, gems = new Set<string>();
function extend() { while (path.length < Math.floor(bu + bv) + 40) { const d = ri(0, 1), n = ri(1, 4); for (let k = 0; k < n; k++) { if (d === 0) gu++; else gv++; const key = gu + ',' + gv; path.push([gu, gv]); cells.add(key); if (Math.random() < 0.08) gems.add(key); } } }
const P = (u: number, v: number): [number, number] => [360 + (u - v) * S * 0.7 - camX, 900 - (u + v - cam) * S * 0.5];
run({
  id: 'zigzag', name: '之字路', bg: '#7fc8f8', accent: '#ff6b6b',
  help: ['小球会一直往前滚', '点击屏幕切换左右方向', '别让小球掉出路面'],
  start() { path = [0, 1, 2, 3, 4, 5, 6].map(u => [u, 0] as [number, number]); cells = new Set(path.map(p => p.join(','))); gu = 6; gv = 0; gems = new Set(); bu = 0.5; bv = 0.5; dir = 0; spd = 2.6; cam = 1; camX = 0; best = 0; extend(); },
  down() { dir = 1 - dir; }, key(k) { if (k === ' ') dir = 1 - dir; },
  update(dt, g) {
    spd = 2.2 + Math.min(3, g.time * 0.04); if (dir === 0) bu += spd * dt; else bv += spd * dt;
    const key = Math.floor(bu) + ',' + Math.floor(bv);
    if (!cells.has(key)) return g.over('掉下去了');
    if (gems.has(key)) { gems.delete(key); g.add(3); }
    const s = Math.floor(bu + bv); if (s > best) { g.add(s - best); best = s; }
    cam += (bu + bv - cam) * Math.min(1, dt * 4); camX += ((bu - bv) * S * 0.7 - camX) * Math.min(1, dt * 3);
    extend();
  },
  draw(c) {
    for (const [u, v] of path) {
      if (u + v < cam - 14 || u + v > cam + 26) continue;
      const a = P(u, v), b = P(u + 1, v), d = P(u + 1, v + 1), e = P(u, v + 1);
      c.fillStyle = '#e8f4ff'; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...d); c.lineTo(...e); c.closePath(); c.fill();
      c.fillStyle = '#9ab6cf'; c.beginPath(); c.moveTo(...b); c.lineTo(...d); c.lineTo(d[0], d[1] + 26); c.lineTo(b[0], b[1] + 26); c.closePath(); c.fill();
      c.fillStyle = '#7a98b3'; c.beginPath(); c.moveTo(...d); c.lineTo(...e); c.lineTo(e[0], e[1] + 26); c.lineTo(d[0], d[1] + 26); c.closePath(); c.fill();
      if (gems.has(u + ',' + v)) { const m = P(u + 0.5, v + 0.5); circle(c, m[0], m[1] - 14, 10, '#ff6bd6'); }
    }
    const [x, y] = P(bu, bv); circle(c, x, y - 14, 16, '#ff6b6b');
  },
});
