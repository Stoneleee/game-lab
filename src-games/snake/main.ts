import { run, rr, circle, ri, text, W } from '../_lib/engine';
const C = 36, NX = 19, NY = 28, X0 = (W - NX * C) / 2, Y0 = 150;
let body: [number, number][] = [], dir: [number, number] = [1, 0], nd: [number, number] = [1, 0], food: [number, number] = [0, 0], acc = 0;
function place() { do { food = [ri(0, NX - 1), ri(0, NY - 1)]; } while (body.some(p => p[0] === food[0] && p[1] === food[1])); }
const D = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] } as const;
run({
  id: 'snake', name: '贪吃蛇', bg: '#1d2b1f', accent: '#7bd389',
  help: ['滑动屏幕（或方向键）控制方向', '吃到红果子变长加分', '别撞墙也别咬到自己'],
  start() { body = [[9, 14], [8, 14], [7, 14]]; dir = [1, 0]; nd = [1, 0]; acc = 0; place(); },
  swipe(d) { const v = D[d] as [number, number]; if (v[0] !== -dir[0] || v[1] !== -dir[1]) nd = v; },
  update(dt, g) {
    acc += dt; const step = Math.max(0.06, 0.16 - g.score * 0.002);
    while (acc >= step && g.state === 'play') {
      acc -= step; dir = nd; const h: [number, number] = [body[0][0] + dir[0], body[0][1] + dir[1]];
      if (h[0] < 0 || h[1] < 0 || h[0] >= NX || h[1] >= NY || body.some(p => p[0] === h[0] && p[1] === h[1])) return g.over('撞到了');
      body.unshift(h);
      if (h[0] === food[0] && h[1] === food[1]) { g.add(1); place(); } else body.pop();
    }
  },
  draw(c) {
    rr(c, X0, Y0, NX * C, NY * C, 10, '#24382a');
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) if ((i + j) % 2) c.fillStyle = '#2a4031', c.fillRect(X0 + i * C, Y0 + j * C, C, C);
    circle(c, X0 + food[0] * C + C / 2, Y0 + food[1] * C + C / 2, C / 2 - 3, '#ff6b6b');
    body.forEach((p, i) => rr(c, X0 + p[0] * C + 2, Y0 + p[1] * C + 2, C - 4, C - 4, 8, i ? '#7bd389' : '#c6f5a0'));
    text(c, '滑动转向', W / 2, Y0 + NY * C + 50, 30, '#7bd38999', 'center', false);
  },
});
