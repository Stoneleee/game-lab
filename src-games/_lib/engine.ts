// Tiny shared canvas engine for game-lab mini games.
// Logical size 720x1280 (portrait), scaled to fit any screen. Handles menu / play / over, HUD, best score, input.
export const W = 720, H = 1280, TOP = 110;
export type Dir = 'L' | 'R' | 'U' | 'D';
export interface Api {
  score: number; best: number; time: number; state: 'menu' | 'play' | 'over';
  add(n: number): void; over(msg?: string): void; hud(extra: string): void;
}
export interface GameDef {
  id: string; name: string; help: string[]; bg?: string; accent?: string;
  start(g: Api): void;
  update?(dt: number, g: Api): void;
  draw(c: CanvasRenderingContext2D, g: Api): void;
  down?(x: number, y: number, g: Api): void;
  move?(x: number, y: number, g: Api): void;
  up?(x: number, y: number, g: Api): void;
  swipe?(d: Dir, x0: number, y0: number, g: Api): void;
  key?(k: string, g: Api): void;
}

export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const ri = (a: number, b: number) => Math.floor(rnd(a, b + 1));
export const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
export function shuffle<T>(a: T[]): T[] { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const FONT = 'system-ui,-apple-system,"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
export function text(c: CanvasRenderingContext2D, s: string | number, x: number, y: number, size = 40, color = '#fff', align: CanvasTextAlign = 'center', bold = true) {
  c.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(String(s), x, y);
}
export function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, lw = 4) {
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
export function circle(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); }
export const PALETTE = ['#ff6b6b', '#ffc857', '#4ecdc4', '#5b8def', '#b388ff', '#7bd389', '#ff9f43', '#f78fb3', '#a0e7e5', '#c9cdf0'];
export const inBox = (x: number, y: number, bx: number, by: number, bw: number, bh: number) => x >= bx && x <= bx + bw && y >= by && y <= by + bh;

type Btn = { x: number; y: number; w: number; h: number; label: string; color: string; act: () => void };

export function run(def: GameDef) {
  document.title = def.name + ' · 游戏实验室';
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  document.body.appendChild(cv);
  const c = cv.getContext('2d')!;
  const bestKey = `gl.${def.id}.best`;
  let hudExtra = '', overMsg = '', newBest = false, last = performance.now(), overAt = 0;
  const g: Api = {
    score: 0, best: Number(localStorage.getItem(bestKey) || 0), time: 0, state: 'menu',
    add(n) { g.score += n; },
    over(msg = '游戏结束') {
      if (g.state !== 'play') return;
      g.state = 'over'; overAt = performance.now(); overMsg = msg; g.score = Math.max(0, Math.round(g.score));
      newBest = g.score > g.best; if (newBest) { g.best = g.score; localStorage.setItem(bestKey, String(g.best)); }
    },
    hud(s) { hudExtra = s; },
  };
  (window as any).__gl = g;
  const start = () => { g.score = 0; g.time = 0; hudExtra = ''; g.state = 'play'; def.start(g); };
  const btns = (): Btn[] => g.state === 'over'
    ? [{ x: 160, y: 760, w: 400, h: 100, label: '再来一局', color: '#ffc857', act: start },
       { x: 160, y: 890, w: 400, h: 100, label: '返回游戏大厅', color: '#c9cdf0', act: () => { location.href = '../'; } }]
    : g.state === 'menu'
    ? [{ x: 160, y: 900, w: 400, h: 110, label: '开始游戏', color: '#ffc857', act: start },
       { x: 160, y: 1040, w: 400, h: 90, label: '返回游戏大厅', color: '#c9cdf0', act: () => { location.href = '../'; } }]
    : [];

  function fit() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px';
  }
  addEventListener('resize', fit); fit();
  const pos = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  let sx = 0, sy = 0, st = 0, downActive = false;
  cv.addEventListener('pointerdown', e => {
    e.preventDefault(); const [x, y] = pos(e);
    if (g.state !== 'play') { if (g.state === 'over' && performance.now() - overAt < 700) return; for (const b of btns()) if (inBox(x, y, b.x, b.y, b.w, b.h)) { b.act(); return; } return; }
    if (y < TOP && x < 120) { location.href = '../'; return; }
    sx = x; sy = y; st = performance.now(); downActive = true; cv.setPointerCapture?.(e.pointerId);
    def.down?.(x, y, g);
  });
  cv.addEventListener('pointermove', e => { if (g.state !== 'play') return; const [x, y] = pos(e); def.move?.(x, y, g); });
  cv.addEventListener('pointerup', e => {
    if (g.state !== 'play' || !downActive) return; downActive = false;
    const [x, y] = pos(e); def.up?.(x, y, g);
    const dx = x - sx, dy = y - sy;
    if (def.swipe && Math.hypot(dx, dy) > 40 && g.state === 'play') def.swipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'), sx, sy, g);
  });
  const KEYS: Record<string, Dir> = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D', a: 'L', d: 'R', w: 'U', s: 'D' };
  addEventListener('keydown', e => {
    if (g.state !== 'play') { if (e.key === ' ' || e.key === 'Enter') start(); return; }
    if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
    def.key?.(e.key, g);
    if (def.swipe && KEYS[e.key]) def.swipe(KEYS[e.key], -1, -1, g);
  });

  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (g.state === 'play') { g.time += dt; def.update?.(dt, g); }
    c.fillStyle = def.bg || '#1b1d2b'; c.fillRect(0, 0, W, H);
    if (g.state !== 'menu') def.draw(c, g);
    // HUD
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, W, TOP - 10);
    text(c, '‹', 40, 50, 60, '#fff');
    text(c, def.name, 90, 50, 34, '#fff', 'left');
    text(c, `${g.score}`, W - 30, 36, 42, def.accent || '#ffc857', 'right');
    text(c, hudExtra || `最佳 ${g.best}`, W - 30, 78, 24, '#c9cdf0', 'right', false);
    if (g.state !== 'play') {
      c.fillStyle = 'rgba(10,12,25,0.78)'; c.fillRect(0, TOP - 10, W, H);
      if (g.state === 'menu') {
        text(c, def.name, W / 2, 300, 96, '#fff');
        def.help.forEach((l, i) => text(c, l, W / 2, 450 + i * 56, 32, '#c9cdf0', 'center', false));
        text(c, `最佳 ${g.best}`, W / 2, 800, 40, '#ffc857');
      } else {
        text(c, overMsg, W / 2, 380, 84, '#fff');
        text(c, `得分 ${g.score}`, W / 2, 520, 64, '#ffc857');
        text(c, newBest ? '🎉 新纪录！' : `最佳 ${g.best}`, W / 2, 620, 40, '#c9cdf0');
      }
      for (const b of btns()) { rr(c, b.x, b.y, b.w, b.h, 24, b.color, '#1b1d2b', 6); text(c, b.label, b.x + b.w / 2, b.y + b.h / 2, 42, '#1b1d2b'); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
