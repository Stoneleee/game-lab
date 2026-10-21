# game-lab · Stone 的游戏实验室

GitHub Pages 站点：首页列出所有游戏（由 `games.json` 渲染），每个游戏一个子目录存放构建产物。

```
index.html          # 游戏列表页（读取 games.json）
games.json          # 游戏清单
stack-tower/        # 叠叠高的构建产物（vite build 输出）
src-games/stack-tower/  # 叠叠高源码（Vite + TypeScript + Phaser 4）
```

## 添加新游戏
1. 源码放到 `src-games/<slug>/`，`vite.config.ts` 里设置 `base: './'`（保证子路径下资源能加载）。
2. 构建：`cd src-games/<slug> && npm ci && npm run build`
3. 把产物复制到根目录：`rm -rf ../../<slug> && cp -r dist ../../<slug>`
4. 在 `games.json` 加一条：`{"slug":"<slug>","name":"名字","desc":"一句话介绍","emoji":"🎲"}`
5. 提交并推送到 `main`，GitHub Actions 会自动部署，访问 `https://stoneleee.github.io/game-lab/<slug>/`。

## 本地预览
`python3 -m http.server 8000` 后打开 http://localhost:8000/
