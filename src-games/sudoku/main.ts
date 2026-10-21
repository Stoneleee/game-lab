import { run, rr, text, shuffle, W, inBox } from '../_lib/engine';
const S = 72, X0 = (W - 9 * S) / 2, Y0 = 200, PY = 920;
let sol: number[] = [], cur: number[] = [], fixed: boolean[] = [], sel = -1, mistakes = 0, bad = -1, badT = 0;
function gen(): number[] {
  const a = Array(81).fill(0);
  const ok = (i: number, v: number) => { const r = Math.floor(i / 9), c = i % 9, br = r - r % 3, bc = c - c % 3; for (let k = 0; k < 9; k++) if (a[r * 9 + k] === v || a[k * 9 + c] === v || a[(br + Math.floor(k / 3)) * 9 + bc + k % 3] === v) return false; return true; };
  const fill = (i: number): boolean => { if (i === 81) return true; for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) if (ok(i, v)) { a[i] = v; if (fill(i + 1)) return true; a[i] = 0; } return false; };
  fill(0); return a;
}
function input(v: number, g) {
  if (sel < 0 || fixed[sel] || cur[sel] === sol[sel]) return;
  if (v === sol[sel]) { cur[sel] = v; g.add(10); if (cur.every((x, i) => x === sol[i])) { g.add(Math.max(100, 1500 - Math.floor(g.time) * 2)); g.over('完成！'); } }
  else { mistakes++; bad = sel; badT = 0.5; g.hud(`错误 ${mistakes}/3`); if (mistakes >= 3) g.over('错误太多'); }
}
run({
  id: 'sudoku', name: '数独', bg: '#f4f1ea', accent: '#5b8def',
  help: ['点格子，再点下方数字填入', '每行、每列、每个 3×3 宫都是 1~9', '错 3 次结束，越快完成分越高'],
  start(g) { sol = gen(); cur = sol.slice(); fixed = Array(81).fill(true); shuffle([...Array(81).keys()]).slice(0, 40).forEach(i => { cur[i] = 0; fixed[i] = false; }); sel = -1; mistakes = 0; g.hud('错误 0/3'); },
  down(x, y, g) {
    if (inBox(x, y, X0, Y0, 9 * S, 9 * S)) { sel = Math.floor((y - Y0) / S) * 9 + Math.floor((x - X0) / S); return; }
    if (inBox(x, y, X0, PY, 9 * S, 90)) input(Math.floor((x - X0) / S) + 1, g);
  },
  key(k, g) { if (/^[1-9]$/.test(k)) input(Number(k), g); const m = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[k]; if (m) sel = Math.max(0, Math.min(80, (sel < 0 ? 40 : sel) + m)); },
  update(dt) { badT -= dt; },
  draw(c) {
    rr(c, X0 - 6, Y0 - 6, 9 * S + 12, 9 * S + 12, 10, '#333');
    const sv = sel >= 0 ? cur[sel] : 0;
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9), q = i % 9, x = X0 + q * S, y = Y0 + r * S;
      const rel = sel >= 0 && (Math.floor(sel / 9) === r || sel % 9 === q);
      c.fillStyle = i === sel ? '#ffd86b' : badT > 0 && i === bad ? '#ff8a8a' : sv && cur[i] === sv ? '#c6dafc' : rel ? '#e8eefc' : '#fff';
      c.fillRect(x + 1, y + 1, S - 2, S - 2);
      if (cur[i]) text(c, cur[i], x + S / 2, y + S / 2 + 2, 42, fixed[i] ? '#222' : '#2f6fdd', 'center', fixed[i]);
    }
    c.strokeStyle = '#333'; c.lineWidth = 5; for (let k = 0; k <= 3; k++) { c.beginPath(); c.moveTo(X0 + k * 3 * S, Y0); c.lineTo(X0 + k * 3 * S, Y0 + 9 * S); c.stroke(); c.beginPath(); c.moveTo(X0, Y0 + k * 3 * S); c.lineTo(X0 + 9 * S, Y0 + k * 3 * S); c.stroke(); }
    for (let v = 1; v <= 9; v++) { rr(c, X0 + (v - 1) * S + 4, PY, S - 8, 90, 14, '#5b8def'); text(c, v, X0 + (v - 1) * S + S / 2, PY + 45, 44, '#fff'); }
    text(c, `用时 ${Math.floor((window as any).__gl.time)} 秒`, W / 2, 1080, 32, '#666', 'center', false);
  },
});
