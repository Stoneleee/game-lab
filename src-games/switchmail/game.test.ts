import { describe, it, expect } from 'vitest';
import {
  movePos, isValidPos, posEqual, createInitialState, simulateStep, simulateToEnd,
  applyEdits, validateSolution, Level, Cell, Package, Direction, Pos
} from './game';
import { LEVELS } from './levels';

describe('Position utilities', () => {
  it('should move position correctly', () => {
    const pos = { x: 2, y: 2 };
    expect(movePos(pos, 'up')).toEqual({ x: 2, y: 1 });
    expect(movePos(pos, 'down')).toEqual({ x: 2, y: 3 });
    expect(movePos(pos, 'left')).toEqual({ x: 1, y: 2 });
    expect(movePos(pos, 'right')).toEqual({ x: 3, y: 2 });
    expect(movePos(pos, 'wait')).toEqual({ x: 2, y: 2 });
  });

  it('should validate positions', () => {
    expect(isValidPos({ x: 0, y: 0 }, 5)).toBe(true);
    expect(isValidPos({ x: 4, y: 4 }, 5)).toBe(true);
    expect(isValidPos({ x: -1, y: 0 }, 5)).toBe(false);
    expect(isValidPos({ x: 5, y: 0 }, 5)).toBe(false);
    expect(isValidPos({ x: 0, y: 5 }, 5)).toBe(false);
  });

  it('should compare positions', () => {
    expect(posEqual({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(posEqual({ x: 1, y: 2 }, { x: 2, y: 2 })).toBe(false);
    expect(posEqual({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(false);
  });
});

describe('Simulation - Basic Movement', () => {
  it('should spawn package at correct tick', () => {
    const level = LEVELS[0]; // Level 1
    let state = createInitialState(level);
    expect(state.packages.size).toBe(0);

    state = simulateStep(level, state, level.grid);
    expect(state.packages.size).toBe(1);
    expect(state.packages.has('A')).toBe(true);
  });

  it('should move package in correct direction', () => {
    const level = LEVELS[0];
    let state = createInitialState(level);
    
    // Tick 0->1: spawn at (0, 2) and immediately move right to (1, 2)
    state = simulateStep(level, state, level.grid);
    expect(state.packages.get('A')?.pos).toEqual({ x: 1, y: 2 });

    // Tick 1->2: move right to (2, 2)
    state = simulateStep(level, state, level.grid);
    expect(state.packages.get('A')?.pos).toEqual({ x: 2, y: 2 });
  });

  it('should deliver package at destination', () => {
    const level = LEVELS[0];
    const state = simulateToEnd(level, level.grid);
    
    expect(state.won).toBe(true);
    expect(state.failed).toBe(false);
    expect(state.packages.get('A')?.delivered).toBe(true);
  });
});

describe('Simulation - Collisions', () => {
  it('should detect wall collision', () => {
    const grid: Cell[][] = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => ({
        type: 'empty' as const,
        direction: null,
        editableDirection: false,
        editableWait: false,
      }))
    );
    grid[2][2].type = 'wall';

    const level: Level = {
      id: 999,
      name: 'Test',
      description: 'Test',
      gridSize: 5,
      editBudget: 0,
      maxTicks: 20,
      grid,
      packages: [{
        id: 'A',
        shape: 'circle',
        color: '#ff0000',
        spawn: { x: 0, y: 2 },
        destination: { x: 4, y: 2 },
        spawnTick: 0,
        direction: 'right',
      }],
    };

    const state = simulateToEnd(level, grid);
    expect(state.failed).toBe(true);
    expect(state.failureReason).toContain('撞墙');
  });

  it('should detect out of bounds', () => {
    const grid: Cell[][] = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => ({
        type: 'empty' as const,
        direction: null,
        editableDirection: false,
        editableWait: false,
      }))
    );

    const level: Level = {
      id: 999,
      name: 'Test',
      description: 'Test',
      gridSize: 5,
      editBudget: 0,
      maxTicks: 20,
      grid,
      packages: [{
        id: 'A',
        shape: 'circle',
        color: '#ff0000',
        spawn: { x: 4, y: 2 },
        destination: { x: 0, y: 2 },
        spawnTick: 0,
        direction: 'right', // Will go out of bounds
      }],
    };

    const state = simulateToEnd(level, grid);
    expect(state.failed).toBe(true);
    expect(state.failureReason).toContain('移出边界');
  });

  it('should detect same-cell collision', () => {
    const grid: Cell[][] = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => ({
        type: 'empty' as const,
        direction: null,
        editableDirection: false,
        editableWait: false,
      }))
    );

    const level: Level = {
      id: 999,
      name: 'Test',
      description: 'Test',
      gridSize: 5,
      editBudget: 0,
      maxTicks: 20,
      grid,
      packages: [
        {
          id: 'A',
          shape: 'circle',
          color: '#ff0000',
          spawn: { x: 0, y: 2 },
          destination: { x: 4, y: 2 },
          spawnTick: 0,
          direction: 'right',
        },
        {
          id: 'B',
          shape: 'square',
          color: '#00ff00',
          spawn: { x: 2, y: 0 },
          destination: { x: 2, y: 4 },
          spawnTick: 0,
          direction: 'down',
        },
      ],
    };

    const state = simulateToEnd(level, grid);
    expect(state.failed).toBe(true);
    expect(state.failureReason).toContain('碰撞');
  });

  it('should detect head-on collision', () => {
    const grid: Cell[][] = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => ({
        type: 'empty' as const,
        direction: null,
        editableDirection: false,
        editableWait: false,
      }))
    );

    const level: Level = {
      id: 999,
      name: 'Test',
      description: 'Test',
      gridSize: 5,
      editBudget: 0,
      maxTicks: 20,
      grid,
      packages: [
        {
          id: 'A',
          shape: 'circle',
          color: '#ff0000',
          spawn: { x: 1, y: 2 },
          destination: { x: 3, y: 2 },
          spawnTick: 0,
          direction: 'right',
        },
        {
          id: 'B',
          shape: 'square',
          color: '#00ff00',
          spawn: { x: 2, y: 2 },
          destination: { x: 0, y: 2 },
          spawnTick: 0,
          direction: 'left',
        },
      ],
    };

    const state = simulateToEnd(level, grid);
    expect(state.failed).toBe(true);
    expect(state.failureReason).toContain('迎面碰撞');
  });
});

describe('Simulation - Wait Mechanic', () => {
  it('should wait for one tick then resume', () => {
    const level = LEVELS[4]; // Level 5 uses wait
    const grid = applyEdits(level, level.solution!);
    
    let state = createInitialState(level);
    
    // Tick 0->1: Spawn and move - A moves to (1,2), B moves to (2,1)
    state = simulateStep(level, state, grid);
    expect(state.packages.get('A')?.pos).toEqual({ x: 1, y: 2 });
    expect(state.packages.get('B')?.pos).toEqual({ x: 2, y: 1 });
    // A hasn't entered wait yet - it will on next tick

    // Tick 1->2: A enters wait at (1,2), B moves to (2,2)
    state = simulateStep(level, state, grid);
    expect(state.packages.get('A')?.pos).toEqual({ x: 1, y: 2 }); // Waiting
    expect(state.packages.get('A')?.waitUntilTick).toBe(2);
    expect(state.packages.get('B')?.pos).toEqual({ x: 2, y: 2 });

    // Tick 2->3: A finishes wait and moves to (2,2), B continues
    state = simulateStep(level, state, grid);
    expect(state.packages.get('A')?.waitUntilTick).toBe(null);
    expect(state.packages.get('A')?.pos).toEqual({ x: 2, y: 2 });
  });
});

describe('Simulation - Direction Changes', () => {
  it('should follow direction cells', () => {
    const level = LEVELS[1]; // Level 2 with turns
    const grid = applyEdits(level, level.solution!);
    const state = simulateToEnd(level, grid);
    
    expect(state.won).toBe(true);
    expect(state.failed).toBe(false);
  });
});

describe('Simulation - Delayed Spawn', () => {
  it('should spawn package at delayed tick', () => {
    const level = LEVELS[5]; // Level 6 with delayed spawn
    let state = createInitialState(level);
    
    state = simulateStep(level, state, level.grid);
    expect(state.packages.has('A')).toBe(true);
    expect(state.packages.has('B')).toBe(false); // B spawns at tick 1

    state = simulateStep(level, state, level.grid);
    expect(state.packages.has('B')).toBe(true);
  });
});

describe('Edit Budget and Undo', () => {
  it('should apply edits correctly', () => {
    const level = LEVELS[1];
    const edits = level.solution!;
    const grid = applyEdits(level, edits);
    
    expect(grid[0][2].direction).toBe('down');
    expect(grid[2][2].direction).toBe('right');
  });

  it('should validate edit budget', () => {
    const level = LEVELS[1]; // Budget = 2
    const tooManyEdits = [
      { pos: { x: 0, y: 0 }, direction: 'right' as Direction },
      { pos: { x: 1, y: 0 }, direction: 'down' as Direction },
      { pos: { x: 2, y: 0 }, direction: 'left' as Direction },
    ];
    
    const result = validateSolution(level, tooManyEdits);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('超过预算');
  });
});

describe('Level Solutions', () => {
  it('should validate all level solutions', () => {
    for (const level of LEVELS) {
      if (level.solution) {
        const result = validateSolution(level, level.solution);
        expect(result.valid).toBe(true, `Level ${level.id} solution failed: ${result.reason}`);
      } else {
        // Level with no edits should still work
        const result = validateSolution(level, []);
        expect(result.valid).toBe(true, `Level ${level.id} no-edit solution failed: ${result.reason}`);
      }
    }
  });
});

describe('Win Conditions', () => {
  it('should win when all packages delivered', () => {
    const level = LEVELS[0];
    const state = simulateToEnd(level, level.grid);
    expect(state.won).toBe(true);
  });

  it('should not win if any package undelivered', () => {
    const grid: Cell[][] = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => ({
        type: 'empty' as const,
        direction: null,
        editableDirection: false,
        editableWait: false,
      }))
    );
    grid[2][2].type = 'wall'; // Block path

    const level: Level = {
      id: 999,
      name: 'Test',
      description: 'Test',
      gridSize: 5,
      editBudget: 0,
      maxTicks: 5,
      grid,
      packages: [{
        id: 'A',
        shape: 'circle',
        color: '#ff0000',
        spawn: { x: 0, y: 2 },
        destination: { x: 4, y: 2 },
        spawnTick: 0,
        direction: 'right',
      }],
    };

    const state = simulateToEnd(level, grid);
    expect(state.won).toBe(false);
    expect(state.failed).toBe(true);
  });
});

describe('Timeout', () => {
  it('should fail if max ticks exceeded', () => {
    const grid: Cell[][] = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => ({
        type: 'empty' as const,
        direction: 'wait' as Direction, // Everything waits forever
        editableDirection: false,
        editableWait: false,
      }))
    );

    const level: Level = {
      id: 999,
      name: 'Test',
      description: 'Test',
      gridSize: 5,
      editBudget: 0,
      maxTicks: 5,
      grid,
      packages: [{
        id: 'A',
        shape: 'circle',
        color: '#ff0000',
        spawn: { x: 0, y: 2 },
        destination: { x: 4, y: 2 },
        spawnTick: 0,
        direction: 'right',
      }],
    };

    const state = simulateToEnd(level, grid);
    expect(state.failed).toBe(true);
    expect(state.failureReason).toContain('超时');
  });
});
