import { run, circle, rr, text, pick } from '../_lib/engine';
const N = 4, SP = 140, X0 = 80, Y0 = 380;
let H: number[][] = [], V: number[][] = [], B: number[][] = [], turn = 1, wait = 0, me = 0, ai = 0, wins = 0;
type L = [0 | 1, number, number];
const all = (): L[] => { const o: L[] = []; for (let y = 0; y <= N; y++) for (let x = 0; x < N; x++) if (!H[y][x]) o.push([0, x, y]); for (let y = 0; y < N; y++) for (let x = 0; x <= N; x++) if (!V[y][x]) o.push([1, x, y]); return o; };
const sides = (x: number, y: number) => (H[y][x] ? 1 : 0) + (H[y + 1][x] ? 1 : 0) + (V[y][x] ? 1 : 0) + (V[y][x + 1] ? 1 : 0);
const adj = ([t, x, y]: L) => (t === 0 ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]]).filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N);
function reset() { H = Array.from({ length: N + 1 }, () => Array(N).fill(0)); V = Array.from({ length: N }, () => Array(N + 1).fill(0)); B = Array.from({ length: N }, () => Array(N).fill(0)); turn = 1; me = ai = 0; }
function draw(l: L, p: number, g) {
  const [t, x, y] = l; if (t === 0) H[y][x] = p; else V[y][x] = p; let got = 0;
  for (const [a, b] of adj(l)) if (sides(a, b) === 4 && !B[b][a]) { B[b][a] = p; got++; if (p === 1) { me++; g.add(1); } else ai++; }
  if (me + ai === N * N) { if (me > ai) { wins++; g.add(20); turn = 0; setTimeout(() => { if (g.state === 'play') reset(); }, 1000); } else { turn = 0; setTimeout(() => g.over(me === ai ? '平局' : '电脑赢了'), 1000); } return; }
  if (!got) turn = -p; if (turn === -1) wait = 0.45;
}
run({
  id: 'dotsboxes', name: '点格棋', bg: '#f5f0e6', accent: '#e85d75',
  help: ['轮流点两点之间画一条线', '画下格子的第 4 条边就占领它，并且再走一步', '占的格子多就赢，输一局游戏结束'],
  start() { wins = 0; reset(); },
  down(x, y, g) {
    if (turn !== 1) return; let best: L | null = null, bd = 45;
    for (const l of all()) { const [t, a, b] = l; const mx = X0 + a * SP + (t === 0 ? SP / 2 : 0), my = Y0 + b * SP + (t === 1 ? SP / 2 : 0); const d = Math.hypot(x - mx, y - my); if (d < bd) { bd = d; best = l; } }
    if (best) draw(best, 1, g);
  },
  update(dt, g) {
    g.hud(`你 ${me} : ${ai} 电脑 · 胜 ${wins}`); if (turn !== -1) return; wait -= dt; if (wait > 0) return;
    const ls = all(); const take = ls.filter(l => adj(l).some(([a, b]) => sides(a, b) === 3)); const safe = ls.filter(l => adj(l).every(([a, b]) => sides(a, b) < 2));
    draw(take.length ? take[0] : safe.length ? pick(safe) : pick(ls), -1, g);
  },
  draw(c) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (B[y][x]) rr(c, X0 + x * SP + 8, Y0 + y * SP + 8, SP - 16, SP - 16, 12, B[y][x] === 1 ? '#5b8def55' : '#e85d7555');
    const ln = (p: number) => p === 1 ? '#5b8def' : p === -1 ? '#e85d75' : '#ddd';
    c.lineCap = 'round'; c.lineWidth = 10;
    for (let y = 0; y <= N; y++) for (let x = 0; x < N; x++) { c.strokeStyle = ln(H[y][x]); c.beginPath(); c.moveTo(X0 + x * SP, Y0 + y * SP); c.lineTo(X0 + (x + 1) * SP, Y0 + y * SP); c.stroke(); }
    for (let y = 0; y < N; y++) for (let x = 0; x <= N; x++) { c.strokeStyle = ln(V[y][x]); c.beginPath(); c.moveTo(X0 + x * SP, Y0 + y * SP); c.lineTo(X0 + x * SP, Y0 + (y + 1) * SP); c.stroke(); }
    for (let y = 0; y <= N; y++) for (let x = 0; x <= N; x++) circle(c, X0 + x * SP, Y0 + y * SP, 12, '#333');
    text(c, turn === 1 ? '轮到你（蓝）' : turn === -1 ? '电脑思考中…' : '', 360, 260, 38, '#333');
    text(c, `你 ${me}  :  ${ai} 电脑`, 360, Y0 + N * SP + 90, 44, '#333');
  },
});
