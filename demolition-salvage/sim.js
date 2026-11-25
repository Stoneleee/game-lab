// Deterministic 2D demolition.
// Wood hangs from other wood beside it, or stands on something below.
// Steel holds only what is stacked on it. Brick stands only on the cell below.
// The green room does not hold anything up: a block that lands on it is a hit.
// A shot turns a block into rubble. Rubble supports nothing.
// Salvage increases only when rubble or a block enters a collector cell.

const MATERIALS = new Set(['wood', 'brick', 'protected', 'anchor']);

export function loadLevel(def) {
  if (!def?.rows?.length) throw new Error('level has no rows');
  const height = def.rows.length;
  const width = def.rows[0].length;
  if (width < 3 || height < 3) throw new Error(`level ${def.name} is too small`);
  if (def.rows.some((row) => row.length !== width)) {
    throw new Error(`level ${def.name} has ragged rows`);
  }
  const terrain = Array.from({ length: height }, () => Array(width).fill('air'));
  const entities = [];
  const occupied = new Set();
  let id = 1;
  const materialOf = { W: 'wood', B: 'brick', P: 'protected', A: 'anchor' };
  for (let row = 0; row < height; row++) {
    const y = height - 1 - row;
    for (let x = 0; x < width; x++) {
      const ch = def.rows[row][x];
      if (ch === '.') continue;
      if (ch === '#') {
        terrain[y][x] = 'ground';
        continue;
      }
      if (ch === 'C') {
        terrain[y][x] = 'collector';
        continue;
      }
      const material = materialOf[ch];
      if (!material) throw new Error(`bad cell "${ch}" in ${def.name}`);
      const key = `${x},${y}`;
      if (occupied.has(key)) throw new Error(`stacked cell ${key} in ${def.name}`);
      occupied.add(key);
      entities.push({ id: id++, x, y, material, rubble: false });
    }
  }
  if (!entities.some((e) => e.material === 'wood' || e.material === 'brick')) {
    throw new Error(`level ${def.name} has nothing to cut`);
  }
  return {
    levelId: def.id,
    name: def.name,
    hint: def.hint,
    coach: def.coach ? { x: def.coach.x, y: def.coach.y } : null,
    width,
    height,
    terrain,
    entities,
    shotsLeft: def.shots,
    shotMax: def.shots,
    salvage: 0,
    goal: def.goal,
    hasProtected: entities.some((e) => e.material === 'protected'),
    failure: null,
    phase: 'play',
    reason: '',
    tick: 0,
  };
}

export function cloneState(state) {
  return {
    ...state,
    terrain: state.terrain.map((row) => row.slice()),
    entities: state.entities.map((e) => ({ ...e })),
    coach: state.coach ? { ...state.coach } : null,
  };
}

export function fingerprint(state) {
  const ents = state.entities
    .map((e) => `${e.id}:${e.material}${e.rubble ? '*' : ''}@${e.x},${e.y}`)
    .sort();
  return JSON.stringify({
    ents,
    salvage: state.salvage,
    shots: state.shotsLeft,
    failure: state.failure,
    phase: state.phase,
    reason: state.reason,
    goal: state.goal,
  });
}

export function formatState(state) {
  const grid = state.terrain.map((row) => row.map((cell) => {
    if (cell === 'ground') return '#';
    if (cell === 'collector') return 'C';
    return '.';
  }));
  const glyph = { wood: 'W', brick: 'B', protected: 'P', anchor: 'A' };
  for (const e of state.entities) {
    const ch = glyph[e.material] || '?';
    grid[e.y][e.x] = e.rubble ? ch.toLowerCase() : ch;
  }
  return grid.slice().reverse().map((row) => row.join('')).join('\n');
}

export function entityAt(state, x, y) {
  return state.entities.find((e) => e.x === x && e.y === y) || null;
}

export function computeSupported(state) {
  const at = new Map(state.entities.map((e) => [`${e.x},${e.y}`, e]));
  const supported = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of state.entities) {
      if (e.rubble || supported.has(e.id)) continue;
      if (e.material === 'anchor') {
        supported.add(e.id);
        changed = true;
        continue;
      }
      const belowY = e.y - 1;
      const onGround = belowY >= 0 && state.terrain[belowY][e.x] === 'ground';
      const under = belowY >= 0 ? at.get(`${e.x},${belowY}`) : null;
      const vertical = onGround || (
        !!under && !under.rubble && under.material !== 'protected' && supported.has(under.id)
      );
      if (vertical) {
        supported.add(e.id);
        changed = true;
        continue;
      }
      if (e.material === 'wood') {
        for (const nx of [e.x - 1, e.x + 1]) {
          const neighbor = at.get(`${nx},${e.y}`);
          if (neighbor && !neighbor.rubble && neighbor.material === 'wood' && supported.has(neighbor.id)) {
            supported.add(e.id);
            changed = true;
            break;
          }
        }
      }
    }
  }
  return supported;
}

function physicsTick(state) {
  const supported = computeSupported(state);
  const next = cloneState(state);
  const events = [];
  let moved = false;
  const movers = next.entities
    .filter((e) => e.material !== 'anchor' && (e.rubble || !supported.has(e.id)))
    .map((e) => e.id);
  movers.sort((a, b) => {
    const ea = next.entities.find((e) => e.id === a);
    const eb = next.entities.find((e) => e.id === b);
    return ea.y - eb.y || ea.x - eb.x;
  });

  const occupiedAt = (x, y) => next.entities.find((e) => e.x === x && e.y === y);

  for (const id of movers) {
    const block = next.entities.find((e) => e.id === id);
    if (!block) continue;
    const destX = block.x;
    const destY = block.y - 1;
    if (destY < 0) {
      if (block.material === 'protected') {
        next.failure = next.failure || '保留房塌出了场地';
      }
      next.entities = next.entities.filter((e) => e.id !== id);
      moved = true;
      events.push({ type: 'void', id, x: block.x, y: block.y, material: block.material });
      continue;
    }
    const occupant = occupiedAt(destX, destY);
    if (occupant) {
      if (occupant.material === 'protected' && block.material !== 'protected') {
        next.failure = next.failure || '废料砸中保留房';
        events.push({
          type: 'impact',
          id,
          x: block.x,
          y: block.y,
          px: occupant.x,
          py: occupant.y,
          material: block.material,
        });
      } else if (block.material === 'protected') {
        next.failure = next.failure || '保留房失去支撑，塌了';
        events.push({ type: 'room-blocked', id, x: block.x, y: block.y });
      }
      continue;
    }
    const ground = next.terrain[destY][destX];
    if (ground === 'ground') continue;
    if (ground === 'collector') {
      if (block.material === 'protected') {
        next.failure = next.failure || '保留房塌进了回收箱';
        block.x = destX;
        block.y = destY;
        moved = true;
        events.push({ type: 'room-fall', id, x: destX, y: destY });
        continue;
      }
      next.entities = next.entities.filter((e) => e.id !== id);
      next.salvage += 1;
      moved = true;
      events.push({ type: 'collect', id, x: destX, y: destY, material: block.material });
      continue;
    }
    if (block.material === 'protected') {
      next.failure = next.failure || '保留房失去支撑，塌了';
      events.push({ type: 'room-fall', id, x: destX, y: destY });
    } else {
      events.push({ type: 'fall', id, x: destX, y: destY, material: block.material });
    }
    block.x = destX;
    block.y = destY;
    moved = true;
  }

  const after = computeSupported(next);
  const rooms = next.entities.filter((e) => e.material === 'protected');
  if (next.hasProtected && (rooms.length === 0 || rooms.some((room) => !after.has(room.id)))) {
    next.failure = next.failure || '保留房失去支撑，塌了';
  }
  return { next, events, moved };
}

export function evaluate(state) {
  if (state.failure) return { phase: 'lost', reason: state.failure };
  if (state.hasProtected) {
    const supported = computeSupported(state);
    const rooms = state.entities.filter((e) => e.material === 'protected');
    if (rooms.length === 0 || rooms.some((room) => !supported.has(room.id))) {
      return { phase: 'lost', reason: '保留房失去支撑，塌了' };
    }
  }
  if (state.salvage >= state.goal) {
    return {
      phase: 'won',
      reason: state.hasProtected ? '回收完成，绿房安全' : '碎块落进了回收箱',
    };
  }
  if (state.shotsLeft <= 0) {
    return {
      phase: 'lost',
      reason: `弹药用完，回收不足（${state.salvage}/${state.goal}）`,
    };
  }
  return { phase: 'play', reason: '' };
}

export function shoot(state, x, y) {
  if (state.phase !== 'play') return { ok: false, reason: '现在不能拆除' };
  const target = entityAt(state, x, y);
  if (!target || target.rubble) return { ok: false, reason: '这里没有可拆的块' };
  if (target.material === 'protected') return { ok: false, reason: '这是要保住的，不能拆' };
  if (target.material === 'anchor') return { ok: false, reason: '钢架拆不掉' };
  if (!MATERIALS.has(target.material)) return { ok: false, reason: '这里没有可拆的块' };
  if (state.shotsLeft <= 0) return { ok: false, reason: '没有弹药了' };
  const next = cloneState(state);
  const block = next.entities.find((e) => e.id === target.id);
  block.rubble = true;
  next.shotsLeft -= 1;
  next.phase = 'resolving';
  next.reason = '';
  next.failure = null;
  return {
    ok: true,
    state: next,
    shot: { id: block.id, x, y, material: block.material },
  };
}

export function step(state) {
  if (state.phase === 'won' || state.phase === 'lost') {
    return { state, events: [], done: true };
  }
  if (state.tick > 64) {
    const next = cloneState(state);
    next.failure = next.failure || '坍落超过步数上限';
    next.phase = 'lost';
    next.reason = next.failure;
    return { state: next, events: [], done: true };
  }
  const { next, events, moved } = physicsTick(state);
  next.tick = state.tick + 1;
  if (moved) {
    next.phase = 'resolving';
    next.reason = '';
    return { state: next, events, done: false };
  }
  const result = evaluate(next);
  next.phase = result.phase;
  next.reason = result.reason;
  return { state: next, events, done: true };
}
