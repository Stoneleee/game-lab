import { run, circle, text, rnd, pick, W, H } from '../_lib/engine';
const FR = ['🍉', '🍎', '🍊', '🍋', '🍑', '🍍', '🥝', '🍇'];
type F = { x: number; y: number; vx: number; vy: number; e: string; bomb: boolean; cut: boolean; r: number; a: number };
let fs: F[] = [], spawn = 0, lives = 3, lx = -1, ly = -1, trail: { x: number; y: number; t: number }[] = [], combo = 0, comboT = 0;
function segHit(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number) { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / l)); return Math.hypot(ax + dx * t - cx, ay + dy * t - cy) < r; }
function cut(x: number, y: number, g) {
  if (lx >= 0) for (const f of fs) if (!f.cut && segHit(lx, ly, x, y, f.x, f.y, f.r)) { f.cut = true; if (f.bomb) return g.over('切到炸弹了'); combo++; comboT = 0.3; g.add(combo > 2 ? 2 : 1); }
  trail.push({ x, y, t: 0.15 }); lx = x; ly = y;
}
run({
  id: 'slice', name: '切水果', bg: '#3b2a1d', accent: '#ffc857',
  help: ['手指划过屏幕切开水果', '千万别切到炸弹 💣', '漏掉 3 个水果游戏结束'],
  start() { fs = []; spawn = 0.5; lives = 3; trail = []; lx = -1; combo = 0; },
  down(x, y) { lx = x; ly = y; }, move(x, y, g) { if (lx >= 0) cut(x, y, g); }, up() { lx = -1; },
  update(dt, g) {
    g.hud(`❤️ ${lives}`); spawn -= dt; comboT -= dt; if (comboT <= 0) combo = 0;
    if (spawn <= 0) { spawn = Math.max(0.45, 1.3 - g.time / 60); const n = Math.random() < 0.3 ? 3 : 1; for (let i = 0; i < n; i++) { const x = rnd(120, W - 120); fs.push({ x, y: H + 60, vx: (360 - x) * rnd(0.3, 0.8), vy: -rnd(1250, 1500), e: pick(FR), bomb: Math.random() < Math.min(0.25, 0.08 + g.time / 400), cut: false, r: 60, a: 0 }); } }
    for (const f of fs) { f.vy += 1200 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.a += dt * 3; }
    const lost = fs.filter(f => f.y > H + 80 && f.vy > 0 && !f.cut && !f.bomb).length; if (lost) { lives -= lost; if (lives <= 0) return g.over('漏掉太多'); }
    fs = fs.filter(f => !(f.y > H + 80 && f.vy > 0)); for (const t of trail) t.t -= dt; trail = trail.filter(t => t.t > 0);
  },
  draw(c) {
    for (const f of fs) { c.save(); c.translate(f.x, f.y); c.rotate(f.a); if (f.cut && !f.bomb) { c.globalAlpha = 0.5; text(c, f.e, -25, 0, 80); text(c, f.e, 25, 10, 80); } else text(c, f.bomb ? '💣' : f.e, 0, 0, 100); c.restore(); }
    c.lineWidth = 10; c.lineCap = 'round'; c.strokeStyle = '#fffbe6'; c.beginPath(); trail.forEach((t, i) => i ? c.lineTo(t.x, t.y) : c.moveTo(t.x, t.y)); c.stroke();
    if (combo > 2) text(c, `${combo} 连切！`, 360, 220, 48, '#ffc857');
  },
});
