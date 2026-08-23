# 05_Web 化改造可行性评估

> 本文基于对 `Singan2_Lai_GBVE_SR_OLD` 源码的逐层静态分析（算法层 / 数据解析层 / UI 层 / 全局状态 / 构建依赖），评估将其改造成 Web 应用的可行性、路径与工作量。**结论先行：可行，推荐 WASM 路线，核心算法可近乎零改动复用，主要工作量在 Web UI 重写。**

---

## 1. 总体结论

| 层 | 现状 | Win32 耦合度 | 可移植性 |
|---|---|---|---|
| 算法层（C_SI2 / GRADIENT / PREWITT / LAPLACIAN / NITI / 中值滤波 / bvmath） | 纯 C/C++ 像素运算 | **几乎为 0** | ⭐⭐⭐⭐⭐ 近乎零改动 |
| 国家算法层（Euro / Chia / USA / Canada / HongKong / ...） | 纯计算，`HWND` 形参未用 | 低（可剥离） | ⭐⭐⭐⭐ 去 HWND 后直接移植 |
| 数据解析层（CTemplateData / CTemplateVTB / ReadImgData） | 标准 `FILE*` + stdio | 低（`CFileAccess` 用 Win32 API） | ⭐⭐⭐⭐ 替换文件 I/O 即可 |
| UI/绘图层（WinMain / DialogProc / OnDrawPaint / GDI） | 深度耦合对话框 + GDI | **极高** | ⭐ 必须完全重写 |
| 全局状态（MAIN.H 约 90 个 `global_*`） | C 风格全局变量 | 中（需封装） | ⭐⭐⭐ 封装为上下文对象 |

**一句话**：这是一个"算法干净、UI 老套"的典型旧版 Windows 工具。**算法核心（约 70% 的代码量）可以直接编译进 WASM 或翻译成 TypeScript 复用，UI 层本来就是历史包袱，重写为现代 Web 界面反而是升级。**

---

## 2. 分层证据

### 2.1 算法层 —— 纯计算，可直接移植

逐文件检查结果（无 GDI、无对话框、无系统调用）：

| 文件 | Win32 调用 | 结论 |
|---|---|---|
| `C_SI2.CPP`（27 个方法） | 仅 1 处 debug 写 CSV 的 `fopen("c:\\cc\\a.csv")` | 纯计算，删掉 debug 行即可 |
| `GRADIENT.CPP` / `GRADIENT2` | 仅 `MainGradient*/Graph*`（读 UI 控件值） | 核心 `Gradient/Gradient2` 纯计算 |
| `PREWITT.CPP` / `LAPLACIAN.cpp` | 无 | 纯 3×3 卷积 |
| `NITI.CPP` | 仅 `NitiMain/Graph`（读控件） | 核心 `NITI/NITI2/Niblack` 纯计算 |
| `smooth_median.cpp` | 仅 UI 包装函数 | 核心 `smooth/median` 纯计算 |
| `To2byte.cpp` / `To2byte_orver_write.cpp` | 无 | 纯 memcpy |
| `bvmath.cpp` | 无 | 查表近似开方 `Rute`，纯整数运算 |

> **`Inimg()`**（MainRun.cpp:1924）仅做 `memcpy`：按 `global_TabNo` 把 `global_oneimg.ImgX`（1 字节）与 `global_twoimg.ImgX`（2 字节）拷入算法局部缓冲，无任何 Win32 调用。

**移植友好性关键点**：所有算法都只依赖
- 固定尺寸缓冲 `BYTE img1byte[Y_SIZE][X_SIZE]`、`USHORT img2byte[...]`（Y=88, X=186，**每枚 16368 像素**，非常小）
- 全局查表 `w_Table[16384]`（来自 `GBV_DIV_H.bin`）
- 坐标参数 `global_Zparam`（`ZAHYO_PARAM` 结构）
- `S2[]` 输出数组

### 2.2 国家算法层 —— 去 HWND 即用

- `Euro_(HWND, USHORT*, USHORT*)`：`HWND` 形参**完全未使用**，内部只调 `To2byte()` / `Gradient()` / `NITI()` / `C_SI2` 方法，写 `S2[]`。
- `Chia_`（China）：同理，另含自有纯计算辅助函数（`cut_img` / `black_count` / `sum_20H` 等）。
- 各国算法本质都是"按 `ZAHYO_PARAM` 坐标区域 → 对 `global_twoimg` 做窗口统计 → 写 `S2[]`"。

**改造**：把函数签名改为 `Euro_(Context&, USHORT* S2)` 即可，函数体不动。

### 2.3 数据解析层 —— 替换文件 I/O 即可

| 文件 | 现状 | 处理方式 |
|---|---|---|
| `CTemplateData.cpp` | `fopen/fread/fseek` | 直接复用（浏览器端改为 `fs.readFileSync` 或读入 `Uint8Array` 后按偏移切片） |
| `CTemplate.cpp` / `CTemplateVTB.cpp` | `fopen/fread` | 同上 |
| `ReadImgData` / `ReadImgDataNew`（MainRun.cpp） | `FILE*` 流式读 | 读入内存缓冲后按偏移取值，逻辑不变 |
| `CFileAccess.cpp` | `CreateFile/ReadFile/WriteFile/GetOpenFileName/GetModuleFileName` | **唯一需替换的文件**：浏览器端用 `fetch`/`<input type=file>`/`File API` |
| `save_load.cpp` 的 `S_load/S_save` | `GlobalAlloc` + 配置读写 | 替换为 localStorage / 服务端存储 |

**数据格式注意**：所有结构体都是 **little-endian 手工布局**（非 `#pragma pack` 结构体直读，而是按偏移 + 大小读），二进制解析逻辑可 1:1 平移，无端序风险。

### 2.4 UI/绘图层 —— 必须重写

`WinMain.cpp`（~3800 行）+ `OnDrawPaint/OnDrawGraph/CGR_CLASS` 深度耦合：
- `DialogBox` + 5 个 `DialogProc`（ZProc / SProc / JProc / MFSETProc / SET_ManualProc / ImgProc）
- GDI 绘制（`SetPixel/BitBlt/LineTo`）、滑块、Tab、弹出菜单、拖放
- 鼠标框选坐标、图形叠加、右键菜单

**这层本来就该换**：重写为 Web 前端（Canvas / WebGL + 现代框架）后，反而能获得更现代的交互与可视化。

### 2.5 无额外移植障碍

全项目搜索确认：
- ❌ 无 `CreateThread`（单线程，无并发耦合）
- ❌ 无 `__declspec(dllexport)`（非 DLL）
- ❌ 无 ODBC 实际调用（vcxproj 链接了 odbc32.lib 但源码无 SQL 调用）
- ❌ 无 COM / ActiveX / 注册表依赖
- ✅ 数据文件总量可控：单枚 = 1 字节图（22 波段 × 16368B ≈ 360KB）+ 2 字节图（≈ 720KB），浏览器内存可承载单枚处理

---

## 3. 三种改造路径对比

| 路径 | 方案 | 算法一致性 | 开发量 | 部署形态 | 适用 |
|---|---|---|---|---|---|
| **A. WASM 编译**（推荐） | 用 Emscripten 把算法层 .cpp 编译成 `.wasm`，前端通过 JS 调用；UI 用现代框架重写 | ✅ **100%**（原代码直接编译） | 中（构建链 + 前端） | 纯静态页 / 可选后端 | 需要**算法行为与原版完全一致**的验证场景 |
| B. TypeScript 重写 | 逐函数把 C++ 翻译为 TS，配合 OpenCV.js / canvas | ⚠️ 需逐行翻译，风险高（定点运算/溢出语义） | 高 | 纯静态页 | 无 WASM 构建链、团队全栈 TS |
| C. Node 后端 + N-API | 算法编译为 Node addon（.node），后端计算，前端 Web | ✅ 高 | 中高 | 前后端分离 | 需要服务端批量处理 / 多用户共享数据 |

**推荐 A**，理由：
1. 算法层 `Y_SIZE×X_SIZE = 88×186` 的像素规模**极小**，WASM 性能完全够用且接近原生；
2. 原代码直接编译 → **消除翻译引入的数值/逻辑偏差**（对钞票验证这类对特征值精度敏感的应用至关重要）；
3. UI 反正要重写，前端可以做成现代交互（图像预览、区域框选、特征曲线、批量列表）。

---

## 4. 推荐目标架构（路径 A）

```text
┌─────────────────────────────────────────────────────────┐
│  Web 前端（React / Vue + Canvas）                       │
│  图像显示 · 区域框选 · 特征曲线 · 参数面板 · 批量列表    │
├─────────────────────────────────────────────────────────┤
│  JS 适配层（WASM 绑定 + 状态上下文）                    │
│  - 全局状态 Context：global_oneimg/twoimg/Zparam/S2      │
│  - 文件读取：singan2.si2 / 坐标文件 / .dat / bin         │
├─────────────────────────────────────────────────────────┤
│  WASM 核心（Emscripten 编译的 C++ 算法层）              │
│  C_SI2 · GRADIENT/PREWITT/LAPLACIAN/NITI · bvmath       │
│  ALL32 · 各国算法 · CTemplateData 解析                  │
├─────────────────────────────────────────────────────────┤
│  数据文件（浏览器本地 / 可选后端对象存储）              │
│  GBV_DIV_H.bin · singan2.si2 · 坐标文件 · .dat          │
└─────────────────────────────────────────────────────────┘
```

### 移植分层清单

| 步骤 | 内容 | 主要文件 |
|---|---|---|
| 1. 抽取核心 | 把算法/解析代码从 Win32 工程抽成独立 `.cpp` 集合 | C_SI2.CPP、GRADIENT.CPP、PREWITT.CPP、LAPLACIAN.cpp、NITI.CPP、smooth_median.cpp、To2byte*.cpp、bvmath.cpp、ALL32.CPP、Euro.cpp、Chia.cpp、其余国家文件、CTemplate*.cpp、ReadImgData（摘逻辑） |
| 2. 全局状态封装 | 把 MAIN.H 的 `global_*` 打包为 `SinganContext` 结构体，WASM 导出 `init(ctx) / run(noteIndex)` 接口 | MAIN.H（新增 ctx.h） |
| 3. 去 HWND | 国家函数与 UI 包装函数签名去掉 `HWND`，删除 `GetDlgItemInt/SendMessage` 读 UI 的分支 | 各国家文件、GRADIENT.CPP 等（仅删 UI 包装） |
| 4. 文件 I/O 抽象 | 提供 `wasmFileRead(path) -> Uint8Array` 回调，替换 `fopen/fread` 与 `CFileAccess` | CTemplateData.cpp、CTemplate.cpp、CTemplateVTB.cpp、MainRun.cpp |
| 5. Emscripten 构建 | 编译为 `singan2-core.wasm`，导出 `loadBin/getFeature/runAll` 等 API | CMake/emscripten 配置 |
| 6. 前端重写 | 文件上传、配置面板、图像+区域叠加显示、特征曲线图、批量结果表、CSV 导出 | 新建前端工程 |
| 7. 对拍验证 | 用原版 exe 跑同一批 `.dat`，逐项对比 `S2[1..32]` | 测试工程 |

---

## 5. 关键技术难点与对策

| 难点 | 对策 |
|---|---|
| **定点运算语义**：`int`/`unsigned short` 溢出、`>>16`、`* w_Table[x] >> 16` 等 | WASM 直接编译原码 → 天然一致；若走 TS 重写，必须用 `Math.imul`/`>>>0` 模拟 32 位语义 |
| **结构体手工二进制布局**（非 packed 直读） | 解析逻辑按"偏移+大小"逐字段平移，WASM 内保持原 `memcpy` 逻辑即可 |
| **`GBV_DIV_H.bin` / 坐标文件** | 作为静态资源随前端发布，WASM 通过回调读取；确认字节序（原文件为 little-endian） |
| **数据规模**：2500 枚 × 720KB ≈ 1.8GB | 前端按枚懒加载（`File.slice` + 流式），不整包载入；WASM 内部单枚缓冲复用 |
| **`MAX_DATA=2300` 静态数组**（`S2_gr[2300][45]` 等） | 封装时改为动态分配，避免 WASM 内存浪费；或维持常量但降低内存布局 |
| **Shift-JIS 源码编码** | 移植时统一转 UTF-8 + 中文注释，同时保留与原文的对照关系 |
| **`singan2.si2` 配置兼容（V5 后新增 ATB/CTB/VTB）** | 按当前版本配置解析器实现，前端提供配置导入/导出 |

---

## 6. 工作量与里程碑（单人估算）

| 里程碑 | 内容 | 预估 |
|---|---|---|
| M0 POC | 抽取算法层 + Emscripten 编译 + 最小前端跑通 1 枚 | 1 周 |
| M1 | 全局状态封装 + 数据解析移植 + 坐标/除法表加载 | 1 周 |
| M2 | 完整特征管线（ALL32 + 主要国家）对拍验证 | 1~2 周 |
| M3 | Web UI 重写（图像/区域/曲线/批量/配置） | 2~3 周 |
| M4 | 全国家回归 + 性能优化 + 发布 | 1 周 |
| **合计** | | **约 1.5~2 个月** |

> 若仅做"算法 Web 化"（不含完整 UI，只提供 `analyze(files) -> JSON 特征表` 的批处理 Web 工具），可压缩到 **2~3 周**。

---

## 7. 风险清单

| 风险 | 等级 | 缓解 |
|---|---|---|
| 原版数据格式文档缺失，二进制解析需从代码反推 | 中 | 已建立 `03_文件格式与数据结构.md`；用原版 exe 输出做对拍基准 |
| 国家算法繁多（20+ 文件），回归验证量大 | 中 | 优先覆盖 Euro/Chia/USA/Canada/HongKong，其余按需 |
| WASM 与 GDI 渲染差异（原版有"速度校正后的坐标叠加"） | 低 | 前端 Canvas 重新实现叠加层 |
| 浏览器端 2500 枚批量计算耗时 | 低 | Web Worker 分片 + 进度条；单枚计算是毫秒级 |
| 对拍中发现原版本身有 bug（如已知的坐标 BUG） | 低 | 以原版输出为基准，差异单独记录 |

---

## 8. 建议的先行验证（POC 步骤）

1. 从仓库抽出算法文件，建立一个**纯 C 控制台测试工程**（不链接 Win32），喂入 1 枚 `.dat`，输出 `S2[1..32]`。
2. 与原版 exe 对同一枚数据的输出对比。
3. 若 S2 完全一致 → 用 Emscripten 编译同一批文件为 `.wasm`，在浏览器中重复对比。
4. 通过后即可进入 UI 重写阶段。

> 这一 POC 在 1 周内即可验证"算法可移植性"这一最大假设，建议先做。
