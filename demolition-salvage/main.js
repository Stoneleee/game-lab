import { LEVELS } from './levels.js';
import {
  advance,
  beginShot,
  createSession,
  emptyProgress,
  isUnlocked,
  recordWin,
  restart,
  shotsUsed,
  undo,
} from './session.js';
import { entityAt, fingerprint } from './sim.js';

const PROGRESS_KEY = 'demolition-salvage-progress-v1';
const AUDIO_KEY = 'demolition-salvage-audio-v1';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const board = document.getElementById('board');
const cellsEl = document.getElementById('cells');
const entsEl = document.getElementById('ents');
const fx = document.getElementById('fx');
const fxCtx = fx.getContext('2d');
const hintEl = document.getElementById('hint');
const statusEl = document.getElementById('status');
const bannerEl = document.getElementById('banner');
const bannerText = document.getElementById('banner-text');
const nextBtn = document.getElementById('next');
const confirmBtn = document.getElementById('confirm');
const undoBtn = document.getElementById('undo');
const restartBtn = document.getElementById('restart');
const levelsBtn = document.getElementById('levels');
const muteBtn = document.getElementById('mute');
const modal = document.getElementById('modal');
const levelList = document.getElementById('level-list');
const closeModalBtn = document.getElementById('close-modal');

const audio = createAudio();
let progress = loadProgress();
let session = createSession(startIndex(progress));
let selected = null;
let stepMs = reduceMotion ? 40 : 190;
let timer = 0;
let cell = 48;
let snapNext = true;
const nodes = new Map();
let particles = [];
let fxOn = false;

function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null');
    if (!raw || raw.v !== 1 || !Array.isArray(raw.cleared) || raw.cleared.length !== LEVELS.length) {
      return emptyProgress();
    }
    if (!Array.isArray(raw.best) || raw.best.length !== LEVELS.length) return emptyProgress();
    return raw;
  } catch {
    return emptyProgress();
  }
}

function saveProgress() {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { /* private mode */ }
}

function startIndex(saved) {
  const last = Number.isInteger(saved.last) ? saved.last : 0;
  return isUnlocked(saved, last) ? last : 0;
}

function createAudio() {
  let want = false;
  try { want = localStorage.getItem(AUDIO_KEY) === 'on'; } catch { /* ignore */ }
  let ctx = null;
  let master = null;
  function persist() {
    try { localStorage.setItem(AUDIO_KEY, want ? 'on' : 'off'); } catch { /* ignore */ }
  }
  function ensure() {
    try {
      if (!ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        ctx = new Ctx();
        master = ctx.createGain();
        master.connect(ctx.destination);
      }
      master.gain.value = want ? 0.22 : 0;
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch {
      return null;
    }
  }
  function tone(freq, dur, type, gain, delay = 0) {
    if (!want || !ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(amp);
    amp.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  return {
    get want() { return want; },
    unlocked: () => !!ctx,
    muted: () => !want,
    gain: () => (master ? master.gain.value : 0),
    toggle() {
      want = !want;
      persist();
      ensure();
      if (want) tone(660, 0.08, 'sine', 0.2);
      return want;
    },
    arm() { if (want) ensure(); },
    shot() { if (!want) return; ensure(); tone(170, 0.08, 'square', 0.12); tone(90, 0.12, 'sawtooth', 0.05); },
    collect() { if (!want) return; ensure(); tone(520, 0.06, 'sine', 0.16); tone(780, 0.1, 'sine', 0.12, 0.05); },
    hit() { if (!want) return; ensure(); tone(110, 0.18, 'sawtooth', 0.12); },
    tick() { if (!want) return; ensure(); tone(240, 0.03, 'square', 0.04); },
    win() { if (!want) return; ensure(); [523, 659, 784].forEach((freq, i) => tone(freq, 0.12, 'sine', 0.14, i * 0.08)); },
    fail() { if (!want) return; ensure(); tone(150, 0.18, 'triangle', 0.12); tone(96, 0.24, 'triangle', 0.1, 0.08); },
  };
}

function fit() {
  const availW = Math.max(120, document.getElementById('stage').clientWidth - 8);
  const availH = Math.max(120, document.getElementById('stage').clientHeight - 8);
  const { width, height } = session.state;
  cell = Math.max(30, Math.min(72, Math.floor(availW / width), Math.floor(availH / height)));
}

function cellCenter(x, y) {
  return {
    x: x * cell + cell / 2,
    y: session.state.height * cell - (y + 0.5) * cell,
  };
}

function burst(x, y, color) {
  const origin = cellCenter(x, y);
  const count = reduceMotion ? 4 : 12;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: origin.x,
      y: origin.y,
      vx: (Math.random() - 0.5) * 160,
      vy: (Math.random() - 0.85) * 180,
      life: reduceMotion ? 0.25 : 0.45,
      color,
    });
  }
  if (!fxOn) {
    fxOn = true;
    requestAnimationFrame(drawFx);
  }
}

function drawFx(now) {
  const previous = drawFx.last || now;
  const dt = Math.min(0.05, (now - previous) / 1000);
  drawFx.last = now;
  const width = session.state.width * cell;
  const height = session.state.height * cell;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (fx.width !== Math.floor(width * dpr) || fx.height !== Math.floor(height * dpr)) {
    fx.width = Math.floor(width * dpr);
    fx.height = Math.floor(height * dpr);
    fx.style.width = `${width}px`;
    fx.style.height = `${height}px`;
  }
  fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fxCtx.clearRect(0, 0, width, height);
  particles = particles.filter((bit) => bit.life > 0);
  for (const bit of particles) {
    bit.life -= dt;
    bit.vy += 520 * dt;
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
    fxCtx.globalAlpha = Math.max(0, bit.life * 2);
    fxCtx.fillStyle = bit.color;
    fxCtx.fillRect(bit.x, bit.y, 4, 4);
  }
  fxCtx.globalAlpha = 1;
  if (particles.length) requestAnimationFrame(drawFx);
  else fxOn = false;
}

function colorOf(material) {
  if (material === 'brick') return '#e07a68';
  if (material === 'protected') return '#b6f5c8';
  if (material === 'anchor') return '#c5d0dc';
  return '#f0c27a';
}

function protectText(state) {
  if (!state.hasProtected) return '本关无保留房';
  if (state.failure) return '保留受损';
  return '保留安全';
}

function statusText() {
  const state = session.state;
  if (!session.acceptingShots || state.phase === 'resolving') return '坍落中…';
  if (state.phase === 'won' || state.phase === 'lost') return '已停稳';
  if (selected) {
    const block = entityAt(state, selected.x, selected.y);
    if (block?.material === 'brick') return '已选中砖。再按「拆除」确认。';
    return '已选中木头。再按「拆除」确认。';
  }
  if (state.phase === 'play' && state.salvage > 0 && state.salvage < state.goal) {
    return `回收还差 ${state.goal - state.salvage} 块。点下一块支撑。`;
  }
  return '点一块木头或砖，预览后再拆除。';
}

function renderEntities() {
  const state = session.state;
  const seen = new Set();
  for (const block of state.entities) {
    seen.add(block.id);
    let node = nodes.get(block.id);
    const fresh = !node;
    if (!node) {
      node = document.createElement('div');
      entsEl.appendChild(node);
      nodes.set(block.id, node);
    }
    const left = state.entities.some((other) => other.material === 'protected' && other.y === block.y && other.x === block.x - 1);
    const right = state.entities.some((other) => other.material === 'protected' && other.y === block.y && other.x === block.x + 1);
    node.className = `ent ${block.material}${block.rubble ? ' rubble' : ''}`;
    if (block.material === 'protected' && state.failure) node.classList.add('hit');
    if (block.material === 'protected' && right) node.classList.add('join-r');
    if (block.material === 'protected' && left) node.classList.add('join-l');
    const label = block.material === 'wood' ? '木'
      : block.material === 'brick' ? '砖'
      : block.material === 'anchor' ? '钢'
      : left ? '' : '保留';
    if (node.textContent !== label) node.textContent = label;
    node.dataset.kind = block.material;
    node.dataset.x = String(block.x);
    node.dataset.y = String(block.y);
    if (fresh || snapNext) node.style.transition = 'none';
    node.style.left = `${block.x * cell}px`;
    node.style.bottom = `${block.y * cell}px`;
    if (fresh || snapNext) requestAnimationFrame(() => { node.style.transition = ''; });
  }
  for (const [id, node] of nodes) {
    if (!seen.has(id)) {
      node.remove();
      nodes.delete(id);
    }
  }
  snapNext = false;
}

function renderCells() {
  const state = session.state;
  const buttons = [];
  for (let y = state.height - 1; y >= 0; y--) {
    for (let x = 0; x < state.width; x++) {
      const terrain = state.terrain[y][x];
      const block = entityAt(state, x, y);
      const kind = block ? block.material : terrain === 'ground' ? 'ground' : terrain === 'collector' ? 'collector' : 'air';
      const selectedHere = selected && selected.x === x && selected.y === y;
      const coach = !selected && session.past.length === 0 && state.phase === 'play' && state.coach
        && state.coach.x === x && state.coach.y === y;
      const label = block
        ? `${block.material === 'wood' ? '木头' : block.material === 'brick' ? '砖块' : block.material === 'protected' ? '保留房' : '钢架'}，第${x + 1}列第${y + 1}行`
        : terrain === 'collector' ? `回收箱，第${x + 1}列` : terrain === 'ground' ? '地面' : '空地';
      buttons.push(
        `<button type="button" class="cell ${terrain}${selectedHere ? ' selected' : ''}${coach ? ' coach' : ''}" data-x="${x}" data-y="${y}" data-kind="${kind}" aria-label="${label}">${terrain === 'collector' ? '回收' : ''}</button>`,
      );
    }
  }
  cellsEl.innerHTML = buttons.join('');
}

function renderModal() {
  levelList.innerHTML = LEVELS.map((level, index) => {
    const unlocked = isUnlocked(progress, index);
    const cleared = progress.cleared[index];
    const best = progress.best[index];
    const mark = !unlocked ? '未解锁' : cleared ? `已通过${best == null ? '' : ` · 最少 ${best} 发`}` : '可玩';
    return `<button type="button" class="level-btn${cleared ? ' cleared' : ''}${unlocked ? '' : ' locked'}" data-level="${index}" ${unlocked ? '' : 'disabled'}><span>第${index + 1}关 ${level.name}</span><small>${mark}</small></button>`;
  }).join('');
}

function render() {
  fit();
  const state = session.state;
  board.style.width = `${state.width * cell}px`;
  board.style.height = `${state.height * cell}px`;
  board.style.setProperty('--cell', `${cell}px`);
  board.style.setProperty('--cols', String(state.width));
  board.style.setProperty('--rows', String(state.height));
  document.getElementById('level-name').textContent = `第${session.levelIndex + 1}关 ${state.name}`;
  document.getElementById('shots').textContent = `弹药 ${state.shotsLeft}`;
  document.getElementById('salvage').textContent = `回收 ${state.salvage}/${state.goal}`;
  const protect = document.getElementById('protect');
  protect.textContent = protectText(state);
  protect.className = !state.hasProtected ? '' : state.failure ? 'bad' : 'good';
  hintEl.textContent = state.hint;
  statusEl.textContent = statusText();
  const showBanner = session.acceptingShots && (state.phase === 'won' || state.phase === 'lost');
  bannerEl.hidden = !showBanner;
  bannerEl.className = state.phase === 'won' ? 'won' : state.phase === 'lost' ? 'lost' : '';
  bannerText.textContent = showBanner ? state.reason : '';
  const last = session.levelIndex >= LEVELS.length - 1;
  nextBtn.hidden = state.phase !== 'won';
  nextBtn.textContent = last ? '选关' : '下一关';
  const canCut = session.acceptingShots && state.phase === 'play' && selected;
  confirmBtn.disabled = !canCut;
  confirmBtn.textContent = !session.acceptingShots
    ? '坍落中…'
    : canCut
      ? (entityAt(state, selected.x, selected.y)?.material === 'brick' ? '拆除这块砖' : '拆除这根木梁')
      : '先点一块';
  undoBtn.disabled = !(session.acceptingShots && session.past.length > 0);
  muteBtn.textContent = audio.want ? '静音' : '音效';
  muteBtn.setAttribute('aria-pressed', audio.want ? 'true' : 'false');
  renderCells();
  renderEntities();
  if (!modal.hidden) renderModal();
}

function clearTimer() {
  clearTimeout(timer);
  timer = 0;
}

function finishIfSettled() {
  if (!session.acceptingShots) return;
  if (session.state.phase === 'won') {
    audio.win();
    progress = recordWin(progress, session.levelIndex, shotsUsed(session.state));
    saveProgress();
  } else if (session.state.phase === 'lost') {
    audio.fail();
  }
}

function schedule() {
  clearTimer();
  timer = window.setTimeout(() => {
    const before = session.state.salvage;
    const hadHit = !!session.state.failure;
    session = advance(session);
    if (session.state.salvage > before) audio.collect();
    else if (session.lastEvents.some((event) => event.type === 'impact' || event.type === 'room-fall')) audio.hit();
    else if (session.lastEvents.some((event) => event.type === 'fall')) audio.tick();
    for (const event of session.lastEvents) {
      if (event.type === 'collect' || event.type === 'fall' || event.type === 'impact') {
        burst(event.x, event.y, colorOf(event.material));
      }
    }
    if (!hadHit && session.state.failure) audio.hit();
    render();
    if (!session.acceptingShots) schedule();
    else finishIfSettled();
  }, stepMs);
}

function selectCell(x, y) {
  if (!session.acceptingShots || session.state.phase !== 'play') return;
  const block = entityAt(session.state, x, y);
  if (!block) {
    selected = null;
    statusEl.textContent = '这里没有可拆的块';
    render();
    return;
  }
  if (block.material === 'protected') {
    selected = null;
    statusEl.textContent = '这是要保住的绿房，不能拆';
    render();
    return;
  }
  if (block.material === 'anchor') {
    selected = null;
    statusEl.textContent = '钢架拆不掉';
    render();
    return;
  }
  if (block.rubble || (block.material !== 'wood' && block.material !== 'brick')) {
    selected = null;
    statusEl.textContent = '这里没有可拆的块';
    render();
    return;
  }
  if (selected && selected.x === x && selected.y === y) {
    confirmShot();
    return;
  }
  selected = { x, y };
  render();
}

function confirmShot() {
  if (!selected) {
    statusEl.textContent = '先点要拆的块';
    return;
  }
  const { x, y } = selected;
  const block = entityAt(session.state, x, y);
  const begun = beginShot(session, x, y);
  if (!begun.ok) {
    statusEl.textContent = begun.reason;
    return;
  }
  selected = null;
  session = begun.session;
  audio.shot();
  if (block) burst(x, y, colorOf(block.material));
  render();
  schedule();
}

function doUndo() {
  const result = undo(session);
  if (!result.ok) {
    statusEl.textContent = result.reason;
    return;
  }
  clearTimer();
  session = result.session;
  selected = null;
  snapNext = true;
  render();
}

function doRestart() {
  clearTimer();
  session = restart(session).session;
  selected = null;
  snapNext = true;
  particles = [];
  fxCtx.setTransform(1, 0, 0, 1, 0, 0);
  fxCtx.clearRect(0, 0, fx.width, fx.height);
  render();
}

function openLevel(index) {
  if (!isUnlocked(progress, index)) {
    statusEl.textContent = '先通过上一关';
    return;
  }
  clearTimer();
  session = createSession(index);
  progress = { ...progress, last: index };
  saveProgress();
  selected = null;
  snapNext = true;
  particles = [];
  fxCtx.setTransform(1, 0, 0, 1, 0, 0);
  fxCtx.clearRect(0, 0, fx.width, fx.height);
  modal.hidden = true;
  render();
}

cellsEl.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || modal.hidden === false) return;
  selectCell(Number(button.dataset.x), Number(button.dataset.y));
});
confirmBtn.addEventListener('click', confirmShot);
undoBtn.addEventListener('click', doUndo);
restartBtn.addEventListener('click', doRestart);
levelsBtn.addEventListener('click', () => {
  modal.hidden = false;
  renderModal();
});
closeModalBtn.addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', (event) => {
  if (event.target === modal) modal.hidden = true;
  const button = event.target.closest('[data-level]');
  if (!button) return;
  openLevel(Number(button.dataset.level));
});
nextBtn.addEventListener('click', () => {
  if (session.levelIndex >= LEVELS.length - 1) {
    modal.hidden = false;
    renderModal();
    return;
  }
  openLevel(session.levelIndex + 1);
});
muteBtn.addEventListener('click', () => {
  audio.toggle();
  render();
});

window.addEventListener('pointerdown', () => audio.arm(), { passive: true });
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') modal.hidden = true;
  if (event.key === 'Enter') {
    event.preventDefault();
    confirmShot();
  } else if (event.key === 'u' || event.key === 'U' || event.key === 'Backspace') {
    event.preventDefault();
    doUndo();
  } else if (event.key === 'r' || event.key === 'R') {
    event.preventDefault();
    doRestart();
  } else if (event.key === 'm' || event.key === 'M') {
    event.preventDefault();
    audio.toggle();
    render();
  } else if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    if (!event.target.closest('#modal')) event.preventDefault();
  }
});
document.addEventListener('touchmove', (event) => {
  if (!event.target.closest('#modal')) event.preventDefault();
}, { passive: false });
window.addEventListener('resize', () => { snapNext = true; render(); });

window.__DS = {
  get session() { return session; },
  fingerprint: () => fingerprint(session.state),
  accepting: () => session.acceptingShots,
  phase: () => session.state.phase,
  reason: () => session.state.reason,
  failure: () => session.state.failure,
  entities: () => session.state.entities.map((e) => ({ ...e })),
  audio: () => ({
    want: audio.want,
    unlocked: audio.unlocked(),
    muted: audio.muted(),
    gain: audio.gain(),
  }),
  setDelay: (ms) => { stepMs = ms; },
  goto: (index) => openLevel(index),
  debugGoto: (index) => {
    clearTimer();
    session = createSession(index);
    selected = null;
    snapNext = true;
    render();
  },
  clickCell: selectCell,
  confirm: confirmShot,
  undo: doUndo,
  restart: doRestart,
};

render();
requestAnimationFrame(() => { snapNext = true; render(); });
