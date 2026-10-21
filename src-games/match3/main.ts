import { run, rr, text, circle, ri, W } from '../_lib/engine';
const NX = 7, NY = 9, S = 92, X0 = (W - NX * S) / 2, Y0 = 220, K = 6, MOVES = 25;
const COL = ['#ff6b6b', '#ffc857', '#4ecdc4', '#5b8def', '#b388ff', '#7bd389'];
let b: number[][] = [], moves = 0, sel: [number, number] | null = null, flash = 0;
const rnd = () => ri(0, K - 1);
function matches(): Set<string> {
  const s = new Set<string>();
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX - 2; x++) { const v = b[y][x]; if (v >= 0 && v === b[y][x + 1] && v === b[y][x + 2]) [0, 1, 2].forEach(i => s.add(`${x + i},${y}`)); }
  for (let x = 0; x < NX; x++) for (let y = 0; y < NY - 2; y++) { const v = b[y][x]; if (v >= 0 && v === b[y + 1][x] && v === b[y + 2][x]) [0, 1, 2].forEach(i => s.add(`${x},${y + i}`)); }
  return s;
}
function collapse() { for (let x = 0; x < NX; x++) { const col = []; for (let y = NY - 1; y >= 0; y--) if (b[y][x] >= 0) col.push(b[y][x]); for (let y = NY - 1, i = 0; y >= 0; y--, i++) b[y][x] = i < col.length ? col[i] : rnd(); } }
function resolve(g?): number { let total = 0, chain = 1, m; while ((m = matches()).size) { total += m.size; g?.add(m.size * 10 * chain); m.forEach(k => { const [x, y] = k.split(',').map(Number); b[y][x] = -1; }); collapse(); chain++; } return total; }
function trySwap(a: [number, number], c: [number, number], g) {
  if (Math.abs(a[0] - c[0]) + Math.abs(a[1] - c[1]) !== 1 || c[0] < 0 || c[1] < 0 || c[0] >= NX || c[1] >= NY) return;
  const sw = () => { const t = b[a[1]][a[0]]; b[a[1]][a[0]] = b[c[1]][c[0]]; b[c[1]][c[0]] = t; };
  sw(); if (!matches().size) { sw(); flash = 0.3; return; }
  moves--; resolve(g); g.hud(`剩余步数 ${moves}`); if (moves <= 0) g.over('步数用完');
}
const cellAt = (x: number, y: number): [number, number] | null => { const cx = Math.floor((x - X0) / S), cy = Math.floor((y - Y0) / S); return cx >= 0 && cy >= 0 && cx < NX && cy < NY ? [cx, cy] : null; };
function shape(c, k: number, x: number, y: number) {
  const r = 34; c.fillStyle = COL[k]; c.beginPath();
  if (k === 0) c.arc(x, y, r, 0, 7); else if (k === 1) { for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr2 = i % 2 ? r * 0.5 : r; c.lineTo(x + rr2 * Math.cos(a), y + rr2 * Math.sin(a)); } }
  else if (k === 2) { c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); }
  else if (k === 3) c.roundRect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7, 10);
  else if (k === 4) { c.moveTo(x, y - r); c.lineTo(x + r, y + r * 0.8); c.lineTo(x - r, y + r * 0.8); }
  else { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); } }
  c.closePath(); c.fill(); circle(c, x - 10, y - 10, 7, '#ffffff88');
}
run({
  id: 'match3', name: '宝石消消乐', bg: '#2a1f3d', accent: '#ffc857',
  help: ['滑动宝石与相邻宝石交换（或依次点击两个）', '三个及以上同色连成一线即消除', `共 ${MOVES} 步，连锁消除分数翻倍`],
  start(g) { b = Array.from({ length: NY }, () => Array.from({ length: NX }, rnd)); while (matches().size) resolve(); moves = MOVES; sel = null; g.hud(`剩余步数 ${moves}`); },
  swipe(d, x0, y0, g) {
    if (x0 < 0) return; const a = cellAt(x0, y0); if (!a) return; sel = null;
    const c: [number, number] = [a[0] + (d === 'R' ? 1 : d === 'L' ? -1 : 0), a[1] + (d === 'D' ? 1 : d === 'U' ? -1 : 0)]; trySwap(a, c, g);
  },
  up(x, y, g) {
    const p = cellAt(x, y); if (!p) return;
    if (sel && (sel[0] !== p[0] || sel[1] !== p[1]) && Math.abs(sel[0] - p[0]) + Math.abs(sel[1] - p[1]) === 1) { const s = sel; sel = null; trySwap(s, p, g); }
    else sel = p;
  },
  update(dt) { flash = Math.max(0, flash - dt); },
  draw(c) {
    rr(c, X0 - 10, Y0 - 10, NX * S + 20, NY * S + 20, 20, flash ? '#5a2a3a' : '#3b2d55');
    b.forEach((r, y) => r.forEach((k, x) => { if (sel && sel[0] === x && sel[1] === y) rr(c, X0 + x * S + 4, Y0 + y * S + 4, S - 8, S - 8, 16, '#ffffff33'); if (k >= 0) shape(c, k, X0 + x * S + S / 2, Y0 + y * S + S / 2); }));
    text(c, `剩余 ${moves} 步`, W / 2, 1150, 40, '#ffc857');
  },
});
