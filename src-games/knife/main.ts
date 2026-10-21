import { run, circle, rr, text, rnd } from '../_lib/engine';
const CX = 360, CY = 430, R = 130;
let rot = 0, spd = 2, stuck: number[] = [], left = 0, lvl = 1, fly = -1, tt = 0;
function level() { stuck = []; const n = Math.min(4, lvl - 1); for (let i = 0; i < n; i++) stuck.push(rnd(0, 6.28)); left = 5 + lvl; spd = 1.5 + lvl * 0.3; fly = -1; }
function knife(c: CanvasRenderingContext2D) { rr(c, -8, 0, 16, 90, 4, '#dfe6ee'); rr(c, -11, 90, 22, 70, 6, '#5b3a29'); }
run({
  id: 'knife', name: '飞刀达人', bg: '#2b1d1d', accent: '#ffc857',
  help: ['点击屏幕扔出飞刀', '让飞刀插进旋转的木桩', '碰到已插的飞刀就失败'],
  start() { lvl = 1; rot = 0; tt = 0; level(); },
  down() { if (fly < 0) fly = 1100; },
  key(k) { if (k === ' ' && fly < 0) fly = 1100; },
  update(dt, g) {
    tt += dt; const s = lvl % 3 === 0 ? spd * Math.sin(tt * 1.2) * 1.6 : spd; rot += s * dt;
    if (fly >= 0) {
      fly -= 2600 * dt;
      if (fly <= CY + R) {
        const a = (((Math.PI / 2 - rot) % 6.2832) + 6.2832) % 6.2832;
        if (stuck.some(k => { const d = Math.abs(k - a); return Math.min(d, 6.2832 - d) < 0.22; })) return g.over('撞刀了');
        stuck.push(a); fly = -1; left--; g.add(1);
        if (left <= 0) { lvl++; g.add(5); level(); }
      }
    }
    g.hud(`第 ${lvl} 关 · 剩 ${left} 把`);
  },
  draw(c) {
    for (const k of stuck) { const a = k + rot; c.save(); c.translate(CX + Math.cos(a) * R, CY + Math.sin(a) * R); c.rotate(a - Math.PI / 2); knife(c); c.restore(); }
    circle(c, CX, CY, R, '#a0522d'); circle(c, CX, CY, R - 25, '#c97b5b'); circle(c, CX, CY, 20, '#7a3e1d');
    c.save(); c.translate(CX, fly >= 0 ? fly : 1100); knife(c); c.restore();
    for (let i = 0; i < left - 1; i++) rr(c, 40, 1220 - i * 36, 50, 14, 4, '#dfe6ee');
    text(c, `第 ${lvl} 关`, CX, 200, 40, '#ffc857');
  },
});
