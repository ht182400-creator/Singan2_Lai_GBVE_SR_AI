#pragma once
#include <cstdint>
#include <string>
#include <vector>
#include <map>
#include "singan2/types.h"

// SINGAN2 坐标文件(X_ATB_*.txt)解析结果
// 复刻 poc/parse/zahyo_reader.py 的 ZAHYO_PARAM 字典结构
// 字段 key 形如 "Sukasi1_LeftX"，value 为长度 MAX_KIN+1 的数组（索引 0 恒 0，KIN 从 1 起）
namespace singan2 {

struct ZAHYO_PARAM {
    static constexpr int MAX_KIN = 361;  // ZAHYO_READ.CPP: const int MAX_KIN = 360 + 1
    std::map<std::string, std::vector<int>> fields;

    // 取字段在指定 KIN 的值；字段不存在返回 0
    int get(const std::string& key, int kin) const;
    // 便捷访问: section + "_" + field
    int at(const std::string& section, const std::string& field, int kin) const;
};

// 解析坐标文件，复刻 poc parse_zahyo
// 文件不存在 / 文件头不匹配(非 Shift-JIS すかし１头) 抛 std::runtime_error
ZAHYO_PARAM parse_zahyo_param(const std::string& file_path);

}  // namespace singan2
