# Singan2 Web UI 1:1 像素级复刻 — 视觉模型对照清单

> **用途**：将此文档 + 原版截图一起发给支持图片输入的多模态模型（Claude/GPT-4o/混元VL等），让它逐项比对"原版截图 vs 当前 Web 复刻"，输出精确修改指令。
>
> **原始资源位置**：
> - 原版 Win32 源码：`E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\`（`resource.rc` / `WinMain.cpp` / `ShortMenu.cpp`）
> - 原版截图目录：`E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\docs\images\`（22 张，见下方清单）
> - Web 复刻代码：`E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\web\src\`（React + CSS）

---

## 一、全局布局参数

| 参数 | 原版值 | Web 当前值 | 状态 |
|------|--------|-----------|------|
| 主窗口设计尺寸 | 截图 1920×1080 → 等比 **1283 × 682** | 1283 × 682（`.main-window`） | ✅ 一致 |
| 缩放策略 | 无（固定窗口） | `transform: scale(min(100vw/1283, 100vh/800))` 缩进可视区 | ✅ 已修正（不再裁切底部） |
| 左侧主画布宽度 | 613px（与 ChannelTab/SubToolbar 右边界对齐） | 613px 固定（`.main-canvas`） | ✅ 已对齐 |
| 右侧面板宽度 | 666px（X:613–1279） | 666px（`.right-area`） | ✅ 一致 |
| 左右分界线 | X=613（abs(IR-Gp) 按钮右沿） | 613px 处 | ✅ |
| 右侧内分两列 | 左 613–980 / 右 980–1279（Result Details） | `.rp-inner-left`(367) / `.rp-inner-right`(303) | ✅ |

**关键截图参考**：
- `原版_主窗口.png` — 整体布局基准
- `原版_图像视图.png` — IR1/IR2 双图 + 工具条

---

## 二、顶部区域（自上而下）

### 2.1 标题栏 TitleBar (top:0, h:22)

| 元素 | 原版文字 | Web 当前 | 状态 |
|------|---------|----------|------|
| 左侧标题 | `Authentic2(2006)012) 31 denomenation supplemental function` | 同左 | ✅ |
| 右侧按钮 | `Adjust to 1400x1050` | 同左 | ✅ |

**原版参考**：`原版_主窗口.png` 最顶部

---

### 2.2 菜单栏 TopMenuBar (top:22, h:22)

| 菜单项 | 子菜单内容（原版） | Web 当前 | 状态 |
|--------|-------------------|----------|------|
| **tool** | History / Finish | 同左 | ✅ |
| **View** | Grid / Information (4 Tab) / Image ▸ 7 Reductions | 同左 | ✅ |
| **Setting** | Setting Dialogue / Load ▸ (coord/ATB/data) / Create1/2/3 / Country | 同左 | ✅ |
| **Short** | Calculate all ComboBox | 同左 | ✅ |

**子菜单截图参考**：
- `tool_01.png` ~ `tool_09.png` — 各菜单展开状态
- `原版_菜单.png` / `原版_菜单01.png` / `原版_菜单03.png`

**⚠️ 待核对项**：
- [ ] 菜单字体大小是否与原版一致（原版约 11-12px Tahoma）
- [ ] 菜单项间距/padding 是否匹配
- [ ] 子菜单弹出位置（left/top 偏移）是否正确

---

### 2.3 主通道标签行 ChannelTab (top:44, h:22, w:540)

**原版真实数据（来自 `WinMain.cpp` ImgType[0..9]）**：

| # | 按钮文字 | Web 当前 | 状态 |
|---|---------|----------|------|
| 1 | `IR1 (A1)` | `IR1 (A1)` | ✅ |
| 2 | `Green P (B)` | `Green P (B)` | ✅ |
| 3 | `Green Ref_F (C)` | `Green Ref_F (C)` | ✅ |
| 4 | `Green Ref_B (D)` | `Green Ref_B (D)` | ✅ |
| 5 | `Blue Ref_F (E1)` | `Blue Ref_F (E1)` | ✅ |
| 6 | `Blue Ref_B (E2)` | `Blue Ref_B (E2)` | ✅ |
| 7 | `IR^2/64` | `IR^2/64` | ✅ |
| 8 | `IR-Gr+offset` | `IR-Gr+offset` | ✅ |
| 9 | `Gp-Gr+offset` | `Gp-Gr+offset` | ✅ |
| 10 | `abs(IR-Gp)` | `abs(IR-Gp)` | ✅ |

**⚠️ 待核对项（需看截图）**：
- [ ] 10 个按钮是否**等宽分布**填满 540px（当前用 `flex:1 1 0`）
- [ ] 最后一个 `abs(IR-Gp)` 的右边界是否与下方主画布右边缘对齐
- [ ] 按钮高度/内边距是否与原版一致
- [ ] 选中态样式（白底蓝边）是否匹配

**原版参考**：`原版_主窗口.png` 第 2 行按钮组

---

### 2.4 副通道工具条 SubToolbarRow (top:66, h:22, w:540)

**原版真实数据（来自 `WinMain.cpp` ImgType[10..21]）**：

| # | 按钮文字 | Web 当前 | 状态 |
|---|---------|----------|------|
| 11 | `IR - Gp`（空格+减号） | `IR - Gp` | ✅ |
| 12 | `(IR-Gp)^2/8` | `(IR-Gp)^2/8` | ✅ |
| 13 | `Gp - IR` | `Gp - IR` | ✅ |
| 14 | `IR & Gp` | `IR & Gp` | ✅ |
| 15 | `IR \| Gp` | `IR \| Gp` | ✅ |
| 16 | `Red Ref_F (F1)` | `Red Ref_F (F1)` | ✅ |
| 17 | `Red Ref_B (F2)` | `Red Ref_B (F2)` | ✅ |
| 18 | `UV1` | `UV1` | ✅ |
| 19 | `UV2` | `UV2` | ✅ |
| 20 | `IR2 (A2)` | `IR2 (A2)` | ✅ |
| 21 | `IR3_F (A3)` | `IR3_F (A3)` | ✅ |
| 22 | `IR4_B (A4)` | `IR4_B (A4)` | ✅ |

**⚠️ 待核对项**：
- [ ] 12 个按钮等宽分布是否正确
- [ ] 右边界是否与上方 ChannelTab 对齐（都在 540px 处）
- [ ] 与主通道两行的间距是否匹配原版

**原版参考**：`原版_主窗口.png` 第 3 行按钮组

---

## 三、主区域（row-main: top:88, h:532）

### 3.1 左半部 — 主画布 main-canvas (w:540)

#### 3.1.1 IR1 图像区 (ImagePane)
| 属性 | 原版 | Web 当前 | 状态 |
|------|------|----------|------|
| 标签 | `IR1` 左上角 | `IR1` | ✅ |
| 内容 | 真币红外图像（黑底灰点） | CSS 渐变模拟噪点 | ⚠️ 占位 |
| 右侧直方图 | 28px 宽竖条直方图 | 28px `.image-pane-hist` | ✅ 结构一致 |
| 高度占比 | 约 50%（含中间 DataSelectorBar） | flex:1 | ✅ |

#### 3.1.2 DataSelectorBar（仅 1 条，在 IR1 与 IR2 之间）
| 元素 | 原版 | Web 当前 | 状态 |
|------|------|----------|------|
| Edit 按钮 | 有 | 有 | ✅ |
| Clear 按钮 | 有 | 有 | ✅ |
| 文件路径输入框 | 显示 .bin/.dat 路径 | 有 | ✅ |
| 方向按钮 `< (B)` / `(N)` / `>` / Go | 有 | 有 | ✅ |
| 枚数计数器 | `枚数: _ / _` | 有 | ✅ |
| Sync Move 复选框 | 有 | 有 | ✅ |
| 第二条 DataSelectorBar（IR2 下方） | **无** | **已删除** | ✅ 用户要求删 |

**⚠️ 待核对项**：
- [ ] DataSelectorBar 高度是否为 22px
- [ ] 各按钮/输入框的相对位置和大小是否与原版一致
- [ ] 文件路径显示的字体（monospace 10px）是否匹配

**原版参考**：`原版_图像视图.png` 中 IR1 下方的灰色工具条

#### 3.1.3 IR2 图像区 (ImagePane)
| 属性 | 原版 | Web 当前 | 状态 |
|------|------|----------|------|
| 标签 | `IR2` 左上角 | `IR2` | ✅ |
| 内容 | 真币红外图像 | CSS 渐变模拟 | ⚠️ 占位 |
| 右侧直方图 | 28px 宽 | 28px | ✅ |
| 下方工具条 | **无**（用户明确要求删除） | **已删除** | ✅ |

**⚠️ 待核对项**：
- [ ] IR1 和 IR2 是否各占约一半高度（中间被 DataSelectorBar 分隔）
- [ ] 两张图是否**完全沾满**主画布宽度（540px 减去边框）
- [ ] IR1/IR2 的右边界是否与 abs(IR-Gp) 按钮右沿对齐

**原版参考**：`原版_图像视图.png` 整个左侧区域

---

### 3.2 右半部 — 控件面板 right-area (w:666, 从 x=613 起，内分两列)

**布局方式**：`.right-area` 内绝对定位，左列 `.rp-inner-left`(X:613–980) 按 DeepSeek 逆向 y 坐标堆叠；右列 `.rp-inner-right`(X:980–1279) 放 Result Details。

| # | 面板组件 | 原版位置(Y) | 原版控件 | Web 当前 | 状态 |
|---|---------|------------|---------|----------|------|
| 1 | MousePointCompact | Y:70 | Show(V)**按压按钮**/Switch View/Clear + Width/Height/Decide | 同左（Show(V)已改按钮） | ✅ |
| 2 | ReductionImageCompact | Y:100 | 路径+4缩略图+Clear 4D/Load/Show All/Save List/**Set 4D** | 同左（已补 Set 4D） | ✅ |
| 3 | ParamPanelGroup | Y:220 | Gradient/Binary/Step/Noise + **原生 slider** + Restore/Fix Image | 同左（range 滑块） | ✅ |
| 4 | OperationPanel | Y:310 | Real/Test + 4 checkbox + 7按钮 + **F1~F8 + Ope.(Start)** | 同左 | ✅ |
| 5 | ValidationCompact | Y:400 | Validation Result 文本区 | 同左 | ✅ |
| 6 | NotesRow | Y:470 | Real Text/BV check note/... | 同左（已恢复） | ✅ |
| 7 | ThRow | Y:540 | (TH1) IR1 IR2 UV1 | 同左 | ✅ |
| 8 | MakeGraphRow | Y:560 | 1/2/Black/White/+Area/+TH + Start/Step/Times + Make Graph | 同左 | ✅ |
| 9 | RightGraphArea | Y:590 | Statistics + Graph File(graph1.grp/Mul-X/Load/Save/ABS/Combine) + Graph编辑框(S2) | 整合块 | ✅ 结构/⚠️ y细分 |
| 10 | ResultDetails | Y:80 (右列) | 灰底数据区 Binary file 33185... | 新建组件 | ✅ |

**⚠️ 待核对项（重点！）**：
- [ ] 每个面板的 y 坐标是否精确对齐 DeepSeek 逆向值（见上表）
- [ ] 面板内部控件排列（尤其 OperationPanel 的 F1–F8 矩阵）是否与原版一致
- [ ] ParamPanelGroup 的 slider 样式（原版 Windows 原生 trackbar）是否接近
- [ ] RightGraphArea 内 Statistics/GraphFile/Graph编辑框 的垂直细分是否对齐原版 590/650

**原版参考**：`原版_主窗口.png` 右半部分全部面板

---

## 四、底部区域

> **布局变更（2026-08-23 第十一轮）**：原分散的 MakeGraphRow/StatisticsRow/GraphFileRow/GraphPanel/StatusBar/AppStatusBar 已整合：
> - Graph 区（Statistics + Graph File + Graph编辑框 + S2Chart）并入 **RightGraphArea**（置于右侧 Y:590，非全宽底部行）
> - Coordinate/Function 状态条 + AppStatus 底栏整合为 **BottomStatusRow**（全宽绝对定位 Y:660，横跨 X:0–1283）

### 4.1 RightGraphArea（右侧 Y:590，X:613–1279）
| 元素 | 原版 | Web 当前 | 状态 |
|------|------|----------|------|
| 文件名 graph1.grp / 函数列表(S2/S2_DIFF...) | 有 | 有 | ✅ |
| Make Graph（1/2/Black/White/+Area/+TH） | 由独立 MakeGraphRow 提供(Y:560) | 同左 | ✅ |
| Start/Step/Times 输入 | 有 | 有 | ✅ |
| Statistics 按钮 | 有 | 有 | ✅ |
| Load Graph / Save Graph / graph2.grp / ABS / Clear / Combine | 有 | 有 | ✅ |
| S2 折线图（ECharts） | 原版自绘 GDI 图表 | ECharts 模拟 | ⚠️ 视觉近似 |

### 4.2 BottomStatusRow（全宽 Y:660）
| 元素 | 原版 | Web 当前 | 状态 |
|------|------|----------|------|
| Coordinate File 路径输入框 + Change | 有 | 有（输入框） | ✅ |
| Function Name 文件输入框 + Change | 有 | 有（输入框） | ✅ |
| AppStatus 底栏（HongKong/IR offset=128/GP offset=128/二值图像清/回忆速度 32/[MODE]1/Normal Mode/0%） | 有 | 有 | ✅ |

**⚠️ 待核对项**：
- [ ] RightGraphArea 内 Statistics/GraphFile/Graph编辑框 的 y 细分是否对齐原版 590/650
- [ ] BottomStatusRow 全宽是否跨越整个窗口（X:0–1283）
- [ ] Coordinate File 路径输入框是否完整显示不截断

**原版参考**：`原版_主窗口.png` 底部全部行；`原版_图形窗口.png` 图表区

---

## 五、对话框（DialogModal）

| 对话框 | 触发方式 | 原版截图 | Web 当前 | 状态 |
|--------|---------|---------|----------|------|
| Cont. Confirm | Alt+R 或 Short→Calculate all | `原版Alt+R.png` | 有 | ✅ |
| Coordinate Settings | Setting→Load→Coordinate | `原版_Setting对话框.png` | 有 | ✅ |
| Finish Confirm | tool→Finish | — | 有 | ✅ |
| Load Coordinate File | 点击 Status Change | — | 有 | ✅ |
| Load Function Name | 点击 Status Change | — | 有 | ✅ |
| Country Dictionary | Setting→Country | `tool_09.png` | ❌ 未实现 | ⚠️ 低优先级 |

**原版参考**：`原版_Setting对话框-01.png`、`原版Alt+R.png`

---

## 六、右键菜单（ContextMenu）

| 菜单项 | 原版命令 ID | Web 当前 | 状态 |
|--------|------------|----------|------|
| Grid | — | 有 | ✅ |
| Restore | — | 有 | ✅ |
| Mouse Point (&V) | — | 有 | ✅ |
| Show Area ▸ | Do'nt Show / Show absolute / Show Speed Adjusted | 有 | ✅ |
| Show Information | — | 有 | ✅ |
| Detail Setting | — | 有 | ✅ |
| Image Prosess ▸ | Gradient / Binary Segmentation / Noise reduction / Restore | 有 | ✅ |
| Switch View | — | 有 | ✅ |
| Re-Load Coordinate | — | 有 | ✅ |

**原版参考**：`主界面右键.png`

---

## 七、已知差异 / 待修复清单（按优先级排序）

> 更新于 2026-08-23 第十二轮（基于 DeepSeek 逆向坐标已完成主体改造 + 第二次截图核对）

### ✅ 已完成（第十~十二轮回填）
1. **坐标系统一**：Web 主窗口 1283×682，左/右分界 X=613，与原版一致
2. **缩放策略修正**：`scale(max)` → `scale(min)`，底部不再被裁切
3. **右侧两列布局重构**：按 DeepSeek 逆向 y 坐标绝对定位（inner-left 613–980 / inner-right 980–1279）
4. **补齐 ResultDetails / RightGraphArea / BottomStatusRow**
5. **样式修正**：MousePoint Show(V) 改按压按钮；ReductionImage 补 Set 4D
6. **纠错**：删除臆造的 GASOTI/VTB/BigListPanel；OperationPanel 正名（原版真有）
7. **Image Processing 滑块**：ParamPanelGroup 用原生 range（非下拉框）
8. **Operation 完整**：F1–F8 矩阵 + Ope.(Start) + Function processing/Other mode 复选框均在
9. **Make Graph / Statistics / Graph File / S2 图表**：RightGraphArea 整合已实现
10. **AppStatus 数值**：`0%` → 原版 `-25%`（第十二轮修复）

### 🟡 中优先级（像素级复核，需截图 + 视觉模型）
11. **IR1/IR2 图区高度**：原版各 250px（88–338 / 360–610），当前 flex 等分需确认未拉长
12. **直方图 28px 可见性**：代码已有，缩放后是否仍显示（肉眼确认）
13. **副通道文字空格**：`IR - Gp` 是否带空格（当前 `IR-Gp` 无空格）
14. **RightGraphArea 内 y 细分**：Statistics(590)/GraphFile/Graph编辑框(650) 对齐
15. **面板间距/gap** 与原版一致性

### 🟢 低优先级（功能占位）
16. **IR1/IR2 真实图像**：CSS 渐变占位 → 接图像管线替换
17. **GraphPanel 图表样式**：ECharts vs 原版 GDI 自绘，视觉近似
18. **Country Dictionary 对话框**：原版机械翻译残留，可替换

> ⚠️ **截图一致性提醒**：DeepSeek 对比须基于最新 dev server(:5173) 截图。第十二轮发现其第二次清单仍大量报告"已完成的缺失项"，因对比基准是改造前旧图。每次贴图前请先用 `npm run dev` 起最新服务并截图。

---

## 八、使用指南（给视觉模型的 prompt 模板）

```
你是一个前端 UI 还原专家。请帮我对比以下两张图：

【原图】（原版 Win32 程序截图）：[附上 原版_主窗口.png]
【复刻图】（当前 Web 复刻截图）：[附上 Web 浏览器截图]

请按照以下清单逐项检查，输出格式：
✅ 一致 / ❌ 不一致 / ⚠️ 需微调

检查项：
1. 标题栏文字和按钮位置
2. 菜单栏 4 个菜单项（tool/View/Setting/Short）的位置和字体
3. 主通道 10 个按钮的文字、宽度分布、右边界位置
4. 副通道 12 个按钮的文字、宽度分布、是否与主通道右对齐
5. 左侧主画布：
   a. IR1 图像区高度和宽度
   b. IR1 下方 DataSelectorBar 的各元素位置
   c. IR2 图像区高度和宽度
   d. IR2 下方是否有工具条（应该没有）
   e. IR1/IR2 右边界是否与 abs(IR-Gp) 按钮右沿对齐
6. 右侧 8 个面板的：
   a. 每个面板的标题和内部控件
   b. 面板之间的间距
   c. 整体高度是否与左侧主画布对齐
7. 底部各行的顺序和内容
8. 整体是否铺满浏览器窗口

对于每个不一致项，请给出具体的 CSS 修改建议（含选择器和属性值）。
```

---

## 九、原始截图索引（22 张）

| 文件名 | 内容描述 | 主要用于核对 |
|--------|---------|-------------|
| `原版_主窗口.png` | 完整主界面运行态 | 全局布局基准 |
| `原版_图像视图.png` | IR1/IR2 双图模式 | 主画布 + DataSelectorBar |
| `原版_列表视图.png` | 列表视图模式 | ListResultsView 组件 |
| `原版_图形窗口.png` | Graph 分析图表 | GraphPanel + S2Chart |
| `原版_ACSV .png` | CSV 导出结果 | StatusBar 导出链路 |
| `原版_数据加载区.png` | 数据加载区域 | DataSelectorBar 详情 |
| `原版_菜单.png` | 顶部菜单栏 | TopMenuBar |
| `原版_菜单01.png` | tool 菜单展开 | tool 子菜单 |
| `原版_菜单03.png` | View/Setting 菜单 | View/Setting 子菜单 |
| `原版_Setting对话框.png` | Setting 对话框 | DialogModal |
| `原版_Setting对话框-01.png` | Setting 详细 | DialogModal 细节 |
| `原版Alt+R.png` | Alt+R 确认框 | Cont. Confirm dialog |
| `主界面右键.png` | 右键上下文菜单 | ContextMenu 14 项 |
| `tool_01.png` ~ `tool_09.png` | 各菜单子项展开 | 菜单结构逐项核对 |

---

*文档生成时间：2026-08-23*
*适用于：Claude 3.5+/GPT-4o/通义千问 VL/混元 Vision 等多模态模型*
