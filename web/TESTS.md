# 前端测试案例库 (Web M4.3)

> 本文件记录 Singan2 Web 复刻项目的前端测试案例，便于新成员快速了解覆盖范围与运行方式。

## 1. 测试框架

| 依赖 | 版本 | 用途 |
|---|---|---|
| `vitest` | ^2 | 测试运行器（Vite 原生） |
| `jsdom` | ^25 | DOM 模拟环境 |
| `@testing-library/react` | ^16 | React 组件渲染与查询 |
| `@testing-library/jest-dom` | ^6 | 断言扩展（toBeInTheDocument 等） |
| `@testing-library/user-event` | ^14 | 用户交互模拟（点击/输入） |

## 2. 运行方式

```bash
# 一次性运行全部测试
npm test                 # 等价于 npx vitest run

# 监听模式（开发时）
npm run test:watch       # 等价于 npx vitest

# 查看详细单用例
npx vitest run --reporter=verbose
```

配置文件：`vite.config.js` 的 `test` 段

```js
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.js'],
  css: true,
  include: ['src/**/*.test.{js,jsx}'],
}
```

`src/test/setup.js` 提供 jsdom 缺失兜底：`window.matchMedia`、`window.ResizeObserver`，并 `import '@testing-library/jest-dom/vitest'`。

## 3. 测试结果（最近一次）

```
Test Files  25 passed (25)
Tests       99 passed (99)
Duration    10.76s
```

## 4. 案例清单

> 命名约定：`*.test.jsx` 与对应组件同目录；集成测试放在 `src/App.test.jsx`。

### 4.1 集成测试（App.test.jsx，11 用例）

验证「原版同构布局」整体可渲染、各区域齐全、关键交互无崩溃。

| # | 用例 | 断言内容 |
|---|---|---|
| 1 | 整页渲染不崩 | `render(<App/>)` 不抛（回归 `undefined.map` 类崩溃） |
| 2 | 顶部 4 层结构 | 菜单(tool/View/Setting/Short) + 通道(IR1/IR4_B) + 工具(Open/Save) + 子工具(IRG4_GR) |
| 3 | 主区左右分栏 | `.main-canvas` + `.right-panels`；右侧 6 个 legend（Mouse Point / Reduction Image / Image Processing / Validation Result / Notes / Result Details） |
| 4 | 主画布三层 | image-pane-label 含 `IR1` 与 `IR2`；存在 `数据1` 选择栏 |
| 5 | 底部行齐全 | Make Graph / Statistics / Coordinate File: / Hongkong |
| 6 | 工具栏点击 | 点击 Open 不崩 |
| 7 | 菜单 Finish 弹窗 | tool → Finish → 出现 "Save current results before exit" |
| 8 | 右键菜单 | `.image-stack` contextMenu → 出现 `Grid` |
| 9 | Alt+R 快捷键 | `keydown(R, altKey)` → 出现 "Are you sure to continue processing" |
| 10 | 通道切换 | 点击 IR2 → 该按钮 `active` |
| 11 | 底部按钮 | Mul-X / Save Graph / Graph (Combine) / Clear / Load Graph(×2) 点击不崩 |

### 4.2 子组件测试

| 组件文件 | 用例数 | 覆盖要点 |
|---|---|---|
| `ChannelTab.test.jsx` | 4 | 8 通道按钮 + Gp-Grapfot×2 + ablc(IR-Gp) + Gp/Gr；默认高亮 IR1；点击 setChannel 索引正确（UV1→4）；高亮随 prop 变化 |
| `ToolbarRow.test.jsx` | 4 | 8 工具按钮；状态副文本(IR1-Gp/Mul-X1/graph1.grp)；点击 onAction 参数；无 onAction 不崩 |
| `SubToolbarRow.test.jsx` | 3 | 13 按钮全渲染；active 高亮；点击 setActive + pushHistory |
| `DataSelectorBar.test.jsx` | 6 | **不传 props 不崩**；数据1/数据2 下拉 + 4 操作按钮；各含 4 默认项；枚数/P1/P2；切换触发 pushHistory；Go 不崩 |
| `ImagePane.test.jsx` | 5 | 标题 label；黑底 canvas 节点；small 缩略图；height 样式生效；无 title 不崩 |
| `MousePointCompact.test.jsx` | 4 | legend + Show(V)/Switch View/Clear；Show 默认勾选可切换；点击触发 pushHistory；Width/Height/Decide |
| `ReductionImageCompact.test.jsx` | 3 | 文件输入 + 4 缩略图；Reduction 1/2 标签；4 按钮触发 pushHistory |
| `ParamPanelGroup.test.jsx` | 5 | 4 参数行；每行 combo+slider+数值；拖动 slider 更新数值；Restore Image + Fix Image；Restore 触发 pushHistory |
| `ValidationCompact.test.jsx` | 3 | 8 结果单元；字段名(ver/OK/le/se/irAdd/gAdd/binaryAdd/speed)；IR_Additive 输入 |
| `NotesRow.test.jsx` | 2 | 9 notes 单元；全部标签出现 |
| `BigListPanel.test.jsx` | 3 | 表头 4 列；非空数据行；含 GP / IR1 类型 |
| `ThRow.test.jsx` | 3 | 7 下拉 + 2 个 r + 4 括号；4 操作按钮；点击触发 pushHistory |
| `GraphCombine.test.jsx` | 3 | 6 按钮全渲染；different neighbour/R/W/Diff 元数据；AB 按钮触发 pushHistory('AB Graph') |
| `AppStatusBar.test.jsx` | 2 | 状态项(Hongkong/IR offset=128/GP offset=128/MODE 1/Normal Mode)；末位 0% |
| `MakeGraphRow.test.jsx` | 4 | 6 复选框默认全勾选；可取消；Make Graph 触发 pushHistory；无 pushHistory 不崩 |
| `StatisticsRow.test.jsx` | 3 | Start/Step/Times 默认值(0/1/16)；1<2 可切换；Statistics 触发 pushHistory |
| `GraphFileRow.test.jsx` | 5 | 文件名默认 graph1.grp；Mul-X/系数/ABS；Load/Save/Clear/Combine；ABS 可取消；Load 不崩 |
| `StatusBar.test.jsx` | 3 | Coordinate/Function 两栏 + 2×Change；默认路径(85901.txt/functions.txt)；Change 触发 onChange |
| `TopMenuBar.test.jsx` | 5 | 4 顶级菜单 + 文件名；点击展开子菜单；Setting 含 Load/Create 多级；Leaf 触发 pushHistory+setActiveMenu(null)；Finish 触发 setActiveDialog('finish') |
| `DialogModal.test.jsx` | 4 | 标题+内容+关闭；点击 action 触发 onAction；X 触发 onClose；多 action 全渲染 |
| `ContextMenu.test.jsx` | 4 | 主菜单项(含子菜单)；leaf 触发 onAction('grid')；Close 触发 onClose；子项触发 onAction('gradient') |
| `ListResultsView.test.jsx` | 4 | 表头；行数 = 数据长度；OK/NG 标记；空数组显示 No results |
| `S2Chart.test.jsx` | 3 | 标题 + SVG；空数据不崩；含 path/polyline |
| `GraphPanel.test.jsx` | 3 | 标题 + 文件名；S2 子图 SVG；多文件渲染 graph1.grp 与 graph2.grp |

## 5. 编写规范（踩坑经验）

1. **组件自给自足**：所有展示组件不依赖外部 props 即可 `render(<X/>)` 通过。需要数据时内置 `useState` 默认值。
2. **查询歧义处理**：同文本在多处出现（如 `IR1`/`IR2`/`Finish`/`Load Graph`/`graph1.grp`/`GP`/`OK`）时，
   必须用 `getAllByRole` / `getAllByText` 或限定 `container.querySelector` 精确容器，不可用 `getBy*`。
3. **空数据兜底**：图表/列表组件须处理 `data=[]` 或 `undefined`，避免 `Math.max(...undefined)` / `undefined.map` 崩溃。
4. **回调兜底**：`onAction`、`pushHistory`、`onClose` 等回调统一用 `?.()` 调用，测试可不传。
5. **交互用 fireEvent**：点击 `fireEvent.click`、输入 `fireEvent.change`、键盘 `fireEvent.keyDown`。

## 6. 回归示例

- `DataSelectorBar`：旧版依赖 12 个外部 props，App 重构后未传 → 生产 `undefined.map` 崩溃。测试 `不传 props 不崩` 用例可拦截此类回归。
- `S2Chart`：旧版读 `s2` 而非 `data` 且无兜底 → 空数据崩溃。已改为 `data ?? s2 ?? []`。
