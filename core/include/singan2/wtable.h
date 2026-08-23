#pragma once
#include <cstdint>
#include <string>
#include <vector>
#include "singan2/types.h"

// SINGAN2 除法表(GBV_DIV_H.bin)封装
// 复刻 poc/algo/wtable.py
namespace singan2 {

struct WTable {
    std::vector<uint16_t> table;  // 长度 W_TABLE_SIZE (16384)
};

// 加载 GBV_DIV_H.bin -> w_Table(uint16 小端)，不足 W_TABLE_SIZE 用 0 补齐
// 文件不存在抛 std::runtime_error
WTable load_w_table(const std::string& path);

// 生成理论 w_Table(65536/n，截断到 uint16)，用于无 bin 文件时的调试对照
WTable gen_w_table();

}  // namespace singan2
