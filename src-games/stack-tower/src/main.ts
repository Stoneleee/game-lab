import * as Phaser from 'phaser';

const W = 720, H = 1280;
const BLOCK_H = 60;
const BEST_KEY = 'stackTower.best';
const STATS_KEY = 'stackTower.stats';
const LEVELS_PER_SCENE = 10;

type Stats = { games: number; totalBlocks: number };
type Decor = 'ground' | 'dusk' | 'clouds' | 'stars' | 'space';
type SceneDef = { name: string; top: number; bottom: number; hue: number; hueSpan: number; sat: number; decor: Decor };

const SCENES: SceneDef[] = [
  { name: '地面 · 白天', top: 0x7ec8f2, bottom: 0xd8f1ff, hue: 0.08, hueSpan: 0.12, sat: 0.6, decor: 'ground' },
  { name: '黄昏', top: 0x3b2a6b, bottom: 0xff9a62, hue: 0.95, hueSpan: 0.12, sat: 0.55, decor: 'dusk' },
  { name: '云端', top: 0x5b8fd6, bottom: 0xeaf2ff, hue: 0.55, hueSpan: 0.15, sat: 0.4, decor: 'clouds' },
  { name: '星夜', top: 0x070b24, bottom: 0x23306b, hue: 0.62, hueSpan: 0.2, sat: 0.5, decor: 'stars' },
  { name: '外太空', top: 0x000000, bottom: 0x1a0b33, hue: 0.75, hueSpan: 0.35, sat: 0.65, decor: 'space' },
];
const sceneIndexFor = (level: number) => Math.min(SCENES.length - 1, Math.floor(level / LEVELS_PER_SCENE));

const loadBest = () => Number(localStorage.getItem(BEST_KEY) || 0);
const loadStats = (): Stats => {
  try { return JSON.parse(localStorage.getItem(STATS_KEY) || '') as Stats; } catch { return { games: 0, totalBlocks: 0 }; }
};
const blockColor = (i: number) => {
  const s = SCENES[sceneIndexFor(i)];
  const h = (s.hue + ((i % LEVELS_PER_SCENE) / LEVELS_PER_SCENE) * s.hueSpan) % 1;
  return Phaser.Display.Color.HSVToRGB(h, s.sat, 0.95).color as number;
};
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

function rng(seed: number) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

function drawSceneBg(scene: Phaser.Scene, def: SceneDef): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.fillGradientStyle(def.top, def.top, def.bottom, def.bottom, 1);
  g.fillRect(0, 0, W, H);
  c.add(g);
  const r = rng(def.name.length * 97 + 13);
  const d = scene.add.graphics();
  c.add(d);
  const cloud = (x: number, y: number, s: number, a: number) => {
    d.fillStyle(0xffffff, a);
    d.fillCircle(x, y, 40 * s); d.fillCircle(x + 45 * s, y - 15 * s, 50 * s); d.fillCircle(x + 95 * s, y, 38 * s);
    d.fillRect(x, y, 95 * s, 38 * s);
  };
  if (def.decor === 'ground') {
    d.fillStyle(0xfff3b0, 1); d.fillCircle(600, 180, 60);
    cloud(60, 260, 1, 0.9); cloud(380, 420, 0.8, 0.8);
    d.fillStyle(0x7cc576, 1); d.fillEllipse(150, H - 210, 500, 160); d.fillEllipse(560, H - 200, 520, 140);
  } else if (def.decor === 'dusk') {
    d.fillStyle(0xffc46b, 0.9); d.fillCircle(560, H - 330, 90);
    for (let i = 0; i < 4; i++) { d.fillStyle(0xff7f6e, 0.35); d.fillRoundedRect(r() * W - 100, 200 + i * 140, 260, 22, 11); }
    d.fillStyle(0x2a1a40, 0.9);
    for (let x = 0; x < W; x += 60) d.fillRect(x, H - 200 - 40 - r() * 120, 50, 200);
  } else if (def.decor === 'clouds') {
    for (let i = 0; i < 9; i++) cloud(r() * W - 60, r() * H, 0.7 + r() * 1.1, 0.55 + r() * 0.35);
  } else if (def.decor === 'stars') {
    for (let i = 0; i < 90; i++) { d.fillStyle(0xffffff, 0.4 + r() * 0.6); d.fillCircle(r() * W, r() * H, 1 + r() * 2.2); }
    d.fillStyle(0xfdf6d8, 1); d.fillCircle(560, 200, 55); d.fillStyle(0x070b24, 1); d.fillCircle(585, 185, 50);
  } else {
    for (let i = 0; i < 120; i++) { d.fillStyle(0xffffff, 0.3 + r() * 0.7); d.fillCircle(r() * W, r() * H, 0.8 + r() * 2); }
    d.fillStyle(0xe3825a, 1); d.fillCircle(170, 300, 70);
    d.lineStyle(8, 0xf3c98b, 0.9); d.strokeEllipse(170, 300, 220, 50);
    d.fillStyle(0x6ec3f0, 1); d.fillCircle(590, 760, 36);
    d.fillStyle(0xb388ff, 0.25); d.fillEllipse(420, 520, 520, 200);
  }
  return c;
}

function button(scene: Phaser.Scene, x: number, y: number, label: string, cb: () => void, fill = 0xffc857) {
  const bg = scene.add.rectangle(x, y, 400, 96, fill).setStrokeStyle(6, 0x1b1d2b).setInteractive({ useHandCursor: true });
  const t = scene.add.text(x, y, label, { fontSize: '42px', color: '#1b1d2b', fontStyle: 'bold' }).setOrigin(0.5);
  bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => { e.stopPropagation(); cb(); });
  return [bg, t];
}

type Row = { x: number; w: number; color: number };

function buildShareCard(rows: Row[], score: number, best: number, sceneDef: SceneDef, isNew: boolean): HTMLCanvasElement {
  const CW = 600, CH = 840;
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
  const ctx = cv.getContext('2d')!;
  const font = (s: number, b = false) => `${b ? 'bold ' : ''}${s}px system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(0, 0, CW, CH, 36); ctx.fill();
  // thumbnail
  const tx = 30, ty = 30, tw = CW - 60, th = 470;
  const grad = ctx.createLinearGradient(0, ty, 0, ty + th);
  grad.addColorStop(0, hex(sceneDef.top)); grad.addColorStop(1, hex(sceneDef.bottom));
  ctx.save(); ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 24); ctx.clip();
  ctx.fillStyle = grad; ctx.fillRect(tx, ty, tw, th);
  const towerH = rows.length * BLOCK_H;
  const scale = Math.min((th - 40) / towerH, tw / W * 1.4, 0.8);
  const baseY = ty + th - 20;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(tx, baseY, tw, 20);
  rows.forEach((r, i) => {
    ctx.fillStyle = hex(r.color);
    const bw = r.w * scale, bh = Math.max(1, (BLOCK_H - 4) * scale);
    ctx.fillRect(tx + tw / 2 + (r.x - W / 2) * scale - bw / 2, baseY - (i + 1) * BLOCK_H * scale, bw, bh);
  });
  ctx.restore();
  ctx.textAlign = 'center'; ctx.fillStyle = '#1b1d2b';
  ctx.font = font(30, true); ctx.fillText('叠叠高 Stack Tower', CW / 2, 560);
  ctx.font = font(84, true); ctx.fillStyle = '#ff8a3d'; ctx.fillText(`${score} 分`, CW / 2, 650);
  ctx.font = font(28); ctx.fillStyle = '#4a4f6a';
  ctx.fillText(`塔高 ${rows.length - 1} 层 · 到达「${sceneDef.name}」`, CW / 2, 700);
  ctx.fillText(isNew ? '🎉 新纪录！' : `最高分 ${best}`, CW / 2, 742);
  ctx.font = font(24); ctx.fillStyle = '#9aa0c3';
  const lines = ['再高一点就摸到云了！', '这座塔，你能叠得更高吗？', '一指叠到外太空 🚀'];
  ctx.fillText(lines[Math.min(2, Math.floor((rows.length - 1) / 20))] + ' · Stone的AI实验室', CW / 2, 800);
  return cv;
}

async function exportCard(cv: HTMLCanvasElement) {
  const blob: Blob | null = await new Promise(res => cv.toBlob(res, 'image/png'));
  if (!blob) return;
  const file = new File([blob], 'stack-tower.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: '叠叠高', text: '我在叠叠高的成绩！' }); return; } catch { /* cancelled -> fall back */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'stack-tower.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }
  create() {
    drawSceneBg(this, SCENES[3]);
    for (let i = 0; i < 6; i++) this.add.rectangle(W / 2, 900 - i * BLOCK_H, 300 - i * 30, BLOCK_H - 4, blockColor(i * 7));
    this.add.text(W / 2, 260, '叠叠高', { fontSize: '110px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(W / 2, 370, 'STACK TOWER', { fontSize: '40px', color: '#c9cdf0' }).setOrigin(0.5);
    const s = loadStats();
    this.add.text(W / 2, 470, `最高分 ${loadBest()}   ·   已玩 ${s.games} 局`, { fontSize: '34px', color: '#ffc857' }).setOrigin(0.5);
    button(this, W / 2, 1060, '开始游戏', () => this.scene.start('game'));
    this.add.text(W / 2, 1170, '点击屏幕放下方块 · 每 10 层换一个场景', { fontSize: '28px', color: '#c9cdf0' }).setOrigin(0.5);
  }
}

class GameScene extends Phaser.Scene {
  private stack: Row[] = [];
  private moving!: Phaser.GameObjects.Rectangle;
  private dir = 1;
  private speed = 300;
  private score = 0;
  private combo = 0;
  private over = false;
  private sceneIdx = 0;
  private bg!: Phaser.GameObjects.Container;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private world!: Phaser.GameObjects.Container;
  constructor() { super('game'); }

  create() {
    this.stack = []; this.score = 0; this.combo = 0; this.over = false; this.speed = 300; this.dir = 1; this.sceneIdx = 0;
    this.bg = drawSceneBg(this, SCENES[0]).setDepth(-10);
    this.world = this.add.container(0, 0);
    this.world.add(this.add.rectangle(W / 2, H - 100, W, 200, 0x3d4466));
    const base: Row = { x: W / 2, w: 400, color: blockColor(0) };
    this.stack.push(base);
    this.world.add(this.add.rectangle(base.x, this.rowY(0), base.w, BLOCK_H - 4, base.color));
    const st = { color: '#fff', fontStyle: 'bold', stroke: '#1b1d2b', strokeThickness: 8 };
    this.scoreText = this.add.text(W / 2, 120, '0', { ...st, fontSize: '120px' }).setOrigin(0.5).setDepth(10);
    this.comboText = this.add.text(W / 2, 220, '', { ...st, fontSize: '44px', color: '#ffc857', strokeThickness: 6 }).setOrigin(0.5).setDepth(10);
    this.showBanner(SCENES[0].name);
    this.spawn();
    this.input.on('pointerdown', () => this.drop());
    this.input.keyboard?.on('keydown-SPACE', () => this.drop());
  }

  private rowY(i: number) { return H - 200 - BLOCK_H / 2 - i * BLOCK_H; }

  private showBanner(name: string) {
    const t = this.add.text(W / 2, 400, `— ${name} —`, { fontSize: '64px', color: '#fff', fontStyle: 'bold', stroke: '#1b1d2b', strokeThickness: 8 })
      .setOrigin(0.5).setDepth(15).setAlpha(0).setScale(0.8);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 350, yoyo: true, hold: 1100, ease: 'Back.Out', onComplete: () => t.destroy() });
  }

  private maybeChangeScene(level: number) {
    const idx = sceneIndexFor(level);
    if (idx === this.sceneIdx) return;
    this.sceneIdx = idx;
    const next = drawSceneBg(this, SCENES[idx]).setDepth(-9).setAlpha(0);
    const old = this.bg;
    this.tweens.add({ targets: next, alpha: 1, duration: 1200, ease: 'Sine.InOut', onComplete: () => { old.destroy(); next.setDepth(-10); } });
    this.bg = next;
    this.showBanner(SCENES[idx].name);
  }

  private spawn() {
    const top = this.stack[this.stack.length - 1];
    const i = this.stack.length;
    this.dir = i % 2 ? 1 : -1;
    const startX = this.dir > 0 ? top.w / 2 : W - top.w / 2;
    this.moving = this.add.rectangle(startX, this.rowY(i), top.w, BLOCK_H - 4, blockColor(i));
    this.world.add(this.moving);
    const targetY = Math.max(0, (i - 8) * BLOCK_H);
    this.tweens.add({ targets: this.world, y: targetY, duration: 250, ease: 'Sine.Out' });
  }

  update(_t: number, dt: number) {
    if (this.over || !this.moving) return;
    const half = this.moving.width / 2;
    this.moving.x += this.dir * this.speed * dt / 1000;
    if (this.moving.x + half > W) { this.moving.x = W - half; this.dir = -1; }
    if (this.moving.x - half < 0) { this.moving.x = half; this.dir = 1; }
  }

  private drop() {
    if (this.over) return;
    const top = this.stack[this.stack.length - 1];
    const m = this.moving;
    const delta = m.x - top.x;
    const overlap = top.w - Math.abs(delta);
    if (overlap <= 0) { this.fall(m); return this.gameOver(); }
    const i = this.stack.length;
    const color = blockColor(i);
    let x: number, w: number;
    if (Math.abs(delta) < 8) {
      this.combo++;
      w = Math.min(400, top.w + (this.combo >= 3 ? 20 : 0)); x = top.x;
      this.score += 2;
      this.comboText.setText(this.combo >= 2 ? `完美 x${this.combo}` : '完美!');
      this.cameras.main.flash(80, 255, 255, 255);
    } else {
      this.combo = 0; this.comboText.setText('');
      w = overlap; x = top.x + delta / 2;
      this.score += 1;
      const cutW = Math.abs(delta);
      const cutX = delta > 0 ? x + w / 2 + cutW / 2 : x - w / 2 - cutW / 2;
      const cut = this.add.rectangle(cutX, m.y, cutW, BLOCK_H - 4, color);
      this.world.add(cut); this.fall(cut);
    }
    m.destroy();
    this.world.add(this.add.rectangle(x, this.rowY(i), w, BLOCK_H - 4, color));
    this.stack.push({ x, w, color });
    this.scoreText.setText(String(this.score));
    this.speed = Math.min(800, 300 + i * 12);
    this.maybeChangeScene(i);
    this.spawn();
  }

  private fall(o: Phaser.GameObjects.Rectangle) {
    this.tweens.add({ targets: o, y: o.y + 900, angle: Phaser.Math.Between(-60, 60), alpha: 0, duration: 900, ease: 'Quad.In', onComplete: () => o.destroy() });
  }

  private gameOver() {
    this.over = true;
    const prevBest = loadBest();
    const best = Math.max(prevBest, this.score);
    const isNew = this.score > prevBest;
    localStorage.setItem(BEST_KEY, String(best));
    const s = loadStats(); s.games++; s.totalBlocks += this.stack.length - 1;
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
    const card = buildShareCard(this.stack, this.score, best, SCENES[this.sceneIdx], isNew);
    this.time.delayedCall(600, () => {
      this.scoreText.setVisible(false); this.comboText.setVisible(false);
      const z = (o: Phaser.GameObjects.GameObject[]) => o.forEach(g => (g as unknown as Phaser.GameObjects.Components.Depth).setDepth(21));
      const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(20).setInteractive();
      shade.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => e.stopPropagation());
      z([this.add.text(W / 2, 70, '游戏结束', { fontSize: '64px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5)]);
      const key = 'shareCard';
      if (this.textures.exists(key)) this.textures.remove(key);
      this.textures.addCanvas(key, card);
      const img = this.add.image(W / 2, 540, key).setDepth(21);
      img.setScale(Math.min(560 / card.width, 760 / card.height));
      z(button(this, W / 2, 990, '保存分享图', () => { void exportCard(card); }, 0x8fe3b0));
      z(button(this, W / 2, 1100, '再来一局', () => this.scene.restart()));
      z(button(this, W / 2, 1210, '主菜单', () => this.scene.start('menu'), 0xc9cdf0));
      // TODO 广告位：激励视频「复活一次」/ 插屏广告（每 2~3 局一次）
    });
  }
}

(window as unknown as { game: Phaser.Game }).game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: W, height: H, backgroundColor: '#1b1d2b',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [MenuScene, GameScene],
});
