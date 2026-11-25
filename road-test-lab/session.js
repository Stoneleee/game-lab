// One track remembers its road, the run that just finished, and the ghost of
// the run before that. Switching tracks does not mix those records.

import {
  applyEdits,
  bake,
  clonePieces,
  createRun,
  step,
} from './sim.js';

export function createSession(track, best = null) {
  const pieces = clonePieces(track.pieces);
  const road = bake(pieces, track.startY, track.finish);
  return {
    track,
    seed: clonePieces(track.pieces),
    pieces,
    road,
    ghost: null,
    run: null,
    parked: createRun(road),
    phase: 'ready',
    editsLeft: 0,
    selected: null,
    best: Number.isFinite(best) ? best : null,
  };
}

export function createGame(tracks, bestMap = {}) {
  return {
    tracks,
    index: 0,
    sessions: tracks.map((track) => createSession(track, bestMap[track.id])),
  };
}

export function current(game) {
  return game.sessions[game.index];
}

export function selectTrack(game, index) {
  if (!Number.isInteger(index) || index < 0 || index >= game.sessions.length) {
    return { error: 'track' };
  }
  game.index = index;
  return { ok: true, session: current(game) };
}

function snapshot(run) {
  return {
    samples: run.samples.map((sample) => ({ ...sample })),
    outcome: run.state.outcome,
    reason: run.state.reason,
    time: run.state.time,
    x: run.state.x,
    y: run.state.y,
  };
}

export function poseOf(session) {
  if (session.run) return session.run.state;
  return session.parked;
}

// Leave a finished run in the ghost record and sit at the start.
// An in-progress run is discarded and the previous ghost stays.
export function rearm(session) {
  if ((session.phase === 'fail' || session.phase === 'win') && session.run) {
    session.ghost = snapshot(session.run);
  }
  session.run = null;
  session.phase = 'ready';
  session.editsLeft = 0;
  session.selected = null;
  session.road = bake(session.pieces, session.track.startY, session.track.finish);
  session.parked = createRun(session.road);
  return { ok: true };
}

export function restoreTrack(session) {
  session.pieces = clonePieces(session.seed);
  session.ghost = null;
  session.run = null;
  session.phase = 'ready';
  session.editsLeft = 0;
  session.selected = null;
  session.road = bake(session.pieces, session.track.startY, session.track.finish);
  session.parked = createRun(session.road);
  return { ok: true };
}

function ensureRun(session) {
  if (session.phase === 'ready') {
    session.road = bake(session.pieces, session.track.startY, session.track.finish);
    session.run = { state: createRun(session.road), samples: [], road: session.road };
    session.parked = null;
    session.phase = 'run';
    session.editsLeft = 0;
    session.selected = null;
  }
}

export function tick(session, input) {
  if (session.phase === 'fail' || session.phase === 'win') return session;
  const throttle = !!(input && input.throttle);
  const brake = !!(input && input.brake);
  if (session.phase === 'ready') {
    if (!throttle && !brake) return session;
    ensureRun(session);
  }
  if (session.phase !== 'run' || !session.run || session.run.state.outcome) return session;
  session.run.state = step(session.run.state, { throttle, brake }, session.run.road);
  const state = session.run.state;
  session.run.samples.push({
    t: state.time,
    x: state.x,
    y: state.y,
    angle: state.angle,
  });
  if (state.outcome === 'win') {
    session.phase = 'win';
    session.editsLeft = 0;
    if (session.best == null || state.time < session.best) session.best = state.time;
  } else if (state.outcome === 'fail') {
    session.phase = 'fail';
    session.editsLeft = 1;
    session.selected = null;
  }
  return session;
}

export function editPiece(session, index, action, type) {
  if (session.phase !== 'fail') return { error: 'phase' };
  if (session.editsLeft < 1) return { error: 'budget' };
  const edit = action === 'rotate'
    ? { op: 'rotate', index }
    : { op: 'replace', index, type };
  const result = applyEdits(session.pieces, [edit]);
  if (result.error) return result;
  session.pieces = result.pieces;
  session.road = bake(session.pieces, session.track.startY, session.track.finish);
  session.editsLeft = 0;
  session.selected = index;
  return { ok: true };
}

export function selectPiece(session, index) {
  if (session.phase !== 'fail' || session.editsLeft < 1) return { error: 'phase' };
  const piece = session.pieces[index];
  if (!piece || !piece.editable) return { error: 'locked' };
  session.selected = index;
  return { ok: true };
}
