import { run, rr, circle, text, rnd } from '../_lib/engine';
type Z = { x: number; y: number; len: number; vert: boolean };
let meters = 0, py = 640, vy = 0, hold = false, zs: Z[] = [], coins: { x: number; y: number }[] = [], spawn = 0, dist = 0, spd = 360;
run({
  id: 'jetpack', name: '喷气背包', bg: '#2b2f4a', accent: '#ffc857',
  help: ['按住屏幕喷气上升，松开下降', '躲开红色电击障碍', '每飞 1 米 +1 分，金币 +2 分'],
  start() { py = 640; vy = 0; zs = []; coins = []; spawn = 1; dist = 0; meters = 0; spd = 360; hold = false; },
  down() { hold = true; }, up() { hold = false; },
  key(k) { if (k === ' ' || k === 'ArrowUp') { hold = true; setTimeout(() => hold = false, 180); } },
  update(dt, g) {
    spd = 360 + g.time * 6; dist += spd * dt; vy += (hold ? -2200 : 1500) * dt; vy = Math.max(-700, Math.min(800, vy)); py += vy * dt;
    if (py < 150) { py = 150; vy = 0; } if (py > 1180) { py = 1180; vy = 0; }
    spawn -= dt; if (spawn <= 0) { spawn = Math.max(0.6, 1.4 - g.time / 80); const vert = Math.random() < 0.5; zs.push({ x: 800, y: rnd(200, 1100), len: rnd(180, 320), vert }); const cy = rnd(200, 1100); for (let i = 0; i < 5; i++) coins.push({ x: 900 + i * 50, y: cy }); }
    for (const z of zs) z.x -= spd * dt; for (const c of coins) c.x -= spd * dt;
    for (const z of zs) { const x1 = z.x, y1 = z.y, x2 = z.vert ? z.x : z.x + z.len, y2 = z.vert ? z.y + z.len : z.y; const px = Math.max(Math.min(x1, x2), Math.min(Math.max(x1, x2), 160)), pyy = Math.max(Math.min(y1, y2), Math.min(Math.max(y1, y2), py)); if (Math.hypot(px - 160, pyy - py) < 36) return g.over('被电到了'); }
    coins = coins.filter(c => { if (Math.hypot(c.x - 160, c.y - py) < 50) { g.add(2); return false; } return c.x > -30; });
    zs = zs.filter(z => z.x > -400); g.hud(`${Math.floor(dist / 100)} 米`);
    const m = Math.floor(dist / 100); if (m > meters) { g.add(m - meters); meters = m; }
  },
  draw(c, g) {
    c.fillStyle = '#3a3f63'; for (let x = -(dist % 120); x < 720; x += 120) c.fillRect(x, 1210, 60, 70);
    for (const z of zs) { const w = z.vert ? 24 : z.len, h = z.vert ? z.len : 24; rr(c, z.x - 12 * +z.vert, z.y - 12 * +!z.vert, w, h, 12, Math.floor(g.time * 12) % 2 ? '#ff4f5e' : '#ff9f43'); }
    for (const k of coins) { circle(c, k.x, k.y, 16, '#ffd23f'); circle(c, k.x, k.y, 8, '#e6a800'); }
    rr(c, 130, py - 30, 40, 60, 12, '#c9cdf0'); circle(c, 160, py - 6, 26, '#ffc857'); circle(c, 170, py - 12, 6, '#222');
    if (hold) { circle(c, 140, py + 42, 14, '#ff9f43'); circle(c, 140, py + 62, 9, '#ffd23f'); }
  },
});
