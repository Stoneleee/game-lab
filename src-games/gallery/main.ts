import { run, rr, circle, text, rnd, pick } from '../_lib/engine';
type T = { x: number; row: number; v: number; e: string; pts: number; hit: number };
const ROWS = [360, 580, 800], MAG = 6, LIMIT = 60;
let ts: T[] = [], ammo = MAG, reload = 0, spawn = 0, shots: { x: number; y: number; t: number }[] = [];
run({
  id: 'gallery', name: '射击场', bg: '#3b2a4f', accent: '#ffc857',
  help: ['点击移动的靶子射击', `弹匣 ${MAG} 发，点右下角「装弹」补充`, `${LIMIT} 秒内拿到尽量多的分`],
  start() { ts = []; ammo = MAG; reload = 0; spawn = 0; shots = []; },
  down(x, y, g) {
    if (x > 500 && y > 1080) { if (ammo < MAG && reload <= 0) reload = 0.8; return; }
    if (reload > 0 || ammo <= 0) return; ammo--; shots.push({ x, y, t: 0.2 });
    for (const t of ts) if (!t.hit && Math.hypot(x - t.x, y - ROWS[t.row]) < 60) { t.hit = 0.4; g.add(t.pts); return; }
  },
  update(dt, g) {
    const left = LIMIT - g.time; g.hud(`${Math.max(0, Math.ceil(left))}s`); if (left <= 0) return g.over('时间到');
    if (reload > 0) { reload -= dt; if (reload <= 0) ammo = MAG; }
    spawn -= dt; if (spawn <= 0) { spawn = rnd(0.4, 0.9); const row = Math.floor(Math.random() * 3), dir = row % 2 ? -1 : 1, r = Math.random(); ts.push({ x: dir > 0 ? -60 : 780, row, v: dir * (rnd(150, 260) + row * 40 + g.time * 2), e: r < 0.1 ? '🦢' : r < 0.25 ? '🐰' : '🦆', pts: r < 0.1 ? 5 : r < 0.25 ? 3 : 1, hit: 0 }); }
    for (const t of ts) { if (t.hit) t.hit -= dt; else t.x += t.v * dt; }
    ts = ts.filter(t => (t.hit === 0 || t.hit > 0) && t.x > -100 && t.x < 820 && !(t.hit < 0));
    for (const s of shots) s.t -= dt; shots = shots.filter(s => s.t > 0);
  },
  draw(c) {
    ROWS.forEach((y, i) => { rr(c, 0, y + 50, 720, 30, 0, ['#8b5a2b', '#a0522d', '#6b4423'][i]); });
    for (const t of ts) { c.save(); c.translate(t.x, ROWS[t.row]); if (t.v < 0) c.scale(-1, 1); if (t.hit) c.rotate(1.2 - t.hit * 3); text(c, t.e, 0, 0, 90); c.restore(); }
    for (const s of shots) { circle(c, s.x, s.y, 20 * (1 - s.t * 3) + 10, '#ffc85788'); }
    for (let i = 0; i < MAG; i++) rr(c, 40 + i * 40, 1130, 24, 60, 8, i < ammo ? '#ffc857' : '#ffffff22');
    rr(c, 510, 1100, 180, 100, 20, reload > 0 ? '#888' : '#7bd389'); text(c, reload > 0 ? '装弹中' : '装弹', 600, 1150, 38, '#1b1d2b');
  },
});
