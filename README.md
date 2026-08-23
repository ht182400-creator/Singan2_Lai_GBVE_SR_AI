# Singan2 (GBVE / SR) — 重构工程

SINGAN2 算法的现代化重构版本：纯 C++17 算法核心 + HTTP API + Web 前端（React/ECharts）。
目标：**脱离原 VC6/Win32 MFC 工程**，跨平台、可测试、可远程调用。

> 算法正确性以 `poc/`（Python 参考实现）为基准；`poc/output/` 下的产物作为 C++ 对拍的 golden。

## 阶段状态

| 阶段 | 内容 | 状态 |
|------|------|------|
| POC 验证 | poc 算法层输出 vs `expected_kin1.json` | ✅ 通过（record 0 全 32 项一致） |
| M1 解析层 | `mariner_reader` + `readzfile` C++ 移植 + 对拍 | ✅ 通过 |
| M2 算法核心 | `imageops` + `wtable` + `c_si2` + `all32` C++ 移植 | ✅ 通过（`run_algorithm` 输出与 poc golden 逐项一致） |
| M3 HTTP API | C++ HTTP server（cpp-httplib）暴露算法 | ✅ 通过（`server/smoke_test.py` 全 PASS） |
| M4 Web 前端 | React + ECharts 调用 API（1:1 复刻原版 MFC 主界面） | ✅ 完成（含 25 文件 / 107 用例 Vitest 测试全绿） |

## 目录结构

```
Singan2_Lai_GBVE_SR_AI/
├── core/                     # C++ 算法核心（C++17）
│   ├── include/singan2/     # 公共头 (types.h, mariner_reader.h, readzfile.h, ...)
│   └── src/                 # 实现
├── server/                  # HTTP API（M3，cpp-httplib）
├── web/                     # React 前端（M4，Vite + ECharts）
│   └── src/components/      # 21+ 个 UI 组件（绝对定位 1:1 复刻）
├── tests/                   # 对拍测试 (test_parse.cpp)
├── poc/                     # Python 参考实现 + golden 输出
│   ├── parse/  algo/  tools/
│   └── output/              # golden (global_onedat_rec0.bin, areas.json, s2_result_rec0.json, ...)
├── data/                    # 数据文件 (.dat, 坐标 txt, .bin)
├── docs/                    # 项目架构 / 流程 / 界面交互 / 对拍指南等（中文 markdown）
├── third_party/             # 第三方依赖（如 cpp-httplib 头文件）
├── build/                   # CMake 构建目录（生成，已忽略）
├── CMakeLists.txt           # 顶层
├── build_core.bat           # 一键构建 core
├── run_all.bat / stop_all.bat # 启动 / 停止 server + web 开发服务器
└── README.md
```

## 构建

需要：CMake ≥ 3.20、MSVC (VS2022) 或任意 C++17 编译器。

```bash
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Debug
```

> **x64 陷阱**：若 `build/` 曾用 Win32 配置过，重配 x64 会报 "platform used previously" 冲突，
> 需先 `Remove-Item -Recurse -Force build` 再重新 `cmake -S . -B build -A x64`。

## HTTP API（M3）

`server/server.cpp` 暴露的端点：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/health` | 健康检查 |
| POST | `/api/analyze-path` | 按路径分析数据 |
| POST | `/api/analyze` | multipart 上传文件分析 |

冒烟测试（需先启动 `singan2_server.exe` 监听 `:8080`）：

```bash
python server/smoke_test.py
```

## Web 前端（M4）

```bash
cd web
npm install
npm run dev          # Vite 开发服务器 @ :5173（已配 /api -> :8080 代理）
npm test             # Vitest 全量测试（25 文件 / 107 用例）
```

### Web 布局冻结约束（重要）

原版为 Win32/MFC（`Singan2_Lai_GBVE_SR_OLD` 工程），Web 端按 **1:1 像素级** 复刻其主界面：

- 主窗口 `.main-window`：`1700 × 1050`，`scale(min(100vw/1700, 100vh/1050))`
- **左侧画布 `.main-canvas`：`left:0; top:88; width:900; height:912`**（已锁定，禁止改动）
- **右侧区 `.right-area`：`left:900; top:88; width:800; height:682`**（起点 900 = 左侧画布右沿）
- 顶部 Tab / 底部状态条：宽 `1700`
- 后续任何"对齐原版"的调整，**只能在 right-area（起点 900）内部微调坐标**，绝不动左侧结构。
- UI 还原的权威依据：`Singan2_Lai_GBVE_SR_OLD` 的 `resource.rc` 与 `WinMain.cpp`（控件文字 / ID），而非截图。

## 测试（对拍验证）

解析层对拍：用原始数据文件 + poc 生成的 golden 验证 C++ 实现一致性。

```bash
# 先确保 poc/output 是最新的（用当前 data 重新生成）
cd poc && python run_poc.py --dat ../data/2A_DA_111017_115542.dat \
                            --zfile ../data/ZAR/X_ATB_ZAR_132006050001.txt \
                            --record 0 --out output

# 运行 C++ 对拍
./build/tests/Debug/test_parse.exe \
    ../data/2A_DA_111017_115542.dat \
    ../data/ZAR/X_ATB_ZAR_132006050001.txt \
    ../poc/output
# 期望: [1] extract_mm1_side: PASS  [2] parse_zfile: PASS
```

前端回归（Vitest）：

```bash
cd web && npm test        # ✅ 25 文件 / 107 用例全绿
```

## 编码约定

- 纯 C++17，无外部运行时依赖（图像运算自实现，避免 OpenCV 重依赖）
- 所有魔法数字提取为 `core/include/singan2/types.h` 中的常量
- 每个模块以 `poc/` 对应 Python 模块为基准，输出须与 golden 逐字节/逐项一致
- 关键函数配单元测试（对拍 golden）
- 前端组件须"自给自足"（内置默认值），可无 props 直接 `render(<X/>)` 测试

## 发布说明

- 仓库默认分支：`main`（原 `master` 已本地改名对齐）。
- 完整工程已通过 GitHub API（Blob/Tree/Commit）上传至 `main`，commit 含全部源码、数据样本、文档。
- 已知限制：单个 GitHub blob ≤ 25MB，**超大会话导出 JSON（>150MB）不参与上传**，按需用 Git LFS 或拆分归档。
- `.gitignore` 已排除 `node_modules/`、`build/`、`dist/`、`.codebuddy/`、`*.pyc`、`*.test.*`、`tests/`、`data/` 下 >10MB 样本等大体积 / 生成物。
- 本地 git 直连 GitHub（443）在部分网络环境下不稳定时，可复用 GitHub REST API 方式同步。
