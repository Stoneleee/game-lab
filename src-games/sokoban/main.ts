import { run, rr, text } from '../_lib/engine';
const LV = [
  ['#######', '#     #', '# .$@ #', '#     #', '#######'],
  ['########', '#      #', '# $  $ #', '# .  . #', '#  @   #', '########'],
  ['#######', '#     #', '# $$$ #', '#     #', '# ... #', '#  @  #', '#######'],
  ['#######', '#  .  #', '# $#$ #', '#  @. #', '#. $  #', '#######'],
  ['#######', '#.  ..#', '# $ $ #', '#  $  #', '#  @  #', '#######'],
];
let lv = 0, wall: boolean[][] = [], goal: boolean[][] = [], box: boolean[][] = [], px = 0, py = 0, moves = 0, hist: string[] = [], S = 90, X0 = 0, Y0 = 0;
function load() {
  const L = LV[lv]; wall = L.map(r => [...r].map(c => c === '#')); goal = L.map(r => [...r].map(c => c === '.' || c === '*')); box = L.map(r => [...r].map(c => c === '$' || c === '*'));
  L.forEach((r, y) => [...r].forEach((c, x) => { if (c === '@') { px = x; py = y; } })); moves = 0; hist = [];
  const w = Math.max(...L.map(r => r.length)); S = Math.min(96, Math.floor(660 / w)); X0 = (720 - w * S) / 2; Y0 = 600 - L.length * S / 2;
}
const snap = () => JSON.stringify([box, px, py]);
function go(dx: number, dy: number, g) {
  const nx = px + dx, ny = py + dy; if (wall[ny]?.[nx]) return;
  if (box[ny][nx]) { const bx = nx + dx, by = ny + dy; if (wall[by]?.[bx] || box[by][bx]) return; hist.push(snap()); box[ny][nx] = false; box[by][bx] = true; } else hist.push(snap());
  px = nx; py = ny; moves++;
  if (box.every((r, y) => r.every((b, x) => !b || goal[y][x]))) { g.add(Math.max(10, 100 - moves)); lv++; if (lv >= LV.length) return g.over('全部通关！'); load(); }
}
run({
  id: 'sokoban', name: '推箱子', bg: '#3d3226', accent: '#ffc857',
  help: ['滑动屏幕（或方向键）移动小人', '把所有箱子推到红点上', '箱子只能推不能拉，卡住可以撤销或重来'],
  start() { lv = 0; load(); },
  swipe(d, x, y, g) { const [dx, dy] = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] }[d]; go(dx, dy, g); },
  down(x, y) { if (y > 1080 && y < 1190) { if (x < 360) { const h = hist.pop(); if (h) { [box, px, py] = JSON.parse(h); moves--; } } else load(); } },
  update(dt, g) { g.hud(`第 ${lv + 1}/${LV.length} 关 · ${moves} 步`); },
  draw(c) {
    const L = LV[Math.min(lv, LV.length - 1)];
    L.forEach((r, y) => [...r].forEach((_, x) => { const X = X0 + x * S, Y = Y0 + y * S;
      if (wall[y][x]) rr(c, X, Y, S, S, 6, '#8a6a4a', '#5a4430', 3); else if (_ !== ' ' || (x > 0 && x < r.length - 1)) { rr(c, X, Y, S, S, 0, '#e8dcc4'); }
      if (goal[y][x]) { c.beginPath(); c.arc(X + S / 2, Y + S / 2, S * 0.15, 0, 7); c.fillStyle = '#e74c3c'; c.fill(); }
      if (box[y][x]) { rr(c, X + 6, Y + 6, S - 12, S - 12, 10, goal[y][x] ? '#7bd389' : '#d4a256', '#7a5a2a', 4); }
    }));
    text(c, '🧑', X0 + px * S + S / 2, Y0 + py * S + S / 2, S * 0.7);
    rr(c, 60, 1090, 270, 90, 24, '#c9cdf0'); text(c, '撤销', 195, 1135, 40, '#3d3226'); rr(c, 390, 1090, 270, 90, 24, '#c9cdf0'); text(c, '重来', 525, 1135, 40, '#3d3226');
  },
});
