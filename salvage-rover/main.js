import { profileOf, routeById, ROUTES } from './routes.js';
import {
  PARTS,
  SLOTS,
  clearSlot,
  cloneAssembly,
  coach,
  initialAssembly,
  normalize,
  place,
  preview,
  setLoad,
  simulate,
  unlockedParts,
  unlockedRoutes,
  weigh,
} from './sim.js';

const KEY = 'salvage-rover-progress-v1';
const FONT = '"WenQuanYi Micro Hei", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif';
const COLORS = { battery: '#e2a21a', bed: '#e07a3d', winch: '#3d7ec4', tracks: '#5e7d55' };
const POSE = { lift: '离地', sink: '陷住', slip: '打滑', dead: '没电', short: '不够', arrive: '送到', idle: '不转' };
const SLOT_META = {
  front: ['前槽', '车头'],
  mid: ['中槽', '车身'],
  rear: ['后槽', '后轮'],
};

const params = new URLSearchParams(location.search);
const instant = params.has('instant');
const stepMs = 280;

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const coachEl = document.getElementById('coach');
const statusEl = document.getElementById('status');

const assemblies = {
  yard: initialAssembly('yard'),
  steep: initialAssembly('steep'),
  mud: initialAssembly('mud'),
};
let routeId = 'yard';
let cleared = new Set();
let selected = null;
let result = null;
let phase = 'edit';
let frameIndex = 0;
let note = '';
let timer = 0;

function current() {
  return assemblies[routeId];
}

function route() {
  return routeById(routeId);
}

function stopPlay() {
  clearTimeout(timer);
  timer = 0;
  if (phase === 'play') phase = 'edit';
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      cleared: [...cleared],
      assemblies,
      routeId,
    }));
  } catch {
    // Private browsing can refuse the write. The run still finishes.
  }
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw) return;
    cleared = new Set((raw.cleared || []).filter((id) => ROUTES.some((item) => item.id === id)));
    for (const item of ROUTES) {
      if (!raw.assemblies?.[item.id]) continue;
      try {
        assemblies[item.id] = normalize(raw.assemblies[item.id]);
      } catch {
        assemblies[item.id] = initialAssembly(item.id);
      }
    }
    if (ROUTES.some((item) => item.id === raw.routeId) && unlockedRoutes(cleared).has(raw.routeId)) {
      routeId = raw.routeId;
    }
  } catch {
    localStorage.removeItem(KEY);
  }
}

function edit(next, message) {
  stopPlay();
  assemblies[routeId] = next;
  result = null;
  phase = 'edit';
  frameIndex = 0;
  note = message;
  save();
  render();
}

function selectPart(partId) {
  const open = unlockedParts(cleared);
  if (!open.has(partId)) return;
  selected = selected === partId ? null : partId;
  render();
}

function onSlot(slot) {
  const fitted = current();
  if (!selected) {
    if (fitted[slot]) selected = fitted[slot];
    render();
    return;
  }
  if (!unlockedParts(cleared).has(selected)) return;
  if (fitted[slot] === selected) {
    edit(clearSlot(fitted, slot), '装配改了，按试车重新跑。');
  } else {
    edit(place(fitted, selected, slot), '装配改了，按试车重新跑。');
  }
  selected = null;
  render();
}

function changeLoad(delta) {
  const fitted = current();
  if (!SLOTS.some((slot) => fitted[slot] === 'bed')) return;
  edit(setLoad(fitted, fitted.load + delta), '装载改了，按试车重新跑。');
}

function resetAssembly() {
  stopPlay();
  assemblies[routeId] = initialAssembly(routeId);
  selected = null;
  result = null;
  phase = 'edit';
  frameIndex = 0;
  note = '装配已回到这条路的起点。';
  save();
  render();
}

function wipe() {
  stopPlay();
  cleared = new Set();
  for (const item of ROUTES) assemblies[item.id] = initialAssembly(item.id);
  routeId = 'yard';
  selected = null;
  result = null;
  phase = 'edit';
  frameIndex = 0;
  note = '进度已清空，回到坡底试车。';
  save();
  render();
}

function selectRoute(id) {
  if (!unlockedRoutes(cleared).has(id) || id === routeId) return;
  stopPlay();
  routeId = id;
  selected = null;
  result = null;
  phase = 'edit';
  frameIndex = 0;
  note = '';
  save();
  render();
}

function run() {
  stopPlay();
  const fitted = cloneAssembly(current());
  result = simulate(fitted, route());
  note = '';
  const frames = result.frames;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finish = () => {
    phase = 'done';
    frameIndex = frames.length - 1;
    if (result.ok) cleared.add(routeId);
    save();
    render();
  };
  if (instant || reduce) {
    finish();
    return;
  }
  phase = 'play';
  frameIndex = 0;
  const paint = () => {
    if (frameIndex >= frames.length - 1) {
      finish();
      return;
    }
    render();
    timer = setTimeout(() => {
      frameIndex += 1;
      paint();
    }, stepMs);
  };
  paint();
}

function shown() {
  const fitted = current();
  if (result && phase !== 'edit') {
    const frame = result.frames[Math.min(frameIndex, result.frames.length - 1)];
    return { fitted: result.assembly, frame };
  }
  const view = preview(fitted);
  return {
    fitted,
    frame: {
      x: 0,
      y: 0,
      energy: view.energy,
      cargo: 0,
      front: view.empty.front,
      rear: view.empty.rear,
      grip: view.empty.grip,
      drive: view.drive,
      pose: 'ready',
      step: 0,
      event: '',
    },
  };
}

function render() {
  const item = route();
  const fitted = current();
  const { frame } = shown();
  const openRoutes = unlockedRoutes(cleared);
  const openParts = unlockedParts(cleared);
  document.getElementById('route-name').textContent = item.name;
  document.getElementById('goal').textContent = `目标 ${item.goal} 箱`;
  document.getElementById('cargo-hud').textContent = `货 ${frame.cargo}/${item.goal}`;
  document.getElementById('energy-hud').textContent = `电 ${frame.energy}`;
  coachEl.textContent = coach({
    routeId,
    assembly: fitted,
    result: phase === 'play' ? { code: 'running' } : result,
    selected,
  });

  let code = '';
  if (phase === 'play') {
    const extra = frame.event ? `　${frame.event}` : '';
    statusEl.textContent = `第 ${frame.step} / ${item.steps.length} 步　电 ${frame.energy}　货 ${frame.cargo}${extra}`;
    code = 'running';
  } else if (phase === 'done' && result) {
    statusEl.textContent = result.reason;
    code = result.code;
  } else if (note) {
    statusEl.textContent = note;
  } else {
    statusEl.textContent = '还没试车。';
  }
  statusEl.dataset.code = code;

  for (const candidate of ROUTES) {
    const button = document.getElementById(`route-${candidate.id}`);
    const locked = !openRoutes.has(candidate.id);
    const mark = cleared.has(candidate.id) ? ' ✓' : '';
    button.textContent = candidate.name + mark;
    button.disabled = locked;
    button.setAttribute('aria-pressed', String(candidate.id === routeId));
    button.title = locked ? '先通过上一条路线' : candidate.blurb;
  }

  for (const partId of Object.keys(PARTS)) {
    const button = document.getElementById(`part-${partId}`);
    const part = PARTS[partId];
    const where = SLOTS.find((slot) => fitted[slot] === partId);
    const locked = !openParts.has(partId);
    button.disabled = locked;
    button.setAttribute('aria-pressed', String(selected === partId));
    const placeLabel = where ? `在${SLOT_META[where][0]}` : locked ? '通关后解锁' : part.blurb;
    button.innerHTML = `<span class="part-name">${part.name}</span><span class="part-blurb">${placeLabel}</span>`;
  }

  for (const slot of SLOTS) {
    const button = document.getElementById(`slot-${slot}`);
    const [title, sub] = SLOT_META[slot];
    const partId = fitted[slot];
    button.classList.toggle('filled', Boolean(partId));
    button.classList.toggle('target', Boolean(selected));
    button.style.setProperty('--part', partId ? COLORS[partId] : 'transparent');
    button.innerHTML = `<span class="slot-k">${title}</span><span class="slot-sub">${sub}</span><span class="slot-part">${partId ? PARTS[partId].name : '空'}</span>`;
    button.setAttribute('aria-label', `${title} ${partId ? PARTS[partId].name : '空'}`);
  }

  const hasBed = SLOTS.some((slot) => fitted[slot] === 'bed');
  document.getElementById('load-dec').disabled = !hasBed || fitted.load <= 0;
  document.getElementById('load-inc').disabled = !hasBed || fitted.load >= 3;
  document.getElementById('load-value').textContent = hasBed ? `本次装载 ${fitted.load} 箱` : '先装货箱';
  document.getElementById('run').disabled = phase === 'play';
  document.getElementById('run').textContent = phase === 'play' ? '试车中' : result && phase === 'done' ? '再试一次' : '试车';

  const view = preview(fitted);
  const carry = hasBed ? Math.min(fitted.load, item.supply) : 0;
  const carried = weigh(fitted, carry);
  const drive = view.drive === 'front' ? '前轮' : view.drive === 'rear' ? '后轮' : '无';
  const hot = (front, rear) => (rear > front ? ' class="hot"' : '');
  document.getElementById('preview').innerHTML =
    `空车 前 ${view.empty.front} / 后 <span${hot(view.empty.front, view.empty.rear)}>${view.empty.rear}</span>` +
    `　这趟 ${carry} 箱 前 ${carried.front} / 后 <span${hot(carried.front, carried.rear)}>${carried.rear}</span>` +
    `　驱动 ${drive}`;
  draw();
}

function draw() {
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (cssW < 2 || cssH < 2) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const bitmapW = Math.round(cssW * dpr);
  const bitmapH = Math.round(cssH * dpr);
  if (canvas.width !== bitmapW || canvas.height !== bitmapH) {
    canvas.width = bitmapW;
    canvas.height = bitmapH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const item = route();
  const { fitted, frame } = shown();
  const cam = camera(frame, item, cssW, cssH);
  drawSky(cssW, cssH);
  drawGround(item, cam, cssW, cssH);
  drawSupplies(item, frame, cam);
  drawRover(fitted, frame, cam);
  drawReadout(frame, item, cssW);
}

function camera(frame, item, width, height) {
  const anchorY = height * 0.7;
  const rise = Math.max(16, Math.min(44, (anchorY - 62) / 2.5));
  const step = Math.max(52, Math.min(86, width / 5.4));
  const maxX = item.steps.length;
  const rightPad = 168;
  let origin = frame.x * step - Math.min(width * 0.32, Math.max(80, width - rightPad));
  origin = Math.max(-44, Math.min(origin, Math.max(-44, maxX * step - width + rightPad)));
  return {
    X: (x) => x * step - origin,
    Y: (y) => anchorY - (y - frame.y) * rise,
  };
}

function drawSky(width, height) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#f6d7a2');
  sky.addColorStop(1, '#e7b48a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  void width;
}

function drawGround(item, cam, width, height) {
  const points = profileOf(item);
  ctx.beginPath();
  ctx.moveTo(cam.X(-1), height + 4);
  ctx.lineTo(cam.X(-1), cam.Y(0));
  for (const point of points) ctx.lineTo(cam.X(point.x), cam.Y(point.y));
  const end = points[points.length - 1];
  ctx.lineTo(cam.X(end.x + 1.4), cam.Y(end.y));
  ctx.lineTo(cam.X(end.x + 1.4), height + 4);
  ctx.closePath();
  ctx.fillStyle = '#6d513c';
  ctx.fill();

  for (let index = 0; index < item.steps.length; index += 1) {
    const step = item.steps[index];
    const y0 = points[index].y;
    const y1 = points[index + 1].y;
    if (step.surface === 'mud') drawMud(cam, index, y0, y1);
    if (step.grade >= 2) drawSteep(cam, index, y0, y1);
  }

  ctx.beginPath();
  ctx.moveTo(cam.X(-1), cam.Y(0));
  for (const point of points) ctx.lineTo(cam.X(point.x), cam.Y(point.y));
  ctx.lineTo(cam.X(end.x + 1.4), cam.Y(end.y));
  ctx.strokeStyle = '#2b2118';
  ctx.lineWidth = 3;
  ctx.stroke();

  flag(cam, 0, 0, '出发', '#2b2118');
  flag(cam, item.steps.length + 0.35, end.y, '回收', '#2f7d4a');
}

function drawMud(cam, index, y0, y1) {
  ctx.fillStyle = '#3e2c22';
  ctx.beginPath();
  ctx.moveTo(cam.X(index), cam.Y(y0));
  ctx.lineTo(cam.X(index + 1), cam.Y(y1));
  ctx.lineTo(cam.X(index + 1), cam.Y(y1) + 22);
  ctx.lineTo(cam.X(index), cam.Y(y0) + 22);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(242, 214, 176, .45)';
  ctx.lineWidth = 2;
  const left = cam.X(index);
  const right = cam.X(index + 1);
  for (let x = left - 10; x < right + 10; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, cam.Y(y0) - 8);
    ctx.lineTo(x + 14, cam.Y(y0) + 24);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSteep(cam, index, y0, y1) {
  ctx.strokeStyle = 'rgba(255, 236, 190, .8)';
  ctx.lineWidth = 2;
  const x0 = cam.X(index + 0.35);
  const x1 = cam.X(index + 0.65);
  const mid = (cam.Y(y0) + cam.Y(y1)) / 2;
  ctx.beginPath();
  ctx.moveTo(x0, mid + 8);
  ctx.lineTo((x0 + x1) / 2, mid - 6);
  ctx.lineTo(x1, mid + 8);
  ctx.stroke();
}

function flag(cam, x, y, label, color) {
  const px = cam.X(x);
  const py = cam.Y(y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - 42);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(px, py - 42);
  ctx.lineTo(px + 28, py - 34);
  ctx.lineTo(px, py - 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2b2118';
  ctx.font = `700 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, px + 8, py - 46);
}

function drawSupplies(item, frame, cam) {
  const points = profileOf(item);
  item.steps.forEach((step, index) => {
    if (!step.pickup || frame.x > index) return;
    const y = points[index].y;
    for (let i = 0; i < step.pickup; i += 1) {
      crate(cam.X(index + 0.55) + (i - (step.pickup - 1) / 2) * 14, cam.Y(y) - 8);
    }
  });
}

function crate(x, y) {
  ctx.fillStyle = '#e07a3d';
  ctx.strokeStyle = '#2b2118';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(x - 6, y - 12, 12, 12);
  ctx.fill();
  ctx.stroke();
}

function drawRover(fitted, frame, cam) {
  const rear = { x: cam.X(frame.x) - 6, y: cam.Y(frame.y) };
  if (frame.pose === 'sink') rear.y += 20;
  const angle = frame.pose === 'lift' ? -0.32 : 0;
  ctx.save();
  ctx.translate(rear.x, rear.y);
  ctx.rotate(angle);
  if (SLOTS.some((slot) => fitted[slot] === 'tracks')) {
    ctx.strokeStyle = '#2f3d2c';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(74, -8);
    ctx.stroke();
  }
  wheel(0, -16, frame.step, frame.drive === 'rear' && frame.pose === 'slip');
  wheel(74, -16, frame.step, frame.drive === 'front' && frame.pose === 'slip');
  ctx.fillStyle = '#d7ddd8';
  ctx.strokeStyle = '#2b2118';
  ctx.lineWidth = 2;
  roundRect(ctx, -18, -40, 108, 22, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e8e0c8';
  roundRect(ctx, 48, -56, 28, 18, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffb703';
  ctx.beginPath();
  ctx.arc(62, -58, 4, 0, Math.PI * 2);
  ctx.fill();
  for (const slot of SLOTS) drawBay(slot, fitted[slot], frame);
  if (fitted.front === 'winch') {
    ctx.strokeStyle = '#3d7ec4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(96, -30);
    ctx.lineTo(118, -46);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(118, -46, 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  const frontX = rear.x + Math.cos(angle) * 74;
  const frontY = rear.y + Math.sin(angle) * 74;
  pill(rear.x, rear.y - 70, `后 ${frame.rear}`, false);
  pill(frontX, frontY - 70, `前 ${frame.front}`, frame.pose === 'lift');
  if (frame.event) tag(rear.x + 40, rear.y + 28, frame.event, '#8a4b12');
}

function wheel(x, y, step, spinning) {
  ctx.fillStyle = '#1c1c1c';
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = spinning ? '#ffb4a2' : '#d7ddd8';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(step) * 9, y + Math.sin(step) * 9);
  ctx.stroke();
}

function drawBay(slot, partId, frame) {
  const x = slot === 'rear' ? -8 : slot === 'mid' ? 28 : 64;
  ctx.fillStyle = partId ? COLORS[partId] : 'rgba(43, 33, 24, .18)';
  ctx.strokeStyle = '#2b2118';
  ctx.lineWidth = 2;
  roundRect(ctx, x, -56, 26, 16, 4);
  ctx.fill();
  ctx.stroke();
  if (partId === 'bed') {
    const boxes = Math.min(3, frame.cargo);
    for (let i = 0; i < boxes; i += 1) crate(x + 13, -58 - i * 8);
  }
  if (partId === 'battery') {
    ctx.fillStyle = frame.pose === 'dead' ? '#6b5a3e' : '#fff8ea';
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('电', x + 13, -48);
  }
}

function pill(x, y, text, hot) {
  ctx.font = `700 13px ${FONT}`;
  const width = ctx.measureText(text).width + 14;
  ctx.fillStyle = hot ? '#9d2c22' : 'rgba(28, 22, 16, .84)';
  roundRect(ctx, x - width / 2, y - 12, width, 22, 8);
  ctx.fill();
  ctx.fillStyle = '#fff8ea';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - 1);
}

function tag(x, y, text, color) {
  ctx.font = `700 14px ${FONT}`;
  const width = ctx.measureText(text).width + 16;
  ctx.fillStyle = color;
  roundRect(ctx, x - width / 2, y - 12, width, 24, 8);
  ctx.fill();
  ctx.fillStyle = '#fff8ea';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function drawReadout(frame, item, width) {
  ctx.font = `700 14px ${FONT}`;
  const label = `步 ${frame.step}/${item.steps.length}  电 ${frame.energy}  货 ${frame.cargo}`;
  const boxW = ctx.measureText(label).width + 18;
  ctx.fillStyle = 'rgba(28, 22, 16, .78)';
  roundRect(ctx, 10, 10, boxW, 28, 8);
  ctx.fill();
  ctx.fillStyle = '#fff8ea';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 19, 24);
  if (!POSE[frame.pose]) return;
  const banner = POSE[frame.pose];
  ctx.font = `700 16px ${FONT}`;
  const bannerW = ctx.measureText(banner).width + 22;
  const x = width - bannerW - 12;
  ctx.fillStyle = frame.pose === 'arrive' ? '#2f7d4a' : '#9d2c22';
  roundRect(ctx, x, 10, bannerW, 28, 8);
  ctx.fill();
  ctx.fillStyle = '#fff8ea';
  ctx.textAlign = 'center';
  ctx.fillText(banner, x + bannerW / 2, 24);
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

document.getElementById('parts').addEventListener('click', (event) => {
  const button = event.target.closest('[data-part]');
  if (!button || button.disabled) return;
  selectPart(button.dataset.part);
});
document.getElementById('slots').addEventListener('click', (event) => {
  const button = event.target.closest('[data-slot]');
  if (!button) return;
  onSlot(button.dataset.slot);
});
document.getElementById('routes').addEventListener('click', (event) => {
  const button = event.target.closest('[data-route]');
  if (!button || button.disabled) return;
  selectRoute(button.dataset.route);
});
document.getElementById('load-dec').addEventListener('click', () => changeLoad(-1));
document.getElementById('load-inc').addEventListener('click', () => changeLoad(1));
document.getElementById('run').addEventListener('click', run);
document.getElementById('reset').addEventListener('click', resetAssembly);
document.getElementById('wipe').addEventListener('click', wipe);
document.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === 'enter') {
    if (event.target.closest && event.target.closest('button')) return;
    event.preventDefault();
    run();
  } else if (key === '0') resetAssembly();
  else if (key === '1') selectPart('battery');
  else if (key === '2') selectPart('bed');
  else if (key === '3') selectPart('winch');
  else if (key === '4') selectPart('tracks');
  else if (key === 'q') onSlot('front');
  else if (key === 'w') onSlot('mid');
  else if (key === 'e') onSlot('rear');
  else if (key === '-' || key === '_') changeLoad(-1);
  else if (key === '=' || key === '+') changeLoad(1);
});

new ResizeObserver(() => draw()).observe(document.getElementById('stage'));
load();
render();

window.__SR = {
  simulate,
  snapshot() {
    return {
      routeId,
      assembly: cloneAssembly(current()),
      code: result?.code ?? null,
      phase,
      cleared: [...cleared],
      frame: frameIndex,
    };
  },
};
