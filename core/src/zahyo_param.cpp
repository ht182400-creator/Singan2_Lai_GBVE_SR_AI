// zahyo_param.cpp — 坐标文件(X_ATB_*.txt)解析，复刻 poc/parse/zahyo_reader.py
// 不依赖任何 Win32 API / Shift-JIS 解码库，纯标准库按字节识别段标题与数字字段
#include "singan2/zahyo_param.h"

#include <cstring>
#include <fstream>
#include <iterator>
#include <stdexcept>
#include <string>
#include <vector>

namespace singan2 {
namespace {

// 文件头: Shift-JIS【すかし１】(与 poc FILE_HEADER_BYTES 一致)
const uint8_t FILE_HEADER_BYTES[12] = {
    0x81, 0x79, 0x82, 0xB7, 0x82, 0xA9, 0x82, 0xB5, 0x82, 0x50, 0x81, 0x7A};

// 字段名顺序: LeftX, LeftY, RightX, RightY, niti_1, bibun_1, niti_2, bibun_2, gasosu
const char* FIELD_NAMES[9] = {"LeftX",  "LeftY",   "RightX", "RightY", "niti_1",
                              "bibun_1", "niti_2",  "bibun_2", "gasosu"};

// old_sukasi 段只保留 4 个坐标字段
const char* ERASE_FIELDS[5] = {"niti_1", "bibun_1", "niti_2", "bibun_2", "gasosu"};

// 段定义: 前缀 + 是否只读坐标 + 段标题字节(Shift-JIS) + 标题长度
struct SectionDef {
    const char* prefix;
    bool only_coord;
    const uint8_t* title;
    size_t title_len;
};

// 段标题字节(Shift-JIS)。ASCII 部分与 ASCII 同码；日文部分由 FILE_HEADER_BYTES 推导
const uint8_t T_Sukasi1[]    = {0x81, 0x79, 0x82, 0xB7, 0x82, 0xA9, 0x82, 0xB5, 0x82, 0x50, 0x81, 0x7A};
const uint8_t T_Sukasi2[]    = {0x81, 0x79, 0x82, 0xB7, 0x82, 0xA9, 0x82, 0xB5, 0x82, 0x51, 0x81, 0x7A};
const uint8_t T_Thred[]      = {0x81, 0x79, 0x54, 0x68, 0x72, 0x65, 0x61, 0x64, 0x81, 0x7A};
const uint8_t T_Sekigai1[]   = {0x81, 0x79, 0x49, 0x52, 0x20, 0x31, 0x81, 0x7A};
const uint8_t T_Sekigai2[]   = {0x81, 0x79, 0x49, 0x52, 0x20, 0x32, 0x81, 0x7A};
const uint8_t T_Sekigai3[]   = {0x81, 0x79, 0x49, 0x52, 0x20, 0x33, 0x81, 0x7A};
const uint8_t T_Yogore[]     = {0x81, 0x79, 0x53, 0x6F, 0x69, 0x6C, 0x81, 0x7A};
const uint8_t T_Horo[]       = {0x81, 0x79, 0x48, 0x6F, 0x6C, 0x6F, 0x67, 0x72, 0x61, 0x6D, 0x81, 0x7A};
const uint8_t T_old_sukasi[] = {0x81, 0x79, 0x57, 0x4D, 0x20, 0x32, 0x30, 0x78, 0x32, 0x30, 0x81, 0x7A};
const uint8_t T_etc1[]       = {0x81, 0x79, 0x45, 0x54, 0x43, 0x31, 0x81, 0x7A};
const uint8_t T_etc2[]       = {0x81, 0x79, 0x45, 0x54, 0x43, 0x32, 0x81, 0x7A};
const uint8_t T_etc3[]       = {0x81, 0x79, 0x45, 0x54, 0x43, 0x33, 0x81, 0x7A};
const uint8_t T_etc4[]       = {0x81, 0x79, 0x45, 0x54, 0x43, 0x34, 0x81, 0x7A};
const uint8_t T_etc5[]       = {0x81, 0x79, 0x45, 0x54, 0x43, 0x35, 0x81, 0x7A};
const uint8_t T_etc6[]       = {0x81, 0x79, 0x45, 0x54, 0x43, 0x36, 0x81, 0x7A};
const uint8_t T_etc7[]       = {0x81, 0x79, 0x45, 0x54, 0x43, 0x37, 0x81, 0x7A};
const uint8_t T_etc8[]       = {0x81, 0x79, 0x45, 0x54, 0x43, 0x38, 0x81, 0x7A};
const uint8_t T_etc9[]       = {0x81, 0x79, 0x45, 0x54, 0x43, 0x39, 0x81, 0x7A};
const uint8_t T_etc10[]      = {0x81, 0x79, 0x45, 0x54, 0x43, 0x31, 0x30, 0x81, 0x7A};
const uint8_t T_sup1[]       = {0x81, 0x79, 0x45, 0x54, 0x43, 0x31, 0x31, 0x81, 0x7A};
const uint8_t T_sup2[]       = {0x81, 0x79, 0x45, 0x54, 0x43, 0x31, 0x32, 0x81, 0x7A};
const uint8_t T_sup3[]       = {0x81, 0x79, 0x45, 0x54, 0x43, 0x31, 0x33, 0x81, 0x7A};
const uint8_t T_sup4[]       = {0x81, 0x79, 0x45, 0x54, 0x43, 0x31, 0x34, 0x81, 0x7A};
const uint8_t T_sup5[]       = {0x81, 0x79, 0x45, 0x54, 0x43, 0x31, 0x35, 0x81, 0x7A};
const uint8_t T_sup6[]       = {0x81, 0x79, 0x45, 0x54, 0x43, 0x31, 0x36, 0x81, 0x7A};
const uint8_t T_sup6b[]      = {0x81, 0x79, 0x45, 0x54, 0x43, 0x31, 0x37, 0x81, 0x7A};  // ETC17 -> sup6

// 段顺序严格对齐 ReadZFile 解析顺序(zahyo_reader.SECTIONS)
const SectionDef SECTIONS[] = {
    {"Sukasi1",    false, T_Sukasi1,    12},
    {"Sukasi2",    false, T_Sukasi2,    12},
    {"Thred",      false, T_Thred,      10},
    {"Sekigai1",   false, T_Sekigai1,    8},
    {"Sekigai2",   false, T_Sekigai2,    8},
    {"Sekigai3",   false, T_Sekigai3,    8},
    {"Yogore",     false, T_Yogore,      8},
    {"Horo",       false, T_Horo,       11},
    {"old_sukasi", true,  T_old_sukasi, 12},
    {"etc1",       false, T_etc1,        8},
    {"etc2",       false, T_etc2,        8},
    {"etc3",       false, T_etc3,        8},
    {"etc4",       false, T_etc4,        8},
    {"etc5",       false, T_etc5,        8},
    {"etc6",       false, T_etc6,        8},
    {"etc7",       false, T_etc7,        8},
    {"etc8",       false, T_etc8,        8},
    {"etc9",       false, T_etc9,        8},
    {"etc10",      false, T_etc10,       9},
    {"sup1",       false, T_sup1,        9},
    {"sup2",       false, T_sup2,        9},
    {"sup3",       false, T_sup3,        9},
    {"sup4",       false, T_sup4,        9},
    {"sup5",       false, T_sup5,        9},
    {"sup6",       false, T_sup6,        9},
    {"sup6",       false, T_sup6b,       9},  // ETC17 追加映射到 sup6
};

// 按行提取整数 token(数字/负号连续段)，忽略其它字节(逗号/全角逗号/空白)
std::vector<int> extract_ints(const std::vector<uint8_t>& line) {
    std::vector<int> out;
    std::string cur;
    for (uint8_t b : line) {
        if ((b >= '0' && b <= '9') || b == '-') {
            cur.push_back(static_cast<char>(b));
        } else if (!cur.empty()) {
            out.push_back(std::stoi(cur));
            cur.clear();
        }
    }
    if (!cur.empty()) out.push_back(std::stoi(cur));
    return out;
}

bool starts_with(const std::vector<uint8_t>& line, const uint8_t* pat, size_t plen) {
    if (line.size() < plen) return false;
    return std::memcmp(line.data(), pat, plen) == 0;
}

}  // namespace

int ZAHYO_PARAM::get(const std::string& key, int kin) const {
    auto it = fields.find(key);
    if (it == fields.end()) return 0;
    if (kin < 0 || kin >= static_cast<int>(it->second.size())) return 0;
    return it->second[kin];
}

int ZAHYO_PARAM::at(const std::string& section, const std::string& field, int kin) const {
    return get(section + "_" + field, kin);
}

ZAHYO_PARAM parse_zahyo_param(const std::string& file_path) {
    std::ifstream fp(file_path, std::ios::binary);
    if (!fp) throw std::runtime_error("无法打开坐标文件: " + file_path);

    std::vector<uint8_t> raw((std::istreambuf_iterator<char>(fp)), std::istreambuf_iterator<char>());
    if (raw.size() < 12 || std::memcmp(raw.data(), FILE_HEADER_BYTES, 12) != 0) {
        throw std::runtime_error("坐标文件头不匹配(期望 Shift-JIS すかし１头): " + file_path);
    }

    ZAHYO_PARAM zp;
    // 预初始化所有字段数组(长度 MAX_KIN+1，全 0)，索引 0 恒 0
    for (const auto& s : SECTIONS) {
        for (const char* f : FIELD_NAMES) {
            zp.fields[std::string(s.prefix) + "_" + f] =
                std::vector<int>(ZAHYO_PARAM::MAX_KIN + 1, 0);
        }
    }
    // old_sukasi 仅保留 4 个坐标字段
    for (const char* f : ERASE_FIELDS) {
        zp.fields.erase("old_sukasi_" + std::string(f));
    }

    size_t section_idx = 0;
    bool reading = false;
    std::string cur_prefix;
    bool cur_only_coord = false;
    int row = 1;

    size_t i = 0;
    while (i < raw.size()) {
        size_t ls = i;
        while (i < raw.size() && raw[i] != '\n') i++;
        std::vector<uint8_t> line(raw.begin() + ls, raw.begin() + i);
        i++;  // 跳过 \n（行尾可能残留 \r，被 extract_ints 忽略）

        if (line.empty()) continue;

        // 检测是否为当前期望段标题(顺序匹配，与 zahyo_reader 一致)
        if (section_idx < (sizeof(SECTIONS) / sizeof(SECTIONS[0])) &&
            starts_with(line, SECTIONS[section_idx].title, SECTIONS[section_idx].title_len)) {
            cur_prefix = SECTIONS[section_idx].prefix;
            cur_only_coord = SECTIONS[section_idx].only_coord;
            reading = true;
            row = 1;
            section_idx++;
            continue;
        }

        if (!reading) continue;

        std::vector<int> nums = extract_ints(line);
        if (nums.size() < 9) continue;

        if (row <= ZAHYO_PARAM::MAX_KIN) {
            if (cur_only_coord) {
                zp.fields["old_sukasi_LeftX"][row]  = nums[0];
                zp.fields["old_sukasi_LeftY"][row]  = nums[1];
                zp.fields["old_sukasi_RightX"][row] = nums[2];
                zp.fields["old_sukasi_RightY"][row] = nums[3];
            } else {
                for (int f = 0; f < 9; f++) {
                    zp.fields[cur_prefix + "_" + FIELD_NAMES[f]][row] = nums[f];
                }
            }
        }
        row++;
    }
    return zp;
}

}  // namespace singan2
