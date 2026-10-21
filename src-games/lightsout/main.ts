import { run, rr, text, ri } from '../_lib/engine';
const N = 5, S = 120, X0 = 60, Y0 = 330, LIMIT = 150;
let on: boolean[] = [], lvl = 1, taps = 0;
function press(i: number) { const x = i % N, y = Math.floor(i / N); for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < N && ny < N) on[ny * N + nx] = !on[ny * N + nx]; } }
function gen() { on = Array(N * N).fill(false); const k = Math.min(12, 2 + lvl); for (let i = 0; i < k; i++) press(ri(0, N * N - 1)); if (!on.some(Boolean)) press(12); taps = 0; }
run({
  id: 'lightsout', name: '关灯游戏', bg: '#1a1c2c', accent: '#ffe14d',
  help: ['点一下灯，它和上下左右的灯都会切换', '把所有灯都关掉进入下一关', `${LIMIT} 秒内过的关越多越好`],
  start() { lvl = 1; gen(); },
  down(x, y, g) {
    const cx = Math.floor((x - X0) / S), cy = Math.floor((y - Y0) / S); if (cx < 0 || cy < 0 || cx >= N || cy >= N) return;
    press(cy * N + cx); taps++;
    if (!on.some(Boolean)) { g.add(lvl * 10 + Math.max(0, 20 - taps)); lvl++; gen(); }
  },
  update(dt, g) { const left = LIMIT - g.time; g.hud(`第 ${lvl} 关 · ${Math.max(0, Math.ceil(left))}s`); if (left <= 0) g.over('时间到'); },
  draw(c) {
    on.forEach((v, i) => { const x = X0 + (i % N) * S, y = Y0 + Math.floor(i / N) * S; rr(c, x + 8, y + 8, S - 16, S - 16, 20, v ? '#ffe14d' : '#2e3150', v ? '#fff6' : undefined); });
    text(c, `第 ${lvl} 关 · 已点 ${taps} 次`, 360, Y0 + N * S + 70, 34, '#c9cdf0', 'center', false);
  },
});
