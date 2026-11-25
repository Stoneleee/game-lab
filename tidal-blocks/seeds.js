export const SEEDS = [
  {
    id: 'intro',
    name: '第一潮',
    goal: 1,
    blurb: '先摆竖二，再看左潮把每行的松块挤到最左列。摆上去的时候不会消除。',
    board: [
      '.....o',
      '.....o',
      '.....o',
      '.....o',
      '......',
      '......',
    ],
    hands: [{ tide: 'left', pieces: ['i2v'] }],
  },
  {
    id: 'pockets',
    name: '锚点两边',
    goal: 1,
    blurb: '锚点不移动，并把这一行切成左右两段。右潮只在各自的一段里向右挤齐。',
    board: [
      'o.....',
      'o.....',
      'o.....',
      'o.....',
      'o.....',
      '..#...',
    ],
    hands: [{ tide: 'right', pieces: ['i2'] }],
  },
  {
    id: 'trio',
    name: '一手三块',
    goal: 2,
    blurb: '第一手要放完三块再涨左潮。清空之后，下一手换成右潮。',
    board: [
      '.....o',
      '.....o',
      '......',
      '......',
      '......',
      '......',
    ],
    hands: [
      { tide: 'left', pieces: ['dot', 'dot', 'i2v'] },
      { tide: 'right', pieces: ['i3v', 'i3v'] },
    ],
  },
  {
    id: 'tight',
    name: '窄港',
    goal: 1,
    blurb: '底行只有三个相连空位。单点若先占掉其中一格，横三就放不下，那是真死局。',
    board: [
      'o#.#..',
      '.o#.#.',
      '..o#.#',
      'o#..#.',
      '..o#..',
      '....#.',
    ],
    hands: [{ tide: 'left', pieces: ['i3', 'dot'] }],
  },
];

export const SOLUTIONS = {
  intro: [
    { op: 'place', shape: 'i2v', r: 4, c: 0 },
    { op: 'tide' },
  ],
  pockets: [
    { op: 'place', shape: 'i2', r: 5, c: 3 },
    { op: 'tide' },
  ],
  trio: [
    { op: 'place', shape: 'dot', r: 2, c: 0 },
    { op: 'place', shape: 'dot', r: 3, c: 2 },
    { op: 'place', shape: 'i2v', r: 4, c: 4 },
    { op: 'tide' },
    { op: 'place', shape: 'i3v', r: 0, c: 0 },
    { op: 'place', shape: 'i3v', r: 3, c: 2 },
    { op: 'tide' },
  ],
  tight: [
    { op: 'place', shape: 'dot', r: 4, c: 5 },
    { op: 'place', shape: 'i3', r: 5, c: 1 },
    { op: 'tide' },
  ],
};

export function seedById(id) {
  const seed = SEEDS.find((item) => item.id === id);
  if (!seed) throw new Error(`unknown seed ${id}`);
  return seed;
}
