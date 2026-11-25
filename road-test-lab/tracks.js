// Three short yards. Slot entry heights stay put when a block is rotated or
// replaced, so a later landing deck does not jump with the edit.
// Piece numbers in the hints are 1-based.

const slot = (type, rot, editable, entry) => ({ type, rot, editable, entry });

export const TRACKS = [
  {
    id: 'lip',
    name: '弹板方向',
    hint: '按住油门。朝下的弹板会把车掀翻，转成朝上才能跃过缺口。失败后只能改一段。',
    solution: '旋转第 3 段弹板，让坡朝上，然后一直按住油门直到终点旗。',
    startY: 2.5,
    finish: { index: 5, t: 0.48 },
    pieces: [
      slot('flat', 0, false, 2.5),
      slot('flat', 0, true, 2.5),
      slot('kicker', 1, true, 2.5),
      slot('gap', 0, false, 2.5),
      slot('flat', 0, false, 2.5),
      slot('flat', 0, false, 2.5),
    ],
  },
  {
    id: 'wall',
    name: '陡坎',
    hint: '车头磕在陡坎上。换成缓坡才能开上平台，油门要按住。',
    solution: '把第 3 段陡坡替换成缓坡，按住油门开到终点旗。',
    startY: 1.6,
    finish: { index: 5, t: 0.55 },
    pieces: [
      slot('flat', 0, false, 1.6),
      slot('flat', 0, true, 1.6),
      slot('steep', 0, true, 1.6),
      slot('flat', 0, false, 3.3),
      slot('flat', 0, false, 3.3),
      slot('flat', 0, false, 3.3),
    ],
  },
  {
    id: 'window',
    name: '油门窗口',
    hint: '把缓坡转到朝下，车才能落到低处的甲板。油门太大，车会从坡顶飞出去。',
    solution: '旋转第 4 段缓坡，使它朝下。按住油门加速，在坡顶前松开，顺着坡开到终点旗。',
    startY: 3.4,
    finish: { index: 5, t: 0.45 },
    pieces: [
      slot('flat', 0, false, 3.4),
      slot('flat', 0, false, 3.4),
      slot('flat', 0, true, 3.4),
      slot('ramp', 0, true, 3.4),
      slot('flat', 0, false, 1.7),
      slot('flat', 0, false, 1.7),
    ],
  },
];
