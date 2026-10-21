import * as Phaser from 'phaser';

const W = 720, H = 1280;
const BLOCK_H = 60;
const BEST_KEY = 'stackTower.best';
const STATS_KEY = 'stackTower.stats';

type Stats = { games: number; totalBlocks: number };
const loadBest = () => Number(localStorage.getItem(BEST_KEY) || 0);
const loadStats = (): Stats => {
  try { return JSON.parse(localStorage.getItem(STATS_KEY) || '') as Stats; } catch { return { games: 0, totalBlocks: 0 }; }
};
const color = (i: number) => Phaser.Display.Color.HSVToRGB(((i * 0.045) % 1), 0.55, 0.95).color as number;

function button(scene: Phaser.Scene, x: number, y: number, label: string, cb: () => void) {
  const bg = scene.add.rectangle(x, y, 360, 100, 0xffc857).setStrokeStyle(6, 0x1b1d2b).setInteractive({ useHandCursor: true });
  const t = scene.add.text(x, y, label, { fontSize: '44px', color: '#1b1d2b', fontStyle: 'bold' }).setOrigin(0.5);
  bg.on('pointerdown', (p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => { e.stopPropagation(); cb(); });
  return [bg, t];
}

class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }
  create() {
    this.cameras.main.setBackgroundColor('#1b1d2b');
    for (let i = 0; i < 6; i++) this.add.rectangle(W / 2, 900 - i * BLOCK_H, 300 - i * 30, BLOCK_H - 4, color(i));
    this.add.text(W / 2, 260, '叠叠高', { fontSize: '110px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(W / 2, 370, 'STACK TOWER', { fontSize: '40px', color: '#9aa0c3' }).setOrigin(0.5);
    const s = loadStats();
    this.add.text(W / 2, 470, `最高分 ${loadBest()}   ·   已玩 ${s.games} 局`, { fontSize: '34px', color: '#ffc857' }).setOrigin(0.5);
    button(this, W / 2, 1060, '开始游戏', () => this.scene.start('game'));
    this.add.text(W / 2, 1170, '点击屏幕放下方块，对得越准塔越高', { fontSize: '28px', color: '#9aa0c3' }).setOrigin(0.5);
  }
}

class GameScene extends Phaser.Scene {
  private stack: { x: number; w: number }[] = [];
  private moving!: Phaser.GameObjects.Rectangle;
  private dir = 1;
  private speed = 300;
  private score = 0;
  private combo = 0;
  private over = false;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private world!: Phaser.GameObjects.Container;
  constructor() { super('game'); }

  create() {
    this.stack = []; this.score = 0; this.combo = 0; this.over = false; this.speed = 300; this.dir = 1;
    this.cameras.main.setBackgroundColor('#1b1d2b');
    this.world = this.add.container(0, 0);
    this.add.rectangle(W / 2, H - 100, W, 200, 0x2c3050);
    const base = { x: W / 2, w: 400 };
    this.stack.push(base);
    this.world.add(this.add.rectangle(base.x, this.rowY(0), base.w, BLOCK_H - 4, color(0)));
    this.scoreText = this.add.text(W / 2, 120, '0', { fontSize: '120px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(10);
    this.comboText = this.add.text(W / 2, 220, '', { fontSize: '44px', color: '#ffc857' }).setOrigin(0.5).setDepth(10);
    this.spawn();
    this.input.on('pointerdown', () => this.drop());
    this.input.keyboard?.on('keydown-SPACE', () => this.drop());
  }

  private rowY(i: number) { return H - 200 - BLOCK_H / 2 - i * BLOCK_H; }

  private spawn() {
    const top = this.stack[this.stack.length - 1];
    const i = this.stack.length;
    this.dir = i % 2 ? 1 : -1;
    const startX = this.dir > 0 ? top.w / 2 : W - top.w / 2;
    this.moving = this.add.rectangle(startX, this.rowY(i), top.w, BLOCK_H - 4, color(i));
    this.world.add(this.moving);
    // camera follow: keep top ~ middle of screen
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
    let x: number, w: number;
    if (Math.abs(delta) < 8) {
      // perfect: snap and grow a bit
      this.combo++;
      w = Math.min(400, top.w + (this.combo >= 3 ? 20 : 0)); x = top.x;
      this.score += 2;
      this.comboText.setText(this.combo >= 2 ? `完美 x${this.combo}` : '完美!');
      this.cameras.main.flash(80, 255, 255, 255);
    } else {
      this.combo = 0; this.comboText.setText('');
      w = overlap; x = top.x + delta / 2;
      this.score += 1;
      // chopped piece
      const cutW = Math.abs(delta);
      const cutX = delta > 0 ? x + w / 2 + cutW / 2 : x - w / 2 - cutW / 2;
      const cut = this.add.rectangle(cutX, m.y, cutW, BLOCK_H - 4, color(i));
      this.world.add(cut); this.fall(cut);
    }
    m.destroy();
    this.world.add(this.add.rectangle(x, this.rowY(i), w, BLOCK_H - 4, color(i)));
    this.stack.push({ x, w });
    this.scoreText.setText(String(this.score));
    this.speed = Math.min(800, 300 + i * 12);
    this.spawn();
  }

  private fall(o: Phaser.GameObjects.Rectangle) {
    this.tweens.add({ targets: o, y: o.y + 900, angle: Phaser.Math.Between(-60, 60), alpha: 0, duration: 900, ease: 'Quad.In', onComplete: () => o.destroy() });
  }

  private gameOver() {
    this.over = true;
    const best = Math.max(loadBest(), this.score);
    const isNew = this.score > 0 && this.score >= best && this.score > Number(localStorage.getItem(BEST_KEY) || 0);
    localStorage.setItem(BEST_KEY, String(best));
    const s = loadStats(); s.games++; s.totalBlocks += this.stack.length - 1;
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
    this.time.delayedCall(600, () => {
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(20);
      const d = (o: Phaser.GameObjects.GameObject[]) => o.forEach(g => (g as unknown as Phaser.GameObjects.Components.Depth).setDepth(21));
      d([this.add.text(W / 2, 400, '游戏结束', { fontSize: '90px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5)]);
      d([this.add.text(W / 2, 540, `得分 ${this.score}`, { fontSize: '64px', color: '#ffc857' }).setOrigin(0.5)]);
      d([this.add.text(W / 2, 630, isNew ? '新纪录！' : `最高分 ${best}`, { fontSize: '44px', color: '#9aa0c3' }).setOrigin(0.5)]);
      // TODO 广告位：激励视频「复活一次」/ 插屏广告（每 2~3 局一次）
      d(button(this, W / 2, 820, '再来一局', () => this.scene.restart()));
      d(button(this, W / 2, 950, '主菜单', () => this.scene.start('menu')));
    });
  }
}

(window as unknown as { game: Phaser.Game }).game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: W, height: H, backgroundColor: '#1b1d2b',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [MenuScene, GameScene],
});
