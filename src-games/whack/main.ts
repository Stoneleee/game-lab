import { run, rr, circle, text, rnd, W } from '../_lib/engine';
const ROUND = 60, X0 = 110, Y0 = 330, GX = 250, GY = 260;
type Hole = { up: number; life: number; bomb: boolean; hit: number };
let holes: Hole[] = [], spawnT = 0;
const pos = (i: number) => [X0 + (i % 3) * GX, Y0 + Math.floor(i / 3) * GY];
run({
  id: 'whack', name: '打地鼠', bg: '#7bc96f', accent: '#ffc857',
  help: ['地鼠冒头时快点它！', '小心别点到炸弹 💣（扣分）', `${ROUND} 秒内打得越多越好`],
  start(g) { holes = Array.from({ length: 12 }, () => ({ up: 0, life: 0, bomb: false, hit: 0 })); spawnT = 0.5; g.hud(`剩余 ${ROUND}s`); },
  down(x, y, g) {
    holes.forEach((h, i) => { const [hx, hy] = pos(i); if (h.life > 0 && h.hit <= 0 && Math.abs(x - hx) < 100 && y > hy - 150 && y < hy + 60) { h.hit = 0.3; h.life = 0.3; g.add(h.bomb ? -5 : 1); if (g.score < 0) g.score = 0; } });
  },
  update(dt, g) {
    const left = ROUND - g.time; g.hud(`剩余 ${Math.max(0, Math.ceil(left))}s`); if (left <= 0) return g.over('时间到');
    spawnT -= dt; if (spawnT <= 0) { const free = holes.filter(h => h.life <= 0); if (free.length) { const h = free[Math.floor(Math.random() * free.length)]; h.life = Math.max(0.6, 1.4 - g.time / 60); h.bomb = Math.random() < 0.15; h.hit = 0; } spawnT = rnd(0.25, 0.7) * Math.max(0.5, 1 - g.time / 120); }
    holes.forEach(h => { h.life -= dt; h.hit -= dt; h.up = Math.max(0, Math.min(1, h.up + (h.life > 0.15 ? 8 : -8) * dt)); });
  },
  draw(c) {
    holes.forEach((h, i) => {
      const [x, y] = pos(i);
      c.save(); c.beginPath(); c.rect(x - 110, y - 200, 220, 220); c.clip();
      const my = y + 100 - h.up * 120;
      if (h.up > 0) { if (h.bomb) { circle(c, x, my, 55, '#222'); text(c, '💣', x, my, 60); } else { rr(c, x - 60, my - 60, 120, 160, 60, h.hit > 0 ? '#c97b5b' : '#a0522d'); circle(c, x - 22, my - 15, 10, h.hit > 0 ? '#222' : '#fff'); circle(c, x + 22, my - 15, 10, h.hit > 0 ? '#222' : '#fff'); circle(c, x, my + 15, 14, '#ff9ab0'); } }
      c.restore();
      c.fillStyle = '#4a2e1a'; c.beginPath(); c.ellipse(x, y + 20, 100, 34, 0, 0, 7); c.fill();
      c.fillStyle = '#5a9a50'; c.fillRect(x - 110, y + 22, 220, 40);
    });
  },
});
