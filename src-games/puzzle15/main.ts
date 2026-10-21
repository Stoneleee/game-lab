import { run, rr, text, pick } from '../_lib/engine';
const N = 4, S = 150, X0 = 60, Y0 = 330;
let b: number[] = [], moves = 0;
const nb = (i: number) => [i - N, i + N, i % N ? i - 1 : -1, i % N < N - 1 ? i + 1 : -1].filter(j => j >= 0 && j < N * N);
function tryMove(i: number, g) {
  const e = b.indexOf(0); if (!nb(e).includes(i)) return; [b[e], b[i]] = [b[i], b[e]]; moves++;
  if (b.every((v, k) => v === (k + 1) % (N * N))) { g.add(Math.max(50, 3000 - moves * 10 - Math.floor(g.time) * 5)); g.over('完成！'); }
}
run({
  id: 'puzzle15', name: '数字华容道', bg: '#2b2440', accent: '#ffc857',
  help: ['点击空格旁边的数字把它移过去', '按 1 到 15 的顺序排好', '步数越少、用时越短分越高'],
  start() { b = [...Array(15).keys()].map(i => i + 1).concat(0); let last = -1; for (let k = 0; k < 300; k++) { const e = b.indexOf(0); const o = nb(e).filter(j => j !== last); const j = pick(o); [b[e], b[j]] = [b[j], b[e]]; last = e; } moves = 0; },
  down(x, y, g) { const cx = Math.floor((x - X0) / S), cy = Math.floor((y - Y0) / S); if (cx >= 0 && cy >= 0 && cx < N && cy < N) tryMove(cy * N + cx, g); },
  swipe(d, x0, y0, g) { const e = b.indexOf(0), ex = e % N, ey = Math.floor(e / N); const t = d === 'L' ? (ex < N - 1 ? e + 1 : -1) : d === 'R' ? (ex > 0 ? e - 1 : -1) : d === 'U' ? (ey < N - 1 ? e + N : -1) : (ey > 0 ? e - N : -1); if (x0 < 0 && t >= 0) tryMove(t, g); },
  update(dt, g) { g.hud(`${moves} 步 · ${Math.floor(g.time)} 秒`); },
  draw(c) {
    rr(c, X0 - 14, Y0 - 14, S * N + 28, S * N + 28, 20, '#423a63');
    b.forEach((v, i) => { if (!v) return; const x = X0 + (i % N) * S, y = Y0 + Math.floor(i / N) * S; rr(c, x + 6, y + 6, S - 12, S - 12, 18, v === i + 1 ? '#7bd389' : '#ffc857'); text(c, v, x + S / 2, y + S / 2, 64, '#2b2440'); });
    text(c, '绿色 = 已到正确位置', 360, Y0 + S * N + 70, 30, '#c9cdf0', 'center', false);
  },
});
