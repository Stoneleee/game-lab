// Discrete wind for 风吹小花园.
// One stream per fan. Each step spends 1 strength. Flowers do not block.
// A hedge, stone, or other fan cannot be entered: the stream turns clockwise
// if that side stays inside the garden, otherwise counter-clockwise.
// The seed roots where strength runs out, or on the last cell before the edge.
// y grows south, matching the canvas. Replaying the same garden is the same path.

export const DIR_ORDER = ['E', 'S', 'W', 'N'];

export const DIR_NAME = { E: '东', S: '南', W: '西', N: '北' };

export const VEC = {
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
  N: { x: 0, y: -1 },
};

const BLOCK_NAME = { hedge: '灌木', stone: '石头', fan: '风机' };

export function rotCW(dir) {
  const i = DIR_ORDER.indexOf(dir);
  if (i < 0) throw new Error(`bad dir ${dir}`);
  return DIR_ORDER[(i + 1) % 4];
}

export function rotCCW(dir) {
  const i = DIR_ORDER.indexOf(dir);
  if (i < 0) throw new Error(`bad dir ${dir}`);
  return DIR_ORDER[(i + 3) % 4];
}

export function inside(garden, x, y) {
  return x >= 0 && y >= 0 && x < garden.width && y < garden.height;
}

export function fanAt(garden, x, y) {
  return garden.fans.find((fan) => fan.x === x && fan.y === y) || null;
}

export function stoneAt(garden, x, y) {
  return garden.stones.some((stone) => stone.x === x && stone.y === y);
}

export function bedAt(garden, x, y) {
  return garden.beds.some((bed) => bed.x === x && bed.y === y);
}

export function plantAt(core, x, y) {
  return core.plants.find((plant) => plant.x === x && plant.y === y) || null;
}

function blocker(garden, core, x, y) {
  if (fanAt(garden, x, y)) return 'fan';
  if (stoneAt(garden, x, y)) return 'stone';
  const plant = plantAt(core, x, y);
  if (plant && plant.kind === 'hedge') return 'hedge';
  return null;
}

function passable(garden, core, x, y) {
  return inside(garden, x, y) && !blocker(garden, core, x, y);
}

function settle(garden, core, x, y) {
  if (fanAt(garden, x, y) || !inside(garden, x, y)) {
    return { outcome: 'miss', landing: null, reason: '风吹出了花园' };
  }
  if (plantAt(core, x, y)) {
    return { outcome: 'occupied', landing: { x, y }, reason: '落点已经有植物' };
  }
  if (stoneAt(garden, x, y)) {
    return { outcome: 'miss', landing: { x, y }, reason: '停在石头上' };
  }
  return { outcome: 'root', landing: { x, y }, reason: '可以生根' };
}

function pack(settled, stop, steps, turns) {
  return {
    outcome: settled.outcome,
    stop,
    landing: settled.landing,
    reason: settled.reason,
    steps,
    turns,
  };
}

export function trace(garden, core, fanId) {
  const fan = garden.fans.find((item) => item.id === fanId);
  if (!fan) throw new Error(`no fan ${fanId}`);
  const dir0 = core.dirs[fanId];
  if (!VEC[dir0]) throw new Error(`fan ${fanId} has no direction`);
  let x = fan.x;
  let y = fan.y;
  let dir = dir0;
  let rem = fan.power;
  const steps = [];
  const turns = [];
  const seen = new Set();
  for (let guard = 0; guard < 48; guard++) {
    const key = `${x},${y},${dir},${rem}`;
    if (seen.has(key)) return pack({ outcome: 'cycle', landing: null, reason: '风在打转' }, 'cycle', steps, turns);
    seen.add(key);
    const vec = VEC[dir];
    const nx = x + vec.x;
    const ny = y + vec.y;
    if (!inside(garden, nx, ny)) return pack(settle(garden, core, x, y), 'edge', steps, turns);
    const block = blocker(garden, core, nx, ny);
    if (block) {
      const cw = rotCW(dir);
      const ccw = rotCCW(dir);
      const cwVec = VEC[cw];
      const ccwVec = VEC[ccw];
      let next = null;
      if (passable(garden, core, x + cwVec.x, y + cwVec.y)) next = cw;
      else if (passable(garden, core, x + ccwVec.x, y + ccwVec.y)) next = ccw;
      if (!next) return pack(settle(garden, core, x, y), 'boxed', steps, turns);
      turns.push({ x, y, from: dir, to: next, blockX: nx, blockY: ny, blockKind: block });
      dir = next;
      continue;
    }
    if (rem < 1) return pack(settle(garden, core, x, y), 'spent', steps, turns);
    rem -= 1;
    x = nx;
    y = ny;
    steps.push({ x, y, dir, rem });
    if (rem === 0) return pack(settle(garden, core, x, y), 'spent', steps, turns);
  }
  return pack({ outcome: 'cycle', landing: null, reason: '风路太长' }, 'cycle', steps, turns);
}

export function traceAll(garden, core) {
  return garden.fans.map((fan) => ({ fanId: fan.id, trace: trace(garden, core, fan.id) }));
}

export function streamSig(tr) {
  return JSON.stringify({
    steps: tr.steps.map((step) => [step.x, step.y, step.dir]),
    turns: tr.turns.map((turn) => [turn.x, turn.y, turn.from, turn.to, turn.blockX, turn.blockY]),
  });
}

export function pathDelta(garden, before, after) {
  const notes = [];
  for (const fan of garden.fans) {
    const a = trace(garden, before, fan.id);
    const b = trace(garden, after, fan.id);
    if (streamSig(a) === streamSig(b)) continue;
    notes.push({
      fanId: fan.id,
      from: a.landing ? { ...a.landing } : null,
      to: b.landing ? { ...b.landing } : null,
      gainedTurn: b.turns.length > a.turns.length,
    });
  }
  return notes;
}

function where(garden, landing) {
  if (!landing) return '园外';
  return bedAt(garden, landing.x, landing.y) ? '花床' : '亮起的格子';
}

export function describeTrace(garden, fan, tr, seedKind) {
  const seed = seedKind === 'hedge' ? '灌木籽' : '花籽';
  if (tr.outcome === 'cycle') return `${fan.name}的风在格子里打转，种子不会落地。`;
  if (tr.outcome === 'miss' && !tr.landing) return `${fan.name}的风吹出了花园，种子不会落地。`;
  let wind;
  if (!tr.turns.length) wind = `${fan.name}的风直行。`;
  else {
    const turn = tr.turns[0];
    const what = BLOCK_NAME[turn.blockKind] || '障碍';
    wind = `${fan.name}的风被${what}挡住，从朝${DIR_NAME[turn.from]}改到朝${DIR_NAME[turn.to]}。`;
    if (tr.turns.length > 1) wind += `之后又改了${tr.turns.length - 1}次。`;
  }
  if (tr.outcome === 'root') {
    const edge = tr.stop === 'edge' ? '前方出界，' : '';
    return `${wind}${edge}${seed}会落到${where(garden, tr.landing)}。`;
  }
  if (tr.outcome === 'occupied') return `${wind}落点已有植物，这粒种不下。`;
  return `${wind}种子停不住，飘走了。`;
}

export function describeDelta(garden, delta, kind) {
  if (!delta.length) {
    return kind === 'flower' ? '花朵不挡风，风路和刚才一样。' : '风路没有变化。';
  }
  return delta.map((note) => {
    const fan = garden.fans.find((item) => item.id === note.fanId);
    const place = note.to && bedAt(garden, note.to.x, note.to.y) ? '花床' : (note.to ? '另一格' : '园外');
    return `${fan.name}的风路变了，下一粒会落到${place}。`;
  }).join('');
}
