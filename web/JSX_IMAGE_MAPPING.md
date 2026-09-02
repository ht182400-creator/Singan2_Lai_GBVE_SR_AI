# JSX ↔ 原版界面 映射表（含 Web 进度）

> 目的：把 `web/src` 下的 React 组件与原版 MFC 界面（截图 1=主界面、截图 2=右侧面板区 / `resource.rc`）一一对应，并标注 Web 端实现进度，作为移植追踪表。
>
> 坐标来自 `Singan2_Lai_GBVE_SR_OLD/resource.rc`（x,y 为对话框内像素，是右侧面板定位的基准）。
> 图例：🟦截图1（整体布局）、🟩截图2（右侧 Operation History 等面板）、`resource.rc` 直接标坐标。
> **Web 状态**：✅ 已完成 / 🔶 部分（核心可用、细节简化） / 🟡 占位（仅 UI、功能待接） / ⚪ 未实现。

## 1. 顶层 / 框架

| JSX 文件 | 组件 | 原图区域 | resource.rc / 说明 | Web 状态 |
|---|---|---|---|---|
| `App.jsx` | `<RC>` 容器编排 | 整个对话框 | 右侧 7 个 panel 由 `RC.jsx` 统一包 `.rc-*` 绝对定位 | ✅ |
| `TitleBar.jsx` | 标题栏 | 🟦 窗口标题行 | 窗口标题 "SINGAN2 ..." | ✅ |
| `TopMenuBar.jsx` | 菜单条 | 🟦 第 1 行 | tool / View / Setting / Short / ROM / Window | 🔶 菜单容器完成，部分菜单项动作占位 |
| `ChannelTab.jsx` | 主通道标签 (10) | 🟦 第 2 行 | IR1(A1)…abs(IR-Gp) | ✅ |
| `SubToolbarRow.jsx` | 副通道/图像类型 (12) | 🟦 第 3 行 | IR-Gp … IR4_B(A4)（对照 WinMain.cpp `ImgType[10..21]`） | ✅ |
| `AppStatusBar.jsx` / `StatusBar.jsx` | 底部状态 | 🟦 底部 | HongKong / Status 文本 | ✅ |
| `BottomStatusRow.jsx` | 底部状态行 | 🟦 最底 | Coordinate File: / Function Name: 状态 | ✅ |

## 2. 主画布区（左）

| JSX 文件 | 组件 | 原图区域 | 说明 | Web 状态 |
|---|---|---|---|---|
| `ImagePane.jsx` | IR1 / IR2 主图 | 🟦 中部 | 上下双图 + 右侧直方图 strip（`.image-pane-hist`） | ✅ |
| `DataSelectorBar.jsx` | Data1 / Data2 数据选择条 | 🟦 第 4 行 | Edit / Clear / 路径组合框(▼下拉，复刻 `IDC_NAME_COMBO2`) / <(B) >(N) / 枚数 / Go / Sync Move | ✅ 路径下拉已可用（recent-paths 回填） |
| `GraphViewOverlay.jsx` | 画布叠加层 | 🟦 画布上 | 网格/选区叠加 | ✅ |
| `ContextMenu.jsx` | 右键上下文菜单 | 🟦 画布右键 | Grid / … | ✅ |
| `DialogModal.jsx` | 对话框 | 弹层 | Finish（菜单 Finish）、Cont. Confirm（Alt+R） | ✅ |

## 3. 右侧面板（RC.jsx 包裹，绝对定位）

| JSX 文件 | 组件 | 原图/截图 | resource.rc 坐标 | 内容 | Web 状态 |
|---|---|---|---|---|---|
| `MousePointPanel.jsx` / `MousePointCompact.jsx` | Mouse Point | 🟩 左上 | GROUPBOX `Mouse Point` (631,1,80,75) | Show(V) / Width / Hight / Coordinate / Decide | ✅ |
| `ReductionImagePanel.jsx` | Reduction Image 1/2 | 🟩 右 | GROUPBOX (1101,2) / (1182,2) | 缩略图对比结果 | 🟡 占位 |
| `OperationHistoryPanel.jsx`（App 内联） | Operation History + **Table Function 下拉** | 🟩 右上 | `IDC_RIREKI_LIST` (715,16) + `IDC_COMBO_SET_TABLE_FUNCTION` (715,55) | 列表 + 下拉 `000 IR-Gr+offset` 等 | ✅ 列表+下拉（Table Function 选中仅记历史，逻辑待接） |
| `ValidationPanel.jsx` / `ValidationCompact.jsx` | Validation Result | 🟩 中 | `Validation Result` (701,217) | LE/SE/IR Adictive 等显示 | 🟡 占位 |
| `ParamPanelGroup.jsx` | 参数组 | 🟩 中下 | step movement (629,145) / Noise reduction (630,179) | Default / Movement / Slider / Fix Image / Start | 🔶 部分（控件在，核心计算待接） |
| `NotesRow.jsx` | Notes | 🟩 下 | Notes | 备注文本 | ✅ |
| `OperationPanel.jsx` | Operation | 🟦 Make Graph 正下方 | `IDC_STATIC_OPERATION` | Real/Test + 4 checkbox + 7 按钮 + F1~F8 + Ope.(Start) + Load VER... | ✅ 控件齐全，部分按钮动作占位 |
| `ResultDetails.jsx` | Result Details | 🟩 下 | Result Details | 结果明细 | 🟡 占位 |
| `GraphPanel.jsx` / `RightGraphArea.jsx` | Graph 区 | 🟩 右下 | Make Graph (825,342) / Save Graph / Load Graph... | 图谱编辑/保存 | 🟡 占位 |
| `AtbPanel.jsx` | ATB 区 | 🟩 右 | `IDC_COMBO_ATB_TYPE` (917,16) + List (917,30) | Load.../Show/Type/4D | 🟡 占位 |
| `VtbPanel.jsx` | VTB 区 | 🟩 右 | `IDC_LIST_VTB` (916,175) + Tabs (915,147/161) | Load VTB.../Mode 标签 | 🟡 占位 |

## 4. 底部控制行

| JSX 文件 | 组件 | 原图区域 | 说明 | Web 状态 |
|---|---|---|---|---|
| `MakeGraphRow.jsx` | Make Graph 行 | 🟦 底部 | Make Graph / 1 2 / Black White / +Area / +TH | ✅ 已接后端 `/api/graph/make` |
| `StatisticsRow.jsx` | Statistics 行 | 🟦 底部 | Statistics / 1<2 / start-times-step | 🟡 占位 |
| `GraphFileRow.jsx` | Graph File 行 | 🟦 底部 | Save Graph / Graph(Combine) / Clear / Mul-X / Load... / Show... / Set 4D... | 🔶 控件在，部分动作占位 |
| `GasotiPanel.jsx` | 文本框 | 🟦 底部 | `IDC_GASOTI2` (811,280) 多行文本 | 🟡 占位 |
| `ThRow.jsx` | TH 行 | 🟩 | TH1~TH4 单选 + Clear / Clear 4D | ✅ |

## 5. 图谱绘制 / 结果视图

| JSX 文件 | 组件 | 说明 | Web 状态 |
|---|---|---|---|
| `GraphPlot.jsx` | 图谱绘制 | canvas 画曲线 | 🟡 基础画布，未接数据 |
| `GraphCombine.jsx` | Graph(Combine) | 合并图谱 | 🟡 占位 |
| `GraphResultPanel.jsx` | 图谱结果 | 结果展示 | 🟡 占位 |
| `ListResultsView.jsx` | 列表结果 | 列表视图 | 🟡 占位 |
| `S2Chart.jsx` | S2 图 | 散点/柱状 | 🟡 占位 |

## 6. 交互/工具（非可视区块）

| JSX 文件 | 用途 | Web 状态 |
|---|---|---|
| `RC.jsx` | 右侧面板统一包装（`.rc-{name}` + 标题），所有右侧面板经它挂载 | ✅ |
| `api.js` | 连接 Python core（`server.py`）的 REST 接口 | ✅ |
| `hooks/` | 状态 hook（selection / sync） | ✅ |
| `utils/` | 颜色映射、波段计算等 | ✅ |

---

## 进度汇总（按状态计数）
- ✅ 已完成：App、TitleBar、ChannelTab、SubToolbarRow、StatusBar×2、ImagePane、DataSelectorBar、GraphViewOverlay、ContextMenu、DialogModal、MousePoint、OperationHistory(列表+下拉)、NotesRow、Operation、MakeGraphRow、ThRow、RC、api、hooks、utils ≈ 21
- 🔶 部分：TopMenuBar、ParamPanelGroup、GraphFileRow ≈ 3
- 🟡 占位：ReductionImage、Validation、ResultDetails、GraphPanel/RightGraphArea、AtbPanel、VtbPanel、StatisticsRow、Gasoti、GraphPlot、GraphCombine、GraphResultPanel、ListResultsView、S2Chart ≈ 13
- ⚪ 未实现：0

> 说明：状态为依据当前实现的第一轮标注，如需精确核对请逐组件确认；可在本文件直接修订。

## 关键映射结论（易错点）
1. **Table Function 下拉**属于 `Operation History` 容器（`OperationHistoryPanel` / App 内联），**不是** `OperationPanel`（Make Graph 正下方）。
2. **路径下拉箭头**在 `DataSelectorBar.jsx` 的 `PathCombo`（复刻 `IDC_NAME_COMBO2`），两行 Data1/Data2 各一个。
3. **Operation 面板**`OperationPanel.jsx` 位于 Make Graph 正下方，含 7 按钮 + F1~F8，不含 Table Function。
