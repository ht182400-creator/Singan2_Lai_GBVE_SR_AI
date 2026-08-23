#include "singan2/readzfile.h"
#include <fstream>
#include <sstream>
#include <iterator>
#include <cstdlib>

namespace singan2 {

std::vector<Area> parse_zfile(const std::string& file_path, const std::string& /*encoding*/) {
    std::ifstream f(file_path, std::ios::binary);
    if (!f) return {};
    std::vector<uint8_t> raw((std::istreambuf_iterator<char>(f)),
                             std::istreambuf_iterator<char>());

    // 兼容全角逗号(，=0x81 0x41)与顿号(、=0x81 0x81): 替换为半角逗号
    for (size_t i = 0; i + 1 < raw.size(); ++i) {
        if (raw[i] == 0x81 && (raw[i + 1] == 0x41 || raw[i + 1] == 0x81)) {
            raw[i] = ',';
            raw[i + 1] = ' ';
        }
    }
    std::string content(raw.begin(), raw.end());

    std::vector<Area> areas;
    std::stringstream ss(content);
    std::string line;
    while (std::getline(ss, line)) {
        // 仅保留数字与负号，逗号/小数点/其他（日文表头等）全部变空格，
        // 以便 split 后每个数字成为独立 token
        for (char& c : line) {
            if (!((c >= '0' && c <= '9') || c == '-')) {
                c = ' ';
            }
        }
        std::stringstream ls(line);
        std::vector<long> nums;
        long v = 0;
        while (ls >> v) nums.push_back(v);
        if (nums.size() < 9) continue;  // 表头或非数据行
        Area a;
        a.x1 = static_cast<int>(nums[0]);
        a.y1 = static_cast<int>(nums[1]);
        a.x2 = static_cast<int>(nums[2]);
        a.y2 = static_cast<int>(nums[3]);
        a.a_low = static_cast<int>(nums[4]);
        a.a_high = static_cast<int>(nums[5]);
        a.b_low = static_cast<int>(nums[6]);
        a.b_high = static_cast<int>(nums[7]);
        a.area_min = static_cast<int>(nums[8]);
        areas.push_back(a);
    }
    return areas;
}

}  // namespace singan2
