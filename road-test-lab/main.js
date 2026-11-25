import {
  FIXED_DT,
  PIECE_W,
  REASON_TEXT,
  TYPE_LABEL,
  createAccumulator,
  groundAt,
  pieceIndexAt,
} from './sim.js';
import {
  createGame,
  current,
  editPiece,
  poseOf,
  rearm,
  restoreTrack,
  selectPiece,
  selectTrack,
  tick,
} from './session.js';
import { TRACKS } from './tracks.js';

const BEST_KEY = 'road-test-lab-best-v1';
const COLORS = {
  flat: '#5f7d62',
  ramp: '#e0a15a',
  steep: '#d4654a',
  kicker: '#7a68b8',
  gap: '#c46a5a',
};

const canvas = document.querySelector('#view');
const ctx = canvas.getContext('2d');
const hintEl = document.querySelector('#hint');
const statusEl = document.querySelector('#status');
const timerEl = document.querySelector('#timer');
const bestEl = document.querySelector('#best');
const levelEl = document.querySelector('#level-name');
const solutionEl = document.querySelector('#solution');
const piecesEl = document.querySelector('#pieces');
const tracksEl = document.querySelector('#tracks');
const rotateBtn = document.querySelector('#rotate');

const held = { throttle: false, brake: false };
const keyDown = new Set();
let view = null;
let uiSig = '';
let savedBest = '';

function loadBest() {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveBest(game) {
  const map = {};
  for (const session of game.sessions) {
    if (session.best != null) map[session.track.id] = session.best;
  }
  const text = JSON.stringify(map);
  if (text === savedBest) return;
  savedBest = text;
  try {
    localStorage.setItem(BEST_KEY, text);
  } catch {
    // Private mode can reject storage. The run still stands.
  }
}

const game = createGame(TRACKS, loadBest());
savedBest = JSON.stringify(loadBest());

function inputNow() {
  if (held.brake) return { throttle: false, brake: true };
  return { throttle: held.throttle, brake: false };
}

function fmt(time) {
  return `${time.toFixed(1)} 秒`;
}

function rotLabel(piece) {
  if (piece.type === 'flat' || piece.type === 'gap') return '';
  return piece.rot ? '下' : '上';
}

function syncTracks() {
  tracksEl.replaceChildren();
  game.tracks.forEach((track, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.track = String(index);
    button.textContent = track.name;
    button.setAttribute('aria-pressed', index === game.index ? 'true' : 'false');
    button.addEventListener('click', () => {
      selectTrack(game, index);
      uiSig = '';
    });
    tracksEl.appendChild(button);
  });
}

function syncPieces(session) {
  piecesEl.replaceChildren();
  session.pieces.forEach((piece, index) => {
    if (!piece.editable) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.index = String(index);
    const facing = rotLabel(piece);
    button.textContent = `${index + 1} ${TYPE_LABEL[piece.type]}${facing ? ` ${facing}` : ''}`;
    button.setAttribute('aria-pressed', session.selected === index ? 'true' : 'false');
    button.disabled = session.phase !== 'fail' || session.editsLeft < 1;
    button.addEventListener('click', () => {
      selectPiece(session, index);
      uiSig = '';
    });
    piecesEl.appendChild(button);
  });
}

function syncEdit(session) {
  const piece = session.selected == null ? null : session.pieces[session.selected];
  const open = session.phase === 'fail' && session.editsLeft > 0 && piece && piece.editable;
  rotateBtn.disabled = !open || piece.type === 'flat' || piece.type === 'gap';
  for (const button of document.querySelectorAll('#edit button[data-type]')) {
    const type = button.dataset.type;
    button.disabled = !open || piece.type === type;
  }
}

function statusText(session) {
  const pose = poseOf(session);
  if (session.phase === 'win') return `到达终点，用时 ${fmt(pose.time)}。重开可以和这条影子比。`;
  if (session.phase === 'fail') {
    const why = REASON_TEXT[pose.reason] || '这一跑停了。';
    if (session.editsLeft > 0) return `${why} 还可以改 1 段路。`;
    return `${why} 这段已经改过，按重开再跑。`;
  }
  if (session.phase === 'run') return '油门和刹车都算数。终点旗在赛道尽头。';
  if (session.ghost) return '浅色车停在上一跑结束的地方。按住油门再开。';
  return '按住油门发车。桌面用方向键，手机用下方大按钮。';
}

function syncStatic(session) {
  const sig = [
    game.index,
    session.phase,
    session.editsLeft,
    session.selected,
    session.best,
    session.pieces.map((piece) => `${piece.type}:${piece.rot}`).join('|'),
  ].join(';');
  if (sig === uiSig) return;
  uiSig = sig;
  levelEl.textContent = `第 ${game.index + 1} 关 · ${session.track.name}`;
  hintEl.textContent = session.track.hint;
  solutionEl.textContent = `本关示例：${session.track.solution}`;
  bestEl.textContent = session.best == null ? '最好 —' : `最好 ${fmt(session.best)}`;
  statusEl.textContent = statusText(session);
  syncTracks();
  syncPieces(session);
  syncEdit(session);
  saveBest(game);
}

function syncTimer(session) {
  const pose = poseOf(session);
  const time = session.phase === 'ready' ? 0 : pose.time;
  timerEl.textContent = fmt(time);
  if (session.phase === 'run') statusEl.textContent = statusText(session);
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function cameraFor(pose, road) {
  const cssW = canvas.clientWidth || 1;
  const cssH = canvas.clientHeight || 1;
  const ppm = Math.max(34, Math.min(72, cssH / 6.6));
  const viewW = cssW / ppm;
  let left = pose.x - viewW * 0.34;
  left = Math.max(-1.4, Math.min(left, Math.max(-1.4, road.length - viewW + 1.2)));
  return { ppm, left, focusY: Math.max(1.2, pose.y + 0.2), w: cssW, h: cssH };
}

function screen(cam, x, y) {
  return {
    x: (x - cam.left) * cam.ppm,
    y: cam.h * 0.62 - (y - cam.focusY) * cam.ppm,
  };
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

function surfacePoints(road, piece) {
  const points = [];
  const steps = 14;
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.min(piece.x0 + (PIECE_W * i) / steps, piece.x1 - 0.001);
    const ground = groundAt(road, x);
    if (!ground) {
      if (points.length) break;
      continue;
    }
    points.push({ x, y: ground.y });
  }
  return points;
}

function drawRibbon(cam, points, color) {
  if (points.length < 2) return;
  const depth = 0.9;
  ctx.beginPath();
  points.forEach((point, index) => {
    const p = screen(cam, point.x, point.y);
    if (index === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const p = screen(cam, points[i].x, points[i].y - depth);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#241c16';
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((point, index) => {
    const p = screen(cam, point.x, point.y);
    if (index === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();
}

function drawRoad(cam, road, selected) {
  for (let i = 0; i < road.pieces.length; i += 1) {
    const piece = road.pieces[i];
    if (piece.type === 'gap') {
      const left = screen(cam, piece.x0, piece.entry);
      const right = screen(cam, piece.x1, piece.entry - 2.4);
      ctx.fillStyle = 'rgba(90, 58, 40, 0.28)';
      ctx.fillRect(left.x, left.y, right.x - left.x, right.y - left.y);
      ctx.save();
      ctx.strokeStyle = COLORS.gap;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(left.x + 10, left.y + 8);
      ctx.lineTo(right.x - 10, right.y - 8);
      ctx.moveTo(right.x - 10, left.y + 8);
      ctx.lineTo(left.x + 10, right.y - 8);
      ctx.stroke();
      ctx.restore();
    } else {
      drawRibbon(cam, surfacePoints(road, piece), COLORS[piece.type] || '#666');
    }
    const crown = Math.max(piece.entry, piece.exit);
    const mid = screen(cam, (piece.x0 + piece.x1) / 2, crown + 0.48);
    ctx.fillStyle = piece.editable ? '#241c16' : '#6d5c4c';
    ctx.font = `700 ${Math.max(13, cam.ppm * 0.3)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), mid.x, mid.y);
    if (i === selected) {
      const top = screen(cam, piece.x0, crown + 0.85);
      const bottom = screen(cam, piece.x1, Math.min(piece.entry, piece.exit) - 1.15);
      ctx.strokeStyle = '#ffe08a';
      ctx.lineWidth = 3;
      ctx.strokeRect(top.x, top.y, bottom.x - top.x, bottom.y - top.y);
    }
  }
}

function drawFlag(cam, road) {
  const ground = groundAt(road, road.finishX) || { y: road.pieces[road.finishIndex].entry };
  const base = screen(cam, road.finishX, ground.y);
  const top = screen(cam, road.finishX, ground.y + 1.35);
  ctx.strokeStyle = '#241c16';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(top.x, top.y);
  ctx.stroke();
  const size = Math.max(6, cam.ppm * 0.16);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#241c16' : '#f7f1e4';
      ctx.fillRect(top.x + col * size, top.y + row * size, size, size);
    }
  }
}

function drawCar(cam, pose, ghost) {
  const p = screen(cam, pose.x, pose.y);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-pose.angle);
  const u = cam.ppm;
  ctx.globalAlpha = ghost ? 0.55 : 1;
  ctx.fillStyle = ghost ? '#f7f1e4' : '#2a241f';
  ctx.strokeStyle = '#241c16';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-0.42 * u, -0.02 * u, 0.2 * u, 0, Math.PI * 2);
  ctx.arc(0.48 * u, -0.02 * u, 0.2 * u, 0, Math.PI * 2);
  ctx.fill();
  if (!ghost) ctx.stroke();
  ctx.fillStyle = ghost ? 'rgba(255,255,255,0.35)' : '#d84a32';
  roundRect(-0.78 * u, -0.62 * u, 1.55 * u, 0.48 * u, 0.12 * u);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ghost ? 'rgba(255,255,255,0.55)' : '#f7f1e4';
  roundRect(-0.15 * u, -0.92 * u, 0.72 * u, 0.36 * u, 0.08 * u);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function sampleAt(samples, time) {
  if (!samples.length) return null;
  const index = Math.min(samples.length - 1, Math.max(0, Math.round(time / FIXED_DT) - 1));
  return samples[index];
}

function drawGhost(cam, session) {
  const ghost = session.ghost;
  if (!ghost || !ghost.samples.length) return;
  ctx.beginPath();
  ghost.samples.forEach((sample, index) => {
    const p = screen(cam, sample.x, sample.y);
    if (index === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.stroke();
  const pose = session.phase === 'run' && session.run
    ? sampleAt(ghost.samples, session.run.state.time)
    : ghost.samples[ghost.samples.length - 1];
  if (!pose) return;
  drawCar(cam, pose, true);
  const label = screen(cam, pose.x, pose.y + 1.15);
  ctx.fillStyle = '#241c16';
  ctx.font = '12px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('上一跑', label.x, label.y);
}

function drawBackdrop(cam) {
  const sky = ctx.createLinearGradient(0, 0, 0, cam.h);
  sky.addColorStop(0, '#f6d7b0');
  sky.addColorStop(0.55, '#f3e2c4');
  sky.addColorStop(1, '#d7efe4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, cam.w, cam.h);
  ctx.fillStyle = 'rgba(142, 170, 144, 0.35)';
  const shift = (cam.left * cam.ppm * 0.15) % (cam.w + 200);
  ctx.beginPath();
  ctx.ellipse(cam.w * 0.25 - shift, cam.h * 0.22, cam.w * 0.28, 36, 0, 0, Math.PI * 2);
  ctx.ellipse(cam.w * 0.78 - shift * 0.6, cam.h * 0.16, cam.w * 0.22, 28, 0, 0, Math.PI * 2);
  ctx.fill();
}

function render() {
  resize();
  const session = current(game);
  const pose = poseOf(session);
  const cam = cameraFor(pose, session.road);
  view = cam;
  const dpr = canvas.width / cam.w;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackdrop(cam);
  drawRoad(cam, session.road, session.selected);
  drawFlag(cam, session.road);
  drawGhost(cam, session);
  drawCar(cam, pose, false);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function bindHold(button, name) {
  const down = (event) => {
    event.preventDefault();
    held[name] = true;
    if (event.pointerId != null && button.setPointerCapture) {
      button.setPointerCapture(event.pointerId);
    }
  };
  const up = (event) => {
    if (event && event.pointerId != null && button.hasPointerCapture?.(event.pointerId)) {
      button.releasePointerCapture(event.pointerId);
    }
    held[name] = false;
  };
  button.addEventListener('pointerdown', down);
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);
  button.addEventListener('contextmenu', (event) => event.preventDefault());
}

bindHold(document.querySelector('#throttle'), 'throttle');
bindHold(document.querySelector('#brake'), 'brake');

document.querySelector('#rearm').addEventListener('click', () => {
  rearm(current(game));
  uiSig = '';
});
document.querySelector('#restore').addEventListener('click', () => {
  restoreTrack(current(game));
  uiSig = '';
});
rotateBtn.addEventListener('click', () => {
  const session = current(game);
  if (session.selected == null) return;
  editPiece(session, session.selected, 'rotate');
  uiSig = '';
});
for (const button of document.querySelectorAll('#edit button[data-type]')) {
  button.addEventListener('click', () => {
    const session = current(game);
    if (session.selected == null) return;
    editPiece(session, session.selected, 'replace', button.dataset.type);
    uiSig = '';
  });
}

canvas.addEventListener('pointerdown', (event) => {
  const session = current(game);
  if (!view || session.phase !== 'fail') return;
  const rect = canvas.getBoundingClientRect();
  const worldX = view.left + (event.clientX - rect.left) / view.ppm;
  const index = pieceIndexAt(session.road, worldX);
  if (index >= 0) selectPiece(session, index);
  uiSig = '';
});

const THROTTLE_KEYS = new Set(['arrowright', 'd', 'w']);
const BRAKE_KEYS = new Set(['arrowleft', 'a', 's']);

function syncKeys() {
  held.throttle = [...keyDown].some((key) => THROTTLE_KEYS.has(key));
  held.brake = [...keyDown].some((key) => BRAKE_KEYS.has(key));
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (THROTTLE_KEYS.has(key) || BRAKE_KEYS.has(key)) {
    event.preventDefault();
    keyDown.add(key);
    syncKeys();
    return;
  }
  if (event.repeat) return;
  if (key === 'r' || key === 'enter') {
    event.preventDefault();
    rearm(current(game));
    uiSig = '';
  } else if (key === '1' || key === '2' || key === '3') {
    selectTrack(game, Number(key) - 1);
    uiSig = '';
  } else if (key === 'q') {
    const session = current(game);
    if (session.selected != null) editPiece(session, session.selected, 'rotate');
    uiSig = '';
  }
});

window.addEventListener('keyup', (event) => {
  keyDown.delete(event.key.toLowerCase());
  syncKeys();
});
window.addEventListener('blur', () => {
  keyDown.clear();
  held.throttle = false;
  held.brake = false;
});

const clock = createAccumulator();
let last = performance.now();
function frame(now) {
  const frameDt = Math.min(0.25, Math.max(0, (now - last) / 1000));
  last = now;
  const session = current(game);
  const input = inputNow();
  clock.push(frameDt, () => tick(session, input));
  syncStatic(session);
  syncTimer(session);
  render();
  requestAnimationFrame(frame);
}

window.__ROAD = {
  phase: () => current(game).phase,
  trackId: () => current(game).track.id,
  editsLeft: () => current(game).editsLeft,
  selected: () => current(game).selected,
  best: () => current(game).best,
  ghost: () => {
    const ghost = current(game).ghost;
    if (!ghost) return null;
    return {
      n: ghost.samples.length,
      outcome: ghost.outcome,
      reason: ghost.reason,
      x: ghost.x,
      y: ghost.y,
    };
  },
  car: () => {
    const pose = poseOf(current(game));
    return {
      x: pose.x,
      y: pose.y,
      speed: pose.speed,
      outcome: pose.outcome,
      reason: pose.reason,
      time: pose.time,
      grounded: pose.grounded,
    };
  },
  pieces: () => current(game).pieces.map((piece) => ({
    type: piece.type,
    rot: piece.rot,
    editable: !!piece.editable,
  })),
};

requestAnimationFrame(frame);
