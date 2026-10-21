import { run, rr, circle, text } from '../_lib/engine';
const NX = 7, NY = 6, S = 96, X0 = 24, Y0 = 400;
let b: number[][] = [], turn = 1, wait = 0, wins = 0, hover = 3;
const free = (bd: number[][], x: number) => { for (let y = NY - 1; y >= 0; y--) if (!bd[y][x]) return y; return -1; };
function win(bd: number[][], p: number) {
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    let k = 0; while (k < 4) { const xx = x + dx * k, yy = y + dy * k; if (xx < 0 || yy < 0 || xx >= NX || yy >= NY || bd[yy][xx] !== p) break; k++; } if (k === 4) return true;
  } return false;
}
function heur(bd: number[][]) { let s = 0; for (let y = 0; y < NY; y++) s += (bd[y][3] === -1 ? 3 : bd[y][3] === 1 ? -3 : 0); return s; }
function mm(bd: number[][], d: number, p: number, a: number, be: number): number {
  if (win(bd, -1)) return 1000 + d; if (win(bd, 1)) return -1000 - d; if (d === 0) return heur(bd);
  let any = false, best = p === -1 ? -1e9 : 1e9;
  for (const x of [3, 2, 4, 1, 5, 0, 6]) { const y = free(bd, x); if (y < 0) continue; any = true; bd[y][x] = p; const v = mm(bd, d - 1, -p, a, be); bd[y][x] = 0;
    if (p === -1) { best = Math.max(best, v); a = Math.max(a, v); } else { best = Math.min(best, v); be = Math.min(be, v); } if (a >= be) break; }
  return any ? best : 0;
}
function drop(x: number, p: number, g) {
  const y = free(b, x); if (y < 0) return false; b[y][x] = p;
  if (win(b, p)) { if (p === 1) { wins++; g.add(100); turn = 0; setTimeout(() => { if (g.state === 'play') reset(); }, 900); } else { turn = 0; setTimeout(() => g.over('电脑赢了'), 900); } }
  else if (b[0].every(Boolean)) { g.add(30); reset(); } else { turn = -p; if (turn === -1) wait = 0.4; }
  return true;
}
function reset() { b = Array.from({ length: NY }, () => Array(NX).fill(0)); turn = 1; }
run({
  id: 'connect4', name: '四子棋', bg: '#1f3c88', accent: '#ffc857',
  help: ['点击某一列投下红色棋子', '横、竖、斜先连成四子获胜', '赢一局 +100 分，输了游戏结束'],
  start() { wins = 0; reset(); },
  down(x, y, g) { if (turn !== 1) return; const cx = Math.floor((x - X0) / S); if (cx >= 0 && cx < NX) { hover = cx; drop(cx, 1, g); } },
  update(dt, g) {
    g.hud(`已赢 ${wins} 局`); if (turn !== -1) return; wait -= dt; if (wait > 0) return;
    let bx = -1, bv = -1e9; for (const x of [3, 2, 4, 1, 5, 0, 6]) { const y = free(b, x); if (y < 0) continue; b[y][x] = -1; const v = mm(b, 4, 1, -1e9, 1e9) + Math.random() * 2; b[y][x] = 0; if (v > bv) { bv = v; bx = x; } }
    if (bx >= 0) drop(bx, -1, g);
  },
  draw(c) {
    rr(c, X0 - 8, Y0 - 8, NX * S + 16, NY * S + 16, 24, '#2a52be');
    for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) circle(c, X0 + x * S + S / 2, Y0 + y * S + S / 2, 38, b[y][x] === 1 ? '#ff4f5e' : b[y][x] === -1 ? '#ffd23f' : '#0f1d48');
    if (turn === 1) circle(c, X0 + hover * S + S / 2, Y0 - 60, 34, '#ff4f5e88');
    text(c, turn === 1 ? '轮到你（红）' : turn === -1 ? '电脑思考中…' : '', 360, 240, 36, '#fff');
  },
});
