import { run, rr, text, pick, W, inBox } from '../_lib/engine';
const NX = 10, NY = 18, S = 50, X0 = 40, Y0 = 140;
const P = [[[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]], [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]], [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]]];
const COL = ['#4ecdc4', '#ffc857', '#b388ff', '#5b8def', '#ff9f43', '#ff6b6b', '#7bd389'];
let bd: number[][] = [], cur: number[][] = [], ck = 0, cx = 0, cy = 0, nk = 0, acc = 0, lines = 0;
const fits = (m: number[][], x: number, y: number) => m.every((r, i) => r.every((v, j) => !v || (x + j >= 0 && x + j < NX && y + i < NY && (y + i < 0 || !bd[y + i][x + j]))));
function spawnP(g) { ck = nk; nk = Math.floor(Math.random() * 7); cur = P[ck].map(r => r.map(v => v ? ck + 1 : 0)); cx = 3; cy = 0; if (!fits(cur, cx, cy)) g.over('堆到顶了'); }
function lock(g) {
  cur.forEach((r, i) => r.forEach((v, j) => { if (v && cy + i >= 0) bd[cy + i][cx + j] = v; }));
  const keep = bd.filter(r => r.some(v => !v)); const n = NY - keep.length;
  if (n) { lines += n; g.add([0, 100, 300, 500, 800][n]); g.hud(`消行 ${lines}`); }
  bd = [...Array.from({ length: n }, () => Array(NX).fill(0)), ...keep]; spawnP(g);
}
const act = (a: string, g) => {
  if (a === 'L' && fits(cur, cx - 1, cy)) cx--; if (a === 'R' && fits(cur, cx + 1, cy)) cx++;
  if (a === 'U') { const r = cur[0].map((_, j) => cur.map(row => row[j]).reverse()); for (const k of [0, -1, 1, -2, 2]) if (fits(r, cx + k, cy)) { cur = r; cx += k; break; } }
  if (a === 'D') { while (fits(cur, cx, cy + 1)) { cy++; g.add(1); } lock(g); }
};
const BTN = [['◀', 'L'], ['⟳', 'U'], ['▶', 'R'], ['⤓', 'D']];
run({
  id: 'tetris', name: '方块消除', bg: '#151829', accent: '#4ecdc4',
  help: ['下方按钮：左移 / 旋转 / 右移 / 落下', '也可滑动：左右移动，上滑旋转，下滑落下', '填满一整行即可消除'],
  start(g) { bd = Array.from({ length: NY }, () => Array(NX).fill(0)); lines = 0; acc = 0; nk = Math.floor(Math.random() * 7); spawnP(g); g.hud('消行 0'); },
  down(x, y, g) { if (y > 1060) { const i = Math.floor(x / (W / 4)); act(BTN[Math.min(3, i)][1], g); } },
  swipe(d, x0, y0, g) { if (y0 < 1060) act(d, g); },
  key(k, g) { if (k === ' ') act('D', g); },
  update(dt, g) { acc += dt; const sp = Math.max(0.12, 0.7 - lines * 0.02); if (acc > sp) { acc = 0; if (fits(cur, cx, cy + 1)) cy++; else lock(g); } },
  draw(c) {
    rr(c, X0 - 6, Y0 - 6, NX * S + 12, NY * S + 12, 10, '#222844');
    const cell = (x: number, y: number, v: number, a = 1) => { c.globalAlpha = a; rr(c, X0 + x * S + 2, Y0 + y * S + 2, S - 4, S - 4, 8, COL[v - 1]); c.globalAlpha = 1; };
    bd.forEach((r, i) => r.forEach((v, j) => v && cell(j, i, v)));
    let gy = cy; while (fits(cur, cx, gy + 1)) gy++;
    cur.forEach((r, i) => r.forEach((v, j) => { if (v) { cell(cx + j, gy + i, v, 0.25); cell(cx + j, cy + i, v); } }));
    text(c, '下一个', 625, 180, 28, '#c9cdf0');
    P[nk].forEach((r, i) => r.forEach((v, j) => v && rr(c, 570 + j * 34, 220 + i * 34, 30, 30, 6, COL[nk])));
    BTN.forEach(([l], i) => { rr(c, i * W / 4 + 10, 1080, W / 4 - 20, 150, 24, '#2f3760'); text(c, l, i * W / 4 + W / 8, 1155, 64, '#fff'); });
  },
});
