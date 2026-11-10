// Core Switchmail simulation engine
export type Direction = 'up' | 'down' | 'left' | 'right' | 'wait';
export type CellType = 'empty' | 'wall' | 'spawn' | 'destination';

export interface Pos { x: number; y: number; }

export interface Package {
  id: string;
  shape: 'circle' | 'square' | 'triangle' | 'diamond';
  color: string;
  spawn: Pos;
  destination: Pos;
  spawnTick: number;
  direction: Direction;
  currentPos: Pos | null; // null if not yet spawned or delivered
}

export interface Cell {
  type: CellType;
  direction: Direction | null;
  editableDirection: boolean;
  editableWait: boolean;
  packageId?: string; // For spawn/destination cells
}

export interface Level {
  id: number;
  name: string;
  description: string;
  gridSize: number;
  editBudget: number;
  maxTicks: number;
  grid: Cell[][];
  packages: Package[];
  solution?: EditAction[];
}

export interface EditAction {
  pos: Pos;
  direction: Direction;
}

export interface SimulationState {
  tick: number;
  packages: Map<string, { pos: Pos; direction: Direction; delivered: boolean; waitUntilTick: number | null }>;
  failed: boolean;
  failureReason: string | null;
  won: boolean;
}

export interface HistoryEntry {
  edits: EditAction[];
  usedBudget: number;
}

// Direction helpers
export const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right', 'wait'];

export function movePos(pos: Pos, dir: Direction): Pos {
  switch (dir) {
    case 'up': return { x: pos.x, y: pos.y - 1 };
    case 'down': return { x: pos.x, y: pos.y + 1 };
    case 'left': return { x: pos.x - 1, y: pos.y };
    case 'right': return { x: pos.x + 1, y: pos.y };
    case 'wait': return pos;
  }
}

export function isValidPos(pos: Pos, gridSize: number): boolean {
  return pos.x >= 0 && pos.x < gridSize && pos.y >= 0 && pos.y < gridSize;
}

export function posEqual(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}

// Simulation
export function createInitialState(level: Level): SimulationState {
  return {
    tick: 0,
    packages: new Map(),
    failed: false,
    failureReason: null,
    won: false,
  };
}

export function simulateStep(level: Level, state: SimulationState, grid: Cell[][]): SimulationState {
  if (state.failed || state.won) return state;

  // First, spawn packages BEFORE incrementing tick (they appear at their spawnTick)
  const packagesAfterSpawn = new Map(state.packages);
  for (const pkg of level.packages) {
    if (pkg.spawnTick === state.tick && !state.packages.has(pkg.id)) {
      packagesAfterSpawn.set(pkg.id, {
        pos: pkg.spawn,
        direction: pkg.direction,
        delivered: false,
        waitUntilTick: null,
      });
    }
  }

  const newState: SimulationState = {
    tick: state.tick + 1,
    packages: packagesAfterSpawn,
    failed: false,
    failureReason: null,
    won: false,
  };

  // Check for max tick timeout
  if (newState.tick > level.maxTicks) {
    newState.failed = true;
    newState.failureReason = '超时：包裹未能在规定时间内送达';
    return newState;
  }

  // Prepare moves for all active packages
  const moves: Array<{ pkgId: string; from: Pos; to: Pos; dir: Direction }> = [];
  
  for (const [pkgId, pkgState] of newState.packages.entries()) {
    if (pkgState.delivered) continue;

    let justFinishedWaiting = false;
    
    // Check if waiting
    if (pkgState.waitUntilTick !== null) {
      if (newState.tick <= pkgState.waitUntilTick) {
        // Still waiting
        moves.push({ pkgId, from: pkgState.pos, to: pkgState.pos, dir: 'wait' });
        continue;
      } else {
        // Wait expired, resume original direction and don't re-apply wait this tick
        pkgState.waitUntilTick = null;
        justFinishedWaiting = true;
      }
    }

    const currentCell = grid[pkgState.pos.y][pkgState.pos.x];
    let newDirection = pkgState.direction;

    // Apply cell direction if it exists and is not wait
    if (currentCell.direction && currentCell.direction !== 'wait') {
      newDirection = currentCell.direction;
    } else if (currentCell.direction === 'wait' && !justFinishedWaiting) {
      // Enter wait state for one full tick (but not if we just finished waiting)
      pkgState.waitUntilTick = newState.tick; // Will wait until tick > newState.tick
      moves.push({ pkgId, from: pkgState.pos, to: pkgState.pos, dir: 'wait' });
      continue;
    }

    const nextPos = movePos(pkgState.pos, newDirection);
    moves.push({ pkgId, from: pkgState.pos, to: nextPos, dir: newDirection });
  }

  // Validate moves
  for (const move of moves) {
    const pkgState = newState.packages.get(move.pkgId)!;
    
    // Skip if waiting
    if (move.dir === 'wait') continue;

    // Check out of bounds
    if (!isValidPos(move.to, level.gridSize)) {
      newState.failed = true;
      newState.failureReason = `包裹 ${move.pkgId} 移出边界`;
      return newState;
    }

    // Check wall collision
    const targetCell = grid[move.to.y][move.to.x];
    if (targetCell.type === 'wall') {
      newState.failed = true;
      newState.failureReason = `包裹 ${move.pkgId} 撞墙`;
      return newState;
    }
  }

  // Check for same-cell collision (two packages moving to the same cell)
  const targetCounts = new Map<string, string[]>();
  for (const move of moves) {
    if (move.dir === 'wait') continue;
    const key = `${move.to.x},${move.to.y}`;
    if (!targetCounts.has(key)) targetCounts.set(key, []);
    targetCounts.get(key)!.push(move.pkgId);
  }

  for (const [pos, pkgIds] of targetCounts.entries()) {
    if (pkgIds.length > 1) {
      newState.failed = true;
      newState.failureReason = `包裹碰撞于 (${pos})`;
      return newState;
    }
  }

  // Check for head-on collision (two packages swapping positions)
  for (let i = 0; i < moves.length; i++) {
    for (let j = i + 1; j < moves.length; j++) {
      const m1 = moves[i];
      const m2 = moves[j];
      if (m1.dir === 'wait' || m2.dir === 'wait') continue;
      
      if (posEqual(m1.from, m2.to) && posEqual(m1.to, m2.from)) {
        newState.failed = true;
        newState.failureReason = `包裹 ${m1.pkgId} 和 ${m2.pkgId} 迎面碰撞`;
        return newState;
      }
    }
  }

  // Apply moves
  for (const move of moves) {
    const pkgState = newState.packages.get(move.pkgId)!;
    if (move.dir === 'wait') continue;

    pkgState.pos = move.to;
    pkgState.direction = move.dir;

    // Check if delivered
    const pkg = level.packages.find(p => p.id === move.pkgId)!;
    if (posEqual(move.to, pkg.destination)) {
      pkgState.delivered = true;
    }
  }

  // Check win condition
  const allDelivered = level.packages.every(pkg => {
    const state = newState.packages.get(pkg.id);
    return state && state.delivered;
  });

  if (allDelivered) {
    newState.won = true;
  }

  return newState;
}

export function simulateToEnd(level: Level, grid: Cell[][]): SimulationState {
  let state = createInitialState(level);
  while (!state.failed && !state.won && state.tick < level.maxTicks + 10) {
    state = simulateStep(level, state, grid);
  }
  return state;
}

export function applyEdits(level: Level, edits: EditAction[]): Cell[][] {
  const grid = level.grid.map(row => row.map(cell => ({ ...cell })));
  
  for (const edit of edits) {
    const cell = grid[edit.pos.y][edit.pos.x];
    if (cell.editableDirection || cell.editableWait) {
      cell.direction = edit.direction;
    }
  }
  
  return grid;
}

export function canEdit(cell: Cell, direction: Direction): boolean {
  if (direction === 'wait') return cell.editableWait;
  return cell.editableDirection;
}

export function validateSolution(level: Level, edits: EditAction[]): { valid: boolean; reason?: string } {
  if (edits.length > level.editBudget) {
    return { valid: false, reason: `编辑次数 ${edits.length} 超过预算 ${level.editBudget}` };
  }

  const grid = applyEdits(level, edits);
  const state = simulateToEnd(level, grid);

  if (state.failed) {
    return { valid: false, reason: state.failureReason || '模拟失败' };
  }

  if (!state.won) {
    return { valid: false, reason: '包裹未全部送达' };
  }

  return { valid: true };
}
