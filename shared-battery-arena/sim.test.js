import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { decideAi } from './ai.js';
import {
  RULES,
  createMatch,
  idleInput,
  resetMatch,
  snapshot,
  tick,
} from './sim.js';

const idle = idleInput();

function speed(body) {
  return Math.hypot(body.vx, body.vy);
}

function hold(state, inputs, frames) {
  for (let i = 0; i < frames; i++) tick(state, inputs, RULES.dt);
  return state;
}

function placeKick(state) {
  state.players[0].x = state.ball.x - 30;
  state.players[0].y = state.ball.y;
  state.players[0].vx = 0;
  state.players[0].vy = 0;
}

test('a new match has one shared battery and a clean pitch', () => {
  const state = createMatch({ phase: 'play' });
  assert.equal(state.battery, 100);
  assert.equal(state.sprintArmed, true);
  assert.deepEqual(state.score, [0, 0]);
  assert.equal(state.time, 0);
  assert.equal(state.players[0].vx, 0);
  assert.equal(state.players[1].vy, 0);
  assert.equal(state.ball.vx, 0);
  assert.equal(state.ball.vy, 0);
  assert.equal(state.ball.x, RULES.fieldW / 2);
  assert.equal('battery' in state.players[0], false);
  assert.equal('battery' in state.players[1], false);
  assert.equal(state.players.length, 2);
});

test('either side spends the same pool, and both at once spend twice', () => {
  const solo = [];
  for (const who of [0, 1]) {
    const state = createMatch({ phase: 'play' });
    const inputs = [idle, idle];
    inputs[who] = { x: 1, y: 0, sprint: true, kick: false };
    hold(state, inputs, 60);
    solo.push(state.battery);
    assert.equal(state.sprinting[who], true);
    assert.equal(state.sprinting[1 - who], false);
  }
  assert.ok(Math.abs(solo[0] - solo[1]) < 1e-6, `sides diverged ${solo[0]} vs ${solo[1]}`);
  assert.ok(solo[0] < 70, `solo drain too small: ${solo[0]}`);

  const both = createMatch({ phase: 'play' });
  hold(both, [
    { x: 1, y: 0, sprint: true, kick: false },
    { x: -1, y: 0, sprint: true, kick: false },
  ], 60);
  const spentSolo = 100 - solo[0];
  const spentBoth = 100 - both.battery;
  assert.ok(Math.abs(spentBoth - spentSolo * 2) < 1e-4, `both ${spentBoth} solo ${spentSolo}`);
});

test('holding sprint while standing does not spend the pack', () => {
  const state = createMatch({ phase: 'play' });
  state.battery = 40;
  hold(state, [{ x: 0, y: 0, sprint: true, kick: false }, idle], 60);
  assert.ok(state.battery > 40);
  assert.deepEqual(state.sprinting, [false, false]);
});

test('a diagonal stick is not faster than a cardinal stick', () => {
  const cardinal = createMatch({ phase: 'play' });
  const diagonal = createMatch({ phase: 'play' });
  hold(cardinal, [{ x: 1, y: 0, sprint: false, kick: false }, idle], 40);
  hold(diagonal, [{ x: 8, y: 8, sprint: false, kick: false }, idle], 40);
  assert.ok(Math.abs(speed(cardinal.players[0]) - speed(diagonal.players[0])) < 1e-6);
});

test('empty pack refuses sprint until it recharges past the gate', () => {
  const state = createMatch({ phase: 'play' });
  state.battery = 0;
  const input = [{ x: 1, y: 0, sprint: true, kick: false }, idle];
  hold(state, input, 20);
  assert.equal(state.sprintArmed, false);
  assert.equal(state.sprinting[0], false);
  assert.ok(speed(state.players[0]) <= RULES.baseSpeed + 0.01);
  assert.ok(state.battery > 0 && state.battery < RULES.sprintMin);
  const before = state.battery;
  while (state.battery < RULES.sprintMin) tick(state, [idle, idle], RULES.dt);
  assert.equal(state.sprintArmed, true);
  assert.ok(state.battery >= before);
  tick(state, input, RULES.dt);
  assert.equal(state.sprinting[0], true);
  assert.ok(state.battery < RULES.sprintMin);
});

test('powered kick costs 18 from the shared pack and a dry kick does not', () => {
  const quiet = createMatch({ phase: 'play' });
  const powered = createMatch({ phase: 'play' });
  placeKick(quiet);
  placeKick(powered);
  quiet.battery = 80;
  powered.battery = 80;
  tick(quiet, [{ x: 1, y: 0, sprint: false, kick: false }, idle], RULES.dt);
  tick(powered, [{ x: 1, y: 0, sprint: false, kick: true }, idle], RULES.dt);
  assert.ok(Math.abs(quiet.battery - RULES.kickCost - powered.battery) < 1e-6);
  assert.equal(powered.kickCount[0], 1);
  assert.equal(quiet.kickCount[0], 0);
  const expected = RULES.kickSpeed * Math.exp(-RULES.ballDrag * RULES.dt);
  assert.ok(Math.abs(speed(powered.ball) - expected) < 1e-6);

  const dry = createMatch({ phase: 'play' });
  dry.battery = RULES.kickCost - 1;
  placeKick(dry);
  tick(dry, [{ x: 1, y: 0, sprint: false, kick: true }, idle], RULES.dt);
  assert.ok(dry.battery > RULES.kickCost - 1);
  assert.equal(dry.kickCount[0], 1);
  const weak = RULES.weakSpeed * Math.exp(-RULES.ballDrag * RULES.dt);
  assert.ok(Math.abs(speed(dry.ball) - weak) < 1e-6);

  const far = createMatch({ phase: 'play' });
  const before = far.battery;
  tick(far, [{ x: 1, y: 0, sprint: false, kick: true }, idle], RULES.dt);
  assert.equal(far.kickCount[0], 0);
  assert.ok(far.battery >= before);
});

test('driving the ball through the mouth scores, and the pause clears motion', () => {
  const state = createMatch({ phase: 'play' });
  state.players[0].x = 790;
  state.players[0].y = state.h / 2;
  state.ball.x = 830;
  state.ball.y = state.h / 2;
  state.players[1].x = 120;
  state.players[1].y = 50;
  const before = state.battery;
  let frames = 0;
  while (state.score[0] === 0 && frames < 180) {
    tick(state, [{ x: 1, y: 0, sprint: true, kick: true }, idle], RULES.dt);
    frames += 1;
  }
  assert.equal(state.score[0], 1);
  assert.equal(state.score[1], 0);
  assert.equal(state.phase, 'goal');
  assert.equal(state.players[0].vx, 0);
  assert.equal(state.players[1].vx, 0);
  assert.equal(state.ball.vx, 0);
  assert.equal(state.ball.vy, 0);
  assert.equal(state.ball.x, RULES.fieldW / 2);
  assert.ok(state.battery < before, 'scoring spent shared energy');
  const parked = state.battery;
  hold(state, [{ x: 1, y: 0, sprint: true, kick: true }, { x: -1, y: 1, sprint: true, kick: true }], 20);
  assert.equal(state.battery, parked);
  assert.equal(state.ball.vx, 0);
  assert.equal(state.players[0].x, 168);
  assert.equal(state.phase, 'goal');
});

test('tutorial goals do not change the score', () => {
  const state = createMatch({ phase: 'tutorial' });
  state.ball.x = RULES.fieldW - 4;
  state.ball.y = state.h / 2;
  state.ball.vx = 500;
  tick(state, [idle, idle], RULES.dt);
  assert.deepEqual(state.score, [0, 0]);
  assert.equal(state.phase, 'tutorial');
  assert.equal(state.ball.x, RULES.fieldW / 2);
  assert.equal(state.ball.vx, 0);
  assert.equal(state.time, 0);
});

test('first to three ends the match, and the clock can end it in a draw', () => {
  const state = createMatch({ phase: 'play' });
  state.players[1].x = 80;
  state.players[1].y = 40;
  let setups = 0;
  while (state.phase !== 'ended' && setups < 6) {
    state.players[0].x = 790;
    state.players[0].y = state.h / 2;
    state.players[0].vx = 0;
    state.players[0].vy = 0;
    state.ball.x = 840;
    state.ball.y = state.h / 2;
    state.ball.vx = 0;
    state.ball.vy = 0;
    let guard = 0;
    const score = state.score[0];
    while (state.score[0] === score && state.phase === 'play' && guard < 180) {
      tick(state, [{ x: 1, y: 0, sprint: false, kick: true }, idle], RULES.dt);
      guard += 1;
    }
    assert.equal(state.score[0], score + 1);
    setups += 1;
    while (state.phase === 'goal') tick(state, [idle, idle], RULES.dt);
  }
  assert.equal(state.phase, 'ended');
  assert.equal(state.winner, 0);
  assert.deepEqual(state.score, [3, 0]);
  hold(state, [{ x: 1, y: 0, sprint: true, kick: true }, idle], 10);
  assert.equal(state.ball.vx, 0);
  assert.equal(state.players[0].vx, 0);

  const timed = createMatch({ phase: 'play' });
  timed.time = RULES.matchSeconds - RULES.dt * 0.5;
  tick(timed, [{ x: 1, y: 0, sprint: true, kick: false }, idle], RULES.dt);
  assert.equal(timed.phase, 'ended');
  assert.equal(timed.winner, 'draw');
  assert.deepEqual(timed.score, [0, 0]);
  tick(timed, [{ x: 1, y: 0, sprint: true, kick: false }, idle], RULES.dt);
  assert.equal(timed.players[0].vx, 0);
  assert.equal(timed.ball.vx, 0);
});

test('reset drops score, clock, battery and velocity together', () => {
  const state = createMatch({ phase: 'play' });
  state.score = [2, 1];
  state.time = 44;
  state.battery = 3;
  state.sprintArmed = false;
  state.players[0].vx = 400;
  state.players[1].vy = -200;
  state.ball.vx = 900;
  state.ball.x = 12;
  state.kickCount = [4, 5];
  state.acc = 0.02;
  const fresh = resetMatch(state);
  assert.notEqual(fresh, state);
  assert.notEqual(fresh.ball, state.ball);
  assert.notEqual(fresh.players, state.players);
  assert.equal(fresh.battery, 100);
  assert.equal(fresh.sprintArmed, true);
  assert.deepEqual(fresh.score, [0, 0]);
  assert.equal(fresh.time, 0);
  assert.equal(fresh.phase, 'play');
  assert.equal(fresh.winner, null);
  assert.equal(fresh.acc, 0);
  assert.equal(fresh.players[0].vx, 0);
  assert.equal(fresh.players[1].vy, 0);
  assert.equal(fresh.ball.vx, 0);
  assert.equal(fresh.ball.x, RULES.fieldW / 2);
  assert.deepEqual(fresh.kickCount, [0, 0]);
  state.battery = 0;
  state.ball.vx = 50;
  assert.equal(fresh.battery, 100);
  assert.equal(fresh.ball.vx, 0);
  const twin = createMatch({ phase: 'play' });
  assert.deepEqual(snapshot(fresh), snapshot(twin));
});

test('fixed steps stay on the same clock whether a frame is split', () => {
  function run(slices) {
    const state = createMatch({ phase: 'play' });
    const input = [{ x: 0.4, y: -0.6, sprint: true, kick: false }, { x: -0.2, y: 0.5, sprint: false, kick: false }];
    for (let i = 0; i < 90; i += slices) tick(state, input, RULES.dt * slices);
    return snapshot(state);
  }
  const single = run(1);
  const triple = run(3);
  assert.equal(single.simTicks, 90);
  assert.equal(triple.simTicks, 90);
  assert.deepEqual(single, triple);
  const burst = createMatch({ phase: 'play' });
  tick(burst, [idle, idle], 10);
  assert.ok(burst.time <= RULES.maxFrame + 1e-6);
  assert.ok(burst.simTicks <= 6);
});

test('the same inputs replay the same match', () => {
  function run() {
    const state = createMatch({ phase: 'play', mode: 'local' });
    for (let i = 0; i < 200; i++) {
      tick(state, [
        { x: Math.cos(i / 9), y: Math.sin(i / 7), sprint: i % 17 < 6, kick: i % 22 === 0 },
        { x: -0.5, y: Math.cos(i / 5), sprint: i % 29 < 4, kick: i % 33 === 0 },
      ], RULES.dt);
    }
    return snapshot(state);
  }
  assert.deepEqual(run(), run());
});

test('bodies stay inside the pitch except a ball that has scored', () => {
  const state = createMatch({ phase: 'play', mode: 'local' });
  for (let i = 0; i < 60 * 20 && state.phase !== 'ended'; i++) {
    tick(state, [
      { x: Math.sin(i / 8), y: Math.cos(i / 6), sprint: true, kick: true },
      { x: Math.cos(i / 5), y: Math.sin(i / 9), sprint: true, kick: true },
    ], RULES.dt);
    for (const player of state.players) {
      assert.ok(player.x >= player.r - 0.001 && player.x <= state.w - player.r + 0.001);
      assert.ok(player.y >= player.r - 0.001 && player.y <= state.h - player.r + 0.001);
      assert.ok(speed(player) <= RULES.sprintSpeed + 0.02);
    }
    if (state.phase === 'play' || state.phase === 'tutorial') {
      assert.ok(state.ball.y >= state.ball.r - 0.001);
      assert.ok(state.ball.y <= state.h - state.ball.r + 0.001);
      assert.ok(state.ball.x > -50 && state.ball.x < state.w + 50);
    }
    assert.ok(state.battery >= 0 && state.battery <= 100);
  }
});

test('AI spends the shared pack and cannot sprint when it is shut', () => {
  const src = fs.readFileSync(new URL('./ai.js', import.meta.url), 'utf8');
  assert.equal(src.includes('.vx'), false);
  assert.equal(src.includes('battery ='), false);
  assert.equal(src.includes('battery +='), false);
  assert.equal(src.includes('battery -='), false);

  const far = createMatch({ phase: 'play' });
  far.ball.x = 180;
  far.ball.y = far.h / 2;
  far.players[1].x = 840;
  far.players[1].y = far.h / 2;
  const going = decideAi(far);
  assert.equal(going.sprint, true);
  assert.equal(going.kick, false);

  far.battery = 0;
  far.sprintArmed = false;
  assert.equal(decideAi(far).sprint, false);

  const human = createMatch({ phase: 'play' });
  const bot = createMatch({ phase: 'play' });
  const humanInput = { x: 1, y: 0, sprint: true, kick: false };
  for (let i = 0; i < 60; i++) {
    tick(human, [humanInput, idle], RULES.dt);
    bot.ball.x = 180;
    bot.ball.y = bot.h / 2;
    bot.players[1].x = 840;
    bot.players[1].y = bot.h / 2;
    bot.players[1].vx = 0;
    bot.players[1].vy = 0;
    const decision = decideAi(bot);
    assert.equal(decision.sprint, true);
    tick(bot, [idle, { x: decision.x, y: decision.y, sprint: decision.sprint, kick: false }], RULES.dt);
    assert.ok(speed(bot.players[1]) <= RULES.sprintSpeed + 0.02);
  }
  assert.ok(Math.abs(human.battery - bot.battery) < 1e-4, `${human.battery} vs ${bot.battery}`);

  const blocked = createMatch({ phase: 'play' });
  blocked.battery = 0;
  for (let i = 0; i < 30; i++) {
    const decision = decideAi(blocked);
    assert.equal(decision.sprint, false);
    tick(blocked, [idle, decision], RULES.dt);
    assert.equal(blocked.sprinting[1], false);
    assert.ok(
      speed(blocked.players[1]) <= RULES.baseSpeed + 80,
      `empty-pack AI reached ${speed(blocked.players[1])}`,
    );
  }
});

test('AI can score without a private energy pool', () => {
  const state = createMatch({ phase: 'play' });
  state.players[0].x = 70;
  state.players[0].y = 48;
  let frames = 0;
  while (state.score[1] === 0 && state.time < 35 && frames < 60 * 36) {
    const decision = decideAi(state);
    tick(state, [idle, decision], RULES.dt);
    frames += 1;
    assert.ok(speed(state.players[1]) <= RULES.sprintSpeed + 0.02);
    assert.equal('battery' in state.players[1], false);
  }
  assert.equal(state.score[1], 1, `AI did not score, ball=(${state.ball.x},${state.ball.y}) t=${state.time}`);
  assert.ok(state.battery <= 100);
});

function chaseRight(state) {
  const me = state.players[0];
  const ball = state.ball;
  const toBall = Math.hypot(ball.x - me.x, ball.y - me.y);
  const behind = me.x < ball.x + 8;
  if (toBall < me.r + ball.r + RULES.kickRange && behind && state.kickCd[0] <= 0) {
    let ax = ball.x - me.x;
    let ay = ball.y - me.y;
    const mag = Math.hypot(ax, ay) || 1;
    return { x: ax / mag, y: ay / mag, sprint: false, kick: true };
  }
  const dx = ball.x - 28 - me.x;
  const dy = ball.y - me.y;
  const dist = Math.hypot(dx, dy) || 1;
  return {
    x: dx / dist,
    y: dy / dist,
    sprint: state.sprintArmed && state.battery > 62 && dist > 130,
    kick: false,
  };
}

test('a human using the same rules can score on the AI and finish a match', () => {
  const state = createMatch({ phase: 'play' });
  let frames = 0;
  while (state.score[0] === 0 && state.time < 50 && frames < 60 * 51) {
    tick(state, [chaseRight(state), decideAi(state)], RULES.dt);
    frames += 1;
  }
  assert.ok(state.score[0] >= 1, `no human goal, score=${state.score} ball=(${state.ball.x.toFixed(0)},${state.ball.y.toFixed(0)})`);

  const match = createMatch({ phase: 'play', mode: 'local' });
  let steps = 0;
  while (match.phase !== 'ended' && steps < 60 * 90) {
    const me = match.players[0];
    const ball = match.ball;
    if (match.phase === 'play') {
      const dx = ball.x - 24 - me.x;
      const dy = ball.y - me.y;
      const dist = Math.hypot(dx, dy) || 1;
      const close = dist < me.r + ball.r + RULES.kickRange && me.x < ball.x + 8;
      tick(match, [
        { x: dx / dist, y: dy / dist, sprint: dist > 80 && match.battery > 30, kick: close },
        { x: 0, y: -1, sprint: false, kick: false },
      ], RULES.dt);
    } else {
      tick(match, [idle, idle], RULES.dt);
    }
    steps += 1;
  }
  assert.equal(match.phase, 'ended');
  assert.equal(match.winner, 0);
  assert.equal(match.score[0], 3);
});

test('the page keeps its own files and does not call the network', () => {
  for (const name of ['index.html', 'main.js', 'style.css', 'sim.js', 'ai.js']) {
    const text = fs.readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
    assert.equal(text.includes('http://'), false, name);
    assert.equal(text.includes('https://'), false, name);
    assert.equal(text.includes('../'), false, name);
    assert.equal(/\bfetch\s*\(/.test(text), false, name);
    assert.equal(text.includes('XMLHttpRequest'), false, name);
    assert.equal(text.includes('localStorage') && name === 'sim.js', false);
  }
  const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert.match(html, /src="\.\/main\.js"/);
  assert.match(html, /href="\.\/style\.css"/);
  assert.match(html, /共用电池/);
  const main = fs.readFileSync(new URL('./main.js', import.meta.url), 'utf8');
  assert.match(main, /decideAi/);
  assert.match(main, /resetMatch/);
});
