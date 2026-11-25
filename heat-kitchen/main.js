import { BURNER, INGREDIENTS, band, rateTable, shareGroups } from './heat.js';
import {
  GOAL,
  REASONS,
  RULE,
  RULE_SHORT,
  createShift,
  createTutorial,
  currentOrder,
  discard,
  forecastMove,
  forecastPlace,
  hold,
  move,
  nextOrder,
  pause,
  place,
  restart,
  resume,
  serve,
  success,
  tick,
} from './game.js';

const $ = (id) => document.getElementById(id);
const pan = $('pan');
const ghost = $('ghost');

let game = createTutorial();
let selected = null;
let auto = true;
let soundOn = false;
let audioCtx = null;
let overlayKind = '';
let restartArm = 0;
const pointer = { active: false, id: null, from: null, moved: false, x: 0, y: 0 };

document.getElementById('tagline').textContent = RULE_SHORT;
$('rule').textContent = RULE;

function tone(freq, dur = 0.08, type = 'sine', volume = 0.05) {
  if (!soundOn || !audioCtx) return;
  const start = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + dur);
}

function narrate(prev, next) {
  if (next.mode !== 'shift' || next.phase !== 'play' || next.tickCount === prev.tickCount) return;
  for (const food of next.foods) {
    const old = prev.foods.find((item) => item.id === food.id);
    if (!old) continue;
    const before = band(old.kind, old.temp);
    const after = band(food.kind, food.temp);
    if (before === after) continue;
    const name = INGREDIENTS[food.kind].name;
    if (after === 'perfect') next.notice = { tone: 'good', text: `${name}正好，可以出餐。` };
    else if (after === 'over') next.notice = { tone: 'warn', text: `${name}过火了，快端走或挪到冷格。` };
    else if (after === 'burnt') next.notice = { tone: 'bad', text: `${name}糊了。` };
    else if (after === 'ready' && before === 'raw') next.notice = { tone: 'info', text: `${name}熟了，再等一点就是正好。` };
  }
}

function cue(prev, next) {
  if (!soundOn) return;
  for (const food of next.foods) {
    const old = prev.foods.find((item) => item.id === food.id);
    const before = old ? band(old.kind, old.temp) : '';
    const after = band(food.kind, food.temp);
    if (before !== after && after === 'perfect') tone(740, 0.12);
    if (before !== after && after === 'burnt') tone(170, 0.18, 'triangle');
  }
  if (prev.phase === 'play' && next.phase === 'result') {
    if (success(next)) {
      tone(523, 0.1);
      tone(784, 0.16);
    } else tone(196, 0.22, 'triangle');
  }
}

function commit(result) {
  const prev = game;
  if (result && typeof result.ok === 'boolean') {
    if (result.ok) {
      game = result.state;
      if (game.foods.length > prev.foods.length) tone(520, 0.05);
      if ((game.serveLog?.length || 0) > (prev.serveLog?.length || 0)) {
        const last = game.serveLog.at(-1);
        tone(last.points >= 2 ? 760 : 240, 0.1, last.points >= 2 ? 'sine' : 'triangle');
      }
    } else {
      game = structuredClone(result.state);
      game.notice = { tone: 'warn', text: REASONS[result.reason] || '不能这么做。' };
      tone(210, 0.09, 'triangle');
    }
  } else {
    game = result;
  }
  cue(prev, game);
  paint();
}

function stepOnce() {
  const prev = game;
  game = tick(game);
  narrate(prev, game);
  cue(prev, game);
  paint();
}

function serveTarget() {
  if (selected?.type === 'food') return selected.id;
  if (game.mode === 'tutorial' && game.step === 'serve' && game.foods[0]) return game.foods[0].id;
  return null;
}

function mood() {
  if (game.phase === 'result') return success(game) ? 'happy' : 'gone';
  if (game.foods.some((food) => band(food.kind, food.temp) === 'burnt')) return 'worry';
  if (game.mode === 'shift' && game.patienceMax && game.patience / game.patienceMax < 0.28) return 'worry';
  if (game.notice?.tone === 'good') return 'happy';
  return 'calm';
}

function forecastFor(r, c) {
  if (game.phase !== 'play') return null;
  if (selected?.type === 'kind') {
    if (game.mode === 'tutorial' && (game.step !== 'place' || BURNER[r][c] < 4)) return null;
    return forecastPlace(game, selected.kind, r, c);
  }
  if (selected?.type === 'food' && game.mode === 'shift') return forecastMove(game, selected.id, r, c);
  return null;
}

function paintCells() {
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      const cell = pan.querySelector(`[data-cell="${r},${c}"]`);
      const view = forecastFor(r, c);
      const occupied = game.foods.some((food) => food.place === 'pan' && food.r === r && food.c === c);
      cell.classList.toggle('warm', game.residue[r * 4 + c] > 0.35);
      cell.classList.toggle('hint', game.mode === 'tutorial' && game.step === 'place' && BURNER[r][c] >= 4);
      cell.classList.toggle('blocked', game.mode === 'tutorial' && game.step === 'place' && BURNER[r][c] < 4);
      const slow = view?.changes?.some((change) => change.after < change.before - 0.05);
      const fast = view?.changes?.some((change) => change.after > change.before + 0.05);
      const mark = slow ? '↓' : fast ? '↑' : '';
      const forecast = view && !occupied ? `<span class="fc">+${view.gain.toFixed(1)}${mark}</span>` : '';
      cell.innerHTML = `<span class="bn">${BURNER[r][c]}</span>${forecast}`;
      const bits = [`第${r + 1}行第${c + 1}列`, `底火 ${BURNER[r][c]}`];
      if (view && !occupied) bits.push(`放下后每拍 +${view.gain.toFixed(1)}`);
      if (slow) bits.push('会让锅里的菜变慢');
      if (fast) bits.push('会让旁边的菜变快');
      cell.setAttribute('aria-label', bits.join('，'));
    }
  }
}

function tokenButton(food) {
  let el = pan.querySelector(`.token[data-id="${food.id}"]`);
  if (!el) {
    el = document.createElement('button');
    el.type = 'button';
    el.className = 'token';
    el.dataset.id = String(food.id);
    pan.appendChild(el);
  }
  return el;
}

function paintFoods() {
  const groups = shareGroups(game);
  const rates = rateTable(game);
  const seen = new Set();
  const draggingId = pointer.active && pointer.moved && pointer.from?.type === 'food' ? pointer.from.id : null;
  for (const food of game.foods) {
    if (food.place !== 'pan') continue;
    seen.add(food.id);
    const el = tokenButton(food);
    const taste = band(food.kind, food.temp);
    el.dataset.kind = food.kind;
    el.dataset.band = taste;
    el.dataset.temp = String(food.temp);
    el.dataset.gain = String(rates[food.id]);
    el.dataset.share = String(groups[food.id] || 0);
    el.classList.toggle('picked', selected?.type === 'food' && selected.id === food.id && food.id !== draggingId);
    el.setAttribute('aria-label', `${INGREDIENTS[food.kind].name} ${taste === 'perfect' ? '正好' : taste === 'ready' ? '熟了' : taste === 'over' ? '过火' : taste === 'burnt' ? '糊了' : '生'}`);
    const width = Math.max(4, Math.min(100, (food.temp / INGREDIENTS[food.kind].burn) * 100));
    el.innerHTML = `<span class="tag">${el.getAttribute('aria-label').split(' ')[1]}</span><span class="rate">+${rates[food.id].toFixed(1)}</span><span class="meter"><i style="width:${width}%"></i></span>`;
    if (food.id === draggingId) continue;
    const cell = pan.querySelector(`[data-cell="${food.r},${food.c}"]`);
    const panRect = pan.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const size = Math.max(36, cellRect.width * 0.62);
    el.classList.remove('drag');
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${cellRect.left - panRect.left + (cellRect.width - size) / 2}px`;
    el.style.top = `${cellRect.top - panRect.top + cellRect.height * 0.2}px`;
  }
  for (const el of pan.querySelectorAll('.token')) {
    if (!seen.has(Number(el.dataset.id))) el.remove();
  }
}

function paintHud() {
  if (game.mode === 'tutorial') {
    $('score').textContent = '教学';
    const stepText = { place: '先放面饼', wait: '等熟度', serve: '端给客人', lesson: '看热怎么分' };
    $('order').textContent = stepText[game.step] || '教学';
    $('patience').textContent = '不记时';
  } else if (game.phase === 'result') {
    $('score').textContent = `${game.score} / ${GOAL}`;
    $('order').textContent = success(game) ? '达标' : '未达标';
    $('patience').textContent = '本班结束';
  } else {
    const order = currentOrder(game);
    $('score').textContent = `${game.score} / ${GOAL}`;
    $('order').textContent = order ? `${game.orderIndex + 1}/4 ${order.label}` : '本班';
    $('patience').textContent = `耐心 ${Math.max(0, Math.ceil(game.patience / 2))} 秒`;
  }
  const notice = $('notice');
  notice.textContent = game.notice?.text || '';
  notice.className = game.notice?.tone || 'info';
  $('face').dataset.mood = mood();
  const order = currentOrder(game);
  if (game.mode === 'tutorial') {
    $('ask').textContent = '客人要：面饼';
    $('next-order').textContent = '学会之后再开一班';
    $('bar-fill').style.width = '100%';
    $('bar').classList.remove('low');
  } else if (!order) {
    $('ask').textContent = success(game) ? '客人吃好了' : '这班没稳住';
    $('next-order').textContent = '热场会在下一班清空';
    $('bar-fill').style.width = '0';
  } else {
    const ask = Object.entries(order.need).map(([kind, count]) => `${INGREDIENTS[kind].name}×${count}`).join('、');
    $('ask').textContent = `客人要：${ask}`;
    const upcoming = nextOrder(game);
    $('next-order').textContent = upcoming ? `下一单：${upcoming.label}` : '下一单：没有了';
    const ratio = Math.max(0, game.patience / game.patienceMax);
    $('bar-fill').style.width = `${ratio * 100}%`;
    $('bar').classList.toggle('low', ratio < 0.28);
  }
  $('skip').hidden = !(game.mode === 'tutorial' && game.step !== 'lesson');
  const held = game.foods.find((food) => food.place === 'hold');
  const holdBtn = $('hold');
  holdBtn.classList.toggle('has', Boolean(held));
  if (held) {
    const taste = band(held.kind, held.temp);
    const label = { raw: '生', ready: '熟了', perfect: '正好', over: '过火', burnt: '糊了' }[taste];
    holdBtn.textContent = `保温台 · ${INGREDIENTS[held.kind].name}${label}`;
  } else holdBtn.textContent = '保温台 · 空';

  for (const btn of document.querySelectorAll('#tray button')) {
    const kind = btn.dataset.kind;
    const used = game.foods.some((food) => food.kind === kind);
    const blocked = game.mode === 'tutorial' && (kind !== 'noodle' || game.step !== 'place');
    btn.disabled = used || blocked || game.phase !== 'play';
    btn.setAttribute('aria-pressed', String(selected?.type === 'kind' && selected.kind === kind));
    if (!btn.querySelector('.mini')) {
      btn.innerHTML = `<i class="mini ${kind}"></i>${INGREDIENTS[kind].name}`;
    }
  }
  const target = serveTarget();
  const targetFood = target == null ? null : game.foods.find((food) => food.id === target);
  $('serve').disabled = !targetFood || (game.mode === 'tutorial' && game.step !== 'serve') || band(targetFood.kind, targetFood.temp) === 'raw';
  $('discard').disabled = game.mode !== 'shift' || selected?.type !== 'food' || game.phase !== 'play';
  $('pause').textContent = game.phase === 'paused' ? '继续' : '暂停';
  $('pause').disabled = game.mode === 'tutorial' && game.step === 'lesson';
}

function renderOverlay(kind) {
  const overlay = $('overlay');
  if (!kind) {
    overlay.hidden = true;
    return;
  }
  overlay.hidden = false;
  const title = $('overlay-title');
  const body = $('overlay-body');
  const actions = $('overlay-actions');
  if (kind === 'lesson') {
    title.textContent = '同一口锅';
    body.textContent = '上下左右挨着的菜，把两格底火加起来平分。锅里再放一份，所有菜都会变慢，放在冷格上也算在内。熟了可以先送到保温台，火力就回到剩下的菜上。鸡蛋和青菜比面饼容易糊。';
    actions.innerHTML = '<button type="button" data-action="begin">开始本班</button>';
  } else if (kind === 'paused') {
    title.textContent = '暂停';
    body.textContent = '热停住了。看清楚格子和熟度再继续。';
    actions.innerHTML = '<button type="button" data-action="resume">继续</button><button type="button" data-action="restart">重来本班</button>';
  } else {
    const ok = success(game);
    title.textContent = ok ? '本班达标' : '本班未达标';
    const lines = game.results.map((item) => {
      const missed = item.missed.map((kindName) => INGREDIENTS[kindName].name);
      const tail = missed.length ? `，没端上${missed.join('、')}` : '';
      return `${item.label}：${item.points} 分${tail}`;
    });
    body.textContent = `得分 ${game.score}，目标 ${GOAL}。\n${lines.join('\n')}`;
    actions.innerHTML = '<button type="button" data-action="again">再来一班</button><button type="button" data-action="review">再看教学</button>';
  }
  actions.querySelector('button')?.focus();
}

function paintOverlay() {
  const kind = game.phase === 'result'
    ? 'result'
    : game.phase === 'paused'
      ? 'paused'
      : game.mode === 'tutorial' && game.step === 'lesson'
        ? 'lesson'
        : '';
  if (kind === overlayKind) return;
  overlayKind = kind;
  renderOverlay(kind);
}

function paint() {
  paintHud();
  paintCells();
  paintFoods();
  paintOverlay();
}

function buildCells() {
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.cell = `${r},${c}`;
      cell.dataset.burner = String(BURNER[r][c]);
      pan.appendChild(cell);
    }
  }
}

function beginPointer(event, from) {
  if (game.phase !== 'play') return;
  if (game.mode === 'tutorial' && game.step === 'lesson') return;
  if (event.button != null && event.button !== 0) return;
  pointer.active = true;
  pointer.id = event.pointerId;
  pointer.from = from;
  pointer.moved = false;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  event.preventDefault();
  if (event.pointerType === 'mouse') event.currentTarget.setPointerCapture?.(event.pointerId);
}

function endPointer() {
  pointer.active = false;
  pointer.moved = false;
  pointer.from = null;
  pointer.id = null;
  ghost.hidden = true;
}

function moveDragged(event) {
  const x = event.clientX;
  const y = event.clientY;
  if (pointer.from?.type === 'food') {
    const el = pan.querySelector(`.token[data-id="${pointer.from.id}"]`);
    if (!el) return;
    el.classList.add('drag');
    el.classList.remove('picked');
    el.style.left = `${x - el.offsetWidth / 2}px`;
    el.style.top = `${y - el.offsetHeight - 20}px`;
    return;
  }
  const kind = pointer.from?.kind;
  if (!kind) return;
  ghost.hidden = false;
  ghost.dataset.kind = kind;
  ghost.dataset.band = 'raw';
  ghost.style.left = `${x}px`;
  ghost.style.top = `${y}px`;
}

function actCell(r, c) {
  if (selected?.type === 'kind') {
    const result = place(game, selected.kind, r, c);
    if (result.ok) selected = null;
    commit(result);
    return;
  }
  if (selected?.type === 'food') {
    const result = move(game, selected.id, r, c);
    if (result.ok) selected = null;
    commit(result);
  }
}

function tap(info) {
  if (info.type === 'tray') {
    selected = selected?.type === 'kind' && selected.kind === info.kind ? null : { type: 'kind', kind: info.kind };
    paint();
    return;
  }
  if (info.type === 'food') {
    selected = selected?.type === 'food' && selected.id === info.id ? null : { type: 'food', id: info.id };
    paint();
    return;
  }
  if (info.type === 'cell') {
    const [r, c] = info.cell.split(',').map(Number);
    actCell(r, c);
    return;
  }
  if (info.type === 'hold') {
    const held = game.foods.find((food) => food.place === 'hold');
    if (selected?.type === 'food') {
      const result = hold(game, selected.id);
      if (result.ok) selected = null;
      commit(result);
      return;
    }
    if (held) selected = { type: 'food', id: held.id };
    paint();
  }
}

function drop(info, x, y) {
  const stack = document.elementsFromPoint(x, y);
  const cellEl = stack.find((el) => el.dataset && el.dataset.cell);
  const hits = (id) => stack.some((el) => el.id === id || el.closest?.(`#${id}`));
  if (info.type === 'tray' && cellEl) {
    const [r, c] = cellEl.dataset.cell.split(',').map(Number);
    const result = place(game, info.kind, r, c);
    if (result.ok) selected = null;
    commit(result);
    return;
  }
  if (info.type === 'food') {
    if (cellEl) {
      const [r, c] = cellEl.dataset.cell.split(',').map(Number);
      const result = move(game, info.id, r, c);
      if (result.ok) selected = null;
      commit(result);
      return;
    }
    if (hits('guest') || hits('serve')) {
      selected = null;
      commit(serve(game, info.id));
      return;
    }
    if (hits('hold')) {
      selected = null;
      commit(hold(game, info.id));
      return;
    }
    if (hits('tray') || hits('discard')) {
      selected = null;
      commit(discard(game, info.id));
      return;
    }
  }
  paint();
}

pan.addEventListener('pointerdown', (event) => {
  const token = event.target.closest('.token');
  const cell = event.target.closest('[data-cell]');
  if (token) beginPointer(event, { type: 'food', id: Number(token.dataset.id) });
  else if (cell) beginPointer(event, { type: 'cell', cell: cell.dataset.cell });
});
$('tray').addEventListener('pointerdown', (event) => {
  const btn = event.target.closest('[data-kind]');
  if (!btn || btn.disabled) return;
  beginPointer(event, { type: 'tray', kind: btn.dataset.kind });
});
$('hold').addEventListener('pointerdown', (event) => {
  beginPointer(event, { type: 'hold' });
});
window.addEventListener('pointermove', (event) => {
  if (!pointer.active || event.pointerId !== pointer.id) return;
  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  if (!pointer.moved && dx * dx + dy * dy > 64) pointer.moved = true;
  if (pointer.moved) moveDragged(event);
});
window.addEventListener('pointerup', (event) => {
  if (!pointer.active || event.pointerId !== pointer.id) return;
  const info = pointer.from;
  const moved = pointer.moved;
  endPointer();
  if (!moved) tap(info);
  else drop(info, event.clientX, event.clientY);
});
window.addEventListener('pointercancel', () => {
  if (!pointer.active) return;
  endPointer();
  paint();
});
window.addEventListener('touchmove', (event) => {
  if (!pointer.active) return;
  const touch = event.touches[0];
  if (!touch) return;
  event.preventDefault();
  const dx = touch.clientX - pointer.x;
  const dy = touch.clientY - pointer.y;
  if (!pointer.moved && dx * dx + dy * dy > 64) pointer.moved = true;
  if (pointer.moved) moveDragged({ clientX: touch.clientX, clientY: touch.clientY });
}, { passive: false });
window.addEventListener('touchend', (event) => {
  if (!pointer.active) return;
  const touch = event.changedTouches[0];
  const info = pointer.from;
  const moved = pointer.moved;
  endPointer();
  if (!touch) {
    paint();
    return;
  }
  if (!moved) tap(info);
  else drop(info, touch.clientX, touch.clientY);
});

$('guest').addEventListener('click', () => {
  if (game.phase !== 'play' || selected?.type !== 'food') return;
  const id = selected.id;
  selected = null;
  commit(serve(game, id));
});
$('serve').addEventListener('click', () => {
  const id = serveTarget();
  if (id == null) return;
  selected = null;
  commit(serve(game, id));
});
$('discard').addEventListener('click', () => {
  if (selected?.type !== 'food') return;
  const id = selected.id;
  selected = null;
  commit(discard(game, id));
});
$('pause').addEventListener('click', () => {
  game = game.phase === 'paused' ? resume(game) : pause(game);
  paint();
});
$('restart').addEventListener('click', () => {
  const now = Date.now();
  const needsArm = game.mode === 'shift' && game.phase === 'play';
  if (needsArm && now - restartArm > 1800) {
    restartArm = now;
    game = structuredClone(game);
    game.notice = { tone: 'warn', text: '再按一次重来，这一班的热和分数都会清空。' };
    paint();
    return;
  }
  restartArm = 0;
  selected = null;
  commit(restart(game));
});
$('skip').addEventListener('click', () => {
  selected = null;
  game = createShift();
  paint();
});
$('sound').addEventListener('click', async () => {
  soundOn = !soundOn;
  $('sound').setAttribute('aria-pressed', String(soundOn));
  $('sound').textContent = soundOn ? '静音' : '音效';
  if (!soundOn) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    soundOn = false;
    $('sound').setAttribute('aria-pressed', 'false');
    $('sound').textContent = '音效';
    return;
  }
  if (!audioCtx) audioCtx = new Ctx();
  await audioCtx.resume();
  tone(660, 0.1);
});
$('overlay').addEventListener('click', (event) => {
  const action = event.target.dataset.action;
  if (!action) return;
  selected = null;
  if (action === 'begin' || action === 'again' || action === 'restart') commit(restart(game));
  else if (action === 'resume') {
    game = resume(game);
    paint();
  } else if (action === 'review') {
    game = createTutorial();
    paint();
  }
});
window.addEventListener('resize', () => paint());

buildCells();
paint();
window.setInterval(() => {
  if (!auto || game.phase !== 'play') return;
  if (game.mode === 'tutorial' && game.step === 'lesson') return;
  stepOnce();
}, 500);

window.__HK = {
  dump: () => structuredClone(game),
  auto: (on) => { auto = Boolean(on); },
  place: (kind, r, c) => { const result = place(game, kind, r, c); commit(result); return result.ok; },
  move: (id, r, c) => { const result = move(game, id, r, c); commit(result); return result.ok; },
  serve: (id) => { const result = serve(game, id); commit(result); return result.ok; },
  discard: (id) => { const result = discard(game, id); commit(result); return result.ok; },
  hold: (id) => { const result = hold(game, id); commit(result); return result.ok; },
  tick: (n = 1) => {
    for (let i = 0; i < n; i += 1) {
      const prev = game;
      game = tick(game);
      narrate(prev, game);
      cue(prev, game);
    }
    paint();
    return game.tickCount;
  },
  pause: () => { game = pause(game); paint(); },
  resume: () => { game = resume(game); paint(); },
  restart: () => { selected = null; commit(restart(game)); },
  review: () => { selected = null; game = createTutorial(); paint(); },
};
