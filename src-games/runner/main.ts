import { run, rr, circle, rnd, pick, text, W } from '../_lib/engine';
const GY = 900, PX = 160;
let y = 0, vy = 0, jumps = 0, obs: { x: number; w: number; h: number }[] = [], coins: { x: number; y: number }[] = [], sp = 0, spawnT = 0, dist = 0, t = 0;
const jump = () => { if (jumps < 2) { vy = jumps ? -950 : -1100; jumps++; } };
run({
  id: 'runner', name: '酷跑小子', bg: '#ffe7c2', accent: '#ff6b6b',
  help: ['点击屏幕跳跃，空中可以再跳一次', '跳过障碍，收集金币', '越跑越快，撞上就结束'],
  start() { y = GY; vy = 0; jumps = 0; obs = []; coins = []; sp = 420; spawnT = 1; dist = 0; t = 0; },
  down: jump, key(k) { if (k === ' ' || k === 'ArrowUp') jump(); },
  update(dt, g) {
    t += dt; sp += 12 * dt; dist += sp * dt; g.score = Math.floor(dist / 50);
    vy += 3000 * dt; y += vy * dt; if (y >= GY) { y = GY; vy = 0; jumps = 0; }
    spawnT -= dt * sp / 420;
    if (spawnT <= 0) { const h = pick([70, 100, 140]); obs.push({ x: W + 50, w: pick([50, 70, 110]), h }); if (Math.random() < 0.6) for (let i = 0; i < 3; i++) coins.push({ x: W + 50 + i * 60, y: GY - h - 120 }); spawnT = rnd(1.0, 1.8); }
    obs.forEach(o => o.x -= sp * dt); coins.forEach(c => c.x -= sp * dt);
    obs = obs.filter(o => o.x > -200); coins = coins.filter(c => c.x > -50);
    coins = coins.filter(c => { if (Math.hypot(c.x - PX, c.y - (y - 50)) < 60) { dist += 500; return false; } return true; });
    for (const o of obs) if (PX + 30 > o.x && PX - 30 < o.x + o.w && y > GY - o.h) g.over('摔倒了');
  },
  draw(c) {
    for (let i = 0; i < 5; i++) { const x = ((i * 220 - t * 60) % 1100 + 1100) % 1100 - 200; c.fillStyle = '#f4c58d'; c.beginPath(); c.moveTo(x, GY); c.lineTo(x + 150, GY - 260); c.lineTo(x + 300, GY); c.fill(); }
    c.fillStyle = '#8d6e63'; c.fillRect(0, GY, W, 400); c.fillStyle = '#7bd389'; c.fillRect(0, GY, W, 20);
    obs.forEach(o => rr(c, o.x, GY - o.h, o.w, o.h, 8, '#6d4c41', '#3e2723', 4));
    coins.forEach(k => { circle(c, k.x, k.y, 20, '#ffc857'); text(c, '¥', k.x, k.y, 22, '#b8860b'); });
    const leg = Math.sin(t * 20) * 14 * (y >= GY ? 1 : 0);
    rr(c, PX - 26, y - 100, 52, 64, 14, '#ff6b6b'); circle(c, PX, y - 120, 26, '#ffd7b0'); circle(c, PX + 10, y - 124, 5, '#222');
    c.strokeStyle = '#3d5a80'; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(PX - 10, y - 40); c.lineTo(PX - 10 - leg, y - 4); c.moveTo(PX + 10, y - 40); c.lineTo(PX + 10 + leg, y - 4); c.stroke();
    text(c, '点击跳跃（可二段跳）', W / 2, 1150, 32, '#6d4c41', 'center', false);
  },
});
