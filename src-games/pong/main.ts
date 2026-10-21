import { run, circle, rr, text } from '../_lib/engine';
const PW = 150, PH = 22, TOPY = 170, BOTY = 1180;
let px = 360, ax = 360, bx = 360, by = 640, vx = 0, vy = 0, ai = 0, serve = 0, sp = 700;
function serveBall(dir: number) { bx = 360; by = 680; sp = 700; const a = (Math.random() - 0.5) * 0.8; vx = Math.sin(a) * sp; vy = Math.cos(a) * sp * dir; serve = 0.8; }
run({
  id: 'pong', name: '乒乓对战', bg: '#0f2a3d', accent: '#7bd3c9',
  help: ['左右拖动控制下方球拍', '把球打回去让电脑接不到', '电脑先得 5 分游戏结束'],
  start() { px = ax = 360; ai = 0; serveBall(1); },
  down(x) { px = x; }, move(x) { px = Math.max(PW / 2, Math.min(720 - PW / 2, x)); },
  key(k) { if (k === 'ArrowLeft') px = Math.max(PW / 2, px - 50); if (k === 'ArrowRight') px = Math.min(720 - PW / 2, px + 50); },
  update(dt, g) {
    g.hud(`你 ${g.score} : ${ai} 电脑`);
    const aiSp = 380 + g.score * 25; ax += Math.max(-aiSp * dt, Math.min(aiSp * dt, (vy < 0 ? bx : 360) - ax));
    if (serve > 0) { serve -= dt; return; }
    bx += vx * dt; by += vy * dt;
    if (bx < 16 || bx > 704) { vx *= -1; bx = Math.max(16, Math.min(704, bx)); }
    const hit = (pxx: number, py: number, dir: number) => { if (Math.abs(bx - pxx) < PW / 2 + 16 && Math.abs(by - py) < 26 && Math.sign(vy) === -dir) { sp = Math.min(1500, sp * 1.06); const off = (bx - pxx) / (PW / 2); vx = off * sp * 0.75; vy = dir * Math.sqrt(Math.max(1, sp * sp - vx * vx)); } };
    hit(px, BOTY, -1); hit(ax, TOPY, 1);
    if (by < TOPY - 60) { g.add(1); serveBall(-1); }
    if (by > BOTY + 60) { ai++; if (ai >= 5) return g.over('电脑赢了'); serveBall(1); }
  },
  draw(c) {
    c.setLineDash([20, 20]); c.strokeStyle = '#ffffff33'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 675); c.lineTo(720, 675); c.stroke(); c.setLineDash([]);
    rr(c, ax - PW / 2, TOPY - PH / 2, PW, PH, 11, '#ff6b6b'); rr(c, px - PW / 2, BOTY - PH / 2, PW, PH, 11, '#7bd3c9');
    circle(c, bx, by, 16, '#fff');
  },
});
