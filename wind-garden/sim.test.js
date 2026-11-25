import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { GARDENS } from './gardens.js';
import {
  describeTrace,
  pathDelta,
  rotCW,
  streamSig,
  trace,
} from './sim.js';

function garden(extra = {}) {
  return {
    width: 7,
    height: 5,
    beds: [{ x: 4, y: 2 }],
    stones: [],
    fans: [{ id: 'fan', name: '风机', x: 0, y: 2, dir: 'E', power: 4 }],
    seeds: { flower: 2, hedge: 1 },
    ...extra,
  };
}

function core(dirs = { fan: 'E' }, plants = []) {
  return { dirs, plants, seeds: { flower: 2, hedge: 1 }, nextId: 1 };
}

test('straight wind spends one strength per cell and roots on the bed', () => {
  const g = garden();
  const tr = trace(g, core(), 'fan');
  assert.equal(tr.outcome, 'root');
  assert.equal(tr.stop, 'spent');
  assert.deepEqual(tr.landing, { x: 4, y: 2 });
  assert.deepEqual(tr.steps.map((step) => [step.x, step.y, step.rem]), [[1, 2, 3], [2, 2, 2], [3, 2, 1], [4, 2, 0]]);
  assert.equal(tr.turns.length, 0);
  assert.equal(describeTrace(g, g.fans[0], tr, 'flower'), '风机的风直行。花籽会落到花床。');
});

test('the same garden traces the same stream twice', () => {
  const g = garden();
  const a = trace(g, core({ fan: 'N' }), 'fan');
  const b = trace(g, core({ fan: 'N' }), 'fan');
  assert.deepEqual(a, b);
  assert.equal(a.stop, 'edge');
  assert.deepEqual(a.landing, { x: 0, y: 0 });
  assert.match(describeTrace(g, g.fans[0], a, 'flower'), /前方出界/);
  assert.match(describeTrace(g, g.fans[0], a, 'flower'), /亮起的格子/);
});

test('a flower on the path does not change the stream', () => {
  const g = garden();
  const empty = core();
  const planted = core({ fan: 'E' }, [{ id: 1, x: 2, y: 2, kind: 'flower' }]);
  const before = trace(g, empty, 'fan');
  const after = trace(g, planted, 'fan');
  assert.equal(streamSig(before), streamSig(after));
  assert.equal(pathDelta(g, empty, planted).length, 0);
  assert.equal(after.outcome, 'root');
  assert.deepEqual(after.landing, { x: 4, y: 2 });
});

test('a flower on the landing blocks rooting but not the stream', () => {
  const g = garden();
  const empty = core();
  const planted = core({ fan: 'E' }, [{ id: 1, x: 4, y: 2, kind: 'flower' }]);
  const after = trace(g, planted, 'fan');
  assert.equal(streamSig(trace(g, empty, 'fan')), streamSig(after));
  assert.equal(after.outcome, 'occupied');
  assert.match(describeTrace(g, g.fans[0], after, 'flower'), /落点已有植物/);
});

test('a hedge turns the stream clockwise and is never entered', () => {
  const g = garden();
  const before = core();
  const after = core({ fan: 'E' }, [{ id: 1, x: 2, y: 2, kind: 'hedge' }]);
  const open = trace(g, before, 'fan');
  const bent = trace(g, after, 'fan');
  assert.notEqual(streamSig(open), streamSig(bent));
  assert.equal(bent.steps.some((step) => step.x === 2 && step.y === 2), false);
  assert.equal(bent.turns.length, 1);
  assert.equal(bent.turns[0].from, 'E');
  assert.equal(bent.turns[0].to, 'S');
  assert.equal(bent.turns[0].blockKind, 'hedge');
  assert.deepEqual(bent.landing, { x: 1, y: 4 });
  assert.match(describeTrace(g, g.fans[0], bent, 'hedge'), /被灌木挡住/);
  assert.match(describeTrace(g, g.fans[0], bent, 'hedge'), /朝东改到朝南/);
  const delta = pathDelta(g, before, after);
  assert.equal(delta.length, 1);
  assert.deepEqual(delta[0].from, { x: 4, y: 2 });
  assert.deepEqual(delta[0].to, { x: 1, y: 4 });
});

test('clockwise is skipped when that side is blocked', () => {
  const g = garden({
    stones: [{ x: 1, y: 3 }],
    fans: [{ id: 'fan', name: '风机', x: 0, y: 2, dir: 'E', power: 4 }],
  });
  const bent = trace(g, core({ fan: 'E' }, [{ id: 1, x: 2, y: 2, kind: 'hedge' }]), 'fan');
  assert.equal(bent.turns[0].from, 'E');
  assert.equal(bent.turns[0].to, 'N');
  assert.equal(bent.steps.some((step) => step.x === 1 && step.y === 3), false);
  assert.deepEqual(bent.landing, { x: 1, y: 0 });
});

test('a boxed stream roots in front of the blocker', () => {
  const g = garden({
    height: 5,
    stones: [{ x: 1, y: 3 }, { x: 1, y: 1 }],
  });
  const boxed = trace(g, core({ fan: 'E' }, [{ id: 1, x: 2, y: 2, kind: 'hedge' }]), 'fan');
  assert.equal(boxed.stop, 'boxed');
  assert.equal(boxed.outcome, 'root');
  assert.deepEqual(boxed.landing, { x: 1, y: 2 });
});

test('a stone deflects like a hedge', () => {
  const g = garden({ stones: [{ x: 2, y: 2 }] });
  const bent = trace(g, core(), 'fan');
  assert.equal(bent.turns[0].blockKind, 'stone');
  assert.equal(bent.turns[0].to, 'S');
  assert.equal(bent.steps.some((step) => step.x === 2 && step.y === 2), false);
});

test('wind that only blows out of the fan does not root', () => {
  const g = garden();
  const tr = trace(g, core({ fan: 'W' }), 'fan');
  assert.equal(tr.outcome, 'miss');
  assert.equal(tr.landing, null);
  assert.equal(tr.steps.length, 0);
  assert.match(describeTrace(g, g.fans[0], tr, 'flower'), /吹出了花园/);
});

test('a ring of blockers ends immediately instead of spinning', () => {
  const g = {
    width: 3,
    height: 3,
    beds: [],
    stones: [{ x: 0, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 2 }],
    fans: [{ id: 'fan', name: '风机', x: 1, y: 1, dir: 'E', power: 4 }],
  };
  const tr = trace(g, core(), 'fan');
  assert.equal(tr.outcome, 'miss');
  assert.equal(tr.stop, 'boxed');
  assert.equal(tr.steps.length, 0);
  assert.equal(tr.turns.length, 0);
});

test('two hedges compose into two turns and still settle', () => {
  const g = {
    width: 6,
    height: 5,
    beds: [],
    stones: [],
    fans: [{ id: 'fan', name: '风机', x: 0, y: 1, dir: 'E', power: 8 }],
  };
  const planted = core({ fan: 'E' }, [
    { id: 1, x: 2, y: 1, kind: 'hedge' },
    { id: 2, x: 1, y: 3, kind: 'hedge' },
  ]);
  const tr = trace(g, planted, 'fan');
  assert.equal(tr.turns.length, 2);
  assert.equal(tr.turns[0].to, 'S');
  assert.equal(tr.turns[1].to, 'W');
  assert.deepEqual(tr.steps.map((step) => [step.x, step.y]), [[1, 1], [1, 2], [0, 2]]);
  assert.equal(tr.outcome, 'root');
  assert.deepEqual(tr.landing, { x: 0, y: 2 });
  assert.match(describeTrace(g, g.fans[0], tr, 'flower'), /之后又改了1次/);
});

test('rotation order is one clockwise step', () => {
  assert.equal(rotCW('N'), 'E');
  assert.equal(rotCW('E'), 'S');
  assert.equal(rotCW('S'), 'W');
  assert.equal(rotCW('W'), 'N');
});

test('page files do not call the network', () => {
  for (const file of ['index.html', 'style.css', 'main.js', 'sim.js', 'session.js', 'gardens.js']) {
    const text = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /https?:\/\//i, file);
    assert.doesNotMatch(text, /\bfetch\s*\(/, file);
    assert.doesNotMatch(text, /XMLHttpRequest|sendBeacon|WebSocket/, file);
  }
});

test('authored gardens stay inside their own grids', () => {
  assert.equal(GARDENS.length, 4);
  const ids = new Set(GARDENS.map((item) => item.id));
  assert.deepEqual([...ids], ['breeze', 'bend', 'fork', 'free']);
  for (const item of GARDENS) {
    assert.ok(item.fans.length >= 1);
    for (const fan of item.fans) {
      assert.ok(fan.x >= 0 && fan.y >= 0 && fan.x < item.width && fan.y < item.height);
      assert.ok(fan.power >= 1 && fan.power <= 8);
    }
    for (const bed of item.beds) {
      assert.equal(item.fans.some((fan) => fan.x === bed.x && fan.y === bed.y), false);
    }
  }
});
