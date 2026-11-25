import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  INITIAL,
  PARTS,
  SLOTS,
  SOLUTIONS,
  TUNING,
  clearSlot,
  coach,
  initialAssembly,
  normalize,
  place,
  preview,
  setLoad,
  simulate,
  unlockedParts,
  unlockedRoutes,
  weigh,
} from './sim.js';
import { ROUTES, routeById } from './routes.js';

const yard = routeById('yard');
const steep = routeById('steep');
const mud = routeById('mud');

function fitted(base, patch) {
  return { ...base, ...patch };
}

test('the demo stays a short fixed roster', () => {
  assert.deepEqual(SLOTS, ['front', 'mid', 'rear']);
  assert.deepEqual(Object.keys(PARTS), ['battery', 'bed', 'winch', 'tracks']);
  assert.deepEqual(ROUTES.map((route) => route.id), ['yard', 'steep', 'mud']);
  assert.equal(yard.steps.length, 9);
  assert.equal(steep.steps.length, 10);
  assert.equal(mud.steps.length, 12);
  assert.equal(TUNING.batteryEnergy, 60);
});

test('middle-slot weight splits, with the odd point on the rear axle', () => {
  const even = weigh({ front: null, mid: 'bed', rear: 'battery', load: 1 }, 0);
  assert.equal(even.front, 2);
  assert.equal(even.rear, 3);
  assert.equal(even.drive, 'rear');
  assert.equal(even.grip, 3);
  const loaded = weigh(SOLUTIONS.steep, 2);
  assert.equal(loaded.front, 6);
  assert.equal(loaded.rear, 5);
  assert.equal(loaded.total, 11);
});

test('placing a part moves it and does not change the input', () => {
  const start = initialAssembly('yard');
  const frozen = { ...start };
  const withBattery = place(start, 'battery', 'rear');
  assert.deepEqual(start, frozen);
  assert.deepEqual(withBattery, { front: null, mid: 'bed', rear: 'battery', load: 1 });
  const moved = place(withBattery, 'bed', 'front');
  assert.deepEqual(moved, SOLUTIONS.yard);
  const swapped = place({ front: 'battery', mid: null, rear: 'bed', load: 1 }, 'bed', 'front');
  assert.deepEqual(swapped, { front: 'bed', mid: null, rear: null, load: 1 });
  assert.equal(clearSlot(moved, 'front').front, null);
  assert.equal(setLoad(moved, 9).load, 3);
  assert.equal(setLoad(moved, -4).load, 0);
});

test('duplicate or unknown parts are rejected', () => {
  assert.throws(() => normalize({ front: 'battery', mid: 'battery', rear: null, load: 1 }));
  assert.throws(() => normalize({ front: 'engine', mid: null, rear: null, load: 1 }));
  assert.throws(() => simulate({ front: 'bed', mid: 'bed', rear: 'battery', load: 1 }, yard));
});

test('route 1: cargo in the middle stalls, cargo in front delivers the crate', () => {
  const noseUp = place(initialAssembly('yard'), 'battery', 'rear');
  const stalled = simulate(noseUp, yard);
  assert.equal(stalled.code, 'front-lift');
  assert.equal(stalled.cargo, 0);
  assert.equal(stalled.frames.at(-1).x, 2);
  assert.equal(stalled.frames.at(-1).y, 0);
  assert.equal(stalled.frames.at(-1).pose, 'lift');
  assert.equal(stalled.reason, '后轴过重，前轮离地（前 2 / 后 3）');

  const fixed = simulate(SOLUTIONS.yard, yard);
  assert.equal(fixed.ok, true);
  assert.equal(fixed.cargo, 1);
  assert.equal(fixed.energyLeft, 31);
  assert.equal(fixed.frames.length, yard.steps.length + 1);
  assert.deepEqual(fixed.frames.map((item) => item.x), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(fixed.frames.find((item) => item.event === '装上 1 箱').x, 7);

  const frontDrive = simulate({ front: 'battery', mid: 'bed', rear: null, load: 1 }, yard);
  assert.equal(frontDrive.code, 'ok');
});

test('route 1 load limit changes the rescue result without changing the climb', () => {
  const empty = simulate(fitted(SOLUTIONS.yard, { load: 0 }), yard);
  assert.equal(empty.code, 'short-cargo');
  assert.equal(empty.reached, true);
  assert.equal(empty.cargo, 0);
  assert.equal(empty.energyLeft, 31);
});

test('route 2: two crates clear, three run out of energy, one arrives short', () => {
  const cleared = simulate(SOLUTIONS.steep, steep);
  assert.equal(cleared.code, 'ok');
  assert.equal(cleared.cargo, 2);
  assert.equal(cleared.energyLeft, 2);

  const heavy = simulate(fitted(SOLUTIONS.steep, { load: 3 }), steep);
  assert.equal(heavy.code, 'energy');
  assert.equal(heavy.reached, false);
  assert.equal(heavy.frames.at(-1).x, 7);
  assert.equal(heavy.frames.at(-1).y, 6);
  assert.equal(heavy.frames.at(-1).pose, 'dead');
  assert.equal(steep.steps[heavy.frames.at(-1).x].grade, 2);
  assert.equal(heavy.reason, '电量耗尽（这一步要 15，剩余 11）');

  const light = simulate(fitted(SOLUTIONS.steep, { load: 1 }), steep);
  assert.equal(light.code, 'short-cargo');
  assert.equal(light.reached, true);
  assert.equal(light.cargo, 1);
  assert.equal(light.energyLeft, 10);
});

test('route 2: winch slot and missing winch fail differently from a heavy load', () => {
  const wrongSlot = simulate({ front: 'bed', mid: 'winch', rear: 'battery', load: 2 }, steep);
  assert.equal(wrongSlot.code, 'winch-pos');
  assert.match(wrongSlot.reason, /绞盘不在前槽/);

  const tracksInstead = simulate({ front: 'tracks', mid: 'bed', rear: 'battery', load: 2 }, steep);
  assert.equal(tracksInstead.code, 'slip');
  assert.match(tracksInstead.reason, /需要 6/);

  const noBed = simulate({ front: 'winch', mid: 'tracks', rear: 'battery', load: 2 }, steep);
  assert.equal(noBed.code, 'short-cargo');
  assert.equal(noBed.cargo, 0);
  assert.equal(noBed.reached, true);
});

test('route 3: tracks, balance, and load each change the outcome', () => {
  const sunk = simulate(SOLUTIONS.steep, mud);
  assert.equal(sunk.code, 'mud');
  assert.equal(sunk.frames.at(-1).x, 2);
  assert.equal(sunk.frames.at(-1).pose, 'sink');
  assert.equal(sunk.cargo, 0);

  const cleared = simulate(SOLUTIONS.mud, mud);
  assert.equal(cleared.code, 'ok');
  assert.equal(cleared.cargo, 2);
  assert.equal(cleared.energyLeft, 0);

  const otherBalance = simulate({ front: 'bed', mid: 'tracks', rear: 'battery', load: 2 }, mud);
  assert.equal(otherBalance.code, 'ok');

  const noseUp = simulate({ front: 'battery', mid: 'bed', rear: 'tracks', load: 2 }, mud);
  assert.equal(noseUp.code, 'front-lift');
  assert.equal(noseUp.frames.at(-1).x, 7);
  assert.equal(noseUp.cargo, 2);
  assert.match(noseUp.reason, /前 5 \/ 后 7/);

  const heavy = simulate(fitted(SOLUTIONS.mud, { load: 3 }), mud);
  assert.equal(heavy.code, 'energy');
  assert.equal(mud.steps[heavy.frames.at(-1).x].grade, 1);
  assert.equal(heavy.reason, '电量耗尽（这一步要 15，剩余 11）');
});

test('a missing driven axle stops before terrain or energy rules', () => {
  const idle = simulate({ front: null, mid: 'battery', rear: 'bed', load: 1 }, yard);
  assert.equal(idle.code, 'no-drive');
  assert.equal(idle.frames.at(-1).x, 0);
  assert.equal(idle.frames.at(-1).pose, 'idle');
});

test('rerunning the same assembly repeats every step and does not mutate it', () => {
  const assembly = { ...SOLUTIONS.mud };
  const first = simulate(assembly, mud);
  const second = simulate(assembly, mud);
  assert.deepEqual(first, second);
  assert.deepEqual(assembly, SOLUTIONS.mud);
  assert.ok(first.frames.every((item, index) => index === 0 || item.energy <= first.frames[index - 1].energy));
});

test('steps do not consult the clock or a random source', () => {
  const source = fs.readFileSync(new URL('./sim.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /requestAnimationFrame|Date\.now|performance\.now|Math\.random|setTimeout|setInterval/);
  const routeSource = fs.readFileSync(new URL('./routes.js', import.meta.url), 'utf8');
  assert.doesNotMatch(routeSource, /Math\.random/);
});

test('preview shows empty and loaded axle weights', () => {
  const view = preview(SOLUTIONS.steep);
  assert.equal(view.empty.total, 7);
  assert.equal(view.loaded.total, 11);
  assert.equal(view.energy, 60);
  assert.equal(view.load, 2);
  assert.equal(preview({ front: null, mid: null, rear: null, load: 2 }).energy, 0);
});

test('routes and parts unlock from clears, with no permanent stat bonus', () => {
  assert.deepEqual([...unlockedRoutes([])], ['yard']);
  assert.deepEqual([...unlockedRoutes(['yard'])], ['yard', 'steep']);
  assert.deepEqual([...unlockedRoutes(['yard', 'steep'])], ['yard', 'steep', 'mud']);
  assert.deepEqual([...unlockedParts([])], ['battery', 'bed']);
  assert.equal(unlockedParts(['yard']).has('winch'), true);
  assert.equal(unlockedParts(['yard']).has('tracks'), false);
  assert.equal(unlockedParts(['yard', 'steep']).has('tracks'), true);
  assert.equal(TUNING.batteryEnergy, 60);
  assert.deepEqual(INITIAL.yard, { front: null, mid: 'bed', rear: null, load: 1 });
});

test('coach names the failed rule and the yard tutorial', () => {
  const start = coach({
    routeId: 'yard',
    assembly: initialAssembly('yard'),
    result: null,
    selected: null,
  });
  assert.match(start, /后槽/);
  const chosen = coach({
    routeId: 'yard',
    assembly: initialAssembly('yard'),
    result: null,
    selected: 'battery',
  });
  assert.match(chosen, /后槽/);
  const lifted = simulate(place(initialAssembly('yard'), 'battery', 'rear'), yard);
  const hint = coach({ routeId: 'yard', assembly: lifted.assembly, result: lifted, selected: null });
  assert.match(hint, /前槽/);
  const done = simulate(SOLUTIONS.yard, yard);
  assert.match(coach({ routeId: 'yard', assembly: done.assembly, result: done, selected: null }), /车头/);
});

test('the page does not reach outside this folder', () => {
  for (const name of ['index.html', 'main.js', 'style.css', 'sim.js', 'routes.js']) {
    const text = fs.readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /https?:\/\//);
    assert.doesNotMatch(text, /games\.json|\.\.\/|node_modules/);
  }
  const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert.match(html, /src="\.\/main\.js"/);
  assert.match(html, /href="\.\/style\.css"/);
});
