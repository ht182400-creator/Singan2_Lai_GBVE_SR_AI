# Web UI 布局说明（1:1 绝对定位复刻版 · 对照 resource.rc）

> 用途：发给核对者（DeepSeek / 多模态模型）逐条对照 Web 实际坐标与 `resource.rc` 原始坐标，验证还原度。
>
> **⚠️ 布局冻结声明（2026-08-23）**：本布局已定稿，**左侧 UI 已固定，禁止再改**。后续任何改动只允许微调右侧面板内部坐标，不得调整 `main-canvas` 宽度、`.right-area` 起点、主窗口尺寸、顶部 Tab 宽度等结构性参数（除非用户明确要求）。

---

## 〇、冻结的结构常量（勿改）

| 常量 | 值 | 说明 |
|---|---|---|
| 主窗口 `.main-window` | `1700 × 1050` | `transform: scale(min(100vw/1700, 100vh/1050))`，`transform-origin: top left` |
| 顶部 TitleBar / TopMenu | 宽 `1700` | 全宽 |
| 主通道 Tab `.channel-tab` | `left:0; top:34; width:900; height:34` | 左半画布宽 |
| 副通道 `.sub-toolbar` | `left:0; top:68; width:900; height:22` | 左半画布宽 |
| **左侧画布 `.main-canvas`** | **`left:0; top:88; width:900; height:912`** | **✅ 已固定（用户确认），不要再动** |
| **右侧区 `.right-area`** | **`left:900; top:88; width:800; height:682`** | **起点 900 = 左侧画布右沿** |
| 底部状态栏 `.bottom-status` | 宽 `1700`；高 `28`；`bottom:0` | 全宽贴底 |
| Coordinate/Function 行 `.bs-coord` | `left:900; bottom:32; width:800` | 贴右区起点 |

> **坐标换算规则（右侧面板）**：`right-area` 内部原点对应全局 X900 / Y88。
> - 面板内部 `left = rcX - 900`
> - 面板内部 `top = rcY`
> - 全局 X = 900 + left；全局 Y = 88 + top
> - `rcX < 900` 的面板（Mouse Point / Image Processing / Validation / Operation / Make Graph / Notes / TH Row / Statistics）被 clamp 到 `left:0`（即贴右区起点 X900），避免溢出到左侧画布。

---

## 一、左侧主画布（X0–900，✅ 已固定，未参与后续重构）

| 区域 | Web 组件 | 位置说明 |
|---|---|---|
| IR1 标题 + 图像 + 直方图(28px) | ImagePane | `top:88` 起，图像区宽至 X900 右沿，右侧 28px 直方图 |
| Data1 选择器 | DataSelectorBar | Y327–355：Edit/Clear/路径/<(B)/(N)/>/Go/枚数/1/4/40 |
| IR2 标题 + 图像 + 直方图 | ImagePane | Y360 起 |
| Data2 选择器(+Sync Move) | DataSelectorBar | Y560–582 |
| 顶部标题/菜单/通道 Tab/副通道 | TitleBar/TopMenuBar/ChannelTab/SubToolbarRow | tool/View/Setting/Short + 主10/副12，宽均 900 |
| 底部状态栏 | BottomStatusRow | HongKong…-25% 贴底全宽（左下） |

> **左侧固定要点**：画布宽 **900px**（非原版 613）。IR1/IR2 大图在此宽度内自适应填充；顶部两排 Tab 宽 900；副通道 12 按钮一行均分 900。这些均与用户已确认的一致，**不要再尝试改回 613 或做其他比例调整**。

---

## 二、右侧面板：Web 实际坐标（相对 right-area，起点 X900）

| 面板 | Web class | Web 内部(left,top) | 对应 .rc (X,Y) | 全局位置 |
|---|---|---|---|---|
| Mouse Point | `.rc-mouse-point` | (0, 1) | (631, 1) | X900 Y89（clamp） |
| Reduction Image 1 | `.rc-reduction-1` | (201, 2) | (1101, 2) | X1101 Y90 |
| Reduction Image 2 | `.rc-reduction-2` | (282, 2) | (1182, 2) | X1182 Y90 |
| Image Processing | `.rc-image-processing` | (0, 77) | (630, 77) | X900 Y165（clamp） |
| Validation Result (N=1/N=2) | `.rc-validation` | (0, 216) | (630, 216) | X900 Y304（clamp） |
| Operation | `.rc-operation` | (0, 350) | (630, 350) | X900 Y438（clamp） |
| Notes | `.rc-notes` | (0, 530) | (630, 530) | X900 Y618（clamp） |
| TH Row | `.rc-th-row` | (0, 570) | (630, 570) | X900 Y658（clamp） |
| Make Graph 行 | `.rc-make-graph` | (0, 341) | (630, 341) | X900 Y429（clamp） |
| Statistics 行 | `.rc-statistics` | (0, 342) | (892, 342) | X900 Y430（clamp） |
| Graph File 行 | `.rc-graph-file` | (97, 265) | (997, 265) | X997 Y353 |
| Graph1 黑底编辑框 | `.rc-graph1` | (168, 361, 185×128) | (1068, 361, 185×128) | X1068 Y449 |
| Graph2 黑底编辑框 | `.rc-graph2` | (168, 492, 186×139) | (1068, 492, 186×139) | X1068 Y580 |
| S2Chart 图表 | `.rc-s2chart` | (361, 361, 130×270) | （Graph 区右侧绘图） | X1261 Y449 |
| 最右端大区(ResultDetails+ATB) | `.rc-right-end` | (16, 16, 宽484) | (916, 16, 宽484) | X916 Y104 |
| Coordinate/Function 行 | `.bs-coord` | 全局 (900, 底32) 宽800 | — | X900 起，右侧底部 |
| 底部状态栏 | `.bottom-status` | 全局 (0, 底0) 宽1700 | (629, 646) + 底栏 | 全宽贴底 |

> 注：`right-area` 内部 `top` 即 .rc 的 Y 值；全局 Y = 88 + top。
> 例：Mouse Point 内部 top:1 → 全局 Y89；Image Processing top:77 → 全局 Y165。
> `rcX ≥ 900` 的面板（Reduction / Graph / Graph File / 最右大区）全局坐标精确等于 .rc；`rcX < 900` 的面板 clamp 到 X900（右区起点）。

---

## 三、当前 Web 结构（冻结版）

```
.main-window (1700×1050, relative, scale min(100vw/1700,100vh/1050))
├─ 顶部: TitleBar / TopMenuBar / ChannelTab / SubToolbarRow  (宽 1700 / Tab 宽 900, 占 Y0–90)
├─ .main-canvas (absolute X0 Y88 W900 H912)  —— 左侧 IR1/IR2/Data1/Data2 ✅固定
├─ .right-area (absolute X900 Y88 W800 H682)
│   ├─ .rc-mouse-point        (0,1)
│   ├─ .rc-reduction-1        (201,2)   ← Reduction Image 1（独立 GroupBox）
│   ├─ .rc-reduction-2        (282,2)   ← Reduction Image 2（独立 GroupBox）
│   ├─ .rc-image-processing   (0,77)    ← 滑块+数值框（无下拉框）
│   ├─ .rc-validation         (0,216)   ← N=1 / N=2 两组
│   ├─ .rc-operation          (0,350)   ← Real/Test+4check+7btn+F1–F8+Ope.Start
│   ├─ .rc-make-graph         (0,341)   ← 1/2/Black/White(+Area/+TH)+Make Graph+Start/Step/Times
│   ├─ .rc-statistics         (0,342)   ← graph1.grp + Mul-X/Load Graph/Save Graph
│   ├─ .rc-graph-file         (97,265)  ← graph2.grp + ABS/Clear/Graph(Combine)
│   ├─ .rc-graph1             (168,361,185×128)  ← 黑底编辑框
│   ├─ .rc-graph2             (168,492,186×139)  ← 黑底编辑框
│   ├─ .rc-s2chart            (361,361)  ← S2 图表
│   └─ .rc-right-end          (16,16,484)  ← 最右端：ResultDetails + ATB(TH1–4/列表/按钮)
├─ .bs-coord (absolute X900 底32 W800)  ← Coordinate File / Function Name（右侧底部）
└─ .bottom-status (absolute X0 底0 W1700 H28)  ← 底部 HongKong…-25%（左下贴底）
```

---

## 四、已完成的控件级 1:1 还原（供核对）

- ✅ Mouse Point：Show(V) 按钮 + Width/Height(Decide)
- ✅ Image Processing：**已删下拉框**，仅滑块 + 数值框（Gradient→Gain / Binary→Threshold / step→Movement / Noise）
- ✅ Reduction Image：**两个独立 GroupBox**（X1101 / X1182），各含文件名 + 2 缩略图 + Clear4D/Load/Show/ShowAll/SaveList/Set4D + 对比结果
- ✅ Validation：**N=1 与 N=2 两组**（IR Adictive / G Adictive 等）
- ✅ Operation：Real/Test + Check note/Reason/Function processing/Other mode + IR-Vi…reserved(7) + **F1–F8 + Ope.(Start)**
- ✅ ATB（最右端）：TH1–4 单选 + 列表 + Clear4D/Load/Show/ShowAll/Save/Set4D
- ✅ Graph 编辑框：**黑底大框**（Graph1 185×128 / Graph2 186×139）+ S2Chart
- ✅ Make Graph 行：Black/White **单选** + +Area/+TH 复选
- ✅ Result Details：表格(Detail/Thresh/Value/Judge) + OK/NG
- ✅ 状态栏：HongKong / IR offset / GP offset / [MODE] 1 / Normal Mode / -25%
- ✅ Coordinate/Function 行：移至右侧底部（X900 起），不再遮挡左侧 Graph1

---

## 五、供核对者的检查清单

1. 左侧画布宽是否仍为 **900**（冻结值，勿改）；顶部两排 Tab 宽是否 900
2. 右侧所有面板 `top` 是否与 .rc 的 Y 一致（换算：全局Y = 88 + top）
3. Reduction Image 1/2 是否在最右端 (X1101/X1182)，而非左列
4. Graph1/Graph2 黑框尺寸是否为 185×128 / 186×139
5. 最右端大区(ResultDetails+ATB)是否在 X916 起、宽 484
6. 底部状态栏是否贴底全宽 1700；Coordinate/Function 行是否在右侧底部 X900 起
7. 是否存在任何面板重叠或溢出 right-area 边界（800×682）
