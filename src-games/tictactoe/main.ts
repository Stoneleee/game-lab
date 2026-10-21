import { run, rr, text } from '../_lib/engine';
const S = 200, X0 = 60, Y0 = 380;
let b: number[] = [], turn = 1, wait = 0, w = 0, d = 0, msg = '', pause = 0;
const L = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const winner = (bd: number[]) => { for (const [a, b2, c] of L) if (bd[a] && bd[a] === bd[b2] && bd[a] === bd[c]) return bd[a]; return bd.every(Boolean) ? 2 : 0; };
function mm(bd: number[], p: number): number { const r = winner(bd); if (r === -1) return 10; if (r === 1) return -10; if (r === 2) return 0; let best = p === -1 ? -99 : 99; for (let i = 0; i < 9; i++) if (!bd[i]) { bd[i] = p; const v = mm(bd, -p); bd[i] = 0; best = p === -1 ? Math.max(best, v) : Math.min(best, v); } return best; }
function check(g) {
  const r = winner(b); if (!r) return false;
  if (r === 1) { w++; g.add(3); msg = '你赢了！+3'; } else if (r === 2) { d++; g.add(1); msg = '平局 +1'; } else { msg = '电脑赢了'; turn = 0; setTimeout(() => g.over('电脑赢了'), 900); return true; }
  turn = 0; pause = 1; return true;
}
run({
  id: 'tictactoe', name: '井字棋', bg: '#22223b', accent: '#ffc857',
  help: ['你是 ○，电脑是 ×', '三个连成一线获胜', '赢 +3 分，平 +1 分，输了游戏结束'],
  start() { b = Array(9).fill(0); turn = 1; w = d = 0; msg = ''; pause = 0; },
  down(x, y, g) { if (turn !== 1) return; const cx = Math.floor((x - X0) / S), cy = Math.floor((y - Y0) / S); if (cx < 0 || cy < 0 || cx > 2 || cy > 2) return; const i = cy * 3 + cx; if (b[i]) return; b[i] = 1; msg = ''; if (!check(g)) { turn = -1; wait = 0.4; } },
  update(dt, g) {
    g.hud(`胜 ${w} · 平 ${d}`);
    if (pause > 0) { pause -= dt; if (pause <= 0) { b = Array(9).fill(0); turn = (w + d) % 2 ? -1 : 1; wait = 0.4; msg = ''; } return; }
    if (turn !== -1) return; wait -= dt; if (wait > 0) return;
    const em = b.map((v, i) => v ? -1 : i).filter(i => i >= 0); let best = em[Math.floor(Math.random() * em.length)];
    if (Math.random() > 0.22) { let bv = -99; for (const i of em) { b[i] = -1; const v = mm(b, 1); b[i] = 0; if (v > bv) { bv = v; best = i; } } }
    b[best] = -1; if (!check(g)) turn = 1;
  },
  draw(c) {
    for (let i = 0; i < 9; i++) { const x = X0 + (i % 3) * S, y = Y0 + Math.floor(i / 3) * S; rr(c, x + 8, y + 8, S - 16, S - 16, 24, '#4a4e69'); if (b[i]) text(c, b[i] === 1 ? '○' : '×', x + S / 2, y + S / 2 + 4, 140, b[i] === 1 ? '#7bd3c9' : '#ff6b6b'); }
    text(c, msg || (turn === 1 ? '轮到你（○）' : '电脑思考中…'), 360, 260, 40, '#fff');
  },
});
