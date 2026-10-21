import { run, rr, circle, text } from '../_lib/engine';
const N = 8, S = 84, X0 = 24, Y0 = 300;
const WT = [100, -20, 10, 5, 5, 10, -20, 100, -20, -50, -2, -2, -2, -2, -50, -20, 10, -2, 1, 1, 1, 1, -2, 10, 5, -2, 1, 0, 0, 1, -2, 5, 5, -2, 1, 0, 0, 1, -2, 5, 10, -2, 1, 1, 1, 1, -2, 10, -20, -50, -2, -2, -2, -2, -50, -20, 100, -20, 10, 5, 5, 10, -20, 100];
let b: number[] = [], turn = 1, wait = 0, msg = '';
function flips(bd: number[], i: number, p: number) {
  if (bd[i]) return []; const x0 = i % N, y0 = Math.floor(i / N), out: number[] = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const line: number[] = []; let x = x0 + dx, y = y0 + dy;
    while (x >= 0 && y >= 0 && x < N && y < N && bd[y * N + x] === -p) { line.push(y * N + x); x += dx; y += dy; }
    if (line.length && x >= 0 && y >= 0 && x < N && y < N && bd[y * N + x] === p) out.push(...line);
  }
  return out;
}
const moves = (p: number) => b.map((_, i) => i).filter(i => flips(b, i, p).length);
function play(i: number, p: number) { for (const f of flips(b, i, p)) b[f] = p; b[i] = p; }
const cnt = (p: number) => b.filter(v => v === p).length;
function next(g) {
  turn = -turn;
  if (!moves(turn).length) { turn = -turn; if (!moves(turn).length) { const me = cnt(1), ai = cnt(-1); g.add(me); g.over(me > ai ? '你赢了！' : me === ai ? '平局' : '电脑赢了'); return; } msg = turn === 1 ? '电脑无棋可走，继续你下' : '你无棋可走，电脑继续'; }
  if (turn === -1) wait = 0.6;
}
run({
  id: 'reversi', name: '黑白棋', bg: '#1d4d34', accent: '#ffc857',
  help: ['你执黑先手，电脑执白', '落子要夹住对方的棋子才能翻转', '结束时棋子多的一方获胜'],
  start() { b = Array(64).fill(0); b[27] = b[36] = -1; b[28] = b[35] = 1; turn = 1; msg = ''; },
  down(x, y, g) {
    if (turn !== 1) return; const cx = Math.floor((x - X0) / S), cy = Math.floor((y - Y0) / S); if (cx < 0 || cy < 0 || cx >= N || cy >= N) return;
    const i = cy * N + cx; if (!flips(b, i, 1).length) return; play(i, 1); msg = ''; next(g);
  },
  update(dt, g) {
    g.hud(`黑 ${cnt(1)} : 白 ${cnt(-1)}`);
    if (turn === -1) { wait -= dt; if (wait <= 0) { const m = moves(-1); let best = m[0], bv = -1e9; for (const i of m) { const v = WT[i] * 3 + flips(b, i, -1).length + Math.random(); if (v > bv) { bv = v; best = i; } } play(best, -1); next(g); } }
    g.score = cnt(1);
  },
  draw(c) {
    rr(c, X0 - 10, Y0 - 10, N * S + 20, N * S + 20, 14, '#0f3322');
    const hint = turn === 1 ? moves(1) : [];
    for (let i = 0; i < 64; i++) {
      const x = X0 + (i % N) * S, y = Y0 + Math.floor(i / N) * S; rr(c, x + 2, y + 2, S - 4, S - 4, 6, '#2e8b57');
      if (b[i]) circle(c, x + S / 2, y + S / 2, S / 2 - 8, b[i] === 1 ? '#111' : '#f5f5f5'); else if (hint.includes(i)) circle(c, x + S / 2, y + S / 2, 8, '#ffffff66');
    }
    text(c, turn === 1 ? '轮到你（黑）' : '电脑思考中…', 360, 220, 36, '#fff');
    if (msg) text(c, msg, 360, Y0 + N * S + 60, 30, '#ffc857', 'center', false);
  },
});
