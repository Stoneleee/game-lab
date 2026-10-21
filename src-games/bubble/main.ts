import { run, circle, text, pick, ri } from '../_lib/engine';
const R = 34, X0 = 37, Y0 = 150, RY = 59, COLS = ['#ff4f5e', '#ffd23f', '#3ee87b', '#4f8bff', '#c86bff'], MAXR = 15, SX = 360, SY = 1160;
let grid: number[][] = [], par = 0, cur = 0, nxt = 0, ball: { x: number; y: number; vx: number; vy: number } | null = null, shots = 0, aimX = 360, aimY = 600, pops: { x: number; y: number; c: number; t: number }[] = [], nc = 4;
const shifted = (r: number) => (r + par) % 2 === 1, ncol = (r: number) => shifted(r) ? 9 : 10;
const cx = (r: number, c: number) => X0 + c * 68 + (shifted(r) ? 34 : 0), cy = (r: number) => Y0 + r * RY;
const get = (r: number, c: number) => r >= 0 && r < grid.length && c >= 0 && c < ncol(r) ? grid[r][c] : -1;
function nbs(r: number, c: number) { return shifted(r) ? [[r, c - 1], [r, c + 1], [r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]] : [[r, c - 1], [r, c + 1], [r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]]; }
const colorsLeft = () => [...new Set(grid.flat().filter(v => v >= 0))];
const newColor = () => { const l = colorsLeft(); return l.length ? pick(l) : ri(0, nc - 1); };
function addRow() { par = 1 - par; grid.unshift(Array(10).fill(0).map(() => ri(0, nc - 1))); grid.length = Math.min(grid.length, MAXR + 2); for (let c = ncol(0); c < 10; c++) grid[0][c] = -1; }
function settle(r: number, c: number, g) {
  while (grid.length <= r) grid.push(Array(10).fill(-1)); grid[r][c] = cur;
  const col = cur, seen = new Set([r * 10 + c]), q = [[r, c]], grp = [[r, c]];
  while (q.length) { const [a, b] = q.pop()!; for (const [na, nb] of nbs(a, b)) if (get(na, nb) === col && !seen.has(na * 10 + nb)) { seen.add(na * 10 + nb); q.push([na, nb]); grp.push([na, nb]); } }
  if (grp.length >= 3) {
    for (const [a, b] of grp) { pops.push({ x: cx(a, b), y: cy(a), c: col, t: 0.3 }); grid[a][b] = -1; } g.add(grp.length);
    const keep = new Set<number>(), q2: number[][] = []; for (let c2 = 0; c2 < ncol(0); c2++) if (get(0, c2) >= 0) { keep.add(c2); q2.push([0, c2]); }
    while (q2.length) { const [a, b] = q2.pop()!; for (const [na, nb] of nbs(a, b)) if (get(na, nb) >= 0 && !keep.has(na * 10 + nb)) { keep.add(na * 10 + nb); q2.push([na, nb]); } }
    let drop = 0; grid.forEach((row, a) => row.forEach((v, b) => { if (v >= 0 && b < ncol(a) && !keep.has(a * 10 + b)) { pops.push({ x: cx(a, b), y: cy(a), c: v, t: 0.3 }); grid[a][b] = -1; drop++; } })); g.add(drop * 2);
  }
  shots++; if (shots % 6 === 0) addRow();
  if (!colorsLeft().length) { g.add(50); nc = Math.min(5, nc + 1); for (let i = 0; i < 5; i++) addRow(); }
  for (let a = MAXR; a < grid.length; a++) if (grid[a].some((v, b) => v >= 0 && b < ncol(a))) return g.over('泡泡压下来了');
  cur = nxt; nxt = newColor();
}
run({
  id: 'bubble', name: '泡泡龙', bg: '#1c2541', accent: '#ffd23f',
  help: ['按住瞄准，松手发射泡泡', '三个及以上同色泡泡相连就会消除', '泡泡压到底线游戏结束'],
  start() { grid = []; par = 0; nc = 4; shots = 0; pops = []; ball = null; for (let i = 0; i < 6; i++) addRow(); cur = newColor(); nxt = newColor(); },
  down(x, y) { aimX = x; aimY = y; }, move(x, y) { aimX = x; aimY = y; },
  up(x, y) { if (ball) return; let dx = x - SX, dy = Math.min(-40, y - SY); const l = Math.hypot(dx, dy); ball = { x: SX, y: SY, vx: dx / l * 1500, vy: dy / l * 1500 }; },
  update(dt, g) {
    for (const p of pops) p.t -= dt; pops = pops.filter(p => p.t > 0);
    if (!ball) return;
    for (let s = 0; s < 4 && ball; s++) {
      ball.x += ball.vx * dt / 4; ball.y += ball.vy * dt / 4;
      if (ball.x < R + 3) { ball.x = R + 3; ball.vx *= -1; } if (ball.x > 717 - R) { ball.x = 717 - R; ball.vx *= -1; }
      let hit = ball.y < Y0;
      for (let r = 0; r < grid.length && !hit; r++) for (let c = 0; c < ncol(r); c++) if (grid[r][c] >= 0 && Math.hypot(cx(r, c) - ball.x, cy(r) - ball.y) < 58) { hit = true; break; }
      if (hit) {
        let br = 0, bc = 0, bd = 1e9; for (let r = 0; r <= Math.min(MAXR + 1, grid.length); r++) for (let c = 0; c < ncol(r); c++) { if (get(r, c) >= 0) continue; const d = Math.hypot(cx(r, c) - ball.x, cy(r) - ball.y); if (d < bd) { bd = d; br = r; bc = c; } }
        ball = null; settle(br, bc, g);
      }
    }
  },
  draw(c) {
    c.fillStyle = '#ff4f5e55'; c.fillRect(0, cy(MAXR) - R, 720, 4);
    grid.forEach((row, r) => row.forEach((v, cc) => { if (v >= 0 && cc < ncol(r)) { circle(c, cx(r, cc), cy(r), R - 1, COLS[v]); circle(c, cx(r, cc) - 10, cy(r) - 10, 8, '#ffffff66'); } }));
    for (const p of pops) circle(c, p.x, p.y, R * (1 + (0.3 - p.t) * 2), COLS[p.c] + '88');
    if (!ball) { const dx = aimX - SX, dy = Math.min(-40, aimY - SY), l = Math.hypot(dx, dy); c.setLineDash([10, 14]); c.strokeStyle = '#ffffff66'; c.lineWidth = 4; c.beginPath(); c.moveTo(SX, SY); c.lineTo(SX + dx / l * 400, SY + dy / l * 400); c.stroke(); c.setLineDash([]); }
    const b = ball || { x: SX, y: SY }; circle(c, b.x, b.y, R - 1, COLS[cur]); circle(c, 560, 1180, 24, COLS[nxt]); text(c, '下一个', 560, 1230, 24, '#c9cdf0', 'center', false);
  },
});
