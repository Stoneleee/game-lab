import { run, circle, text } from '../_lib/engine';
const N = 13, S = 52, X0 = 48, Y0 = 330;
let b: number[] = [], turn = 1, wait = 0, wins = 0, last = -1;
const at = (x: number, y: number) => x < 0 || y < 0 || x >= N || y >= N ? -9 : b[y * N + x];
function lineLen(i: number, p: number, dx: number, dy: number) {
  const x0 = i % N, y0 = Math.floor(i / N); let n = 1, open = 0;
  for (const s of [1, -1]) { let x = x0 + dx * s, y = y0 + dy * s; while (at(x, y) === p) { n++; x += dx * s; y += dy * s; } if (at(x, y) === 0) open++; }
  return [n, open];
}
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
function val(i: number, p: number) {
  let v = 0;
  for (const [dx, dy] of DIRS) { const [n, o] = lineLen(i, p, dx, dy); v += n >= 5 ? 1e6 : n === 4 ? (o === 2 ? 5e4 : o ? 4000 : 0) : n === 3 ? (o === 2 ? 3000 : o ? 200 : 0) : n === 2 ? (o === 2 ? 150 : o ? 15 : 0) : o; }
  return v;
}
const five = (i: number, p: number) => DIRS.some(([dx, dy]) => lineLen(i, p, dx, dy)[0] >= 5);
function end(g, i: number, p: number) {
  if (five(i, p)) { if (p === 1) { wins++; g.add(100); setTimeout(() => { if (g.state === 'play') reset(); }, 900); turn = 0; } else { turn = 0; setTimeout(() => g.over('电脑赢了'), 900); } return true; }
  if (!b.includes(0)) { g.add(30); reset(); return true; }
  return false;
}
function reset() { b = Array(N * N).fill(0); turn = 1; last = -1; }
run({
  id: 'gomoku', name: '五子棋', bg: '#d9a95b', accent: '#7a2e0e',
  help: ['你执黑先手，点击交叉点落子', '横、竖、斜先连成五子获胜', '赢一局 +100 分，输了游戏结束'],
  start() { wins = 0; reset(); },
  down(x, y, g) {
    if (turn !== 1) return; const cx = Math.round((x - X0) / S), cy = Math.round((y - Y0) / S); if (at(cx, cy) !== 0) return;
    const i = cy * N + cx; b[i] = 1; last = i; if (!end(g, i, 1)) { turn = -1; wait = 0.4; }
  },
  update(dt, g) {
    g.hud(`已赢 ${wins} 局`);
    if (turn !== -1) return; wait -= dt; if (wait > 0) return;
    let best = Math.floor(N * N / 2), bv = -1;
    for (let i = 0; i < N * N; i++) { if (b[i]) continue; const v = val(i, -1) * 1.1 + val(i, 1) + Math.random(); if (v > bv) { bv = v; best = i; } }
    b[best] = -1; last = best; if (!end(g, best, -1)) turn = 1;
  },
  draw(c) {
    c.strokeStyle = '#5a3a12'; c.lineWidth = 2;
    for (let i = 0; i < N; i++) { c.beginPath(); c.moveTo(X0, Y0 + i * S); c.lineTo(X0 + (N - 1) * S, Y0 + i * S); c.stroke(); c.beginPath(); c.moveTo(X0 + i * S, Y0); c.lineTo(X0 + i * S, Y0 + (N - 1) * S); c.stroke(); }
    b.forEach((v, i) => { if (!v) return; const x = X0 + (i % N) * S, y = Y0 + Math.floor(i / N) * S; circle(c, x, y, 22, v === 1 ? '#111' : '#f8f8f8'); if (i === last) circle(c, x, y, 6, '#e33'); });
    text(c, turn === 1 ? '轮到你（黑）' : turn === -1 ? '电脑思考中…' : '', 360, 220, 36, '#3a240a');
  },
});
