// Four hand-authored gardens. Fans start one clockwise turn away from the
// easy reading, so the first tap shows the wind change before a seed is spent.

export const GARDENS = [
  {
    id: 'breeze',
    name: '顺风花床',
    coach: '点风机转到朝东。预览会改到花床，再播种。',
    width: 7,
    height: 5,
    beds: [{ x: 4, y: 2 }],
    stones: [],
    fans: [{ id: 'fan', name: '风机', x: 0, y: 2, dir: 'N', power: 4 }],
    seeds: { flower: 2, hedge: 1 },
    need: 1,
  },
  {
    id: 'bend',
    name: '灌木改道',
    coach: '左风机朝东种灌木。再把上风机转到朝南，花会绕到左边花床。',
    width: 8,
    height: 6,
    beds: [{ x: 0, y: 1 }],
    stones: [],
    fans: [
      { id: 'west', name: '左风机', x: 0, y: 2, dir: 'N', power: 4 },
      { id: 'north', name: '上风机', x: 4, y: 0, dir: 'E', power: 5 },
    ],
    seeds: { flower: 2, hedge: 2 },
    need: 1,
  },
  {
    id: 'fork',
    name: '两条花床',
    coach: '左小风机或右小风机朝南种一株灌木，主风会拐向不同的花床。回收可以换一条。',
    width: 8,
    height: 6,
    beds: [{ x: 1, y: 5 }, { x: 3, y: 5 }],
    stones: [],
    fans: [
      { id: 'main', name: '主风机', x: 0, y: 2, dir: 'N', power: 6 },
      { id: 'a', name: '左小风机', x: 2, y: 0, dir: 'E', power: 2 },
      { id: 'b', name: '右小风机', x: 4, y: 0, dir: 'E', power: 2 },
    ],
    seeds: { flower: 2, hedge: 2 },
    need: 1,
  },
  {
    id: 'free',
    name: '自由园',
    coach: '没有要完成的目标。种下的植物会改下一阵风，并留在这台设备上。',
    width: 8,
    height: 6,
    beds: [{ x: 2, y: 1 }, { x: 5, y: 2 }, { x: 3, y: 4 }],
    stones: [],
    fans: [
      { id: 'left', name: '左风机', x: 0, y: 2, dir: 'E', power: 5 },
      { id: 'right', name: '右风机', x: 7, y: 3, dir: 'W', power: 5 },
    ],
    seeds: { flower: 6, hedge: 4 },
    free: true,
    need: 0,
  },
];

export const SOLUTIONS = {
  breeze: [
    { op: 'rotate', fan: 'fan' },
    { op: 'sow', fan: 'fan', seed: 'flower' },
  ],
  bend: [
    { op: 'rotate', fan: 'west' },
    { op: 'sow', fan: 'west', seed: 'hedge' },
    { op: 'rotate', fan: 'north' },
    { op: 'sow', fan: 'north', seed: 'flower' },
  ],
  forkA: [
    { op: 'rotate', fan: 'main' },
    { op: 'rotate', fan: 'a' },
    { op: 'sow', fan: 'a', seed: 'hedge' },
    { op: 'sow', fan: 'main', seed: 'flower' },
  ],
  forkB: [
    { op: 'rotate', fan: 'main' },
    { op: 'rotate', fan: 'b' },
    { op: 'sow', fan: 'b', seed: 'hedge' },
    { op: 'sow', fan: 'main', seed: 'flower' },
  ],
};

export function gardenById(id) {
  return GARDENS.find((garden) => garden.id === id) || GARDENS[0];
}
