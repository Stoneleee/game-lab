import { run, rr, circle, rnd, W, H, PALETTE, pick } from '../_lib/engine';
const PY = H - 180;
let px = W / 2, tx = W / 2, rocks: { x: number; y: number; r: number; v: number; c: string }[] = [], st = 0, stars: { x: number; y: number }[] = [];
run({
  id: 'dodge', name: '躲避陨石', bg: '#0b1026', accent: '#a0e7e5',
  help: ['左右拖动手指（或方向键）移动飞船', '躲开掉下来的陨石', '坚持越久分越高'],
  start() { px = tx = W / 2; rocks = []; st = 0; stars = Array.from({ length: 60 }, () => ({ x: rnd(0, W), y: rnd(0, H) })); },
  down(x) { tx = x; }, move(x) { tx = x; },
  key(k) { if (k === 'ArrowLeft') tx = px - 120; if (k === 'ArrowRight') tx = px + 120; },
  update(dt, g) {
    g.score = Math.floor(g.time * 10);
    px += (Math.max(40, Math.min(W - 40, tx)) - px) * Math.min(1, dt * 14);
    st -= dt; if (st <= 0) { rocks.push({ x: rnd(30, W - 30), y: 60, r: rnd(22, 50), v: rnd(350, 550) + g.time * 12, c: pick(PALETTE) }); st = Math.max(0.12, 0.6 - g.time * 0.012); }
    rocks.forEach(r => r.y += r.v * dt); rocks = rocks.filter(r => r.y < H + 60);
    stars.forEach(s => { s.y += 80 * dt; if (s.y > H) s.y = 100; });
    if (rocks.some(r => Math.hypot(r.x - px, r.y - PY) < r.r + 30)) g.over('被击中了');
  },
  draw(c) {
    stars.forEach(s => circle(c, s.x, s.y, 2, '#ffffff88'));
    rocks.forEach(r => { circle(c, r.x, r.y, r.r, '#8d6e63'); circle(c, r.x - r.r * 0.3, r.y - r.r * 0.2, r.r * 0.25, '#6d4c41'); circle(c, r.x + r.r * 0.3, r.y + r.r * 0.3, r.r * 0.18, '#6d4c41'); });
    c.fillStyle = '#a0e7e5'; c.beginPath(); c.moveTo(px, PY - 50); c.lineTo(px + 40, PY + 40); c.lineTo(px - 40, PY + 40); c.closePath(); c.fill();
    rr(c, px - 14, PY + 40, 28, 18 + Math.random() * 14, 8, '#ff9f43'); circle(c, px, PY, 12, '#5b8def');
  },
});
