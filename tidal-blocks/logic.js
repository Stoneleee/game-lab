export const SIZE = 6;

export const SHAPES = {
  dot: { id: 'dot', name: '单点', cells: [[0, 0]] },
  i2: { id: 'i2', name: '横二', cells: [[0, 0], [0, 1]] },
  i2v: { id: 'i2v', name: '竖二', cells: [[0, 0], [1, 0]] },
  i3: { id: 'i3', name: '横三', cells: [[0, 0], [0, 1], [0, 2]] },
  i3v: { id: 'i3v', name: '竖三', cells: [[0, 0], [1, 0], [2, 0]] },
  l3: { id: 'l3', name: '拐三', cells: [[0, 0], [1, 0], [1, 1]] },
};

const TIDES = new Set(['left', 'right']);

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

export function boardToText(board) {
  return board.map((row) => row.join('')).join('\n');
}

export function parseBoard(rows) {
  if (!Array.isArray(rows) || rows.length !== SIZE) throw new Error('board must have 6 rows');
  return rows.map((row, r) => {
    if (typeof row !== 'string' || row.length !== SIZE) throw new Error(`bad row ${r}`);
    const cells = row.split('');
    for (const cell of cells) {
      if (cell !== '.' && cell !== 'o' && cell !== '#') throw new Error(`bad cell ${cell}`);
    }
    return cells;
  });
}

export function fits(board, shape, r, c) {
  for (const [dr, dc] of shape.cells) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE) return false;
    if (board[rr][cc] !== '.') return false;
  }
  return true;
}

export function placementsFor(board, shapeId) {
  const shape = SHAPES[shapeId];
  if (!shape) return [];
  const found = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (fits(board, shape, r, c)) found.push([r, c]);
    }
  }
  return found;
}

export function compress(board, tide) {
  if (!TIDES.has(tide)) throw new Error(`unknown tide ${tide}`);
  const next = cloneBoard(board);
  for (let r = 0; r < SIZE; r += 1) {
    const row = next[r];
    let c = 0;
    while (c < SIZE) {
      if (row[c] === '#') {
        c += 1;
        continue;
      }
      const start = c;
      while (c < SIZE && row[c] !== '#') c += 1;
      const end = c;
      let count = 0;
      for (let i = start; i < end; i += 1) if (row[i] === 'o') count += 1;
      for (let i = start; i < end; i += 1) if (row[i] === 'o') row[i] = '.';
      const origin = tide === 'left' ? start : end - count;
      for (let k = 0; k < count; k += 1) row[origin + k] = 'o';
    }
  }
  return next;
}

function lineCounts(cells) {
  let loose = 0;
  let empty = 0;
  for (const cell of cells) {
    if (cell === 'o') loose += 1;
    else if (cell === '.') empty += 1;
  }
  return { loose, empty };
}

export function fullLines(board) {
  const rows = [];
  const cols = [];
  for (let r = 0; r < SIZE; r += 1) {
    const count = lineCounts(board[r]);
    if (count.empty === 0 && count.loose > 0) rows.push(r);
  }
  for (let c = 0; c < SIZE; c += 1) {
    const cells = [];
    for (let r = 0; r < SIZE; r += 1) cells.push(board[r][c]);
    const count = lineCounts(cells);
    if (count.empty === 0 && count.loose > 0) cols.push(c);
  }
  return { rows, cols };
}

export function clearLines(board, lines) {
  const next = cloneBoard(board);
  const rowSet = new Set(lines.rows);
  const colSet = new Set(lines.cols);
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (rowSet.has(r) || colSet.has(c)) next[r][c] = '.';
    }
  }
  return next;
}

export function lineScore(lineCount) {
  if (lineCount <= 0) return 0;
  return lineCount * 100 + (lineCount >= 2 ? 50 : 0);
}

function looseCount(board) {
  let n = 0;
  for (const row of board) for (const cell of row) if (cell === 'o') n += 1;
  return n;
}

function movedLoose(before, after) {
  let n = 0;
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (before[r][c] === 'o' && after[r][c] !== 'o') n += 1;
    }
  }
  return n;
}

export function tidePlan(board, tide) {
  const compressed = compress(board, tide);
  const lines = fullLines(compressed);
  const cleared = clearLines(compressed, lines);
  const lineCount = lines.rows.length + lines.cols.length;
  const before = fullLines(board);
  const already = new Set([...before.rows.map((r) => `r${r}`), ...before.cols.map((c) => `c${c}`)]);
  const freshRows = lines.rows.filter((r) => !already.has(`r${r}`));
  const freshCols = lines.cols.filter((c) => !already.has(`c${c}`));
  return {
    tide,
    compressed,
    lines,
    cleared,
    lineCount,
    gained: lineScore(lineCount),
    moved: movedLoose(board, compressed),
    looseBefore: looseCount(board),
    freshRows,
    freshCols,
  };
}

function pieceNames(ids) {
  const counts = new Map();
  for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
  return [...counts.entries()].map(([id, n]) => {
    const name = SHAPES[id].name;
    return n > 1 ? `${n} 个「${name}」` : `「${name}」`;
  }).join('、');
}

export function stuckPieces(board, remaining) {
  if (!remaining.length) return [];
  const seen = new Set();
  const stuck = [];
  for (const id of remaining) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (placementsFor(board, id).length === 0) stuck.push(id);
  }
  return stuck;
}

export function deadlockReason(board, remaining) {
  if (!remaining.length) return '';
  const stuck = stuckPieces(board, remaining);
  const unique = new Set(remaining);
  if (stuck.length !== unique.size) return '';
  return `死局。剩下的${pieceNames(remaining)}在当前棋盘没有放得下的空位。上一步把出口堵住了，可撤销或重开。`;
}

function capture(state) {
  return {
    seedId: state.seedId,
    goal: state.goal,
    hands: state.hands,
    board: cloneBoard(state.board),
    handIndex: state.handIndex,
    remaining: state.remaining.slice(),
    phase: state.phase,
    score: state.score,
    lines: state.lines,
    deadReason: state.deadReason,
    last: state.last,
  };
}

function withHistory(state, fields) {
  return {
    ...capture(state),
    ...fields,
    board: fields.board ? cloneBoard(fields.board) : cloneBoard(state.board),
    remaining: fields.remaining ? fields.remaining.slice() : state.remaining.slice(),
    undoStack: [...state.undoStack, capture(state)],
  };
}

export function createRun(seed) {
  const board = parseBoard(seed.board);
  if (!seed.hands?.length) throw new Error(`${seed.id} has no hands`);
  for (const hand of seed.hands) {
    if (!TIDES.has(hand.tide)) throw new Error(`${seed.id} bad tide`);
    if (!hand.pieces?.length) throw new Error(`${seed.id} empty hand`);
    for (const id of hand.pieces) if (!SHAPES[id]) throw new Error(`${seed.id} bad piece ${id}`);
  }
  const before = fullLines(board);
  if (before.rows.length || before.cols.length) {
    throw new Error(`${seed.id} starts with a full line`);
  }
  const remaining = seed.hands[0].pieces.slice();
  const deadReason = deadlockReason(board, remaining);
  return {
    seedId: seed.id,
    goal: seed.goal,
    hands: seed.hands,
    board,
    handIndex: 0,
    remaining,
    phase: deadReason ? 'dead' : 'place',
    score: 0,
    lines: 0,
    deadReason,
    last: null,
    undoStack: [],
  };
}

export function currentTide(state) {
  return state.hands[state.handIndex].tide;
}

export function place(state, shapeId, r, c) {
  if (state.phase !== 'place') return { ok: false, state, reason: '现在不能摆块' };
  if (!state.remaining.includes(shapeId)) return { ok: false, state, reason: '手里没有这块' };
  const shape = SHAPES[shapeId];
  if (!shape) return { ok: false, state, reason: '没有这种形状' };
  if (!Number.isInteger(r) || !Number.isInteger(c) || !fits(state.board, shape, r, c)) {
    return { ok: false, state, reason: '这个格子放不下这块。点空位，形状会从该格向右、向下铺开。' };
  }
  const board = cloneBoard(state.board);
  for (const [dr, dc] of shape.cells) board[r + dr][c + dc] = 'o';
  const remaining = state.remaining.slice();
  remaining.splice(remaining.indexOf(shapeId), 1);
  let phase = remaining.length === 0 ? 'ready' : 'place';
  const deadReason = phase === 'place' ? deadlockReason(board, remaining) : '';
  if (deadReason) phase = 'dead';
  const next = withHistory(state, { board, remaining, phase, deadReason, last: null });
  return { ok: true, state: next, reason: '' };
}

export function planCurrentTide(state) {
  if (state.phase !== 'ready') return { ok: false, reason: '这一手还没摆完' };
  return { ok: true, ...tidePlan(state.board, currentTide(state)) };
}

function endPhase(lines, goal) {
  return lines >= goal ? 'won' : 'short';
}

export function commitTide(state) {
  const plan = planCurrentTide(state);
  if (!plan.ok) return { ok: false, state, reason: plan.reason, plan: null };
  const score = state.score + plan.gained;
  const lines = state.lines + plan.lineCount;
  const last = {
    kind: 'tide',
    tide: plan.tide,
    moved: plan.moved,
    rows: plan.lines.rows.slice(),
    cols: plan.lines.cols.slice(),
    freshRows: plan.freshRows.slice(),
    freshCols: plan.freshCols.slice(),
    gained: plan.gained,
    lineCount: plan.lineCount,
  };
  const handIndex = state.handIndex + 1;
  if (handIndex >= state.hands.length) {
    const next = withHistory(state, {
      board: plan.cleared,
      remaining: [],
      phase: endPhase(lines, state.goal),
      score,
      lines,
      deadReason: '',
      last,
    });
    return { ok: true, state: next, reason: '', plan };
  }
  const remaining = state.hands[handIndex].pieces.slice();
  const deadReason = deadlockReason(plan.cleared, remaining);
  const next = withHistory(state, {
    board: plan.cleared,
    handIndex,
    remaining,
    phase: deadReason ? 'dead' : 'place',
    score,
    lines,
    deadReason,
    last,
  });
  return { ok: true, state: next, reason: '', plan };
}

export function undo(state) {
  if (!state.undoStack.length) return { ok: false, state, reason: '没有可撤销的步骤' };
  const prev = state.undoStack[state.undoStack.length - 1];
  const undoStack = state.undoStack.slice(0, -1);
  return {
    ok: true,
    state: {
      ...capture(prev),
      undoStack,
    },
    reason: '',
  };
}

export function tideLabel(tide) {
  return tide === 'left' ? '左潮' : '右潮';
}

export function describeTide(last) {
  if (!last || last.kind !== 'tide') return '';
  const dir = tideLabel(last.tide);
  const names = [];
  for (const r of last.rows) names.push(`第 ${r + 1} 行`);
  for (const c of last.cols) names.push(`第 ${c + 1} 列`);
  const fresh = last.freshRows.length + last.freshCols.length;
  if (last.lineCount > 0 && last.moved > 0 && fresh > 0) {
    return `${dir}先把 ${last.moved} 块挤到新位置，棋盘因此排满，消去${names.join('、')}。`;
  }
  if (last.lineCount > 0 && last.moved > 0) {
    return `${dir}挤动了 ${last.moved} 块，并消去已经排满的${names.join('、')}。`;
  }
  if (last.lineCount > 0) {
    return `这一潮没有空位可挤，消去已经排满的${names.join('、')}。`;
  }
  if (last.moved > 0) {
    return `${dir}把 ${last.moved} 块挤齐了，但没有行或列排满。`;
  }
  return `${dir}没有改变棋盘，也没有消去。`;
}
