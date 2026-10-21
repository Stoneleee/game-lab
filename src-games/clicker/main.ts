import { run, rr, text, circle, W, inBox } from '../_lib/engine';
const ROUND = 90;
let coins = 0, tap = 1, auto = 0, cTap = 10, cAuto = 15, pops: { x: number; y: number; t: number; s: string }[] = [], bob = 0;
const fmt = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.floor(n));
run({
  id: 'clicker', name: '摸鱼大师', bg: '#e8f4ff', accent: '#ff9f43',
  help: ['疯狂点击屏幕中间的大鱼赚摸鱼币', '用币升级「点击力」和「自动摸鱼」', `一局 ${ROUND} 秒，累计赚得越多分越高`],
  start(g) { coins = 0; tap = 1; auto = 0; cTap = 10; cAuto = 15; pops = []; g.hud(`剩余 ${ROUND}s`); },
  down(x, y, g) {
    if (Math.hypot(x - W / 2, y - 480) < 200) { coins += tap; g.add(tap); bob = 0.12; pops.push({ x, y, t: 0.8, s: '+' + fmt(tap) }); return; }
    if (inBox(x, y, 60, 860, 600, 130) && coins >= cTap) { coins -= cTap; tap = Math.ceil(tap * 1.6 + 1); cTap = Math.ceil(cTap * 2.2); }
    if (inBox(x, y, 60, 1020, 600, 130) && coins >= cAuto) { coins -= cAuto; auto = Math.ceil(auto * 1.5 + 2); cAuto = Math.ceil(cAuto * 2.1); }
  },
  key(k, g) { if (k === ' ') (this as any).down(W / 2, 480, g); },
  update(dt, g) {
    coins += auto * dt; g.score += auto * dt; bob = Math.max(0, bob - dt);
    pops.forEach(p => { p.t -= dt; p.y -= 120 * dt; }); pops = pops.filter(p => p.t > 0);
    const left = Math.max(0, ROUND - g.time); g.hud(`剩余 ${Math.ceil(left)}s`); if (left <= 0) g.over('下班啦');
  },
  draw(c, g) {
    text(c, `🪙 ${fmt(coins)}`, W / 2, 190, 64, '#ff9f43');
    text(c, `每次点击 +${fmt(tap)}   ·   每秒自动 +${fmt(auto)}`, W / 2, 260, 28, '#5a6b85', 'center', false);
    const s = 1 - bob; c.save(); c.translate(W / 2, 480); c.scale(s, s);
    circle(c, 0, 0, 190, '#cfe6ff');
    c.fillStyle = '#ff9f43'; c.beginPath(); c.ellipse(-20, 0, 130, 80, 0, 0, 7); c.fill();
    c.beginPath(); c.moveTo(90, 0); c.lineTo(170, -70); c.lineTo(170, 70); c.closePath(); c.fill();
    circle(c, -90, -20, 18, '#fff'); circle(c, -94, -20, 9, '#222'); c.restore();
    text(c, '点我摸鱼', W / 2, 720, 34, '#5a6b85');
    pops.forEach(p => { c.globalAlpha = p.t; text(c, p.s, p.x, p.y, 40, '#ff6b6b'); c.globalAlpha = 1; });
    rr(c, 60, 860, 600, 130, 24, coins >= cTap ? '#ffc857' : '#d6dbe6'); text(c, `升级点击力  (${fmt(cTap)} 币)`, W / 2, 925, 38, '#1b1d2b');
    rr(c, 60, 1020, 600, 130, 24, coins >= cAuto ? '#7bd389' : '#d6dbe6'); text(c, `雇人自动摸鱼  (${fmt(cAuto)} 币)`, W / 2, 1085, 38, '#1b1d2b');
    void g;
  },
});
