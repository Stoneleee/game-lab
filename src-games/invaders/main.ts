import { run, circle, rr, text, pick } from '../_lib/engine';
type O = { x: number; y: number; alive: boolean; t: number };
let al: O[] = [], dir = 1, sp = 50, px = 360, shot: { x: number; y: number } | null = null, eb: { x: number; y: number }[] = [], lives = 3, wave = 1, efire = 0, inv = 0;
function newWave() { al = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) al.push({ x: 110 + c * 72, y: 220 + r * 64, alive: true, t: r }); dir = 1; sp = 40 + wave * 15; eb = []; }
run({
  id: 'invaders', name: '太空侵略者', bg: '#0a0a18', accent: '#7bd389',
  help: ['左右拖动移动炮台，自动发射', '消灭所有外星人进入下一波', '别让它们降落到地面'],
  start() { wave = 1; lives = 3; px = 360; shot = null; newWave(); },
  down(x) { px = x; }, move(x) { px = Math.max(40, Math.min(680, x)); },
  key(k) { if (k === 'ArrowLeft') px = Math.max(40, px - 40); if (k === 'ArrowRight') px = Math.min(680, px + 40); },
  update(dt, g) {
    g.hud(`❤️ ${lives}  第 ${wave} 波`); inv -= dt;
    const live = al.filter(a => a.alive); const v = sp * (1 + (40 - live.length) / 12);
    let edge = false; for (const a of live) { a.x += dir * v * dt; if (a.x < 40 || a.x > 680) edge = true; }
    if (edge) { dir *= -1; for (const a of live) { a.y += 30; a.x += dir * 4; } }
    if (live.some(a => a.y > 1080)) return g.over('外星人登陆了');
    if (!shot) shot = { x: px, y: 1120 }; else { shot.y -= 1100 * dt; const h = live.find(a => Math.abs(a.x - shot!.x) < 28 && Math.abs(a.y - shot!.y) < 24); if (h) { h.alive = false; g.add(5 - h.t); shot = null; } else if (shot.y < 120) shot = null; }
    efire -= dt; if (efire <= 0 && live.length) { efire = Math.max(0.35, 1.2 - wave * 0.1); const s = pick(live); eb.push({ x: s.x, y: s.y }); }
    for (const b of eb) b.y += 420 * dt;
    if (inv <= 0 && eb.some(b => Math.abs(b.x - px) < 34 && Math.abs(b.y - 1150) < 26)) { lives--; inv = 1.2; eb = []; if (lives <= 0) return g.over('炮台被击毁'); }
    eb = eb.filter(b => b.y < 1280);
    if (!live.length) { wave++; g.add(20); newWave(); }
  },
  draw(c, g) {
    const f = Math.floor(g.time * 3) % 2;
    for (const a of al) if (a.alive) { const col = ['#ff6b6b', '#ff9f43', '#ffc857', '#7bd389', '#5bc0ff'][a.t]; rr(c, a.x - 24, a.y - 16, 48, 30, 8, col); circle(c, a.x - 10, a.y - 4, 5, '#000'); circle(c, a.x + 10, a.y - 4, 5, '#000'); c.fillStyle = col; c.fillRect(a.x - 24 + (f ? 0 : 4), a.y + 12, 8, 10); c.fillRect(a.x + 16 - (f ? 0 : 4), a.y + 12, 8, 10); }
    if (shot) rr(c, shot.x - 3, shot.y - 14, 6, 28, 3, '#fff');
    for (const b of eb) rr(c, b.x - 4, b.y - 10, 8, 20, 3, '#ff4f5e');
    if (inv <= 0 || f) { rr(c, px - 34, 1140, 68, 26, 6, '#7bd389'); rr(c, px - 6, 1120, 12, 24, 4, '#7bd389'); }
    c.fillStyle = '#7bd38955'; c.fillRect(0, 1180, 720, 4);
  },
});
