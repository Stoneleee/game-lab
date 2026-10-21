import { run, rr, circle, shuffle, text, W, PALETTE } from '../_lib/engine';
const CAP = 4, ROUND = 150;
let tubes: number[][] = [], sel = -1, level = 1, tw = 0, positions: [number, number][] = [];
function make() {
  const k = Math.min(8, 2 + level), balls = shuffle([...Array(k).keys()].flatMap(c => Array(CAP).fill(c)));
  tubes = [...Array(k).keys()].map(i => balls.slice(i * CAP, i * CAP + CAP)); tubes.push([], []); sel = -1;
  const n = tubes.length, perRow = Math.ceil(n / (n > 6 ? 2 : 1)); tw = Math.min(110, (W - 60) / perRow);
  positions = tubes.map((_, i) => { const r = Math.floor(i / perRow), q = i % perRow, cnt = Math.min(perRow, n - r * perRow); return [W / 2 + (q - (cnt - 1) / 2) * tw, n > 6 ? 300 + r * 420 : 450]; });
}
const solved = () => tubes.every(t => !t.length || (t.length === CAP && t.every(v => v === t[0])));
run({
  id: 'sort', name: '彩球排序', bg: '#24203a', accent: '#f78fb3',
  help: ['点一根管子选中顶部的球，再点另一根放进去', '只能放到空管或同色球上面', `${ROUND} 秒内整理越多关分越高`],
  start(g) { level = 1; make(); g.hud(`第 1 关`); },
  down(x, y, g) {
    const i = positions.findIndex(([px, py]) => Math.abs(x - px) < tw / 2 && y > py - 40 && y < py + CAP * 70 + 40); if (i < 0) { sel = -1; return; }
    if (sel < 0) { if (tubes[i].length) sel = i; return; }
    if (i !== sel) { const a = tubes[sel], b = tubes[i]; if (b.length < CAP && (!b.length || b[b.length - 1] === a[a.length - 1])) { b.push(a.pop()!); g.add(1); } }
    sel = -1;
    if (solved()) { g.add(100 * level); level++; make(); g.hud(`第 ${level} 关`); }
  },
  update(_dt, g) { if (g.time >= ROUND) g.over('时间到'); },
  draw(c, g) {
    tubes.forEach((t, i) => {
      const [x, y] = positions[i], up = i === sel ? -50 : 0;
      rr(c, x - 38, y - 20, 76, CAP * 70 + 40, 30, '#ffffff18', '#c9cdf0', 4);
      t.forEach((v, k) => { const top = k === t.length - 1; circle(c, x, y + (CAP - 1 - k) * 70 + 40 + (top ? up : 0), 30, PALETTE[v]); });
    });
    text(c, `剩余 ${Math.max(0, Math.ceil(ROUND - g.time))} 秒`, W / 2, 1180, 36, '#f78fb3');
  },
});
