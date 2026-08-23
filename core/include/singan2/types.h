#pragma once
#include <cstdint>

// SINGAN2 算法核心公共常量与类型
// 常量与 poc/parse/mariner_reader.py 保持一致
namespace singan2 {

// 图像尺寸 (mariner_reader.py 常量)
// 注意：文件内 width/height 字段为 0，此处硬编码为已验证值
constexpr int Y_SIZE = 88;                 // 图像高度（行）
constexpr int X_SIZE = 186;                // 图像宽度（列）
constexpr int ONESIZE = Y_SIZE * X_SIZE;   // 单波段像素数 = 16368
constexpr int SIZE_NON_GBVX = 24;          // 每波段间填充字节（GBVX）
constexpr int MM1_SIDE_BLOCK = ONESIZE + SIZE_NON_GBVX;  // 单 MM1_Side 块字节 = 16392
constexpr int WAVE_COUNT = 13;             // MM1_Side 波段数
constexpr int BLOCK_HEADER = 24;           // 块头字节数（sizeof(BYTE[24])）
constexpr int GLOBAL_ONEDAT_SIZE = MM1_SIDE_BLOCK * WAVE_COUNT;  // 单枚 = 213096
constexpr int SMALL_SIZE = 8192;           // MAIN.H SMALL_SIZE
constexpr int SMALL_SKIP = 1024;           // 读取后跳过的头部字节数
constexpr int W_TABLE_SIZE = 16384;        // w_table 每表大小(wtable.py: 32768//2)

}  // namespace singan2
