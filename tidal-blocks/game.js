import { SEEDS, SOLUTIONS, seedById } from './seeds.js';
import {
  SHAPES,
  boardToText,
  commitTide,
  compress,
  createRun,
  currentTide,
  describeTide,
  fullLines,
  place,
  placementsFor,
  tideLabel,
  undo,
} from './logic.js';

const STORE = 'tidal-blocks-v1';

const boardEl = document.querySelector('#board');
const handEl = document.querySelector('#hand');
const seedsEl = document.querySelector('#seeds');
const statusEl = document.querySelector('#status');
const coachEl = document.querySelector('#coach');
const blurbEl = document.querySelector('#blurb');
const tideBtn = document.querySelector('#tide');
const undoBtn = document.querySelector('#undo');
const restartBtn = document.querySelector('#restart');
const demoBtn = document.querySelector('#demo');
const helpBtn = document.querySelector('#help');

let save = loadSave();
let state = createRun(seedById('intro'));
let selected = null;
let painting = false;
let paintToken = 0;
let banner = '';
let showCoach = !save.helpSeen;

function loadSave() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return { best: {}, helpSeen: false };
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || typeof data.best !== 'object' || data.best === null) {
      return { best: {}, helpSeen: false };
    }
    return { best: { ...data.best }, helpSeen: Boolean(data.helpSeen) };
  } catch {
    return { best: {}, helpSeen: false };
  }
}

function writeSave() {
  localStorage.setItem(STORE, JSON.stringify(save));
}

function rememberBest() {
  const prev = Number(save.best[state.seedId]) || 0;
  if (state.score > prev) {
    save.best[state.seedId] = state.score;
    writeSave();
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function coachCopy() {
  if (painting) return '涨潮分两步：先把松块挤到虚线的位置，再消去排满的线。';
  if (!showCoach) {
    return '点选手牌，再点空格。虚线是这一潮会挤到的位置；排满的行或列要等涨潮之后才消失。';
  }
  if (state.seedId !== 'intro') {
    return '灰桩是锚点，不随潮移动，并把该行分成两段。松块只在自己的一段里挤齐。';
  }
  if (state.phase === 'place' && state.undoStack.length === 0) {
    return '点「竖二」，再点底部发亮的格子。上面四块会跟着左潮挤到最左列，摆下的瞬间不会消除。';
  }
  if (state.phase === 'place') {
    return '撤销可以收回上一步。竖二要放进还空着的两行，左潮才会把六行挤进同一列。';
  }
  if (state.phase === 'ready') {
    return '虚线就是挤齐后的位置。点涨潮后棋盘先按虚线移动，再消去排满的列。也可以先撤销，自己重摆。';
  }
  if (state.phase === 'won') {
    return '这一列是挤齐之后才排满的。撤销能回到涨潮之前。另外三关分别是锚点、连续两潮，以及会真正堵死的窄港。';
  }
  if (state.phase === 'short') return '挤过了，但没有排满。撤销，把竖二放到底部那两行。';
  if (state.phase === 'dead') return '这是规则上的死局，不是时间结束。撤销上一步，或重开。';
  return '';
}

function statusCopy() {
  if (banner) return banner;
  if (state.phase === 'dead') return state.deadReason;
  if (state.phase === 'ready') return '手牌已经摆完。涨潮会先改棋盘，再消线。';
  if (state.last && state.phase !== 'place') {
    const tail = state.phase === 'won'
      ? ` 目标达到。个人最佳 ${save.best[state.seedId] || state.score} 分记在这台设备。`
      : ' 牌序走完了，还没有达到目标线数。可撤销或重开。';
    return describeTide(state.last) + tail;
  }
  if (state.last && state.phase === 'place') return describeTide(state.last);
  const tide = tideLabel(currentTide(state));
  return `当前公开预告是${tide}。先点形状，再点格子。`;
}

function previewOf(board, tide) {
  const packed = compress(board, tide);
  const lines = fullLines(packed);
  return { packed, lines };
}

function render(view) {
  const beat = Boolean(view && view.beat);
  const board = beat ? view.board : state.board;
  const tide = (view && view.tide) || currentTide(state);
  const seed = seedById(state.seedId);
  const showPreview = !beat && (state.phase === 'place' || state.phase === 'ready');
  const preview = showPreview ? previewOf(board, tide) : null;
  const marked = beat ? fullLines(board) : (preview ? preview.lines : { rows: [], cols: [] });

  document.querySelector('#seed-name').textContent = seed.name;
  const chip = document.querySelector('#tide-chip');
  chip.textContent = tideLabel(tide);
  chip.className = tide;
  document.querySelector('#score').textContent = `得分 ${state.score}`;
  document.querySelector('#best').textContent = `最佳 ${Number(save.best[state.seedId]) || 0}`;
  blurbEl.textContent = seed.blurb;
  coachEl.textContent = coachCopy();
  statusEl.textContent = statusCopy();
  statusEl.className = state.phase === 'dead' ? 'bad' : state.phase === 'won' ? 'good' : '';

  boardEl.className = tide;
  boardEl.replaceChildren();
  for (let r = 0; r < 6; r += 1) {
    for (let c = 0; c < 6; c += 1) {
      const cell = board[r][c];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cell';
      button.dataset.r = String(r);
      button.dataset.c = String(c);
      button.dataset.k = cell;
      const kind = cell === 'o' ? '松块' : cell === '#' ? '锚点' : '空';
      button.setAttribute('aria-label', `第${r + 1}行第${c + 1}列 ${kind}`);
      if (cell === 'o') button.classList.add('loose');
      if (cell === '#') button.classList.add('anchor');
      const onLine = marked.rows.includes(r) || marked.cols.includes(c);
      if (!beat && preview) {
        const later = preview.packed[r][c];
        if (cell === 'o' && later !== 'o') button.classList.add('will-leave');
        if (cell === '.' && later === 'o') button.classList.add('ghost');
        if (onLine && later !== '.') button.classList.add('will-clear');
      }
      if (beat && onLine && cell !== '.') button.classList.add('will-clear');
      if (!beat && state.seedId === 'intro' && state.phase === 'place' && showCoach) {
        const spots = placementsFor(state.board, 'i2v').filter(([pr]) => pr === 4);
        if (spots.some(([pr, pc]) => pr === r && pc === c)) button.classList.add('suggest');
      }
      button.addEventListener('click', () => onCell(r, c));
      boardEl.appendChild(button);
    }
  }

  handEl.replaceChildren();
  if (!state.remaining.length) {
    const note = document.createElement('p');
    note.id = 'hand-note';
    note.textContent = state.phase === 'ready' ? '这一手已经摆完，可以涨潮或撤销。' : '没有待摆的手牌。';
    handEl.appendChild(note);
  } else {
    state.remaining.forEach((id, index) => {
      const shape = SHAPES[id];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'piece';
      button.dataset.shape = id;
      button.dataset.index = String(index);
      button.setAttribute('aria-pressed', selected === index ? 'true' : 'false');
      if (selected === index) button.classList.add('on');
      button.append(mini(shape), document.createTextNode(shape.name));
      button.disabled = painting;
      button.addEventListener('click', () => {
        if (painting) return;
        selected = selected === index ? null : index;
        banner = selected === null ? '' : `已选「${shape.name}」。再点棋盘上的空格，形状从该格向右、向下铺开。`;
        render();
      });
      handEl.appendChild(button);
    });
  }

  seedsEl.replaceChildren();
  for (const item of SEEDS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.name;
    button.dataset.seed = item.id;
    if (item.id === state.seedId) button.classList.add('on');
    button.addEventListener('click', () => loadSeed(item.id));
    seedsEl.appendChild(button);
  }

  const canTide = state.phase === 'ready' && !painting;
  tideBtn.disabled = !canTide;
  tideBtn.textContent = canTide ? '涨潮' : state.phase === 'dead' ? '无法涨潮' : '涨潮';
  undoBtn.disabled = painting ? false : state.undoStack.length === 0;
  demoBtn.disabled = state.seedId !== 'intro' || painting;
  helpBtn.setAttribute('aria-pressed', showCoach ? 'true' : 'false');
}

function mini(shape) {
  let maxR = 0;
  let maxC = 0;
  const on = new Set();
  for (const [dr, dc] of shape.cells) {
    maxR = Math.max(maxR, dr);
    maxC = Math.max(maxC, dc);
    on.add(`${dr},${dc}`);
  }
  const wrap = document.createElement('span');
  wrap.className = 'mini';
  wrap.style.gridTemplateColumns = `repeat(${maxC + 1}, 1fr)`;
  wrap.style.gridTemplateRows = `repeat(${maxR + 1}, 1fr)`;
  for (let r = 0; r <= maxR; r += 1) {
    for (let c = 0; c <= maxC; c += 1) {
      const mark = document.createElement('i');
      if (on.has(`${r},${c}`)) mark.className = 'on';
      wrap.appendChild(mark);
    }
  }
  return wrap;
}

function onCell(r, c) {
  if (painting) return;
  if (state.phase !== 'place') {
    banner = state.phase === 'ready' ? '这一手已经摆完。要改位置，先撤销。' : statusCopy();
    render();
    return;
  }
  if (selected === null || !state.remaining[selected]) {
    banner = '先点下方的形状，再点格子。';
    render();
    return;
  }
  const shapeId = state.remaining[selected];
  const result = place(state, shapeId, r, c);
  if (!result.ok) {
    banner = result.reason;
    render();
    return;
  }
  state = result.state;
  selected = null;
  banner = '';
  rememberBest();
  render();
}

async function onTide() {
  if (painting || state.phase !== 'ready') return;
  const result = commitTide(state);
  if (!result.ok) {
    banner = result.reason;
    render();
    return;
  }
  state = result.state;
  selected = null;
  rememberBest();
  if (state.phase === 'won' && state.seedId === 'intro') {
    save.helpSeen = true;
    writeSave();
  }
  const token = ++paintToken;
  if (result.plan.moved > 0) {
    painting = true;
    banner = `${tideLabel(result.plan.tide)}正在挤齐。这些位置是挤完、消除之前的棋盘。`;
    render({ board: result.plan.compressed, beat: true, tide: result.plan.tide });
    await delay(520);
    if (token !== paintToken) return;
    painting = false;
  }
  banner = '';
  render();
}

function onUndo() {
  paintToken += 1;
  painting = false;
  const result = undo(state);
  if (!result.ok) {
    banner = result.reason;
    render();
    return;
  }
  state = result.state;
  selected = null;
  banner = '已撤销上一步。';
  render();
}

function onRestart() {
  paintToken += 1;
  painting = false;
  state = createRun(seedById(state.seedId));
  selected = null;
  banner = '这一关已从头开始。';
  render();
}

function onDemo() {
  if (painting || state.seedId !== 'intro') return;
  if (state.phase !== 'place' || state.undoStack.length !== 0) {
    banner = '先重开这一关，演示会从开局摆一次，并可以撤销。';
    render();
    return;
  }
  const step = SOLUTIONS.intro[0];
  const result = place(state, step.shape, step.r, step.c);
  if (!result.ok) {
    banner = result.reason;
    render();
    return;
  }
  state = result.state;
  selected = null;
  banner = '演示把竖二放在左下。上面四块的虚线会收到这一列。点撤销收回这步，再自己选格子，然后涨潮。';
  render();
}

function loadSeed(id) {
  paintToken += 1;
  painting = false;
  state = createRun(seedById(id));
  selected = null;
  banner = '';
  render();
}

tideBtn.addEventListener('click', () => { onTide(); });
undoBtn.addEventListener('click', onUndo);
restartBtn.addEventListener('click', onRestart);
demoBtn.addEventListener('click', onDemo);
helpBtn.addEventListener('click', () => {
  showCoach = !showCoach;
  if (!showCoach) {
    save.helpSeen = true;
    writeSave();
  }
  banner = '';
  render();
});

document.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === 'u' || event.key === 'U') onUndo();
  else if (event.key === 'r' || event.key === 'R') onRestart();
  else if (event.key === 'Enter' && !event.target.closest('button')) onTide();
  else if (event.key >= '1' && event.key <= '3') {
    const index = Number(event.key) - 1;
    if (state.remaining[index]) {
      selected = selected === index ? null : index;
      banner = '';
      render();
    }
  }
});

window.__TB = {
  phase: () => state.phase,
  score: () => state.score,
  lines: () => state.lines,
  seed: () => state.seedId,
  tideName: () => currentTide(state),
  board: () => boardToText(state.board),
  settled: () => !painting,
  remaining: () => state.remaining.slice(),
  dead: () => state.deadReason,
  storeKey: STORE,
};

render();
