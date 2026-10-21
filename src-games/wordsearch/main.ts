import { run, rr, text, pick, shuffle } from '../_lib/engine';
const WORDS = ['一帆风顺', '万事如意', '心想事成', '画蛇添足', '守株待兔', '亡羊补牢', '对牛弹琴', '井底之蛙', '狐假虎威', '掩耳盗铃', '刻舟求剑', '杯弓蛇影', '自相矛盾', '叶公好龙', '胸有成竹', '一石二鸟', '三心二意', '四面八方', '五光十色', '七上八下', '九牛一毛', '十全十美', '百发百中', '千军万马', '马到成功', '龙飞凤舞', '鸟语花香', '春暖花开', '山清水秀', '风和日丽', '金玉满堂', '和气生财', '笑口常开', '天长地久', '大显身手', '名列前茅', '学富五车', '温故知新', '水滴石穿', '熟能生巧'];
const FILL = '天地人和日月山水风云花草春秋金木火土东南西北上下大小高长明光心手口目';
const N = 8, S = 84, X0 = 24, Y0 = 250, LIMIT = 180;
let grid: string[] = [], words: { w: string; cells: number[]; found: boolean }[] = [], sel: number[] = [], st = -1, boards = 0;
function gen() {
  for (;;) {
    grid = Array(N * N).fill(''); words = []; let fail = false;
    for (const w of shuffle([...WORDS]).slice(0, 6)) {
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const [dx, dy] = pick([[1, 0], [0, 1], [1, 1]]); const x = Math.floor(Math.random() * (N - dx * 3)), y = Math.floor(Math.random() * (N - dy * 3));
        const cells = [0, 1, 2, 3].map(k => (y + dy * k) * N + x + dx * k);
        if (cells.every((c, k) => !grid[c] || grid[c] === w[k])) { cells.forEach((c, k) => grid[c] = w[k]); words.push({ w, cells, found: false }); placed = true; }
      }
      if (!placed) { fail = true; break; }
    }
    if (!fail) break;
  }
  grid = grid.map(c => c || FILL[Math.floor(Math.random() * FILL.length)]);
}
function line(a: number, b: number) {
  const ax = a % N, ay = Math.floor(a / N), bx = b % N, by = Math.floor(b / N), dx = Math.sign(bx - ax), dy = Math.sign(by - ay), n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
  if (!(ax === bx || ay === by || Math.abs(bx - ax) === Math.abs(by - ay))) return [a];
  return Array.from({ length: n + 1 }, (_, k) => (ay + dy * k) * N + ax + dx * k);
}
const cellAt = (x: number, y: number) => { const cx = Math.floor((x - X0) / S), cy = Math.floor((y - Y0) / S); return cx >= 0 && cy >= 0 && cx < N && cy < N ? cy * N + cx : -1; };
run({
  id: 'wordsearch', name: '成语寻宝', bg: '#fff7e8', accent: '#e85d75',
  help: ['在方阵里找出下方列出的成语', '从第一个字拖到最后一个字', '横、竖、斜都可能藏着成语'],
  start() { boards = 0; gen(); sel = []; st = -1; },
  down(x, y) { st = cellAt(x, y); sel = st >= 0 ? [st] : []; },
  move(x, y) { if (st < 0) return; const c = cellAt(x, y); if (c >= 0) sel = line(st, c); },
  up(x, y, g) {
    const s = sel.map(i => grid[i]).join('');
    for (const w of words) if (!w.found && (s === w.w) && sel.join() === w.cells.join()) { w.found = true; g.add(10); }
    for (const w of words) if (!w.found && s === w.w) { w.found = true; g.add(10); }
    sel = []; st = -1;
    if (words.every(w => w.found)) { boards++; g.add(30); gen(); }
  },
  update(dt, g) { const left = LIMIT - g.time; g.hud(`剩余 ${Math.max(0, Math.ceil(left))}s`); if (left <= 0) g.over('时间到'); },
  draw(c) {
    rr(c, X0 - 8, Y0 - 8, N * S + 16, N * S + 16, 16, '#f3e2c0');
    grid.forEach((ch, i) => {
      const x = X0 + (i % N) * S, y = Y0 + Math.floor(i / N) * S, f = words.some(w => w.found && w.cells.includes(i)), s = sel.includes(i);
      rr(c, x + 3, y + 3, S - 6, S - 6, 12, s ? '#ffc857' : f ? '#9be3b0' : '#fffdf6'); text(c, ch, x + S / 2, y + S / 2 + 2, 46, '#3a2e1f', 'center', false);
    });
    words.forEach((w, i) => { const x = 130 + (i % 3) * 230, y = Y0 + N * S + 70 + Math.floor(i / 3) * 70; text(c, w.w, x, y, 38, w.found ? '#bbb' : '#3a2e1f'); if (w.found) { c.fillStyle = '#e85d75'; c.fillRect(x - 80, y, 160, 4); } });
  },
});
