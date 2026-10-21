import { run, circle, rr, text, rnd, pick, W, H } from '../_lib/engine';
type O = { x: number; y: number; vx: number; vy: number; hp: number; r: number; t: number };
let sx = 360, bullets: O[] = [], foes: O[] = [], eb: O[] = [], fire = 0, spawn = 0, lives = 3, inv = 0, stars: number[][] = [], boom: O[] = [];
run({
  id: 'shooter', name: '星际射击', bg: '#070a1a', accent: '#5bc0ff',
  help: ['按住拖动控制飞船左右移动', '飞船会自动开火', '躲开敌人和子弹，3 条命'],
  start(g) { sx = 360; bullets = []; foes = []; eb = []; boom = []; fire = 0; spawn = 1; lives = 3; inv = 0; stars = Array.from({ length: 60 }, () => [rnd(0, W), rnd(0, H), rnd(1, 3)]); },
  down(x) { sx = x; }, move(x) { sx = Math.max(40, Math.min(W - 40, x)); },
  key(k) { if (k === 'ArrowLeft') sx = Math.max(40, sx - 40); if (k === 'ArrowRight') sx = Math.min(W - 40, sx + 40); },
  update(dt, g) {
    const t = g.time; inv -= dt; g.hud(`❤️ ${lives}`);
    for (const s of stars) { s[1] += s[2] * 60 * dt; if (s[1] > H) s[1] = 0; }
    fire -= dt; if (fire <= 0) { fire = 0.18; bullets.push({ x: sx, y: 1100, vx: 0, vy: -1100, hp: 1, r: 6, t: 0 }); }
    spawn -= dt; if (spawn <= 0) { spawn = Math.max(0.3, 1.1 - t / 80); const big = Math.random() < 0.15; foes.push({ x: rnd(60, W - 60), y: 80, vx: rnd(-60, 60), vy: rnd(140, 220) + t * 2, hp: big ? 5 : 1, r: big ? 46 : 28, t: rnd(0.5, 2) }); }
    for (const b of bullets) b.y += b.vy * dt;
    for (const f of foes) { f.x += f.vx * dt; f.y += f.vy * dt; if (f.x < 40 || f.x > W - 40) f.vx *= -1; f.t -= dt; if (f.t <= 0 && f.y < 900) { f.t = rnd(1.2, 2.5); eb.push({ x: f.x, y: f.y, vx: (sx - f.x) * 0.4, vy: 380, hp: 1, r: 8, t: 0 }); } }
    for (const e of eb) { e.x += e.vx * dt; e.y += e.vy * dt; }
    for (const b of bullets) for (const f of foes) if (f.hp > 0 && b.hp > 0 && Math.hypot(b.x - f.x, b.y - f.y) < f.r + 6) { b.hp = 0; f.hp--; if (f.hp <= 0) { g.add(f.r > 40 ? 5 : 1); boom.push({ x: f.x, y: f.y, vx: 0, vy: 0, hp: 1, r: f.r, t: 0.3 }); } }
    for (const bm of boom) bm.t -= dt;
    const hitMe = (o: O) => Math.hypot(o.x - sx, o.y - 1130) < o.r + 26;
    if (inv <= 0 && (foes.some(f => f.hp > 0 && hitMe(f)) || eb.some(hitMe))) { lives--; inv = 1.5; eb = []; foes = foes.filter(f => !hitMe(f)); if (lives <= 0) return g.over('飞船被击毁'); }
    bullets = bullets.filter(b => b.hp > 0 && b.y > 100); foes = foes.filter(f => f.hp > 0 && f.y < H + 60); eb = eb.filter(e => e.y < H); boom = boom.filter(b => b.t > 0);
  },
  draw(c, g) {
    for (const s of stars) circle(c, s[0], s[1], s[2], '#ffffff88');
    for (const b of bullets) rr(c, b.x - 4, b.y - 14, 8, 28, 4, '#5bc0ff');
    for (const f of foes) { circle(c, f.x, f.y, f.r, f.r > 40 ? '#b388ff' : '#ff6b6b'); circle(c, f.x, f.y + 4, f.r * 0.4, '#1b1d2b'); }
    for (const e of eb) circle(c, e.x, e.y, 8, '#ffc857');
    for (const b of boom) circle(c, b.x, b.y, b.r * (1.6 - b.t * 2), `rgba(255,200,80,${b.t * 3})`);
    if (inv <= 0 || Math.floor(g.time * 10) % 2) { c.beginPath(); c.moveTo(sx, 1090); c.lineTo(sx - 34, 1170); c.lineTo(sx + 34, 1170); c.closePath(); c.fillStyle = '#e0f0ff'; c.fill(); circle(c, sx, 1140, 10, '#5bc0ff'); }
  },
});
