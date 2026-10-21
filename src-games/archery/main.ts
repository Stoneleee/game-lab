import { run, circle, rr, text, rnd } from '../_lib/engine';
const BX = 90, BY = 900, TX = 620, SHOTS = 10;
let left = 0, ty = 600, tv = 0, wind = 0, aiming = false, ax = 0, ay = 0, arrow: { x: number; y: number; vx: number; vy: number } | null = null, stuck: [number, number][] = [], msg = '', msgT = 0;
function newTarget() { ty = rnd(350, 850); tv = (10 - left) > 3 ? rnd(-140, 140) : 0; wind = rnd(-1, 1) * Math.min(150, (SHOTS - left) * 20); stuck = []; }
run({
  id: 'archery', name: '射箭高手', bg: '#bfe3f5', accent: '#e85d75',
  help: ['按住屏幕向后拉弓，松手放箭', '拉得越远射得越远，注意风向', `共 ${SHOTS} 支箭，正中靶心 10 分`],
  start() { left = SHOTS; arrow = null; msg = ''; newTarget(); },
  down(x, y) { if (!arrow && left > 0) { aiming = true; ax = x; ay = y; } },
  move(x, y) { if (aiming) { ax = x; ay = y; } },
  up() { if (!aiming) return; aiming = false; const dx = BX - ax, dy = BY - ay, l = Math.hypot(dx, dy); if (l < 20) return; const p = Math.min(1, l / 350) * 1700; arrow = { x: BX, y: BY, vx: dx / l * p, vy: dy / l * p }; left--; },
  update(dt, g) {
    msgT -= dt; g.hud(`剩 ${left} 支箭`);
    ty += tv * dt; if (ty < 300 || ty > 900) tv *= -1;
    if (!arrow) { if (left <= 0) g.over('箭射完了'); return; }
    arrow.vy += 900 * dt; arrow.vx += wind * dt; arrow.x += arrow.vx * dt; arrow.y += arrow.vy * dt;
    if (arrow.x >= TX - 10 && arrow.vx > 0) {
      const d = Math.abs(arrow.y - ty); if (d < 100) { const p = Math.max(1, 10 - Math.floor(d / 10)); g.add(p); msg = p === 10 ? '正中靶心！' : `+${p}`; stuck.push([TX - 10, arrow.y - ty]); } else msg = '脱靶';
      msgT = 1; arrow = null; setTimeout(() => { if (g.state === 'play') newTarget(); }, 600);
    } else if (arrow.y > 1300 || arrow.x > 760 || arrow.x < -40) { msg = '脱靶'; msgT = 1; arrow = null; newTarget(); }
  },
  draw(c) {
    c.fillStyle = '#7cc46b'; c.fillRect(0, 1050, 720, 230);
    rr(c, TX, ty - 100, 30, 200, 10, '#fff'); for (const [k, col] of [[100, '#fff'], [80, '#222'], [60, '#3a7bd5'], [40, '#ff4f5e'], [20, '#ffd23f']] as [number, string][]) rr(c, TX, ty - k, 30, k * 2, 10, col);
    c.fillStyle = '#7a4a21'; c.fillRect(TX + 10, ty + 100, 10, 1050 - ty - 100);
    for (const [x, y] of stuck) { c.strokeStyle = '#5b3a29'; c.lineWidth = 5; c.beginPath(); c.moveTo(x - 60, ty + y); c.lineTo(x + 10, ty + y); c.stroke(); }
    c.strokeStyle = '#7a4a21'; c.lineWidth = 8; c.beginPath(); c.arc(BX, BY, 70, -1.2, 1.2); c.stroke();
    if (aiming) { const dx = BX - ax, dy = BY - ay, l = Math.hypot(dx, dy) || 1; c.setLineDash([10, 10]); c.strokeStyle = '#0006'; c.lineWidth = 4; c.beginPath(); c.moveTo(BX, BY); c.lineTo(BX + dx / l * 160, BY + dy / l * 160); c.stroke(); c.setLineDash([]); }
    if (arrow) { const a = Math.atan2(arrow.vy, arrow.vx); c.save(); c.translate(arrow.x, arrow.y); c.rotate(a); c.fillStyle = '#5b3a29'; c.fillRect(-60, -3, 60, 6); c.fillStyle = '#ccc'; c.beginPath(); c.moveTo(12, 0); c.lineTo(-4, -8); c.lineTo(-4, 8); c.fill(); c.restore(); }
    text(c, `风 ${wind > 5 ? '→' : wind < -5 ? '←' : '·'} ${Math.abs(Math.round(wind / 15))}`, 360, 180, 36, '#2b4a6b');
    if (msgT > 0) text(c, msg, 360, 260, 52, '#e85d75');
  },
});
