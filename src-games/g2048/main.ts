import { run, rr, text, pick, W } from '../_lib/engine';
const N = 4, S = 150, X0 = (W - N * S) / 2, Y0 = 360;
let b: number[][] = [];
const COL: Record<number, string> = { 2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e' };
function spawn() { const e: [number, number][] = []; b.forEach((r, i) => r.forEach((v, j) => !v && e.push([i, j]))); if (e.length) { const [i, j] = pick(e); b[i][j] = Math.random() < 0.9 ? 2 : 4; } }
function slide(row: number[], g): number[] {
  const a = row.filter(v => v); const out: number[] = [];
  for (let i = 0; i < a.length; i++) { if (a[i] === a[i + 1]) { out.push(a[i] * 2); g.add(a[i] * 2); i++; } else out.push(a[i]); }
  while (out.length < N) out.push(0); return out;
}
const canMove = () => b.some((r, i) => r.some((v, j) => !v || r[j + 1] === v || (b[i + 1] && b[i + 1][j] === v)));
run({
  id: 'g2048', name: '2048', bg: '#faf8ef', accent: '#f67c5f',
  help: ['滑动屏幕（或方向键）移动所有方块', '相同数字相撞会合并', '拼出 2048！'],
  start() { b = Array.from({ length: N }, () => Array(N).fill(0)); spawn(); spawn(); },
  swipe(d, _x, _y, g) {
    const before = JSON.stringify(b);
    for (let k = 0; k < N; k++) {
      let line = d === 'L' || d === 'R' ? b[k].slice() : b.map(r => r[k]);
      if (d === 'R' || d === 'D') line.reverse();
      line = slide(line, g);
      if (d === 'R' || d === 'D') line.reverse();
      line.forEach((v, i) => { if (d === 'L' || d === 'R') b[k][i] = v; else b[i][k] = v; });
    }
    if (JSON.stringify(b) !== before) spawn();
    if (!canMove()) g.over('无路可走');
  },
  draw(c) {
    rr(c, X0 - 12, Y0 - 12, N * S + 24, N * S + 24, 20, '#bbada0');
    b.forEach((r, i) => r.forEach((v, j) => {
      rr(c, X0 + j * S + 8, Y0 + i * S + 8, S - 16, S - 16, 14, v ? COL[v] || '#3c3a32' : '#cdc1b4');
      if (v) text(c, v, X0 + j * S + S / 2, Y0 + i * S + S / 2, v < 100 ? 64 : v < 1000 ? 52 : 40, v <= 4 ? '#776e65' : '#fff');
    }));
    text(c, '滑动合并相同数字', W / 2, 1150, 32, '#776e65', 'center', false);
  },
});
