import { run, circle, rr, ri, text } from '../_lib/engine';
type P = { y: number; seg: number[]; passed: boolean };
let s = 0, by = 0, vy = 0, cam = 0, plats: P[] = [], lastX = 0, drag = false, n = 0, combo = 0;
const idx = (x: number) => Math.floor(((((x - s) % 720) + 720) % 720) / 90);
function mk(y: number): P {
  const seg = Array(8).fill(0); const gap = ri(0, 7); seg[gap] = 1; if (Math.random() < 0.3) seg[(gap + 1) % 8] = 1;
  if (n > 0) { const nd = Math.min(4, 1 + Math.floor(n / 6)); for (let k = 0; k < nd; k++) { const j = ri(0, 7); if (seg[j] === 0) seg[j] = 2; } }
  n++; return { y, seg, passed: false };
}
run({
  id: 'helix', name: '螺旋跳跳', bg: '#24304f', accent: '#ffc857',
  help: ['左右拖动屏幕，平台跟着移动', '让小球从缺口掉下去', '碰到红色平台就失败'],
  start() { s = 0; by = 300; vy = 0; cam = 0; plats = []; n = 0; combo = 0; for (let i = 0; i < 8; i++) plats.push(mk(520 + i * 260)); },
  down(x) { drag = true; lastX = x; },
  move(x) { if (drag) { s += x - lastX; lastX = x; } },
  up() { drag = false; },
  key(k) { if (k === 'ArrowLeft') s -= 45; if (k === 'ArrowRight') s += 45; },
  update(dt, g) {
    vy += 1800 * dt; let ny = by + vy * dt;
    for (const p of plats) {
      if (by + 20 <= p.y && ny + 20 >= p.y) {
        const t = p.seg[idx(360)];
        if (t === 1) { if (!p.passed) { p.passed = true; combo++; g.add(combo); } }
        else if (t === 2 && combo < 3) return g.over('碰到红色了');
        else { ny = p.y - 20; vy = -820; combo = 0; }
      }
    }
    by = ny; cam = Math.max(cam, by - 450);
    while (plats[plats.length - 1].y < cam + 1500) plats.push(mk(plats[plats.length - 1].y + 260));
    plats = plats.filter(p => p.y > cam - 100);
  },
  draw(c) {
    rr(c, 330, 110, 60, 1170, 20, '#3a4a75');
    for (const p of plats) {
      const y = p.y - cam;
      for (let k = 0; k < 8; k++) {
        if (p.seg[k] === 1) continue;
        const x = (((k * 90 + s) % 720) + 720) % 720;
        for (const xx of [x, x - 720]) rr(c, xx + 2, y, 86, 30, 8, p.seg[k] === 2 ? '#ff4f5e' : '#7bd3c9');
      }
    }
    circle(c, 360, by - cam, 20, '#ffc857');
    if (combo >= 3) text(c, '冲刺！', 360, 200, 44, '#ff9f43');
  },
});
