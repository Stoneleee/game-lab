import { run, rr, text } from '../_lib/engine';
const LIMIT = 120, CROPS = [{ e: '🥕', cost: 5, val: 12, t: 3 }, { e: '🌽', cost: 15, val: 40, t: 6 }, { e: '🍓', cost: 40, val: 120, t: 10 }, { e: '🎃', cost: 100, val: 340, t: 15 }];
let plots: { c: number; t: number }[] = [], money = 0, earned = 0, seed = 0, speed = 1, spLv = 0, plotCount = 6, floats: { x: number; y: number; s: string; t: number }[] = [];
const PX = (i: number) => 60 + (i % 3) * 210, PY = (i: number) => 260 + Math.floor(i / 3) * 210;
run({
  id: 'farm', name: '开心农场', bg: '#8fd16a', accent: '#ffd23f',
  help: ['选好种子，点空地播种（花钱）', '作物成熟后点它收获赚钱', `${LIMIT} 秒内累计赚得越多越好`],
  start() { plots = Array.from({ length: 9 }, () => ({ c: -1, t: 0 })); money = 20; earned = 0; seed = 0; speed = 1; spLv = 0; plotCount = 6; floats = []; },
  down(x, y, g) {
    for (let i = 0; i < plotCount; i++) if (x > PX(i) && x < PX(i) + 180 && y > PY(i) && y < PY(i) + 180) { const p = plots[i];
      if (p.c < 0) { const k = CROPS[seed]; if (money >= k.cost) { money -= k.cost; p.c = seed; p.t = 0; } else floats.push({ x: PX(i) + 90, y: PY(i) + 90, s: '钱不够', t: 0.8 }); }
      else if (p.t >= CROPS[p.c].t) { const v = CROPS[p.c].val; money += v; earned += v; g.score = earned; floats.push({ x: PX(i) + 90, y: PY(i) + 60, s: `+${v}`, t: 0.8 }); p.c = -1; }
      return; }
    if (y > 920 && y < 1040) { const k = Math.floor((x - 30) / 168); if (k >= 0 && k < 4) seed = k; return; }
    if (y > 1080 && y < 1180) { if (x < 360) { const cost = 60 * (spLv + 1); if (money >= cost && spLv < 5) { money -= cost; spLv++; speed = 1 + spLv * 0.35; } } else { const cost = 80 * (plotCount - 5); if (money >= cost && plotCount < 9) { money -= cost; plotCount++; } } }
  },
  update(dt, g) { const left = LIMIT - g.time; g.hud(`💰${money} · ${Math.max(0, Math.ceil(left))}s`); for (const p of plots) if (p.c >= 0) p.t += dt * speed; for (const f of floats) { f.t -= dt; f.y -= 50 * dt; } floats = floats.filter(f => f.t > 0); g.score = earned; if (left <= 0) g.over('收工啦'); },
  draw(c) {
    for (let i = 0; i < 9; i++) { const x = PX(i), y = PY(i); if (i >= plotCount) { rr(c, x, y, 180, 180, 20, '#6fae4f'); text(c, '🔒', x + 90, y + 90, 50); continue; } rr(c, x, y, 180, 180, 20, '#8b5a2b', '#5a3a1a', 4); const p = plots[i];
      if (p.c >= 0) { const k = CROPS[p.c], r = Math.min(1, p.t / k.t); if (r >= 1) text(c, k.e, x + 90, y + 90, 90); else { text(c, '🌱', x + 90, y + 90, 30 + r * 50); rr(c, x + 20, y + 150, 140, 12, 6, '#0004'); rr(c, x + 20, y + 150, 140 * r, 12, 6, '#7bd389'); } } }
    CROPS.forEach((k, i) => { rr(c, 30 + i * 168, 920, 150, 120, 20, seed === i ? '#ffd23f' : '#fff8'); text(c, k.e, 105 + i * 168, 960, 50); text(c, `$${k.cost}→${k.val}`, 105 + i * 168, 1015, 24, '#333', 'center', false); });
    rr(c, 30, 1080, 320, 100, 20, '#5b8def'); text(c, spLv < 5 ? `加速 $${60 * (spLv + 1)}` : '已满级', 190, 1130, 34, '#fff');
    rr(c, 370, 1080, 320, 100, 20, '#e85d75'); text(c, plotCount < 9 ? `扩地 $${80 * (plotCount - 5)}` : '已满', 530, 1130, 34, '#fff');
    text(c, `💰 ${money}`, 360, 180, 50, '#5a3a1a');
    for (const f of floats) text(c, f.s, f.x, f.y, 40, '#fff');
  },
});
