import { describeDelta, describeTrace, pathDelta, rotCW, trace, VEC } from './sim.js';

export const STORAGE_KEY = 'wind-garden-save-v1';

export function cloneCore(core) {
  return {
    dirs: { ...core.dirs },
    plants: core.plants.map((plant) => ({ ...plant })),
    seeds: { flower: core.seeds.flower, hedge: core.seeds.hedge },
    nextId: core.nextId,
  };
}

export function initialCore(garden) {
  const dirs = {};
  for (const fan of garden.fans) dirs[fan.id] = fan.dir;
  return {
    dirs,
    plants: [],
    seeds: { flower: garden.seeds.flower, hedge: garden.seeds.hedge },
    nextId: 1,
  };
}

function sameGarden(a, b) {
  if (a.seeds.flower !== b.seeds.flower || a.seeds.hedge !== b.seeds.hedge) return false;
  const keys = Object.keys(a.dirs).sort();
  if (keys.join() !== Object.keys(b.dirs).sort().join()) return false;
  for (const key of keys) if (a.dirs[key] !== b.dirs[key]) return false;
  const plants = (core) => core.plants.map((plant) => `${plant.kind}@${plant.x},${plant.y}`).sort();
  return plants(a).join('|') === plants(b).join('|');
}

export function sanitizeCore(garden, raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.dirs || !raw.seeds || !Array.isArray(raw.plants)) return null;
  const dirs = {};
  for (const fan of garden.fans) {
    const dir = raw.dirs[fan.id];
    if (!VEC[dir]) return null;
    dirs[fan.id] = dir;
  }
  const flower = raw.seeds.flower;
  const hedge = raw.seeds.hedge;
  if (!Number.isInteger(flower) || !Number.isInteger(hedge) || flower < 0 || hedge < 0 || flower > 99 || hedge > 99) {
    return null;
  }
  const plants = [];
  const seen = new Set();
  let maxId = 0;
  for (const plant of raw.plants) {
    if (!plant || (plant.kind !== 'flower' && plant.kind !== 'hedge')) return null;
    if (!Number.isInteger(plant.x) || !Number.isInteger(plant.y) || !Number.isInteger(plant.id)) return null;
    if (plant.x < 0 || plant.y < 0 || plant.x >= garden.width || plant.y >= garden.height) return null;
    if (garden.fans.some((fan) => fan.x === plant.x && fan.y === plant.y)) return null;
    if (garden.stones.some((stone) => stone.x === plant.x && stone.y === plant.y)) return null;
    const key = `${plant.x},${plant.y}`;
    if (seen.has(key)) return null;
    seen.add(key);
    plants.push({ id: plant.id, x: plant.x, y: plant.y, kind: plant.kind });
    if (plant.id > maxId) maxId = plant.id;
  }
  const nextId = Number.isInteger(raw.nextId) && raw.nextId > maxId ? raw.nextId : maxId + 1;
  return { dirs, plants, seeds: { flower, hedge }, nextId };
}

export function createSession(garden, saved) {
  const core = sanitizeCore(garden, saved?.core) || initialCore(garden);
  const undo = [];
  if (Array.isArray(saved?.undo)) {
    for (const snap of saved.undo) {
      const clean = sanitizeCore(garden, snap);
      if (clean) undo.push(clean);
    }
  }
  const fanId = garden.fans.some((fan) => fan.id === saved?.fanId) ? saved.fanId : garden.fans[0].id;
  const seed = saved?.seed === 'hedge' ? 'hedge' : 'flower';
  return {
    garden,
    core,
    undo: undo.slice(-30),
    fanId,
    seed,
    selectedPlantId: null,
  };
}

export function selectedFan(session) {
  return session.garden.fans.find((fan) => fan.id === session.fanId);
}

export function selectFan(session, id) {
  if (!session.garden.fans.some((fan) => fan.id === id)) return { ok: false, reason: '没有这台风机' };
  session.fanId = id;
  return { ok: true };
}

export function selectSeed(session, kind) {
  if (kind !== 'flower' && kind !== 'hedge') return { ok: false, reason: '没有这种种子' };
  session.seed = kind;
  return { ok: true };
}

export function selectPlant(session, id) {
  const plant = session.core.plants.find((item) => item.id === id);
  if (!plant) return { ok: false, reason: '没有这株植物' };
  session.selectedPlantId = id;
  return { ok: true, plant };
}

function pushUndo(session, before) {
  session.undo.push(cloneCore(before));
  if (session.undo.length > 30) session.undo.shift();
}

export function preview(session, fanId = session.fanId) {
  const fan = session.garden.fans.find((item) => item.id === fanId);
  const tr = trace(session.garden, session.core, fanId);
  return {
    fanId,
    seed: session.seed,
    trace: tr,
    text: describeTrace(session.garden, fan, tr, session.seed),
  };
}

export function rotate(session) {
  const before = cloneCore(session.core);
  pushUndo(session, before);
  const dir = rotCW(session.core.dirs[session.fanId]);
  session.core.dirs[session.fanId] = dir;
  return { ok: true, dir, before };
}

export function sow(session) {
  if (session.core.seeds[session.seed] <= 0) {
    return { ok: false, reason: '这种种子用完了，可以回收再种。' };
  }
  const before = cloneCore(session.core);
  const fan = selectedFan(session);
  const tr = trace(session.garden, before, session.fanId);
  if (tr.outcome !== 'root') {
    return { ok: false, reason: describeTrace(session.garden, fan, tr, session.seed), trace: tr };
  }
  pushUndo(session, before);
  const plant = { id: session.core.nextId++, x: tr.landing.x, y: tr.landing.y, kind: session.seed };
  session.core.plants.push(plant);
  session.core.seeds[session.seed] -= 1;
  session.selectedPlantId = null;
  const delta = pathDelta(session.garden, before, session.core);
  return {
    ok: true,
    plant,
    trace: tr,
    before,
    delta,
    text: describeDelta(session.garden, delta, plant.kind),
  };
}

export function recycle(session) {
  const plant = session.core.plants.find((item) => item.id === session.selectedPlantId);
  if (!plant) return { ok: false, reason: '先点一株要回收的植物。' };
  const before = cloneCore(session.core);
  pushUndo(session, before);
  session.core.plants = session.core.plants.filter((item) => item.id !== plant.id);
  session.core.seeds[plant.kind] += 1;
  session.selectedPlantId = null;
  const delta = pathDelta(session.garden, before, session.core);
  return { ok: true, plant, before, delta, text: describeDelta(session.garden, delta, plant.kind) };
}

export function undo(session) {
  const prev = session.undo.pop();
  if (!prev) return { ok: false, reason: '没有可撤销的操作。' };
  session.core = cloneCore(prev);
  if (!session.core.plants.some((plant) => plant.id === session.selectedPlantId)) session.selectedPlantId = null;
  return { ok: true };
}

export function restart(session) {
  const fresh = initialCore(session.garden);
  if (sameGarden(session.core, fresh)) return { ok: false, reason: '已经是开园的样子。' };
  pushUndo(session, session.core);
  session.core = fresh;
  session.selectedPlantId = null;
  return { ok: true };
}

export function wishState(garden, core) {
  let filled = 0;
  for (const bed of garden.beds) {
    if (core.plants.some((plant) => plant.x === bed.x && plant.y === bed.y && plant.kind === 'flower')) filled += 1;
  }
  const need = garden.need ?? garden.beds.length;
  return {
    total: garden.beds.length,
    filled,
    need,
    done: !garden.free && need > 0 && filled >= need,
    both: garden.beds.length > 1 && filled >= garden.beds.length,
  };
}

export function playSteps(session, steps) {
  for (const step of steps) {
    const picked = selectFan(session, step.fan);
    if (!picked.ok) throw new Error(picked.reason);
    if (step.op === 'rotate') {
      const turned = rotate(session);
      if (!turned.ok) throw new Error(turned.reason);
    } else if (step.op === 'sow') {
      const seeded = selectSeed(session, step.seed);
      if (!seeded.ok) throw new Error(seeded.reason);
      const planted = sow(session);
      if (!planted.ok) throw new Error(`${step.seed} via ${step.fan}: ${planted.reason}`);
    } else {
      throw new Error(`bad step ${step.op}`);
    }
  }
  return session;
}

export function dump(session) {
  return {
    v: 1,
    gardenId: session.garden.id,
    core: cloneCore(session.core),
    undo: session.undo.map((snap) => cloneCore(snap)),
    fanId: session.fanId,
    seed: session.seed,
  };
}

export function emptySave() {
  return { v: 1, sound: false, lastId: 'breeze', gardens: {} };
}

export function readSave(raw) {
  if (typeof raw !== 'string' || !raw) return emptySave();
  try {
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || typeof data !== 'object') return emptySave();
    const gardens = data.gardens && typeof data.gardens === 'object' ? data.gardens : {};
    return {
      v: 1,
      sound: data.sound === true,
      lastId: typeof data.lastId === 'string' ? data.lastId : 'breeze',
      gardens,
    };
  } catch {
    return emptySave();
  }
}

export function writeGarden(save, session, sound) {
  const next = {
    v: 1,
    sound: sound === true,
    lastId: session.garden.id,
    gardens: { ...save.gardens, [session.garden.id]: dump(session) },
  };
  return next;
}
