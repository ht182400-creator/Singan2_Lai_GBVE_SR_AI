# 12_OLD 源码模块/参数/函数/实现/流程 速查表

> 用途：把已分析过的 `Singan2_Lai_GBVE_SR_OLD`（原版 Win32/MFC C++）源码的模块、参数、功能、具体实现、流程，统一沉淀为表格。
> 后续任何"对照 OLD 改 Web / 对拍"任务，**先查本表**，无需重新通读源码。
> 权威性来源：`resource.rc`（控件定义）、`resource.h`（ID 常量）、`MAIN.H`（全局变量）、`WinMain.cpp`（主过程/运行时控件）、`MainRun.cpp`、`GRADIENT.CPP`、`Ren.cpp`/`Chia.cpp`/`Canada.cpp`/`C_SI2`、`OnDrawPaint.cpp`、`OnDrawGraph.cpp`、`CTemplate*.cpp`、`ALL32.CPP`。
> 引用格式：`文件:行号`（如 `resource.rc:64`）。

---

## 0. 阅读约定

| 缩写 | 含义 |
|------|------|
| OLD | `Singan2_Lai_GBVE_SR_OLD` 原版工程 |
| Web | `Singan2_Lai_GBVE_SR_AI/web` 改写工程 |
| file1 / file2 | 原版双数据文件（global_FileName / global_FileName2） |
| 单 .dat 映射 | Web 单文件下，file1=前半记录、file2=后半记录 |
| 波段 | `Img1..Img22`（22 个 2D 数组），`global_TabNo` 选择当前波段 |

---

## 1. 模块总览表

| 文件 | 职责 | 关键函数 / 符号 |
|------|------|----------------|
| `resource.rc` / `resource.h` | 主对话框 `IDC_DIALOG 1283×682` 及全部静态控件 ID | `IDC_SLIDER_NITI`、`IDC_CHECK_MAKE_GRAPH`、`IDC_EDIT_GRAPH1` … |
| `WinMain.cpp` | 主对话框过程 `DlgMain`、控件初始化、`WM_COMMAND` 分发、**运行时创建 `IDC_LIST_GR` 函数列表**（解答 issue#4） | `gr_makelist()`、`IDC_LIST_GR`(=301)、`global_select_no` |
| `MainRun.cpp` | 数据读取、跨记录 Graph 生成、主运行循环 | `ReadImgDataNew()`、`CreateGraph1/2()`、`GetDataCount()` |
| `GRADIENT.CPP` | 梯度 / 二值化 / 阈值分割 / 选区像素统计 | `Gradient()`、`MainGradient()`、`NITI`/`NitiMain`、`To2byte_orver_write`、`ComputeSuppleResult()` |
| `Ren.cpp` + `Chia.cpp` + `Canada.cpp` + `C_SI2` | `S2[1..32]` 32 个特征函数计算 | `Ren::S2`、`sum_20H`、`sum_ffH`、`sum_switch`、`average_concentration2` |
| `ALL32.CPP` | `S2[32]` 主入口（调用 Ren 等） | `ALL32()` |
| `OnDrawPaint.cpp` | 主画布绘制（IR1/IR2）、`DrawGraphBoth` 直方图、Graph1/Graph2 文本框 | `OnDrawGraphBoth()`、`DrawGraphBoth()`、`OnDrawGraph1/2()` |
| `OnDrawGraph.cpp` | `CGR_CLASS` 类：基于 `S2_gr[][global_select_no]` 的 S2 分布直方图 | `OnDrawGraph()`、`gr_per()`、`gr_draw()` |
| `CTemplate.cpp` / `CTemplateData.cpp` / `CTemplateVTB.cpp` | 文件头解析、记录数 `dataCount`、VTB 表 | `CTemplateData::CheckFile`、`dataCount` |
| `CFileAccess.cpp` | 文件访问封装（路径/大小） | `GetAppPath`、`GetSetFileSize` |
| `MAIN.H` | 全部全局变量 / 类型 / 函数声明（头文件） | `global_Mai`、`global_twoimg`、`S2[]`、`global_select_no` |
| `CDataHeader.h` | 波段枚举 `A1..A4,B..F2,UV1,UV2`（对应 Img1..Img22） | `EnumWaveType` |

---

## 2. 主对话框控件 → 参数映射表（来自 `resource.rc:57-211`）

> 这是**参数对照的权威源**。Web 复刻时每个控件都应在此找到归属。

| 控件 ID | 文本/类型 | OLD 语义与变量 | 取值范围/默认 | Web 对应状态/组件 | 备注 |
|---------|----------|----------------|--------------|-------------------|------|
| `IDC_TAB` | Tab1 (SysTabControl32) | 主通道 10 项 | — | `channel` / `CHANNEL_LABELS` | 副通道 12 项见 `SUB_LABELS` |
| `IDC_NAME_COMBO` | ComboBox | file1 路径 `global_FileName` | — | `datPath` | `IDC_NAME_COMBO2` 为 file2 |
| `IDC_BACK` / `IDC_NEXT` / `IDC_BACK2` / `IDC_NEXT2` | ボタン | 记录前后导航 | — | `handleNav` | `IDC_CNT`/`IDC_CNT2` 显示记录号 |
| `IDC_COMBO_GRADIENT` | ComboBox | 梯度算子 `global_GradientType` | Sobel/Roberts/Normal/Laplacian/Prewitt | `gradType` | `WinMain.cpp:639` 填充 |
| `IDC_SLIDER_GRADIENT` | Slider | 梯度增益 `global_Gain` | 1..50，默认 1 | `gain` | `IDC_GRADIENT_RITOKU_BOX` 数值 |
| `IDC_COMBO_NITI` | ComboBox | 二值化方法 `global_NitiType` | Gra+Bin / Bin / NiBlack | `nitiType` | `WinMain.cpp:626` 填充 |
| `IDC_SLIDER_NITI` / `IDC_NITI_SIKI_BOX` | Slider+数值 | **阈值 `global_th`** | 0..255，默认 90 | `threshold` | **issue#2 关键点** |
| `IDC_BUTTON_NITI_1` / `IDC_BUTTON_NITI_2` | − / + 按钮 | 阈值步进 ± | — | — | 调 `global_th` 并重算 IR1/IR2 |
| `IDC_SLIDER_COLOR` / `IDC_COLOR_TI` | Slider | step movement 偏移 `global_ColorPos` | 0..300，**中心 150 → 显示 0** | `colorPos` | `offset=colorPos-150` |
| `IDC_K_DEFAULT` | Default | 重置 step movement 到 150 | — | `setColorPos(150)` | |
| `IDC_HOJI` | CheckBox | Fix Image `global_FixImage` | — | `fix` | |
| `IDC_COMBO_ZATUON` | ComboBox | 降噪方法 `global_JokyoType` | MoveAverage/Median | `noiseType` | `WinMain.cpp:652` 填充 |
| `IDC_ON_JYOKYO` | Start | 降噪执行 | — | `handleNoiseStart` | |
| `IDC_GASOTI` / `IDC_GASOTI2` | Edit(owner-draw) | **IR1 / IR2 图像显示区** | — | `ir1Img` / `ir2Img` | `OnDrawPaint.cpp:352` 用 `global_twoimg` 绘制 |
| `IDC_ZAHYO` / `IDC_ZAHYO2` | 坐标显示 | 鼠标坐标 | — | `coordInfo` | |
| `IDC_M_WIDTH` / `IDC_M_HEIGHT` | Edit | 选区宽高 `mouse_range_point` | 默认 20×20 | `mouseSize` | |
| `IDC_MH_CHECK` (Show(&V)) | CheckBox | free-hand 拖选开关 `global_free_hand` | — | `mouseShowV` | |
| `IDC_M_SET` (Decide) | 按钮 | 确认选区 | — | — | |
| `IDC_RIREKI_LIST` | ListBox | Operation History | — | `history` | |
| `IDC_CHECK_MAKE_GRAPH` (`1`) | CheckBox | 包含 file1 `global_produce_graph_1` | — | `mgInclude1` | `resource.rc:139` |
| `IDC_CHECK_MAKE_GRAPH2` (`2`) | CheckBox | 包含 file2 `global_produce_graph_2` | — | `mgInclude2` | `resource.rc:140` |
| `IDC_RADIO_BLACK_PIXELS` / `IDC_RADIO_WHITE_PIXELS` | Radio | Black/White `global_compute_black` | — | `mgBw` | `resource.rc:144-145` |
| `IDC_CHECK_AREA_MOVING_GRAPH` (+Area) | CheckBox | 区域限制 `global_make_graph_area_moving` | — | `mgArea` | `resource.rc:147` |
| `IDC_CHECK_TH_CHANGING_GRAPH` (+TH) | CheckBox | 阈值随动（标题显示 TH） | — | `mgTh` | `resource.rc:152` |
| `IDC_BUTTON_MAKE_GRAPH` | Make Graph | 触发 `CreateGraph1/2`+`OnDrawGraphBoth` | — | `handleMakeGraph` | `resource.rc:146` |
| `IDC_BUTTON_MAKE_GRAPH_ALL` | Statistics | `OnDrawGraphCompare`（两文件比较） | — | `runStatistics` | `resource.rc:188` |
| `IDC_EDIT_GRAPH_STATIS_START` / `_STEP` / `_TIMES` | Edit | Start / Step / Times | — | `mgStart`/`mgStep`/`mgTimes` | `resource.rc:190-193` |
| `IDC_CHECK_CompareOption` (1<2) | CheckBox | 比较方向 | — | `mgCmp12` | `resource.rc:189` |
| `IDC_LIST_GRAPH_FUNS` | ListBox | **结果方法**（0=像素和/1=宽/2=高/3=邻差）`resultMethod` | 默认 0 | ⚠️ Web 暂未实现 | `WinMain.cpp:854` 填充 5 项 |
| `IDC_EDIT_GRAPH1` / `IDC_EDIT_GRAPH2` | Edit | Graph1 / Graph2 分布文本 | — | `graph1Text`/`graph2Text` | `resource.rc:141-142` |
| `IDC_GASOTI` 区右侧 `IDC_DSP_*` | 静态显示 | Validation Result（KEKKA/NAGATE/MIJIKATE/REDADD/GRNADD/NITADD/HAN/SPEED） | — | `validation` | data1 与 data2 各一套 |
| `IDC_LIST_ATB` / `IDC_COMBO_ATB_TYPE` | — | ATB 表 | — | `AtbPanel` | |
| `IDC_LIST_VTB` / `IDC_TAB_VTB_*` | — | VTB 表 | — | `VtbPanel` | |
| `IDD_Z_DLG` / `IDD_S_SET_DLG` / `IDD_J_DLG` | 子对话框 | 坐标加载 / 设置 / 信息显示 | — | 对应弹窗 | |

> **关键补充说明（`IDC_LIST_GR` 不在 `resource.rc`）**：
> 这个下拉（用户 issue#4 问的那个）是**运行时用 `CreateWindowEx` 创建**的（`WinMain.cpp:97 gr_makelist()`，ID=301），因此它**不出现在 `resource.rc`**——这正是用户"在 resource.rc 找不到"的原因。详见第 7 节。

---

## 3. 全局状态变量表（`MAIN.H`）

| 变量 | 类型 | 语义 | Web 对应 |
|------|------|------|----------|
| `global_Mai` / `global_Mai2` | `int` | file1/file2 记录数 | `recordCount`（单文件，前半/后半拆分） |
| `global_oneimg` / `global_twoimg` | `ONEBYTE_IMAGE`/`TWOBYTE_IMAGE` | file1 当前波段 8bit/16bit | `ir1Img`(raw) / `ir2Img`(2byte) |
| `global_oneimg2` / `global_twoimg2` | 同上 | file2 | — |
| `global_oneimg_graph` / `global_twoimg_graph` | 同上 | `CreateGraph` 循环用临时 | — |
| `global_TabNo` | `USHORT` | 当前波段索引 0..21（Img1..Img22） | `viewWave` 索引 |
| `global_th` | `USHORT` | 阈值 | `threshold` |
| `global_select_no` | `USHORT` | **S2 函数列号（1-based，默认 1）** | `graphFn` |
| `global_GradientType` | `USHORT` | 梯度算子 0..4 | `gradType` 索引 |
| `global_Gain` | `USHORT` | 梯度增益 1..50 | `gain` |
| `global_NitiType` | `USHORT` | 二值化方法 | `nitiType` 索引 |
| `global_JokyoType` | `USHORT` | 降噪方法 | `noiseType` 索引 |
| `global_ColorPos` | `USHORT` | step movement 0..300（中心150） | `colorPos` |
| `global_compute_black` | `BOOL` | Black(TRUE)/White(FALSE) | `mgBw==='black'` |
| `global_produce_graph_1/2` | `BOOL` | 含 file1/file2 | `mgInclude1/2` |
| `global_make_graph_area_moving` | `BOOL` | +Area | `mgArea` |
| `global_graph1_black/white` `global_graph2_black/white` | `USHORT[MAX_DATA]` | **Make Graph 每记录像素数** | `graphData.rows[].s2`（当前 Web 误用 S2，见 issue#1） |
| `S2[32]` / `S2_gr[][]` / `S2_gr2[][]` | 数组 | 单记录特征 / 跨记录 S2 矩阵 | `s2` / `graphData.rows` |
| `global_img_stock` | `BOOL` | Graph 循环中标记（禁止写回主显示） | — |
| `global_Zparam` | struct | 各 KIN 的坐标/选区参数 | — |
| `global_small_image` / `global_small_image2` | `BYTE[]` | 小图段（Validation Result 源） | `validation` |

---

## 4. 关键函数实现表

| 函数 | 文件:行 | 签名 / 调用 | 算法与流程 |
|------|--------|-------------|-----------|
| `ReadImgDataNew` | `MainRun.cpp:676` | `(hDlg, iData, data1OrData2, &onebyte, &twobyte, fp, fileName, readSmallImage, readAllWave, templateData)` | 按 `templateData.dataCount` 定位第 `iData` 条记录，读取全部 13 波段 → 分别写入 8bit(`onebyte`)与 16bit(`twobyte`) 图像；可选读小图段 |
| `Gradient` | `GRADIENT.CPP:13` | `(USHORT type, USHORT amp)` | 3×3 卷积（Sobel/Roberts/… 由 type 选核），结果 ×amp（增益）→ `To2byte_orver_write(&img2byte[0][0])` |
| `MainGradient` | `GRADIENT.CPP:579` | `(HWND hDlg)` | 读 `IDC_COMBO_GRADIENT`/`IDC_SLIDER_GRADIENT` → `SetUserAct(hDlg, type, amp)` → `Gradient` |
| `MainGradientGraph`/`NitiMainGraph` | `GRADIENT.CPP:617`/`:653` | `(HWND hDlg)` | Graph 版：操作 `global_twoimg_graph`，受 `global_img_stock` 控制（循环中置 TRUE 防止写回主显示） |
| `NITI` / `NitiMain` | `GRADIENT.CPP` | 阈值二值化 | 对 `global_twoimg`(file1) 应用阈值 `global_th`→ 0/非0 二值，写入 `global_twoimg.IR`（即 IR2 显示源） |
| `ComputeSuppleResult` | `MainRun.cpp:2723` | `(USHORT img[][X_SIZE], int method, POINT start, POINT range, USHORT *black, USHORT *white, USHORT threshold)` | 在 `range` 选区内按 `method` 统计：0=像素和 / 1=宽 / 2=高 / 3=邻差；返回 black/white 像素数 |
| `CreateGraph1` | `MainRun.cpp:2556` | `(HWND hDlg)` | **核心流程**：`for iData in 0..global_Mai` → `ReadImgDataNew(iData, graph 缓冲)` → 按 `comboNITI` 调 `MainGradientGraph`+`NitiMainGraph` → `ComputeSuppleResult` → 写入 `global_graph1_black[iData]`/`global_graph1_white[iData]`；`resultMethod` 来自 `IDC_LIST_GRAPH_FUNS` |
| `CreateGraph2` | `MainRun.cpp:2936` | 同 CreateGraph1，针对 file2 → `global_graph2_*` | |
| `DrawGraphBoth` | `OnDrawPaint.cpp:828` | `(hDlg, dataCount1, dataCount2, s, tabNo, pts, range, drawBlack, compareResult)` | 用 `global_graph1/2_black/white` 数组画直方图：**file1 绿竖线 / file2 蓝竖线**；计算 Gap=`\|min1-max2\|`、Middle、Sig；标题含 Area/TH |
| `OnDrawGraph` / `gr_per` | `OnDrawGraph.cpp:39`/`:287` | `CGR_CLASS` | 基于 `S2_gr[i][global_select_no]` 计算**S2 分布直方图**（与 Make Graph 的像素统计是两套不同图） |
| `Ren::S2` / `ALL32` | `Ren.cpp`/`ALL32.CPP` | 计算 `S2[1..32]` | 调用 `Chia.cpp`/`Canada.cpp` 的 `sum_20H`、`sum_ffH`、`sum_switch`、`average_concentration2`、`average_concentration_if` 等 |
| `gr_makelist` | `WinMain.cpp:97` | 运行时创建 `IDC_LIST_GR` | 填充 32 个 S2 函数名（`func_name[]` 或 `Load_func_name` 加载的 `na[]`）+ 10 个"其他"+2；选中所引用的就是 `global_select_no` |

---

## 5. 核心流程表

### 5.1 打开数据
```
OPEN → openSession → CTemplateData::CheckFile → dataCount=global_Mai
     → ReadImgDataNew(0, file1) 载入首记录 13 波段
     → loadImages → getImage(raw,2byte) → ir1Img/ir2Img
     → getSmallImage → validation
```

### 5.2 单记录分析（ALL32 → S2）
```
runAnalysis → analyzeByPath({datPath,zfilePath,record,kin,country})
            → core 读该记录 → Ren::S2 → S2[1..32] + ETC
            → setS2 / setEtc
```

### 5.3 图像处理（梯度 / 二值 / 阈值）— issue#3 关键
```
ParamPanelGroup 改 threshold/gradType/nitiType/colorPos
  → buildOps() → onProcess(ops) → App.processImage(ops)
  → runImageOps({datPath,record,wave,ops}) → 返回 2byte 图
  → setIr1Img(img)         ✅ 当前只更 IR1
  → setIr2Img(img)         ❌ 缺失（issue#3：IR2 不随阈值变化）
```
> OLD：阈值变化经 `IDC_BUTTON_NITI_1/2` → `MainGradient`+`NitiMain` → 同时改写 `global_twoimg`(file1, 显示在 IR1) 与 `global_twoimg2`(file2, 显示在 IR2)。**Web 单文件应让 IR1 与 IR2 同步**。

### 5.4 Make Graph（跨记录像素统计）— issue#1 关键
```
handleMakeGraph → makeGraph({datPath,zfilePath,maxRecords,startRecord,...})
   OLD 真实流程：CreateGraph1 循环 global_Mai 记录
     → 每记录读图 → 梯度/二值(threshold) → ComputeSuppleResult(选区)
     → global_graph1_black/white[i]
   → OnDrawGraphBoth 用 black/white 数组画像素数直方图
```
> **Web 当前实现偏差**：`/api/graph/make` 返回的是 `rows[].s2`（S2 特征值），而非 `global_graph1_black/white`（像素数）。`GraphPlot` 经 `getColumnValue(rows, fn)` 取 `s2[fn-1]` 作画。**根因**：后端 `s2`/`etc` 为 1-based（下标 0 恒为 0 未用），而 Web 全链路约定 0-based 纯值数组；修复前入库未用 `normalizeS2`/`normalizeEtc` 丢弃下标 0，致 `fn=1` 读到 `s2[0]=0`、直方图空白。**已修复**：`App.jsx` 入库处统一归一化为 0-based（见第 8 节 #1）。
>
> **单数据源时 Graph1/Graph2 重叠**：Web 当前只有单个 `.dat`，而 OLD 的 Graph1/Graph2 可分别对应 Data1/Data2 两个文件。为复刻“IR1/IR2 为同一文件时蓝绿柱状图应重叠”的行为，`buildGraphStats` 令 Graph1/Graph2 均取自全部 `rows`，仅由 `include1/include2` 控制是否绘制。
>
> **`step` 已补齐**：`MakeGraphRow` 的 Step 输入原未透传到后端，server 循环只按 `start + r` 递增。现 `/api/graph/make` 新增 `step` 参数，`api.js` 与 `App.jsx` 均透传；后端按 `start + r * step` 取 record。
>
> **数据语义已纠正（2026-09-02）**：此前 Web 误把 Make Graph 实现为「S2/ETC 分布统计」，导致数值（2768/4336）与 OLD 的像素数（160/228）相差甚远。修复后 `/api/graph/make` 复刻 `CreateGraph1 + ComputeSuppleResult`，返回每 record 在选区内的黑/白像素数 `rows[].value`，`GraphPlot`/`Graph1`/`Graph2` 文本均据此做分布统计。S2/ETC 分布由 Statistics 批量分析提供（S2Chart），与 Make Graph 解耦。
>
> **参数透传（2026-09-02）**：Make Graph 需要与 OLD 相同的图像处理管线，因此 `api.js`/`App.jsx` 把 `ParamPanelGroup` 的 `niti_type`、`grad_type`、`gain`、`threshold`、`color_point` 透传到后端；选区 `area_x/y/w/h` 来自当前 `mousePos/mouseSize`；`black`/`white` 由 `mgBw` 决定统计黑或白像素。

### 5.5 Statistics（1<2 比较）
```
IDC_BUTTON_MAKE_GRAPH_ALL → OnDrawGraphCompare
  → 仅当 global_produce_graph_1 && global_produce_graph_2 时比较两文件
  → Start/Step/Times（IDC_EDIT_GRAPH_STATIS_*）驱动批量范围
```

### 5.6 阈值 ± 按钮（IDC_BUTTON_NITI_1/2）
```
点击 → 读 IDC_SLIDER_NITI 当前值 → ±1 → 写回 slider+数值框
     → MainGradient + NitiMain（file1/file2 同时重算）
     → InvalidateRect 重绘 IR1/IR2
```

---

## 6. S2 函数列表（`func_name[32]` + 10 其他）

> 来源 `WinMain.cpp:103-152`。`global_select_no` = 选中下标 + 1（1-based）。

| idx | 名称 (`func_name[]`) | 语义 |
|-----|----------------------|------|
| 1 | New GreenP WM | 新绿通道 WM |
| 2 | Old GreenP WM | 旧绿通道 WM |
| 3 | Infre-Red WM | 红外 WM |
| 4 | GreenP WM | 绿通道 WM |
| 5 | WM1 IR Cons. | WM1 红外浓度 |
| 6 | WM1 IR WhiteRatio | WM1 红外白比 |
| 7 | WM1 GP Cons. | WM1 绿浓度 |
| 8 | WM1 GP WhiteRatio | WM1 绿白比 |
| 9 | WM1 Neighbor-Diff | WM1 邻域差 |
| 10 | WM1 IR Emphasis | WM1 红外强调 |
| 11 | WM1 IR-G Diff | WM1 红外-绿差 |
| 12 | Counterfeit CC | 防伪 CC |
| 13 | Thread IR Con. | 螺纹红外浓度 |
| 14 | IR1 White Ratio | IR1 白比 |
| 15 | IR2 White Ratio | IR2 白比 |
| 16 | IR3 White Ratio | IR3 白比 |
| 17 | NCR Hologram | NCR 全息 |
| 18 | Thread Gradiant | 螺纹梯度 |
| 19 | ETC1 Gradient | ETC1 梯度 |
| 20 | ETC2 Colour Diff | ETC2 色彩差 |
| 21–32 | Reserved | 保留（默认 0） |
| +10 | その他 01..10 | ETC[1..10] 扩展 |
| +2 | 図形 / 図形2 | 图形比较项 |

> Web 的 `graphFn` 默认 1，对应 `S2[1]=New GreenP WM`。

---

## 6.5 Mouse Point（`IDC_M_WIDTH` / `IDC_M_HEIGHT` / `IDC_MH_CHECK`）

原版行为（`Mouse.cpp`）：
- `Show(&V)` 即 `IDC_MH_CHECK` → 控制 `global_free_hand`。
  - 关：鼠标移动时 `mousePos` 跟随光标，`mouseSize` 保持 20×20（默认值）。
  - 开：左键拖拽选区；`Freemove_mouse` 持续更新 `mouse_range_point` 并回写 `IDC_M_WIDTH` / `IDC_M_HEIGHT`，实现**宽高随拖拽实时变化**（`Mouse.cpp:131-144`）。
- `Decide` 按钮（`IDC_M_SET`）确认选区，把 `mouse_range_point` 写回 `global_Zparam`。

Web 映射：
- `mouseShowV` → `freeHand` prop of `ImagePane`。
- `ImagePane` 在 `freeHand=true` 时：拖拽中通过 `onSizeChange({w,h})` 实时回传尺寸给 `App.setMouseSize`；松开时 `onSelect({x1,y1,x2,y2})` 写回。
- `MousePointCompact` 显示 `mouseSize.w` / `mouseSize.h`，readOnly（与原版 IDC_M_WIDTH/HEIGHT 一致）。

---

## 7. 图参数下拉（`IDC_LIST_GR`）说明 —— 解答 issue#4

**Q：这个下拉是做什么用的？为什么 resource.rc 里找不到？**

1. **它是什么**：S2/ETC **函数选择列表**，决定直方图/曲线按哪一列（`global_select_no`）来统计。等价于 Web 的 `graphFn`（函数列号 1..44）。
2. **为什么不在 resource.rc**：它是 **运行时用 `CreateWindowEx` 创建的 ListBox**（`WinMain.cpp:97 gr_makelist()`，控件 ID = 301，定义在 `WinMain.cpp:12` 的宏 `IDC_LIST_GR 301`），不属于对话框静态模板，因此 `resource.rc` 中查不到——**不是 Web 凭空多出来的控件，原版就有，只是藏在了代码里**。
3. **联动逻辑**：选中某项 → `WM_COMMAND: IDC_LIST_GR` → `global_select_no = LB_GETCURSEL + 1`（`WinMain.cpp:1273-1276`）→ 重绘图形。
4. **与 `IDC_LIST_GRAPH_FUNS` 的区别**（容易混淆）：
   - `IDC_LIST_GR`（运行时）：选"哪个 S2 函数列"参与作图。
   - `IDC_LIST_GRAPH_FUNS`（resource.rc:182 静态）：选"结果计算方法"（0 像素和 / 1 宽 / 2 高 / 3 邻差），**仅用于 Make Graph 的像素统计**，见第 9 节；Web 已实现（Graph 操作区函数列表 → `/api/graph/make` 的 `result_method`）。

---

## 9. Graph 操作区参数速查（`resource.rc` 991–1279, y265–341）

> **结论：以下参数全部属于 Make Graph（图表测量），与 VTB 无关。**
> 依据：`MainRun.cpp CreateGraph1(:2556) / CreateGraph2(:2936)` → `ComputeSuppleResult`（`MainRun.cpp:2723`）。

| 控件 | OLD 实现位置 | 语义 |
|---|---|---|
| 函数列表（0-Sum pixels / 1-width / 2-height(TBD) / 3-differenct neighbour / 4-(TBD)） | `MainRun.cpp:2723 ComputeSuppleResult`，由 `CreateGraph1/2` 每 record 调用 | 测量方法选择：0=选区内黑/白像素计数；1=黑/白水平跨度（\|右-左\|+1）；2=空实现(TBD)；3=选区内水平+垂直相邻差分>阈值累加（封顶 65535）。注意只有 method 3 用二值化阈值，0-2 传 0 |
| Mul-X 按钮+编辑框（1098,283） | — | **原版死控件（无任何 handler，TBD）** |
| ABS (Graph1 - Graph2)（1097,299） | — | **原版死控件** |
| 图形文件名编辑框（997,265,256） | — | **无读写代码，死编辑框**（Save Graph 缺省名 `_tempGraph` 硬编码） |
| Load Graph...（1190,284） | `WinMain.cpp:2014` | .GPH 文件对话框 → CopyFile 到 `GraphFiles\` → 文件名追加进**隐藏**名单（`IDC_EDIT_AREA_LIST` 998,223，`NOT WS_VISIBLE`）→ `DisplayGraphs` 立即显示 |
| Save Graph（1190,299） | `WinMain.cpp:1980` | 当前序列写 `<GraphFiles>\<名>.GPH`（名空则 `_tempGraph`）；格式 = `USHORT head[100]`（[0]=tabNo、[1-4]=start/range、[5]=s、[6]=count1、[7]=count2、[8]=drawBlack）+ series1[2300] + series2[2300]，共 **9400B**（`MAX_DATA=2300`，MAIN.H:92） |
| Clear（1098,326） | `WinMain.cpp:2058` | 清空隐藏名单 |
| Graph (Combine)（1172,325） | `WinMain.cpp:2061` → `DisplayGraphs`（:3153） | 名单内全部 .GPH 逐文件 `combineDatas[jj] += dataValues[jj]` 累加后显示；count1/count2 不一致报 `Cannot operate on different count file` |

Web 映射（2026-09-03 已 1:1 重建）：函数列表 → `/api/graph/make` 的 `result_method`；Load/Save → `/api/graph/gph-load|gph-save`（原版二进制格式）；Combine → 前端逐点累加；Mul-X/ABS 按原版行为"无实现"，点击提示 TBD 并在面板内附说明。

---

## 8. 与 Web 实现差异 & 待补项（关联 issue#1–6）

| Issue | 现象 | 根因（对照 OLD） | 修复方向 | 状态 |
|-------|------|------------------|----------|------|
| #1 Make Graph 不生成柱状图 | 直方图空白 | **根因**：后端 core 的 `s2`/`etc` 为 **1-based**（`all32.cpp`：`s2` 长 33、下标 `[1..32]` 存 `S2[1..32]`；`etc` 长 15、下标 `[1..12]` 存 `ETC[1..12]`；下标 0 恒为 0 未用）。Web 全链路（getColumnValue / S2Chart / analysis 工具）统一约定 **0-based 纯值数组**（下标 0 = S2[1]）。修复前入库未做转换，导致 `fn=1` 经 0-based 索引读到 `s2[0]=0` → 分布全 0 → 空白。 | **修复（归一化在入库处）**：在 `App.jsx` 的 analyze/statistics/makeGraph 三处用 `normalizeS2`/`normalizeEtc` 丢弃未用下标 0（s2→长 32，etc→长 12），下游保持 0-based（`getColumnValue`：`fn 1..32 → s2[fn-1]`、`fn 33..44 → etc[fn-33]`；`S2Chart` 同）；`GraphPlot` 另加「所有值相同则按序号均匀铺开」兜底。 | ✅ 已修复（web/src/App.jsx、utils/analysis.js、utils/graphStats.js、components/S2Chart.jsx、components/GraphPlot.jsx；graphStats 测例退回 0-based） |
| #2 TH 不同步 | 标题 `[IR1(A1) -th ]` 中 th 不随滑块 | `threshold` 仅存于 `ParamPanelGroup` 内部 state，未提升到 `App`，`GraphPlot` 硬编码 `threshold={128}` 接收不到实时值。 | 把 `threshold` 提升为 `App` 级 `useState(90)`，通过 props 传入 `ParamPanelGroup`(受控) 与 `GraphPlot`。 | ✅ 已修复（App.jsx、ParamPanelGroup.jsx） |
| #3 IR2 不随阈值变化 | IR1 动态、IR2 静止 | `App.processImage` 只 `setIr1Img`，未 `setIr2Img`；而 OLD 二值/阈值作用在 `global_twoimg`（即 IR2 源）。 | `processImage` 内 `runImageOps` 结果同时 `setIr2Img(img)`（单文件下 IR1/IR2 同步反映阈值）。 | ✅ 已修复（App.jsx） |
| #4 下拉找不到 | 用户疑问 | 实为运行时创建的 `IDC_LIST_GR`（`WinMain.cpp:97`） | 已在本表第 7 节说明；Web `graphFn` 即其等价物 | ✅ 已说明 |
| #5 Make Graph 的 Step 未生效、Graph1/Graph2 不重叠 | Step 输入无效；IR1/IR2 同文件时蓝绿柱状不重叠 | ① `api.js`/`App.jsx` 未把 `mgStep` 传给后端，server 循环只有 `start + r`；② Web 单文件却把 rows 前/后半拆分给 Graph1/Graph2，导致同文件也画出两套不同分布。 | ① `/api/graph/make` 与 server 均新增 `step` 参数，按 `start + r * step` 取 record；② `buildGraphStats` 改让 Graph1/Graph2 均使用全部 rows，由 `include1/include2` 控制显隐，单数据源时重叠。 | ✅ 已修复（web/src/api.js、App.jsx、utils/graphStats.js；server/server.cpp） |
| #6 Mouse Point Width/Height 不随选区变化 | 自由手拖拽时 Width/Height 保持 20×20 | `ImagePane` 只在 mouseup 时通过 `onSelect` 回写尺寸，缺少 OLD `Freemove_mouse` 持续刷新 `IDC_M_WIDTH/HEIGHT` 的等价逻辑。 | `ImagePane` 增加 `onSizeChange({w,h})` prop，在 `freeHand` 拖拽期间（包括鼠标移出画布后由 window 监听）持续调用；`App.jsx` 将其接到 `setMouseSize`。 | ✅ 已修复（web/src/components/ImagePane.jsx、App.jsx；新增单测） |
| #7 Make Graph Avg/Std/list text 与 OLD 不一致 | Web 值 3574/4336，OLD 值 160/228 | Web 误把 Make Graph 实现为「S2/ETC 分布统计」，但 OLD 真实语义是 `CreateGraph1 + ComputeSuppleResult`：每 record 对当前波段做 gradient+niti（或 Bin/NiBlack），再统计选区内的黑/白像素数。 | ① `server/server.cpp` 新增 `niti_on_twoimg`/`count_black_white`/`make_graph_record`，复刻 OLD 图像处理与像素统计；② `/api/graph/make` 改返回 `rows[].value`（像素数），并透传 `wave`/`niti_type`/`grad_type`/`gain`/`threshold`/`color_point`/`area_*`/`black`；③ `ParamPanelGroup` 增加 `onParamsChange` 同步处理参数给 App；④ `graphStats.js` 新增 `getGraphValue` 兼容像素统计与 S2/ETC；⑤ S2Chart 改由 `batchStats.all` 提供数据，与 Make Graph 解耦。 | ✅ 已修复（server/server.cpp、web/src/api.js、App.jsx、ParamPanelGroup.jsx、utils/graphStats.js、graphStats.test.js；单测 160 通过；server Release 编译通过） |
| #8 点 Make Graph 无响应 + React 渲染期 setState 警告 | 控制台报 `Cannot update a component (App) while rendering a different component (ImagePane)`；设 10/10/5 后点 Make Graph 界面卡死无反应 | `ImagePane.jsx` 把 `onSizeChange`（`App.setMouseSize`）放在 `setDrag` 更新函数内部调用，React（StrictMode）在渲染阶段调用该更新函数 → 渲染期触发父组件 setState → 死循环卡死；且 Make Graph 默认 `Start/Step/Times=0/1/16` 与原版 MFC 的 10/10/5 不符。 | ① `ImagePane.jsx` 将 `onSizeChange` 移出 `setDrag` 更新函数（事件体直接调用），彻底消除渲染期 setState；② `App.jsx` 的 `mgStart/mgStep/mgTimes` 默认值改为 `10/10/5`，`MakeGraphRow` prop 默认值同步；③ Graph1/Graph2/Result Details/Fn[1] 合并为单一 `graph-result` 容器（标题含 `Fn[N]`），`styles.css` 新增对应样式。 | ✅ 已修复（web/src/components/ImagePane.jsx、App.jsx、MakeGraphRow.jsx、styles.css、MakeGraphRow.test.jsx；`npm run build` 通过；单测 160 通过） |

> 注：本表为"源码分析缓存"，实现修复请回到对应 Web 文件并在修复后更新 `10_界面与交互文档.md` / `11_模块功能同步方案_P0-P5.md`。
