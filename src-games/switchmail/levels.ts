import { Level, Cell, Package } from './game';

// Helper to create empty grid
function createGrid(size: number): Cell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({
      type: 'empty' as const,
      direction: null,
      editableDirection: false,
      editableWait: false,
    }))
  );
}

export const LEVELS: Level[] = [
  // Level 1: 放手试跑 - No edits needed
  {
    id: 1,
    name: '放手试跑',
    description: '点击"运行"观看包裹自动送达',
    gridSize: 5,
    editBudget: 0,
    maxTicks: 20,
    grid: (() => {
      const g = createGrid(5);
      g[2][0].type = 'spawn';
      g[2][0].packageId = 'A';
      g[2][4].type = 'destination';
      g[2][4].packageId = 'A';
      return g;
    })(),
    packages: [
      {
        id: 'A',
        shape: 'circle',
        color: '#ff6b6b',
        spawn: { x: 0, y: 2 },
        destination: { x: 4, y: 2 },
        spawnTick: 0,
        direction: 'right',
      },
    ],
  },

  // Level 2: 拐弯到站
  {
    id: 2,
    name: '拐弯到站',
    description: '放置方向箭头引导包裹转弯',
    gridSize: 5,
    editBudget: 2,
    maxTicks: 20,
    grid: (() => {
      const g = createGrid(5);
      g[0][0].type = 'spawn';
      g[0][0].packageId = 'A';
      g[2][4].type = 'destination';
      g[2][4].packageId = 'A';
      g[0][3].type = 'wall';
      g[0][2].editableDirection = true;
      g[2][2].editableDirection = true;
      return g;
    })(),
    packages: [
      {
        id: 'A',
        shape: 'circle',
        color: '#ff6b6b',
        spawn: { x: 0, y: 0 },
        destination: { x: 4, y: 2 },
        spawnTick: 0,
        direction: 'right',
      },
    ],
    solution: [
      { pos: { x: 2, y: 0 }, direction: 'down' },
      { pos: { x: 2, y: 2 }, direction: 'right' },
    ],
  },

  // Level 3: 修坏路标
  {
    id: 3,
    name: '修坏路标',
    description: '找到错误的路标并修正',
    gridSize: 5,
    editBudget: 1,
    maxTicks: 20,
    grid: (() => {
      const g = createGrid(5);
      g[0][0].type = 'spawn';
      g[0][0].packageId = 'A';
      g[2][4].type = 'destination';
      g[2][4].packageId = 'A';
      g[0][3].type = 'wall';
      g[0][2].editableDirection = true;
      g[0][2].direction = 'down'; // Correct
      g[2][2].editableDirection = true;
      g[2][2].direction = 'left'; // Wrong! Should be right
      return g;
    })(),
    packages: [
      {
        id: 'A',
        shape: 'circle',
        color: '#ff6b6b',
        spawn: { x: 0, y: 0 },
        destination: { x: 4, y: 2 },
        spawnTick: 0,
        direction: 'right',
      },
    ],
    solution: [{ pos: { x: 2, y: 2 }, direction: 'right' }],
  },

  // Level 4: 保留正确部分
  {
    id: 4,
    name: '保留正确部分',
    description: '不要改动已经正确的路标',
    gridSize: 5,
    editBudget: 1,
    maxTicks: 20,
    grid: (() => {
      const g = createGrid(5);
      g[0][0].type = 'spawn';
      g[0][0].packageId = 'A';
      g[2][4].type = 'destination';
      g[2][4].packageId = 'A';
      g[0][3].type = 'wall';
      g[0][1].editableDirection = true; // Extra editable but not needed
      g[0][2].editableDirection = true;
      g[0][2].direction = 'down'; // Correct
      g[2][2].editableDirection = true;
      g[2][2].direction = 'left'; // Wrong
      return g;
    })(),
    packages: [
      {
        id: 'A',
        shape: 'circle',
        color: '#ff6b6b',
        spawn: { x: 0, y: 0 },
        destination: { x: 4, y: 2 },
        spawnTick: 0,
        direction: 'right',
      },
    ],
    solution: [{ pos: { x: 2, y: 2 }, direction: 'right' }],
  },

  // Level 5: 同拍碰撞
  {
    id: 5,
    name: '同拍碰撞',
    description: '使用等待标记避免包裹碰撞',
    gridSize: 5,
    editBudget: 1,
    maxTicks: 20,
    grid: (() => {
      const g = createGrid(5);
      g[2][0].type = 'spawn';
      g[2][0].packageId = 'A';
      g[2][4].type = 'destination';
      g[2][4].packageId = 'A';
      g[0][2].type = 'spawn';
      g[0][2].packageId = 'B';
      g[4][2].type = 'destination';
      g[4][2].packageId = 'B';
      g[2][1].editableWait = true;
      g[2][1].editableDirection = false;
      return g;
    })(),
    packages: [
      {
        id: 'A',
        shape: 'circle',
        color: '#ff6b6b',
        spawn: { x: 0, y: 2 },
        destination: { x: 4, y: 2 },
        spawnTick: 0,
        direction: 'right',
      },
      {
        id: 'B',
        shape: 'square',
        color: '#4ecdc4',
        spawn: { x: 2, y: 0 },
        destination: { x: 2, y: 4 },
        spawnTick: 0,
        direction: 'down',
      },
    ],
    solution: [{ pos: { x: 1, y: 2 }, direction: 'wait' }],
  },

  // Level 6: 不要过度干预
  {
    id: 6,
    name: '不要过度干预',
    description: '有时不编辑就是最好的解法',
    gridSize: 5,
    editBudget: 0,
    maxTicks: 20,
    grid: (() => {
      const g = createGrid(5);
      g[2][0].type = 'spawn';
      g[2][0].packageId = 'A';
      g[2][4].type = 'destination';
      g[2][4].packageId = 'A';
      g[0][2].type = 'spawn';
      g[0][2].packageId = 'B';
      g[4][2].type = 'destination';
      g[4][2].packageId = 'B';
      return g;
    })(),
    packages: [
      {
        id: 'A',
        shape: 'circle',
        color: '#ff6b6b',
        spawn: { x: 0, y: 2 },
        destination: { x: 4, y: 2 },
        spawnTick: 0,
        direction: 'right',
      },
      {
        id: 'B',
        shape: 'square',
        color: '#4ecdc4',
        spawn: { x: 2, y: 0 },
        destination: { x: 2, y: 4 },
        spawnTick: 1, // Delayed by 1 tick
        direction: 'down',
      },
    ],
    solution: [],
  },

  // Level 7: 空间换时间
  {
    id: 7,
    name: '空间换时间',
    description: '通过绕路避免碰撞',
    gridSize: 5,
    editBudget: 4,
    maxTicks: 20,
    grid: (() => {
      const g = createGrid(5);
      g[2][0].type = 'spawn';
      g[2][0].packageId = 'A';
      g[2][4].type = 'destination';
      g[2][4].packageId = 'A';
      g[0][2].type = 'spawn';
      g[0][2].packageId = 'B';
      g[4][2].type = 'destination';
      g[4][2].packageId = 'B';
      g[2][1].editableDirection = true;
      g[1][1].editableDirection = true;
      g[1][3].editableDirection = true;
      g[2][3].editableDirection = true;
      return g;
    })(),
    packages: [
      {
        id: 'A',
        shape: 'circle',
        color: '#ff6b6b',
        spawn: { x: 0, y: 2 },
        destination: { x: 4, y: 2 },
        spawnTick: 0,
        direction: 'right',
      },
      {
        id: 'B',
        shape: 'square',
        color: '#4ecdc4',
        spawn: { x: 2, y: 0 },
        destination: { x: 2, y: 4 },
        spawnTick: 0,
        direction: 'down',
      },
    ],
    solution: [
      { pos: { x: 1, y: 2 }, direction: 'up' },
      { pos: { x: 1, y: 1 }, direction: 'right' },
      { pos: { x: 3, y: 1 }, direction: 'down' },
      { pos: { x: 3, y: 2 }, direction: 'right' },
    ],
  },

  // Level 8: 一个规则服务两件
  {
    id: 8,
    name: '一个规则服务两件',
    description: '共享的路标会影响所有经过的包裹',
    gridSize: 5,
    editBudget: 1,
    maxTicks: 20,
    grid: (() => {
      const g = createGrid(5);
      g[2][0].type = 'spawn';
      g[2][0].packageId = 'A';
      g[2][4].type = 'destination';
      g[2][4].packageId = 'A';
      g[0][2].type = 'spawn';
      g[0][2].packageId = 'B';
      g[2][4].type = 'destination';
      g[2][4].packageId = 'B';
      g[2][2].editableDirection = true;
      g[2][2].direction = 'down'; // Initially wrong for A
      return g;
    })(),
    packages: [
      {
        id: 'A',
        shape: 'circle',
        color: '#ff6b6b',
        spawn: { x: 0, y: 2 },
        destination: { x: 4, y: 2 },
        spawnTick: 0,
        direction: 'right',
      },
      {
        id: 'B',
        shape: 'square',
        color: '#4ecdc4',
        spawn: { x: 2, y: 0 },
        destination: { x: 4, y: 2 },
        spawnTick: 3, // Delayed
        direction: 'down',
      },
    ],
    solution: [{ pos: { x: 2, y: 2 }, direction: 'right' }],
  },

  // Level 9: 桥有方向
  {
    id: 9,
    name: '桥有方向',
    description: '某些通道只能单向通行',
    gridSize: 5,
    editBudget: 5,
    maxTicks: 20,
    grid: (() => {
      const g = createGrid(5);
      g[2][0].type = 'spawn';
      g[2][0].packageId = 'A';
      g[2][4].type = 'destination';
      g[2][4].packageId = 'A';
      g[0][2].type = 'spawn';
      g[0][2].packageId = 'B';
      g[4][2].type = 'destination';
      g[4][2].packageId = 'B';
      // Bridge cells (restricted)
      g[2][2].type = 'empty'; // Center - only horizontal allowed
      g[2][1].editableWait = true;
      g[1][2].editableDirection = true;
      g[1][3].editableDirection = true;
      g[3][3].editableDirection = true;
      g[3][2].editableDirection = true;
      return g;
    })(),
    packages: [
      {
        id: 'A',
        shape: 'circle',
        color: '#ff6b6b',
        spawn: { x: 0, y: 2 },
        destination: { x: 4, y: 2 },
        spawnTick: 0,
        direction: 'right',
      },
      {
        id: 'B',
        shape: 'square',
        color: '#4ecdc4',
        spawn: { x: 2, y: 0 },
        destination: { x: 2, y: 4 },
        spawnTick: 0,
        direction: 'down',
      },
    ],
    solution: [
      { pos: { x: 1, y: 2 }, direction: 'wait' },
      { pos: { x: 2, y: 1 }, direction: 'right' },
      { pos: { x: 3, y: 1 }, direction: 'down' },
      { pos: { x: 3, y: 3 }, direction: 'left' },
      { pos: { x: 2, y: 3 }, direction: 'down' },
    ],
  },

  // Level 10: 综合考试
  {
    id: 10,
    name: '综合考试',
    description: '运用所学知识完成最终挑战',
    gridSize: 5,
    editBudget: 2,
    maxTicks: 20,
    grid: (() => {
      const g = createGrid(5);
      g[2][0].type = 'spawn';
      g[2][0].packageId = 'A';
      g[2][4].type = 'destination';
      g[2][4].packageId = 'A';
      g[0][2].type = 'spawn';
      g[0][2].packageId = 'B';
      g[4][2].type = 'destination';
      g[4][2].packageId = 'B';
      g[1][1].type = 'wall';
      g[3][3].type = 'wall';
      g[2][1].editableDirection = true;
      g[2][1].direction = 'up'; // Wrong
      g[2][3].editableDirection = true;
      g[2][3].direction = 'right'; // Wrong
      return g;
    })(),
    packages: [
      {
        id: 'A',
        shape: 'circle',
        color: '#ff6b6b',
        spawn: { x: 0, y: 2 },
        destination: { x: 4, y: 2 },
        spawnTick: 0,
        direction: 'right',
      },
      {
        id: 'B',
        shape: 'square',
        color: '#4ecdc4',
        spawn: { x: 2, y: 0 },
        destination: { x: 2, y: 4 },
        spawnTick: 0,
        direction: 'down',
      },
    ],
    solution: [
      { pos: { x: 1, y: 2 }, direction: 'wait' },
      { pos: { x: 2, y: 3 }, direction: 'down' },
    ],
  },
];
