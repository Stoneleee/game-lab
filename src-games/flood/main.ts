import { run, rr, text } from '../_lib/engine';
const N = 12, S = 54, X0 = 36, Y0 = 220, COLS = ['#ff4f5e', '#ffd23f', '#3ee87b', '#4f8bff', '#c86bff', '#ff9f43'], MAXM = 22;
let b: number[] = [], moves = 0, boards = 0;
function gen() { b = Array.from({ length: N * N }, () => Math.floor(Math.random() * 6)); moves = 0; }
function flood(col: number) {
  const old = b[0]; if (old === col) return; const st = [0], seen = new Set([0]);
  while (st.length) { const i = st.pop()!; b[i] = col; const x = i % N, y = Math.floor(i / N); for (const [a, c] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { if (a < 0 || c < 0 || a >= N || c >= N) continue; const j = c * N + a; if (!seen.has(j) && b[j] === old) { seen.add(j); st.push(j); } } }
}
run({
  id: 'flood', name: '颜色泛滥', bg: '#1f2033', accent: '#ffd23f',
  help: ['点击下方颜色，左上角区域会变成该色', '同色相邻的格子会被吞并', `${MAXM} 步内把整盘染成一种颜色`],
  start() { boards = 0; gen(); },
  down(x, y, g) {
    if (y < 950 || y > 1080) return; const k = Math.floor((x - 30) / 110); if (k < 0 || k > 5) return;
    if (b[0] === k) return; flood(k); moves++;
    if (b.every(v => v === b[0])) { g.add(50 + (MAXM - moves) * 10); boards++; gen(); return; }
    if (moves >= MAXM) g.over('步数用完了');
  },
  update(dt, g) { g.hud(`已完成 ${boards} 盘`); },
  draw(c) {
    b.forEach((v, i) => { c.fillStyle = COLS[v]; c.fillRect(X0 + (i % N) * S, Y0 + Math.floor(i / N) * S, S, S); });
    COLS.forEach((col, k) => rr(c, 40 + k * 110, 960, 90, 90, 20, col, b[0] === k ? '#fff' : undefined, 6));
    text(c, `步数 ${moves} / ${MAXM}`, 360, 1150, 44, '#fff');
  },
});
