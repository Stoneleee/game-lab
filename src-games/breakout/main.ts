import { run, rr, circle, PALETTE, W, H } from '../_lib/engine';
const PY = H - 160, BR = 16, COLS = 8, ROWS = 6, BW = 80, BH = 36, BX0 = (W - COLS * BW) / 2, BY0 = 220;
let px = W / 2, pw = 160, bx = 0, by = 0, vx = 0, vy = 0, stuck = true, lives = 3, bricks: number[][] = [], level = 1;
const reset = () => { stuck = true; bx = px; by = PY - BR - 2; };
const fill = () => { bricks = Array.from({ length: ROWS }, (_, r) => Array(COLS).fill(r < 2 && level > 1 ? 2 : 1)); };
const launch = () => { if (stuck) { stuck = false; const s = 620 + level * 60; vx = s * 0.5; vy = -s * 0.87; } };
run({
  id: 'breakout', name: '打砖块', bg: '#141a33', accent: '#4ecdc4',
  help: ['拖动手指（或方向键）移动挡板', '点击发射小球，打碎所有砖块', '有 3 条命'],
  start(g) { level = 1; lives = 3; pw = 160; fill(); px = W / 2; reset(); g.hud('❤️ 3'); },
  down(x) { px = x; launch(); }, move(x) { px = x; },
  key(k) { if (k === 'ArrowLeft') px -= 50; if (k === 'ArrowRight') px += 50; if (k === ' ') launch(); },
  update(dt, g) {
    px = Math.max(pw / 2, Math.min(W - pw / 2, px));
    if (stuck) { bx = px; by = PY - BR - 2; return; }
    bx += vx * dt; by += vy * dt;
    if (bx < BR) { bx = BR; vx = Math.abs(vx); } if (bx > W - BR) { bx = W - BR; vx = -Math.abs(vx); } if (by < 110 + BR) { by = 110 + BR; vy = Math.abs(vy); }
    if (vy > 0 && by + BR > PY && by < PY + 20 && Math.abs(bx - px) < pw / 2 + BR) {
      const s = Math.hypot(vx, vy), a = ((bx - px) / (pw / 2)) * 1.05; vx = s * Math.sin(a); vy = -s * Math.cos(a);
    }
    const col = Math.floor((bx - BX0) / BW), row = Math.floor((by - BY0) / BH);
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS && bricks[row][col]) {
      bricks[row][col]--; vy = -vy; g.add(10);
      if (bricks.every(r => r.every(v => !v))) { level++; fill(); reset(); }
    }
    if (by > H) { lives--; g.hud('❤️ ' + lives); if (lives <= 0) g.over('没球了'); else reset(); }
  },
  draw(c) {
    bricks.forEach((r, i) => r.forEach((v, j) => v && rr(c, BX0 + j * BW + 3, BY0 + i * BH + 3, BW - 6, BH - 6, 6, v > 1 ? '#c9cdf0' : PALETTE[i])));
    rr(c, px - pw / 2, PY, pw, 22, 11, '#4ecdc4'); circle(c, bx, by, BR, '#fff');
  },
});
