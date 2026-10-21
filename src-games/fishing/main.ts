import { run, rr, text, rnd, pick } from '../_lib/engine';
const FISH = [{ e: '🐟', p: 10, d: 1 }, { e: '🐠', p: 20, d: 1.5 }, { e: '🐡', p: 30, d: 2 }, { e: '🦑', p: 50, d: 2.6 }, { e: '🦈', p: 100, d: 3.4 }];
const BY = 220, BH = 840, ZH = 190;
let st: 'wait' | 'fight' | 'res' = 'wait', t = 0, zy = 0, zv = 0, fy = 0, ft = 0, fv = 0, prog = 0, fish = FISH[0], hold = false, chances = 3, msg = '', caught = 0;
function cast() { st = 'wait'; t = rnd(1, 2.5); msg = '等鱼上钩…'; }
run({
  id: 'fishing', name: '钓鱼达人', bg: '#1d6fa5', accent: '#ffc857',
  help: ['鱼上钩后，按住屏幕让绿条上升，松开下降', '让绿条罩住鱼，进度条满就钓到了', '跑掉 3 条鱼游戏结束'],
  start() { chances = 3; caught = 0; cast(); },
  down() { hold = true; }, up() { hold = false; },
  key(k) { if (k === ' ') { hold = true; setTimeout(() => hold = false, 200); } },
  update(dt, g) {
    g.hud(`钓到 ${caught} · 机会 ${chances}`); t -= dt;
    if (st === 'wait') { if (t <= 0) { st = 'fight'; const lvl = Math.min(4, Math.floor(caught / 2)); fish = pick(FISH.slice(0, lvl + 2)); zy = BH - ZH; zv = 0; fy = BH / 2; ft = 0; prog = 0.3; msg = `${fish.e} 上钩了！`; } return; }
    if (st === 'res') { if (t <= 0) { if (chances <= 0) return g.over('鱼都跑了'); cast(); } return; }
    zv += (hold ? -1800 : 1400) * dt; zy += zv * dt; if (zy < 0) { zy = 0; zv = 0; } if (zy > BH - ZH) { zy = BH - ZH; zv = 0; }
    ft -= dt; if (ft <= 0) { ft = rnd(0.3, 1.2) / fish.d; fv = rnd(-1, 1) * 260 * fish.d; } fy += fv * dt; if (fy < 30 || fy > BH - 30) { fv *= -1; fy = Math.max(30, Math.min(BH - 30, fy)); }
    const inZ = fy > zy && fy < zy + ZH; prog += (inZ ? 0.35 : -0.25 * (0.6 + fish.d * 0.25)) * dt;
    if (prog >= 1) { g.add(fish.p); caught++; msg = `钓到 ${fish.e} +${fish.p}`; st = 'res'; t = 1.2; }
    else if (prog <= 0) { chances--; msg = `${fish.e} 跑掉了…`; st = 'res'; t = 1.2; }
  },
  draw(c) {
    c.fillStyle = '#7fc8f8'; c.fillRect(0, 110, 720, 80); text(c, '🚣', 520, 160, 80);
    rr(c, 230, BY, 120, BH, 20, '#0d3b5e', '#fff', 4);
    if (st === 'fight') { rr(c, 236, BY + zy, 108, ZH, 14, '#7bd389aa'); text(c, fish.e, 290, BY + fy, 64); rr(c, 380, BY, 40, BH, 14, '#0d3b5e'); rr(c, 380, BY + BH * (1 - prog), 40, BH * prog, 14, prog > 0.6 ? '#7bd389' : prog > 0.3 ? '#ffc857' : '#ff6b6b'); }
    text(c, msg, 360, 1130, 44, '#fff');
  },
});
