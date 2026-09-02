# SINGAN2 Web 前端（M4 / AI 工程 B）

原版 Win32 主界面的 **1:1 对照复刻**（React 18 + Vite 5 + ECharts 5）。
调用 `server/` 的 M3 HTTP API（`singan2_server.exe` 监听 `:8080`）。

## 运行

```bash
# 1) 先启动 M3 API（另开一个终端）
cd ../server
cmake --build ../build --config Debug
../build/server/Debug/singan2_server.exe 8080

# 2) 启动前端（dev，热更新）
npm install      # 首次
npm run dev      # http://localhost:5173

# 生产构建
npm run build    # 产物在 dist/
npm run preview  # 本地预览构建产物
```

> Vite 已配置代理：`/api`、`/health` → `http://127.0.0.1:8080`，无需处理 CORS。

## 已实现（对照原版 UI，详见 docs/10_界面与交互文档.md）

| 原版元素 | 前端入口 | 状态 |
|---|---|---|
| 工具栏 Open / Coordinate / Cont.(Alt+R) / Finish | 顶部工具栏 | ✅ |
| 结果列表视图（S2[1..16] + etc[10,11]） | 默认视图 | ✅ |
| 结果图像视图（S2 波段条形图） | 右键 `Switch View` | ✅ |
| 右键菜单 `Grid` / `MousePoint(V)` / `Show Area`(三态) / `Switch View` / `Re-Load Coordinate` / `Restore` | 主区右键 | ✅ |
| 右键 `Image Prosess ▸ Gradient/Binary/Noise/Restore` | 右键级联 | ✅（接 M2 `imageops`） |
| `Show Information` / `Detail Setting` | 右键 | ✅（基础信息 / 红绿 offset 设置） |
| `View All Result` → 导出 `a.csv` | 列表视图底部按钮 | ✅ |

## 目录
- `src/api.js` — M3 端点封装
- `src/App.jsx` — 主组件（工具栏 + 视图切换 + 右键菜单 + CSV 导出）
- `src/styles.css` — 贴近原版灰色 UI 样式

## 待办（M4 迭代）
1. 多枚导航（左/右箭头）、图形窗口（原版 Graph 自绘区）复刻为 ECharts 多曲线。
2. Show Information 对话框可进一步复刻原版 `IDD_J_DLG` 的鼠标区域放大图。
3. Detail Setting 对话框可进一步复刻原版 `IDD_S_SET_DLG` 的 overwrite / country / 坐标显示选项。
