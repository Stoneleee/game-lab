import { run, rr, text, shuffle, W } from '../_lib/engine';
const N = 5, S = 126, X0 = (W - N * S) / 2, Y0 = 260;
let nums: number[] = [], nextN = 1, wrong = -1, wrongT = 0, penalty = 0;
run({
  id: 'schulte', name: '舒尔特方格', bg: '#fdf6ec', accent: '#ff6b6b',
  help: ['按 1 → 25 的顺序依次点击数字', '点错罚时 1 秒', '越快完成分数越高，训练专注力'],
  start(g) { nums = shuffle([...Array(N * N).keys()].map(i => i + 1)); nextN = 1; penalty = 0; g.hud('下一个：1'); },
  down(x, y, g) {
    const cx = Math.floor((x - X0) / S), cy = Math.floor((y - Y0) / S); if (cx < 0 || cy < 0 || cx >= N || cy >= N) return;
    const i = cy * N + cx;
    if (nums[i] === nextN) { nextN++; g.hud(`下一个：${nextN}`); if (nextN > N * N) { const t = g.time + penalty; g.score = Math.max(10, Math.round(3000 - t * 60)); g.over(`${t.toFixed(1)} 秒完成`); } }
    else { wrong = i; wrongT = 0.3; penalty += 1; }
  },
  update(dt, g) { wrongT -= dt; if (nextN <= N * N) g.score = Math.max(0, Math.round(3000 - (g.time + penalty) * 60)); },
  draw(c, g) {
    text(c, `用时 ${(g.time + penalty).toFixed(1)} 秒`, W / 2, 190, 40, '#ff6b6b');
    nums.forEach((n, i) => {
      const x = X0 + (i % N) * S, y = Y0 + Math.floor(i / N) * S, done = n < nextN;
      rr(c, x + 5, y + 5, S - 10, S - 10, 16, wrongT > 0 && i === wrong ? '#ff8a8a' : done ? '#e6dccb' : '#fff', '#e0cfb1', 3);
      text(c, n, x + S / 2, y + S / 2 + 2, 52, done ? '#bfb2a0' : '#333');
    });
    text(c, '按顺序点击 1 → 25', W / 2, 1000, 32, '#a08a6a', 'center', false);
  },
});
