import { run, rr, circle, text, shuffle } from '../_lib/engine';
const LIMIT = 180;
let N = 4, S = 150, X0 = 60, Y0 = 330, wall: boolean[] = [], path: number[] = [], startC = 0, drawing = false, lvl = 1;
const nb = (i: number) => { const x = i % N, y = Math.floor(i / N); return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N).map(([a, b]) => b * N + a); };
function gen() {
  N = Math.min(7, 3 + Math.ceil(lvl / 2)); S = Math.floor(600 / N); X0 = (720 - S * N) / 2;
  for (;;) {
    const vis = new Set<number>(); let cur = Math.floor(Math.random() * N * N); const st = cur; vis.add(cur);
    for (;;) { const opts = shuffle(nb(cur).filter(j => !vis.has(j))); if (!opts.length) break; opts.sort((a, b) => nb(a).filter(j => !vis.has(j)).length - nb(b).filter(j => !vis.has(j)).length); cur = Math.random() < 0.85 ? opts[0] : opts[opts.length - 1]; vis.add(cur); }
    if (vis.size >= N * N * 0.8 || (N <= 4 && vis.size >= N * N - 2)) { wall = Array.from({ length: N * N }, (_, i) => !vis.has(i)); startC = st; path = [st]; return; }
  }
}
const cellAt = (x: number, y: number) => { const cx = Math.floor((x - X0) / S), cy = Math.floor((y - Y0) / S); return cx >= 0 && cy >= 0 && cx < N && cy < N ? cy * N + cx : -1; };
function step(i: number, g) {
  if (i < 0 || wall[i]) return; const last = path[path.length - 1];
  if (path.length > 1 && i === path[path.length - 2]) { path.pop(); return; }
  if (path.includes(i) || !nb(last).includes(i)) return;
  path.push(i);
  if (path.length === wall.filter(w => !w).length) { g.add(N * 15); lvl++; gen(); drawing = false; }
}
run({
  id: 'onestroke', name: '一笔画', bg: '#eef3fb', accent: '#5b8def',
  help: ['从带圆点的起点出发拖动画线', '一笔经过所有格子，不能重复', '往回拖可以撤销'],
  start() { lvl = 1; gen(); },
  down(x, y) { const i = cellAt(x, y); if (i === path[path.length - 1]) drawing = true; else if (i === startC) { path = [startC]; drawing = true; } },
  move(x, y, g) { if (drawing) step(cellAt(x, y), g); }, up() { drawing = false; },
  update(dt, g) { const left = LIMIT - g.time; g.hud(`第 ${lvl} 关 · ${Math.max(0, Math.ceil(left))}s`); if (left <= 0) g.over('时间到'); },
  draw(c) {
    for (let i = 0; i < N * N; i++) { const x = X0 + (i % N) * S, y = Y0 + Math.floor(i / N) * S; if (!wall[i]) rr(c, x + 4, y + 4, S - 8, S - 8, 14, path.includes(i) ? '#a9c6ff' : '#fff', '#c9d6ee', 2); }
    c.strokeStyle = '#5b8def'; c.lineWidth = S * 0.25; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
    path.forEach((i, k) => { const x = X0 + (i % N) * S + S / 2, y = Y0 + Math.floor(i / N) * S + S / 2; k ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
    circle(c, X0 + (startC % N) * S + S / 2, Y0 + Math.floor(startC / N) * S + S / 2, S * 0.2, '#e85d75');
    text(c, `第 ${lvl} 关`, 360, 230, 44, '#2b3a5a');
  },
});
