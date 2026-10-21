import { run, rr, text, W, H } from '../_lib/engine';
const COLS = 4, TW = W / COLS, TH = 260, TOPY = 100;
let rows: { col: number; y: number; hit: boolean }[] = [], speed = 0, started = false, miss: { c: number; y: number } | null = null;
function addRow(y: number) { rows.push({ col: Math.floor(Math.random() * COLS), y, hit: false }); }
function tapCol(col: number, g) {
  const target = rows.filter(r => !r.hit).sort((a, b) => b.y - a.y)[0]; if (!target) return;
  if (target.col === col) { target.hit = true; g.add(1); started = true; speed = Math.min(1500, 450 + g.score * 12); }
  else { miss = { c: col, y: target.y }; g.over('点错了'); }
}
run({
  id: 'tiles', name: '别踩白块', bg: '#ffffff', accent: '#5b8def',
  help: ['只点黑色方块，从最下面一行开始', '踩到白块或漏掉黑块就输', '键盘：D F J K 对应四列'],
  start() { rows = []; for (let i = 0; i < 7; i++) addRow(H - 300 - i * TH); speed = 0; started = false; miss = null; },
  down(x, _y, g) { tapCol(Math.min(COLS - 1, Math.floor(x / TW)), g); },
  key(k, g) { const i = 'dfjk'.indexOf(k.toLowerCase()); if (i >= 0) tapCol(i, g); },
  update(dt, g) {
    if (!started) return;
    rows.forEach(r => r.y += speed * dt);
    if (rows.some(r => !r.hit && r.y > H)) { const r = rows.find(r => !r.hit && r.y > H)!; miss = { c: r.col, y: H - TH }; return g.over('漏掉了'); }
    rows = rows.filter(r => r.y < H + 10);
    while (Math.min(...rows.map(r => r.y)) > TOPY - TH) addRow(Math.min(...rows.map(r => r.y)) - TH);
  },
  draw(c) {
    c.strokeStyle = '#ddd'; c.lineWidth = 2; for (let i = 1; i < COLS; i++) { c.beginPath(); c.moveTo(i * TW, TOPY); c.lineTo(i * TW, H); c.stroke(); }
    rows.forEach(r => { rr(c, r.col * TW + 2, r.y + 2, TW - 4, TH - 4, 6, r.hit ? '#c9cdf0' : '#1b1d2b'); });
    if (!started) { const f = rows.filter(r => !r.hit).sort((a, b) => b.y - a.y)[0]; if (f) text(c, '开始', f.col * TW + TW / 2, f.y + TH / 2, 40, '#fff'); }
    if (miss) rr(c, miss.c * TW + 2, miss.y + 2, TW - 4, TH - 4, 6, '#ff6b6b');
  },
});
