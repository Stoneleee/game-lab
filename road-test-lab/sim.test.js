import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyEdits,
  bake,
  clonePieces,
  createAccumulator,
  createRun,
  FIXED_DT,
  poseKey,
  replacePiece,
  rotatePiece,
  runScript,
  scriptAt,
  step,
} from './sim.js';
import {
  createGame,
  createSession,
  current,
  editPiece,
  poseOf,
  rearm,
  restoreTrack,
  selectTrack,
  tick,
} from './session.js';
import { SOLUTIONS } from './solutions.js';
import { TRACKS } from './tracks.js';

function roadOf(track, edits = []) {
  const edited = applyEdits(track.pieces, edits);
  assert.equal(edited.error, undefined);
  return bake(edited.pieces, track.startY, track.finish);
}

function play(track, edits, script) {
  return runScript(roadOf(track, edits), script);
}

function chunked(road, script, frames) {
  const clock = createAccumulator();
  let state = createRun(road);
  for (const frame of frames) {
    clock.push(frame, () => {
      if (!state.outcome) state = step(state, scriptAt(script, state.time), road);
    });
  }
  return state;
}

function drive(session, script, limit = 2000) {
  let guard = 0;
  while (session.phase !== 'win' && session.phase !== 'fail' && guard < limit) {
    const time = session.run ? session.run.state.time : 0;
    tick(session, scriptAt(script, time));
    guard += 1;
  }
  return session;
}

test('throttle builds speed and brake takes it away on flat ground', () => {
  const road = bake([
    { type: 'flat', rot: 0, editable: false },
    { type: 'flat', rot: 0, editable: false },
    { type: 'flat', rot: 0, editable: false },
    { type: 'flat', rot: 0, editable: false },
  ], 1, { index: 3, t: 0.95 });
  const coast = runScript(road, [{ t: 0 }], 2);
  const powered = runScript(road, [{ t: 0, throttle: true }], 1);
  assert.ok(powered.state.x > coast.state.x + 2);
  assert.ok(powered.state.speed > 4);
  const stopped = runScript(road, [
    { t: 0, throttle: true },
    { t: 0.8, throttle: false, brake: true },
  ], 2);
  assert.ok(stopped.state.speed < powered.state.speed);
  assert.ok(Math.abs(stopped.state.speed) < 0.4);
});

test('the same inputs land on the same pose when frames are chopped differently', () => {
  const track = TRACKS[0];
  const road = roadOf(track, SOLUTIONS[0].edits);
  const script = SOLUTIONS[0].script;
  const direct = runScript(road, script);
  const frames60 = Array.from({ length: 8 * 60 }, () => FIXED_DT);
  const frames30 = Array.from({ length: 8 * 30 }, () => FIXED_DT * 2);
  const mixed = [];
  let left = 8 * 60;
  let n = 1;
  while (left > 0) {
    const take = Math.min(left, n);
    mixed.push(take * FIXED_DT);
    left -= take;
    n = n === 5 ? 1 : n + 1;
  }
  const a = chunked(road, script, frames60);
  const b = chunked(road, script, frames30);
  const c = chunked(road, script, mixed);
  assert.equal(poseKey(a), poseKey(b));
  assert.equal(poseKey(b), poseKey(c));
  assert.equal(poseKey(a), poseKey(direct.state));
  assert.equal(direct.state.outcome, 'win');
});

test('every example solution reaches the flag, and the unedited road does not', () => {
  for (const solution of SOLUTIONS) {
    const track = TRACKS.find((item) => item.id === solution.id);
    const won = play(track, solution.edits, solution.script);
    assert.equal(won.state.outcome, 'win', solution.id);
    assert.ok(won.state.x >= roadOf(track, solution.edits).finishX - 0.05);
    const lost = play(track, [], solution.unedited);
    assert.equal(lost.state.outcome, 'fail', solution.id);
    assert.notEqual(lost.state.reason, 'finish');
  }
});

test('track 1 needs the lip rotated and the throttle held', () => {
  const track = TRACKS[0];
  const won = play(track, [{ op: 'rotate', index: 2 }], [{ t: 0, throttle: true }]);
  assert.equal(won.state.outcome, 'win');
  assert.ok(Math.max(...won.samples.map((sample) => sample.y)) > 3);
  const coast = play(track, [{ op: 'rotate', index: 2 }], [{ t: 0 }]);
  assert.equal(coast.state.outcome, 'fail');
  const decoy = play(track, [{ op: 'replace', index: 1, type: 'steep' }], [{ t: 0, throttle: true }]);
  assert.equal(decoy.state.outcome, 'fail');
  const seed = TRACKS[0].pieces[2].rot;
  assert.equal(seed, 1);
});

test('track 2 is a wall until that one block becomes a ramp', () => {
  const track = TRACKS[1];
  assert.equal(play(track, [], [{ t: 0, throttle: true }]).state.reason, 'wall');
  assert.equal(
    play(track, [{ op: 'rotate', index: 2 }], [{ t: 0, throttle: true }]).state.outcome,
    'fail',
  );
  const won = play(track, [{ op: 'replace', index: 2, type: 'ramp' }], [{ t: 0, throttle: true }]);
  assert.equal(won.state.outcome, 'win');
  const coast = play(track, [{ op: 'replace', index: 2, type: 'ramp' }], [{ t: 0 }]);
  assert.equal(coast.state.outcome, 'fail');
  assert.notEqual(coast.state.outcome, 'win');
});

test('track 3 has a real throttle window and the uphill landing never saves you', () => {
  const track = TRACKS[2];
  const edit = [{ op: 'rotate', index: 3 }];
  assert.equal(play(track, edit, [{ t: 0, throttle: true }, { t: 0.7, throttle: false }]).state.outcome, 'win');
  assert.equal(play(track, edit, [{ t: 0, throttle: true }, { t: 0.45, throttle: false }]).state.outcome, 'win');
  assert.equal(play(track, edit, [{ t: 0, throttle: true }, { t: 1.0, throttle: false }]).state.outcome, 'win');
  const fast = play(track, edit, [{ t: 0, throttle: true }]);
  assert.equal(fast.state.outcome, 'fail');
  const slow = play(track, edit, [{ t: 0, throttle: true }, { t: 0.12, throttle: false }]);
  assert.equal(slow.state.outcome, 'fail');
  const uphill = play(track, [], [{ t: 0, throttle: true }, { t: 0.7, throttle: false }]);
  assert.equal(uphill.state.outcome, 'fail');
  const replaced = play(track, [{ op: 'replace', index: 3, type: 'flat' }], [{ t: 0, throttle: true }, { t: 0.7, throttle: false }]);
  assert.equal(replaced.state.outcome, 'fail');
  const atCrash = fast.state.time;
  const fixed = play(track, edit, [{ t: 0, throttle: true }, { t: 0.7, throttle: false }]);
  const sameTime = fixed.samples.find((sample) => sample.t >= atCrash - 1e-6);
  assert.ok(Math.abs(sameTime.x - fast.state.x) > 1 || Math.abs(sameTime.y - fast.state.y) > 0.4);
});

test('a failed run becomes the ghost only when the next attempt is armed', () => {
  const session = createSession(TRACKS[0]);
  drive(session, [{ t: 0, throttle: true }]);
  assert.equal(session.phase, 'fail');
  assert.equal(session.editsLeft, 1);
  assert.equal(session.ghost, null);
  const crashX = session.run.state.x;
  rearm(session);
  assert.equal(session.phase, 'ready');
  assert.equal(session.ghost.outcome, 'fail');
  assert.ok(session.ghost.reason);
  assert.ok(Math.abs(session.ghost.x - crashX) < 1e-6);
  assert.equal(session.editsLeft, 0);
  tick(session, { throttle: true });
  assert.equal(session.phase, 'run');
  rearm(session);
  assert.equal(session.phase, 'ready');
  assert.equal(session.ghost.outcome, 'fail');
  assert.ok(Math.abs(session.ghost.x - crashX) < 1e-6);
});

test('track switches keep each ghost, and restore clears only that track', () => {
  const game = createGame(TRACKS);
  drive(current(game), [{ t: 0, throttle: true }]);
  rearm(current(game));
  assert.equal(current(game).ghost.outcome, 'fail');
  selectTrack(game, 1);
  assert.equal(current(game).ghost, null);
  assert.equal(current(game).track.id, 'wall');
  selectTrack(game, 0);
  assert.equal(current(game).ghost.outcome, 'fail');
  restoreTrack(current(game));
  assert.equal(current(game).ghost, null);
  assert.equal(current(game).pieces[2].rot, 1);
  selectTrack(game, 1);
  assert.equal(current(game).phase, 'ready');
});

test('one failure allows one edit, and a flat block cannot be spun', () => {
  const session = createSession(TRACKS[0]);
  drive(session, [{ t: 0, throttle: true }]);
  const spun = editPiece(session, 1, 'rotate');
  assert.equal(spun.error, 'spin');
  assert.equal(session.editsLeft, 1);
  const locked = editPiece(session, 0, 'replace', 'ramp');
  assert.equal(locked.error, 'locked');
  assert.equal(session.editsLeft, 1);
  const ok = editPiece(session, 2, 'rotate');
  assert.equal(ok.ok, true);
  assert.equal(session.pieces[2].rot, 0);
  assert.equal(session.editsLeft, 0);
  const again = editPiece(session, 2, 'replace', 'flat');
  assert.equal(again.error, 'budget');
  assert.equal(session.pieces[2].type, 'kicker');
  const fresh = createSession(TRACKS[1]);
  const early = editPiece(fresh, 2, 'replace', 'ramp');
  assert.equal(early.error, 'phase');
});

test('winning stores a best time and does not open another edit', () => {
  const session = createSession(TRACKS[1]);
  session.pieces = replacePiece(session.pieces, 2, 'ramp').pieces;
  drive(session, [{ t: 0, throttle: true }]);
  assert.equal(session.phase, 'win');
  assert.equal(session.editsLeft, 0);
  assert.ok(session.best > 0.5 && session.best < 10);
  const best = session.best;
  rearm(session);
  drive(session, [{ t: 0, throttle: true }]);
  assert.ok(session.best <= best + 1e-6);
});

test('edit helpers do not mutate the source pieces', () => {
  const pieces = clonePieces(TRACKS[2].pieces);
  const before = JSON.stringify(pieces);
  const rotated = rotatePiece(pieces, 3);
  assert.equal(rotated.pieces[3].rot, 1);
  assert.equal(pieces[3].rot, 0);
  const replaced = replacePiece(pieces, 3, 'kicker');
  assert.equal(replaced.pieces[3].type, 'kicker');
  assert.equal(replaced.pieces[3].entry, pieces[3].entry);
  assert.equal(JSON.stringify(pieces), before);
  assert.equal(rotatePiece(pieces, 2).error, 'spin');
  assert.equal(rotatePiece(pieces, 4).error, 'locked');
});

test('poses stay finite across the three roads', () => {
  const scripts = [
    [{ t: 0, throttle: true }],
    [{ t: 0, brake: true }],
    [{ t: 0, throttle: true }, { t: 0.4, brake: true }, { t: 0.8, throttle: true }],
    [{ t: 0, throttle: true }, { t: 0.3, throttle: false }, { t: 1.1, throttle: true }],
  ];
  for (const track of TRACKS) {
    for (const script of scripts) {
      const result = play(track, [], script);
      for (const sample of result.samples) {
        assert.ok(Number.isFinite(sample.x) && Number.isFinite(sample.y) && Number.isFinite(sample.angle));
      }
    }
  }
});

test('the parked car is the pose before a run starts', () => {
  const session = createSession(TRACKS[0]);
  assert.equal(session.phase, 'ready');
  assert.equal(poseOf(session).x, session.parked.x);
  assert.equal(session.run, null);
});
