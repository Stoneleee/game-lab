import { run, rr, text, ri } from '../_lib/engine';
const LIMIT = 60;
let n = 2, odd = 0, base = '', diff = '', lvl = 0, pen = 0;
function gen() { n = Math.min(9, 2 + Math.floor(lvl / 3)); odd = ri(0, n * n - 1); const h = ri(0, 359), s = ri(45, 80), l = ri(40, 65), d = Math.max(4, 22 - lvl * 0.8); base = `hsl(${h},${s}%,${l}%)`; diff = `hsl(${h},${s}%,${l + d}%)`; }
run({
  id: 'findcolor', name: '找色块', bg: '#1f2235', accent: '#ffc857',
  help: ['一堆色块里有一块颜色不一样', '快点找出来点它', `点错扣 3 秒，${LIMIT} 秒限时`],
  start() { lvl = 0; pen = 0; gen(); },
  down(x, y, g) { const S = 640 / n, cx = Math.floor((x - 40) / S), cy = Math.floor((y - 300) / S); if (cx < 0 || cy < 0 || cx >= n || cy >= n) return; if (cy * n + cx === odd) { lvl++; g.add(1); gen(); } else pen += 3; },
  update(dt, g) { const left = LIMIT - g.time - pen; g.hud(`${Math.max(0, Math.ceil(left))}s`); if (left <= 0) g.over('时间到'); },
  draw(c) { const S = 640 / n; for (let i = 0; i < n * n; i++) rr(c, 40 + (i % n) * S + 4, 300 + Math.floor(i / n) * S + 4, S - 8, S - 8, Math.min(24, S / 5), i === odd ? diff : base); text(c, `第 ${lvl + 1} 关`, 360, 220, 44, '#fff'); },
});
