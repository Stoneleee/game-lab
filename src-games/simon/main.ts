import { run, rr, text, ri } from '../_lib/engine';
const COL = ['#ff4f5e', '#3ee87b', '#4f8bff', '#ffd23f'], POS = [[90, 330], [380, 330], [90, 620], [380, 620]], SZ = 250;
let seq: number[] = [], idx = 0, show = 0, showI = 0, lit = -1, litT = 0, phase: 'show' | 'input' = 'show';
function nextRound() { seq.push(ri(0, 3)); idx = 0; phase = 'show'; show = 0.8; showI = 0; }
run({
  id: 'simon', name: '记忆闪灯', bg: '#181a28', accent: '#ffd23f',
  help: ['记住色块亮起的顺序', '轮到你时按同样的顺序点击', '每轮多一个，错一次就结束'],
  start() { seq = []; lit = -1; nextRound(); },
  down(x, y, g) {
    if (phase !== 'input') return;
    const k = POS.findIndex(([px, py]) => x > px && x < px + SZ && y > py && y < py + SZ); if (k < 0) return;
    lit = k; litT = 0.25;
    if (k !== seq[idx]) return g.over('顺序错了');
    idx++; if (idx >= seq.length) { g.add(seq.length); nextRound(); }
  },
  update(dt, g) {
    litT -= dt; if (litT <= 0) lit = -1;
    g.hud(`第 ${seq.length} 轮`);
    if (phase === 'show') { show -= dt; if (show <= 0) { if (showI >= seq.length) { phase = 'input'; return; } lit = seq[showI++]; litT = Math.max(0.25, 0.5 - seq.length * 0.02); show = litT + 0.2; } }
  },
  draw(c) {
    POS.forEach(([x, y], k) => rr(c, x, y, SZ, SZ, 40, COL[k] + (lit === k ? '' : '55'), lit === k ? '#fff' : undefined, 8));
    text(c, phase === 'show' ? '注意看…' : `轮到你 ${idx}/${seq.length}`, 360, 1000, 44, '#fff');
  },
});
