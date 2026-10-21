import { run, circle, text, rnd } from '../_lib/engine';
type O = { x: number; y: number; vx: number; vy: number; r: number };
const CX = 360, CY = 700;
let rocks: O[] = [], shots: O[] = [], ang = -Math.PI / 2, lives = 3, spawn = 0, inv = 0, cool = 0, tx = 360, ty = 300, holding = false;
function spawnRock(t: number) { const a = rnd(0, 6.28), d = 800, x = CX + Math.cos(a) * d, y = CY + Math.sin(a) * d, s = rnd(60, 110) + t; const ta = Math.atan2(CY - y, CX - x) + rnd(-0.4, 0.4); rocks.push({ x, y, vx: Math.cos(ta) * s, vy: Math.sin(ta) * s, r: rnd(45, 70) }); }
run({
  id: 'asteroids', name: '陨石防线', bg: '#05060f', accent: '#ffc857',
  help: ['点击或按住屏幕，炮台朝那里开火', '大陨石会碎成小陨石', '陨石撞到炮台扣命，共 3 条命'],
  start() { rocks = []; shots = []; lives = 3; spawn = 0.5; inv = 0; holding = false; },
  down(x, y) { tx = x; ty = y; holding = true; }, move(x, y) { tx = x; ty = y; }, up() { holding = false; },
  update(dt, g) {
    g.hud(`❤️ ${lives}`); inv -= dt; cool -= dt; ang = Math.atan2(ty - CY, tx - CX);
    if (holding && cool <= 0) { cool = 0.2; shots.push({ x: CX + Math.cos(ang) * 50, y: CY + Math.sin(ang) * 50, vx: Math.cos(ang) * 1000, vy: Math.sin(ang) * 1000, r: 6 }); }
    spawn -= dt; if (spawn <= 0) { spawn = Math.max(0.5, 1.8 - g.time / 50); spawnRock(g.time); }
    for (const o of [...rocks, ...shots]) { o.x += o.vx * dt; o.y += o.vy * dt; }
    const nr: O[] = [];
    for (const r of rocks) { const s = shots.find(s => s.r > 0 && Math.hypot(s.x - r.x, s.y - r.y) < r.r + 6); if (s) { s.r = 0; r.r = r.r > 40 ? 0.01 + r.r : r.r; g.add(r.r > 40 ? 1 : 2); if (r.r > 40) for (let k = 0; k < 2; k++) { const a = rnd(0, 6.28); nr.push({ x: r.x, y: r.y, vx: r.vx + Math.cos(a) * 120, vy: r.vy + Math.sin(a) * 120, r: r.r / 2 }); } r.r = -1; } }
    rocks = rocks.filter(r => r.r > 0).concat(nr); shots = shots.filter(s => s.r > 0 && s.x > -20 && s.x < 740 && s.y > 100 && s.y < 1300);
    if (inv <= 0) { const h = rocks.find(r => Math.hypot(r.x - CX, r.y - CY) < r.r + 40); if (h) { h.r = -1; rocks = rocks.filter(r => r.r > 0); lives--; inv = 1.2; if (lives <= 0) return g.over('炮台被摧毁'); } }
    rocks = rocks.filter(r => Math.hypot(r.x - CX, r.y - CY) < 1000);
  },
  draw(c, g) {
    for (const r of rocks) { circle(c, r.x, r.y, r.r, '#8d7b68'); circle(c, r.x - r.r * 0.3, r.y - r.r * 0.2, r.r * 0.25, '#6d5c4b'); }
    for (const s of shots) circle(c, s.x, s.y, 6, '#ffc857');
    if (inv <= 0 || Math.floor(g.time * 10) % 2) { c.save(); c.translate(CX, CY); c.rotate(ang); c.fillStyle = '#9ad1ff'; c.fillRect(0, -10, 55, 20); c.restore(); circle(c, CX, CY, 36, '#e0f0ff'); }
  },
});
