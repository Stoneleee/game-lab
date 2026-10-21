import { run, circle, rr, text } from '../_lib/engine';
const PEGS: [number, number][] = [], SLOTS = [10, 3, 1, 0.5, 0.2, 0.5, 1, 3, 10], SW = 720 / 9, BALLS = 15, R = 14;
for (let r = 0; r < 11; r++) for (let c = 0; c < (r % 2 ? 8 : 9); c++) PEGS.push([(r % 2 ? 80 : 40) + c * 80, 320 + r * 64]);
let balls: { x: number; y: number; vx: number; vy: number }[] = [], left = 0, coins = 0, aim = 360, hits: { s: number; t: number }[] = [];
run({
  id: 'plinko', name: '弹珠台', bg: '#2a1b3d', accent: '#ffd23f',
  help: ['点击顶部位置放下弹珠', '弹珠碰钉子随机弹跳，落进底部格子', `每颗弹珠下注 10 分，共 ${BALLS} 颗`],
  start(g) { balls = []; left = BALLS; hits = []; },
  down(x) { aim = Math.max(30, Math.min(690, x)); if (left > 0) { left--; balls.push({ x: aim + (Math.random() - 0.5) * 4, y: 220, vx: 0, vy: 0 }); } },
  move(x) { aim = Math.max(30, Math.min(690, x)); },
  update(dt, g) {
    g.hud(`剩 ${left} 颗`);
    for (const b of balls) for (let s = 0; s < 4; s++) {
      const h = dt / 4; b.vy += 1400 * h; b.x += b.vx * h; b.y += b.vy * h;
      if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * 0.6; } if (b.x > 720 - R) { b.x = 720 - R; b.vx = -Math.abs(b.vx) * 0.6; }
      for (const [px, py] of PEGS) { const dx = b.x - px, dy = b.y - py, d = Math.hypot(dx, dy); if (d < R + 8 && d > 0) { const nx = dx / d, ny = dy / d, dot = b.vx * nx + b.vy * ny; if (dot < 0) { b.vx -= 1.5 * dot * nx; b.vy -= 1.5 * dot * ny; b.vx += (Math.random() - 0.5) * 40; } b.x = px + nx * (R + 8); b.y = py + ny * (R + 8); } }
    }
    for (const b of balls) if (b.y > 1080) { const s = Math.max(0, Math.min(8, Math.floor(b.x / SW))); g.add(Math.round(10 * SLOTS[s])); hits.push({ s, t: 0.6 }); b.y = 9999; }
    balls = balls.filter(b => b.y < 9000); for (const h of hits) h.t -= dt; hits = hits.filter(h => h.t > 0);
    if (left <= 0 && !balls.length) g.over('弹珠用完了');
  },
  draw(c) {
    for (const [x, y] of PEGS) circle(c, x, y, 8, '#c9cdf0');
    SLOTS.forEach((m, i) => { const hit = hits.some(h => h.s === i); rr(c, i * SW + 4, 1090, SW - 8, 90, 12, hit ? '#fff' : m >= 3 ? '#ff6b6b' : m >= 1 ? '#ffc857' : '#5b8def'); text(c, `×${m}`, i * SW + SW / 2, 1135, 26, '#1b1d2b'); });
    for (const b of balls) circle(c, b.x, b.y, R, '#ffd23f');
    if (left > 0) { circle(c, aim, 220, R, '#ffd23f88'); text(c, '▼', aim, 180, 30, '#ffd23f'); }
  },
});
