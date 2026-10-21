import { run, rr, text, ri } from '../_lib/engine';
type Q = [number, number];
const LIMIT = 180, OPS = ['+', '−', '×', '÷'];
let nums: (Q | null)[] = [], hist: (Q | null)[][] = [], sel = -1, op = -1, msg = '', mT = 0, solved = 0;
const g2 = (a: number, b: number): number => b ? g2(b, a % b) : Math.abs(a) || 1;
const norm = ([a, b]: Q): Q => { if (b < 0) { a = -a; b = -b; } const k = g2(a, b); return [a / k, b / k]; };
function calc(x: Q, y: Q, o: number): Q | null { const [a, b] = x, [c, d] = y; if (o === 0) return norm([a * d + c * b, b * d]); if (o === 1) return norm([a * d - c * b, b * d]); if (o === 2) return norm([a * c, b * d]); return c === 0 ? null : norm([a * d, b * c]); }
function solvable(v: Q[]): boolean { if (v.length === 1) return v[0][0] === 24 * v[0][1]; for (let i = 0; i < v.length; i++) for (let j = 0; j < v.length; j++) { if (i === j) continue; const rest = v.filter((_, k) => k !== i && k !== j); for (let o = 0; o < 4; o++) { const r = calc(v[i], v[j], o); if (r && solvable([...rest, r])) return true; } } return false; }
function gen() { let v: Q[]; do { v = [0, 0, 0, 0].map(() => [ri(1, 13), 1] as Q); } while (!solvable(v)); nums = v; hist = []; sel = -1; op = -1; }
const show = (q: Q) => q[1] === 1 ? String(q[0]) : `${q[0]}/${q[1]}`;
const NP = [[60, 330], [380, 330], [60, 600], [380, 600]];
run({
  id: 'point24', name: '24 点', bg: '#203a43', accent: '#ffc857',
  help: ['点数字 → 点运算符 → 点另一个数字', '把 4 个数算成 24', `${LIMIT} 秒内算出越多题越好`],
  start() { solved = 0; gen(); },
  down(x, y, g) {
    const k = NP.findIndex(([px, py]) => x > px && x < px + 280 && y > py && y < py + 230);
    if (k >= 0 && nums[k]) {
      if (sel >= 0 && op >= 0 && k !== sel) { const r = calc(nums[sel]!, nums[k]!, op); if (!r) { msg = '不能除以 0'; mT = 1; return; } hist.push([...nums]); nums[k] = r; nums[sel] = null; sel = k; op = -1;
        const left = nums.filter(Boolean) as Q[]; if (left.length === 1) { if (left[0][0] === 24 && left[0][1] === 1) { solved++; g.add(10); msg = '答对了！'; mT = 1; gen(); } else { msg = `得到 ${show(left[0])}，再试试`; mT = 1.2; } } }
      else { sel = sel === k ? -1 : k; op = -1; } return;
    }
    if (y > 880 && y < 1010) { const o = Math.floor((x - 40) / 165); if (o >= 0 && o < 4 && sel >= 0) op = o; return; }
    if (y > 1060 && y < 1170) { if (x < 360) { if (hist.length) { nums = hist.pop()!; sel = -1; op = -1; } } else { msg = '跳过一题'; mT = 1; gen(); } }
  },
  update(dt, g) { mT -= dt; const left = LIMIT - g.time; g.hud(`已解 ${solved} · ${Math.max(0, Math.ceil(left))}s`); if (left <= 0) g.over('时间到'); },
  draw(c) {
    NP.forEach(([x, y], k) => { const q = nums[k]; if (!q) { rr(c, x, y, 280, 230, 30, '#ffffff10'); return; } rr(c, x, y, 280, 230, 30, sel === k ? '#ffc857' : '#fdf6e3', '#00000033', 4); text(c, show(q), x + 140, y + 115, q[1] === 1 ? 110 : 64, '#203a43'); });
    OPS.forEach((o, k) => { rr(c, 40 + k * 165, 890, 145, 110, 24, op === k ? '#ffc857' : '#2c5364'); text(c, o, 112 + k * 165, 945, 70, '#fff'); });
    rr(c, 60, 1070, 270, 90, 24, '#c9cdf0'); text(c, '撤销', 195, 1115, 40, '#203a43'); rr(c, 390, 1070, 270, 90, 24, '#c9cdf0'); text(c, '跳过', 525, 1115, 40, '#203a43');
    text(c, mT > 0 ? msg : '凑出 24', 360, 230, 48, '#fff');
  },
});
