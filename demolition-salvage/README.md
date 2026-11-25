# 拆迁保全队 · Demolition Salvage

A short 2D side-view demolition puzzle. Each shot removes one support. Unsupported wood and brick fall straight down, one cell at a time. Blocks count as salvage only when they enter a yellow collector. The green room must stay put and must not be hit.

There is no compile step. This folder is the page GitHub Pages serves.

## Play

From the repo root:

```bash
python3 -m http.server 8000
```

Open `http://127.0.0.1:8000/demolition-salvage/`.

Rules, in the same words the board uses:

- Tap a wood or brick block, then tap 拆除. A second tap on the same block also confirms.
- Wood stays up when it sits on something or is connected sideways to other wood. Brick stays up only when the cell under it is solid.
- Steel (钢) cannot be cut. It holds only what is stacked on it.
- A cut block becomes rubble immediately, but the salvage counter waits until that rubble, or a block it releases, actually reaches a collector.
- The green room does not hold debris. A falling block stops on its roof and the run is lost. The room also fails if it loses its own support.
- Shots are locked while the status says 坍落中…. The win or loss line appears only after everything has stopped.
- 撤销 rolls back the latest settled shot, including shots, salvage, and the room. 重来 restores the level. Both work after a win or a loss. Switching levels clears that history.
- Clearing a level unlocks the next one. Progress is stored in `localStorage` under `demolition-salvage-progress-v1`.
- Sound is off until 音效. 静音 silences the synth immediately. There are no audio files.

Desktop: mouse and keyboard (`Enter` confirm, `U` undo, `R` restart, `M` mute). Phone: the board does not scroll the page; the level list can. Portrait fits, including the six-row levels.

## Check

No extra install for the rules:

```bash
node --test demolition-salvage/sim.test.js
```

Browser smoke (repo-root devDependency, Chromium):

```bash
npm ci
npx playwright install chromium
node demolition-salvage/browser-smoke.js
```

## Levels

Coordinates start at 0. `x` goes right, `y` goes up, and the ground row is `y = 0`.

| Level | Goal | Shots | Working cuts | Cut that loses |
| --- | --- | --- | --- | --- |
| 1 第一枪 | 1 | 1 | middle wood `(2,3)` | — |
| 2 保住绿房 | 4 | 1 | wood just left of the post `(2,4)` | wood on the post `(3,4)` — salvage reaches 4 and the room is hit |
| 3 木头与砖 | 2 | 1 | wood under the brick `(1,3)` | wood sitting on the beam `(3,4)` |
| 4 只够两发 | 4 | 2 | `(1,3)` then `(4,3)` | wood over the room `(7,4)` |
| 5 连锁坠落 | 4 | 1 | wood on the post `(3,4)` | top-left brick `(1,5)` |
| 6 关键两下 | 5 | 2 | `(1,4)` then `(4,5)` | right-hand wood `(7,5)` |

The automated solver also finds a win for every level using the same step function as the page. Order of the two-shot solutions does not matter.

## How this differs from the design note

- The shot is a tap, not a drawn bullet. The cut block is the thing that starts falling.
- Steel posts are an extra material. Wood cannot hang from steel sideways; a beam end has to sit on a post. That keeps a collapse from grabbing a post on the way down.
- Falls are straight down. “Cut left or right” means choosing which column loses its support.
- Particles stay on so the fall is readable. Only sound is gated behind the button.
- Win and loss are decided after the last moving step, even if the salvage goal was met while something was still in the air.

## Pages

`.github/workflows/pages.yml` publishes the repo root on every push to `main`. This game is only the `demolition-salvage/` path plus one new `games.json` entry. Intended public URL: `https://stoneleee.github.io/game-lab/demolition-salvage/`.
