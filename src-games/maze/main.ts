import { run, rr, circle, text, shuffle } from '../_lib/engine';
const LIMIT = 180;
let N = 6, S = 100, X0 = 60, Y0 = 300, w: number[] = [], px = 0, py = 0, dir = -1, acc = 0, lvl = 1, trail: number[] = [];
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
function gen() {
  N = Math.min(14, 5 + lvl); S = Math.floor(640 / N); X0 = (720 - S * N) / 2; w = Array(N * N).fill(15);
  const seen = new Set([0]), st = [0];
  while (st.length) { const i = st[st.length - 1], x = i % N, y = Math.floor(i / N); const opts = shuffle([0, 1, 2, 3]).filter(d => { const nx = x + DX[d], ny = y + DY[d]; return nx >= 0 && ny >= 0 && nx < N && ny < N && !seen.has(ny * N + nx); });
    if (!opts.length) { st.pop(); continue; } const d = opts[0], j = (y + DY[d]) * N + x + DX[d]; w[i] &= ~(1 << d); w[j] &= ~(1 << ((d + 2) % 4)); seen.add(j); st.push(j); }
  px = py = 0; dir = -1; trail = [0];
}
const can = (x: number, y: number, d: number) => !(w[y * N + x] & (1 << d));
const openings = (x: number, y: number) => [0, 1, 2, 3].filter(d => can(x, y, d)).length;
run({
  id: 'maze', name: '迷宫逃脱', bg: '#16213e', accent: '#7bd389',
  help: ['滑动屏幕（或方向键）让小球沿通道滚动', '到岔路口会自动停下', '走到右下角的出口进入下一关'],
  start() { lvl = 1; gen(); },
  swipe(d) { const k = { U: 0, R: 1, D: 2, L: 3 }[d]; if (can(px, py, k)) { dir = k; acc = 0; } },
  update(dt, g) {
    const left = LIMIT - g.time; g.hud(`第 ${lvl} 关 · ${Math.max(0, Math.ceil(left))}s`); if (left <= 0) return g.over('时间到');
    if (dir < 0) return; acc += dt;
    while (acc > 0.05 && dir >= 0) { acc -= 0.05; if (!can(px, py, dir)) { dir = -1; break; } px += DX[dir]; py += DY[dir]; trail.push(py * N + px);
      if (px === N - 1 && py === N - 1) { g.add(lvl * 10 + Math.max(0, 30 - Math.floor(g.time / lvl))); lvl++; gen(); return; }
      if (openings(px, py) > 2 || !can(px, py, dir)) { if (openings(px, py) === 2 && !can(px, py, dir)) { const nd = [0, 1, 2, 3].find(d => can(px, py, d) && d !== (dir + 2) % 4)!; dir = nd; } else dir = -1; } }
  },
  draw(c) {
    rr(c, X0, Y0, S * N, S * N, 0, '#1f2b52'); rr(c, X0 + (N - 1) * S + 4, Y0 + (N - 1) * S + 4, S - 8, S - 8, 8, '#7bd38966');
    for (const t of trail) { c.fillStyle = '#5b8def33'; c.fillRect(X0 + (t % N) * S, Y0 + Math.floor(t / N) * S, S, S); }
    c.strokeStyle = '#c9cdf0'; c.lineWidth = 4; c.lineCap = 'round';
    for (let i = 0; i < N * N; i++) { const x = X0 + (i % N) * S, y = Y0 + Math.floor(i / N) * S; c.beginPath(); if (w[i] & 1) { c.moveTo(x, y); c.lineTo(x + S, y); } if (w[i] & 2) { c.moveTo(x + S, y); c.lineTo(x + S, y + S); } if (w[i] & 4) { c.moveTo(x, y + S); c.lineTo(x + S, y + S); } if (w[i] & 8) { c.moveTo(x, y); c.lineTo(x, y + S); } c.stroke(); }
    circle(c, X0 + px * S + S / 2, Y0 + py * S + S / 2, S * 0.32, '#ffc857'); text(c, '出口', X0 + (N - 1) * S + S / 2, Y0 + N * S + 30, 26, '#7bd389', 'center', false);
  },
});
