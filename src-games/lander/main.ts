import { run, rr, circle, text, rnd } from '../_lib/engine';
const GROUND = 1150;
let x = 0, y = 0, vx = 0, vy = 0, fuel = 0, pad = 0, pw = 0, hold = false, hx = 0, lvl = 1, done = 0, msg = '';
function level() { x = rnd(150, 570); y = 220; vx = rnd(-60, 60); vy = 0; fuel = 100; pw = Math.max(90, 220 - lvl * 20); pad = rnd(40, 680 - pw); done = 0; msg = ''; }
run({
  id: 'lander', name: '登月挑战', bg: '#05060f', accent: '#7bd3c9',
  help: ['按住屏幕点火：按在飞船左边往右推，右边往左推', '慢慢降落到绿色着陆台上', '落地太快或偏离就会坠毁'],
  start() { lvl = 1; level(); },
  down(px) { hold = true; hx = px; }, move(px) { hx = px; }, up() { hold = false; },
  update(dt, g) {
    g.hud(`第 ${lvl} 关 · 燃料 ${Math.ceil(fuel)}`);
    if (done) { done -= dt; if (done <= 0) { lvl++; level(); } return; }
    const g0 = 120 + lvl * 15; vy += g0 * dt;
    if (hold && fuel > 0) { vy -= 300 * dt; vx += Math.max(-1, Math.min(1, (x - hx) / 120)) * 140 * dt; fuel -= 14 * dt; }
    x += vx * dt; y += vy * dt; if (x < 30 || x > 690) { vx *= -0.5; x = Math.max(30, Math.min(690, x)); }
    if (y >= GROUND - 40) {
      const onPad = x > pad + 10 && x < pad + pw - 10;
      if (onPad && vy < 140 && Math.abs(vx) < 70) { const p = 50 + Math.round(fuel) + (vy < 60 ? 30 : 0); g.add(p); msg = `完美着陆 +${p}`; done = 1.4; y = GROUND - 40; vy = vx = 0; }
      else return g.over(onPad ? '降落太快了' : '没对准着陆台');
    }
  },
  draw(c) {
    for (let i = 0; i < 50; i++) circle(c, (i * 137) % 720, 120 + (i * 263) % 1000, 1.5, '#fff8');
    c.fillStyle = '#6b6f80'; c.fillRect(0, GROUND, 720, 130); rr(c, pad, GROUND - 6, pw, 14, 6, '#7bd389');
    const sp = Math.hypot(vx, vy); text(c, `速度 ${Math.round(vy)}`, 120, 170, 30, vy < 140 ? '#7bd389' : '#ff6b6b');
    rr(c, 520, 155, 160, 24, 12, '#333'); rr(c, 520, 155, 1.6 * fuel, 24, 12, '#ffc857');
    if (hold && fuel > 0 && !done) { circle(c, x, y + 52, 14, '#ff9f43'); circle(c, x, y + 70, 9, '#ffd23f'); }
    rr(c, x - 28, y - 30, 56, 50, 16, '#e0e0e0'); circle(c, x, y - 10, 12, '#5bc0ff'); c.strokeStyle = '#ccc'; c.lineWidth = 5; c.beginPath(); c.moveTo(x - 22, y + 18); c.lineTo(x - 36, y + 40); c.moveTo(x + 22, y + 18); c.lineTo(x + 36, y + 40); c.stroke();
    if (msg && done) text(c, msg, 360, 600, 54, '#7bd389'); void sp;
  },
});
