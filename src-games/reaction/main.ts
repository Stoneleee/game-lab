import { run, text, rnd } from '../_lib/engine';
const ROUNDS = 5;
let st: 'wait' | 'go' | 'res' = 'wait', t = 0, goAt = 0, times: number[] = [], msg = '', resT = 0;
function arm() { st = 'wait'; t = rnd(1.5, 3.8); msg = ''; }
run({
  id: 'reaction', name: '反应测试', bg: '#1b1d2b', accent: '#7bd389',
  help: ['屏幕变绿的一瞬间立刻点击', '变绿前点击算抢跑（记 1000ms）', `共 ${ROUNDS} 轮，看你的平均反应速度`],
  start() { times = []; arm(); },
  down(x, y, g) {
    if (st === 'wait') { times.push(1000); msg = '抢跑了！记 1000ms'; st = 'res'; resT = 1.2; }
    else if (st === 'go') { const ms = Math.round(performance.now() - goAt); times.push(ms); msg = `${ms} ms`; st = 'res'; resT = 1.0; }
  },
  update(dt, g) {
    g.hud(`第 ${Math.min(ROUNDS, times.length + 1)}/${ROUNDS} 轮`);
    if (st === 'wait') { t -= dt; if (t <= 0) { st = 'go'; goAt = performance.now(); } }
    else if (st === 'res') { resT -= dt; if (resT <= 0) { if (times.length >= ROUNDS) { const avg = times.reduce((a, b) => a + b, 0) / times.length; g.score = Math.max(0, Math.round(1000 - avg)); return g.over(`平均 ${Math.round(avg)}ms`); } arm(); } }
  },
  draw(c) {
    c.fillStyle = st === 'go' ? '#2ecc71' : st === 'wait' ? '#c0392b' : '#2c3050'; c.fillRect(0, 100, 720, 1180);
    text(c, st === 'go' ? '点！' : st === 'wait' ? '等它变绿…' : msg, 360, 600, st === 'go' ? 140 : 64, '#fff');
    text(c, times.map(v => v + 'ms').join('  '), 360, 1100, 30, '#ffffffcc', 'center', false);
  },
});
