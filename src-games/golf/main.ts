import { run, rr, text, shuffle } from '../_lib/engine';
type Card = { r: number; s: number };
const SU = ['♠', '♥', '♣', '♦'], RK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const CW = 92, CH = 128, X0 = 10, Y0 = 170, DY = 48;
let cols: Card[][] = [], stock: Card[] = [], top: Card, streak = 0, round = 1;
function deal() { const d: Card[] = []; for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ r, s }); shuffle(d); cols = Array.from({ length: 7 }, () => d.splice(0, 5)); top = d.pop()!; stock = d; streak = 0; }
const ok = (c: Card) => { const d = Math.abs(c.r - top.r); return d === 1 || d === 12; };
function card(c: CanvasRenderingContext2D, k: Card, x: number, y: number, hi = false) {
  rr(c, x, y, CW, CH, 10, '#fdfdf8', hi ? '#ffc857' : '#999', hi ? 6 : 2);
  const col = k.s % 2 ? '#d33' : '#222'; text(c, RK[k.r], x + 10, y + 24, 28, col, 'left'); text(c, SU[k.s], x + CW / 2, y + CH / 2 + 14, 48, col);
}
function check(g) {
  if (cols.every(c => !c.length)) { g.add(50 + stock.length * 5); round++; deal(); return; }
  if (!stock.length && !cols.some(c => c.length && ok(c[c.length - 1]))) g.over('没牌可走了');
}
run({
  id: 'golf', name: '高尔夫纸牌', bg: '#1f6b3a', accent: '#ffc857',
  help: ['点击列底的牌，点数比底牌大 1 或小 1 就能收走', 'K 和 A 首尾相连', '没牌可收时点牌堆翻新牌'],
  start() { round = 1; deal(); },
  down(x, y, g) {
    for (let i = 0; i < 7; i++) { const c = cols[i]; if (!c.length) continue; const cx = X0 + i * 101, cy = Y0 + (c.length - 1) * DY; if (x > cx && x < cx + CW && y > cy && y < cy + CH) { const k = c[c.length - 1]; if (ok(k)) { top = c.pop()!; streak++; g.add(streak); check(g); } return; } }
    if (x > 120 && x < 120 + CW && y > 900 && y < 900 + CH && stock.length) { top = stock.pop()!; streak = 0; check(g); }
  },
  update(dt, g) { g.hud(`第 ${round} 局 · 牌堆 ${stock.length}`); },
  draw(c) {
    cols.forEach((col, i) => col.forEach((k, j) => card(c, k, X0 + i * 101, Y0 + j * DY, j === col.length - 1 && ok(k))));
    if (stock.length) { rr(c, 120, 900, CW, CH, 10, '#3a5bbf', '#fff', 3); text(c, stock.length, 120 + CW / 2, 964, 36, '#fff'); } else rr(c, 120, 900, CW, CH, 10, '#ffffff22');
    text(c, '牌堆', 166, 1060, 28, '#fff', 'center', false);
    card(c, top, 420, 900); text(c, '底牌', 466, 1060, 28, '#fff', 'center', false);
    if (streak > 1) text(c, `连击 ×${streak}`, 360, 820, 40, '#ffc857');
  },
});
