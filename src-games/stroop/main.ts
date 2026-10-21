import { run, rr, text, ri } from '../_lib/engine';
const NAMES = ['红', '绿', '蓝', '黄'], COLS = ['#ff4f5e', '#2ecc71', '#4f8bff', '#ffd23f'];
let word = 0, ink = 0, tl = 0, tmax = 3, lives = 3, flash = '', fT = 0;
function next(g) { word = ri(0, 3); ink = Math.random() < 0.3 ? word : (word + ri(1, 3)) % 4; tmax = Math.max(1.1, 3 - g.score * 0.06); tl = tmax; }
function wrong(g, m: string) { lives--; flash = m; fT = 0.6; if (lives <= 0) return g.over('反应不过来了'); next(g); }
run({
  id: 'stroop', name: '色词挑战', bg: '#f4f4f8', accent: '#e85d75',
  help: ['屏幕中间的字是什么颜色？', '选「字的颜色」，不是字的意思', '答错或超时扣命，共 3 条命'],
  start(g) { lives = 3; next(g); },
  down(x, y, g) { if (y < 860 || y > 1180) return; const k = (x < 360 ? 0 : 1) + (y > 1020 ? 2 : 0); if (k === ink) { g.add(1); flash = '✔'; fT = 0.25; next(g); } else wrong(g, '✘ 选错了'); },
  update(dt, g) { g.hud(`❤️ ${lives}`); fT -= dt; tl -= dt; if (tl <= 0) wrong(g, '⏰ 超时'); },
  draw(c) {
    rr(c, 60, 260, 600, 24, 12, '#ddd'); rr(c, 60, 260, 600 * Math.max(0, tl / tmax), 24, 12, '#e85d75');
    text(c, NAMES[word], 360, 560, 260, COLS[ink]);
    NAMES.forEach((n, k) => { const x = k % 2 ? 380 : 60, y = k > 1 ? 1030 : 870; rr(c, x, y, 280, 140, 24, '#fff', '#ccc', 3); text(c, n, x + 140, y + 70, 64, '#333'); });
    if (fT > 0) text(c, flash, 360, 780, 50, flash === '✔' ? '#2ecc71' : '#e85d75');
  },
});
