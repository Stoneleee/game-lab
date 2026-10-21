import { run, circle, rr, text } from '../_lib/engine';
type Rc = [number, number, number, number];
const LV: { b: [number, number]; h: [number, number]; w: Rc[]; par: number }[] = [
  { b: [360, 1100], h: [360, 300], w: [], par: 2 },
  { b: [360, 1100], h: [360, 300], w: [[160, 650, 400, 40]], par: 3 },
  { b: [150, 1100], h: [570, 300], w: [[0, 750, 480, 40], [240, 450, 480, 40]], par: 3 },
  { b: [360, 1100], h: [360, 260], w: [[100, 500, 200, 40], [420, 500, 200, 40], [300, 800, 120, 120]], par: 3 },
  { b: [120, 1100], h: [600, 1100], w: [[300, 400, 60, 860]], par: 3 },
  { b: [360, 1150], h: [360, 250], w: [[80, 900, 160, 40], [480, 900, 160, 40], [260, 650, 200, 40], [80, 420, 160, 40], [480, 420, 160, 40]], par: 4 },
];
const BOX: Rc = [40, 180, 640, 1060];
let lv = 0, bx = 0, by = 0, vx = 0, vy = 0, strokes = 0, aiming = false, ax = 0, ay = 0, sink = 0;
function load() { const L = LV[lv]; [bx, by] = L.b; vx = vy = 0; strokes = 0; sink = 0; }
run({
  id: 'minigolf', name: '迷你高尔夫', bg: '#2d6a4f', accent: '#ffc857',
  help: ['从小球向后拖动瞄准，松手击球', '拖得越远力气越大', '用最少的杆数打进 6 个洞'],
  start() { lv = 0; load(); },
  down(x, y) { if (Math.hypot(vx, vy) < 5 && !sink) { aiming = true; ax = x; ay = y; } },
  move(x, y) { if (aiming) { ax = x; ay = y; } },
  up(x, y) { if (!aiming) return; aiming = false; const dx = bx - x, dy = by - y, l = Math.min(300, Math.hypot(dx, dy)); if (l < 15) return; const k = l * 5.5 / Math.hypot(dx, dy); vx = dx * k; vy = dy * k; strokes++; },
  update(dt, g) {
    const L = LV[lv]; g.hud(`第 ${lv + 1}/6 洞 · ${strokes} 杆 (标准 ${L.par})`);
    if (sink) { sink -= dt; if (sink <= 0) { g.add(Math.max(10, 50 - (strokes - L.par) * 10)); lv++; if (lv >= LV.length) return g.over('打完全场！'); load(); } return; }
    const n = 4; for (let s = 0; s < n; s++) {
      bx += vx * dt / n; by += vy * dt / n;
      if (bx < BOX[0] + 16) { bx = BOX[0] + 16; vx = Math.abs(vx); } if (bx > BOX[0] + BOX[2] - 16) { bx = BOX[0] + BOX[2] - 16; vx = -Math.abs(vx); }
      if (by < BOX[1] + 16) { by = BOX[1] + 16; vy = Math.abs(vy); } if (by > BOX[1] + BOX[3] - 16) { by = BOX[1] + BOX[3] - 16; vy = -Math.abs(vy); }
      for (const [x, y, w, h] of L.w) { const px = Math.max(x, Math.min(x + w, bx)), py = Math.max(y, Math.min(y + h, by)), dx = bx - px, dy = by - py, d = Math.hypot(dx, dy); if (d < 16 && d > 0) { const nx = dx / d, ny = dy / d, dot = vx * nx + vy * ny; if (dot < 0) { vx -= 2 * dot * nx; vy -= 2 * dot * ny; } bx = px + nx * 16; by = py + ny * 16; } }
    }
    const f = Math.pow(0.35, dt); vx *= f; vy *= f; if (Math.hypot(vx, vy) < 8) vx = vy = 0;
    if (Math.hypot(bx - L.h[0], by - L.h[1]) < 24 && Math.hypot(vx, vy) < 700) { sink = 0.6; vx = vy = 0; bx = L.h[0]; by = L.h[1]; }
    if (strokes >= 10 && !vx && !vy && !sink) { sink = 0.6; }
  },
  draw(c) {
    const L = LV[lv] || LV[LV.length - 1]; rr(c, BOX[0] - 12, BOX[1] - 12, BOX[2] + 24, BOX[3] + 24, 20, '#7a4a21'); rr(c, BOX[0], BOX[1], BOX[2], BOX[3], 10, '#52b788');
    for (const [x, y, w, h] of L.w) rr(c, x, y, w, h, 8, '#7a4a21');
    circle(c, L.h[0], L.h[1], 24, '#1b1b1b'); c.fillStyle = '#fff'; c.fillRect(L.h[0] - 2, L.h[1] - 90, 4, 90); c.fillStyle = '#ff4f5e'; c.beginPath(); c.moveTo(L.h[0] + 2, L.h[1] - 90); c.lineTo(L.h[0] + 50, L.h[1] - 75); c.lineTo(L.h[0] + 2, L.h[1] - 60); c.fill();
    if (aiming) { const dx = bx - ax, dy = by - ay; c.strokeStyle = '#ffffffaa'; c.lineWidth = 5; c.setLineDash([12, 10]); c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + dx, by + dy); c.stroke(); c.setLineDash([]); }
    circle(c, bx, by, sink ? 16 * sink / 0.6 : 16, '#fff');
  },
});
