import { run, circle, text, H } from '../_lib/engine';
const COLS = ['#ff4f7b', '#ffd23f', '#3ee8b5', '#8e5bff'], R = 150, T = 26, TAU = Math.PI * 2;
type Ring = { y: number; rot: number; sp: number; passed: boolean; sw: boolean };
let by = 0, vy = 0, col = 0, cam = 0, rings: Ring[] = [], started = false, n = 0;
function addRing(y: number) { n++; rings.push({ y, rot: Math.random() * TAU, sp: (Math.random() < 0.5 ? -1 : 1) * (1.1 + Math.min(1.5, n * 0.06)), passed: false, sw: true }); }
run({
  id: 'colorswitch', name: '变色球', bg: '#151622', accent: '#ffd23f',
  help: ['点击让小球向上跳', '只能穿过和自己同色的圆环部分', '碰到彩色圆点会换颜色'],
  start() { by = 1050; vy = 0; cam = 0; col = 0; rings = []; n = 0; started = false; for (let i = 0; i < 4; i++) addRing(560 - i * 560); },
  down() { vy = -680; started = true; },
  key(k) { if (k === ' ' || k === 'ArrowUp') { vy = -680; started = true; } },
  update(dt, g) {
    if (started) { vy += 1700 * dt; by += vy * dt; }
    cam = Math.min(cam, by - 750);
    if (by - cam > H + 30) return g.over('掉下去了');
    for (const r of rings) {
      r.rot += r.sp * dt; const d = Math.abs(by - r.y);
      if (Math.abs(d - R) < T / 2 + 16) {
        const ang = by < r.y ? -Math.PI / 2 : Math.PI / 2; const a = (((ang - r.rot) % TAU) + TAU) % TAU;
        if (Math.floor(a / (Math.PI / 2)) % 4 !== col) return g.over('颜色不对');
      }
      if (r.sw && Math.abs(by - (r.y + 280)) < 30) { r.sw = false; let k; do { k = Math.floor(Math.random() * 4); } while (k === col); col = k; }
      if (!r.passed && by < r.y - R - 20) { r.passed = true; g.add(1); }
    }
    while (rings[rings.length - 1].y > cam - 700) addRing(rings[rings.length - 1].y - 560);
    rings = rings.filter(r => r.y - cam < H + 600);
  },
  draw(c) {
    for (const r of rings) {
      const y = r.y - cam; c.lineWidth = T;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.strokeStyle = COLS[i]; c.arc(360, y, R, r.rot + i * Math.PI / 2, r.rot + (i + 1) * Math.PI / 2); c.stroke(); }
      if (r.sw) for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(360, y + 280); c.fillStyle = COLS[i]; c.arc(360, y + 280, 22, i * Math.PI / 2, (i + 1) * Math.PI / 2); c.fill(); }
    }
    circle(c, 360, by - cam, 16, COLS[col]);
    if (!started) text(c, '点击开始跳', 360, 1180, 32, '#ffffff88');
  },
});
