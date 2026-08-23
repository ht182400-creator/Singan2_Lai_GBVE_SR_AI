# SINGAN2（S2 防伪检测）项目构架与解读文档

> 生成时间：2026-08-20
> 阅读对象：接手该项目的开发者 / 需要推进 Web 化改造的算法工程师
> 本文档基于对 `Singan2_Lai_GBVE_SR_AI` 项目源码、文档、POC 与开发日志的通读归纳。

---

## 1. 项目定位

SINGAN2 是一个**纸币防伪特征 S2 值计算程序**（C++ / Win32 MFC，Visual Studio 工程）。它从钞票扫描图像（`.dat` 多波段数据）中按"区域（ATB 坐标）"定位若干检测点，对每个点的双波段图像计算一组 `S2[1..32]` 特征值，用于防伪判定。

当前工作目标（AI 侧）：**以原版 `SINGAN2.exe` 为对拍基准，用 Python 重建可独立于 Win32 运行的算法层，并逐步将整个功能 Web 化。**

项目存在两个目录：
- `Singan2_Lai_GBVE_SR_OLD`：**上游只读** 的原版 C++ 工程 + 可执行的 `release/SINGAN2.exe`（对拍基准源）。
- `Singan2_Lai_GBVE_SR_AI`：AI 改造工作区，含解读文档（`docs/`）与 Python POC（`poc/`）。

---

## 2. 目录结构

```
Singan2_Lai_GBVE_SR_AI/
├── docs/                      # 项目解读文档（核心交付物）
│   ├── README.md               # 文档导航中心
│   ├── 00_新手上手指南.md       # 环境/启动/构建/发布/FAQ
│   ├── 01_项目架构总览.md       # 架构全景（C++ → Web 改造目标）
│   ├── 02_核心处理流程与算法解读.md
│   ├── 03_文件格式与数据结构.md
│   ├── 04_代码文件解读手册.md
│   ├── 05_Web化改造可行性评估.md
│   ├── 06_改造套路与执行路线图.md
│   ├── 09_原版导出S2对拍基准操作指南.md
│   └── 开发日志/               # 逐日决策记录（2026-08-19 / 08-20）
├── poc/                       # Python 概念验证（数据解析层）
│   ├── run_poc.py              # M0 POC 驱动脚本
│   ├── parse/
│   │   ├── mariner_reader.py   # .dat → global_onedat / 波段图像
│   │   └── readzfile.py        # Z 参数坐标 .txt 解析
│   ├── tests/test_poc_parse.py
│   └── tools/
│       ├── _atb_reader.py      # ATB .bin 解析（对拍基准关键）
│       ├── analyze_binary.py / verify_dat.py
│       └── ...（其余工具脚本）
└── Singa_20260820192501.json  # 本对话导出文件（含本解读文档）
```

---

## 3. 关键架构认知（必须先分清的两套坐标体系）

这是全项目最容易踩坑的点：

### 3.1 ATB 二进制 `.bin` —— S2 主计算路径

- 界面 **"Load ATB"**（按钮 `IDC_BUTTON_LOAD_ATB`）加载，函数 `WinMain.cpp:3020 LoadATB`。
- 文件对话框过滤 `ATB File(*.bin)`，默认扩展名 `.bin`（`CFileAccess.cpp:132`）。
- 内存目标：`global_ATBS[128][512 * 8]`（`MAIN.H:507`），总大小 **524288 bytes**。
- 每区域 8 字节：`[x1, y1, width, height, a_threshold, a_diff_threshold, b_threshold, b_diff_threshold]`（均为 byte）。
- 访问公式：`global_ATBS[selectSecurity] + ((deno * 4 + faceToShow) * 8)`。
- **导出 S2 对拍基准必须走这条路径**（用 `.bin`），不能走 `.txt`。

### 3.2 Z 参数文本 `.txt` —— 另一套（`ReadZFile` / `global_Zparam`）

- 菜单 **"Re-Load Coordinate"** 加载，函数 `ZAHYO_READ.CPP:ReadZFile`。
- Shift-JIS 文本，9 列，含 `【】` 分组标题行。
- **不是 ATB 路径**，不要混用。

> 结论：原版 S2 主路径用 `.bin` ATB 坐标。算法层推进时需确认 `C_SI2`/`Ren.cpp` 究竟读 `global_Zparam` 还是 `global_ATBS`；当前倾向 `global_ATBS`，届时 `run_poc.py` 的 `--zfile .txt` 应改为 `--atb .bin`。

---

## 4. 数据流与核心算法解读

### 4.1 总体数据流

```
.dat 多波段扫描数据
   │  mariner_reader: extract_mm1_side(record) → global_onedat
   ▼
global_onedat（一维字节缓冲）
   │  build_onebyte_images → 各 8bit 波段图像
   ▼
各波段图像  ×  ATB 坐标(global_ATBS)
   │  Ren.cpp / C_SI2 逐区域采样计算
   ▼
S2_gr[枚][1..32]  →  a.csv（第1列=枚号，第2~33列=S2[1..32]）
```

### 4.2 POC（`run_poc.py`）当前能力（M0 数据解析层）

1. `extract_mm1_side(.dat, record)` → 还原 `global_onedat`（长度= `GLOBAL_ONEDAT_SIZE`）。
2. `build_onebyte_images(global_onedat)` → 还原各 8bit 波段图像。
3. 对每波段做基础统计（灰度积分 min/max/mean/sum），作为 S2[1] 类特征占位参考。
4. `parse_zfile(.txt)` 解析坐标区域。
5. 输出：`global_onedat_recN.bin`、`wave_stats_recN.json`、`areas.json`。

> POC 目前只到"数据解析 + 基础统计"，**尚未实现真正的 S2 算法层**。S2[1..32] 的精确复算是 Web 化改造的核心待办。

### 4.3 ATB bin 解析（`_atb_reader.py`，对拍基准的关键参考）

- 复刻 `MAIN.H:507` 布局：128 security × 512 denos × 8 bytes = 524288 bytes。
- 每 security 4 face，每 face 128 deno。
- `GetATBAreaName` 命名映射：0=WM1,1=WM2,2=Thread,3=IR1,4=IR2,5=IR3,6=Dirt,7=Hologram,8=WM(20x20)，其余为 ETC-/Sup-。
- 实测 `X_ATB_ZAR_132006050001.bin`：**31 个 security 非空（0-25 及 112-117），每个 security 内仅 face0 有数据**。

---

## 5. 原版导出 S2 对拍基准操作流程（9 步）

1. 放 `2A_DA_111017_115542.dat`、`X_ATB_ZAR_132006050001.bin`、`X_CTB_ZAR_131601260001_BV100.bin` 到 `release/`。
2. 双击 `release/SINGAN2.exe`。
3. ATB 区域点 **"Load..."**（不是 "Load Size..."），选 `X_ATB_ZAR_132006050001.bin`（或拖拽）。
4. （可选）点 **"Load Size..."** 选 `X_CTB_ZAR_131601260001_BV100.bin`（CTB=面额尺寸表）。
5. **不手动选国家**：`global_SelectCountry` 默认 0，保持默认即可。
6. 拖 `.dat` 到"数据1区域"，等单枚预览。
7. 点顶部 **"Switch View"** 切列表视图。
8. 勾选 **"Save S2 CSV"**（已默认勾选，`Ren.cpp` 也已强制写 `S2_gr`）。
9. 点 **"Run All"** → 跑完全部枚 → 点 **"View All Result"** → 生成 `release/a.csv`。

> 注意：
> - 拖 `.dat` 只跑单枚预览，不填充 `S2_gr`。
> - 菜单 `Short → Calculate all ComboBox` 调 `ComboRen()`，**不写 `S2_gr`**，别用它导出 S2。
> - "Load Size..." 加载的是 CTB，不是 ATB。

---

## 6. 构建状态与关键工程陷阱

- **`release/SINGAN2.exe` 已于 2026-08-20 19:34 重新编译成功**（681984 字节），含 Ren.cpp / WinMain.cpp / resource.rc 的 "Run All" / "Save S2 CSV" 改动。
- 构建脚本：`docs/_build_release.bat`。
- **解决方案平台是 `Release|x86`，不是 `Win32`**（.sln 层用 x86，项目内部映射到 Win32）。若用 `-p:Platform=Win32` 会报 `MSB4126`。
- **致命编码陷阱**：`SetManual.cpp`、`resource.rc` 等是 **Shift-JIS** 编码。用 UTF-8 文本工具编辑会破坏非 ASCII 字节且不可恢复。安全做法：仅做字节级 ASCII 替换，或用 `[Text.Encoding]::GetEncoding(932)` 正确转码。
  - 曾因 `SetManual.cpp` 中 Shift-JIS 字面量含字节 `0x5C`（反斜杠），在 UTF-8/GBK 下被当转义符导致编译失败。已把界面下拉标签 `斣栚`→`-Stage`、`弌椡偟側偄`→`NoOutput` 替换为 ASCII 才编过。
- 本机代码页 UTF-8(65001)，含非 ASCII 源/资源需 `/utf-8`；编译常见 `C4828` 警告（Shift-JIS 注释被替换）无害。

---

## 7. 当前进展与下一步路线

### 已完成
- 项目解读文档体系（docs/ 全 8 篇）。
- M0 POC 数据解析层（.dat → global_onedat → 波段统计，ATB .bin 解析）。
- 原版 `SINGAN2.exe` 重新编译成功（含导出 S2 CSV 的按钮改动）。
- 厘清 ATB `.bin` vs Z `.txt` 两套坐标体系。

### 下一步（按依赖排序）
1. **导出原版 S2 对拍基准**：按 `09_原版导出S2对拍基准操作指南.md` 用 `.bin` 导出 `a.csv`（唯一真值基准）。
2. **确认算法读取路径**：核实 `C_SI2`/`Ren.cpp` 用的是 `global_ATBS`(.bin) 还是 `global_Zparam`(.txt)；若是前者，`run_poc.py` 改接 `--atb .bin`。
3. **实现 S2[1..32] 算法层**：用原版 C++（Ren.cpp / C_SI2）逐行移植到 Python，以 `a.csv` 逐值对拍。
4. **Web 化改造**：依据 `05_Web化改造可行性评估.md` / `06_改造套路与执行路线图.md` 推进（算法层 → 服务层 → 前端）。

---

## 8. 风险与待确认项

- `release/singan2.si2` 是空模板，ATB/币种不自动加载，每次手动设。
- 币种选错则 S2 基准无效（计算按 `global_SelectCountry` 分派）。
- S2[1..32] 的精确算法公式尚未在 Python 侧复现，是最大不确定项。
- 两套坐标体系（ATB .bin / Z .txt）在后续改造中必须严格区分，避免再次混淆。
