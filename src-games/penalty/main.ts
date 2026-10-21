import { run, rr, circle, text, rnd } from '../_lib/engine';
const GX = 110, GW = 500, GY = 300, GH = 230, BX0 = 360, BY0 = 1050;
let bx = 0, by = 0, vx = 0, vy = 0, fly = false, kx = 360, kv = 0, dive = 0, kt = 0, miss = 0, msg = '', msgT = 0, sx = 0, sy = 0, shots = 0;
function reset() { bx = BX0; by = BY0; vx = vy = 0; fly = false; kx = 360; dive = 0; }
run({
  id: 'penalty', name: '点球大战', bg: '#2e8b57', accent: '#ffc857',
  help: ['从足球向球门方向快速滑动射门', '滑动方向决定射门角度', '射丢 5 球游戏结束'],
  start() { miss = 0; shots = 0; reset(); },
  down(x, y) { sx = x; sy = y; },
  up(x, y, g) {
    if (fly) return; const dx = x - sx, dy = y - sy; if (dy > -60) return;
    const l = Math.hypot(dx, dy); vx = dx / l * 1500; vy = dy / l * 1500; fly = true; shots++;
    const tx = bx + vx * ((GY + GH / 2 - by) / vy); const lvl = Math.min(0.8, 0.35 + g.score * 0.04);
    dive = Math.random() < lvl ? Math.sign(tx - 360) * Math.min(220, Math.abs(tx - 360)) : rnd(-220, 220);
  },
  update(dt, g) {
    msgT -= dt; g.hud(`进 ${g.score} · 丢 ${miss}/5`); kt += dt;
    if (!fly) { kx = 360 + Math.sin(kt * 2) * 40; return; }
    bx += vx * dt; by += vy * dt; kx += Math.sign(360 + dive - kx) * Math.min(Math.abs(360 + dive - kx), 700 * dt);
    if (by < GY + GH) {
      const inGoal = bx > GX + 20 && bx < GX + GW - 20 && by > GY;
      const saved = Math.abs(bx - kx) < 85 && by < GY + GH && by > GY;
      if (saved) { miss++; msg = '被扑出！'; } else if (inGoal) { if (by < GY + GH - 40) { g.add(1); msg = '球进了！⚽'; } else return; } else { miss++; msg = '射偏了'; }
      msgT = 1; reset(); if (miss >= 5) return g.over('射丢 5 球');
    }
    if (by < 0 || bx < -40 || bx > 760) { miss++; msg = '射偏了'; msgT = 1; reset(); if (miss >= 5) g.over('射丢 5 球'); }
  },
  draw(c) {
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#2e8b57' : '#339966'; c.fillRect(0, 110 + i * 150, 720, 150); }
    c.fillStyle = '#ffffff22'; c.fillRect(GX, GY, GW, GH); c.strokeStyle = '#fff'; c.lineWidth = 10; c.strokeRect(GX, GY, GW, GH + 5);
    c.lineWidth = 2; c.strokeStyle = '#ffffff55'; for (let x = GX; x < GX + GW; x += 30) { c.beginPath(); c.moveTo(x, GY); c.lineTo(x, GY + GH); c.stroke(); }
    rr(c, kx - 70, GY + 90, 140, 120, 30, '#ff6b6b'); circle(c, kx, GY + 70, 32, '#f1c27d');
    c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.arc(360, BY0, 110, Math.PI, 0); c.stroke();
    circle(c, bx, by, 26, '#fff'); circle(c, bx, by, 9, '#222');
    if (msgT > 0) text(c, msg, 360, 700, 64, '#fff');
    else if (!fly) text(c, '↑ 向上滑动射门', 360, 1180, 32, '#ffffffaa', 'center', false);
  },
});
