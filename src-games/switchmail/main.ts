import { 
  Level, Cell, Direction, SimulationState, EditAction, HistoryEntry, Pos,
  createInitialState, simulateStep, simulateToEnd, applyEdits, canEdit, validateSolution,
  movePos, posEqual, DIRECTIONS
} from './game';
import { LEVELS } from './levels';

// Game state
let currentLevel = 0;
let level: Level = LEVELS[currentLevel];
let grid: Cell[][] = [];
let edits: EditAction[] = [];
let history: HistoryEntry[] = [];
let simState: SimulationState | null = null;
let isSimulating = false;
let simulationSpeed = 300; // ms per tick
let simulationInterval: number | null = null;
let selectedCell: Pos | null = null;
let showHint = false;
let hintLevel = 0; // 0: none, 1: show conflict, 2: show relevant cells, 3: show solution

// UI elements
let app: HTMLElement;

// Initialize
function init() {
  app = document.getElementById('app')!;
  loadLevel(0);
  render();
}

function loadLevel(index: number) {
  currentLevel = Math.max(0, Math.min(index, LEVELS.length - 1));
  level = LEVELS[currentLevel];
  grid = level.grid.map(row => row.map(cell => ({ ...cell })));
  edits = [];
  history = [{ edits: [], usedBudget: 0 }];
  simState = null;
  isSimulating = false;
  selectedCell = null;
  showHint = false;
  hintLevel = 0;
  stopSimulation();
}

function resetLevel() {
  grid = level.grid.map(row => row.map(cell => ({ ...cell })));
  edits = [];
  history = [{ edits: [], usedBudget: 0 }];
  simState = null;
  isSimulating = false;
  selectedCell = null;
  showHint = false;
  stopSimulation();
  render();
}

function applyEdit(pos: Pos, direction: Direction) {
  const cell = grid[pos.y][pos.x];
  if (!canEdit(cell, direction)) return;
  
  // Remove any existing edit at this position
  edits = edits.filter(e => !posEqual(e.pos, pos));
  
  // Add new edit
  edits.push({ pos, direction });
  cell.direction = direction;
  
  // Update history
  history.push({ edits: [...edits], usedBudget: edits.length });
  
  render();
}

function undo() {
  if (history.length <= 1) return;
  
  history.pop();
  const prev = history[history.length - 1];
  edits = [...prev.edits];
  grid = applyEdits(level, edits);
  
  render();
}

function startSimulation() {
  if (isSimulating) return;
  
  grid = applyEdits(level, edits);
  simState = createInitialState(level);
  isSimulating = true;
  showHint = false;
  
  render();
  
  simulationInterval = window.setInterval(() => {
    if (!simState || simState.failed || simState.won) {
      stopSimulation();
      return;
    }
    
    simState = simulateStep(level, simState, grid);
    render();
  }, simulationSpeed);
}

function stepSimulation() {
  if (isSimulating && simulationInterval) return; // Can't step while auto-running
  
  if (!simState) {
    grid = applyEdits(level, edits);
    simState = createInitialState(level);
  }
  
  if (simState.failed || simState.won) return;
  
  simState = simulateStep(level, simState, grid);
  render();
}

function stopSimulation() {
  isSimulating = false;
  if (simulationInterval !== null) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
}

function toggleSpeed() {
  if (simulationSpeed === 300) simulationSpeed = 150;
  else if (simulationSpeed === 150) simulationSpeed = 50;
  else simulationSpeed = 300;
  
  if (isSimulating && simulationInterval) {
    stopSimulation();
    startSimulation();
  }
  render();
}

function showHintStep() {
  showHint = true;
  hintLevel = Math.min(hintLevel + 1, 3);
  render();
}

function nextLevel() {
  if (currentLevel < LEVELS.length - 1) {
    loadLevel(currentLevel + 1);
    render();
  }
}

function prevLevel() {
  if (currentLevel > 0) {
    loadLevel(currentLevel - 1);
    render();
  }
}

// Rendering
function render() {
  const usedBudget = edits.length;
  const canUndo = history.length > 1;
  const hasSimulation = simState !== null;
  
  app.innerHTML = `
    <div style="flex: 1; display: flex; flex-direction: column; padding: 16px; gap: 12px; overflow-y: auto;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <button onclick="window.gameActions.home()" style="padding: 8px 16px; background: #6b4423; border: none; border-radius: 4px; color: #f5e6d3; cursor: pointer; font-size: 14px;">
          ← 返回大厅
        </button>
        <div style="text-align: center; flex: 1;">
          <div style="font-size: 20px; font-weight: bold; color: #ffb366;">关卡 ${level.id}: ${level.name}</div>
          <div style="font-size: 13px; color: #c9b18a; margin-top: 4px;">${level.description}</div>
        </div>
        <div style="width: 100px;"></div>
      </div>

      <!-- Status Bar -->
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; font-size: 14px;">
        <div style="background: #4a3222; padding: 8px 16px; border-radius: 4px;">
          <span style="color: #c9b18a;">编辑：</span>
          <span style="color: ${usedBudget > level.editBudget ? '#ff6b6b' : '#7bd389'}; font-weight: bold;">
            ${usedBudget} / ${level.editBudget}
          </span>
        </div>
        ${hasSimulation ? `
          <div style="background: #4a3222; padding: 8px 16px; border-radius: 4px;">
            <span style="color: #c9b18a;">时刻：</span>
            <span style="color: #ffb366; font-weight: bold;">${simState!.tick}</span>
          </div>
        ` : ''}
        <div style="background: #4a3222; padding: 8px 16px; border-radius: 4px;">
          <span style="color: #c9b18a;">待发车：</span>
          <span style="color: #ffb366; font-weight: bold;">
            ${level.packages.filter(p => !simState || (!simState.packages.has(p.id) && !simState.won)).length}
          </span>
        </div>
      </div>

      <!-- Game Board -->
      <div id="game-board" style="
        display: grid;
        grid-template-columns: repeat(${level.gridSize}, 1fr);
        gap: 4px;
        margin: 0 auto;
        max-width: min(500px, 90vw);
        aspect-ratio: 1;
        background: #2a1810;
        padding: 8px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      ">
        ${renderGrid()}
      </div>

      <!-- Legend -->
      <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; font-size: 12px;">
        <div style="display: flex; align-items: center; gap: 4px;">
          <div style="width: 16px; height: 16px; background: #ff6b6b; border-radius: 50%;"></div>
          <span>包裹A</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <div style="width: 16px; height: 16px; background: #4ecdc4;"></div>
          <span>包裹B</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <div style="width: 16px; height: 16px; background: #5b4433; border: 2px solid #8b7355;"></div>
          <span>墙</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="font-size: 16px;">↑↓←→</span>
          <span>方向</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="font-size: 16px;">⏸</span>
          <span>等待</span>
        </div>
      </div>

      <!-- Control Buttons -->
      <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
        ${!isSimulating ? `
          <button onclick="window.gameActions.run()" style="padding: 12px 24px; background: #7bd389; border: none; border-radius: 6px; color: #1a1a1a; font-weight: bold; cursor: pointer; font-size: 16px; min-width: 100px;">
            ▶ 运行
          </button>
          <button onclick="window.gameActions.step()" style="padding: 12px 24px; background: #ffc857; border: none; border-radius: 6px; color: #1a1a1a; font-weight: bold; cursor: pointer; font-size: 16px;">
            ⏩ 单步
          </button>
        ` : `
          <button onclick="window.gameActions.stop()" style="padding: 12px 24px; background: #ff6b6b; border: none; border-radius: 6px; color: #fff; font-weight: bold; cursor: pointer; font-size: 16px; min-width: 100px;">
            ⏹ 停止
          </button>
        `}
        ${canUndo && !isSimulating ? `
          <button onclick="window.gameActions.undo()" style="padding: 12px 20px; background: #b388ff; border: none; border-radius: 6px; color: #fff; cursor: pointer; font-size: 14px;">
            ↶ 撤销
          </button>
        ` : ''}
        <button onclick="window.gameActions.reset()" style="padding: 12px 20px; background: #6b4423; border: none; border-radius: 6px; color: #f5e6d3; cursor: pointer; font-size: 14px;">
          ⟲ 重置
        </button>
        <button onclick="window.gameActions.toggleSpeed()" style="padding: 12px 20px; background: #5b8def; border: none; border-radius: 6px; color: #fff; cursor: pointer; font-size: 14px;">
          ${simulationSpeed === 300 ? '1×' : simulationSpeed === 150 ? '2×' : '4×'}
        </button>
      </div>

      <!-- Hint and Navigation -->
      <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
        <button onclick="window.gameActions.hint()" style="padding: 10px 20px; background: #ff9f43; border: none; border-radius: 6px; color: #1a1a1a; cursor: pointer; font-size: 14px;">
          💡 提示 ${hintLevel > 0 ? `(${hintLevel}/3)` : ''}
        </button>
        ${currentLevel > 0 ? `
          <button onclick="window.gameActions.prev()" style="padding: 10px 20px; background: #6b4423; border: none; border-radius: 6px; color: #f5e6d3; cursor: pointer; font-size: 14px;">
            ← 上一关
          </button>
        ` : ''}
        ${currentLevel < LEVELS.length - 1 ? `
          <button onclick="window.gameActions.next()" style="padding: 10px 20px; background: #6b4423; border: none; border-radius: 6px; color: #f5e6d3; cursor: pointer; font-size: 14px;">
            下一关 →
          </button>
        ` : ''}
      </div>

      ${renderMessages()}
    </div>
  `;

  attachCellListeners();
}

function renderGrid(): string {
  let html = '';
  
  for (let y = 0; y < level.gridSize; y++) {
    for (let x = 0; x < level.gridSize; x++) {
      const cell = grid[y][x];
      const pos = { x, y };
      const isSelected = selectedCell && posEqual(selectedCell, pos);
      
      // Find packages at this position
      let packageHere: string | null = null;
      if (simState) {
        for (const [pkgId, pkgState] of simState.packages.entries()) {
          if (!pkgState.delivered && posEqual(pkgState.pos, pos)) {
            packageHere = pkgId;
            break;
          }
        }
      }
      
      const isSpawn = cell.type === 'spawn';
      const isDestination = cell.type === 'destination';
      const isWall = cell.type === 'wall';
      const isEditable = cell.editableDirection || cell.editableWait;
      const hasDirection = cell.direction !== null;
      
      // Styling
      let bgColor = '#4a3222';
      if (isWall) bgColor = '#5b4433';
      if (isSpawn) bgColor = '#3d5a3d';
      if (isDestination) bgColor = '#5a3d3d';
      if (isEditable) bgColor = '#5a4d3d';
      if (isSelected) bgColor = '#7a6d5d';
      
      let border = '2px solid #6b5444';
      if (isWall) border = '2px solid #8b7355';
      if (isEditable) border = '2px solid #ffb366';
      
      // Show hint highlight
      if (showHint && level.solution && hintLevel >= 2) {
        const inSolution = level.solution.some(e => posEqual(e.pos, pos));
        if (inSolution) border = '3px solid #ffc857';
      }
      
      html += `
        <div 
          data-x="${x}" 
          data-y="${y}" 
          class="game-cell"
          style="
            background: ${bgColor};
            border: ${border};
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            cursor: ${isEditable && !isSimulating ? 'pointer' : 'default'};
            min-height: 50px;
          "
        >
          ${isWall ? '<div style="font-size: 24px;">🧱</div>' : ''}
          ${isSpawn && !packageHere ? `<div style="font-size: 20px; opacity: 0.5;">📬</div>` : ''}
          ${isDestination && !packageHere ? `<div style="font-size: 20px; opacity: 0.5;">📪</div>` : ''}
          ${hasDirection && !packageHere ? renderDirection(cell.direction!) : ''}
          ${packageHere ? renderPackage(packageHere) : ''}
          ${isEditable && !hasDirection && !packageHere && !isSimulating ? `
            <div style="position: absolute; top: 2px; right: 2px; font-size: 10px; opacity: 0.5;">✏️</div>
          ` : ''}
        </div>
      `;
    }
  }
  
  return html;
}

function renderDirection(dir: Direction): string {
  const arrows = {
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
    wait: '⏸',
  };
  return `<div style="font-size: 28px; color: #ffb366; font-weight: bold;">${arrows[dir]}</div>`;
}

function renderPackage(pkgId: string): string {
  const pkg = level.packages.find(p => p.id === pkgId)!;
  const shapes = {
    circle: '●',
    square: '■',
    triangle: '▲',
    diamond: '◆',
  };
  return `<div style="font-size: 32px; color: ${pkg.color};">${shapes[pkg.shape]}</div>`;
}

function renderMessages(): string {
  let html = '';
  
  // Win message
  if (simState && simState.won) {
    html += `
      <div style="background: #7bd389; color: #1a1a1a; padding: 16px; border-radius: 8px; text-align: center; font-weight: bold; font-size: 18px;">
        🎉 恭喜通关！所有包裹准时送达！
      </div>
    `;
  }
  
  // Failure message
  if (simState && simState.failed) {
    html += `
      <div style="background: #ff6b6b; color: #fff; padding: 16px; border-radius: 8px; text-align: center; font-weight: bold;">
        ❌ ${simState.failureReason || '失败'}
      </div>
    `;
  }
  
  // Hint messages
  if (showHint && level.solution) {
    if (hintLevel === 1) {
      const result = validateSolution(level, edits);
      if (!result.valid) {
        html += `
          <div style="background: #ff9f43; color: #1a1a1a; padding: 12px; border-radius: 8px; font-size: 14px;">
            💡 提示：${result.reason}
          </div>
        `;
      } else {
        html += `
          <div style="background: #7bd389; color: #1a1a1a; padding: 12px; border-radius: 8px; font-size: 14px;">
            💡 当前方案可行！点击运行验证。
          </div>
        `;
      }
    } else if (hintLevel === 2) {
      html += `
        <div style="background: #ff9f43; color: #1a1a1a; padding: 12px; border-radius: 8px; font-size: 14px;">
          💡 提示：高亮的格子需要编辑
        </div>
      `;
    } else if (hintLevel === 3) {
      const solutionText = level.solution.map(e => {
        const arrows = { up: '↑', down: '↓', left: '←', right: '→', wait: '⏸' };
        return `(${e.pos.x + 1},${e.pos.y + 1}): ${arrows[e.direction]}`;
      }).join('；');
      html += `
        <div style="background: #ffc857; color: #1a1a1a; padding: 12px; border-radius: 8px; font-size: 14px;">
          💡 参考解：${solutionText || '不需要编辑'}
        </div>
      `;
    }
  }
  
  return html;
}

function attachCellListeners() {
  const cells = document.querySelectorAll('.game-cell');
  cells.forEach(cellEl => {
    const el = cellEl as HTMLElement;
    const x = parseInt(el.dataset.x!);
    const y = parseInt(el.dataset.y!);
    const pos = { x, y };
    const cell = grid[y][x];
    
    if ((cell.editableDirection || cell.editableWait) && !isSimulating) {
      el.addEventListener('click', () => {
        if (isSimulating) return;
        
        if (selectedCell && posEqual(selectedCell, pos)) {
          // Cycle through directions
          const currentDir = cell.direction;
          const allowedDirs: Direction[] = [];
          if (cell.editableDirection) allowedDirs.push('up', 'down', 'left', 'right');
          if (cell.editableWait) allowedDirs.push('wait');
          
          if (allowedDirs.length === 0) return;
          
          const currentIndex = currentDir ? allowedDirs.indexOf(currentDir) : -1;
          const nextIndex = (currentIndex + 1) % allowedDirs.length;
          const nextDir = allowedDirs[nextIndex];
          
          applyEdit(pos, nextDir);
          selectedCell = null;
        } else {
          selectedCell = pos;
          render();
        }
      });
    }
  });
}

// Global actions for button handlers
(window as any).gameActions = {
  run: startSimulation,
  step: stepSimulation,
  stop: () => { stopSimulation(); render(); },
  undo,
  reset: resetLevel,
  toggleSpeed,
  hint: showHintStep,
  next: nextLevel,
  prev: prevLevel,
  home: () => { window.location.href = '../'; },
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
