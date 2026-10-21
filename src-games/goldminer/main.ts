import { run, circle, rr, text, rnd, pick } from '../_lib/engine';
type It = { x: number; y: number; r: number; v: number; w: number; e: string };
const OX = 360, OY = 230;
let items: It[] = [], ang = 0, angV = 1.6, len = 60, st: 'swing' | 'out' | 'back' = 'swing', got: It | null = null, lvl = 1, goal = 0, tl = 0, total = 0;
function level() {
  items = []; const n = 8 + lvl * 2;
  for (let i = 0; i < n; i++) { const t = Math.random(); const it = t < 0.35 ? { r: rnd(25, 60), e: '🪙', v: 0, w: 0 } : t < 0.65 ? { r: rnd(30, 55), e: '🪨', v: 0, w: 0 } : t < 0.8 ? { r: 22, e: '💎', v: 0, w: 0 } : t < 0.92 ? { r: 28, e: '💰', v: 0, w: 0 } : { r: 26, e: '💀', v: 0, w: 0 };
    it.v = it.e === '🪙' ? Math.round(it.r * 6) : it.e === '🪨' ? 20 : it.e === '💎' ? 500 : it.e === '💰' ? Math.round(rnd(50, 700)) : 10;
    it.w = it.e === '💎' ? 1 : it.e === '🪨' ? it.r / 12 : it.e === '🪙' ? it.r / 14 : 1.5;
    let x = 0, y = 0, ok = false; for (let k = 0; k < 40 && !ok; k++) { x = rnd(70, 650); y = rnd(480, 1180); ok = items.every(o => Math.hypot(o.x - x, o.y - y) > o.r + it.r + 10); }
    items.push({ ...it, x, y });
  }
  goal = total + 400 + lvl * 300; tl = 60; st = 'swing'; len = 60; got = null;
}
const fire = () => { if (st === 'swing') st = 'out'; };
run({
  id: 'goldminer', name: '黄金矿工', bg: '#c98a4b', accent: '#ffe14d',
  help: ['钩子来回摆动，点击放出钩子', '抓金块、钻石和福袋换钱', '60 秒内达到目标金额进入下一关'],
  start() { lvl = 1; total = 0; ang = 0; level(); },
  down: fire, key(k) { if (k === ' ' || k === 'ArrowDown') fire(); },
  update(dt, g) {
    tl -= dt; g.hud(`目标 $${goal} · ${Math.max(0, Math.ceil(tl))}s`); g.score = total;
    if (st === 'swing') { ang += angV * dt; if (Math.abs(ang) > 1.25) { angV *= -1; ang = Math.sign(ang) * 1.25; } }
    const hx = OX + Math.sin(ang) * len, hy = OY + Math.cos(ang) * len;
    if (st === 'out') { len += 650 * dt; const it = items.find(o => Math.hypot(o.x - hx, o.y - hy) < o.r + 12); if (it) { got = it; items.splice(items.indexOf(it), 1); st = 'back'; } else if (hx < 0 || hx > 720 || hy > 1280) st = 'back'; }
    if (st === 'back') { len -= (got ? 650 / (1 + got.w) : 900) * dt; if (got) { got.x = hx; got.y = hy + got.r; } if (len <= 60) { len = 60; if (got) total += got.v; got = null; st = 'swing'; } }
    if (tl <= 0) { if (total >= goal) { lvl++; level(); } else { g.score = total; g.over('没达到目标'); } }
  },
  draw(c) {
    c.fillStyle = '#f6d7a7'; c.fillRect(0, 110, 720, 160); c.fillStyle = '#8a5a2b'; c.fillRect(0, 270, 720, 10);
    text(c, '⛏️', OX, OY - 50, 70); text(c, `$${total}`, 110, 180, 40, '#7a3e0e');  text(c, `第 ${lvl} 关`, 610, 180, 34, '#7a3e0e');
    for (const o of items) text(c, o.e, o.x, o.y, o.r * 2.2);
    const hx = OX + Math.sin(ang) * len, hy = OY + Math.cos(ang) * len;
    c.strokeStyle = '#333'; c.lineWidth = 4; c.beginPath(); c.moveTo(OX, OY); c.lineTo(hx, hy); c.stroke(); circle(c, hx, hy, 12, '#555');
    if (got) text(c, got.e, got.x, got.y, got.r * 2.2);
  },
});
