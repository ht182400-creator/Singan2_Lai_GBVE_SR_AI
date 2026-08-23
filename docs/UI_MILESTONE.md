# 原始界面里程碑对照表（MFC → Web）

> 数据来源：原版 `Singan2_Lai_GBVE_SR_OLD\resource.rc`（主窗口 `IDC_DIALOG` 101，1283×682）+ `WinMain.cpp`（`ImgType[]` 标签、菜单、状态栏）。
> 状态图例：✅ 已实现（控件文字/位置/交互一致）｜🟡 部分实现｜❌ 未实现
> 每完成一项，把对应 ✅ 打勾，本表即里程碑。

---

## 区域 0：窗口标题栏 + 菜单

| 原始控件 (rc/menu) | 显示文字/提示 | 位置 | Web 组件 | 状态 |
|---|---|---|---|---|
| `IDC_DIALOG` CAPTION | "Authentic2(20060112) 31 denomination supplemental function" | 顶栏第 1 行 (0–22) | `TitleBar.jsx` | ✅ |
| "Demonstration supplemental function" 标记 | 顶栏右侧 | `TitleBar.jsx` | ✅ |
| "Adjust to 1400x1050" 缩放按钮 | 顶栏右侧 | `TitleBar.jsx` | ✅ |
| `MENU IDR_MENU` tool | "tool / View / Setting / Short" | 顶栏第 2 行 (22–44)，蓝色文字 #316ac5 | `TopMenuBar.jsx` | ✅ |
| tool → History/Finish | 下拉（白底蓝字） | `TopMenuBar` | ✅ |
| View → Grid/Information/Image→7 Reductions…/Brightness Adjust… | 多级下拉 | `TopMenuBar` | ✅ |
| Setting → Setting Dialogue… / Load→Coordinate/ATB/Data / Create1/2/3 / Country… | 多级下拉 | `TopMenuBar` | ✅ |
| Short → Calculate all / Finish (Alt+F) | 下拉 | `TopMenuBar` | ✅ |
| **菜单文字统一蓝色 #316ac5**（用户要求） | CSS `.top-menu-item`、`.top-menu-row` 默认色 | `styles.css` | ✅ |

## 区域 1：主通道 Tab（IDC_TAB，顶部第 2 行）

| 原始标签 (WinMain `ImgType[0..9]`) | Web 组件 | 状态 |
|---|---|---|
| `IR1 (A1)` / `Green P (B)` / `Green Ref_F (C)` / `Green Ref_B (D)` / `Blue Ref_F (E1)` / `Blue Ref_B (E2)` / `IR^2/64` / `IR-Gr+offset` / `Gp-Gr+offset` / `abs(IR-Gp)` | `ChannelTab.jsx`（10 项） | ✅ |

## 区域 2：副通道（IDC_TAB 第二行，ImgType[10..21]）

| 原始标签 | Web 组件 | 状态 |
|---|---|---|
| `IR - Gp` / `(IR-Gp)^2/8` / `Gp - IR` / `IR & Gp` / `IR \| Gp` / `Red Ref_F (F1)` / `Red Ref_B (F2)` / `UV1` / `UV2` / `IR2 (A2)` / `IR3_F (A3)` / `IR4_B (A4)` | `SubToolbarRow.jsx`（12 项） | ✅ |

## 区域 3：左侧主画布（IR1 / IR2 双图）

| 原始控件 | 显示文字/提示 | Web 组件 | 状态 |
|---|---|---|---|
| `IDC_PIC_IR1` / `IDC_PIC_IR2` | 真币大图（黑底） | `ImagePane.jsx` IR1/IR2 | ✅ |
| 直方图 strip | 右端 256 灰度柱（IDC_HISTOGRAM） | `ImagePane` hist | ✅ |
| 左/右画布标注竖排文字（si / IR... / Ve... / IR...） | 画布侧标签 | — | ❌ |

## 区域 4：Data1 / Data2 选择器（双行，主画布下方）

| 原始控件 | 显示文字/提示 | Web 组件 | 状态 |
|---|---|---|---|
| `IDC_CUSTUM` | "Edit" | `DataSelectorBar` | ✅ |
| `IDC_CREA` | "Clear" | `DataSelectorBar` | ✅ |
| `IDC_NAME_COMBO` / `IDC_NAME_COMBO2` | 文件名下拉（数据路径） | `DataSelectorBar` | 🟡（仅 Edit，无下拉选择历史） |
| `IDC_BACK10/<` `IDC_BACK11` `IDC_NEXT11` `IDC_NEXT10/>` | "<" ">" 边角翻页 | `DataSelectorBar` `<(B) >(N)` | ✅ |
| `IDC_BACK2` `IDC_NEXT2` | "仼(&<)" "仺(&>)" 上/下一张 | `DataSelectorBar` | ✅ |
| `IDC_BUTTON_DATA_GO1/2` | "Go" | `DataSelectorBar` | ✅ |
| `IDC_EDIT_VIEW_DATA_INDEX` | 枚数（数字框） | `DataSelectorBar` | ✅ |
| `IDC_CNT` / `IDC_CNT2` | 当前/总数（如 1/40） | `DataSelectorBar` | ✅ |
| `IDC_CHECK_SYNC_MOVE` | "Sync Move"（勾选） | `DataSelectorBar` | ✅ |
| `IDC_GASOTI` / `IDC_GASOTI2` | 数据备注多行文本框 | `GasotiPanel`（拖拽卡片 + 自适应文本框，内容滚动条） | ✅ |
| `IDC_ZAHYO` / `IDC_ZAHYO2` | 坐标显示（sunken） | — | ❌ |

## 区域 5：Mouse Point（右侧，IDC_STATIC 631,1）

| 原始控件 | 显示文字/提示 | Web 组件 | 状态 |
|---|---|---|---|
| `IDC_MH_CHECK` | "Show(&V)" 勾选 | `MousePointCompact` | ✅ |
| `IDC_STATIC` "Width" + `IDC_M_WIDTH` | "Width" + 输入框 | `MousePointCompact` | ✅ |
| `IDC_STATIC` "Hight" + `IDC_M_HEIGHT` | "Hight" + 输入框 | `MousePointCompact` | ✅ |
| `IDC_M_SET` | "Decide" | `MousePointCompact` | ✅ |
| `IDC_WINDOWCHANGE` | "Switch View" | `MousePointCompact` / 顶栏 | ✅ |
| `IDC_LISTCREA` | "Clear"（列表） | `MousePointCompact` | ✅ |

## 区域 6：Binary Segmentation（右侧，IDC_STATIC_NITI 630,110）

| 原始控件 | 显示文字/提示 | Web 组件 | 状态 |
|---|---|---|---|
| `IDC_STATIC_GR` "Gradient" + `IDC_COMBO_GRADIENT` + `IDC_GRADIENT_RITOKU_BOX` + `IDC_STATIC_GR_R` "Gain" | Gradient / 下拉 / 数值 / Gain | `ParamPanelGroup` | ✅ |
| `IDC_SLIDER_NITI` + `IDC_COMBO_NITI` + `IDC_STATIC_NITI_S` "Threshold" + `IDC_NITI_SIKI_BOX` | Sobel/Threshold 滑块 | `ParamPanelGroup` | ✅ |
| `IDC_STATIC_Z_J` "Noise reduction" + `IDC_COMBO_ZATUON` + `IDC_ON_JYOKYO` "Start" | Noise reduction / 下拉 / Start | `ParamPanelGroup` | ✅ |
| `IDC_HOJI` "Fix Image" 勾选 | Fix Image | `ParamPanelGroup` | ✅ |
| `IDC_STATIC_KAITYO` "step movement" + `IDC_K_DEFAULT` "Default" + `IDC_COLOR_TI` + `IDC_STATIC_KAITYO_H` "Movement" + `IDC_SLIDER_COLOR` | step movement / Default / 数值 / Movement / 滑块 | `ParamPanelGroup` | ✅ |

## 区域 7：Reduction Image 1 / 2（右侧，IDC_STATIC 1101,2 与 1182,2）

| 原始控件 | 显示文字/提示 | Web 组件 | 状态 |
|---|---|---|---|
| 缩略图（4 个） | Reduction 1 / Reduction 2 / 其它 2 | `ReductionImageCompact` | ✅ |
| `IDC_BUTTON_LOAD_ATB` "Load..." | Load... | `ReductionImageCompact` | ✅ |
| `IDC_BUTTON_ATB_SHOW_ALL` "Show All" | Show All | `ReductionImageCompact` | ✅ |
| `IDC_BUTTON_SAVE...` "Save List..." | Save List... | `ReductionImageCompact` | ✅ |
| `IDC_LIST_ATB` + `IDC_COMBO_ATB_TYPE` + TH1~TH4 单选 + "Clear"/"Clear 4D"/"Set 4D..."/"Save..."/"Show All" | ATB 列表 + 类型下拉 + TH 单选 + 4D 操作 | `ThRow` + `ReductionImageCompact` | 🟡（TH 行在 ThRow，ATB/VTB 列表缺） |
| `IDC_LIST_VTB` + `IDC_BUTTON_LOAD_VTB` + `IDC_TAB_VTB_PROCESS` + `IDC_TAB_VTB_MODE` + `IDC_EDIT_VTB_SELECT` | VTB 列表 + 加载 + 2 个 tab + 选择框 | — | ❌ |
| `IDC_COMBO_DENOS_SIZE` + `IDC_BUTTON_LOAD_DENOS_SIZE` | 尺寸下拉 + Load Size... | — | ❌ |

## 区域 8：Operation（右侧中部，MFC IDC_STATIC_OPERATION）

| 原始控件 | 显示文字/提示 | Web 组件 | 状态 |
|---|---|---|---|
| Real / Test 单选 | "Real" / "Test" | `OperationPanel` | ✅ |
| 4 勾选 | "Check note" / "Reason" / "Function processing" / "Other mode" | `OperationPanel` | ✅ |
| 7 按钮 | "IR-Vi"/"Normal Id"/"Manual Lw"/"Thickness"/"Standard"/"End Processing"/"reserved" | `OperationPanel` | ✅ |
| `IDC_COMBO_SET_TABLE_FUNCTION` + F1~F8 + "Ope. (Start)" + "Load VER..." | 函数下拉 + F1-F8 + 启动 + 加载 | `OperationPanel` | ✅ |

## 区域 9：Validation Result（右侧，IDC_STATIC_2 701,217）

| 原始控件 | 显示文字/提示 | Web 组件 | 状态 |
|---|---|---|---|
| `IDC_STATIC_1` "Ver." + `IDC_DSP_HAN` | Ver. 值 | `ValidationCompact` | ✅ |
| `IDC_STATIC_2` "Validation Result" + `IDC_DSP_KEKKA` | Validation Result 值 | `ValidationCompact` | ✅ |
| LE / SE + 值 | "LE" "SE" | `ValidationCompact` | ✅ |
| `IDC_STATIC_5` "IR Adictive" + `IDC_STATIC_6` "G Adictive" + `IDC_STATIC_7` "Binary Addictive" + `IDC_STATIC_8` "Speed" + 值 | 各加性 + Speed | `ValidationCompact` | ✅ |
| 第二组 Validation Result（IDC_STATIC_9 702,245 起，对应 Graph1/2 对比） | 同上第二套 | — | ❌ |

## 区域 10：Make Graph 区（底部，IDC_BUTTON_MAKE_GRAPH 825,342 一带）

| 原始控件 | 显示文字/提示 | Web 组件 | 状态 |
|---|---|---|---|
| `IDC_CHECK_MAKE_GRAPH` "1" + `IDC_CHECK_MAKE_GRAPH2` "2" | 勾选 1 / 2 | `MakeGraphRow` | ✅ |
| `IDC_RADIO_BLACK/WHITE_PIXELS` | "Black" / "White" 单选 | `MakeGraphRow` | ✅ |
| `IDC_BUTTON_MAKE_GRAPH` | "Make Graph" | `MakeGraphRow` | ✅ |
| `IDC_CHECK_AREA_MOVING_GRAPH` "+ Area" | + Area 勾选 | `MakeGraphRow` | ✅ |
| `IDC_CHECK_TH_CHANGING_GRAPH` "+ TH" | + TH 勾选 | `MakeGraphRow` | ✅ |
| `IDC_BUTTON_MAKE_GRAPH_ALL` "Statistics" + start/step/times | Statistics + 数值 | `StatisticsRow` | ✅ |
| `IDC_CHECK_CompareOption` "1 < 2" | 1<2 勾选 | `StatisticsRow` | ✅ |
| `IDC_BUTTON_LOAD_GRAPH` / `IDC_BUTTON_SAVE_GRAPH` / `IDC_BUTTON_CLEAR_GRAPH_LIST` / `IDC_BUTTON_MAKE_COMBINE_GRAPH` | Load Graph... / Save Graph / Clear / Graph (Combine) | `GraphFileRow` + `GraphCombine` | ✅ |
| `IDC_BUTTON_GRAPH_MULTI` "Mul-X" + `IDC_EDIT_GRAPH_MULTI` + `IDC_BUTTON_GRAPH1_2_DESTRACT_ABS` "ABS (Graph1 - Graph2)" | Mul-X / 数值 / ABS 差 | `GraphFileRow` | ✅ |
| `IDC_EDIT_GRAPH1` / `IDC_EDIT_GRAPH2` | 两个大文本框 | `GraphPlot`（Make Graph 下方 500×250 可拖拽图例/绘图区） | ✅ |

## 区域 11：Operation History（右侧，IDC_STATIC 714,6）

| 原始控件 | 显示文字/提示 | Web 组件 | 状态 |
|---|---|---|---|
| `IDC_STATIC` "Operation History" + `IDC_RIREKI_LIST` + `IDC_LISTCREA` "Clear" | 历史列表 + 清空 | — | ❌ |

## 区域 12：底部状态栏（IDC_STATIC_Z 629,646）

| 原始控件 | 显示文字/提示 | Web 组件 | 状态 |
|---|---|---|---|
| `IDC_STATIC_Z` "Coordinate File" + `IDC_Z_SET_NAME` | 坐标文件 + 路径 | `StatusBar` | ✅ |
| `IDC_STATIC_M` "Function Name" + `IDC_M_SET_NAME` | 函数名 + 路径 | `StatusBar` | ✅ |
| `IDM_Z` "Change" + `IDM_FILENAMESSETUP` "Change" | Change ×2 | `StatusBar` | ✅ |
| 状态栏文字 | "Hongkong" / "IR offset=128" / "GP offset=128" / "MODE 1" / "Normal Mode" | `AppStatusBar` | ✅ |

## 区域 13：菜单对话框（IDR_MENU 子项 → 模态框）

| 对话框 | 显示文字/提示 | Web 组件 | 状态 |
|---|---|---|---|
| `IDD_Z_DLG` "Load Coordinate Dialogue" | Close/Load/Clear All/Clear selected/goto Name Setting | `DialogModal` | 🟡（基础弹窗，未全字段） |
| `IDD_J_DLG` "Infomation Display" | 信息显示 | — | ❌ |
| tool→Create 子菜单对话框 | — | — | ❌ |
| Setting 子菜单对话框 | — | — | ❌ |

---

## 统计（里程碑进度）

| 状态 | 数量（粗略） |
|---|---|
| ✅ 已实现 | 主窗口核心 11 区域全覆盖，约 60+ 控件 |
| 🟡 部分实现 | 4 处（Data 文件名下拉、ATB/TH、坐标对话框） |
| ❌ 未实现 | 画布侧标签、Data 备注/坐标框、VTB 列表、第二组 Validation、Operation History、IDD_J_DLG、Create/Setting 对话框 |

> 下一步建议优先级：❌ 项中「Operation History 列表」「VTB 列表区」为可见空白，先补；其次补全 Data 备注/坐标框与菜单对话框。

---

## 可拖拽容器系统（RC，2026-08-23 新增）

Web 主要控件卡片不再完全绑定 `resource.rc` 固定坐标，改用 `RC` 组件（`web/src/components/RC.jsx`）：
- 每个卡片 `position: absolute`，标题栏 / `fieldset` legend 为拖拽手柄（Pointer Events API，带 4px 防抖阈值）；
- 拖拽位置存入 `localStorage` key `rc-positions`，刷新后保持；
- 顶部"重置布局"按钮可清空 `rc-positions` 恢复各卡片默认 `left/top`；
- 已接入：Validation / GASOTI / Notes / Operation / Make Graph / Statistics / Graph1 / Graph2 / S2Chart / TH Row / Bottom Status / MousePoint / GraphPlot。
