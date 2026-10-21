import { run, rr, text } from '../_lib/engine';
const N = 5, S = 90, X0 = 250, Y0 = 440, LIMIT = 240;
let sol: boolean[] = [], cur: number[] = [], solved = 0;
const runs = (a: boolean[]) => { const r: number[] = []; let k = 0; for (const v of a) { if (v) k++; else if (k) { r.push(k); k = 0; } } if (k) r.push(k); return r.length ? r : [0]; };
const row = (a: any[], y: number) => a.slice(y * N, y * N + N);
const col = (a: any[], x: number) => a.filter((_, i) => i % N === x);
function gen() { do { sol = Array.from({ length: N * N }, () => Math.random() < 0.58); } while (sol.filter(Boolean).length < 10); cur = Array(N * N).fill(0); }
function won() { const f = cur.map(v => v === 1); for (let i = 0; i < N; i++) { if (runs(row(f, i)).join() !== runs(row(sol, i)).join() || runs(col(f, i)).join() !== runs(col(sol, i)).join()) return false; } return true; }
run({
  id: 'nonogram', name: '数织', bg: '#f3efe6', accent: '#e85d75',
  help: ['数字表示这一行/列连续涂黑的格子数', '点一下涂黑，再点标记 ×，再点清空', `${LIMIT} 秒内解开越多题越好`],
  start() { solved = 0; gen(); },
  down(x, y, g) { const cx = Math.floor((x - X0) / S), cy = Math.floor((y - Y0) / S); if (cx < 0 || cy < 0 || cx >= N || cy >= N) return; const i = cy * N + cx; cur[i] = (cur[i] + 1) % 3; if (won()) { solved++; g.add(100); gen(); } },
  update(dt, g) { const left = LIMIT - g.time; g.hud(`已解 ${solved} · ${Math.max(0, Math.ceil(left))}s`); if (left <= 0) g.over('时间到'); },
  draw(c) {
    for (let i = 0; i < N; i++) {
      text(c, runs(row(sol, i)).join(' '), X0 - 20, Y0 + i * S + S / 2, 34, '#333', 'right');
      runs(col(sol, i)).forEach((v, k, a) => text(c, v, X0 + i * S + S / 2, Y0 - 30 - (a.length - 1 - k) * 44, 34, '#333'));
    }
    cur.forEach((v, i) => { const x = X0 + (i % N) * S, y = Y0 + Math.floor(i / N) * S; rr(c, x + 3, y + 3, S - 6, S - 6, 8, v === 1 ? '#2b2440' : '#fff', '#c8bfae', 2); if (v === 2) text(c, '×', x + S / 2, y + S / 2, 50, '#e85d75'); });
    text(c, `已解 ${solved} 题`, 360, Y0 + N * S + 80, 36, '#666', 'center', false);
  },
});
