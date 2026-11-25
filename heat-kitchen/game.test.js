import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  BURNER,
  BAND_POINTS,
  INGREDIENTS,
  band,
  cellIndex,
  crowdFactor,
  effectiveBurners,
  rateTable,
} from './heat.js';
import {
  GOAL,
  ORDERS,
  createShift,
  createTutorial,
  discard,
  forecastPlace,
  hold,
  move,
  neededKinds,
  pause,
  place,
  restart,
  resume,
  serve,
  success,
  tick,
} from './game.js';

function must(result, label) {
  assert.equal(result.ok, true, `${label || 'action'} rejected: ${result.reason || ''}`);
  return result.state;
}

function kindId(state, kind) {
  const food = state.foods.find((item) => item.kind === kind);
  assert.ok(food, `missing ${kind}`);
  return food.id;
}

test('burner field is one stove: hot core, cold front corners', () => {
  assert.equal(BURNER.length, 4);
  assert.deepEqual(BURNER[3], [0, 1, 1, 0]);
  assert.equal(BURNER[1][1], 5);
  assert.equal(Math.max(...BURNER.flat()), 5);
});

test('alone on a hotter cell gains faster, and a cold cell does not cook', () => {
  const hot = must(place(createShift(), 'noodle', 1, 1));
  const cold = must(place(createShift(), 'noodle', 3, 0));
  const hotId = kindId(hot, 'noodle');
  const coldId = kindId(cold, 'noodle');
  assert.ok(rateTable(hot)[hotId] > rateTable(cold)[coldId]);
  assert.equal(rateTable(cold)[coldId], 0);
  const hotNext = tick(hot);
  const coldNext = tick(cold);
  assert.ok(hotNext.foods[0].temp > hot.foods[0].temp);
  assert.equal(coldNext.foods[0].temp, cold.foods[0].temp);
});

test('a second pan item slows the first even on a distant cold cell', () => {
  const solo = must(place(createShift(), 'noodle', 1, 1));
  const id = kindId(solo, 'noodle');
  const soloGain = rateTable(solo)[id];
  const crowded = must(place(solo, 'egg', 3, 3));
  const noodleId = kindId(crowded, 'noodle');
  const eggId = kindId(crowded, 'egg');
  assert.ok(rateTable(crowded)[noodleId] < soloGain);
  assert.equal(rateTable(crowded)[eggId], 0);
  assert.ok(Math.abs(crowdFactor(2) - 1 / 1.45) < 1e-12);
  const eff = effectiveBurners(crowded).get(noodleId);
  assert.ok(Math.abs(eff - 5 * crowdFactor(2)) < 1e-12);
});

test('orthogonal foods with different burners split; diagonals do not', () => {
  const separated = must(place(must(place(createShift(), 'greens', 2, 2)), 'egg', 0, 3));
  const adjacent = must(place(must(place(createShift(), 'greens', 2, 2)), 'egg', 3, 2));
  const sepG = kindId(separated, 'greens');
  const sepE = kindId(separated, 'egg');
  const adjG = kindId(adjacent, 'greens');
  const adjE = kindId(adjacent, 'egg');
  assert.equal(BURNER[2][2], 3);
  assert.equal(BURNER[0][3], 1);
  assert.equal(BURNER[3][2], 1);
  assert.ok(rateTable(separated)[sepG] > rateTable(adjacent)[adjG]);
  assert.ok(rateTable(adjacent)[adjE] > rateTable(separated)[sepE]);
  const adjEff = effectiveBurners(adjacent);
  assert.ok(Math.abs(adjEff.get(adjG) - adjEff.get(adjE)) < 1e-12);
  const sepEff = effectiveBurners(separated);
  assert.ok(sepEff.get(sepG) > sepEff.get(sepE));
});

test('holding a finished item gives the pan its heat back', () => {
  const solo = must(place(createShift(), 'noodle', 1, 1));
  const soloGain = rateTable(solo)[kindId(solo, 'noodle')];
  const crowded = must(place(solo, 'egg', 1, 2));
  const noodleId = kindId(crowded, 'noodle');
  const eggId = kindId(crowded, 'egg');
  assert.ok(rateTable(crowded)[noodleId] < soloGain);
  const parked = must(hold(crowded, eggId));
  assert.equal(parked.foods.find((food) => food.id === eggId).place, 'hold');
  assert.equal(rateTable(parked)[noodleId], soloGain);
  assert.equal(rateTable(parked)[eggId], 0);
  const frozen = parked.foods.find((food) => food.id === eggId).temp;
  assert.equal(tick(parked).foods.find((food) => food.id === eggId).temp, frozen);
});

test('moving onto a neighbor changes both rates before the next tick', () => {
  let state = must(place(createShift(), 'noodle', 1, 1));
  state = must(place(state, 'egg', 0, 0));
  const before = rateTable(state)[kindId(state, 'noodle')];
  state = must(move(state, kindId(state, 'egg'), 1, 2));
  const after = rateTable(state)[kindId(state, 'noodle')];
  assert.notEqual(after, before);
  assert.ok(after < before);
});

test('doneness bands and serve scores', () => {
  const spec = INGREDIENTS.egg;
  assert.equal(band('egg', spec.start), 'raw');
  assert.equal(band('egg', spec.ready[0]), 'ready');
  assert.equal(band('egg', spec.perfect[0]), 'perfect');
  assert.equal(band('egg', spec.perfect[1]), 'perfect');
  assert.equal(band('egg', spec.ready[1]), 'ready');
  assert.equal(band('egg', spec.ready[1] + 0.1), 'over');
  assert.equal(band('egg', spec.burn), 'burnt');
  assert.equal(BAND_POINTS.perfect, 3);
  assert.equal(BAND_POINTS.ready, 2);
  assert.equal(BAND_POINTS.over, 1);
  assert.equal(BAND_POINTS.burnt, 0);

  let state = must(place(createShift(), 'noodle', 1, 1));
  const id = kindId(state, 'noodle');
  state.foods.find((food) => food.id === id).temp = 20;
  const raw = serve(state, id);
  assert.equal(raw.ok, false);
  assert.equal(raw.reason, 'raw');
  assert.equal(raw.state.foods.length, 1);

  state.foods.find((food) => food.id === id).temp = INGREDIENTS.noodle.perfect[0];
  const perfect = must(serve(state, id));
  assert.equal(perfect.score, 3);
  assert.equal(perfect.foods.length, 0);
  assert.equal(perfect.orderIndex, 1);

  let burnt = must(place(createShift(), 'egg', 1, 1));
  const eggId = kindId(burnt, 'egg');
  burnt.foods.find((food) => food.id === eggId).temp = INGREDIENTS.egg.burn;
  const cold = must(move(burnt, eggId, 3, 0));
  assert.equal(band('egg', cold.foods[0].temp), 'burnt');
  cold.need = { egg: 1 };
  const later = tick({ ...cold, patience: 40, patienceMax: 40 });
  assert.equal(later.foods[0].temp, cold.foods[0].temp);
  assert.equal(band('egg', later.foods[0].temp), 'burnt');
  const served = must(serve(cold, eggId));
  assert.equal(served.serveLog.at(-1).band, 'burnt');
  assert.equal(served.serveLog.at(-1).points, 0);
  assert.equal(served.foods.length, 0);
});

test('wrong ingredient is refused and the order stays open', () => {
  let state = must(place(createShift(), 'egg', 1, 3));
  const id = kindId(state, 'egg');
  state.foods.find((food) => food.id === id).temp = INGREDIENTS.egg.perfect[0];
  const refused = serve(state, id);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'wrong');
  assert.equal(refused.state.score, 0);
  assert.equal(refused.state.foods.length, 1);
  assert.equal(refused.state.orderIndex, 0);
});

test('patience fail keeps earlier points, advances the order, and leaves the pan hot', () => {
  let state = must(place(createShift(), 'noodle', 1, 1));
  const id = kindId(state, 'noodle');
  state.foods.find((food) => food.id === id).temp = INGREDIENTS.noodle.perfect[0];
  state = must(serve(state, id));
  assert.equal(state.orderIndex, 1);
  assert.equal(state.score, 3);
  state = must(place(state, 'egg', 1, 1));
  const egg = state.foods.find((food) => food.kind === 'egg');
  const tempBefore = egg.temp;
  state = { ...state, patience: 1 };
  state = tick(state);
  assert.equal(state.orderIndex, 2);
  assert.equal(state.score, 3);
  assert.equal(state.results[1].how, 'timeout');
  assert.deepEqual(state.results[1].missed.sort(), ['egg', 'noodle']);
  const still = state.foods.find((food) => food.kind === 'egg');
  assert.ok(still);
  assert.ok(still.temp > tempBefore);
  assert.equal(state.need.greens, 1);
  assert.equal(state.need.egg, 1);
});

test('residual warmth preheats the next item and then fades', () => {
  let state = createShift();
  const idx = cellIndex(1, 1);
  state.residue[idx] = 2;
  const warmed = must(place(state, 'egg', 1, 1));
  assert.ok(warmed.foods[0].temp >= INGREDIENTS.egg.start + 20);
  assert.ok(warmed.residue[idx] < 2);

  let cooked = must(place(createShift(), 'noodle', 1, 1));
  for (let i = 0; i < 30; i += 1) cooked = tick(cooked);
  const spent = cooked.residue[idx];
  assert.ok(spent > 0.4);
  cooked = must(discard(cooked, kindId(cooked, 'noodle')));
  assert.ok(cooked.residue[idx] > 0.3);
  const next = must(place(cooked, 'egg', 1, 1));
  const plain = must(place(createShift(), 'egg', 1, 1));
  assert.ok(next.foods[0].temp > plain.foods[0].temp + 4);
});

test('forecast matches the rate change that placing would cause', () => {
  const state = must(place(createShift(), 'noodle', 1, 1));
  const view = forecastPlace(state, 'egg', 1, 2);
  assert.ok(view);
  const placed = must(place(state, 'egg', 1, 2));
  const noodleId = kindId(state, 'noodle');
  assert.equal(view.changes[0].id, noodleId);
  assert.ok(view.changes[0].after < view.changes[0].before);
  assert.equal(view.changes[0].after, rateTable(placed)[noodleId]);
  assert.equal(view.gain, rateTable(placed)[kindId(placed, 'egg')]);
});

test('adding a prep item can miss an order that the solo pan still makes', () => {
  const start = must(place(createShift(), 'noodle', 1, 1));
  let soloTicks = 0;
  let cursor = start;
  while (band('noodle', cursor.foods[0].temp) !== 'perfect') {
    cursor = tick(cursor);
    soloTicks += 1;
    assert.ok(soloTicks < 200);
  }
  let win = must(place(createShift(), 'noodle', 1, 1));
  win = { ...win, patience: soloTicks + 1, patienceMax: soloTicks + 1 };
  for (let i = 0; i < soloTicks; i += 1) win = tick(win);
  assert.equal(win.phase, 'play');
  assert.equal(band('noodle', win.foods[0].temp), 'perfect');
  win = must(serve(win, kindId(win, 'noodle')));
  assert.equal(win.score, 3);

  let lose = must(place(createShift(), 'noodle', 1, 1));
  lose = must(place(lose, 'greens', 1, 2));
  lose = { ...lose, patience: soloTicks + 1, patienceMax: soloTicks + 1 };
  let guard = 0;
  while (lose.orderIndex === 0 && guard < 200) {
    lose = tick(lose);
    guard += 1;
  }
  assert.equal(lose.results[0].how, 'timeout');
  assert.equal(lose.score, 0);
  assert.ok(lose.orderIndex > 0);
});

test('pause freezes heat and patience; resume continues', () => {
  let state = must(place(createShift(), 'noodle', 1, 1));
  const patience = state.patience;
  const temp = state.foods[0].temp;
  const frozen = pause(state);
  assert.equal(frozen.phase, 'paused');
  const still = tick(frozen);
  assert.equal(still.foods[0].temp, temp);
  assert.equal(still.patience, patience);
  assert.equal(still.tickCount, state.tickCount);
  const live = resume(still);
  assert.equal(live.phase, 'play');
  const moved = tick(live);
  assert.ok(moved.foods[0].temp > temp);
  assert.equal(moved.patience, patience - 1);
});

test('restart clears score, orders, food, residue, and the clock', () => {
  let state = must(place(createShift(), 'noodle', 1, 1));
  state = tick(tick(state));
  state.foods[0].temp = INGREDIENTS.noodle.perfect[0];
  state = must(serve(state, kindId(state, 'noodle')));
  assert.ok(state.score > 0);
  const fresh = createShift();
  const again = must(restart(state));
  assert.deepEqual(again, fresh);
  assert.equal(again.score, 0);
  assert.equal(again.orderIndex, 0);
  assert.equal(again.foods.length, 0);
  assert.ok(again.residue.every((value) => value === 0));
  assert.equal(again.patience, ORDERS[0].patience);
  assert.equal(again.phase, 'play');
});

test('tutorial teaches one cake, then a shift starts clean', () => {
  let state = createTutorial();
  assert.equal(place(state, 'egg', 1, 1).reason, 'tutorial');
  assert.equal(place(state, 'noodle', 3, 0).reason, 'tutorial-hot');
  state = must(place(state, 'noodle', 1, 1));
  assert.equal(state.step, 'wait');
  let guard = 0;
  while (state.step === 'wait' && guard < 200) {
    state = tick(state);
    guard += 1;
  }
  assert.equal(state.step, 'serve');
  assert.equal(serve(state, kindId(state, 'noodle')).ok, true);
  state = must(serve(state, kindId(state, 'noodle')));
  assert.equal(state.step, 'lesson');
  assert.equal(tick(state), state);
  const shift = createShift();
  assert.equal(shift.score, 0);
  assert.equal(shift.mode, 'shift');
});

function layout(state, items) {
  let next = state;
  for (const item of items) next = must(place(next, item.kind, item.r, item.c), item.kind);
  return next;
}

function servePerfects(state) {
  const order = state.orderIndex;
  let guard = 0;
  while (state.phase === 'play' && state.orderIndex === order && guard < 500) {
    guard += 1;
    const ready = state.foods.find((food) => state.need[food.kind] && band(food.kind, food.temp) === 'perfect');
    if (ready) {
      state = must(serve(state, ready.id), `serve ${ready.kind}`);
      continue;
    }
    const ruined = state.foods.find((food) => {
      if (!state.need[food.kind]) return false;
      const taste = band(food.kind, food.temp);
      return taste === 'over' || taste === 'burnt';
    });
    if (ruined) {
      throw new Error(`careful plan ${ruined.kind} became ${band(ruined.kind, ruined.temp)} on order ${order}`);
    }
    state = tick(state);
  }
  const result = state.results[order];
  if (!result || result.how !== 'clear') {
    throw new Error(`careful plan missed order ${order}: ${result ? result.how : 'stall'}`);
  }
  return state;
}

test('a placement plan clears the shift and a clump-and-wait plan does not', () => {
  let careful = createShift();
  careful = servePerfects(layout(careful, [{ kind: 'noodle', r: 1, c: 1 }]));
  careful = servePerfects(layout(careful, [
    { kind: 'noodle', r: 1, c: 1 },
    { kind: 'egg', r: 1, c: 3 },
  ]));
  careful = servePerfects(layout(careful, [
    { kind: 'greens', r: 1, c: 1 },
    { kind: 'egg', r: 1, c: 3 },
  ]));
  careful = servePerfects(layout(careful, [
    { kind: 'noodle', r: 1, c: 1 },
    { kind: 'greens', r: 1, c: 3 },
  ]));
  assert.equal(careful.phase, 'result');
  assert.ok(careful.score >= GOAL, `careful score ${careful.score}`);
  assert.equal(success(careful), true);
  assert.equal(careful.results.length, ORDERS.length);
  assert.ok(careful.results.every((order) => order.how === 'clear'));

  let careless = createShift();
  let guard = 0;
  while (careless.phase === 'play' && guard < 2000) {
    guard += 1;
    for (const kind of neededKinds(careless)) {
      if (careless.foods.some((food) => food.kind === kind)) continue;
      const used = new Set(careless.foods.filter((food) => food.place === 'pan').map((food) => `${food.r},${food.c}`));
      let best = null;
      for (let r = 0; r < 4; r += 1) {
        for (let c = 0; c < 4; c += 1) {
          if (used.has(`${r},${c}`)) continue;
          if (!best || BURNER[r][c] > best.burner) best = { r, c, burner: BURNER[r][c] };
        }
      }
      careless = must(place(careless, kind, best.r, best.c));
    }
    const pending = neededKinds(careless);
    const together = pending.length > 0 && pending.every((kind) => {
      const food = careless.foods.find((item) => item.kind === kind);
      return food && band(food.kind, food.temp) === 'perfect';
    });
    if (together) {
      for (const kind of pending) {
        careless = must(serve(careless, kindId(careless, kind)));
      }
      continue;
    }
    careless = tick(careless);
  }
  assert.equal(careless.phase, 'result');
  assert.ok(careless.score < GOAL, `careless score ${careless.score}`);
  assert.equal(success(careless), false);
  assert.ok(careless.score < careful.score);
});

test('ignoring the pan fails the shift without deleting the restart', () => {
  let state = createShift();
  let guard = 0;
  while (state.phase === 'play' && guard < 2000) {
    state = tick(state);
    guard += 1;
  }
  assert.equal(state.phase, 'result');
  assert.equal(state.score, 0);
  assert.equal(success(state), false);
  assert.equal(state.results.length, 4);
  const again = must(restart(state));
  assert.equal(again.phase, 'play');
  assert.equal(again.score, 0);
  assert.equal(again.orderIndex, 0);
});

test('page is a self-contained Chinese document with gated sound', () => {
  const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const main = fs.readFileSync(new URL('./main.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('./style.css', import.meta.url), 'utf8');
  assert.match(html, /lang="zh"/);
  assert.match(html, /热力小食堂/);
  assert.match(html, /href="\.\/style\.css"/);
  assert.match(html, /src="\.\/main\.js"/);
  assert.match(html, /音效/);
  assert.doesNotMatch(html, /src="https?:/);
  assert.doesNotMatch(html, /href="https?:/);
  assert.doesNotMatch(main, /https?:\/\//);
  assert.doesNotMatch(css, /https?:\/\//);
  assert.match(main, /soundOn = false/);
  assert.doesNotMatch(main, /autoplay/i);
  assert.match(main, /AudioContext/);
});
