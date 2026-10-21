import { run, circle, text, rnd, pick, W } from '../_lib/engine';
type B = { x: number; y: number; v: number; c: string; k: 0 | 1 | 2; r: number; w: number };
const C = ['#ff4f5e', '#ffd23f', '#3ee87b', '#4f8bff', '#c86bff', '#ff9f43'];
let bs: B[] = [], spawn = 0, lives = 5, pops: { x: number; y: number; t: number; s: string }[] = [];
run({
  id: 'balloon', name: '扎气球', bg: '#a8dcff', accent: '#e85d75',
  help: ['点击飞上来的气球把它扎破', '金色气球 +5，黑色炸弹气球扣 1 命', '漏掉 5 个气球游戏结束'],
  start() { bs = []; spawn = 0.3; lives = 5; pops = []; },
  down(x, y, g) {
    for (let i = bs.length - 1; i >= 0; i--) { const b = bs[i]; if (Math.hypot(x - b.x, y - b.y) < b.r + 14) { bs.splice(i, 1); if (b.k === 2) { lives--; pops.push({ x: b.x, y: b.y, t: 0.5, s: '💥' }); if (lives <= 0) g.over('炸到了'); } else { g.add(b.k === 1 ? 5 : 1); pops.push({ x: b.x, y: b.y, t: 0.4, s: b.k === 1 ? '+5' : '+1' }); } return; } }
  },
  update(dt, g) {
    g.hud(`❤️ ${lives}`); spawn -= dt;
    if (spawn <= 0) { spawn = Math.max(0.25, 0.9 - g.time / 80); const r = Math.random(); bs.push({ x: rnd(70, W - 70), y: 1340, v: rnd(160, 260) + g.time * 3, c: pick(C), k: r < 0.08 ? 1 : r < 0.2 ? 2 : 0, r: rnd(48, 62), w: rnd(0, 6) }); }
    for (const b of bs) { b.y -= b.v * dt; b.w += dt * 2; b.x += Math.sin(b.w) * 30 * dt; }
    const miss = bs.filter(b => b.y < 100 && b.k !== 2).length; bs = bs.filter(b => b.y >= 100);
    if (miss) { lives -= miss; if (lives <= 0) return g.over('漏掉太多'); }
    for (const p of pops) { p.t -= dt; p.y -= 60 * dt; } pops = pops.filter(p => p.t > 0);
  },
  draw(c) {
    for (const b of bs) { c.strokeStyle = '#0005'; c.lineWidth = 2; c.beginPath(); c.moveTo(b.x, b.y + b.r); c.lineTo(b.x + Math.sin(b.w) * 10, b.y + b.r + 60); c.stroke();
      c.beginPath(); c.ellipse(b.x, b.y, b.r * 0.85, b.r, 0, 0, 7); c.fillStyle = b.k === 1 ? '#ffd700' : b.k === 2 ? '#222' : b.c; c.fill(); circle(c, b.x - b.r * 0.3, b.y - b.r * 0.4, b.r * 0.15, '#ffffff88'); if (b.k === 2) text(c, '💣', b.x, b.y, 40); }
    for (const p of pops) text(c, p.s, p.x, p.y, 48, '#fff');
  },
});
