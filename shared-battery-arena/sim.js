/**
 * Shared Battery Arena — fixed-step top-down ball rules.
 *
 * There is one battery on the match. A sprint or a powered kick spends that
 * same pool, whether the input came from the human or the AI. Nobody has a
 * private stamina bar.
 */

export const RULES = Object.freeze({
  dt: 1 / 60,
  maxFrame: 0.1,
  fieldW: 900,
  fieldH: 520,
  goalH: 180,
  playerR: 22,
  ballR: 13,
  baseAccel: 820,
  sprintAccel: 1500,
  baseSpeed: 188,
  sprintSpeed: 318,
  playerDrag: 3.4,
  ballDrag: 0.8,
  batteryMax: 100,
  sprintDrain: 36,
  recharge: 20,
  kickCost: 18,
  kickSpeed: 560,
  weakSpeed: 210,
  kickRange: 16,
  kickCd: 0.38,
  sprintMin: 16,
  matchSeconds: 70,
  scoreLimit: 3,
  goalPause: 1.15,
  postR: 8,
  ballMaxSpeed: 700,
});

const DT = RULES.dt;

export function idleInput() {
  return { x: 0, y: 0, sprint: false, kick: false };
}

export function createMatch(options = {}) {
  const mode = options.mode === 'local' ? 'local' : 'ai';
  const phase = options.phase || 'tutorial';
  return {
    w: RULES.fieldW,
    h: RULES.fieldH,
    mode,
    phase,
    time: 0,
    phaseT: 0,
    acc: 0,
    battery: RULES.batteryMax,
    score: [0, 0],
    winner: null,
    lastGoal: null,
    kickCd: [0, 0],
    kickCount: [0, 0],
    sprinting: [false, false],
    sprintArmed: true,
    simTicks: 0,
    players: [
      { x: 168, y: RULES.fieldH / 2, vx: 0, vy: 0, r: RULES.playerR, facing: 0 },
      { x: RULES.fieldW - 168, y: RULES.fieldH / 2, vx: 0, vy: 0, r: RULES.playerR, facing: Math.PI },
    ],
    ball: { x: RULES.fieldW / 2, y: RULES.fieldH / 2, vx: 0, vy: 0, r: RULES.ballR },
  };
}

export function resetMatch(previous) {
  return createMatch({
    mode: previous && previous.mode === 'local' ? 'local' : 'ai',
    phase: 'play',
  });
}

export function mouth() {
  const top = (RULES.fieldH - RULES.goalH) / 2;
  return { top, bot: top + RULES.goalH };
}

function clampInput(input) {
  const src = input || idleInput();
  let x = Number(src.x) || 0;
  let y = Number(src.y) || 0;
  const mag = Math.hypot(x, y);
  if (mag > 1) {
    x /= mag;
    y /= mag;
  }
  return { x, y, sprint: !!src.sprint, kick: !!src.kick, mag };
}

function zeroMotion(state) {
  for (const p of state.players) {
    p.vx = 0;
    p.vy = 0;
  }
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.sprinting = [false, false];
}

function resetPositions(state) {
  const [a, b] = state.players;
  a.x = 168;
  a.y = state.h / 2;
  a.vx = 0;
  a.vy = 0;
  a.facing = 0;
  b.x = state.w - 168;
  b.y = state.h / 2;
  b.vx = 0;
  b.vy = 0;
  b.facing = Math.PI;
  state.ball.x = state.w / 2;
  state.ball.y = state.h / 2;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.kickCd = [0, 0];
  state.sprinting = [false, false];
}

function capVec(obj, max, bleed) {
  const sp = Math.hypot(obj.vx, obj.vy);
  if (sp <= max || sp === 0) return;
  const next = bleed ? max + (sp - max) * Math.exp(-10 * DT) : max;
  const k = next / sp;
  obj.vx *= k;
  obj.vy *= k;
}

function containPlayer(p, state) {
  const r = p.r;
  if (p.x < r) {
    p.x = r;
    p.vx = Math.max(0, p.vx);
  }
  if (p.x > state.w - r) {
    p.x = state.w - r;
    p.vx = Math.min(0, p.vx);
  }
  if (p.y < r) {
    p.y = r;
    p.vy = Math.max(0, p.vy);
  }
  if (p.y > state.h - r) {
    p.y = state.h - r;
    p.vy = Math.min(0, p.vy);
  }
}

function separatePlayers(a, b) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let dist = Math.hypot(dx, dy);
  const min = a.r + b.r;
  if (dist >= min) return;
  if (dist < 1e-8) {
    dx = 1;
    dy = 0;
    dist = 1e-8;
  }
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = min - dist;
  a.x -= nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.y += ny * overlap * 0.5;
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel >= 0) return;
  const impulse = -(1.1) * rel * 0.5;
  a.vx -= impulse * nx;
  a.vy -= impulse * ny;
  b.vx += impulse * nx;
  b.vy += impulse * ny;
}

function pushBall(player, ball) {
  let dx = ball.x - player.x;
  let dy = ball.y - player.y;
  let dist = Math.hypot(dx, dy);
  const min = player.r + ball.r;
  if (dist >= min) return;
  if (dist < 1e-8) {
    dx = 1;
    dy = 0;
    dist = 1e-8;
  }
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = min - dist + 0.25;
  ball.x += nx * overlap;
  ball.y += ny * overlap;
  const rel = (ball.vx - player.vx) * nx + (ball.vy - player.vy) * ny;
  if (rel < 0) {
    const impulse = -(1.35) * rel;
    ball.vx += impulse * nx;
    ball.vy += impulse * ny;
    player.vx -= impulse * nx * 0.12;
    player.vy -= impulse * ny * 0.12;
  }
}

function resolvePost(ball, px, py) {
  let dx = ball.x - px;
  let dy = ball.y - py;
  let dist = Math.hypot(dx, dy);
  const min = ball.r + RULES.postR;
  if (dist >= min) return;
  if (dist < 1e-8) {
    dx = 1;
    dy = 0;
    dist = 1e-8;
  }
  const nx = dx / dist;
  const ny = dy / dist;
  ball.x = px + nx * min;
  ball.y = py + ny * min;
  const velN = ball.vx * nx + ball.vy * ny;
  if (velN < 0) {
    ball.vx -= 1.55 * velN * nx;
    ball.vy -= 1.55 * velN * ny;
  }
}

function settleWinner(state) {
  state.phase = 'ended';
  state.phaseT = 0;
  if (state.score[0] === state.score[1]) state.winner = 'draw';
  else state.winner = state.score[0] > state.score[1] ? 0 : 1;
  zeroMotion(state);
}

function containBall(state) {
  const ball = state.ball;
  const r = ball.r;
  const gate = mouth();
  if (ball.y < r) {
    ball.y = r;
    ball.vy = Math.abs(ball.vy) * 0.86;
  }
  if (ball.y > state.h - r) {
    ball.y = state.h - r;
    ball.vy = -Math.abs(ball.vy) * 0.86;
  }
  resolvePost(ball, 0, gate.top);
  resolvePost(ball, 0, gate.bot);
  resolvePost(ball, state.w, gate.top);
  resolvePost(ball, state.w, gate.bot);

  const inMouth = ball.y > gate.top && ball.y < gate.bot;
  if (ball.x < 0 && inMouth) return 1;
  if (ball.x > state.w && inMouth) return 0;
  if (ball.x < r && !inMouth) {
    ball.x = r;
    ball.vx = Math.abs(ball.vx) * 0.86;
  }
  if (ball.x > state.w - r && !inMouth) {
    ball.x = state.w - r;
    ball.vx = -Math.abs(ball.vx) * 0.86;
  }
  if (ball.x < -40) ball.x = -40;
  if (ball.x > state.w + 40) ball.x = state.w + 40;
  return null;
}

function applyKick(state, index, input) {
  if (!input.kick || state.kickCd[index] > 0) return;
  const player = state.players[index];
  const ball = state.ball;
  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist > player.r + ball.r + RULES.kickRange) return;
  let ax = input.x;
  let ay = input.y;
  if (Math.hypot(ax, ay) < 0.2) {
    ax = Math.cos(player.facing);
    ay = Math.sin(player.facing);
  }
  const mag = Math.hypot(ax, ay) || 1;
  ax /= mag;
  ay /= mag;
  const powered = state.battery >= RULES.kickCost;
  if (powered) state.battery -= RULES.kickCost;
  const speed = powered ? RULES.kickSpeed : RULES.weakSpeed;
  ball.vx = ax * speed;
  ball.vy = ay * speed;
  ball.x = player.x + ax * (player.r + ball.r + 2);
  ball.y = player.y + ay * (player.r + ball.r + 2);
  state.kickCd[index] = RULES.kickCd;
  state.kickCount[index] += 1;
  player.facing = Math.atan2(ay, ax);
}

function finishGoal(state, scorer) {
  state.score[scorer] += 1;
  state.lastGoal = scorer;
  const battery = state.battery;
  const score = state.score.slice();
  const time = state.time;
  resetPositions(state);
  state.battery = battery;
  state.score = score;
  state.time = time;
  if (state.score[scorer] >= RULES.scoreLimit) {
    state.phase = 'ended';
    state.winner = scorer;
    state.phaseT = 0;
    return;
  }
  state.phase = 'goal';
  state.phaseT = RULES.goalPause;
}

function step(state, rawInputs) {
  state.simTicks += 1;
  if (state.phase === 'goal') {
    state.phaseT -= DT;
    zeroMotion(state);
    if (state.phaseT <= 0) {
      if (state.time >= RULES.matchSeconds) settleWinner(state);
      else state.phase = 'play';
    }
    return;
  }
  if (state.phase === 'ended') {
    zeroMotion(state);
    return;
  }

  const inputs = [0, 1].map((i) => clampInput(rawInputs && rawInputs[i]));
  const sprinting = [false, false];
  if (state.battery <= 0) state.sprintArmed = false;

  for (let i = 0; i < 2; i++) {
    const player = state.players[i];
    const input = inputs[i];
    const moving = input.mag > 0.15;
    const canSprint = input.sprint && moving && state.sprintArmed && state.battery > 0;
    sprinting[i] = canSprint;
    const accel = canSprint ? RULES.sprintAccel : RULES.baseAccel;
    if (moving) {
      player.vx += input.x * accel * DT;
      player.vy += input.y * accel * DT;
      player.facing = Math.atan2(input.y, input.x);
    }
    const drag = Math.exp(-RULES.playerDrag * DT);
    player.vx *= drag;
    player.vy *= drag;
    capVec(player, canSprint ? RULES.sprintSpeed : RULES.baseSpeed, true);
    capVec(player, RULES.sprintSpeed, false);
    player.x += player.vx * DT;
    player.y += player.vy * DT;
  }

  separatePlayers(state.players[0], state.players[1]);
  for (const player of state.players) containPlayer(player, state);
  for (const player of state.players) pushBall(player, state.ball);

  for (let i = 0; i < 2; i++) state.kickCd[i] = Math.max(0, state.kickCd[i] - DT);
  applyKick(state, 0, inputs[0]);
  applyKick(state, 1, inputs[1]);

  const sprinters = sprinting[0] + sprinting[1];
  if (sprinters > 0) {
    state.battery = Math.max(0, state.battery - RULES.sprintDrain * sprinters * DT);
  } else {
    state.battery = Math.min(RULES.batteryMax, state.battery + RULES.recharge * DT);
  }
  if (state.battery <= 0) state.sprintArmed = false;
  else if (!state.sprintArmed && state.battery >= RULES.sprintMin) state.sprintArmed = true;
  state.sprinting = sprinting;

  for (const player of state.players) {
    capVec(player, RULES.sprintSpeed, false);
    containPlayer(player, state);
  }

  const ball = state.ball;
  ball.vx *= Math.exp(-RULES.ballDrag * DT);
  ball.vy *= Math.exp(-RULES.ballDrag * DT);
  capVec(ball, RULES.ballMaxSpeed, false);
  if (Math.hypot(ball.vx, ball.vy) < 4) {
    ball.vx = 0;
    ball.vy = 0;
  }
  ball.x += ball.vx * DT;
  ball.y += ball.vy * DT;
  const scorer = containBall(state);

  if (state.phase === 'tutorial') {
    if (scorer != null) {
      ball.x = state.w / 2;
      ball.y = state.h / 2;
      ball.vx = 0;
      ball.vy = 0;
    }
    return;
  }

  if (scorer != null) {
    finishGoal(state, scorer);
    return;
  }
  state.time += DT;
  if (state.time >= RULES.matchSeconds) settleWinner(state);
}

export function tick(state, inputs, frameSeconds) {
  const capped = Math.min(RULES.maxFrame, Math.max(0, Number(frameSeconds) || 0));
  state.acc += capped;
  let guard = 0;
  while (state.acc >= DT - 1e-8 && guard < 8) {
    step(state, inputs);
    state.acc -= DT;
    guard += 1;
  }
  if (state.acc < 1e-8) state.acc = 0;
  return guard;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

export function snapshot(state) {
  return {
    phase: state.phase,
    mode: state.mode,
    time: round3(state.time),
    battery: round3(state.battery),
    score: [state.score[0], state.score[1]],
    winner: state.winner,
    simTicks: state.simTicks,
    sprinting: [state.sprinting[0], state.sprinting[1]],
    players: state.players.map((p) => ({
      x: round3(p.x),
      y: round3(p.y),
      vx: round3(p.vx),
      vy: round3(p.vy),
    })),
    ball: {
      x: round3(state.ball.x),
      y: round3(state.ball.y),
      vx: round3(state.ball.vx),
      vy: round3(state.ball.vy),
    },
  };
}
