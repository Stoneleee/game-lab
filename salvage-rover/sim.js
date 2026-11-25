// Discrete salvage-rover rules. One call of simulate() is the whole run.
// Playback timing is not an input. The same assembly always makes the same steps.
//
// Chassis puts 1 weight on the front axle and 1 on the rear axle.
// A part's weight sits on its slot. The middle slot splits, odd remainder to the rear.
// Cargo weight sits on the cargo bed's slot and is added when a crate is loaded.
// Battery in the front or rear slot drives that axle. Middle does not drive.
// Uphill, if the rear axle is heavier than the front, the nose lifts and the run stops.
// Gentle hills need driven-axle weight >= 2. Steep hills need >= 6.
// A winch in the front slot adds 4 pull on steep steps and spends 1 extra energy.
// Mud without tracks stops the rover. Tracks work in any slot and are heavy.
// Energy is 60 with a battery. Uphill spends the current total weight, mud spends 3 more.

import { routeById } from './routes.js';

export const SLOTS = ['front', 'mid', 'rear'];

export const TUNING = {
  batteryEnergy: 60,
  chassisAxle: 1,
  batteryWeight: 1,
  bedEmpty: 2,
  cargoWeight: 2,
  bedCapacity: 3,
  winchWeight: 2,
  winchPull: 4,
  winchDrain: 1,
  tracksWeight: 3,
  gentleNeed: 2,
  steepNeed: 6,
  mudDrain: 3,
  flatDrain: 1,
};

export const PARTS = {
  battery: {
    id: 'battery',
    name: '电池',
    weight: TUNING.batteryWeight,
    blurb: '放前槽或后槽，驱动那一侧的轮',
  },
  bed: {
    id: 'bed',
    name: '货箱',
    weight: TUNING.bedEmpty,
    blurb: '最多 3 箱，重量压在货箱所在的槽',
  },
  winch: {
    id: 'winch',
    name: '绞盘',
    weight: TUNING.winchWeight,
    blurb: '只有前槽能拉陡坡，陡坡上更费电',
  },
  tracks: {
    id: 'tracks',
    name: '宽履',
    weight: TUNING.tracksWeight,
    blurb: '软地不会陷，但本身很重',
  },
};

export const INITIAL = {
  yard: { front: null, mid: 'bed', rear: null, load: 1 },
  steep: { front: null, mid: null, rear: null, load: 2 },
  mud: { front: null, mid: null, rear: null, load: 2 },
};

export const SOLUTIONS = {
  yard: { front: 'bed', mid: null, rear: 'battery', load: 1 },
  steep: { front: 'winch', mid: 'bed', rear: 'battery', load: 2 },
  mud: { front: 'tracks', mid: 'bed', rear: 'battery', load: 2 },
};

const PART_IDS = new Set(Object.keys(PARTS));

export function initialAssembly(routeId) {
  return cloneAssembly(INITIAL[routeId]);
}

export function cloneAssembly(assembly) {
  return {
    front: assembly.front,
    mid: assembly.mid,
    rear: assembly.rear,
    load: assembly.load,
  };
}

export function normalize(assembly) {
  if (!assembly) throw new Error('missing assembly');
  const next = {
    front: assembly.front || null,
    mid: assembly.mid || null,
    rear: assembly.rear || null,
    load: assembly.load,
  };
  if (!Number.isInteger(next.load)) throw new Error('load must be an integer');
  next.load = Math.min(TUNING.bedCapacity, Math.max(0, next.load));
  const seen = new Set();
  for (const slot of SLOTS) {
    const part = next[slot];
    if (part == null) continue;
    if (!PART_IDS.has(part)) throw new Error(`unknown part ${part}`);
    if (seen.has(part)) throw new Error(`duplicate part ${part}`);
    seen.add(part);
  }
  return next;
}

export function place(assembly, partId, slot) {
  if (!SLOTS.includes(slot)) throw new Error(`unknown slot ${slot}`);
  if (!PART_IDS.has(partId)) throw new Error(`unknown part ${partId}`);
  const next = normalize(assembly);
  for (const key of SLOTS) {
    if (next[key] === partId) next[key] = null;
  }
  next[slot] = partId;
  return next;
}

export function clearSlot(assembly, slot) {
  if (!SLOTS.includes(slot)) throw new Error(`unknown slot ${slot}`);
  const next = normalize(assembly);
  next[slot] = null;
  return next;
}

export function setLoad(assembly, load) {
  const next = normalize({ ...assembly, load: Math.round(load) });
  return next;
}

export function unlockedRoutes(cleared) {
  const open = new Set(['yard']);
  const done = new Set(cleared);
  if (done.has('yard')) open.add('steep');
  if (done.has('steep')) open.add('mud');
  return open;
}

export function unlockedParts(cleared) {
  const open = new Set(['battery', 'bed']);
  const done = new Set(cleared);
  if (done.has('yard')) open.add('winch');
  if (done.has('steep')) open.add('tracks');
  return open;
}

export function hasPart(assembly, partId) {
  return SLOTS.some((slot) => assembly[slot] === partId);
}

export function partSlot(assembly, partId) {
  return SLOTS.find((slot) => assembly[slot] === partId) || null;
}

function partWeight(partId, cargo) {
  if (!partId) return 0;
  if (partId === 'bed') return TUNING.bedEmpty + TUNING.cargoWeight * cargo;
  return PARTS[partId].weight;
}

export function weigh(assembly, cargo) {
  const fitted = normalize(assembly);
  const carried = Math.max(0, cargo | 0);
  let front = TUNING.chassisAxle + partWeight(fitted.front, carried);
  let rear = TUNING.chassisAxle + partWeight(fitted.rear, carried);
  const mid = partWeight(fitted.mid, carried);
  front += Math.floor(mid / 2);
  rear += Math.ceil(mid / 2);
  const drive = fitted.front === 'battery' ? 'front' : fitted.rear === 'battery' ? 'rear' : null;
  const grip = drive === 'front' ? front : drive === 'rear' ? rear : 0;
  return { front, rear, total: front + rear, drive, grip, cargo: carried };
}

export function stepCost(totalWeight, step, winchPulling) {
  return (
    TUNING.flatDrain +
    (step.grade > 0 ? totalWeight : 0) +
    (step.surface === 'mud' ? TUNING.mudDrain : 0) +
    (winchPulling ? TUNING.winchDrain : 0)
  );
}

function pullOf(assembly, step) {
  if (step.grade < 2 || assembly.front !== 'winch') return 0;
  return TUNING.winchPull;
}

function needOf(step) {
  if (step.grade >= 2) return TUNING.steepNeed;
  if (step.grade === 1) return TUNING.gentleNeed;
  return 0;
}

function capacityOf(assembly) {
  return hasPart(assembly, 'bed') ? TUNING.bedCapacity : 0;
}

export function simulate(assembly, routeOrId) {
  const fitted = normalize(assembly);
  const route = typeof routeOrId === 'string' ? routeById(routeOrId) : routeOrId;
  let energy = hasPart(fitted, 'battery') ? TUNING.batteryEnergy : 0;
  let cargo = 0;
  let y = 0;
  const frames = [frame({ x: 0, y: 0, energy, cargo, pose: 'ready', step: 0, event: '' }, fitted)];

  const finish = (code, reason, pose) => {
    const last = frames[frames.length - 1];
    frames.push(frame({ ...last, pose, event: '', step: last.x }, fitted, cargo));
    return {
      ok: false,
      code,
      reason,
      reached: false,
      cargo,
      energyLeft: energy,
      goal: route.goal,
      frames,
      assembly: cloneAssembly(fitted),
    };
  };

  for (let index = 0; index < route.steps.length; index += 1) {
    const step = route.steps[index];
    const weight = weigh(fitted, cargo);
    if (!weight.drive) {
      return finish('no-drive', '电池没有装在前槽或后槽，车轮不转', 'idle');
    }
    if (step.surface === 'mud' && !hasPart(fitted, 'tracks')) {
      return finish('mud', '没有宽履，车身陷入软地', 'sink');
    }
    if (step.grade > 0 && weight.rear - weight.front >= 1) {
      return finish(
        'front-lift',
        `后轴过重，前轮离地（前 ${weight.front} / 后 ${weight.rear}）`,
        'lift',
      );
    }
    const pull = pullOf(fitted, step);
    const need = needOf(step);
    if (weight.grip + pull < need) {
      const winchElsewhere = hasPart(fitted, 'winch') && fitted.front !== 'winch';
      if (step.grade >= 2 && winchElsewhere) {
        return finish(
          'winch-pos',
          `绞盘不在前槽，陡坡拉不住（驱动轮承重 ${weight.grip}，需要 ${need}）`,
          'slip',
        );
      }
      return finish('slip', `驱动轮打滑（承重 ${weight.grip}，需要 ${need}）`, 'slip');
    }
    const pulling = pull > 0;
    const cost = stepCost(weight.total, step, pulling);
    if (energy < cost) {
      return finish('energy', `电量耗尽（这一步要 ${cost}，剩余 ${energy}）`, 'dead');
    }
    energy -= cost;
    y += step.grade;
    let event = '';
    if (step.pickup) {
      const room = Math.min(capacityOf(fitted) - cargo, fitted.load - cargo, step.pickup);
      if (room > 0) {
        cargo += room;
        event = `装上 ${room} 箱`;
      }
    }
    frames.push(
      frame({ x: index + 1, y, energy, cargo, pose: 'roll', step: index + 1, event }, fitted, cargo),
    );
  }

  if (cargo < route.goal) {
    const last = frames[frames.length - 1];
    frames[frames.length - 1] = { ...last, pose: 'short' };
    const reason = hasPart(fitted, 'bed')
      ? `到达回收点，但只带回 ${cargo}/${route.goal} 箱`
      : `到达回收点，但没有货箱，带回 0/${route.goal} 箱`;
    return {
      ok: false,
      code: 'short-cargo',
      reason,
      reached: true,
      cargo,
      energyLeft: energy,
      goal: route.goal,
      frames,
      assembly: cloneAssembly(fitted),
    };
  }

  const last = frames[frames.length - 1];
  frames[frames.length - 1] = { ...last, pose: 'arrive' };
  return {
    ok: true,
    code: 'ok',
    reason: `带回 ${cargo} 箱，电还剩 ${energy}`,
    reached: true,
    cargo,
    energyLeft: energy,
    goal: route.goal,
    frames,
    assembly: cloneAssembly(fitted),
  };
}

function frame(base, assembly, cargo = base.cargo) {
  const weight = weigh(assembly, cargo);
  return {
    x: base.x,
    y: base.y,
    energy: base.energy,
    cargo,
    front: weight.front,
    rear: weight.rear,
    grip: weight.grip,
    drive: weight.drive,
    pose: base.pose,
    step: base.step,
    event: base.event,
  };
}

export function preview(assembly) {
  const fitted = normalize(assembly);
  const limit = hasPart(fitted, 'bed') ? fitted.load : 0;
  return {
    empty: weigh(fitted, 0),
    loaded: weigh(fitted, limit),
    energy: hasPart(fitted, 'battery') ? TUNING.batteryEnergy : 0,
    capacity: capacityOf(fitted),
    load: limit,
    drive: weigh(fitted, 0).drive,
  };
}

const FAIL_HINT = {
  'no-drive': '电池在中槽带不动轮子。点到前槽或后槽，直接驱动那根轴。',
  mud: '车身陷进软地了。三个槽里要有一个宽履。',
  'front-lift': '后轴比前轴重，前轮离地。把货箱或重零件点到前槽，再试车。',
  'winch-pos': '绞盘不在车头，陡坡没有向前的拉力。把绞盘点到前槽。',
  slip: '驱动轮太轻，坡上打滑。陡坡要前槽绞盘；电池放到它驱动的那根轴上。',
  energy: '这一步电不够。少装一箱，或卸下这条路用不到的重零件。',
  'short-cargo': '车到了，箱数不够。能过坡的话，把本次装载调高再试。',
};

export function coach({ routeId, assembly, result, selected }) {
  const fitted = normalize(assembly);
  if (result?.code === 'running') return '试车中。看两侧承重、电量和车轮。';
  if (selected && (!result || result.code === 'edited')) {
    return selectedCoach(routeId, fitted, selected);
  }
  if (!result || result.code === 'edited') return introCoach(routeId, fitted);
  if (result.code === 'ok') return successCoach(routeId, fitted);
  return FAIL_HINT[result.code] || result.reason;
}

function selectedCoach(routeId, assembly, selected) {
  const name = PARTS[selected].name;
  if (routeId === 'yard' && selected === 'battery' && !assembly.front && !assembly.rear) {
    return '电池选好了。点后槽，让后轮来驱动。';
  }
  if (routeId === 'yard' && selected === 'bed' && assembly.rear === 'battery' && assembly.mid === 'bed') {
    return '货箱选好了。点前槽，把重量压到车头。';
  }
  return `已选${name}。再点一个槽放上去。点它当前的槽可以取下。`;
}

function introCoach(routeId, assembly) {
  if (routeId === 'yard') {
    if (assembly.rear === 'battery' && assembly.front === 'bed') {
      return '货箱到车头了。按试车，看它能不能爬完这段坡。';
    }
    if (assembly.rear === 'battery' && assembly.mid === 'bed') {
      return '电池在后轮，货箱还在中槽。按试车，看车头还压不压得住。';
    }
    if (!hasPart(assembly, 'battery')) {
      return '货箱先放在中槽。点电池，再点后槽，然后按试车。';
    }
    return '后轴比前轴重时，上坡会抬起前轮。调好槽位再试车。';
  }
  if (routeId === 'steep') {
    return '路边有 3 箱，目标带回 2 箱。陡坡只认前槽绞盘。装太满会在坡上没电。';
  }
  return '这段有软地，没有宽履会陷住。宽履很重，目标带回 2 箱，装满可能爬不完。';
}

function successCoach(routeId, assembly) {
  if (routeId === 'yard') {
    if (assembly.front === 'battery') {
      return '前轮驱动也到了。把电池改到后槽、货箱留在中槽，再试一次，能看到前轮离地。';
    }
    return '带回 1 箱。货箱换到车头之后，前轮没有再抬起来。下一关是陡坡。';
  }
  if (routeId === 'steep') {
    return '带回 2 箱。少装一箱才够电，绞盘在车头才拉得动。下一关有软地。';
  }
  return '带回 2 箱。宽履过了软地，少装一箱才把电留到坡上。三条路都可以再配再跑。';
}
