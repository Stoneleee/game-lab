import { run, rr, text, ri, pick, W, inBox } from '../_lib/engine';
let q = '', truth = true, limit = 3, left = 3, fb = 0, fbOk = true;
function next(g) {
  const lv = g.score; const op = pick(lv < 5 ? ['+', '-'] : ['+', '-', '×']);
  let a = ri(1, 9 + lv), b = ri(1, 9 + lv); if (op === '-' && b > a) [a, b] = [b, a]; if (op === '×') { a = ri(2, 9); b = ri(2, 9 + Math.floor(lv / 5)); }
  const r = op === '+' ? a + b : op === '-' ? a - b : a * b; truth = Math.random() < 0.5;
  const shown = truth ? r : r + pick([-2, -1, 1, 2, 10, -10].filter(d => r + d >= 0));
  q = `${a} ${op} ${b} = ${shown}`; limit = Math.max(1.2, 3 - lv * 0.06); left = limit;
}
function answer(v: boolean, g) { if (v === truth) { g.add(1); fb = 0.25; fbOk = true; next(g); } else g.over('答错了'); }
run({
  id: 'mathrush', name: '极速口算', bg: '#1e3a5f', accent: '#7bd389',
  help: ['判断算式对不对，点「对」或「错」', '时间条走完也算输', '键盘：← 对  → 错'],
  start(g) { next(g); },
  down(x, y, g) { if (inBox(x, y, 50, 860, 300, 260)) answer(true, g); else if (inBox(x, y, 370, 860, 300, 260)) answer(false, g); },
  key(k, g) { if (k === 'ArrowLeft') answer(true, g); if (k === 'ArrowRight') answer(false, g); },
  update(dt, g) { left -= dt; fb -= dt; if (left <= 0) g.over('超时了'); },
  draw(c) {
    rr(c, 60, 260, 600, 30, 15, '#ffffff22'); rr(c, 60, 260, 600 * Math.max(0, left / limit), 30, 15, left / limit > 0.3 ? '#7bd389' : '#ff6b6b');
    rr(c, 60, 380, 600, 320, 30, fb > 0 ? (fbOk ? '#2e6b4a' : '#6b2e2e') : '#284b78');
    text(c, q, W / 2, 540, 88, '#fff');
    rr(c, 50, 860, 300, 260, 30, '#7bd389', '#1b1d2b', 6); text(c, '✔ 对', 200, 990, 72, '#1b1d2b');
    rr(c, 370, 860, 300, 260, 30, '#ff6b6b', '#1b1d2b', 6); text(c, '✘ 错', 520, 990, 72, '#1b1d2b');
  },
});
