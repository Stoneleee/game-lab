import { run, rr, circle, text, ri } from '../_lib/engine';
const N = 9, S = 74, X0 = 27, Y0 = 300, COLS = ['#ff4f5e', '#ffd23f', '#3ee87b', '#4f8bff', '#c86bff', '#ff9f43', '#4ecdc4'];
let b: number[] = [], sel = -1, nextC: number[] = [];
const empties = () => b.map((v, i) => v < 0 ? i : -1).filter(i => i >= 0);
function reach(a: number, t: number) { const seen = new Set([a]), q = [a]; while (q.length) { const i = q.shift()!; if (i === t) return true; const x = i % N, y = Math.floor(i / N); for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue; const j = ny * N + nx; if (!seen.has(j) && b[j] < 0) { seen.add(j); q.push(j); } } } return false; }
function clear(i: number, g) {
  const col = b[i], x0 = i % N, y0 = Math.floor(i / N), rm = new Set<number>();
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) { const line = [i]; for (const s of [1, -1]) { let x = x0 + dx * s, y = y0 + dy * s; while (x >= 0 && y >= 0 && x < N && y < N && b[y * N + x] === col) { line.push(y * N + x); x += dx * s; y += dy * s; } } if (line.length >= 5) line.forEach(k => rm.add(k)); }
  rm.forEach(k => b[k] = -1); if (rm.size) g.add(rm.size * 2 + (rm.size - 5) * 3); return rm.size > 0;
}
function spawn(g) { for (const c of nextC) { const e = empties(); if (!e.length) break; const i = e[ri(0, e.length - 1)]; b[i] = c; clear(i, g); } nextC = [0, 0, 0].map(() => ri(0, 6)); if (!empties().length) g.over('棋盘满了'); }
run({
  id: 'lines', name: '彩球连珠', bg: '#22243a', accent: '#ffd23f',
  help: ['点一个球，再点空格把它移过去（路径不能被挡）', '同色 5 个连成一线就会消除', '每走一步会冒出 3 个新球，填满就结束'],
  start(g) { b = Array(N * N).fill(-1); sel = -1; nextC = [0, 0, 0, 0, 0].map(() => ri(0, 6)); spawn(g); },
  down(x, y, g) {
    const cx = Math.floor((x - X0) / S), cy = Math.floor((y - Y0) / S); if (cx < 0 || cy < 0 || cx >= N || cy >= N) return; const i = cy * N + cx;
    if (b[i] >= 0) { sel = i; return; } if (sel < 0 || !reach(sel, i)) return;
    b[i] = b[sel]; b[sel] = -1; sel = -1; if (!clear(i, g)) spawn(g);
  },
  draw(c, g) {
    for (let i = 0; i < N * N; i++) { const x = X0 + (i % N) * S, y = Y0 + Math.floor(i / N) * S; rr(c, x + 2, y + 2, S - 4, S - 4, 10, '#33365a'); if (b[i] >= 0) { const r = sel === i ? 28 + Math.sin(g.time * 10) * 4 : 28; circle(c, x + S / 2, y + S / 2, r, COLS[b[i]]); circle(c, x + S / 2 - 9, y + S / 2 - 9, 7, '#ffffff77'); } }
    text(c, '下一批', 230, 220, 32, '#c9cdf0', 'center', false); nextC.forEach((k, j) => circle(c, 330 + j * 70, 220, 24, COLS[k]));
  },
});
