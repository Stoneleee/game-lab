import { run, circle, text, rnd, W } from '../_lib/engine';
type T = { x: number; y: number; life: number; max: number; r: number };
let ts: T[] = [], spawn = 0, lives = 5, pops: { x: number; y: number; t: number }[] = [];
run({
  id: 'aim', name: '瞄准训练', bg: '#10141f', accent: '#ff6b6b',
  help: ['靶子出现后会慢慢缩小', '在它消失前点中它', '漏掉一个扣一条命，共 5 条命'],
  start() { ts = []; spawn = 0.3; lives = 5; pops = []; },
  down(x, y, g) {
    for (let i = ts.length - 1; i >= 0; i--) { const t = ts[i], r = t.r * (t.life / t.max); if (Math.hypot(x - t.x, y - t.y) < r + 8) { const d = Math.hypot(x - t.x, y - t.y) / (r + 8); g.add(d < 0.3 ? 3 : d < 0.65 ? 2 : 1); pops.push({ x: t.x, y: t.y, t: 0.3 }); ts.splice(i, 1); return; } }
  },
  update(dt, g) {
    g.hud(`❤️ ${lives}`); spawn -= dt;
    if (spawn <= 0) { spawn = Math.max(0.35, 1 - g.time / 60); const max = Math.max(1.0, 2.2 - g.time / 50); ts.push({ x: rnd(80, W - 80), y: rnd(200, 1180), life: max, max, r: rnd(55, 80) }); }
    for (const t of ts) t.life -= dt;
    const miss = ts.filter(t => t.life <= 0).length; if (miss) { lives -= miss; ts = ts.filter(t => t.life > 0); if (lives <= 0) return g.over('漏太多了'); }
    for (const p of pops) p.t -= dt; pops = pops.filter(p => p.t > 0);
  },
  draw(c) {
    for (const t of ts) { const r = t.r * (t.life / t.max); circle(c, t.x, t.y, r, '#ff6b6b'); circle(c, t.x, t.y, r * 0.65, '#fff'); circle(c, t.x, t.y, r * 0.3, '#ff6b6b'); }
    for (const p of pops) { c.beginPath(); c.arc(p.x, p.y, 90 - p.t * 150, 0, 7); c.strokeStyle = `rgba(255,200,80,${p.t * 3})`; c.lineWidth = 6; c.stroke(); }
  },
});
