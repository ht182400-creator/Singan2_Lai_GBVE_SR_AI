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
| M4 Web 前端 | React + ECharts 调用 API | 🔄 进行中（AI 工程 B） |

## 目录结构

```
Singan2_Lai_GBVE_SR_AI/
├── core/                     # C++ 算法核心
│   ├── include/singan2/     # 公共头 (types.h, mariner_reader.h, readzfile.h, ...)
│   └── src/                 # 实现
├── server/                  # HTTP API（M3）
├── web/                     # React 前端（M4）
├── tests/                   # 对拍测试 (test_parse.cpp)
├── poc/                     # Python 参考实现 + golden 输出
│   ├── parse/  algo/  tools/
│   └── output/              # golden (global_onedat_rec0.bin, areas.json, s2_result_rec0.json, ...)
├── data/                    # 数据文件 (.dat, 坐标 txt)
├── build/                   # CMake 构建目录（生成）
├── CMakeLists.txt           # 顶层
└── docs/ARCHITECTURE.md
```

## 构建

需要：CMake ≥ 3.20、MSVC (VS2022) 或任意 C++17 编译器。

```bash
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Debug
```

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

## 编码约定

- 纯 C++17，无外部运行时依赖（图像运算自实现，避免 OpenCV 重依赖）
- 所有魔法数字提取为 `core/include/singan2/types.h` 中的常量
- 每个模块以 `poc/` 对应 Python 模块为基准，输出须与 golden 逐字节/逐项一致
- 关键函数配单元测试（对拍 golden）
