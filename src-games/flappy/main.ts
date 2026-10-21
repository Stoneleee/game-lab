import { run, rr, circle, rnd, W, H } from '../_lib/engine';
const GAP = 300, PW = 120, BX = 200, GROUND = H - 120;
let y = 0, vy = 0, pipes: { x: number; gy: number; passed: boolean }[] = [], spawnT = 0, t = 0;
const flap = () => { vy = -720; };
run({
  id: 'flappy', name: '飞飞鸟', bg: '#7ec8f2', accent: '#ffc857',
  help: ['点击屏幕（或空格）让小鸟往上飞', '穿过水管的缝隙得分', '别撞到水管和地面'],
  start() { y = 600; vy = 0; pipes = []; spawnT = 0.8; t = 0; },
  down: flap, key(k) { if (k === ' ' || k === 'ArrowUp') flap(); },
  update(dt, g) {
    t += dt; vy += 2200 * dt; y += vy * dt;
    const sp = 280 + Math.min(200, g.score * 6);
    spawnT -= dt; if (spawnT <= 0) { pipes.push({ x: W + 40, gy: rnd(300, GROUND - 300 - GAP / 2) + GAP / 2, passed: false }); spawnT = 1.5; }
    for (const p of pipes) { p.x -= sp * dt; if (!p.passed && p.x + PW < BX) { p.passed = true; g.add(1); } }
    pipes = pipes.filter(p => p.x > -PW - 20);
    if (y > GROUND - 30 || y < 110) g.over('撞到了');
    for (const p of pipes) if (BX + 28 > p.x && BX - 28 < p.x + PW && (y - 28 < p.gy - GAP / 2 || y + 28 > p.gy + GAP / 2)) g.over('撞到了');
  },
  draw(c) {
    for (let i = 0; i < 4; i++) { const cx = ((i * 260 - t * 40) % (W + 300) + W + 300) % (W + 300) - 150; circle(c, cx, 250 + i * 70, 50, '#ffffffaa'); circle(c, cx + 50, 240 + i * 70, 60, '#ffffffaa'); }
    for (const p of pipes) {
      rr(c, p.x, 0, PW, p.gy - GAP / 2, 0, '#5cbf4a', '#2d7a22', 6); rr(c, p.x - 10, p.gy - GAP / 2 - 50, PW + 20, 50, 8, '#6fd65c', '#2d7a22', 6);
      rr(c, p.x, p.gy + GAP / 2, PW, GROUND - p.gy - GAP / 2, 0, '#5cbf4a', '#2d7a22', 6); rr(c, p.x - 10, p.gy + GAP / 2, PW + 20, 50, 8, '#6fd65c', '#2d7a22', 6);
    }
    c.fillStyle = '#ded895'; c.fillRect(0, GROUND, W, H - GROUND); c.fillStyle = '#7bd389'; c.fillRect(0, GROUND, W, 24);
    c.save(); c.translate(BX, y); c.rotate(Math.max(-0.5, Math.min(1.2, vy / 900)));
    circle(c, 0, 0, 32, '#ffc857'); circle(c, 12, -10, 10, '#fff'); circle(c, 15, -10, 5, '#222');
    c.fillStyle = '#ff9f43'; c.beginPath(); c.moveTo(26, 0); c.lineTo(48, 6); c.lineTo(26, 14); c.fill();
    circle(c, -12, 6, 14, '#f7b733'); c.restore();
  },
});
