import { run, rr, circle, text, rnd } from '../_lib/engine';
type P = { x: number; y: number; t: number; vx: number; gone: boolean };
let px = 360, py = 1000, vy = 0, cam = 0, plats: P[] = [], hold = 0, top = 0, face = 1;
function gen(y: number, h: number) { const t = h > 3000 && Math.random() < 0.25 ? 1 : h > 1500 && Math.random() < 0.15 ? 2 : 0; plats.push({ x: rnd(60, 660), y, t, vx: t === 1 ? rnd(80, 160) : 0, gone: false }); }
run({
  id: 'doodle', name: '跳跳乐', bg: '#f7f3e3', accent: '#e85d75',
  help: ['小人会自动弹跳', '按住屏幕左边或右边控制方向', '绿色平台站稳，棕色一踩就碎'],
  start() { px = 360; py = 1000; vy = -900; cam = 0; top = 0; plats = [{ x: 360, y: 1100, t: 0, vx: 0, gone: false }]; for (let y = 1000; y > -800; y -= rnd(110, 170)) gen(y, 0); },
  down(x) { hold = x < 360 ? -1 : 1; }, move(x) { hold = x < 360 ? -1 : 1; }, up() { hold = 0; },
  key(k) { if (k === 'ArrowLeft') { hold = -1; setTimeout(() => hold = 0, 150); } if (k === 'ArrowRight') { hold = 1; setTimeout(() => hold = 0, 150); } },
  update(dt, g) {
    if (hold) face = hold; px += hold * 520 * dt; if (px < -20) px = 740; if (px > 740) px = -20;
    const oy = py; vy += 1900 * dt; py += vy * dt;
    if (vy > 0) for (const p of plats) if (!p.gone && oy + 30 <= p.y && py + 30 >= p.y && Math.abs(px - p.x) < 70) { if (p.t === 2) { p.gone = true; continue; } vy = -1050; py = p.y - 30; break; }
    for (const p of plats) if (p.t === 1) { p.x += p.vx * dt; if (p.x < 60 || p.x > 660) p.vx *= -1; }
    cam = Math.min(cam, py - 600); const h = Math.round(-cam / 10); if (h > top) { g.add(h - top); top = h; }
    let hi = Math.min(...plats.map(p => p.y)); while (hi > cam - 300) { hi -= rnd(120, 150 + Math.min(80, top / 40)); gen(hi, top * 10); }
    plats = plats.filter(p => p.y < cam + 1400);
    if (py - cam > 1320) g.over('掉下去了');
  },
  draw(c) {
    c.strokeStyle = '#e8e0c4'; c.lineWidth = 2; for (let y = (-cam % 40); y < 1280; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(720, y); c.stroke(); }
    for (const p of plats) if (!p.gone) rr(c, p.x - 60, p.y - cam, 120, 24, 12, p.t === 1 ? '#5bc0ff' : p.t === 2 ? '#a0522d' : '#7bd389');
    const y = py - cam; rr(c, px - 28, y - 30, 56, 60, 20, '#ffc857'); circle(c, px + face * 10, y - 10, 7, '#222');
  },
});
