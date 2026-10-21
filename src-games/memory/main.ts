import { run, rr, text, circle, shuffle, W, PALETTE } from '../_lib/engine';
const NX = 4, NY = 5, CW = 150, CH = 170, X0 = (W - NX * CW) / 2, Y0 = 190, ROUND = 90;
let cards: { k: number; open: boolean; done: boolean }[] = [], openIdx: number[] = [], wait = 0, moves = 0;
function icon(c, k: number, x: number, y: number) {
  const col = PALETTE[k % 10]; c.fillStyle = col; c.beginPath();
  const s = k % 5, r = 42;
  if (s === 0) c.arc(x, y, r, 0, 7);
  else if (s === 1) c.rect(x - r, y - r, 2 * r, 2 * r);
  else if (s === 2) { c.moveTo(x, y - r); c.lineTo(x + r, y + r); c.lineTo(x - r, y + r); }
  else if (s === 3) { for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r / 2 : r; c.lineTo(x + q * Math.cos(a), y + q * Math.sin(a)); } }
  else { c.moveTo(x, y + r); c.bezierCurveTo(x - 2 * r, y - r / 2, x - r / 2, y - 1.5 * r, x, y - r / 2); c.bezierCurveTo(x + r / 2, y - 1.5 * r, x + 2 * r, y - r / 2, x, y + r); }
  c.closePath(); c.fill(); if (k >= 5) circle(c, x, y, 14, '#fff');
}
run({
  id: 'memory', name: '翻牌记忆', bg: '#2d3561', accent: '#f78fb3',
  help: ['每次翻开两张牌，图案相同就配对成功', '记住牌的位置，用最少的步数配完', `限时 ${ROUND} 秒，越快分越高`],
  start(g) { cards = shuffle([...Array(10).keys()].flatMap(k => [k, k])).map(k => ({ k, open: false, done: false })); openIdx = []; wait = 0; moves = 0; g.hud('步数 0'); },
  down(x, y, g) {
    if (wait > 0) return; const cx = Math.floor((x - X0) / CW), cy = Math.floor((y - Y0) / CH); if (cx < 0 || cy < 0 || cx >= NX || cy >= NY) return;
    const i = cy * NX + cx, cd = cards[i]; if (cd.open || cd.done) return; cd.open = true; openIdx.push(i);
    if (openIdx.length === 2) {
      moves++; g.hud(`步数 ${moves}`); const [a, b] = openIdx;
      if (cards[a].k === cards[b].k) { cards[a].done = cards[b].done = true; openIdx = []; g.add(50);
        if (cards.every(q => q.done)) { g.add(Math.max(0, Math.round((ROUND - g.time) * 10))); g.over('全部配对！'); } }
      else wait = 0.8;
    }
  },
  update(dt, g) { if (wait > 0) { wait -= dt; if (wait <= 0) { openIdx.forEach(i => cards[i].open = false); openIdx = []; } } if (g.time >= ROUND) g.over('时间到'); },
  draw(c, g) {
    cards.forEach((cd, i) => {
      const x = X0 + (i % NX) * CW, y = Y0 + Math.floor(i / NX) * CH;
      if (cd.open || cd.done) { rr(c, x + 8, y + 8, CW - 16, CH - 16, 18, cd.done ? '#e8f8ee' : '#fff'); icon(c, cd.k, x + CW / 2, y + CH / 2); }
      else { rr(c, x + 8, y + 8, CW - 16, CH - 16, 18, '#f78fb3', '#fff', 4); text(c, '?', x + CW / 2, y + CH / 2, 60, '#fff'); }
    });
    text(c, `剩余 ${Math.max(0, Math.ceil(ROUND - g.time))} 秒`, W / 2, 1120, 36, '#f78fb3');
  },
});
