# 拼路试车场 · Road Test Lab

A short side-view driving test. Hold the throttle, cross a finish flag, and when you crash you may rotate or replace exactly one road block before the next run. That next run draws the previous run as a pale car and a trail, so the edit and the driving can be compared.

There is no compile step. This folder is the page.

## Play

From the repo root:

```bash
python3 -m http.server 8000
```

Open `http://127.0.0.1:8000/road-test-lab/`.

- Desktop: hold `→`, `D`, or `W` for throttle. Hold `←`, `A`, or `S` for brake. `R` or `Enter` rearms the run. `1` `2` `3` pick a track. `Q` rotates the selected block.
- Phone: the two large pedals are throttle and brake. After a crash, tap a numbered block, then rotate it or replace it with another block type.
- A crash allows one change. The buttons lock after that change. Rearm and drive again. The pale car is the run you just finished.
- `还原赛道` puts the blocks and the ghost back to the start of that track. Best time stays on this browser under `road-test-lab-best-v1`.
- Switching tracks keeps each track's blocks and ghost separate.

## Check

```bash
node --test road-test-lab/sim.test.js
```

Browser smoke uses the repo-root Playwright dependency:

```bash
npm ci
npx playwright install chromium
node road-test-lab/browser-smoke.js
```

## Levels

| Track | What goes wrong | Example fix | Driving |
| --- | --- | --- | --- |
| 1 弹板方向 | The kicker faces down and flips the car | Rotate block 3 so the lip faces up | Hold throttle all the way |
| 2 陡坎 | The steep face stops the car | Replace block 3 with a ramp | Hold throttle. Coasting never arrives |
| 3 油门窗口 | The ramp faces up, so the low deck is a cliff | Rotate block 4 so it faces down | Release throttle before the crest. Holding it flips the car. A tiny tap never arrives |

The same scripts are in `solutions.js` and are what `sim.test.js` drives. They are not a button that plays a win.

## Simplifications

- The wheel is a point. Gentle slopes are glued. A kink steeper than about 50° is a wall. Leaving a crest above the launch speed, or driving onto a gap, puts the car in the air.
- Landing fails when the impact or the body angle disagrees with the road.
- Brake slows the car to a stop. It is not a reverse gear.
- Physics steps at a fixed 1/60 s. A slow frame runs more of those steps, so the pose does not depend on the frame rate.
- One crash, one block. No damage model, no car collection, no accounts, no network.

## Pages

The site workflow publishes the repo root on pushes to `main`. This demo is only the `road-test-lab/` directory. The shared catalog is left for the parent list to add:

`{"slug":"road-test-lab","name":"拼路试车场","desc":"侧视试车，失败后只能改一段路，下一跑对照自己的影子。","emoji":"🚗","cat":"物理"}`

Intended public URL: `https://stoneleee.github.io/game-lab/road-test-lab/`.
