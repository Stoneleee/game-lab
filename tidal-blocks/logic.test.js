import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SIZE,
  SHAPES,
  boardToText,
  clearLines,
  compress,
  commitTide,
  createRun,
  currentTide,
  deadlockReason,
  describeTide,
  fits,
  fullLines,
  lineScore,
  parseBoard,
  place,
  placementsFor,
  planCurrentTide,
  tidePlan,
  undo,
} from './logic.js';
import { SEEDS, SOLUTIONS, seedById } from './seeds.js';

function play(seed, steps) {
  let state = createRun(seed);
  for (const step of steps) {
    if (step.op === 'place') {
      const placed = place(state, step.shape, step.r, step.c);
      assert.equal(placed.ok, true, placed.reason || `${seed.id} rejected ${step.shape} @ ${step.r},${step.c}`);
      state = placed.state;
    } else if (step.op === 'tide') {
      const tide = commitTide(state);
      assert.equal(tide.ok, true, tide.reason || `${seed.id} tide rejected`);
      state = tide.state;
    } else {
      throw new Error(`bad step ${step.op}`);
    }
  }
  return state;
}

function count(board, cell) {
  return board.flat().filter((item) => item === cell).length;
}

test('fixed seeds stay small and start without a finished line', () => {
  assert.deepEqual(SEEDS.map((seed) => seed.id), ['intro', 'pockets', 'trio', 'tight']);
  for (const seed of SEEDS) {
    const state = createRun(seed);
    assert.equal(state.board.length, SIZE);
    assert.equal(state.phase, 'place');
    assert.equal(state.score, 0);
    assert.equal(state.undoStack.length, 0);
    assert.ok(seed.hands.length <= 2);
    assert.ok(seed.hands.every((hand) => hand.pieces.length <= 3));
    assert.equal(fullLines(state.board).rows.length + fullLines(state.board).cols.length, 0);
  }
});

test('compression packs inside anchor segments and does not change row counts', () => {
  const board = parseBoard([
    'o.o.#.',
    '.o..o#',
    '#o.o.o',
    '......',
    'ooo#oo',
    '#....o',
  ]);
  for (const tide of ['left', 'right']) {
    const packed = compress(board, tide);
    for (let r = 0; r < SIZE; r += 1) {
      assert.equal(count([packed[r]], 'o'), count([board[r]], 'o'), `row ${r} ${tide}`);
      for (let c = 0; c < SIZE; c += 1) {
        if (board[r][c] === '#') assert.equal(packed[r][c], '#');
      }
    }
  }
  assert.equal(boardToText(compress(board, 'left')), [
    'oo..#.',
    'oo...#',
    '#ooo..',
    '......',
    'ooo#oo',
    '#o....',
  ].join('\n'));
  assert.equal(boardToText(compress(board, 'right')), [
    '..oo#.',
    '...oo#',
    '#..ooo',
    '......',
    'ooo#oo',
    '#....o',
  ].join('\n'));
});

test('a full column can appear only after the tide moves blocks', () => {
  const before = parseBoard([
    'oo....',
    '.oo...',
    '..oo..',
    '...oo.',
    '....oo',
    'o....o',
  ]);
  assert.deepEqual(fullLines(before), { rows: [], cols: [] });
  const plan = tidePlan(before, 'left');
  assert.equal(plan.moved, 8);
  assert.deepEqual(plan.lines, { rows: [], cols: [0, 1] });
  assert.deepEqual(plan.freshCols, [0, 1]);
  assert.equal(plan.gained, lineScore(2));
  assert.equal(plan.gained, 250);
  assert.equal(count(plan.cleared, 'o'), 0);
});

test('intro solution clears a column the placement itself did not fill', () => {
  const seed = seedById('intro');
  let state = createRun(seed);
  const placed = place(state, 'i2v', 4, 0);
  state = placed.state;
  const before = fullLines(state.board);
  assert.deepEqual(before, { rows: [], cols: [] });
  const plan = planCurrentTide(state);
  assert.equal(plan.ok, true);
  assert.equal(plan.tide, 'left');
  assert.equal(plan.moved, 4);
  assert.deepEqual(plan.lines, { rows: [], cols: [0] });
  assert.deepEqual(plan.freshCols, [0]);
  state = commitTide(state).state;
  assert.equal(state.phase, 'won');
  assert.equal(state.lines, 1);
  assert.equal(state.score, 100);
  assert.equal(count(state.board, 'o'), 0);
  assert.match(describeTide(state.last), /挤/);
  assert.match(describeTide(state.last), /第 1 列/);
});

test('intro placement on an occupied pair of rows does not clear', () => {
  const state = play(seedById('intro'), [
    { op: 'place', shape: 'i2v', r: 0, c: 0 },
    { op: 'tide' },
  ]);
  assert.equal(state.phase, 'short');
  assert.equal(state.lines, 0);
  assert.equal(state.score, 0);
  assert.match(describeTide(state.last), /没有行或列排满/);
});

test('pockets: only the anchor\'s right side feeds the right-hand column', () => {
  const seed = seedById('pockets');
  const good = play(seed, SOLUTIONS.pockets);
  assert.equal(good.phase, 'won');
  assert.equal(good.last.tide, 'right');
  assert.ok(good.last.moved > 0);
  assert.deepEqual(good.last.freshCols, [5]);
  assert.equal(count(good.board, '#'), 1, 'anchor stays unless its line clears');

  const bad = play(seed, [
    { op: 'place', shape: 'i2', r: 5, c: 0 },
    { op: 'tide' },
  ]);
  assert.equal(bad.phase, 'short');
  assert.equal(bad.lines, 0);
  assert.equal(boardToText(bad.board).split('\n')[5][2], '#');
});

test('trio is two tides, and the second tide is the opposite direction', () => {
  const seed = seedById('trio');
  let state = createRun(seed);
  assert.equal(currentTide(state), 'left');
  assert.equal(state.remaining.length, 3);
  state = play(seed, SOLUTIONS.trio.slice(0, 4));
  assert.equal(state.phase, 'place');
  assert.equal(state.lines, 1);
  assert.equal(currentTide(state), 'right');
  assert.deepEqual(state.remaining, ['i3v', 'i3v']);
  const beforeSecond = state.board.map((row) => row.join('')).join('');
  assert.equal(beforeSecond.includes('o'), false);
  state = play(seed, SOLUTIONS.trio);
  assert.equal(state.phase, 'won');
  assert.equal(state.lines, 2);
  assert.equal(state.score, 200);
  assert.equal(state.last.tide, 'right');
  assert.ok(state.last.freshCols.includes(5));
  assert.equal(count(state.board, 'o'), 0);
});

test('covering the same rows twice does not satisfy the first tide', () => {
  const state = play(seedById('trio'), [
    { op: 'place', shape: 'i2v', r: 0, c: 0 },
    { op: 'place', shape: 'dot', r: 2, c: 0 },
    { op: 'place', shape: 'dot', r: 3, c: 1 },
    { op: 'tide' },
  ]);
  assert.equal(state.lines, 0);
  assert.equal(state.phase, 'place');
  assert.equal(currentTide(state), 'right');
});

test('tight deadlock is a real missed fit, and undo reopens it', () => {
  const seed = seedById('tight');
  let state = createRun(seed);
  assert.equal(placementsFor(state.board, 'i3').length > 0, true);
  const blocked = place(state, 'dot', 5, 2);
  assert.equal(blocked.ok, true);
  state = blocked.state;
  assert.equal(state.phase, 'dead');
  assert.match(state.deadReason, /死局/);
  assert.match(state.deadReason, /横三/);
  assert.equal(deadlockReason(state.board, state.remaining), state.deadReason);
  assert.equal(placementsFor(state.board, 'i3').length, 0);
  assert.equal(commitTide(state).ok, false);

  const undone = undo(state);
  assert.equal(undone.ok, true);
  state = undone.state;
  assert.equal(state.phase, 'place');
  assert.equal(state.deadReason, '');
  assert.equal(placementsFor(state.board, 'i3').length, 2);
  assert.deepEqual(state.remaining, ['i3', 'dot']);

  state = play(seed, SOLUTIONS.tight);
  assert.equal(state.phase, 'won');
  assert.equal(state.lines, 1);
  assert.ok(state.last.moved > 0);
  assert.deepEqual(state.last.rows, []);
  assert.deepEqual(state.last.freshCols, [0]);
  const pre = tidePlan(parseBoard(seed.board), 'left');
  assert.equal(pre.lines.cols.includes(0), false);
});

test('undo walks back a placement and a tide, restart is a new run', () => {
  const seed = seedById('intro');
  let state = play(seed, SOLUTIONS.intro);
  assert.equal(state.phase, 'won');
  const afterTide = undo(state);
  assert.equal(afterTide.ok, true);
  state = afterTide.state;
  assert.equal(state.phase, 'ready');
  assert.equal(state.score, 0);
  assert.equal(state.lines, 0);
  assert.equal(count(state.board, 'o'), 6);
  const plan = planCurrentTide(state);
  assert.equal(plan.compressed[0][0], 'o');
  assert.equal(plan.compressed[0][5], '.');
  const afterPlace = undo(state);
  state = afterPlace.state;
  assert.equal(state.phase, 'place');
  assert.deepEqual(state.remaining, ['i2v']);
  assert.equal(count(state.board, 'o'), 4);
  assert.equal(undo(state).ok, false);

  const again = createRun(seed);
  assert.equal(again.score, 0);
  assert.equal(boardToText(again.board), seed.board.join('\n'));
});

test('illegal placements do not change the board', () => {
  const seed = seedById('pockets');
  const state = createRun(seed);
  const text = boardToText(state.board);
  const overlap = place(state, 'i2', 5, 1);
  assert.equal(overlap.ok, false);
  assert.equal(boardToText(overlap.state.board), text);
  const off = place(state, 'i2', 5, 5);
  assert.equal(off.ok, false);
  const missing = place(state, 'dot', 0, 1);
  assert.equal(missing.ok, false);
  assert.equal(fits(state.board, SHAPES.i2, 5, 3), true);
  assert.equal(commitTide(state).ok, false);
});

test('preview compression is the board commitTide resolves', () => {
  const state = play(seedById('pockets'), [{ op: 'place', shape: 'i2', r: 5, c: 4 }]);
  const plan = planCurrentTide(state);
  const committed = commitTide(state);
  assert.equal(boardToText(plan.compressed), boardToText(committed.plan.compressed));
  assert.equal(boardToText(committed.state.board), boardToText(plan.cleared));
  for (let r = 0; r < SIZE; r += 1) {
    assert.equal(count([plan.compressed[r]], 'o') + count([plan.compressed[r]], '#'), count([state.board[r]], 'o') + count([state.board[r]], '#'));
  }
});

test('clearing removes every cell on a full line and nowhere else', () => {
  const board = parseBoard([
    'oooooo',
    'o.....',
    'o.....',
    'o.....',
    'o.....',
    'o.....',
  ]);
  const lines = fullLines(board);
  assert.deepEqual(lines, { rows: [0], cols: [0] });
  const cleared = clearLines(board, lines);
  assert.equal(cleared.flat().join(''), '.'.repeat(36));
});
