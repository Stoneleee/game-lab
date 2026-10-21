import { run, rr, text, W, inBox } from '../_lib/engine';
const NX = 9, NY = 12, S = 72, X0 = (W - NX * S) / 2, Y0 = 170, MINES = 16;
type Cell = { m: boolean; o: boolean; f: boolean; n: number };
let grid: Cell[][] = [], first = true, flagMode = false, pressT = 0, pressCell: [number, number] | null = null, longDone = false;
const nb = (x: number, y: number) => { const r: [number, number][] = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = x + i, b = y + j; if ((i || j) && a >= 0 && b >= 0 && a < NX && b < NY) r.push([a, b]); } return r; };
function lay(sx: number, sy: number) {
  let k = 0; while (k < MINES) { const x = Math.floor(Math.random() * NX), y = Math.floor(Math.random() * NY); if (grid[y][x].m || (Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1)) continue; grid[y][x].m = true; k++; }
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) grid[y][x].n = nb(x, y).filter(([a, b]) => grid[b][a].m).length;
}
function open(x: number, y: number, g) {
  const c = grid[y][x]; if (c.o || c.f) return; c.o = true; g.add(1);
  if (c.m) { grid.forEach(r => r.forEach(q => { if (q.m) q.o = true; })); return g.over('踩雷了'); }
  if (!c.n) nb(x, y).forEach(([a, b]) => open(a, b, g));
}
const cellAt = (x: number, y: number): [number, number] | null => { const cx = Math.floor((x - X0) / S), cy = Math.floor((y - Y0) / S); return cx >= 0 && cy >= 0 && cx < NX && cy < NY ? [cx, cy] : null; };
const NC = ['', '#5b8def', '#4caf50', '#ff6b6b', '#3f51b5', '#a0522d', '#00897b', '#333', '#777'];
run({
  id: 'mines', name: '扫雷', bg: '#22283f', accent: '#ff6b6b',
  help: ['点击格子翻开，数字=周围的雷数', '长按或切到「插旗」模式标记雷', '翻开所有安全格子即胜利'],
  start(g) { grid = Array.from({ length: NY }, () => Array.from({ length: NX }, () => ({ m: false, o: false, f: false, n: 0 }))); first = true; flagMode = false; g.hud(`💣 ${MINES}`); },
  down(x, y) { pressCell = cellAt(x, y); pressT = 0; longDone = false; if (inBox(x, y, 160, 1080, 400, 100)) { flagMode = !flagMode; pressCell = null; } },
  update(dt, g) {
    if (pressCell && !longDone) { pressT += dt; if (pressT > 0.4) { longDone = true; const c = grid[pressCell[1]][pressCell[0]]; if (!c.o) c.f = !c.f; } }
    g.hud(`💣 ${MINES - grid.flat().filter(c => c.f).length}`);
  },
  up(x, y, g) {
    const p = cellAt(x, y); const was = pressCell; pressCell = null;
    if (!p || !was || p[0] !== was[0] || p[1] !== was[1] || longDone) return;
    const c = grid[p[1]][p[0]];
    if (flagMode) { if (!c.o) c.f = !c.f; return; }
    if (first) { lay(p[0], p[1]); first = false; }
    open(p[0], p[1], g);
    if (g.state === 'play' && grid.flat().every(q => q.m || q.o)) { g.add(Math.max(50, 600 - Math.floor(g.time) * 2)); g.over('排雷成功'); }
  },
  draw(c) {
    grid.forEach((r, y) => r.forEach((q, x) => {
      const px = X0 + x * S, py = Y0 + y * S;
      rr(c, px + 3, py + 3, S - 6, S - 6, 8, q.o ? (q.m ? '#ff6b6b' : '#e9ecf5') : '#5b6aa0');
      if (q.o && q.m) text(c, '✹', px + S / 2, py + S / 2, 44, '#222');
      else if (q.o && q.n) text(c, q.n, px + S / 2, py + S / 2, 40, NC[q.n]);
      else if (q.f) { c.fillStyle = '#ffc857'; c.beginPath(); c.moveTo(px + 26, py + 16); c.lineTo(px + 52, py + 28); c.lineTo(px + 26, py + 40); c.fill(); c.fillRect(px + 24, py + 16, 5, 42); }
    }));
    rr(c, 160, 1080, 400, 100, 24, flagMode ? '#ffc857' : '#c9cdf0', '#1b1d2b', 6);
    text(c, flagMode ? '模式：插旗 🚩' : '模式：翻开 👆', W / 2, 1130, 38, '#1b1d2b');
  },
});
