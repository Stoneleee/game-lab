import { run, text, circle, ri, W, H } from '../_lib/engine';
const R = [26, 36, 48, 60, 74, 90, 108, 126, 146, 168, 190];
const C = ['#ff6b6b', '#ff9f43', '#ffc857', '#7bd389', '#4ecdc4', '#5b8def', '#b388ff', '#f78fb3', '#e17055', '#00b894', '#fdcb6e'];
const L = 30, Rt = W - 30, B = H - 40, LINE = 300;
type Ball = { x: number; y: number; vx: number; vy: number; l: number; dead?: boolean; age: number };
let balls: Ball[] = [], next = 0, aimX = W / 2, cool = 0, danger = 0;
run({
  id: 'merge', name: '合成大球', bg: '#fff4e0', accent: '#e17055',
  help: ['点击/拖动选择位置，松手投下小球', '两个相同的球相碰会合成更大的球', '球堆过红线就输了'],
  start() { balls = []; next = ri(0, 2); cool = 0; danger = 0; },
  move(x) { aimX = x; }, down(x) { aimX = x; },
  up(x, _y) {
    if (cool > 0) return; aimX = x; const r = R[next];
    balls.push({ x: Math.min(Rt - r, Math.max(L + r, x)), y: 200, vx: 0, vy: 0, l: next, age: 0 });
    next = ri(0, 3); cool = 0.5;
  },
  key(k) { if (k === 'ArrowLeft') aimX -= 40; if (k === 'ArrowRight') aimX += 40; if (k === ' ') (this as any).up(aimX, 0); },
  update(dt, g) {
    cool -= dt;
    for (let step = 0; step < 4; step++) {
      const h = dt / 4;
      for (const b of balls) {
        b.vy += 1800 * h; b.x += b.vx * h; b.y += b.vy * h; b.age += h; const r = R[b.l];
        if (b.x < L + r) { b.x = L + r; b.vx *= -0.3; } if (b.x > Rt - r) { b.x = Rt - r; b.vx *= -0.3; }
        if (b.y > B - r) { b.y = B - r; b.vy *= -0.2; b.vx *= 0.95; }
      }
      for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], o = balls[j]; if (a.dead || o.dead) continue;
        const dx = o.x - a.x, dy = o.y - a.y, d = Math.hypot(dx, dy) || 0.01, ov = R[a.l] + R[o.l] - d;
        if (ov > 0) {
          if (a.l === o.l && a.l < R.length - 1) {
            a.dead = o.dead = true; g.add((a.l + 1) * 10);
            balls.push({ x: (a.x + o.x) / 2, y: (a.y + o.y) / 2, vx: 0, vy: -100, l: a.l + 1, age: 1 }); continue;
          }
          const nx = dx / d, ny = dy / d, ma = R[a.l] ** 2, mo = R[o.l] ** 2, t = ma + mo;
          a.x -= nx * ov * mo / t; a.y -= ny * ov * mo / t; o.x += nx * ov * ma / t; o.y += ny * ov * ma / t;
          const rv = (o.vx - a.vx) * nx + (o.vy - a.vy) * ny;
          if (rv < 0) { const imp = -1.2 * rv / t; a.vx -= imp * mo * nx; a.vy -= imp * mo * ny; o.vx += imp * ma * nx; o.vy += imp * ma * ny; }
        }
      }
      balls = balls.filter(b => !b.dead);
    }
    const high = balls.some(b => b.age > 1.2 && b.y - R[b.l] < LINE && Math.abs(b.vy) < 60);
    danger = high ? danger + dt : 0; if (danger > 1.5) g.over('堆满了');
  },
  draw(c) {
    c.fillStyle = '#f3d9b1'; c.fillRect(L, LINE, Rt - L, B - LINE);
    c.strokeStyle = danger > 0 ? '#ff3b3b' : '#ff6b6b88'; c.setLineDash([16, 12]); c.lineWidth = 4;
    c.beginPath(); c.moveTo(L, LINE); c.lineTo(Rt, LINE); c.stroke(); c.setLineDash([]);
    if (cool <= 0) { circle(c, Math.min(Rt - R[next], Math.max(L + R[next], aimX)), 200, R[next], C[next]); }
    for (const b of balls) { circle(c, b.x, b.y, R[b.l], C[b.l]); circle(c, b.x - R[b.l] * 0.3, b.y - R[b.l] * 0.3, R[b.l] * 0.25, '#ffffff55'); text(c, b.l + 1, b.x, b.y, Math.max(20, R[b.l] * 0.7), '#fff'); }
  },
});
