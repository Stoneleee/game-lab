import { run, circle, text, rnd } from '../_lib/engine';
type Pl = { x: number; y: number; r: number; c: string; dir: number };
const OR = 95;
let pls: Pl[] = [], cur = 0, a = 0, px = 0, py = 0, vx = 0, vy = 0, flying = false, cam = 0, spd = 2.4;
const C = ['#ff6b6b', '#ffc857', '#4ecdc4', '#b388ff', '#7bd389', '#5b8def'];
function add() { const last = pls[pls.length - 1]; let x; do { x = rnd(150, 570); } while (last && Math.abs(x - last.x) < 120); pls.push({ x, y: last ? last.y - rnd(360, 460) : 1000, r: rnd(35, 55), c: C[pls.length % C.length], dir: Math.random() < 0.5 ? 1 : -1 }); }
function launch() { if (flying) return; const p = pls[cur]; flying = true; const s = OR * spd * p.dir; vx = -Math.sin(a) * s * 2.2; vy = Math.cos(a) * s * 2.2; }
run({
  id: 'orbit', name: '星球跳跃', bg: '#0c0e24', accent: '#ffc857',
  help: ['小飞船绕着星球转圈', '点击屏幕沿切线方向飞出', '飞进下一颗星球的引力圈就能继续'],
  start() { pls = []; for (let i = 0; i < 5; i++) add(); cur = 0; a = 0; flying = false; cam = 0; spd = 2.4; },
  down() { launch(); },
  key(k) { if (k === ' ') launch(); },
  update(dt, g) {
    const p = pls[cur];
    if (!flying) { a += spd * p.dir * dt; px = p.x + Math.cos(a) * OR; py = p.y + Math.sin(a) * OR; }
    else {
      px += vx * dt; py += vy * dt;
      for (let i = cur + 1; i < pls.length; i++) { const q = pls[i]; if (Math.hypot(px - q.x, py - q.y) < OR + 20) { g.add(i - cur); cur = i; a = Math.atan2(py - q.y, px - q.x); flying = false; spd = Math.min(4.2, spd + 0.08); while (pls.length < cur + 5) add(); break; } }
      if (px < -50 || px > 770 || py - cam > 1330 || py - cam < 60) return g.over('迷失在太空');
    }
    cam += ((pls[cur].y - 950) - cam) * Math.min(1, dt * 3);
  },
  draw(c) {
    for (let i = 0; i < 40; i++) circle(c, (i * 173) % 720, ((i * 311) % 1280 - cam * 0.3) % 1280 + (((i * 311) % 1280 - cam * 0.3) % 1280 < 0 ? 1280 : 0), 2, '#ffffff55');
    for (const p of pls) { c.beginPath(); c.arc(p.x, p.y - cam, OR, 0, 7); c.strokeStyle = '#ffffff22'; c.lineWidth = 2; c.setLineDash([8, 10]); c.stroke(); c.setLineDash([]); circle(c, p.x, p.y - cam, p.r, p.c); }
    circle(c, px, py - cam, 14, '#fff'); circle(c, px, py - cam, 6, '#5bc0ff');
  },
});
