import { run, rr, text, rnd, pick, W } from '../_lib/engine';
type I = { x: number; y: number; v: number; e: string; bad: boolean };
const GOOD = ['🍎', '🍊', '🍌', '🍓', '🍇', '🍒', '🥭'];
let bx = 360, items: I[] = [], spawn = 0, lives = 3, flash = 0;
run({
  id: 'catch', name: '接水果', bg: '#ffe9c7', accent: '#e85d75',
  help: ['左右拖动篮子接住水果', '躲开炸弹 💣，接到扣一条命', '越往后掉得越快'],
  start() { bx = 360; items = []; spawn = 0.5; lives = 3; },
  down(x) { bx = x; }, move(x) { bx = Math.max(70, Math.min(W - 70, x)); },
  key(k) { if (k === 'ArrowLeft') bx = Math.max(70, bx - 50); if (k === 'ArrowRight') bx = Math.min(W - 70, bx + 50); },
  update(dt, g) {
    g.hud(`❤️ ${lives}`); flash -= dt; spawn -= dt;
    if (spawn <= 0) { spawn = Math.max(0.3, 0.9 - g.time / 90); const bad = Math.random() < Math.min(0.35, 0.15 + g.time / 300); items.push({ x: rnd(50, W - 50), y: 100, v: rnd(280, 380) + g.time * 5, e: bad ? '💣' : pick(GOOD), bad }); }
    for (const it of items) it.y += it.v * dt;
    for (const it of items) if (it.y > 1080 && it.y < 1160 && Math.abs(it.x - bx) < 85) { it.y = 2000; if (it.bad) { lives--; flash = 0.3; if (lives <= 0) return g.over('接到炸弹了'); } else g.add(1); }
    items = items.filter(it => it.y < 1300);
  },
  draw(c) {
    if (flash > 0) { c.fillStyle = '#ff4f5e55'; c.fillRect(0, 100, 720, 1180); }
    for (const it of items) text(c, it.e, it.x, it.y, 70);
    rr(c, bx - 80, 1110, 160, 80, 20, '#a0522d'); rr(c, bx - 90, 1100, 180, 22, 10, '#7a3e1d');
  },
});
