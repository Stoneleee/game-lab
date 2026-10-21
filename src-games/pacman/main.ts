import { run, circle, rr, text, pick } from '../_lib/engine';
const MAP = [
  '#.............#',
  '#......#......#',
  '#.##.#.#.#.##.#',
  '#o##.#...#.##o#',
  '#.............#',
  '#.............#',
  '#....#...#....#',
  '####.#.#.#.####',
  '#......#......#',
  '#.##.#...#.##.#',
  '#.............#',
  '##.#.......#.##',
  '#.............#',
  '#.##.......##.#',
  '#o##.#.#.#.##o#',
  '#.............#',
  '#.............#'];
const C = 46, X0 = 15, Y0 = 200, NX = 15, NY = 17;
type V = [number, number];
const DIRS: Record<string, V> = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] };
let grid: string[][] = [], pac: V = [7, 4], dir: V = [0, 0], nd: V = [0, 0], ghosts: { p: V; d: V; home: V; col: string }[] = [], acc = 0, gacc = 0, fright = 0, lives = 3, pellets = 0, lvl = 1;
const open = (x: number, y: number) => x >= 0 && y >= 0 && x < NX && y < NY && grid[y][x] !== '#';
function reset() { pac = [7, 4]; dir = [0, 0]; nd = [0, 0]; ghosts = [{ p: [1, 8], d: [1, 0], home: [1, 8], col: '#ff4f5e' }, { p: [13, 8], d: [-1, 0], home: [13, 8], col: '#5bc0ff' }, { p: [7, 12], d: [0, 1], home: [7, 12], col: '#ff9ad5' }]; if (lvl > 1) ghosts.push({ p: [7, 15], d: [0, -1], home: [7, 15], col: '#ffb347' }); }
function fill() { grid = MAP.map(r => r.split('')); pellets = grid.flat().filter(c => c === '.' || c === 'o').length; }
function hit(g) {
  for (const gh of ghosts) if (gh.p[0] === pac[0] && gh.p[1] === pac[1]) {
    if (fright > 0) { g.add(20); gh.p = [...gh.home] as V; }
    else { lives--; if (lives <= 0) return g.over('被抓住了'); reset(); return; }
  }
}
run({
  id: 'pacman', name: '吃豆迷宫', bg: '#0b0d1f', accent: '#ffe14d',
  help: ['滑动屏幕（或方向键）控制方向', '吃光所有豆子进入下一关', '吃大豆子后可以反吃幽灵'],
  start() { lives = 3; lvl = 1; fill(); reset(); acc = gacc = fright = 0; },
  swipe(d) { nd = DIRS[d]; },
  update(dt, g) {
    fright -= dt; acc += dt; gacc += dt;
    g.hud(`❤️ ${lives}  第 ${lvl} 关`);
    if (acc >= 0.16) {
      acc = 0;
      if (open(pac[0] + nd[0], pac[1] + nd[1])) dir = nd;
      if (open(pac[0] + dir[0], pac[1] + dir[1])) pac = [pac[0] + dir[0], pac[1] + dir[1]];
      const ch = grid[pac[1]][pac[0]];
      if (ch === '.' || ch === 'o') { grid[pac[1]][pac[0]] = ' '; pellets--; g.add(ch === 'o' ? 5 : 1); if (ch === 'o') fright = 6; }
      if (pellets <= 0) { lvl++; g.add(50); fill(); reset(); return; }
      hit(g); if (g.state !== 'play') return;
    }
    const gstep = fright > 0 ? 0.3 : Math.max(0.15, 0.24 - lvl * 0.015);
    if (gacc >= gstep) {
      gacc = 0;
      for (const gh of ghosts) {
        let opts = Object.values(DIRS).filter(d => open(gh.p[0] + d[0], gh.p[1] + d[1]) && !(d[0] === -gh.d[0] && d[1] === -gh.d[1]));
        if (!opts.length) opts = [[-gh.d[0], -gh.d[1]] as V];
        let ch = pick(opts);
        if (Math.random() < 0.6) { const sc = (d: V) => Math.abs(gh.p[0] + d[0] - pac[0]) + Math.abs(gh.p[1] + d[1] - pac[1]); opts.sort((a, b) => fright > 0 ? sc(b) - sc(a) : sc(a) - sc(b)); ch = opts[0]; }
        gh.d = ch; gh.p = [gh.p[0] + ch[0], gh.p[1] + ch[1]];
      }
      hit(g);
    }
  },
  draw(c, g) {
    for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
      const ch = grid[y][x], px = X0 + x * C, py = Y0 + y * C;
      if (ch === '#') rr(c, px + 3, py + 3, C - 6, C - 6, 8, '#2a3bb7');
      else if (ch === '.') circle(c, px + C / 2, py + C / 2, 5, '#ffd9a0');
      else if (ch === 'o') circle(c, px + C / 2, py + C / 2, 12, '#ffd9a0');
    }
    const mouth = 0.25 + 0.25 * Math.sin(g.time * 18), ang = Math.atan2(dir[1], dir[0]);
    c.beginPath(); c.moveTo(X0 + pac[0] * C + C / 2, Y0 + pac[1] * C + C / 2); c.arc(X0 + pac[0] * C + C / 2, Y0 + pac[1] * C + C / 2, C / 2 - 4, ang + mouth, ang - mouth + Math.PI * 2); c.fillStyle = '#ffe14d'; c.fill();
    for (const gh of ghosts) { const px = X0 + gh.p[0] * C + C / 2, py = Y0 + gh.p[1] * C + C / 2; rr(c, px - 18, py - 18, 36, 38, 16, fright > 0 ? (fright < 2 && Math.floor(g.time * 6) % 2 ? '#fff' : '#3b4cff') : gh.col); circle(c, px - 7, py - 5, 5, '#fff'); circle(c, px + 7, py - 5, 5, '#fff'); }
    text(c, '滑动转向 · 吃大豆子可反吃幽灵', 360, Y0 + NY * C + 50, 28, '#ffffff77', 'center', false);
  },
});
