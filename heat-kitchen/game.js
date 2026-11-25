/**
 * One short cafeteria shift on the shared pan.
 * Orders are fixed. Score is the only outcome. Restart clears heat and score.
 */

import {
  BAND_LABEL,
  BAND_POINTS,
  BURNER,
  INGREDIENTS,
  arrival,
  band,
  cellIndex,
  emptyResidue,
  heatStep,
  inGrid,
  panFoods,
  rateTable,
  round2,
} from './heat.js';

export const GOAL = 12;

export const RULE =
  '底火越高越热。上下左右挨着的菜平分底火。锅里每多一份菜，大家分到的热都会变少，冷格上的菜也算。保温台才真正让出锅。空格会留一阵余温。';

export const RULE_SHORT = '挨着平分底火，菜越多越慢。';

export const ORDERS = [
  { id: 'cake', type: 'single', label: '面饼', need: { noodle: 1 }, patience: 80 },
  { id: 'egg-noodle', type: 'pair', label: '鸡蛋 + 面饼', need: { egg: 1, noodle: 1 }, patience: 120 },
  { id: 'greens-egg', type: 'pair', label: '青菜 + 鸡蛋', need: { greens: 1, egg: 1 }, patience: 110 },
  { id: 'noodle-greens', type: 'pair', label: '面饼 + 青菜', need: { noodle: 1, greens: 1 }, patience: 120 },
];

export const REASONS = {
  raw: '还没熟，先放回。',
  wrong: '这单不要这个。',
  occupied: '这格已经有菜了。',
  duplicate: '同样的菜还在锅里。',
  hold: '保温台只有一个位置。',
  tutorial: '先按提示完成这一步。',
  'tutorial-hot': '教学先放在底火 4 或 5 的格子上。',
  busy: '现在不能操作。',
  missing: '找不到这道菜。',
  edge: '出了锅的边缘。',
};

function blank(extra) {
  return {
    mode: 'shift',
    phase: 'play',
    step: null,
    foods: [],
    seq: 1,
    residue: emptyResidue(),
    score: 0,
    orderPoints: 0,
    orderIndex: 0,
    need: {},
    patience: 0,
    patienceMax: 1,
    results: [],
    serveLog: [],
    tickCount: 0,
    notice: { tone: 'info', text: '' },
    ...extra,
  };
}

export function createTutorial() {
  return blank({
    mode: 'tutorial',
    step: 'place',
    need: { noodle: 1 },
    notice: { tone: 'info', text: '把面饼放进底火 4 或 5 的格子。' },
  });
}

export function createShift() {
  const order = ORDERS[0];
  return blank({
    mode: 'shift',
    orderIndex: 0,
    need: { ...order.need },
    patience: order.patience,
    patienceMax: order.patience,
    notice: { tone: 'info', text: '第一单：面饼。旺格快，冷格停火。' },
  });
}

export function neededKinds(state) {
  return Object.entries(state.need || {}).filter(([, count]) => count > 0).map(([kind]) => kind);
}

function ok(state) {
  return { ok: true, state, reason: '' };
}

function fail(state, reason) {
  return { ok: false, state, reason };
}

function foodById(state, id) {
  return state.foods.find((food) => food.id === id) || null;
}

export function place(state, kind, r, c) {
  if (state.phase !== 'play') return fail(state, 'busy');
  if (!INGREDIENTS[kind] || !inGrid(r, c)) return fail(state, 'edge');
  if (state.mode === 'tutorial') {
    if (state.step !== 'place') return fail(state, 'tutorial');
    if (kind !== 'noodle') return fail(state, 'tutorial');
    if (BURNER[r][c] < 4) return fail(state, 'tutorial-hot');
  }
  if (state.foods.some((food) => food.kind === kind)) return fail(state, 'duplicate');
  if (panFoods(state).some((food) => food.r === r && food.c === c)) return fail(state, 'occupied');

  const next = structuredClone(state);
  const landed = arrival(next, kind, r, c);
  next.residue[landed.index] = landed.residue;
  next.foods.push({ id: next.seq, kind, place: 'pan', r, c, temp: landed.temp });
  next.seq += 1;
  if (next.mode === 'tutorial') {
    next.step = 'wait';
    next.notice = { tone: 'info', text: '看着熟度。到「正好」或「熟了」再端给客人。' };
  } else if (!state.need[kind]) {
    next.notice = { tone: 'warn', text: `${INGREDIENTS[kind].name}先备着。它会分走正在煮的菜的热。` };
  } else {
    next.notice = { tone: 'info', text: `${INGREDIENTS[kind].name}下锅了。` };
  }
  return ok(next);
}

export function move(state, id, r, c) {
  if (state.phase !== 'play') return fail(state, 'busy');
  if (state.mode === 'tutorial') return fail(state, 'tutorial');
  if (!inGrid(r, c)) return fail(state, 'edge');
  const food = foodById(state, id);
  if (!food) return fail(state, 'missing');
  if (panFoods(state).some((other) => other.id !== id && other.r === r && other.c === c)) {
    return fail(state, 'occupied');
  }
  const next = structuredClone(state);
  const item = foodById(next, id);
  item.place = 'pan';
  item.r = r;
  item.c = c;
  next.notice = { tone: 'info', text: '挪好了。挨着的菜会重新平分底火。' };
  return ok(next);
}

export function hold(state, id) {
  if (state.phase !== 'play') return fail(state, 'busy');
  if (state.mode === 'tutorial') return fail(state, 'tutorial');
  const food = foodById(state, id);
  if (!food) return fail(state, 'missing');
  if (food.place === 'hold') return ok(state);
  if (state.foods.some((other) => other.place === 'hold')) return fail(state, 'hold');
  const next = structuredClone(state);
  const item = foodById(next, id);
  item.place = 'hold';
  item.r = -1;
  item.c = -1;
  next.notice = { tone: 'info', text: `${INGREDIENTS[item.kind].name}放到保温台，不再加热，也不再分走锅里的热。` };
  return ok(next);
}

export function discard(state, id) {
  if (state.phase !== 'play') return fail(state, 'busy');
  if (state.mode === 'tutorial') return fail(state, 'tutorial');
  if (!foodById(state, id)) return fail(state, 'missing');
  const next = structuredClone(state);
  const item = foodById(next, id);
  next.foods = next.foods.filter((food) => food.id !== id);
  next.notice = { tone: 'warn', text: `${INGREDIENTS[item.kind].name}倒掉了，可以重新下一份。` };
  return ok(next);
}

function finishShift(state) {
  state.phase = 'result';
  state.patience = 0;
  state.need = {};
  state.notice = {
    tone: state.score >= GOAL ? 'good' : 'bad',
    text: state.score >= GOAL ? '本班达标' : '本班未达标',
  };
}

function closeOrder(state, how) {
  const order = ORDERS[state.orderIndex];
  const missed = neededKinds(state);
  state.results.push({
    id: order.id,
    label: order.label,
    points: state.orderPoints,
    missed,
    how,
  });
  state.orderPoints = 0;
  state.orderIndex += 1;
  if (state.orderIndex >= ORDERS.length) {
    finishShift(state);
    return;
  }
  const nextOrder = ORDERS[state.orderIndex];
  state.need = { ...nextOrder.need };
  state.patience = nextOrder.patience;
  state.patienceMax = nextOrder.patience;
  state.notice = {
    tone: how === 'clear' ? 'good' : 'bad',
    text: how === 'clear' ? `这单完成。下一单：${nextOrder.label}` : `客人走了。下一单：${nextOrder.label}`,
  };
}

export function serve(state, id) {
  if (state.phase !== 'play') return fail(state, 'busy');
  const food = foodById(state, id);
  if (!food) return fail(state, 'missing');
  const taste = band(food.kind, food.temp);
  if (state.mode === 'tutorial') {
    if (state.step !== 'serve') return fail(state, 'tutorial');
    if (taste === 'raw') return fail(state, 'raw');
    const next = structuredClone(state);
    next.foods = next.foods.filter((item) => item.id !== id);
    next.step = 'lesson';
    next.notice = {
      tone: 'good',
      text: '面饼端出去了。下一班，两道菜会抢同一口锅的热。',
    };
    return ok(next);
  }
  if (!state.need[food.kind]) return fail(state, 'wrong');
  if (taste === 'raw') return fail(state, 'raw');
  const points = BAND_POINTS[taste];
  const next = structuredClone(state);
  next.foods = next.foods.filter((item) => item.id !== id);
  next.need = { ...next.need, [food.kind]: next.need[food.kind] - 1 };
  next.score += points;
  next.orderPoints += points;
  next.serveLog.push({
    orderId: ORDERS[next.orderIndex].id,
    kind: food.kind,
    band: taste,
    points,
  });
  next.notice = {
    tone: points >= 2 ? 'good' : 'bad',
    text: `${INGREDIENTS[food.kind].name}${BAND_LABEL[taste]}，+${points}`,
  };
  if (neededKinds(next).length === 0) closeOrder(next, 'clear');
  return ok(next);
}

function syncTutorial(state) {
  if (state.step !== 'wait') return;
  const food = state.foods[0];
  if (!food) return;
  const taste = band(food.kind, food.temp);
  if (taste === 'raw') return;
  state.step = 'serve';
  state.notice = {
    tone: taste === 'burnt' || taste === 'over' ? 'warn' : 'good',
    text: taste === 'burnt'
      ? '糊了。正式班次这样端出去不得分。先端给客人看看。'
      : '可以出餐了。把面饼端给客人。',
  };
}

export function tick(state) {
  if (state.phase !== 'play') return state;
  if (state.mode === 'tutorial' && state.step === 'lesson') return state;
  const next = structuredClone(state);
  heatStep(next);
  next.tickCount += 1;
  if (next.mode === 'tutorial') {
    syncTutorial(next);
    return next;
  }
  next.patience -= 1;
  if (next.patience <= 0 && neededKinds(next).length > 0) closeOrder(next, 'timeout');
  return next;
}

export function pause(state) {
  if (state.phase !== 'play') return state;
  if (state.mode === 'tutorial' && state.step === 'lesson') return state;
  const next = structuredClone(state);
  next.phase = 'paused';
  next.notice = { tone: 'info', text: '暂停了。热不再往上走。' };
  return next;
}

export function resume(state) {
  if (state.phase !== 'paused') return state;
  const next = structuredClone(state);
  next.phase = 'play';
  next.notice = { tone: 'info', text: '继续。' };
  return next;
}

export function restart(state) {
  if (state.mode === 'tutorial' && state.step !== 'lesson') return ok(createTutorial());
  return ok(createShift());
}

function forecastFrom(before, after, id) {
  return {
    temp: after.foods.find((food) => food.id === id)?.temp ?? null,
    gain: rateTable(after)[id],
    changes: before.foods
      .filter((food) => food.place === 'pan' || food.place === 'hold')
      .map((food) => ({
        id: food.id,
        kind: food.kind,
        before: rateTable(before)[food.id],
        after: rateTable(after)[food.id],
      })),
  };
}

export function forecastPlace(state, kind, r, c) {
  if (state.phase !== 'play' || !INGREDIENTS[kind] || !inGrid(r, c)) return null;
  if (state.foods.some((food) => food.kind === kind)) return null;
  if (panFoods(state).some((food) => food.r === r && food.c === c)) return null;
  const next = structuredClone(state);
  const landed = arrival(next, kind, r, c);
  next.residue[landed.index] = landed.residue;
  const id = next.seq;
  next.foods.push({ id, kind, place: 'pan', r, c, temp: landed.temp });
  const view = forecastFrom(state, next, id);
  view.temp = landed.temp;
  return view;
}

export function forecastMove(state, id, r, c) {
  const food = foodById(state, id);
  if (!food || state.phase !== 'play' || !inGrid(r, c)) return null;
  if (panFoods(state).some((other) => other.id !== id && other.r === r && other.c === c)) return null;
  const next = structuredClone(state);
  const item = foodById(next, id);
  item.place = 'pan';
  item.r = r;
  item.c = c;
  return forecastFrom(state, next, id);
}

export function currentOrder(state) {
  if (state.mode !== 'shift' || state.orderIndex >= ORDERS.length) return null;
  return ORDERS[state.orderIndex];
}

export function nextOrder(state) {
  if (state.mode !== 'shift') return null;
  return ORDERS[state.orderIndex + 1] || null;
}

export function success(state) {
  return state.score >= GOAL;
}

export function describeFood(state, food) {
  const gain = rateTable(state)[food.id];
  const taste = band(food.kind, food.temp);
  return {
    id: food.id,
    kind: food.kind,
    name: INGREDIENTS[food.kind].name,
    place: food.place,
    r: food.r,
    c: food.c,
    temp: food.temp,
    gain,
    band: taste,
    label: BAND_LABEL[taste],
    points: BAND_POINTS[taste],
    burn: INGREDIENTS[food.kind].burn,
  };
}

export function residueAt(state, r, c) {
  return round2(state.residue[cellIndex(r, c)] || 0);
}
