/**
 * Discrete heat for one shared 4×4 pan.
 *
 * Player-facing rule (keep the UI copy in game.js aligned with this):
 *   底火越高越热。上下左右挨着的菜平分底火。
 *   锅里每多一份菜，大家分到的热都会变少，冷格上的菜也算。
 *   保温台才真正让出锅。空格会留一阵余温。
 *
 * This is not a fluid sim. Orthogonal groups split the sum of their burner
 * numbers, then a crowd factor divides that share across every pan item.
 */

export const ROWS = 4;
export const COLS = 4;
export const TICKS_PER_SEC = 2;

/** Printed on each cell. Row 0 is the back of the pan. */
export const BURNER = [
  [1, 2, 2, 1],
  [2, 5, 4, 2],
  [2, 4, 3, 1],
  [0, 1, 1, 0],
];

/** Temperature gained per tick ≈ (effective burner + residue) * UNIT / cap. */
export const UNIT = 0.62;
/** Extra pan items scale every share by 1 / (1 + CROWD * extras). */
export const CROWD = 0.45;

export const RESIDUE_CAP = 2.2;
export const RESIDUE_DECAY = 0.97;
export const RESIDUE_BUILD = 0.025;
export const RESIDUE_PLACE = 12;
export const RESIDUE_KEEP = 0.5;

export const INGREDIENTS = {
  noodle: {
    name: '面饼',
    cap: 1.6,
    start: 22,
    ready: [72, 116],
    perfect: [82, 104],
    burn: 132,
  },
  egg: {
    name: '鸡蛋',
    cap: 0.72,
    start: 22,
    ready: [64, 108],
    perfect: [72, 96],
    burn: 122,
  },
  greens: {
    name: '青菜',
    cap: 1.05,
    start: 20,
    ready: [58, 100],
    perfect: [66, 88],
    burn: 114,
  },
};

export const BAND_LABEL = {
  raw: '生',
  ready: '熟了',
  perfect: '正好',
  over: '过火',
  burnt: '糊了',
};

export const BAND_POINTS = {
  raw: 0,
  ready: 2,
  perfect: 3,
  over: 1,
  burnt: 0,
};

export function cellIndex(r, c) {
  return r * COLS + c;
}

export function inGrid(r, c) {
  return r >= 0 && c >= 0 && r < ROWS && c < COLS;
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function emptyResidue() {
  return Array(ROWS * COLS).fill(0);
}

export function band(kind, temp) {
  const spec = INGREDIENTS[kind];
  if (temp >= spec.burn) return 'burnt';
  if (temp >= spec.perfect[0] && temp <= spec.perfect[1]) return 'perfect';
  if (temp >= spec.ready[0] && temp <= spec.ready[1]) return 'ready';
  if (temp > spec.ready[1]) return 'over';
  return 'raw';
}

export function panFoods(state) {
  return state.foods.filter((food) => food.place === 'pan');
}

export function crowdFactor(count) {
  if (count <= 1) return 1;
  return 1 / (1 + CROWD * (count - 1));
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function components(foods) {
  const unseen = new Set(foods.map((food) => food.id));
  const byPos = new Map(foods.map((food) => [`${food.r},${food.c}`, food]));
  const groups = [];
  for (const food of foods) {
    if (!unseen.has(food.id)) continue;
    const group = [];
    const stack = [food];
    unseen.delete(food.id);
    while (stack.length) {
      const current = stack.pop();
      group.push(current);
      for (const [dr, dc] of DIRS) {
        const next = byPos.get(`${current.r + dr},${current.c + dc}`);
        if (next && unseen.has(next.id)) {
          unseen.delete(next.id);
          stack.push(next);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

/** Effective burner units before residue, keyed by food id. Hold items are absent. */
export function effectiveBurners(state) {
  const foods = panFoods(state);
  const crowd = crowdFactor(foods.length);
  const map = new Map();
  for (const group of components(foods)) {
    const sum = group.reduce((total, food) => total + BURNER[food.r][food.c], 0);
    const avg = sum / group.length;
    for (const food of group) map.set(food.id, avg * crowd);
  }
  return map;
}

export function gainPerTick(state, food, eff = effectiveBurners(state)) {
  if (food.place !== 'pan') return 0;
  const residue = state.residue[cellIndex(food.r, food.c)] || 0;
  const burner = eff.get(food.id) || 0;
  return round2(((burner + residue) * UNIT) / INGREDIENTS[food.kind].cap);
}

export function rateTable(state) {
  const eff = effectiveBurners(state);
  const table = {};
  for (const food of state.foods) table[food.id] = gainPerTick(state, food, eff);
  return table;
}

/** Share-group index for foods that actually touch someone, else 0. */
export function shareGroups(state) {
  const map = {};
  let n = 0;
  for (const group of components(panFoods(state))) {
    if (group.length < 2) continue;
    n += 1;
    for (const food of group) map[food.id] = n;
  }
  return map;
}

export function arrival(state, kind, r, c) {
  const idx = cellIndex(r, c);
  return {
    index: idx,
    temp: round2(INGREDIENTS[kind].start + state.residue[idx] * RESIDUE_PLACE),
    residue: round2(state.residue[idx] * RESIDUE_KEEP),
  };
}

export function heatStep(state) {
  const eff = effectiveBurners(state);
  const occupied = new Set();
  for (const food of state.foods) {
    if (food.place !== 'pan') continue;
    const idx = cellIndex(food.r, food.c);
    occupied.add(idx);
    const gain = ((eff.get(food.id) + state.residue[idx]) * UNIT) / INGREDIENTS[food.kind].cap;
    const cap = INGREDIENTS[food.kind].burn + 8;
    food.temp = round2(Math.min(cap, food.temp + gain));
    state.residue[idx] = round2(
      Math.min(RESIDUE_CAP, state.residue[idx] * RESIDUE_DECAY + eff.get(food.id) * RESIDUE_BUILD),
    );
  }
  for (let i = 0; i < state.residue.length; i += 1) {
    if (!occupied.has(i)) state.residue[i] = round2(state.residue[i] * RESIDUE_DECAY);
  }
}

export function ticksUntilPerfect(kind, temp, gain) {
  if (gain <= 0) return null;
  const spec = INGREDIENTS[kind];
  if (temp >= spec.perfect[0] && temp <= spec.perfect[1]) return 0;
  if (temp > spec.perfect[1]) return null;
  return Math.ceil((spec.perfect[0] - temp) / gain);
}

export function etaSeconds(kind, temp, gain) {
  const ticks = ticksUntilPerfect(kind, temp, gain);
  if (ticks == null) return null;
  return Math.ceil(ticks / TICKS_PER_SEC);
}
