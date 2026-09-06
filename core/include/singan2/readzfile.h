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

// ---- Setting Dialogue「Select Coordinate to be Displayed」(check_zahyo) 闭环 ----
// 复刻 ZAHYO_READ.CPP::ReadZFile 的 25 功能段 + ELIA.cpp::draw_e 的显示语义：
//   Z 文件 = 25 个功能段依序排列，每段 dNumber(=面额数×4) 行，每行 ≥4 个数字
//   (LeftX, LeftY, RightX, RightY, 阈值...)；第 9 段「既存すかし/MM(20×20)」仅 4 列。
// 读出段序（ReadZFile）：WM1, WM2, Thread, IR1, IR2, IR3, Dirt, Hologram, MM(20×20),
//   etc1..etc10, Sup1..Sup6；显示段序（checkZ 下标）：MM(20×20), WM1, WM2, IR1..IR3,
//   Thread, Hologram, Dirt(Dart), etc1..etc10, Sup1..Sup6（输出已按显示序排好）。
struct ZFuncRect {
    int x1 = 0, y1 = 0, x2 = 0, y2 = 0;
};
struct ZFunc {
    std::string name;                 // ELIA.cpp func_name（显示名）
    std::vector<ZFuncRect> notes;     // 每面额一个矩形（notes[k] = 第 k+1 面额）
};

// 按功能段解析坐标文件；行数无法整除段数（25/19）时返回空（格式不符/旧版文件）
std::vector<ZFunc> parse_zfile_funcs(const std::string& file_path);

}  // namespace singan2
