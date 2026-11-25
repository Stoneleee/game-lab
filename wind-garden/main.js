import { GARDENS, gardenById } from './gardens.js';
import { DIR_NAME, describeTrace, trace } from './sim.js';
import {
  STORAGE_KEY,
  cloneCore,
  createSession,
  preview,
  readSave,
  recycle,
  restart,
  rotate,
  selectFan,
  selectPlant,
  selectSeed,
  sow,
  undo,
  wishState,
  writeGarden,
  emptySave,
} from './session.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const audioState = { want: false, ctx: null, unlocked: false };
const sprout = new Map();

let save = emptySave();
let session = null;
let shown = null;
let busy = false;
let flight = null;
let note = '';
let statusOverride = '';
let animScale = 1;
let layout = { cell: 48 };
let nowT = 0;
let lastFrame = 0;
let frameGaps = [];
let looping = false;
let raf = 0;
let pointer = null;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

function el(id) {
  return document.getElementById(id);
}

function loadMeta() {
  try {
    save = readSave(localStorage.getItem(STORAGE_KEY));
  } catch {
    save = emptySave();
  }
  audioState.want = save.sound === true;
}

function persist() {
  save = writeGarden(save, session, audioState.want);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    /* storage can be unavailable; the garden still plays */
  }
}

function boot(id) {
  const garden = gardenById(id);
  session = createSession(garden, save.gardens[garden.id]);
  shown = cloneCore(session.core);
  flight = null;
  busy = false;
  note = '';
  statusOverride = '';
  sprout.clear();
  fit();
  render();
  draw();
}

function syncShown() {
  shown = cloneCore(session.core);
}

function viewPreview() {
  const fan = session.garden.fans.find((item) => item.id === session.fanId);
  const tr = trace(session.garden, shown, session.fanId);
  return { fan, tr, text: describeTrace(session.garden, fan, tr, session.seed) };
}

function wishLabel(state, garden) {
  if (garden.free) return `花床 ${state.filled}/${state.total} · 随意`;
  if (state.both) return '两床都开了';
  if (state.total > state.need && state.done) return `花床 ${state.filled}/${state.total} · 可以再试另一条`;
  if (state.done) return '花床开了';
  if (state.total > state.need) return `花床 ${state.filled}/${state.total} · 开一床就好`;
  return `花床 ${state.filled}/${state.total}`;
}

function render() {
  const garden = session.garden;
  const view = viewPreview();
  const state = wishState(garden, shown);
  el('garden-name').textContent = garden.name;
  el('coach').textContent = garden.coach;
  el('wish').textContent = wishLabel(state, garden);
  const cause = statusOverride || (note ? `${note} ${view.text}` : view.text);
  el('cause').textContent = cause;
  el('cause').classList.toggle('turn', view.tr.turns.length > 0 && !statusOverride);
  el('seed-flower').textContent = `花籽 ${shown.seeds.flower}`;
  el('seed-hedge').textContent = `灌木籽 ${shown.seeds.hedge}`;
  el('seed-flower').setAttribute('aria-pressed', session.seed === 'flower' ? 'true' : 'false');
  el('seed-hedge').setAttribute('aria-pressed', session.seed === 'hedge' ? 'true' : 'false');
  const canSow = !busy && shown.seeds[session.seed] > 0 && view.tr.outcome === 'root';
  el('sow').disabled = !canSow;
  el('rotate').disabled = busy;
  el('undo').disabled = busy || session.undo.length === 0;
  el('recycle').disabled = busy || !session.selectedPlantId;
  el('restart').disabled = busy;
  el('gardens').disabled = busy;
  el('seed-flower').disabled = busy;
  el('seed-hedge').disabled = busy;
  el('next').hidden = garden.free || !state.done;
  el('mute').textContent = audioState.want ? '静音' : '音效';
  el('mute').setAttribute('aria-pressed', audioState.want ? 'true' : 'false');
}

function fit() {
  const garden = session.garden;
  const rect = el('stage').getBoundingClientRect();
  const maxW = Math.max(160, rect.width);
  const maxH = Math.max(160, rect.height);
  let cell = Math.floor(Math.min(maxW / garden.width, maxH / garden.height));
  cell = Math.max(24, Math.min(cell, 72));
  const cssW = cell * garden.width;
  const cssH = cell * garden.height;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layout = { cell, cssW, cssH };
}

function cellCenter(x, y) {
  return { x: (x + 0.5) * layout.cell, y: (y + 0.5) * layout.cell };
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function growthOf(plant) {
  if (reduced) return 1;
  const born = sprout.get(plant.id);
  if (!born) return 1;
  return Math.max(0, Math.min(1, (nowT - born) / 520));
}

function streamPoints(fan, tr) {
  const points = [{ x: fan.x, y: fan.y }];
  for (const step of tr.steps) points.push({ x: step.x, y: step.y });
  return points;
}

function polyLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

function pointAlong(points, dist) {
  let left = dist;
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (left <= seg || i === points.length - 1) {
      const t = seg === 0 ? 0 : Math.min(1, left / seg);
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
      };
    }
    left -= seg;
  }
  return points[0];
}

function drawStream(gridPoints, alpha, width) {
  if (gridPoints.length < 2) return;
  const points = gridPoints.map((point) => cellCenter(point.x, point.y));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#2f7ea3';
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
  ctx.stroke();
  const total = polyLength(points);
  const count = Math.min(10, Math.max(2, Math.round(total / (layout.cell * 0.85))));
  const offset = reduced ? 0.2 : (nowT / 1100) % 1;
  for (let i = 0; i < count; i++) {
    const at = pointAlong(points, ((i / count) + offset) % 1 * total);
    ctx.fillStyle = '#2f7ea3';
    ctx.beginPath();
    ctx.arc(at.x, at.y, Math.max(2.2, layout.cell * 0.045), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFlower(plant) {
  const c = cellCenter(plant.x, plant.y);
  const s = layout.cell;
  const g = growthOf(plant);
  const phase = reduced ? 0 : nowT / 700 + plant.id;
  const petal = ['#e36b5c', '#e2b143', '#d98ad4'][plant.id % 3];
  ctx.save();
  ctx.translate(c.x, c.y + (1 - g) * s * 0.16);
  ctx.scale(g, g);
  ctx.rotate(Math.sin(phase) * 0.06);
  ctx.strokeStyle = '#3d8f55';
  ctx.lineWidth = Math.max(1.5, s * 0.045);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.02);
  ctx.quadraticCurveTo(s * 0.08, s * 0.16, 0, s * 0.3);
  ctx.stroke();
  ctx.fillStyle = petal;
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * s * 0.1, Math.sin(angle) * s * 0.1 - s * 0.08, s * 0.075, s * 0.12, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff6d8';
  ctx.beginPath();
  ctx.arc(0, -s * 0.08, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHedge(plant, blocking) {
  const c = cellCenter(plant.x, plant.y);
  const s = layout.cell;
  const g = growthOf(plant);
  const phase = reduced ? 0 : nowT / 900 + plant.id;
  ctx.save();
  ctx.translate(c.x, c.y + (1 - g) * s * 0.08);
  ctx.scale(g, g);
  const blobs = [
    [-0.16, 0.06, 0.18, '#2f7a45'],
    [0.15, 0.07, 0.16, '#3e9458'],
    [0, -0.08, 0.2, '#26683c'],
  ];
  for (const [bx, by, br, color] of blobs) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(bx * s, by * s + Math.sin(phase) * s * 0.012, br * s, 0, Math.PI * 2);
    ctx.fill();
  }
  if (blocking) {
    ctx.strokeStyle = 'rgba(47, 126, 163, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.34, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFan(fan, dir, selected) {
  const c = cellCenter(fan.x, fan.y);
  const s = layout.cell;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.fillStyle = selected ? '#fffaf0' : '#f3ecdf';
  ctx.strokeStyle = selected ? '#2f7ea3' : '#d7c4a2';
  ctx.lineWidth = selected ? 3 : 1.5;
  roundRect(-s * 0.34, -s * 0.34, s * 0.68, s * 0.68, s * 0.16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2f7ea3';
  const angle = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 }[dir];
  ctx.save();
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(s * 0.2, -s * 0.02);
  ctx.lineTo(-s * 0.12, s * 0.12);
  ctx.lineTo(-s * 0.12, -s * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#5e6b62';
  ctx.font = `${Math.max(9, Math.floor(s * 0.16))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(fan.power), 0, s * 0.22);
  ctx.restore();
}

function draw() {
  const garden = session.garden;
  const cell = layout.cell;
  ctx.clearRect(0, 0, layout.cssW, layout.cssH);
  const streams = garden.fans.map((fan) => ({
    fan,
    tr: trace(garden, shown, fan.id),
    selected: fan.id === session.fanId,
  }));
  const blocks = new Set();
  for (const stream of streams) {
    if (!stream.selected) continue;
    for (const turn of stream.tr.turns) blocks.add(`${turn.blockX},${turn.blockY}`);
  }
  for (let y = 0; y < garden.height; y++) {
    for (let x = 0; x < garden.width; x++) {
      if (garden.fans.some((fan) => fan.x === x && fan.y === y)) continue;
      const bed = garden.beds.some((item) => item.x === x && item.y === y);
      const pad = Math.max(2, cell * 0.06);
      const n = (x * 3 + y * 5) % 3;
      ctx.fillStyle = bed ? ['#f6ddb0', '#f8e2b8', '#f3d7a4'][n] : ['#f4e7cb', '#f7ecd4', '#f1e2c2'][n];
      roundRect(x * cell + pad, y * cell + pad, cell - pad * 2, cell - pad * 2, Math.min(12, cell * 0.18));
      ctx.fill();
      if (bed) {
        const c = cellCenter(x, y);
        ctx.strokeStyle = 'rgba(196, 138, 42, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(c.x, c.y, cell * 0.32, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  for (const stream of streams) {
    drawStream(streamPoints(stream.fan, stream.tr), stream.selected ? 0.95 : 0.28, stream.selected ? Math.max(3, cell * 0.055) : Math.max(2, cell * 0.035));
  }
  for (const plant of shown.plants) {
    if (plant.kind === 'hedge') drawHedge(plant, blocks.has(`${plant.x},${plant.y}`));
    else drawFlower(plant);
    if (plant.id === session.selectedPlantId) {
      const c = cellCenter(plant.x, plant.y);
      ctx.save();
      ctx.strokeStyle = '#243028';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, cell * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  const selected = streams.find((stream) => stream.selected);
  if (selected && selected.tr.landing) {
    const c = cellCenter(selected.tr.landing.x, selected.tr.landing.y);
    const pulse = reduced ? 0 : Math.sin(nowT / 380) * 1.5;
    ctx.save();
    ctx.strokeStyle = session.seed === 'hedge' ? '#2f7a45' : '#e36b5c';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, cell * 0.28 + pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (flight) {
    const points = flight.points.map((point) => cellCenter(point.x, point.y));
    const at = pointAlong(points, (flight.t / flight.dur) * polyLength(points));
    ctx.fillStyle = flight.kind === 'hedge' ? '#2f7a45' : '#e36b5c';
    ctx.beginPath();
    ctx.ellipse(at.x, at.y, cell * 0.08, cell * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const fan of garden.fans) drawFan(fan, shown.dirs[fan.id], fan.id === session.fanId);
}

function tone(kind) {
  if (!audioState.want) return false;
  try {
    if (!audioState.ctx) audioState.ctx = new AudioContext();
    const actx = audioState.ctx;
    if (actx.state === 'suspended') actx.resume();
    audioState.unlocked = true;
    const start = actx.currentTime;
    const specs = {
      tap: [[520, 0, 0.045, 0.03]],
      turn: [[440, 0, 0.07, 0.035]],
      sow: [[660, 0, 0.08, 0.03]],
      root: [[523, 0, 0.14, 0.035], [659, 0.09, 0.16, 0.03]],
      no: [[196, 0, 0.09, 0.03]],
    };
    for (const [freq, delay, dur, gain] of specs[kind] || specs.tap) {
      const osc = actx.createOscillator();
      const amp = actx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      amp.gain.setValueAtTime(gain, start + delay);
      amp.gain.exponentialRampToValueAtTime(0.0008, start + delay + dur);
      osc.connect(amp);
      amp.connect(actx.destination);
      osc.start(start + delay);
      osc.stop(start + delay + dur + 0.02);
    }
    return true;
  } catch {
    audioState.want = false;
    return false;
  }
}

function revealPlant(id) {
  sprout.set(id, nowT || performance.now() - ((reduced || animScale === 0) ? 1000 : 0));
  if (reduced || animScale === 0) sprout.set(id, (nowT || performance.now()) - 1000);
  syncShown();
  busy = false;
  flight = null;
}

function startFlight(result) {
  const fan = session.garden.fans.find((item) => item.id === session.fanId);
  const points = [{ x: fan.x, y: fan.y }, ...result.trace.steps.map((step) => ({ x: step.x, y: step.y }))];
  const dur = reduced || animScale === 0 ? 0 : Math.max(320, Math.max(1, points.length - 1) * 120);
  note = '';
  if (dur === 0) {
    note = result.text;
    revealPlant(result.plant.id);
    tone('root');
    render();
    draw();
    return;
  }
  busy = true;
  flight = { points, kind: result.plant.kind, t: 0, dur, plantId: result.plant.id, text: result.text };
  render();
}

function finishFlight() {
  note = flight.text;
  revealPlant(flight.plantId);
  tone('root');
  render();
}

function onRotate() {
  if (busy) return;
  statusOverride = '';
  const fan = session.garden.fans.find((item) => item.id === session.fanId);
  const turned = rotate(session);
  note = `${fan.name}现在朝${DIR_NAME[turned.dir]}。`;
  syncShown();
  persist();
  tone('turn');
  render();
  draw();
}

function onSow() {
  if (busy) return;
  statusOverride = '';
  const result = sow(session);
  if (!result.ok) {
    statusOverride = result.reason;
    tone('no');
    render();
    return;
  }
  persist();
  tone('sow');
  startFlight(result);
}

function onUndo() {
  if (busy) return;
  statusOverride = '';
  const result = undo(session);
  if (!result.ok) {
    statusOverride = result.reason;
    render();
    return;
  }
  note = '撤销了上一步。';
  syncShown();
  persist();
  tone('tap');
  render();
  draw();
}

function onRecycle() {
  if (busy) return;
  statusOverride = '';
  const result = recycle(session);
  if (!result.ok) {
    statusOverride = result.reason;
    render();
    return;
  }
  note = result.text;
  syncShown();
  persist();
  tone('tap');
  render();
  draw();
}

function onRestart() {
  if (busy) return;
  statusOverride = '';
  const result = restart(session);
  if (!result.ok) {
    statusOverride = result.reason;
    render();
    return;
  }
  note = '这座园回到了开始。';
  syncShown();
  persist();
  tone('tap');
  render();
  draw();
}

function onMute() {
  audioState.want = !audioState.want;
  if (audioState.want) {
    if (!tone('tap')) audioState.want = false;
  } else if (audioState.ctx) {
    audioState.ctx.suspend();
  }
  persist();
  render();
}

function onSeed(kind) {
  if (busy) return;
  statusOverride = '';
  selectSeed(session, kind);
  persist();
  render();
  draw();
}

function onCell(x, y) {
  if (busy) return;
  const fan = session.garden.fans.find((item) => item.x === x && item.y === y);
  if (fan) {
    if (session.fanId !== fan.id) {
      selectFan(session, fan.id);
      note = '';
      statusOverride = '';
      persist();
      tone('tap');
      render();
      draw();
    } else onRotate();
    return;
  }
  const plant = shown.plants.find((item) => item.x === x && item.y === y);
  if (!plant) return;
  if (session.selectedPlantId === plant.id) onRecycle();
  else {
    selectPlant(session, plant.id);
    statusOverride = '';
    tone('tap');
    render();
    draw();
  }
}

function openSheet() {
  if (busy) return;
  const list = el('garden-list');
  list.replaceChildren();
  for (const garden of GARDENS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.garden = garden.id;
    button.append(document.createTextNode(`${garden.name}${garden.id === session.garden.id ? ' · 当前' : ''}`));
    const small = document.createElement('small');
    small.textContent = garden.free ? garden.coach : `花床 ${garden.beds.length} · ${garden.coach}`;
    button.append(small);
    button.addEventListener('click', () => {
      switchTo(garden.id);
      closeSheet();
    });
    list.append(button);
  }
  el('sheet').hidden = false;
}

function closeSheet() {
  el('sheet').hidden = true;
}

function switchTo(id) {
  persist();
  boot(id);
  persist();
}

function frame(now) {
  if (!looping) return;
  raf = requestAnimationFrame(frame);
  if (lastFrame) {
    frameGaps.push(now - lastFrame);
    if (frameGaps.length > 90) frameGaps.shift();
  }
  const dt = lastFrame ? Math.min(34, now - lastFrame) : 16;
  lastFrame = now;
  nowT = now;
  if (flight) {
    flight.t += dt;
    if (flight.t >= flight.dur) finishFlight();
  }
  draw();
}

function startLoop() {
  if (looping) return;
  looping = true;
  lastFrame = 0;
  raf = requestAnimationFrame(frame);
}

function stopLoop() {
  looping = false;
  cancelAnimationFrame(raf);
}

function bind() {
  el('rotate').addEventListener('click', onRotate);
  el('sow').addEventListener('click', onSow);
  el('undo').addEventListener('click', onUndo);
  el('recycle').addEventListener('click', onRecycle);
  el('restart').addEventListener('click', onRestart);
  el('gardens').addEventListener('click', openSheet);
  el('close-sheet').addEventListener('click', closeSheet);
  el('next').addEventListener('click', () => {
    const index = GARDENS.findIndex((garden) => garden.id === session.garden.id);
    switchTo(GARDENS[(index + 1) % GARDENS.length].id);
  });
  el('mute').addEventListener('click', onMute);
  el('seed-flower').addEventListener('click', () => onSeed('flower'));
  el('seed-hedge').addEventListener('click', () => onSeed('hedge'));
  el('sheet').addEventListener('click', (event) => {
    if (event.target.id === 'sheet') closeSheet();
  });
  canvas.addEventListener('pointerdown', (event) => {
    pointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer = null;
    if (dx * dx + dy * dy > 64) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / layout.cell);
    const y = Math.floor((event.clientY - rect.top) / layout.cell);
    onCell(x, y);
  });
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.key === 'Escape') {
      closeSheet();
      return;
    }
    if (!el('sheet').hidden) return;
    if (event.target instanceof HTMLElement && event.target.closest('button') && (event.key === 'Enter' || event.key === ' ')) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      onSow();
    } else if (event.key === 'u' || event.key === 'U') onUndo();
    else if (event.key === 'r' || event.key === 'R') onRestart();
    else if (event.key === 'm' || event.key === 'M') onMute();
    else if (event.key === 'q' || event.key === 'Q') onRotate();
    else if (event.key === '1') onSeed('flower');
    else if (event.key === '2') onSeed('hedge');
    else if (event.key === 'Backspace') onRecycle();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLoop();
    else startLoop();
  });
  const observer = new ResizeObserver(() => {
    fit();
    draw();
  });
  observer.observe(el('stage'));
}

window.__WG = {
  get session() { return session; },
  preview() { return preview(session); },
  cause() { return el('cause').textContent; },
  wish() { return wishState(session.garden, shown); },
  busy() { return busy; },
  audio() {
    return { want: audioState.want, unlocked: audioState.unlocked, muted: !audioState.want };
  },
  layout() { return { cell: layout.cell, cssW: layout.cssW, cssH: layout.cssH }; },
  cellCenter,
  plants() { return shown.plants.map((plant) => ({ ...plant })); },
  dirs() { return { ...shown.dirs }; },
  fps() {
    if (frameGaps.length < 8) return 0;
    const sum = frameGaps.reduce((total, gap) => total + gap, 0);
    return (frameGaps.length * 1000) / sum;
  },
  maxGap() {
    return frameGaps.reduce((max, gap) => Math.max(max, gap), 0);
  },
  setAnimScale(value) { animScale = value; },
};

loadMeta();
bind();
boot(save.lastId);
startLoop();
