import { LEVELS } from './levels.js';
import { fingerprint, loadLevel, shoot, step } from './sim.js';

export function createSession(levelIndex) {
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= LEVELS.length) {
    throw new Error(`bad level index ${levelIndex}`);
  }
  return {
    levelIndex,
    state: loadLevel(LEVELS[levelIndex]),
    past: [],
    acceptingShots: true,
    lastEvents: [],
  };
}

export function beginShot(session, x, y) {
  if (!session.acceptingShots) {
    return { ok: false, reason: '坍落还没停', session };
  }
  const shot = shoot(session.state, x, y);
  if (!shot.ok) return { ok: false, reason: shot.reason, session };
  return {
    ok: true,
    session: {
      ...session,
      past: [...session.past, session.state],
      state: shot.state,
      acceptingShots: false,
      lastEvents: [{ type: 'shot', x, y, material: shot.shot.material, id: shot.shot.id }],
    },
  };
}

export function advance(session) {
  if (session.acceptingShots) return session;
  const result = step(session.state);
  return {
    ...session,
    state: result.state,
    lastEvents: result.events,
    acceptingShots: result.done,
  };
}

export function playShot(session, x, y) {
  const begun = beginShot(session, x, y);
  if (!begun.ok) return begun;
  const frames = [begun.session.state];
  let current = begun.session;
  let guard = 0;
  while (!current.acceptingShots) {
    if (++guard > 80) return { ok: false, reason: '步数上限', session: current, frames };
    current = advance(current);
    frames.push(current.state);
  }
  return { ok: true, session: current, frames };
}

export function undo(session) {
  if (!session.acceptingShots) {
    return { ok: false, reason: '请等坍落停稳再撤销', session };
  }
  if (session.past.length === 0) {
    return { ok: false, reason: '没有可撤销的拆除', session };
  }
  const state = session.past[session.past.length - 1];
  return {
    ok: true,
    session: {
      ...session,
      state,
      past: session.past.slice(0, -1),
      acceptingShots: true,
      lastEvents: [],
    },
  };
}

export function restart(session) {
  return { ok: true, session: createSession(session.levelIndex) };
}

export function emptyProgress() {
  return {
    v: 1,
    cleared: LEVELS.map(() => false),
    best: LEVELS.map(() => null),
    last: 0,
  };
}

export function isUnlocked(progress, levelIndex) {
  if (levelIndex <= 0) return true;
  return progress.cleared[levelIndex - 1] === true;
}

export function recordWin(progress, levelIndex, shotsUsed) {
  const cleared = progress.cleared.slice();
  cleared[levelIndex] = true;
  const best = progress.best.slice();
  best[levelIndex] = best[levelIndex] == null ? shotsUsed : Math.min(best[levelIndex], shotsUsed);
  return { ...progress, cleared, best, last: levelIndex };
}

export function shotsUsed(state) {
  return state.shotMax - state.shotsLeft;
}

export function sameWorld(a, b) {
  return fingerprint(a) === fingerprint(b);
}
