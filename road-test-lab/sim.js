// Side-view road test. The wheel is a point that follows a baked profile.
// Integration always advances FIXED_DT, so a slow frame and a fast frame
// that cover the same sim time land on the same pose.

export const FIXED_DT = 1 / 60;
export const PIECE_W = 4;

export const TYPE_ORDER = ['flat', 'ramp', 'steep', 'kicker'];

export const TYPE_LABEL = {
  flat: '平路',
  ramp: '缓坡',
  steep: '陡坡',
  kicker: '弹板',
  gap: '缺口',
};

export const REASON_TEXT = {
  fall: '掉出赛道了。这次的速度和坡向没有把车送上路面。',
  flip: '落地时车身和坡向差太多，车翻了。',
  wall: '这段坎太陡，车头磕住了。',
  time: '时间到了，还没开到终点。',
};

const TUNING = {
  gravity: 30,
  throttle: 12,
  brake: 40,
  drag: 0.15,
  airDrag: 0.12,
  maxSpeed: 18,
  maxReverse: 8,
  rampRise: 1.7,
  steepRise: 6.4,
  kickRise: 1.05,
  lip: 0.33,
  wallAngle: (50 * Math.PI) / 180,
  dropAngle: (18 * Math.PI) / 180,
  dropSpeed: 12,
  landAngle: (16 * Math.PI) / 180,
  landImpact: 20,
  spin: 1.45,
  fallY: -8,
  timeLimit: 18,
  bumperX: 0.45,
};

export function wrapAngle(a) {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function dampAngle(current, target, maxStep) {
  const diff = wrapAngle(target - current);
  const step = clamp(diff, -maxStep, maxStep);
  return wrapAngle(current + step);
}

export function riseOf(piece) {
  if (piece.type === 'flat' || piece.type === 'gap') return 0;
  const mag = piece.type === 'ramp' ? TUNING.rampRise
    : piece.type === 'steep' ? TUNING.steepRise
      : TUNING.kickRise;
  return piece.rot ? -mag : mag;
}

export function clonePieces(pieces) {
  return pieces.map((piece) => ({
    type: piece.type,
    rot: piece.rot ? 1 : 0,
    editable: !!piece.editable,
    cover: piece.cover == null ? 1 : piece.cover,
    entry: piece.entry,
  }));
}

export function bake(pieces, startY, finish) {
  let x = 0;
  let chained = startY;
  const baked = pieces.map((piece) => {
    const rise = riseOf(piece);
    const entry = piece.entry == null ? chained : piece.entry;
    const item = {
      type: piece.type,
      rot: piece.rot ? 1 : 0,
      editable: !!piece.editable,
      cover: piece.cover == null ? 1 : piece.cover,
      x0: x,
      x1: x + PIECE_W,
      entry,
      exit: entry + rise,
    };
    x = item.x1;
    chained = item.exit;
    return item;
  });
  const slot = baked[finish.index];
  if (!slot) throw new Error('finish piece missing');
  return {
    pieces: baked,
    length: x,
    startY,
    finishX: slot.x0 + PIECE_W * finish.t,
    finishIndex: finish.index,
  };
}

export function pieceAt(road, x) {
  const pieces = road.pieces;
  for (let i = 0; i < pieces.length; i += 1) {
    const piece = pieces[i];
    const last = i === pieces.length - 1;
    if (x >= piece.x0 && (last ? x <= piece.x1 + 1e-6 : x < piece.x1)) return piece;
  }
  return null;
}

export function pieceIndexAt(road, x) {
  const piece = pieceAt(road, x);
  return piece ? road.pieces.indexOf(piece) : -1;
}

export function groundAt(road, x) {
  const piece = pieceAt(road, x);
  if (!piece || piece.type === 'gap') return null;
  const t = clamp((x - piece.x0) / PIECE_W, 0, 1);
  if (t > piece.cover + 1e-6) return null;
  if (piece.type !== 'kicker') {
    return {
      y: piece.entry + (piece.exit - piece.entry) * t,
      angle: Math.atan2(piece.exit - piece.entry, PIECE_W),
    };
  }
  const lip = TUNING.lip;
  const kick = piece.rot ? -TUNING.kickRise : TUNING.kickRise;
  const lipAngle = Math.atan2(kick, PIECE_W * lip);
  if (!piece.rot) {
    if (t <= 1 - lip) return { y: piece.entry, angle: 0 };
    const u = (t - (1 - lip)) / lip;
    return { y: piece.entry + kick * u, angle: lipAngle };
  }
  if (t < lip) {
    const u = t / lip;
    return { y: piece.entry + kick * u, angle: lipAngle };
  }
  return { y: piece.exit, angle: 0 };
}

function blank(state, extra) {
  return {
    x: state.x,
    y: state.y,
    vx: state.vx,
    vy: state.vy,
    speed: state.speed,
    angle: state.angle,
    grounded: state.grounded,
    moved: state.moved,
    time: state.time + FIXED_DT,
    outcome: null,
    reason: null,
    contact: null,
    ...extra,
  };
}

function ended(pose, outcome, reason, contact = null) {
  return {
    ...pose,
    outcome,
    reason,
    contact,
    grounded: outcome === 'win' ? true : pose.grounded,
  };
}

export function createRun(road) {
  const x = 0.9;
  const ground = groundAt(road, x);
  if (!ground) throw new Error('spawn is not on a road');
  return {
    x,
    y: ground.y,
    vx: 0,
    vy: 0,
    speed: 0,
    angle: ground.angle,
    grounded: true,
    moved: false,
    time: 0,
    outcome: null,
    reason: null,
    contact: null,
  };
}

function groundAccel(speed, angle, input) {
  const coast = -TUNING.gravity * Math.sin(angle) - TUNING.drag * speed;
  if (input.brake) {
    const slope = -TUNING.gravity * Math.sin(angle);
    const sign = Math.abs(speed) > 0.02 ? Math.sign(speed) : (Math.sign(slope) || 0);
    return coast - sign * TUNING.brake;
  }
  if (input.throttle) return coast + TUNING.throttle;
  return coast;
}

function maybeWin(pose, road) {
  if (pose.grounded && pose.x >= road.finishX && pose.speed >= -0.05) {
    return ended(pose, 'win', 'finish');
  }
  if (pose.time >= TUNING.timeLimit) return ended(pose, 'fail', 'time');
  return pose;
}

export function step(state, input, road) {
  if (state.outcome) return state;
  const throttle = !!(input && input.throttle) && !(input && input.brake);
  const brake = !!(input && input.brake);
  const held = { throttle, brake };

  if (state.grounded) {
    const angle = state.angle;
    const accel = groundAccel(state.speed, angle, held);
    let speed = clamp(state.speed + accel * FIXED_DT, -TUNING.maxReverse, TUNING.maxSpeed);
    if (brake && state.speed > 0 && speed < 0) speed = 0;
    if (brake && state.speed < 0 && speed > 0) speed = 0;
    if (brake && Math.abs(speed) < 0.05) speed = 0;
    let x = state.x + Math.cos(angle) * speed * FIXED_DT;
    if (x < TUNING.bumperX) {
      x = TUNING.bumperX;
      if (speed < 0) speed = 0;
    }
    const ground = groundAt(road, x);
    const moved = state.moved || Math.abs(speed) > 0.7;
    if (!ground) {
      const pose = blank(state, {
        x,
        y: state.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        speed,
        angle,
        grounded: false,
        moved,
      });
      return maybeWin(pose, road);
    }
    const delta = wrapAngle(ground.angle - angle);
    const cliff = ground.y < state.y - 0.55;
    const curb = ground.y > state.y + 0.4 && speed > 0.3;
    if (curb || (Math.abs(delta) > TUNING.wallAngle && Math.abs(speed) > 0.3)) {
      return ended(blank(state, {
        x,
        y: state.y,
        speed,
        angle,
        grounded: true,
        moved,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      }), 'fail', 'wall');
    }
    if (cliff || (delta < -TUNING.dropAngle && speed > TUNING.dropSpeed)) {
      return maybeWin(blank(state, {
        x,
        y: state.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        speed,
        angle,
        grounded: false,
        moved,
      }), road);
    }
    const pose = blank(state, {
      x,
      y: ground.y,
      vx: Math.cos(ground.angle) * speed,
      vy: Math.sin(ground.angle) * speed,
      speed,
      angle: ground.angle,
      grounded: true,
      moved,
    });
    return maybeWin(pose, road);
  }

  const vx = state.vx * (1 - TUNING.airDrag * FIXED_DT);
  const vy = state.vy - TUNING.gravity * FIXED_DT;
  const x = state.x + vx * FIXED_DT;
  const y = state.y + vy * FIXED_DT;
  const target = Math.atan2(vy, vx);
  const angle = dampAngle(state.angle, target, TUNING.spin * FIXED_DT);
  if (y < TUNING.fallY || x > road.length + 8) {
    return ended(blank(state, {
      x, y, vx, vy, speed: Math.hypot(vx, vy), angle, grounded: false, moved: true,
    }), 'fail', 'fall');
  }
  const ground = groundAt(road, x);
  const crossing = ground
    && vy < 0
    && state.y >= ground.y - 0.15
    && y <= ground.y + 0.25;
  if (crossing) {
    const nx = -Math.sin(ground.angle);
    const ny = Math.cos(ground.angle);
    const into = -(vx * nx + vy * ny);
    const diff = Math.abs(wrapAngle(angle - ground.angle));
    const contact = { impact: into, diff };
    if (into > TUNING.landImpact || diff > TUNING.landAngle) {
      return ended(blank(state, {
        x,
        y: ground.y,
        vx,
        vy,
        speed: Math.hypot(vx, vy),
        angle,
        grounded: false,
        moved: true,
      }), 'fail', 'flip', contact);
    }
    const tangent = vx * Math.cos(ground.angle) + vy * Math.sin(ground.angle);
    const speed = clamp(tangent, -TUNING.maxReverse, TUNING.maxSpeed);
    const pose = blank(state, {
      x,
      y: ground.y,
      vx: Math.cos(ground.angle) * speed,
      vy: Math.sin(ground.angle) * speed,
      speed,
      angle: ground.angle,
      grounded: true,
      moved: true,
      contact,
    });
    return maybeWin(pose, road);
  }
  return maybeWin(blank(state, {
    x,
    y,
    vx,
    vy,
    speed: Math.hypot(vx, vy),
    angle,
    grounded: false,
    moved: true,
  }), road);
}

export function scriptAt(script, time) {
  let throttle = false;
  let brake = false;
  for (const cue of script) {
    if (cue.t <= time + 1e-9) {
      throttle = !!cue.throttle;
      brake = !!cue.brake;
    }
  }
  return { throttle, brake };
}

export function runScript(road, script, maxTime = TUNING.timeLimit) {
  let state = createRun(road);
  const samples = [];
  const steps = Math.ceil(maxTime / FIXED_DT);
  for (let i = 0; i < steps && !state.outcome; i += 1) {
    state = step(state, scriptAt(script, state.time), road);
    samples.push({
      t: state.time,
      x: state.x,
      y: state.y,
      angle: state.angle,
      outcome: state.outcome,
      reason: state.reason,
    });
  }
  return { state, samples };
}

export function rotatePiece(pieces, index) {
  const piece = pieces[index];
  if (!piece) return { error: 'missing' };
  if (!piece.editable) return { error: 'locked' };
  if (piece.type === 'flat' || piece.type === 'gap') return { error: 'spin' };
  const next = clonePieces(pieces);
  next[index] = {
    ...next[index],
    rot: piece.rot ? 0 : 1,
    cover: piece.cover == null ? 1 : piece.cover,
    entry: piece.entry,
  };
  return { pieces: next };
}

export function replacePiece(pieces, index, type) {
  const piece = pieces[index];
  if (!piece) return { error: 'missing' };
  if (!piece.editable) return { error: 'locked' };
  if (!TYPE_ORDER.includes(type)) return { error: 'type' };
  if (piece.type === type) return { error: 'same' };
  const next = clonePieces(pieces);
  next[index] = {
    type,
    rot: type === 'flat' ? 0 : (piece.rot ? 1 : 0),
    editable: true,
    cover: piece.cover == null ? 1 : piece.cover,
    entry: piece.entry,
  };
  return { pieces: next };
}

export function applyEdits(pieces, edits) {
  let next = clonePieces(pieces);
  for (const edit of edits) {
    const result = edit.op === 'rotate'
      ? rotatePiece(next, edit.index)
      : replacePiece(next, edit.index, edit.type);
    if (result.error) return result;
    next = result.pieces;
  }
  return { pieces: next };
}

export function createAccumulator() {
  let acc = 0;
  return {
    push(frameDt, onStep) {
      acc += Math.min(0.25, Math.max(0, frameDt));
      let n = 0;
      while (acc >= FIXED_DT - 1e-12 && n < 20) {
        onStep();
        acc -= FIXED_DT;
        n += 1;
      }
      return n;
    },
  };
}

export function poseKey(state) {
  return [
    state.outcome || '',
    state.reason || '',
    state.time.toFixed(4),
    state.x.toFixed(4),
    state.y.toFixed(4),
    state.speed.toFixed(4),
    state.angle.toFixed(4),
    state.grounded ? '1' : '0',
  ].join('|');
}
