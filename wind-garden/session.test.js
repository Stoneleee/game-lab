import assert from 'node:assert/strict';
import test from 'node:test';
import { GARDENS, SOLUTIONS, gardenById } from './gardens.js';
import { bedAt, describeDelta, trace } from './sim.js';
import {
  createSession,
  emptySave,
  initialCore,
  playSteps,
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
} from './session.js';

function fresh(id) {
  return createSession(gardenById(id));
}

function landing(session, fanId = session.fanId) {
  return trace(session.garden, session.core, fanId).landing;
}

test('breeze: turning east moves the preview onto the bed, then the flower keeps that wind', () => {
  const session = fresh('breeze');
  assert.deepEqual(landing(session), { x: 0, y: 0 });
  assert.equal(wishState(session.garden, session.core).done, false);
  rotate(session);
  const shown = preview(session);
  assert.deepEqual(shown.trace.landing, { x: 4, y: 2 });
  assert.match(shown.text, /花床/);
  const planted = sow(session);
  assert.equal(planted.ok, true);
  assert.equal(planted.plant.kind, 'flower');
  assert.equal(wishState(session.garden, session.core).done, true);
  assert.equal(planted.delta.length, 0);
  assert.match(planted.text, /花朵不挡风/);
  assert.equal(session.core.seeds.flower, 1);
});

test('breeze: a hedge planted on the straight path moves the next landing', () => {
  const session = fresh('breeze');
  rotate(session);
  selectSeed(session, 'hedge');
  const before = landing(session);
  const planted = sow(session);
  assert.deepEqual(before, { x: 4, y: 2 });
  assert.equal(planted.ok, true);
  assert.notDeepEqual(landing(session), before);
  assert.equal(planted.delta.length, 1);
  assert.match(planted.text, /风路变了/);
  assert.equal(wishState(session.garden, session.core).filled, 0);
});

test('bend: the hedge is what moves the second fan onto the bed', () => {
  const session = fresh('bend');
  selectFan(session, 'north');
  assert.notDeepEqual(landing(session, 'north'), { x: 0, y: 1 });
  playSteps(fresh('bend'), SOLUTIONS.bend.slice(0, 2));
  const mid = fresh('bend');
  playSteps(mid, SOLUTIONS.bend.slice(0, 2));
  selectFan(mid, 'north');
  rotate(mid);
  const bent = preview(mid);
  assert.equal(bent.trace.turns.length, 1);
  assert.equal(bent.trace.turns[0].blockKind, 'hedge');
  assert.equal(bent.trace.turns[0].from, 'S');
  assert.equal(bent.trace.turns[0].to, 'W');
  assert.deepEqual(bent.trace.landing, { x: 0, y: 1 });
  assert.equal(bedAt(mid.garden, 0, 1), true);
  assert.match(bent.text, /被灌木挡住/);
  assert.match(bent.text, /花床/);

  const flowerFirst = fresh('bend');
  playSteps(flowerFirst, [
    { op: 'rotate', fan: 'west' },
    { op: 'sow', fan: 'west', seed: 'flower' },
    { op: 'rotate', fan: 'north' },
  ]);
  const unchanged = preview(flowerFirst);
  assert.equal(unchanged.trace.turns.length, 0);
  assert.deepEqual(unchanged.trace.landing, { x: 4, y: 5 });

  playSteps(session, SOLUTIONS.bend);
  assert.equal(wishState(session.garden, session.core).done, true);
  assert.equal(session.core.plants.filter((plant) => plant.kind === 'hedge').length, 1);
  assert.equal(session.core.plants.filter((plant) => plant.kind === 'flower').length, 1);
});

test('fork: the hedge you plant chooses the bed, and recycle switches it', () => {
  const left = fresh('fork');
  playSteps(left, SOLUTIONS.forkA);
  assert.deepEqual(
    left.core.plants.find((plant) => plant.kind === 'flower'),
    { id: 2, x: 1, y: 5, kind: 'flower' },
  );
  assert.equal(wishState(left.garden, left.core).done, true);
  assert.equal(wishState(left.garden, left.core).both, false);

  const right = fresh('fork');
  playSteps(right, SOLUTIONS.forkB);
  assert.equal(right.core.plants.find((plant) => plant.kind === 'flower').x, 3);
  assert.equal(right.core.plants.find((plant) => plant.kind === 'flower').y, 5);

  const both = fresh('fork');
  playSteps(both, [
    { op: 'rotate', fan: 'main' },
    { op: 'rotate', fan: 'a' },
    { op: 'sow', fan: 'a', seed: 'hedge' },
    { op: 'rotate', fan: 'b' },
    { op: 'sow', fan: 'b', seed: 'hedge' },
  ]);
  selectFan(both, 'main');
  selectSeed(both, 'flower');
  const caught = sow(both);
  assert.equal(caught.ok, true);
  assert.deepEqual(caught.plant, { id: 3, x: 1, y: 5, kind: 'flower' });
  selectPlant(both, both.core.plants.find((plant) => plant.x === 2 && plant.y === 2).id);
  const removed = recycle(both);
  assert.equal(removed.ok, true);
  assert.equal(removed.delta.length > 0, true);
  selectFan(both, 'main');
  selectSeed(both, 'flower');
  const second = sow(both);
  assert.deepEqual(second.plant, { id: 4, x: 3, y: 5, kind: 'flower' });
  assert.equal(wishState(both.garden, both.core).both, true);
});

test('undo, recycle, and restart put the previous wind back', () => {
  const session = fresh('bend');
  playSteps(session, SOLUTIONS.bend.slice(0, 2));
  const bent = { ...landing(session, 'west') };
  undo(session);
  assert.deepEqual(landing(session, 'west'), { x: 4, y: 2 });
  assert.equal(session.core.plants.length, 0);
  assert.equal(session.core.seeds.hedge, 2);

  playSteps(session, [{ op: 'sow', fan: 'west', seed: 'hedge' }]);
  const hedge = session.core.plants[0];
  selectPlant(session, hedge.id);
  recycle(session);
  assert.equal(session.core.plants.length, 0);
  assert.equal(session.core.seeds.hedge, 2);
  assert.deepEqual(landing(session, 'west'), { x: 4, y: 2 });
  undo(session);
  assert.equal(session.core.plants.length, 1);
  assert.deepEqual(landing(session, 'west'), bent);

  playSteps(session, SOLUTIONS.bend.slice(2));
  assert.equal(wishState(session.garden, session.core).done, true);
  restart(session);
  assert.deepEqual(session.core.plants, []);
  assert.equal(session.core.dirs.west, 'N');
  assert.equal(session.core.dirs.north, 'E');
  assert.equal(session.core.seeds.flower, 2);
  undo(session);
  assert.equal(wishState(session.garden, session.core).done, true);
});

test('a rejected sow does not spend a seed', () => {
  const session = fresh('breeze');
  rotate(session);
  selectSeed(session, 'flower');
  sow(session);
  const again = sow(session);
  assert.equal(again.ok, false);
  assert.equal(session.core.seeds.flower, 1);
  assert.equal(session.core.plants.length, 1);
  selectSeed(session, 'hedge');
  const hedgeTry = sow(session);
  assert.equal(hedgeTry.ok, false);
  assert.equal(session.core.seeds.hedge, 1);
});

test('save round-trip restores fans, plants, undo, and ignores a broken garden', () => {
  const session = fresh('free');
  rotate(session);
  selectSeed(session, 'hedge');
  sow(session);
  let save = writeGarden(emptySave(), session, false);
  const raw = JSON.stringify(save);
  save = readSave(raw);
  const loaded = createSession(gardenById('free'), save.gardens.free);
  assert.equal(loaded.core.dirs.left, 'S');
  assert.equal(loaded.core.plants.length, 1);
  assert.equal(loaded.core.plants[0].kind, 'hedge');
  assert.equal(loaded.undo.length, 2);
  undo(loaded);
  assert.equal(loaded.core.plants.length, 0);
  assert.equal(loaded.core.dirs.left, 'S');

  const broken = createSession(gardenById('free'), {
    core: { dirs: { left: 'E' }, plants: [{ id: 1, x: 0, y: 2, kind: 'flower' }], seeds: { flower: 1, hedge: 1 }, nextId: 2 },
  });
  assert.deepEqual(broken.core.plants, []);
  assert.equal(broken.core.seeds.flower, GARDENS[3].seeds.flower);
  assert.deepEqual(readSave('{'), emptySave());
  assert.deepEqual(readSave('{"v":2}'), emptySave());
});

test('running a solution twice from a fresh garden matches', () => {
  const a = fresh('bend');
  const b = fresh('bend');
  playSteps(a, SOLUTIONS.bend);
  playSteps(b, SOLUTIONS.bend);
  assert.deepEqual(a.core.plants, b.core.plants);
  assert.deepEqual(a.core.dirs, b.core.dirs);
});

test('hedge on a bed does not count as the wish', () => {
  const garden = gardenById('bend');
  const core = initialCore(garden);
  core.plants.push({ id: 1, x: 0, y: 1, kind: 'hedge' });
  assert.equal(wishState(garden, core).filled, 0);
  core.plants[0].kind = 'flower';
  assert.equal(wishState(garden, core).filled, 1);
});

test('delta copy names the fan whose stream moved', () => {
  const session = fresh('bend');
  playSteps(session, SOLUTIONS.bend.slice(0, 1));
  selectSeed(session, 'hedge');
  const planted = sow(session);
  assert.match(describeDelta(session.garden, planted.delta, 'hedge'), /左风机的风路变了/);
});
