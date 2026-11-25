import { decideAi } from './ai.js';
import { RULES, createMatch, idleInput, mouth, resetMatch, tick } from './sim.js';

const canvas = document.querySelector('#pitch');
const ctx = canvas.getContext('2d');
const card = document.querySelector('#card');
const cardKicker = document.querySelector('#card-kicker');
const cardTitle = document.querySelector('#card-title');
const cardBody = document.querySelector('#card-body');
const startMatch = document.querySelector('#start-match');
const spend = document.querySelector('#spend');
const scoreEl = document.querySelector('#score');
const clockEl = document.querySelector('#clock');
const leftName = document.querySelector('#left-name');
const rightName = document.querySelector('#right-name');
const meter = document.querySelector('#meter');
const fill = document.querySelector('#battery-fill');
const batteryText = document.querySelector('#battery-text');
const wireL = document.querySelector('#wire-l');
const wireR = document.querySelector('#wire-r');
const p2controls = document.querySelector('#p2controls');
const keysEl = document.querySelector('#keys');
const modeAi = document.querySelector('#mode-ai');
const modeLocal = document.querySelector('#mode-local');
const muteBtn = document.querySelector('#mute');
const nub = document.querySelector('#nub');
const nub2 = document.querySelector('#nub-p2');

const STEPS = [
  {
    title: '先移动',
    body: '蓝色小车是你。桌面按 WASD 或方向键，手机拖左下摇杆。先把车挪开原位。',
  },
  {
    title: '这块电池是共用的',
    body: '按住 Shift 或「冲刺」。黄条下降时，对手看得到，而且用的是同一块电。松手才回充。耗尽后要回到 16，两边才又能冲刺。',
  },
  {
    title: '踢球也花这块电',
    body: '靠近白球，按空格或「踢球」。够 18 点就大力射门并扣掉；不够就只轻轻碰，不扣电。',
  },
  {
    title: '打一局短的',
    body: '先到 3 分，或 70 秒后分数高的赢。电脑遵守同一块电池，不会偷偷多电。本地双人是同一台设备，不能用来证明联网匹配。',
  },
];

const keys = new Set();
const joy = { x: 0, y: 0 };
const joy2 = { x: 0, y: 0 };
let holdSprint = false;
let holdKick = false;
let holdSprint2 = false;
let holdKick2 = false;
let tutorialStep = 0;
let batteryMark = 100;
let kickMark = 0;
let state = createMatch({ mode: 'ai', phase: 'tutorial' });
let muted = false;
try { muted = localStorage.getItem('shared-battery-arena-mute') === '1'; } catch { muted = false; }

let audioCtx = null;

function blip(freq, dur, type, gain) {
  if (muted) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(amp);
    amp.connect(audioCtx.destination);
    const t = audioCtx.currentTime;
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur);
  } catch {
    // Sound is local and optional. A blocked audio device must not stop the match.
  }
}

function sideNames() {
  if (state.mode === 'local') return ['蓝方', '橙方'];
  return ['你', '电脑'];
}

function blurFocus() {
  const active = document.activeElement;
  if (active && active !== document.body && active.blur) active.blur();
}

function startPlay() {
  state = resetMatch(state);
  tutorialStep = 4;
  blurFocus();
}

function showTutorial() {
  state = createMatch({ mode: state.mode, phase: 'tutorial' });
  tutorialStep = 0;
  batteryMark = state.battery;
  kickMark = 0;
  blurFocus();
}

function setMode(mode) {
  if (state.mode === mode) return;
  state = createMatch({ mode, phase: 'play' });
  tutorialStep = 4;
  blurFocus();
}

function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('shared-battery-arena-mute', muted ? '1' : '0'); } catch { /* private mode */ }
  muteBtn.textContent = muted ? '开声音' : '静音';
  muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
}

function bindStick(el, nubEl, target) {
  let pid = null;
  function place(clientX, clientY) {
    const rect = el.getBoundingClientRect();
    const limit = rect.width * 0.34;
    let x = clientX - (rect.left + rect.width / 2);
    let y = clientY - (rect.top + rect.height / 2);
    const mag = Math.hypot(x, y) || 1;
    const clamped = Math.min(mag, limit);
    target.x = (x / mag) * (clamped / limit);
    target.y = (y / mag) * (clamped / limit);
    nubEl.style.transform = `translate(${(x / mag) * clamped}px, ${(y / mag) * clamped}px)`;
  }
  function reset() {
    pid = null;
    target.x = 0;
    target.y = 0;
    nubEl.style.transform = 'translate(0px, 0px)';
  }
  el.addEventListener('pointerdown', (event) => {
    pid = event.pointerId;
    el.setPointerCapture(pid);
    event.preventDefault();
    place(event.clientX, event.clientY);
  });
  el.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pid) return;
    place(event.clientX, event.clientY);
  });
  el.addEventListener('pointerup', (event) => {
    if (event.pointerId === pid) reset();
  });
  el.addEventListener('pointercancel', reset);
  return reset;
}

function bindHold(el, set) {
  let pid = null;
  el.addEventListener('pointerdown', (event) => {
    pid = event.pointerId;
    el.setPointerCapture(pid);
    event.preventDefault();
    set(true);
  });
  const off = (event) => {
    if (pid == null) return;
    if (event && event.pointerId != null && event.pointerId !== pid) return;
    pid = null;
    set(false);
  };
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
}

const resetJoy = bindStick(document.querySelector('#stick'), nub, joy);
const resetJoy2 = bindStick(document.querySelector('#stick-p2'), nub2, joy2);
bindHold(document.querySelector('#sprint'), (on) => { holdSprint = on; });
bindHold(document.querySelector('#kick'), (on) => { holdKick = on; });
bindHold(document.querySelector('#sprint-p2'), (on) => { holdSprint2 = on; });
bindHold(document.querySelector('#kick-p2'), (on) => { holdKick2 = on; });

function releaseAll() {
  keys.clear();
  holdSprint = false;
  holdKick = false;
  holdSprint2 = false;
  holdKick2 = false;
  resetJoy();
  resetJoy2();
}

window.addEventListener('keydown', (event) => {
  const eat = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter',
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyK', 'KeyL', 'ShiftLeft', 'ShiftRight',
  ]);
  if (eat.has(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.repeat) return;
  if (event.code === 'KeyR' && !event.ctrlKey && !event.metaKey && !event.altKey) startPlay();
  if (event.code === 'KeyM' && !event.ctrlKey && !event.metaKey && !event.altKey) toggleMute();
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', releaseAll);

document.querySelector('#restart').addEventListener('click', startPlay);
document.querySelector('#tutorial').addEventListener('click', showTutorial);
document.querySelector('#skip').addEventListener('click', startPlay);
startMatch.addEventListener('click', startPlay);
modeAi.addEventListener('click', () => setMode('ai'));
modeLocal.addEventListener('click', () => setMode('local'));
muteBtn.addEventListener('click', toggleMute);
muteBtn.textContent = muted ? '开声音' : '静音';
muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');

function axis(neg, pos) {
  return (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0);
}

function readP1() {
  let x = axis('KeyA', 'KeyD');
  let y = axis('KeyW', 'KeyS');
  if (state.mode === 'ai') {
    x += axis('ArrowLeft', 'ArrowRight');
    y += axis('ArrowUp', 'ArrowDown');
  }
  x += joy.x;
  y += joy.y;
  const sprint = holdSprint || keys.has('ShiftLeft') || (state.mode === 'ai' && keys.has('ShiftRight'));
  const kick = holdKick || keys.has('Space');
  return { x, y, sprint, kick };
}

function readP2() {
  if (state.mode !== 'local') return idleInput();
  return {
    x: axis('ArrowLeft', 'ArrowRight') + joy2.x,
    y: axis('ArrowUp', 'ArrowDown') + joy2.y,
    sprint: holdSprint2 || keys.has('ShiftRight') || keys.has('KeyK'),
    kick: holdKick2 || keys.has('KeyL'),
  };
}

function advanceTutorial() {
  if (state.phase !== 'tutorial') return;
  const moved = Math.hypot(state.players[0].x - 168, state.players[0].y - RULES.fieldH / 2) > 26;
  if (tutorialStep === 0 && moved) {
    tutorialStep = 1;
    batteryMark = state.battery;
  } else if (tutorialStep === 1 && state.battery <= batteryMark - 16) {
    tutorialStep = 2;
    kickMark = state.kickCount[0];
  } else if (tutorialStep === 2 && state.kickCount[0] > kickMark) {
    tutorialStep = 3;
  }
}

function cue(prev) {
  const scored = state.score[0] + state.score[1] > prev.score[0] + prev.score[1];
  const kicked = state.kickCount[0] + state.kickCount[1] > prev.kicks[0] + prev.kicks[1];
  if (scored) blip(520, 0.18, 'triangle', 0.05);
  else if (kicked) blip(210, 0.07, 'square', 0.03);
  if (prev.armed && !state.sprintArmed) blip(90, 0.2, 'sawtooth', 0.03);
}

function renderHud() {
  const [self, other] = sideNames();
  const battery = Math.round(state.battery);
  leftName.textContent = self;
  rightName.textContent = other;
  scoreEl.textContent = `${state.score[0]} : ${state.score[1]}`;
  if (state.phase === 'tutorial') clockEl.textContent = '教程';
  else {
    const left = Math.max(0, RULES.matchSeconds - state.time);
    const sec = Math.ceil(left - 1e-9);
    clockEl.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }
  meter.setAttribute('aria-valuenow', String(battery));
  fill.style.width = `${state.battery}%`;
  fill.classList.toggle('low', !state.sprintArmed || state.battery < RULES.sprintMin);
  batteryText.textContent = `共用电池 ${battery}`;
  wireL.classList.toggle('on', state.sprinting[0]);
  wireR.classList.toggle('on', state.sprinting[1]);
  modeAi.setAttribute('aria-pressed', state.mode === 'ai' ? 'true' : 'false');
  modeLocal.setAttribute('aria-pressed', state.mode === 'local' ? 'true' : 'false');
  p2controls.hidden = state.mode !== 'local';
  card.hidden = state.phase !== 'tutorial';
  if (state.phase === 'tutorial') {
    const step = STEPS[Math.min(tutorialStep, STEPS.length - 1)];
    cardKicker.textContent = `教程 ${Math.min(tutorialStep, 3) + 1}/4`;
    cardTitle.textContent = step.title;
    cardBody.textContent = step.body;
    startMatch.hidden = tutorialStep < 3;
  }
  const keyLine = state.mode === 'local'
    ? '蓝方 WASD、左 Shift、空格。橙方方向键、K 冲刺、L 踢球。R 重开。'
    : '桌面：WASD 或方向键移动，Shift 冲刺，空格踢球，R 重开。';
  if (keysEl.textContent !== keyLine) keysEl.textContent = keyLine;

  let line;
  if (state.phase === 'goal') {
    const who = state.lastGoal === 0 ? self : other;
    line = `${who}进球。共用电池还剩 ${battery}，下一球继续用这块。`;
  } else if (state.phase === 'ended') {
    if (state.winner === 'draw') line = '平局。重开会把电量、比分和速度一起清掉。';
    else {
      const who = state.winner === 0 ? self : other;
      line = `${who}赢了。这是单机短局，不是联网对战结果。`;
    }
  } else if (state.sprinting[0] && state.sprinting[1]) {
    line = '两边同时在花电，掉得更快。';
  } else if (state.sprinting[0]) {
    line = `${self}在花电，${other}也能看见，并且一起变少。`;
  } else if (state.sprinting[1]) {
    line = `${other}在花电，${self}也一起变少。`;
  } else if (!state.sprintArmed) {
    line = `电池耗尽。回到 ${RULES.sprintMin} 之前，双方都无法冲刺。`;
  } else if (state.phase === 'tutorial') {
    line = '教程进行中。这块黄条是双方共用的。';
  } else {
    line = '没人在花电，电池正在回充。';
  }
  if (spend.textContent !== line) spend.textContent = line;
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function roundRect(x, y, w, h, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawNet(x, dir) {
  const gate = mouth();
  const depth = 34 * dir;
  ctx.save();
  ctx.beginPath();
  ctx.rect(Math.min(x, x + depth), gate.top, 34, RULES.goalH);
  ctx.clip();
  ctx.fillStyle = 'rgba(6, 14, 10, 0.55)';
  ctx.fillRect(Math.min(x, x + depth), gate.top, 34, RULES.goalH);
  ctx.strokeStyle = 'rgba(236, 220, 176, 0.35)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i <= 6; i++) {
    const y = gate.top + (RULES.goalH * i) / 6;
    ctx.beginPath();
    ctx.moveTo(x, gate.top);
    ctx.lineTo(x + depth, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#ead9a4';
  ctx.lineWidth = 4;
  ctx.strokeRect(Math.min(x, x + depth), gate.top, 34, RULES.goalH);
}

function drawCar(player, color, sprinting) {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.facing);
  if (sprinting) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-36, -6);
    ctx.moveTo(-18, 0);
    ctx.lineTo(-36, 6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#14120f';
  ctx.fillRect(-16, -16, 8, 5);
  ctx.fillRect(-16, 11, 8, 5);
  ctx.fillRect(6, -16, 8, 5);
  ctx.fillRect(6, 11, 8, 5);
  ctx.fillStyle = color;
  roundRect(-16, -12, 32, 24, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 248, 230, 0.85)';
  ctx.fillRect(-4, -7, 8, 14);
  ctx.fillStyle = '#f4efe4';
  ctx.beginPath();
  ctx.moveTo(10, -6);
  ctx.lineTo(20, 0);
  ctx.lineTo(10, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function draw() {
  resize();
  if (canvas.width < 2 || canvas.height < 2) return;
  const padX = 46;
  const padY = 24;
  const worldW = RULES.fieldW + padX * 2;
  const worldH = RULES.fieldH + padY * 2;
  const scale = Math.min(canvas.width / worldW, canvas.height / worldH);
  const ox = (canvas.width - RULES.fieldW * scale) / 2;
  const oy = (canvas.height - RULES.fieldH * scale) / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#101612';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, ox, oy);

  ctx.fillStyle = '#143226';
  ctx.fillRect(0, 0, RULES.fieldW, RULES.fieldH);
  ctx.fillStyle = '#18402f';
  for (let i = 0; i < 10; i += 2) ctx.fillRect(i * 90, 0, 90, RULES.fieldH);

  drawNet(0, -1);
  drawNet(RULES.fieldW, 1);

  ctx.strokeStyle = 'rgba(236, 220, 176, 0.78)';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, RULES.fieldW - 28, RULES.fieldH - 28);
  ctx.beginPath();
  ctx.moveTo(RULES.fieldW / 2, 14);
  ctx.lineTo(RULES.fieldW / 2, RULES.fieldH - 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(RULES.fieldW / 2, RULES.fieldH / 2, 70, 0, Math.PI * 2);
  ctx.stroke();

  const gate = mouth();
  ctx.fillStyle = '#f4efe4';
  for (const x of [0, RULES.fieldW]) {
    for (const y of [gate.top, gate.bot]) {
      ctx.beginPath();
      ctx.arc(x, y, RULES.postR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawCar(state.players[0], '#2a9d8f', state.sprinting[0]);
  drawCar(state.players[1], '#e07a5f', state.sprinting[1]);

  const ball = state.ball;
  ctx.fillStyle = '#f6f1e4';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a241c';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r * 0.55, 0.5, 2.4);
  ctx.stroke();

  if (state.phase === 'goal' || state.phase === 'ended') {
    ctx.fillStyle = 'rgba(12, 14, 12, 0.72)';
    ctx.fillRect(0, 18, RULES.fieldW, 52);
    ctx.fillStyle = '#f4efe4';
    ctx.font = '700 32px "Avenir Next", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let banner = '进球';
    if (state.phase === 'ended') {
      if (state.winner === 'draw') banner = '平局';
      else banner = state.winner === 0 ? `${sideNames()[0]}赢了` : `${sideNames()[1]}赢了`;
    }
    ctx.fillText(banner, RULES.fieldW / 2, 44);
  }
}

function snapshot() {
  return {
    phase: state.phase,
    mode: state.mode,
    time: state.time,
    battery: state.battery,
    sprintArmed: state.sprintArmed,
    score: [state.score[0], state.score[1]],
    winner: state.winner,
    sprinting: [state.sprinting[0], state.sprinting[1]],
    kickCount: [state.kickCount[0], state.kickCount[1]],
    players: state.players.map((p) => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy })),
    ball: { x: state.ball.x, y: state.ball.y, vx: state.ball.vx, vy: state.ball.vy },
    tutorialStep,
  };
}

window.__ARENA = { snapshot, rules: RULES };

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  const prev = {
    score: state.score.slice(),
    kicks: state.kickCount.slice(),
    armed: state.sprintArmed,
  };
  const inputs = [readP1(), state.mode === 'ai' ? decideAi(state) : readP2()];
  tick(state, inputs, dt);
  advanceTutorial();
  cue(prev);
  renderHud();
  draw();
  requestAnimationFrame(frame);
}
renderHud();
draw();
requestAnimationFrame(frame);
