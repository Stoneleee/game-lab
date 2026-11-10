# 换轨邮局 (Switchmail / Switchyard Post)

A deterministic logistics puzzle game where you edit directional signposts and wait pads to route packages to their destinations while avoiding collisions.

## Game Overview

**换轨邮局** is a finite grid discrete deterministic logistics puzzle. Packages follow directions set by shared signposts that you can edit with a limited budget. Your goal is to route all packages to their destinations without collisions, timing conflicts, or running out of time.

## Core Mechanics

### Movement & Simulation
- Packages spawn at designated ticks and move one cell per tick in their current direction
- When a package enters a cell with a direction arrow (↑↓←→), it changes direction on the NEXT tick
- When a package enters a wait pad (⏸), it pauses for one full tick before resuming movement
- Packages are removed immediately upon reaching their destination
- The simulation proceeds tick-by-tick, and you can step through or run continuously

### Editing Rules
- **Edit Budget**: Each level has a limited number of edits you can make
- **Shared Signposts**: One signpost affects ALL packages that pass through it
- **Direction Arrows**: Can be placed on editable cells to change package direction
- **Wait Pads**: Can be placed where marked to delay packages by one tick
- **Undo**: You can undo edits freely without penalty

### Win/Lose Conditions

**Win**: All packages reach their destinations without any failures

**Failures**:
- **Wall Collision**: Package hits a wall
- **Out of Bounds**: Package moves outside the grid
- **Same-Cell Collision**: Two packages occupy the same cell at the same time
- **Head-On Collision**: Two packages swap positions (pass through each other)
- **Timeout**: Packages don't reach destinations within the tick limit

### Progression (10 Levels)

1. **放手试跑** - No edits needed, observe automatic delivery
2. **拐弯到站** - Place direction arrows to guide turning
3. **修坏路标** - Find and fix incorrect signposts
4. **保留正确部分** - Don't edit what's already correct
5. **同拍碰撞** - Use wait pads to avoid collision timing
6. **不要过度干预** - Sometimes no edits is the best solution
7. **空间换时间** - Route packages around each other using detours
8. **一个规则服务两件** - One shared signpost affects multiple packages
9. **桥有方向** - Navigate restricted passages with complex routing
10. **综合考试** - Combine all learned techniques

## Technical Details

### Game Rules (Formal Specification)

**Tick Ordering**:
1. Spawn packages scheduled for this tick
2. Check if packages are waiting; if so, keep waiting or expire wait
3. Apply cell directions to packages
4. Calculate next positions
5. Validate moves (no walls, in-bounds, no collisions)
6. Execute moves
7. Remove delivered packages
8. Check win/lose conditions

**Wait Behavior**:
- A package entering a wait cell sets `waitUntilTick = currentTick`
- On subsequent ticks, if `tick <= waitUntilTick`, the package waits
- Once `tick > waitUntilTick`, wait expires and package can move
- Wait does not re-trigger after expiry (single-use per visit)

**Direction Application**:
- Packages check their current cell BEFORE moving
- If cell has a direction arrow, package adopts that direction
- Spawn direction is the package's initial heading

**Delayed Departure**:
- Packages have a `spawnTick` property
- They appear on the grid at that tick (not before)
- Multiple packages can spawn at different times

**Destination Handling**:
- When a package reaches its destination cell, it's immediately removed
- Removed packages don't block other packages

## Architecture

### File Structure
```
src-games/switchmail/
├── index.html          # Entry point with minimal styling
├── main.ts             # UI rendering, interaction, game loop
├── game.ts             # Core simulation engine
├── levels.ts           # 10 level definitions with solutions
├── game.test.ts        # Unit tests for simulation logic
├── package.json        # Dependencies
├── vite.config.ts      # Build configuration (outputs to /switchmail/)
├── tsconfig.json       # TypeScript configuration
└── README.md           # This file
```

### Build System
- **Framework**: Vanilla TypeScript, no external game frameworks
- **Build Tool**: Vite 5.x
- **Testing**: Vitest with happy-dom environment
- **Output**: Static HTML/CSS/JS bundle at `/workspace/switchmail/`
- **Base Path**: `./` for proper nested GitHub Pages deployment

### State Management
- Immutable simulation steps (each step returns new state)
- History stack for undo (stores edit snapshots)
- Simulation state separate from edit state
- No global mutable game state except UI state

## Commands

### Development
```bash
cd src-games/switchmail
npm install
npm run dev          # Start dev server at http://localhost:5173
```

### Testing
```bash
npm test             # Run all unit tests
npm run test:watch   # Run tests in watch mode
```

### Production Build
```bash
npm run build        # Build to ../../switchmail/ (repository root)
```

### Integration
The game is integrated into the game-lab repository:
- Listed in `/workspace/games.json` as `{"slug":"switchmail",...}`
- Deployed at `https://stoneleee.github.io/game-lab/switchmail/`
- Accessible from main game gallery at `https://stoneleee.github.io/game-lab/`

## Test Coverage

All tests passing (19 tests):

### Position Utilities (3 tests)
- ✓ Move position correctly in all directions
- ✓ Validate in-bounds positions
- ✓ Compare positions for equality

### Basic Movement (3 tests)
- ✓ Spawn package at correct tick
- ✓ Move package in correct direction
- ✓ Deliver package at destination

### Collision Detection (4 tests)
- ✓ Detect wall collision
- ✓ Detect out-of-bounds movement
- ✓ Detect same-cell collision
- ✓ Detect head-on collision

### Wait Mechanic (1 test)
- ✓ Wait for one tick then resume movement

### Direction Changes (1 test)
- ✓ Follow direction cells correctly

### Delayed Spawn (1 test)
- ✓ Spawn package at delayed tick

### Edit Budget & Validation (2 tests)
- ✓ Apply edits to grid correctly
- ✓ Validate edit budget limits

### Level Solutions (1 test)
- ✓ All 10 level reference solutions are valid

### Win Conditions (2 tests)
- ✓ Win when all packages delivered
- ✓ Don't win if packages undelivered

### Timeout (1 test)
- ✓ Fail if max ticks exceeded

## Graphics & Assets

- **Style**: Original geometric/CSS graphics with warm postal theme
- **Colors**: Earth tones (#3d2817 background, #ffb366 accents, package colors for contrast)
- **Icons**: Unicode emoji and geometric shapes (●■▲◆ for packages, ↑↓←→⏸ for directions)
- **Responsive**: Works on desktop and portrait mobile (no landscape lock)
- **Accessibility**: Packages distinguished by BOTH shape AND color
- **Legibility**: Clear visual distinction between editing mode and running state

**No external assets, SDKs, analytics, ads, or logins.**

## Known Limitations

1. **Level Generation**: All levels are hand-authored, no procedural generation
2. **No Metagame**: No shop, currency, or progression unlocks between levels
3. **Local Storage Only**: Best scores and progress stored in browser localStorage
4. **Single-Solution Focus**: Levels have one stored solution for validation, but may have multiple valid solutions
5. **Fixed Grid Size**: All levels use 5×5 grid
6. **Limited Package Types**: Only visual variety (shapes/colors), no gameplay differences
7. **No Hints Beyond Solution**: Hint system shows conflict → relevant cells → full solution
8. **Browser Compatibility**: Requires modern ES2020+ browser with CSS Grid support

## Deployment Notes

### GitHub Pages Configuration
- **Repository**: Stoneleee/game-lab
- **Branch**: Changes deployed via PR to `main` branch
- **Workflow**: `.github/workflows/pages.yml` auto-deploys on push to main
- **URL Structure**: `https://stoneleee.github.io/game-lab/switchmail/`
- **Build Path**: Static files at `/workspace/switchmail/` in repository root
- **Base Setting**: Vite configured with `base: './'` for relative asset paths

### Build Identifier
- Version: 1.0.0
- Build Date: 2026-11-10
- Commit SHA: (set via PR merge)
- Game ID: switchmail

### Verification
To verify deployed version:
1. Check build artifacts exist at `/workspace/switchmail/index.html`
2. Open deployed URL in browser
3. Test: click cells to edit, run simulation, complete level 1
4. Check console for no runtime errors
5. Verify assets load (no 404s in Network tab)

## Design Credits

Game concept "换轨邮局" developed based on research notes dated 2026-11-10, combining mechanics inspired by:
- **Mini Metro**: Connection topology management
- **Baba Is You**: Rule editability
- **Into the Breach**: Preview and deterministic simulation

**Original implementation** - no assets, characters, levels, or UI copied from referenced games.

All code, graphics, and level designs are original work created for this project.

---

**Game Lab · Stone 的游戏实验室**
