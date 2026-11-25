import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { LEVELS } from './levels.js';
import { SOLUTIONS } from './solutions.js';
import {
  advance,
  beginShot,
  createSession,
  emptyProgress,
  isUnlocked,
  playShot,
  recordWin,
  restart,
  shotsUsed,
  undo,
} from './session.js';
import {
  computeSupported,
  entityAt,
  fingerprint,
  formatState,
  loadLevel,
  shoot,
  step,
} from './sim.js';

function playLine(levelIndex, shots) {
  let session = createSession(levelIndex);
  const frames = [];
  for (const [x, y] of shots) {
    const played = playShot(session, x, y);
    assert.equal(played.ok, true, played.reason || 'shot rejected');
    session = played.session;
    frames.push(...played.frames);
    if (session.state.phase === 'won' || session.state.phase === 'lost') break;
  }
  return { session, frames };
}

function solve(levelIndex) {
  const queue = [createSession(levelIndex)];
  const seen = new Set();
  let guard = 0;
  while (queue.length) {
    if (++guard > 4000) throw new Error(`solver overflow on level ${levelIndex + 1}`);
    const session = queue.shift();
    const key = fingerprint(session.state);
    if (seen.has(key)) continue;
    seen.add(key);
    if (session.state.phase === 'won') return session;
    if (session.state.phase !== 'play' || !session.acceptingShots) continue;
    const targets = session.state.entities.filter(
      (e) => !e.rubble && (e.material === 'wood' || e.material === 'brick'),
    );
    for (const target of targets) {
      const played = playShot(session, target.x, target.y);
      if (played.ok) queue.push(played.session);
    }
  }
  return null;
}

test('six handcrafted levels start stable and under the same rules', () => {
  assert.equal(LEVELS.length, 6);
  assert.equal(SOLUTIONS.length, 6);
  for (const level of LEVELS) {
    const state = loadLevel(level);
    const settled = step(state);
    assert.equal(settled.state.phase, 'play', `${level.name} collapses before a shot\n${formatState(state)}`);
    assert.equal(fingerprint(settled.state), fingerprint(state));
    assert.equal(state.salvage, 0);
    assert.equal(state.shotsLeft, level.shots);
    if (level.id === 1) assert.equal(state.hasProtected, false);
    else assert.equal(state.hasProtected, true);
  }
});

test('level maps match the authored sketches', () => {
  assert.equal(formatState(loadLevel(LEVELS[0])), ['.WWW.', '.A.A.', '.#C#.', '#####'].join('\n'));
  assert.equal(
    formatState(loadLevel(LEVELS[1])),
    ['.BB...B.', '.WWWWWW.', '...A....', '...A.PP.', 'CCC#.###', '########'].join('\n'),
  );
});

test('wood can hang sideways and brick cannot', () => {
  const wood = loadLevel({
    id: 'wood-hang',
    name: 'wood-hang',
    hint: '',
    shots: 1,
    goal: 1,
    rows: ['WWW', 'A.A', '###'],
  });
  const brick = loadLevel({
    id: 'brick-hang',
    name: 'brick-hang',
    hint: '',
    shots: 1,
    goal: 1,
    rows: ['WBW', 'A.A', '###'],
  });
  const woodSupported = computeSupported(wood);
  const woodBlock = entityAt(wood, 1, 2);
  assert.ok(woodSupported.has(woodBlock.id));
  assert.equal(step(wood).state.phase, 'play');

  const brickSupported = computeSupported(brick);
  const brickBlock = entityAt(brick, 1, 2);
  assert.equal(brickSupported.has(brickBlock.id), false);
  const fell = step(brick);
  assert.equal(fell.state.phase, 'resolving');
  assert.equal(entityAt(fell.state, 1, 2), null);
  assert.ok(entityAt(fell.state, 0, 2)?.material === 'wood');
  assert.ok(entityAt(fell.state, 2, 2)?.material === 'wood');
});

test('a shot does not score salvage until the piece enters a collector', () => {
  const played = playShot(createSession(0), 2, 3);
  assert.equal(played.ok, true);
  const frames = played.frames;
  assert.equal(frames[0].phase, 'resolving');
  assert.equal(frames[0].salvage, 0);
  assert.equal(frames[0].reason, '');
  const cut = frames[0].entities.find((e) => e.material === 'wood' && e.rubble);
  assert.equal(cut.x, 2);
  assert.equal(cut.y, 3);
  for (const frame of frames) {
    if (frame.entities.some((e) => e.id === cut.id)) assert.equal(frame.salvage, 0);
  }
  assert.ok(frames.some((frame) => frame.phase === 'resolving' && frame.salvage === 0));
  assert.ok(frames.some((frame) => frame.phase === 'resolving' && frame.salvage === 1 && frame.reason === ''));
  assert.equal(frames.at(-1).phase, 'won');
  assert.equal(frames.at(-1).salvage, 1);
  assert.equal(frames.at(-1).reason, '碎块落进了回收箱');
  assert.equal(frames.at(-1).entities.some((e) => e.id === cut.id), false);
  assert.equal(frames.at(-1).entities.filter((e) => e.material === 'wood').length, 2);
});

test('debris lands on the protected room and does not pass through', () => {
  const fixture = loadLevel({
    id: 'impact',
    name: 'impact',
    hint: '',
    shots: 1,
    goal: 1,
    rows: ['.B.', '...', '.P.', '.#.', '###'],
  });
  let state = fixture;
  const seen = [];
  for (let i = 0; i < 8; i++) {
    const next = step(state);
    state = next.state;
    seen.push(state);
    if (next.done && state.phase !== 'resolving') break;
  }
  assert.equal(state.phase, 'lost');
  assert.match(state.reason, /砸中/);
  const room = state.entities.find((e) => e.material === 'protected');
  const brick = state.entities.find((e) => e.material === 'brick');
  assert.ok(room);
  assert.equal(room.x, 1);
  assert.equal(room.y, 2);
  assert.ok(brick);
  assert.equal(brick.x, room.x);
  assert.equal(brick.y, room.y + 1);
  assert.equal(state.entities.filter((e) => e.x === room.x && e.y === room.y).length, 1);
  assert.equal(state.salvage, 0);
  assert.ok(seen.some((frame) => frame.phase === 'resolving'));
});

test('direct hits on the room or steel do not change the world', () => {
  const session = createSession(1);
  const before = fingerprint(session.state);
  for (const [x, y] of [[5, 2], [6, 2], [3, 3], [3, 2]]) {
    const shot = shoot(session.state, x, y);
    assert.equal(shot.ok, false);
  }
  assert.equal(fingerprint(session.state), before);
  assert.equal(session.state.shotsLeft, session.state.shotMax);
  assert.equal(session.state.salvage, 0);
});

test('every handcrafted solution wins, and the losing lines really lose', () => {
  SOLUTIONS.forEach((solution, index) => {
    const won = playLine(index, solution.shots);
    assert.equal(
      won.session.state.phase,
      'won',
      `level ${index + 1} ${won.session.state.reason}\n${formatState(won.session.state)}`,
    );
    assert.ok(won.session.state.salvage >= won.session.state.goal);
    if (won.session.state.hasProtected) {
      const rooms = won.session.state.entities.filter((e) => e.material === 'protected');
      assert.ok(rooms.length >= 1);
      assert.equal(won.session.state.failure, null);
      assert.match(won.session.state.reason, /绿房安全/);
    }
    assert.ok(won.frames.some((frame) => frame.phase === 'resolving' && frame.reason === ''));
    assert.equal(won.frames.at(-1).phase, 'won');

    const found = solve(index);
    assert.ok(found, `solver found no win for level ${index + 1}`);
    assert.equal(found.state.phase, 'won');

    if (solution.losing) {
      const lost = playLine(index, solution.losing);
      assert.equal(
        lost.session.state.phase,
        'lost',
        `level ${index + 1} losing line won\n${formatState(lost.session.state)}`,
      );
      assert.notEqual(lost.session.state.reason, '');
    }
  });
});

test('level 2 wrong cut collects the quota and still loses because the room is hit', () => {
  const lost = playLine(1, SOLUTIONS[1].losing);
  assert.equal(lost.session.state.phase, 'lost');
  assert.match(lost.session.state.reason, /砸中/);
  assert.ok(lost.session.state.salvage >= lost.session.state.goal);
  assert.ok(lost.frames.some((frame) => frame.phase === 'resolving' && frame.failure && frame.reason === ''));
  const roomCells = lost.session.state.entities.filter((e) => e.material === 'protected');
  assert.equal(roomCells.length, 2);
  for (const room of roomCells) {
    assert.equal(
      lost.session.state.entities.filter((e) => e.x === room.x && e.y === room.y).length,
      1,
    );
  }
  const sitting = lost.session.state.entities.some((block) =>
    roomCells.some((room) => block.material !== 'protected' && block.x === room.x && block.y === room.y + 1),
  );
  assert.equal(sitting, true);
});

test('undo and restart restore world, shots, salvage, and the room', () => {
  let session = createSession(1);
  const fresh = fingerprint(session.state);
  const played = playShot(session, 3, 4);
  session = played.session;
  assert.equal(session.state.phase, 'lost');
  assert.notEqual(fingerprint(session.state), fresh);
  const undone = undo(session);
  assert.equal(undone.ok, true);
  session = undone.session;
  assert.equal(fingerprint(session.state), fresh);
  assert.equal(session.state.shotsLeft, session.state.shotMax);
  assert.equal(session.state.salvage, 0);
  assert.equal(session.state.failure, null);
  assert.equal(session.state.phase, 'play');
  assert.equal(session.past.length, 0);
  const again = undo(session);
  assert.equal(again.ok, false);

  const won = playLine(3, SOLUTIONS[3].shots);
  const rewound = undo(won.session);
  assert.equal(rewound.ok, true);
  assert.equal(rewound.session.state.phase, 'play');
  assert.equal(rewound.session.state.salvage, 2);
  assert.equal(rewound.session.state.shotsLeft, 1);
  const fully = undo(rewound.session);
  assert.equal(fingerprint(fully.session.state), fingerprint(createSession(3).state));

  const reset = restart(won.session);
  assert.equal(fingerprint(reset.session.state), fingerprint(createSession(3).state));
  assert.equal(reset.session.past.length, 0);
});

test('undo is refused while a collapse is still resolving and does not leak across levels', () => {
  let session = createSession(1);
  const started = beginShot(session, 2, 4);
  assert.equal(started.ok, true);
  session = started.session;
  assert.equal(session.acceptingShots, false);
  const blocked = beginShot(session, 1, 4);
  assert.equal(blocked.ok, false);
  const earlyUndo = undo(session);
  assert.equal(earlyUndo.ok, false);
  assert.equal(fingerprint(earlyUndo.session.state), fingerprint(session.state));

  let finished = session;
  while (!finished.acceptingShots) finished = advance(finished);
  const back = undo(finished);
  assert.equal(back.ok, true);
  const levelOne = createSession(0);
  assert.equal(fingerprint(levelOne.state), fingerprint(createSession(0).state));
  assert.notEqual(fingerprint(levelOne.state), fingerprint(back.session.state));
  assert.equal(levelOne.past.length, 0);
  assert.equal(undo(levelOne).ok, false);
});

test('restart snaps back even if it replaces a won board', () => {
  const won = playLine(0, SOLUTIONS[0].shots);
  const reset = restart(won.session);
  assert.equal(reset.session.state.phase, 'play');
  assert.equal(reset.session.state.salvage, 0);
  assert.equal(reset.session.state.shotsLeft, 1);
  assert.equal(fingerprint(reset.session.state), fingerprint(createSession(0).state));
});

test('progress unlocks the next level only and keeps the best shot count', () => {
  let progress = emptyProgress();
  assert.equal(isUnlocked(progress, 0), true);
  assert.equal(isUnlocked(progress, 1), false);
  assert.equal(isUnlocked(progress, 5), false);
  progress = recordWin(progress, 0, 1);
  assert.equal(progress.cleared[0], true);
  assert.equal(isUnlocked(progress, 1), true);
  assert.equal(isUnlocked(progress, 2), false);
  progress = recordWin(progress, 0, 3);
  assert.equal(progress.best[0], 1);
  const won = playLine(5, SOLUTIONS[5].shots);
  assert.equal(shotsUsed(won.session.state), 2);
});

test('catalog and neighboring games stay in place', () => {
  const games = JSON.parse(fs.readFileSync(new URL('../games.json', import.meta.url), 'utf8'));
  assert.ok(Array.isArray(games));
  assert.ok(games.some((game) => game.slug === 'demolition-salvage' && game.name === '拆迁保全队'));
  assert.ok(games.some((game) => game.slug === 'stack-tower'));
  assert.ok(games.some((game) => game.slug === 'dotsboxes'));
  const slugs = games.map((game) => game.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  const root = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(root, /fetch\('games\.json'\)/);
  assert.ok(fs.statSync(new URL('../switchmail/index.html', import.meta.url)).size > 500);
  assert.ok(fs.statSync(new URL('../flip-trap-m0/index.html', import.meta.url)).size > 500);
  const page = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert.match(page, /src="\.\/main\.js"/);
  assert.match(page, /href="\.\/style\.css"/);
  assert.doesNotMatch(page, /https?:\/\//);
});
