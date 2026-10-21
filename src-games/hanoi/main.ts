import { run, rr, text } from '../_lib/engine';
const PX = [140, 360, 580], BASE = 950, DH = 44, LIMIT = 300;
let pegs: number[][] = [], n = 3, held = -1, moves = 0;
function level() { pegs = [[...Array(n).keys()].map(i => n - i), [], []]; held = -1; moves = 0; }
run({
  id: 'hanoi', name: '汉诺塔', bg: '#2a2d43', accent: '#ffc857',
  help: ['点一根柱子拿起最上面的圆盘，再点另一根放下', '大盘不能压在小盘上', '把全部圆盘移到最右边的柱子'],
  start() { n = 3; level(); },
  down(x, y, g) {
    const p = PX.findIndex(px => Math.abs(x - px) < 110); if (p < 0) return;
    if (held < 0) { if (pegs[p].length) held = p; return; }
    if (p === held) { held = -1; return; }
    const d = pegs[held][pegs[held].length - 1], t = pegs[p][pegs[p].length - 1];
    if (t !== undefined && t < d) { held = -1; return; }
    pegs[p].push(pegs[held].pop()!); held = -1; moves++;
    if (pegs[2].length === n) { const opt = 2 ** n - 1; g.add(n * 20 + Math.max(0, opt * 2 - moves)); if (n >= 8) return g.over('全部通关！'); n++; level(); }
  },
  update(dt, g) { const left = LIMIT - g.time; g.hud(`${n} 层 · ${moves} 步 · ${Math.max(0, Math.ceil(left))}s`); if (left <= 0) g.over('时间到'); },
  draw(c) {
    rr(c, 30, BASE, 660, 30, 10, '#8a6a4a');
    PX.forEach((x, p) => { rr(c, x - 9, BASE - 420, 18, 420, 9, '#b08a62');
      pegs[p].forEach((d, k) => { const w = 50 + d * 22, up = p === held && k === pegs[p].length - 1 ? 520 - k * DH : 0; rr(c, x - w / 2, BASE - (k + 1) * DH - up + 2, w, DH - 4, 12, `hsl(${d * 40},75%,60%)`); }); });
    text(c, `最少需要 ${2 ** n - 1} 步`, 360, 1060, 34, '#c9cdf0', 'center', false);
  },
});
