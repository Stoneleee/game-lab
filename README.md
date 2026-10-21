# game-lab · Stone 的游戏实验室

GitHub Pages 站点：首页列出所有游戏（由 `games.json` 渲染），每个游戏一个子目录存放构建产物。

```
index.html          # 游戏列表页（读取 games.json）
games.json          # 游戏清单
stack-tower/        # 叠叠高的构建产物（vite build 输出）
<slug>/             # 其他 70 款小游戏的构建产物（g2048、merge、flappy …）
src-games/stack-tower/  # 叠叠高源码（独立 Vite + TypeScript + Phaser 4 项目）
src-games/_lib/     # 70 款小游戏共用的 Canvas 引擎（engine.ts）和 index.html 模板
src-games/<slug>/   # 每款小游戏的源码：index.html + main.ts
src-games/build-all.mjs  # 一键构建所有小游戏到仓库根 /<slug>/
```

## 用共享引擎快速添加新游戏（推荐）
1. `cd src-games && npm ci`（只需一次）
2. `mkdir <slug> && cp _lib/index.html <slug>/`，参考任一现有游戏写 `<slug>/main.ts`：调用 `run({ id, name, help, start, update, draw, down/up/move/swipe/key })`，用 `g.add()` 加分、`g.over()` 结束，开始/结束/重开和最佳分由引擎负责。
3. `node build-all.mjs <slug>`，产物输出到仓库根 `/<slug>/`（base 已是 `./`）。
4. 在 `games.json` 加一条，带 `cat` 分类字段（首页会自动生成分类筛选）。
5. 提交推送。

## 用独立项目添加新游戏（如 Phaser）

## 添加新游戏
1. 源码放到 `src-games/<slug>/`，`vite.config.ts` 里设置 `base: './'`（保证子路径下资源能加载）。
2. 构建：`cd src-games/<slug> && npm ci && npm run build`
3. 把产物复制到根目录：`rm -rf ../../<slug> && cp -r dist ../../<slug>`
4. 在 `games.json` 加一条：`{"slug":"<slug>","name":"名字","desc":"一句话介绍","emoji":"🎲","cat":"益智"}`
5. 提交并推送到 `main`，GitHub Actions 会自动部署，访问 `https://stoneleee.github.io/game-lab/<slug>/`。

## 本地预览
`python3 -m http.server 8000` 后打开 http://localhost:8000/
