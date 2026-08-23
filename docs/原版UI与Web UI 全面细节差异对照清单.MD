# 原版 UI 与 Web UI —— 位置及内容差异对照清单（改造记录版）

> **坐标系基准**：原版截图实际像素 **1920×1080**，已等比换算至 **1283×682**（X:0–1283，Y:0–682）。
> 左半区 X:0–613（主画布），右半区 X:613–1279（控制面板）。
> 本清单由 DeepSeek 官网对原图逆向识别得出（逐区域 bbox + 控件明细），作为 Web 改造的唯一坐标基准。
>
> **文档性质**：✅ = 已改造完成并核对；⚠️ = 结构已建但需像素级复核；❌ = 仍缺失。
> 改造时间段：2026-08-23 第九~十一轮（按 resource.rc 初排 → 按 DeepSeek 逆向坐标精修）。

---

## 一、顶部区域（全宽 Y:0–88）

| 位置 | 原版内容 | Web 当前 | 状态 |
|------|---------|----------|------|
| 标题栏 (Y:0–22) | `Authentic2(2006)012) 31 denomenation supplemental function` + 右 `Adjust to 1400x1050` | 同左（TitleBar.jsx） | ✅ |
| 菜单栏 (Y:22–44) | `tool` `View` `Setting` `Short` | 同左（TopMenuBar.jsx） | ✅ |
| 主通道 Tab (Y:44–66, X:0–613) | 10 按钮：IR1(A1)/Green P(B)/.../abs(IR-Gp) | 同左（ChannelTab） | ✅ |
| 副通道 Tab (Y:66–88, X:0–613) | 12 按钮：IR - Gp/(IR-Gp)^2/8/.../IR4_B(A4) | 同左（SubToolbarRow） | ✅ |

---

## 二、左侧主画布（X:0–613, Y:88–610）

| 位置 | 原版内容 | Web 当前 | 状态 |
|------|---------|----------|------|
| IR1 图像区 (Y:88–338) | 灰度噪点图 + 右 28px 直方图 + `IR1` 标签 | ImagePane（CSS 渐变占位）+ `.image-pane-hist` 28px | ✅ 结构 / ⚠️ 图像为占位 |
| Data1 选择器 (Y:338–360) | Edit/Clear/路径/<(B)/(N)/>/Go/枚数 1/4 40 | DataSelectorBar | ✅ |
| IR2 图像区 (Y:360–610) | 灰度噪点图 + 右 28px 直方图 + `IR2` 标签 | ImagePane + 直方图 | ✅ 结构 / ⚠️ 图像为占位 |
| Data2 选择器 (Y:610–632) | Sync Move 复选框 + 路径 + 方向按钮 + 枚数 1/6 40 | DataSelectorBar（含 Sync Move） | ✅ |

> **注**：原版 IR1 区高 250（88–338）、IR2 区高 250（360–610），中间 Data 选择器占 22px。当前 Web 用 `image-stack`（flex 等分），需确认两图各占 ~250px 而非拉长。

---

## 三、右侧控制面板（X:613–1279，内分两列：左 613–980 / 右 980–1279）

### 右列左半 (X:613–980)

| 位置 | 原版面板 | Web 组件 | 状态 |
|------|---------|----------|------|
| Y:70 | Mouse Point（Show(V)/Switch View/Clear/Width/Height/Decide） | MousePointCompact（Show(V) 已改按压按钮） | ✅ |
| Y:100 | Reduction Image #1/#2（路径+4缩略图+Clear 4D/Load/Show All/Save List/Set 4D） | ReductionImageCompact（已补 Set 4D） | ✅ |
| Y:220 | Image Processing（Gradient/Binary/Step/Noise + slider + Restore/Fix Image） | ParamPanelGroup（原生 range 滑块） | ✅ |
| Y:310 | Operation（Real/Test + 4 checkbox + 7按钮 + F1–F8 + Ope.(Start)） | OperationPanel | ✅ |
| Y:400 | Validation Result（文本区） | ValidationCompact | ✅ |
| Y:470 | Notes（Real Text/BV check note/...） | NotesRow | ✅ |
| Y:540 | TH Row（(TH1) IR1 IR2 UV1） | ThRow | ✅ |
| Y:560 | Make Graph（1/2/Black/White/+Area/+TH + Start/Step/Times） | MakeGraphRow | ✅ |
| Y:590 | Statistics + Graph File（graph1.grp/Mul-X/Load/Save/ABS/Combine） + Graph 编辑框(S2) | RightGraphArea（整合） | ✅ 结构 / ⚠️ 需确认 y 细分 |

### 右列右半 (X:980–1279)

| 位置 | 原版面板 | Web 组件 | 状态 |
|------|---------|----------|------|
| Y:80 (h:220) | Result Details（灰底数据区 Binary file 33185...） | ResultDetails（新建） | ✅ |

---

## 四、底部全局状态栏（全宽 Y:660–682）

| 位置 | 原版内容 | Web 当前 | 状态 |
|------|---------|----------|------|
| Y:660 | Coordinate File 输入框 + Change；Function Name 输入框 + Change | BottomStatusRow（全宽绝对定位） | ✅ |
| Y:670–682 | AppStatus：HongKong / IR offset=128 / GP offset=128 / 二值图像清 / 回忆速度 32 / [MODE] 1 / Normal Mode / 0% | BottomStatusRow 底栏 | ✅ |

---

## 五、已完成的改造汇总（2026-08-23）

1. **坐标系统一**：Web 主窗口 1283×682，左/右分界 X=613（与原版一致）。
2. **缩放策略修正**：`scale(max(...))` → `scale(min(100vw/1283, 100vh/800))`，整窗缩进可视区不再裁切底部。
3. **右侧布局重构**：3 列 grid → 两列绝对定位（inner-left 613–980 / inner-right 980–1279），各面板按 DeepSeek 逆向 y 坐标定位。
4. **补齐组件**：ResultDetails（新建）、RightGraphArea（整合 Graph 区）、BottomStatusRow（全宽状态栏）。
5. **样式修正**：MousePoint 的 Show(V) 复选框 → Win32 按压按钮；ReductionImage 补 Set 4D。
6. **恢复 GASOTI / VTB（resource.rc 证实真实存在）**：原 DeepSeek 误判"原版无此区域"而删除了 GasotiPanel/VtbPanel，2026-08-23 已按 resource.rc 还原（IDC_GASOTI 629,269 / IDC_LIST_VTB 915,147）。BigListPanel 对应 resource.rc 的 IDC_LIST1(915,1) 顶部列表，已被 AtbPanel 覆盖，未单独恢复。OperationPanel 已正名（原版真有）。
7. **OperationPanel 正名**：确认原版真有（非臆造），去掉第十轮误加的红线框标注。

---

## 六、剩余待核对（需用户截图 + DeepSeek 二次逆向 / 视觉模型）

> **第十二轮核对结论（2026-08-23）**：用户第二次贴 DeepSeek 对比清单，其中"IR1/IR2 直方图缺失 / Show(V) 复选框 / Set 4D 缺失 / 滑块变下拉框 / F1-F8 缺失 / Ope.Start 缺失 / Make Graph 缺失 / Statistics/S2 图表缺失 / Result Details 错位"等项，**代码均已实现**（DeepSeek 对比基准为改造前旧截图，重复报告）。仅 AppStatus `0% → -25%` 为真实遗漏，已修复。

| # | 待核对项 | 说明 |
|---|---------|------|
| 1 | IR1/IR2 图区高度是否为 250px（当前 flex 等分可能拉长） | 影响左侧主画布比例 |
| 2 | 直方图 28px 在浏览器实际是否可见（代码已有，需肉眼确认渲染） | `.image-pane-hist` 宽 28px + 256 柱 |
| 3 | 副通道文字 `IR - Gp` 是否有空格（当前 `IR-Gp` 无空格） | 需看原图确认 |
| 4 | RightGraphArea 内 Statistics/GraphFile/Graph编辑框 的 y 细分是否对齐原版 590/650 | 当前整合块连续排布 |
| 5 | 各面板间距/gap 是否与原版一致 | 视觉细节 |
| 6 | 真实红外图像替换 CSS 渐变占位 | 需接图像管线 |
| 7 | **截图一致性**：DeepSeek 对比须基于最新 dev server(:5173) 截图，否则重复报"缺失" | ⚠️ 重要 |

---

*文档更新时间：2026-08-23（第十一轮改造后）*
*坐标基准：DeepSeek 官网逆向识别（1920×1080 → 1283×682 等比）*
