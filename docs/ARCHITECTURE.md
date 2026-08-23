# 架构与模块映射

## 数据流（端到端）

```
.dat (Mariner 原始数据)
   │  mariner_reader::parse_blocks        (块链遍历，复刻 CTemplateData::CheckFile)
   ▼
MM1_Side 块 (type==5) × 13
   │  extract_mm1_side                   → global_onedat (213096 B)
   ▼
build_onebyte_images                    → 13 个 8bit 波段图像 (88×186)
   │
   ▼  imageops (波段运算: gradient/niti/smooth/to_2byte)
OnebyteImage 字典 (Img1..Img22)
   │
   ▼  zahyo_reader::parse_zahyo          (坐标 → zparam 32 组)
      readzfile::parse_zfile             (坐标区域列表)
   │
   ▼  all32 (All32Engine, 段1-段9)
      ├─ c_si2: sikisa / Rinsetu2 / soil_ / average_concentration2
      │        / monochrome_ratio2 / infrared_white_ratio2 / RINSETU
      │        / Suka_Kyotyo / Siki_Kyotyo
      └─ wtable: load_w_table / gen_w_table
   ▼
S2[32] + etc10/11      → a.csv 行（每张图像一行）
```

## 模块映射：poc (Python) → core (C++)

| poc 模块 | C++ 头/源 | 状态 |
|----------|-----------|------|
| `parse/mariner_reader.py` | `core/include/singan2/mariner_reader.h` + `src/mariner_reader.cpp` | ✅ 已移植，对拍通过 |
| `parse/readzfile.py` | `core/include/singan2/readzfile.h` + `src/readzfile.cpp` | ✅ 已移植，对拍通过 |
| `algo/imageops.py` | `core/.../imageops.{h,cpp}` | ⏳ |
| `algo/wtable.py` | `core/.../wtable.{h,cpp}` | ⏳ |
| `algo/c_si2.py` | `core/.../c_si2.{h,cpp}` | ⏳ |
| `algo/all32.py` | `core/.../all32.{h,cpp}` | ⏳ |
| `parse/zahyo_reader.py` | `core/.../zahyo_reader.{h,cpp}` | ⏳ |

## 关键常量（types.h）

| 常量 | 值 | 含义 |
|------|----|------|
| `Y_SIZE` / `X_SIZE` | 88 / 186 | 图像尺寸（文件内字段为 0，硬编码） |
| `ONESIZE` | 16368 | 单波段像素数 |
| `SIZE_NON_GBVX` | 24 | 波段间填充 |
| `MM1_SIDE_BLOCK` | 16392 | 单 MM1_Side 块 |
| `WAVE_COUNT` | 13 | MM1_Side 波段数 |
| `BLOCK_HEADER` | 24 | 块头字节 |
| `GLOBAL_ONEDAT_SIZE` | 213096 | 单枚 global_onedat |

## 对拍策略

每移植一个模块，用 `poc/output/` 的 golden 做回归：
- `global_onedat_rec0.bin` — extract_mm1_side 的 byte 级基准
- `areas.json` — parse_zfile 的区域基准
- `s2_result_rec0.json` — all32 的 S2[32] 基准（最终端到端验证）
- `expected_kin1.json` — KIN=1 的完整预期（跨工程真值）
