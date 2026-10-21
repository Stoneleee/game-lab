import { run, rr, pick, text, W, PALETTE } from '../_lib/engine';
const N = 8, S = 76, X0 = (W - N * S) / 2, Y0 = 170, TY = 1000;
const SH = [[[1]], [[1, 1]], [[1], [1]], [[1, 1, 1]], [[1], [1], [1]], [[1, 1], [1, 1]], [[1, 1, 1], [1, 0, 0]], [[1, 1], [0, 1], [0, 1]], [[1, 1, 1], [0, 1, 0]], [[1, 1, 1, 1]], [[1], [1], [1], [1]], [[1, 1, 1], [1, 1, 1], [1, 1, 1]], [[1, 0], [1, 1]], [[0, 1], [1, 1]]];
type Piece = { m: number[][]; col: string } | null;
let b: string[][] = [], tray: Piece[] = [], drag = -1, dx = 0, dy = 0;
const deal = () => { tray = [0, 1, 2].map(() => ({ m: pick(SH), col: pick(PALETTE.slice(0, 8)) })); };
const fits = (m: number[][], gx: number, gy: number) => m.every((r, i) => r.every((v, j) => !v || (gx + j >= 0 && gy + i >= 0 && gx + j < N && gy + i < N && !b[gy + i][gx + j])));
const anyFit = (m: number[][]) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (fits(m, x, y)) return true; return false; };
const trayX = (i: number) => 120 + i * 240;
const gridPos = (p: Piece) => { const ox = dx - p!.m[0].length * S / 2, oy = dy - 160 - p!.m.length * S / 2; return [Math.round((ox - X0) / S), Math.round((oy - Y0) / S)]; };
run({
  id: 'blockfit', name: '方块填填乐', bg: '#1f2a44', accent: '#ffc857',
  help: ['把下方的方块拖进 8×8 棋盘', '填满一整行或一整列就会消除', '三个方块都放不下时结束'],
  start() { b = Array.from({ length: N }, () => Array(N).fill('')); deal(); drag = -1; },
  down(x, y) { if (y > TY - 120) { const i = Math.max(0, Math.min(2, Math.floor((x - 0) / 240))); if (tray[i]) { drag = i; dx = x; dy = y; } } },
  move(x, y) { dx = x; dy = y; },
  up(_x, _y, g) {
    if (drag < 0) return; const p = tray[drag]!; const [gx, gy] = gridPos(p);
    if (fits(p.m, gx, gy)) {
      p.m.forEach((r, i) => r.forEach((v, j) => { if (v) b[gy + i][gx + j] = p.col; }));
      g.add(p.m.flat().filter(Boolean).length); tray[drag] = null;
      const rows = [...Array(N).keys()].filter(y => b[y].every(Boolean)), cols = [...Array(N).keys()].filter(x => b.every(r => r[x]));
      rows.forEach(y => b[y].fill('')); cols.forEach(x => b.forEach(r => r[x] = ''));
      const n = rows.length + cols.length; if (n) g.add(n * n * 10);
      if (tray.every(t => !t)) deal();
      if (!tray.some(t => t && anyFit(t.m))) g.over('放不下了');
    }
    drag = -1;
  },
  draw(c) {
    rr(c, X0 - 8, Y0 - 8, N * S + 16, N * S + 16, 16, '#2c3a5e');
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) rr(c, X0 + x * S + 3, Y0 + y * S + 3, S - 6, S - 6, 10, b[y][x] || '#38476e');
    if (drag >= 0) { const p = tray[drag]!; const [gx, gy] = gridPos(p); if (fits(p.m, gx, gy)) p.m.forEach((r, i) => r.forEach((v, j) => v && rr(c, X0 + (gx + j) * S + 3, Y0 + (gy + i) * S + 3, S - 6, S - 6, 10, p.col + '66'))); }
    tray.forEach((p, i) => {
      if (!p) return; const dragging = i === drag, s = dragging ? S : 40;
      const ox = dragging ? dx - p.m[0].length * S / 2 : trayX(i) - p.m[0].length * s / 2, oy = dragging ? dy - 160 - p.m.length * S / 2 : TY + 60 - p.m.length * s / 2;
      p.m.forEach((r, a) => r.forEach((v, k) => v && rr(c, ox + k * s + 2, oy + a * s + 2, s - 4, s - 4, 6, p.col)));
    });
    text(c, '拖动方块放入棋盘', W / 2, 860, 30, '#c9cdf099', 'center', false);
  },
});
