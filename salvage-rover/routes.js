// Three hand-built routes. Each step is one fixed simulation tick.
// grade is the height gained on that step. Surface is firm or mud.
// pickup is how many supply crates sit on that step.

export const ROUTES = [
  {
    id: 'yard',
    name: '坡底试车',
    goal: 1,
    supply: 1,
    blurb: '缓坡。先看车头会不会抬起来。',
    steps: expand([
      { n: 2, grade: 0, surface: 'firm' },
      { n: 4, grade: 1, surface: 'firm' },
      { n: 1, grade: 0, surface: 'firm', pickup: 1 },
      { n: 2, grade: 0, surface: 'firm' },
    ]),
  },
  {
    id: 'steep',
    name: '陡坡减载',
    goal: 2,
    supply: 3,
    blurb: '先装货，再爬陡坡。装满会把电耗尽。',
    steps: expand([
      { n: 3, grade: 0, surface: 'firm' },
      { n: 1, grade: 0, surface: 'firm', pickup: 3 },
      { n: 4, grade: 2, surface: 'firm' },
      { n: 2, grade: 0, surface: 'firm' },
    ]),
  },
  {
    id: 'mud',
    name: '软地回运',
    goal: 2,
    supply: 3,
    blurb: '软地要宽履。宽履很重，装满一样爬不完。',
    steps: expand([
      { n: 2, grade: 0, surface: 'firm' },
      { n: 4, grade: 0, surface: 'mud' },
      { n: 1, grade: 0, surface: 'firm', pickup: 3 },
      { n: 3, grade: 1, surface: 'firm' },
      { n: 2, grade: 0, surface: 'firm' },
    ]),
  },
];

export function routeById(id) {
  const route = ROUTES.find((item) => item.id === id);
  if (!route) throw new Error(`unknown route ${id}`);
  return route;
}

export function profileOf(route) {
  const points = [{ x: 0, y: 0 }];
  let y = 0;
  route.steps.forEach((step, index) => {
    y += step.grade;
    points.push({ x: index + 1, y });
  });
  return points;
}

function expand(segments) {
  const steps = [];
  for (const segment of segments) {
    for (let i = 0; i < segment.n; i += 1) {
      steps.push({
        grade: segment.grade,
        surface: segment.surface,
        pickup: i === 0 ? segment.pickup || 0 : 0,
      });
    }
  }
  return steps;
}
