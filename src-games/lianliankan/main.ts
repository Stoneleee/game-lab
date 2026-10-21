import { run, rr, text, shuffle } from '../_lib/engine';
const C = 8, R = 10, TW = 80, TH = 86, X0 = 40, Y0 = 230, LIMIT = 240, EM = ['🍎', '🍊', '🍋', '🍉', '🍇', '🍓', '🍒', '🥝', '🍑', '🍍', '🥥', '🥕', '🌽', '🍄', '🌸', '⭐'];
const PC = C + 2, PR = R + 2;
let g: number[] = [], sel = -1, line: number[] = [], lineT = 0, boards = 0;
const idx = (x: number, y: number) => y * PC + x;
function link(a: number, b: number) {
  const D = [1, -1, PC, -PC]; let fr = [a]; const seen = new Set([a]);
  for (let seg = 0; seg < 3; seg++) { const nf: number[] = []; for (const p of fr) for (const d of D) { let q = p + d; while (q >= 0 && q < PC * PR && !(d === 1 && q % PC === 0) && !(d === -1 && q % PC === PC - 1)) { if (q === b) return true; if (g[q] >= 0) break; if (!seen.has(q)) { seen.add(q); nf.push(q); } q += d; } } fr = nf; }
  return false;
}
function anyMove() { const t = g.map((v, i) => v >= 0 ? i : -1).filter(i => i >= 0); for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (g[t[i]] === g[t[j]] && link(t[i], t[j])) return true; return false; }
function reshuffle() { const t = g.map((v, i) => v >= 0 ? i : -1).filter(i => i >= 0); let k = 0; do { const vals = shuffle(t.map(i => g[i])); t.forEach((i, j) => g[i] = vals[j]); k++; } while (!anyMove() && k < 50); }
function gen() { g = Array(PC * PR).fill(-1); const vals = shuffle(Array.from({ length: C * R }, (_, i) => Math.floor(i / 2) % EM.length)); let k = 0; for (let y = 1; y <= R; y++) for (let x = 1; x <= C; x++) g[idx(x, y)] = vals[k++]; if (!anyMove()) reshuffle(); sel = -1; }
const cxy = (i: number) => [X0 + (i % PC - 1) * TW + TW / 2, Y0 + (Math.floor(i / PC) - 1) * TH + TH / 2];
run({
  id: 'lianliankan', name: '连连看', bg: '#1e3a5f', accent: '#ffd23f',
  help: ['点两个相同的图案', '能用不超过 3 段直线连起来就消除', `${LIMIT} 秒内消得越多越好`],
  start() { boards = 0; gen(); },
  down(x, y, G) {
    const cx = Math.floor((x - X0) / TW) + 1, cy = Math.floor((y - Y0) / TH) + 1; if (cx < 1 || cy < 1 || cx > C || cy > R) return; const i = idx(cx, cy); if (g[i] < 0) return;
    if (sel < 0 || sel === i) { sel = sel === i ? -1 : i; return; }
    if (g[sel] === g[i] && link(sel, i)) { line = [sel, i]; lineT = 0.25; g[sel] = g[i] = -1; sel = -1; G.add(2);
      if (g.every(v => v < 0)) { boards++; G.add(50); gen(); } else if (!anyMove()) reshuffle(); }
    else sel = i;
  },
  update(dt, G) { lineT -= dt; const left = LIMIT - G.time; G.hud(`${Math.max(0, Math.ceil(left))}s`); if (left <= 0) G.over('时间到'); },
  draw(c) {
    for (let i = 0; i < PC * PR; i++) { if (g[i] < 0) continue; const [x, y] = cxy(i); rr(c, x - TW / 2 + 3, y - TH / 2 + 3, TW - 6, TH - 6, 12, sel === i ? '#ffd23f' : '#f6f1e3', '#00000033', 3); text(c, EM[g[i]], x, y + 2, 50); }
    if (lineT > 0) { const [a, b] = line.map(cxy); c.strokeStyle = '#ffd23f'; c.lineWidth = 6; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  },
});
