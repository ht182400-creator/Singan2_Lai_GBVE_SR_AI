#pragma once
#include <string>
#include <vector>
#include "singan2/types.h"

// M2 顶层算法入口：解析 -> 构建波段 -> 解析坐标 -> 计算 S2
namespace singan2 {

// 输入: dat 数据文件、record 记录号、坐标文件路径、w_table 路径(空则用理论表)、KIN、国家
// 输出: s2[0..32] 与 etc[0..14]
// 解析/读取失败抛 std::runtime_error
void run_algorithm(const std::string& dat_path, int record,
                   const std::string& zfile_path, const std::string& wtable_path,
                   int kin, int country,
                   std::vector<int>& s2_out, std::vector<int>& etc_out);

}  // namespace singan2
