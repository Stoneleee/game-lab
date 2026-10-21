import { run, rr, circle, text, rnd, pick } from '../_lib/engine';
const LX = [180, 360, 540];
let lane = 1, cx = 360, cars: { l: number; y: number; c: string; v: number }[] = [], coins: { l: number; y: number }[] = [], spawn = 0, road = 0, spd = 500, dist = 0, meters = 0;
const mv = (d: number) => { lane = Math.max(0, Math.min(2, lane + d)); };
run({
  id: 'racing', name: '极速狂飙', bg: '#3a3d46', accent: '#ffc857',
  help: ['点击屏幕左/右半边换车道（也可滑动）', '躲开前方车辆，吃金币加分', '速度会越来越快'],
  start() { lane = 1; cx = 360; cars = []; coins = []; spawn = 0.5; spd = 500; dist = 0; meters = 0; },
  down(x) { mv(x < 360 ? -1 : 1); },
  key(k) { if (k === 'ArrowLeft') mv(-1); if (k === 'ArrowRight') mv(1); },
  update(dt, g) {
    spd = 500 + g.time * 12; road = (road + spd * dt) % 160; dist += spd * dt; cx += (LX[lane] - cx) * Math.min(1, dt * 14);
    const m = Math.floor(dist / 200); if (m > meters) { g.add(m - meters); meters = m; }
    spawn -= dt; if (spawn <= 0) { spawn = Math.max(0.35, 0.9 - g.time / 100); const l = Math.floor(Math.random() * 3); cars.push({ l, y: -40, c: pick(['#ff6b6b', '#5b8def', '#7bd389', '#b388ff', '#fff']), v: rnd(0.3, 0.6) }); if (Math.random() < 0.4) coins.push({ l: (l + 1 + Math.floor(Math.random() * 2)) % 3, y: -100 }); }
    for (const c of cars) c.y += spd * c.v * dt; for (const k of coins) k.y += spd * dt;
    if (cars.some(c => Math.abs(LX[c.l] - cx) < 80 && Math.abs(c.y - 1050) < 140)) return g.over('撞车了');
    coins = coins.filter(k => { if (Math.abs(LX[k.l] - cx) < 80 && Math.abs(k.y - 1050) < 80) { g.add(5); return false; } return k.y < 1350; });
    cars = cars.filter(c => c.y < 1400); g.hud(`${Math.round(spd / 5)} km/h`);
  },
  draw(c) {
    c.fillStyle = '#4caf50'; c.fillRect(0, 100, 80, 1180); c.fillRect(640, 100, 80, 1180);
    c.fillStyle = '#fff'; for (let y = -160 + road; y < 1280; y += 160) { c.fillRect(268, y, 8, 80); c.fillRect(448, y, 8, 80); }
    const car = (x: number, y: number, col: string) => { rr(c, x - 50, y - 75, 100, 150, 20, col); rr(c, x - 38, y - 45, 76, 40, 8, '#222c'); rr(c, x - 38, y + 25, 76, 28, 8, '#222c'); };
    for (const k of coins) { circle(c, LX[k.l], k.y, 24, '#ffd23f'); text(c, '¥', LX[k.l], k.y, 28, '#b07800'); }
    for (const o of cars) car(LX[o.l], o.y, o.c);
    car(cx, 1050, '#ffc857');
  },
});
