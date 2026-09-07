#pragma once
#include <string>
#include <vector>
#include "singan2/types.h"

// M2 顶层算法入口：解析 -> 构建波段 -> 解析坐标 -> 计算 S2
namespace singan2 {

// 输入: dat 数据文件、record 记录号、坐标文件路径、w_table 路径(空则用理论表)、KIN、国家
// 输出: s2[0..32] 与 etc[0..14]；den_accum 非 nullptr 时国家分支的 DEN[0..51] 累积写入该缓冲
//      （OLD DEN 为全局变量，Ren 循环内跨 record 保留/累加，调用方须跨 record 传同一缓冲）
// 解析/读取失败抛 std::runtime_error
void run_algorithm(const std::string& dat_path, int record,
                   const std::string& zfile_path, const std::string& wtable_path,
                   int kin, int country,
                   std::vector<int>& s2_out, std::vector<int>& etc_out,
                   std::vector<int>* den_accum = nullptr);

}  // namespace singan2
