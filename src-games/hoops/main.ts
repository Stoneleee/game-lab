import { run, circle, text, W, H } from '../_lib/engine';
const BR = 40, RIM = 70, START: [number, number] = [W / 2, H - 200];
let bx = 0, by = 0, vx = 0, vy = 0, flying = false, hx = W / 2, hy = 420, hv = 0, lives = 3, scored = false, passedAbove = false, t0 = 0, sx = 0, sy = 0, streak = 0, msg = '', msgT = 0;
const reset = () => { bx = START[0]; by = START[1]; vx = vy = 0; flying = false; scored = false; passedAbove = false; };
run({
  id: 'hoops', name: '指尖投篮', bg: '#2b2d42', accent: '#ff9f43',
  help: ['按住篮球向上滑动投篮', '空心入网连击加分，篮筐会越来越难', '3 次没投进就结束'],
  start(g) { lives = 3; streak = 0; hx = W / 2; hv = 0; reset(); g.hud('🏀 x3'); },
  down(x, y) { if (!flying) { sx = x; sy = y; t0 = performance.now(); } },
  up(x, y) {
    if (flying || sy - y < 40) return; const dt = Math.max(60, performance.now() - t0) / 1000;
    vx = Math.max(-900, Math.min(900, (x - sx) / dt * 0.6)); vy = -Math.min(2000, Math.max(1500, (sy - y) / dt * 0.9)); flying = true;
  },
  key(k) { if (k === ' ' && !flying) { vx = (hx - bx) * 1.05; vy = -1750; flying = true; } },
  update(dt, g) {
    if (g.score >= 6) { hv = hv || 160 + g.score * 8; hx += hv * dt; if (hx < 140 || hx > W - 140) hv = -hv; }
    msgT -= dt; if (!flying) return;
    vy += 2400 * dt; bx += vx * dt; by += vy * dt;
    if (by < hy - 20) passedAbove = true;
    for (const ex of [hx - RIM, hx + RIM]) { const dx = bx - ex, dy = by - hy, d = Math.hypot(dx, dy); if (d < BR + 8) { const nx = dx / d, ny = dy / d, dot = vx * nx + vy * ny; if (dot < 0) { vx -= 1.6 * dot * nx; vy -= 1.6 * dot * ny; } bx = ex + nx * (BR + 8); by = hy + ny * (BR + 8); } }
    if (!scored && passedAbove && vy > 0 && Math.abs(by - hy) < 20 && Math.abs(bx - hx) < RIM - 10) { scored = true; streak++; g.add(streak); msg = streak > 1 ? `连进 x${streak}!` : '进球!'; msgT = 1; }
    if (by > H + 100 || bx < -100 || bx > W + 100) { if (!scored) { lives--; streak = 0; g.hud('🏀 x' + lives); msg = '没进…'; msgT = 1; if (lives <= 0) return g.over('没球了'); } reset(); }
  },
  draw(c) {
    c.fillStyle = '#fff'; c.fillRect(hx - 130, hy - 200, 260, 170); c.strokeStyle = '#ff6b6b'; c.lineWidth = 6; c.strokeRect(hx - 130, hy - 200, 260, 170); c.strokeRect(hx - 50, hy - 120, 100, 80);
    const front = flying && vy > 0 && by < hy;
    const ball = () => { circle(c, bx, by, BR, '#ff9f43'); c.strokeStyle = '#7a3e00'; c.lineWidth = 3; c.beginPath(); c.arc(bx, by, BR, 0, 7); c.moveTo(bx - BR, by); c.lineTo(bx + BR, by); c.moveTo(bx, by - BR); c.lineTo(bx, by + BR); c.stroke(); };
    if (!front) ball();
    c.strokeStyle = '#ffffffcc'; c.lineWidth = 3; for (let i = 0; i <= 6; i++) { c.beginPath(); c.moveTo(hx - RIM + i * RIM / 3, hy); c.lineTo(hx - RIM * 0.6 + i * RIM * 0.2, hy + 90); c.stroke(); }
    c.strokeStyle = '#ff6b6b'; c.lineWidth = 10; c.beginPath(); c.moveTo(hx - RIM, hy); c.lineTo(hx + RIM, hy); c.stroke();
    if (front) ball();
    if (msgT > 0) text(c, msg, W / 2, 700, 64, '#ffc857');
    if (!flying) text(c, '↑ 按住篮球向上滑', W / 2, H - 80, 32, '#c9cdf0', 'center', false);
  },
});
