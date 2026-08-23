#pragma once
#include <string>
#include <vector>

// 坐标/区域文件(X_ATB_*.txt)解析层
// 复刻原工程 ZAHYO_READ.CPP::ReadZFile 的文本坐标解析逻辑
// 文件格式（Shift-JIS 日文表头 + 数据行）：
//   表头行: 开始X,开始Y,终了X,终了Y,A阈值下限,A阈值上限,B阈值下限,B阈值上限,面积最小値
//   数据行: 一个矩形区域 + 阈值（逗号分隔，兼容全角/半角逗号）
namespace singan2 {

struct Area {
    int x1 = 0, y1 = 0, x2 = 0, y2 = 0;
    int a_low = 0, a_high = 0, b_low = 0, b_high = 0;
    int area_min = 0;
};

// 解析坐标文件，返回区域列表
std::vector<Area> parse_zfile(const std::string& file_path,
                              const std::string& encoding = "shift_jis");

}  // namespace singan2
