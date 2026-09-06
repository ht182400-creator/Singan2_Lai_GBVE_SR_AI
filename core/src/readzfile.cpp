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

// ---- 25 功能段解析（checkZ 闭环，复刻 ZAHYO_READ.CPP 段序）----
// 读出段序 -> 显示段序（checkZ 下标，见 readzfile.h 注释）
std::vector<ZFunc> parse_zfile_funcs(const std::string& file_path) {
    std::ifstream f(file_path, std::ios::binary);
    if (!f) return {};
    std::vector<uint8_t> raw((std::istreambuf_iterator<char>(f)),
                             std::istreambuf_iterator<char>());
    // 与 parse_zfile 相同：全角逗号 -> 半角
    for (size_t i = 0; i + 1 < raw.size(); ++i) {
        if (raw[i] == 0x81 && (raw[i + 1] == 0x41 || raw[i + 1] == 0x81)) {
            raw[i] = ',';
            raw[i + 1] = ' ';
        }
    }
    std::string content(raw.begin(), raw.end());

    // 逐行取前 4 个数字为矩形（阈值列不需要；日文表头行无数字自动跳过）
    static const char* kReadOrder[25] = {
        "WM1", "WM2", "Thread", "IR1", "IR2", "IR3", "Dirt", "Hologram",
        "MM(20×20)", "etc1", "etc2", "etc3", "etc4", "etc5", "etc6", "etc7",
        "etc8", "etc9", "etc10", "Sup1", "Sup2", "Sup3", "Sup4", "Sup5", "Sup6",
    };
    std::vector<ZFuncRect> rows;
    std::stringstream ss(content);
    std::string line;
    while (std::getline(ss, line)) {
        for (char& c : line) {
            if (!((c >= '0' && c <= '9') || c == '-')) c = ' ';
        }
        std::stringstream ls(line);
        long v = 0;
        int n[4];
        int cnt = 0;
        while (ls >> v && cnt < 4) n[cnt++] = static_cast<int>(v);
        if (cnt < 4) continue;  // 表头/残行
        rows.push_back({ n[0], n[1], n[2], n[3] });
    }

    // 段切分：候选段数 25（新版）/ 19（无 Sup 的旧版），取能整除者
    int sections = 0, per = 0;
    for (int cand : { 25, 19 }) {
        if (rows.size() >= static_cast<size_t>(cand) &&
            rows.size() % static_cast<size_t>(cand) == 0) {
            sections = cand;
            per = static_cast<int>(rows.size() / cand);
            break;
        }
    }
    if (sections == 0) return {};

    // 读出序 -> 显示序（checkZ 下标）重排
    // 读出序: 0 WM1 1 WM2 2 Thread 3 IR1 4 IR2 5 IR3 6 Dirt 7 Hologram 8 MM20x20 9..18 etc1..10 19..24 Sup1..6
    static const int kReadToCheck[25] = {
        1, 2, 6, 3, 4, 5, 8, 7, 0, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
        19, 20, 21, 22, 23, 24,
    };
    std::vector<ZFunc> byCheck(sections);
    for (int r = 0; r < sections; r++) {
        ZFunc& dst = byCheck[kReadToCheck[r]];
        dst.name = kReadOrder[r];
        dst.notes.assign(rows.begin() + r * per, rows.begin() + (r + 1) * per);
    }
    return byCheck;
}

}  // namespace singan2
