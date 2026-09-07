// M3 HTTP API 服务：包装已验证的 C++ 算法层，对外提供 JSON 接口。
// 技术栈：cpp-httplib（单头文件，Windows 下使用 Winsock，无 OpenSSL 依赖）。
//
// 端点总览（P0–P5 模块功能同步，详见 docs/11_模块功能同步方案_P0-P5.md）：
//   GET  /health                    健康检查
//   GET  /api/debug-log             读取 singan2_debug.log 文本（供前端日志查看器，按模块/级别彩色展示）
//   GET  /api/fs/list               ?path=<dir|file>&ext=.bin       -> {path,parent,dirs[],files[]}（本地文件选择）
//   -- P0 基础数据链路 --
//   POST /api/session/open          {dat_path}                     -> {record_count, wave_count, waves[]}
//   POST /api/image                 {dat_path,record,wave,mode,...}-> {width,height,encoding,min,max,data(base64)}
//   POST /api/small-image           {dat_path,record}              -> {size,data(base64)}
//   POST /api/dsparm                {dat_path,record}              -> DSP-ARM Function 页（函数名文件 + 小图像段 u16）
//   -- P1 分析链路 --
//   POST /api/analyze               多部件上传 .dat
//   POST /api/analyze-path          {dat_path,zfile_path,record,kin,country}
//   -- P2 图像处理 --
//   POST /api/imageops              {dat_path,record,wave,ops[]}   -> 处理后图像
//   -- P3 Graph --
//   POST /api/graph/make            {dat_path,start_record,max_records,step,wave,niti_type,grad_type,gain,threshold,color_point,area_*,black,wtable_path}
//   POST /api/graph/combine         {a[],b[],mode}
//   POST /api/graph/save|load       {path[,series]}
//   -- P4 ATB / VTB / 坐标 --
//   POST /api/ren/sm-dsp            {dat_path,zfile_path,...}      -> SM_dsp.dat 结果落盘（Ren/DspOverWrite）
//   POST /api/zfile/parse           {path,encoding}                -> {areas[],funcs[]}
//   POST /api/atb/load              {path}                          -> {isSru,areaNames[],lines[],bytes[]}
//   POST /api/atb/area              {index}                         -> {lines[],bytes[]}（切 area）
//   POST /api/atb/update            {area,entry,bytes[8]}           -> 更新条目并整表写回文件
//   POST /api/atb/ctb               {path}                          -> {notes[]}（Load Size... 的 CTB 尺寸列表）
//   POST /api/vtb/load              {path}                          -> {modes[6].processes[8].commands[]}
//   -- P5 保存与配置 --
//   POST /api/export/csv            {path,header,rows}
//   POST /api/config/save|load      {path[,config]}
//
// 说明：P3–P5 中依赖未移植 MFC 模块（CreateGraph/OnDrawPaint/CGR_CLASS/CTemplateVTB/save_load/si2）
// 的部分，返回结构已按前端需要定义，实现为"可用近似"，并在响应中带 note 标注 [需补移植]。

#include <algorithm>
#include <cctype>
#include <cmath>
#include <chrono>
#include <cstdio>
#include <cstdint>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <map>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <tuple>
#include <vector>
#include <atomic>
#include <memory>

#include "httplib.h"
#include "singan2/algo.h"
#include "singan2/imageops.h"
#include "singan2/mariner_reader.h"
#include "singan2/readzfile.h"
#include "singan2/wtable.h"

namespace fs = std::filesystem;

using singan2::ImageEngine;
using singan2::WTable;

// 13 个波段的图像名（与 mariner_reader::build_onebyte_images 的 WAVE_TO_IMG 顺序一致）
static const char* kWaveNames[13] = {"Img1",  "Img20", "Img21", "Img22", "Img2",
                                     "Img3",  "Img4",  "Img5",  "Img6",  "Img16",
                                     "Img17", "Img18", "Img19"};

// ---- 极简 JSON 解析辅助（仅用于可信请求体）----
static size_t json_find_key(const std::string& body, const std::string& key, size_t& after_colon) {
    std::string pat = "\"" + key + "\"";
    size_t p = body.find(pat);
    if (p == std::string::npos) return std::string::npos;
    size_t c = body.find(':', p + pat.size());
    if (c == std::string::npos) return std::string::npos;
    after_colon = c + 1;
    return p;
}

static size_t json_skip_ws(const std::string& s, size_t i) {
    while (i < s.size() && std::isspace(static_cast<unsigned char>(s[i]))) i++;
    return i;
}

static std::string json_get_str(const std::string& body, const std::string& key,
                                const std::string& def) {
    size_t c = 0;
    if (json_find_key(body, key, c) == std::string::npos) return def;
    size_t q1 = body.find('"', c);
    if (q1 == std::string::npos) return def;
    size_t q2 = body.find('"', q1 + 1);
    if (q2 == std::string::npos) return def;
    return body.substr(q1 + 1, q2 - q1 - 1);
}

static int json_get_int(const std::string& body, const std::string& key, int def) {
    size_t c = 0;
    if (json_find_key(body, key, c) == std::string::npos) return def;
    size_t s = json_skip_ws(body, c);
    size_t e = s;
    while (e < body.size() &&
           (std::isdigit(static_cast<unsigned char>(body[e])) || body[e] == '-'))
        e++;
    if (e == s) return def;
    try {
        return std::stoi(body.substr(s, e - s));
    } catch (...) {
        return def;
    }
}

static bool json_get_bool(const std::string& body, const std::string& key, bool def) {
    size_t c = 0;
    if (json_find_key(body, key, c) == std::string::npos) return def;
    size_t s = json_skip_ws(body, c);
    if (body.compare(s, 4, "true") == 0) return true;
    if (body.compare(s, 5, "false") == 0) return false;
    return def;
}

// 从 open 位置（'{' 或 '['）提取配平的 JSON 片段
static std::string json_balanced(const std::string& s, size_t open) {
    if (open >= s.size()) return "";
    char oc = s[open];
    char cc = (oc == '{') ? '}' : ']';
    if (oc != '{' && oc != '[') return "";
    int depth = 0;
    bool in_str = false;
    for (size_t i = open; i < s.size(); i++) {
        char c = s[i];
        if (in_str) {
            if (c == '\\') i++;
            else if (c == '"') in_str = false;
            continue;
        }
        if (c == '"') { in_str = true; continue; }
        if (c == oc) depth++;
        else if (c == cc) {
            depth--;
            if (depth == 0) return s.substr(open, i - open + 1);
        }
    }
    return "";
}

// 取任意类型（对象/数组/字符串/数字）的原始片段
static std::string json_get_raw(const std::string& body, const std::string& key) {
    size_t c = 0;
    if (json_find_key(body, key, c) == std::string::npos) return "";
    size_t i = json_skip_ws(body, c);
    if (i >= body.size()) return "";
    if (body[i] == '{' || body[i] == '[') return json_balanced(body, i);
    if (body[i] == '"') {
        size_t e = body.find('"', i + 1);
        return e == std::string::npos ? "" : body.substr(i, e - i + 1);
    }
    size_t e = i;
    while (e < body.size() && body[e] != ',' && body[e] != '}' && body[e] != ']') e++;
    return body.substr(i, e - i);
}

// 拆分 JSON 数组中的各个元素（对象、数组、字符串、数字均支持）
static std::vector<std::string> json_array_elements(const std::string& arr) {
    std::vector<std::string> out;
    if (arr.size() < 2 || arr[0] != '[') return out;
    size_t i = 1;
    while (i < arr.size()) {
        char c = arr[i];
        if (c == ']') break;
        if (c == '{' || c == '[') {
            std::string sub = json_balanced(arr, i);
            if (sub.empty()) break;
            out.push_back(sub);
            i += sub.size();
            continue;
        }
        if (c == '"') {
            size_t e = arr.find('"', i + 1);
            if (e == std::string::npos) break;
            out.push_back(arr.substr(i, e - i + 1));
            i = e + 1;
            continue;
        }
        if (std::isdigit(static_cast<unsigned char>(c)) || c == '-' || c == '+') {
            size_t s = i;
            while (i < arr.size() &&
                   (std::isdigit(static_cast<unsigned char>(arr[i])) || arr[i] == '.' ||
                    arr[i] == '-' || arr[i] == '+' || arr[i] == 'e' || arr[i] == 'E'))
                i++;
            out.push_back(arr.substr(s, i - s));
            continue;
        }
        i++;
    }
    return out;
}

// 拆分 JSON 数组中的各个对象元素
static std::vector<std::string> json_array_objects(const std::string& arr) {
    std::vector<std::string> out;
    if (arr.size() < 2 || arr[0] != '[') return out;
    size_t i = 1;
    while (i < arr.size()) {
        if (arr[i] == '{') {
            std::string o = json_balanced(arr, i);
            if (o.empty()) break;
            out.push_back(o);
            i += o.size();
        } else {
            i++;
        }
    }
    return out;
}

// URL 解码（用于解析上传文件名查询参数），仅覆盖 %XX 与 + 转义
static std::string url_decode(const std::string& in) {
  std::string out;
  out.reserve(in.size());
  auto hx = [](char c) -> int {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    return -1;
  };
  for (size_t i = 0; i < in.size(); ++i) {
    if (in[i] == '%' && i + 2 < in.size()) {
      int hi = hx(in[i + 1]), lo = hx(in[i + 2]);
      if (hi >= 0 && lo >= 0) {
        out.push_back(static_cast<char>(hi * 16 + lo));
        i += 2;
        continue;
      }
    } else if (in[i] == '+') {
      out.push_back(' ');
      continue;
    }
    out.push_back(in[i]);
  }
  return out;
}

// ---- JSON 序列化辅助 ----
static std::string json_escape(const std::string& s) {
    std::string o;
    o.reserve(s.size() + 8);
    for (unsigned char c : s) {
        switch (c) {
            case '"': o += "\\\""; break;
            case '\\': o += "\\\\"; break;
            case '\n': o += "\\n"; break;
            case '\r': o += "\\r"; break;
            case '\t': o += "\\t"; break;
            default:
                if (c < 0x20) {
                    char buf[8];
                    std::snprintf(buf, sizeof(buf), "\\u%04x", c);
                    o += buf;
                } else {
                    o += static_cast<char>(c);
                }
        }
    }
    return o;
}

static std::string to_json_array(const std::vector<int>& v) {
    std::string s = "[";
    for (size_t i = 0; i < v.size(); i++) {
        if (i) s += ",";
        s += std::to_string(v[i]);
    }
    s += "]";
    return s;
}

static std::string to_json_array(const std::vector<double>& v, int prec = 4) {
    std::string s = "[";
    char buf[64];
    for (size_t i = 0; i < v.size(); i++) {
        if (i) s += ",";
        std::snprintf(buf, sizeof(buf), "%.*f", prec, v[i]);
        s += buf;
    }
    s += "]";
    return s;
}

// ---- base64 编码 ----
static const char* kBase64 =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static std::string base64_encode(const uint8_t* data, size_t len) {
    std::string out;
    out.reserve(((len + 2) / 3) * 4);
    for (size_t i = 0; i < len; i += 3) {
        uint32_t n = static_cast<uint32_t>(data[i]) << 16;
        if (i + 1 < len) n |= static_cast<uint32_t>(data[i + 1]) << 8;
        if (i + 2 < len) n |= static_cast<uint32_t>(data[i + 2]);
        out.push_back(kBase64[(n >> 18) & 63]);
        out.push_back(kBase64[(n >> 12) & 63]);
        out.push_back((i + 1 < len) ? kBase64[(n >> 6) & 63] : '=');
        out.push_back((i + 2 < len) ? kBase64[n & 63] : '=');
    }
    return out;
}

static std::string encode_u8(const std::vector<uint8_t>& v, int& mn, int& mx) {
    mn = 0; mx = 0;
    if (!v.empty()) {
        mn = mx = v[0];
        for (uint8_t x : v) {
            if (x < mn) mn = x;
            if (x > mx) mx = x;
        }
    }
    return base64_encode(v.data(), v.size());
}

static std::string encode_u16(const std::vector<uint16_t>& v, int& mn, int& mx) {
    mn = 0; mx = 0;
    std::vector<uint8_t> bytes(v.size() * 2);
    for (size_t i = 0; i < v.size(); i++) {
        bytes[i * 2] = static_cast<uint8_t>(v[i] & 0xff);          // 小端
        bytes[i * 2 + 1] = static_cast<uint8_t>((v[i] >> 8) & 0xff);
    }
    if (!v.empty()) {
        mn = mx = static_cast<int>(v[0]);
        for (uint16_t x : v) {
            int xi = static_cast<int>(x);
            if (xi < mn) mn = xi;
            if (xi > mx) mx = xi;
        }
    }
    return base64_encode(bytes.data(), bytes.size());
}

// ---- 除法表加载（带缓存，线程安全：浏览器会并发请求 /api/image）----
static const WTable& get_wtable(const std::string& path) {
    static std::mutex mu;
    static std::map<std::string, WTable> cache;
    const std::string key = path.empty() ? std::string("<theory>") : path;
    std::lock_guard<std::mutex> lk(mu);
    const auto it = cache.find(key);
    if (it != cache.end()) return it->second;
    WTable wt;
    if (path.empty()) {
        wt = singan2::gen_w_table();
    } else {
        try {
            wt = singan2::load_w_table(path);
        } catch (...) {
            wt = singan2::gen_w_table();
        }
    }
    // std::map 节点地址稳定且从不删除，返回引用在解锁后仍有效
    return cache.emplace(key, std::move(wt)).first->second;
}

// ---- 构建 ImageEngine（读取指定记录的 13 波段并转 2 字节）----
static bool build_engine(const std::string& dat_path, int record,
                         const std::string& wtable_path, ImageEngine& eng, std::string& err) {
    std::vector<uint8_t> onedat = singan2::extract_mm1_side(dat_path, record);
    if (onedat.empty()) {
        err = "读取记录失败：record 越界或文件损坏";
        return false;
    }
    std::vector<singan2::OnebyteImage> imgs = singan2::build_onebyte_images(onedat);
    if (imgs.empty()) {
        err = "波段图像构建失败";
        return false;
    }
    eng.set_oneimg(imgs);
    eng.to_2byte();
    eng.w_table = &get_wtable(wtable_path);
    return true;
}

// 波段参数 -> 图像名（wave 可为索引 0..12，或形如 "Img1"）
static std::string resolve_wave_name(const std::string& body, const std::string& key,
                                     int def_index) {
    std::string raw = json_get_raw(body, key);
    if (!raw.empty() && raw[0] == '"') {
        std::string name = raw.substr(1, raw.size() - 2);
        return name.empty() ? std::string(kWaveNames[def_index]) : name;
    }
    int idx = json_get_int(body, key, def_index);
    if (idx < 0) idx = 0;
    if (idx > 12) idx = 12;
    return kWaveNames[idx];
}

// 图像名 -> tab（ImgN 对应 tab = N-1）
static int name_to_tab(const std::string& name) {
    if (name.size() > 3 && name.compare(0, 3, "Img") == 0) {
        try {
            return std::stoi(name.substr(3)) - 1;
        } catch (...) {
            return 0;
        }
    }
    return 0;
}

// 判断波段名是否为文件块中直接存放的原始波段（Img7..Img15 为中间计算波段）。
static bool is_raw_wave_name(const std::string& name) {
    int tab = name_to_tab(name);
    return tab < 6 || tab > 14;
}

// ---- Make Graph 专用：复刻 CreateGraph1 + ComputeSuppleResult ----
// 对当前 twoimg[tab] 做二值化（阈值作用于 twoimg 截断到 8bit 后的值），复刻 NITIGraph
static void niti_on_twoimg(ImageEngine& eng, int tab, int threshold) {
    const auto& two = eng.twoimg_at(tab);
    std::vector<uint16_t> out(two.size());
    for (size_t i = 0; i < two.size(); i++) {
        uint8_t v = static_cast<uint8_t>(two[i]);
        out[i] = (v >= threshold) ? 0xff : 0;
    }
    eng.to_2byte_orver_write(tab, out);
}

// 在指定矩形区域内按测量方法计算（复刻 OLD MainRun.cpp ComputeSuppleResult）：
//   method 0 = Sum pixels：区域内 0(黑)/255(白) 像素计数
//   method 1 = width：黑/白像素的水平跨度（最左到最右列 +1）
//   method 2 = height：原版 TBD（空实现，返回 0）
//   method 3 = differenct neighbour：区域内水平+垂直相邻差分绝对值 > 阈值 累加（封顶 65535）
// OLD 中 method 0-2 传 threshold=0，仅 method 3 使用二值化滑条阈值；color 偏移 = color_point-150。
static std::pair<int, int> compute_supple_result(const std::vector<uint16_t>& img,
                                                 int x, int y, int w, int h,
                                                 int color_point, int method, int threshold) {
    int black = 0, white = 0;
    int offset = color_point - 150;
    auto clamp_color = [&](int v) {
        int c = v + offset;
        if (c > 255) c = 255;
        if (c < 0) c = 0;
        return c;
    };
    const int x1 = std::max(0, x);
    const int y1 = std::max(0, y);
    const int x2 = std::min(singan2::X_SIZE, x + w);
    const int y2 = std::min(singan2::Y_SIZE, y + h);
    auto in_region = [&](int i, int j) { return i >= y1 && i < y2 && j >= x1 && j < x2; };

    if (method == 0) {
        for (int i = y1; i < y2; i++) {
            for (int j = x1; j < x2; j++) {
                const int c = clamp_color(img[i * singan2::X_SIZE + j]);
                if (c == 0) black++;
                else if (c == 255) white++;
            }
        }
    } else if (method == 1) {
        // 水平跨度：从左/右扫描列，列内存在黑(0)像素即为黑边界，白(255)同理
        int blackLeft = -1, blackRight = -1, whiteLeft = -1, whiteRight = -1;
        for (int j = 0; j < singan2::X_SIZE && (blackLeft < 0 || whiteLeft < 0); j++) {
            for (int i = y1; i < y2; i++) {
                if (!in_region(i, j)) continue;
                const int c = clamp_color(img[i * singan2::X_SIZE + j]);
                if (c == 0 && blackLeft < 0) blackLeft = j;
                if (c == 255 && whiteLeft < 0) whiteLeft = j;
                if (blackLeft >= 0 && whiteLeft >= 0) break;
            }
        }
        for (int j = singan2::X_SIZE - 1; j >= 0 && (blackRight < 0 || whiteRight < 0); j--) {
            for (int i = y1; i < y2; i++) {
                if (!in_region(i, j)) continue;
                const int c = clamp_color(img[i * singan2::X_SIZE + j]);
                if (c == 0 && blackRight < 0) blackRight = j;
                if (c == 255 && whiteRight < 0) whiteRight = j;
                if (blackRight >= 0 && whiteRight >= 0) break;
            }
        }
        if (blackLeft >= 0 && blackRight >= 0) black = std::abs(blackRight - blackLeft) + 1;
        if (whiteLeft >= 0 && whiteRight >= 0) white = std::abs(whiteRight - whiteLeft) + 1;
    } else if (method == 3) {
        // 相邻差分（水平 + 垂直），超过阈值累加；OLD 原样：black = white = sum
        long sum = 0;
        for (int i = y1; i < y2; i++) {
            for (int j = x1; j < x2; j++) {
                if (j + 1 < std::min(singan2::X_SIZE, x + w)) {
                    const int c = std::abs(static_cast<int>(img[i * singan2::X_SIZE + j + 1]) -
                                           static_cast<int>(img[i * singan2::X_SIZE + j]));
                    if (c > threshold) sum += c;
                }
                if (i + 1 < std::min(singan2::Y_SIZE, y + h)) {
                    const int c = std::abs(static_cast<int>(img[(i + 1) * singan2::X_SIZE + j]) -
                                           static_cast<int>(img[i * singan2::X_SIZE + j]));
                    if (c > threshold) sum += c;
                }
            }
        }
        if (sum > 65535) sum = 65535;
        if (sum < 0) sum = 0;
        black = white = static_cast<int>(sum);
    }
    // method 2 / 4：原版 TBD（case 2 为空、case 4 无 case），black = white = 0
    return {black, white};
}

// 单 record 计算 Make Graph 像素数
static bool make_graph_record(const std::string& dat_path, int record,
                              const std::string& wtable_path, const std::string& wave_name,
                              const std::string& niti_type, int grad_type, int gain,
                              int threshold, int color_point,
                              int area_x, int area_y, int area_w, int area_h,
                              bool use_black, int result_method,
                              int& out_value, std::string& err) {
    ImageEngine eng;
    if (!build_engine(dat_path, record, wtable_path, eng, err)) return false;
    int tab = name_to_tab(wave_name);
    // 中间波段 Img7..Img15 需先计算
    if (tab >= 6 && tab <= 14) {
        try {
            eng.compute_intermediate_waves(128, 128);
        } catch (const std::exception& e) {
            err = std::string("中间波段计算失败: ") + e.what();
            return false;
        }
    }
    eng.tab_no = tab;
    if (niti_type == "Gra+Bin") {
        eng.gradient(grad_type, gain);
        niti_on_twoimg(eng, tab, threshold);
    } else if (niti_type == "Bin") {
        niti_on_twoimg(eng, tab, threshold);
    } else if (niti_type == "NiBlack") {
        eng.niblack(threshold);
    } else {
        err = "未知的 niti_type: " + niti_type;
        return false;
    }
    const auto& two = eng.twoimg_at(tab);
    // OLD 原样：method 0-2 不用阈值（传 0），仅 method 3 使用二值化阈值
    auto [black, white] = compute_supple_result(two, area_x, area_y, area_w, area_h,
                                                color_point, result_method,
                                                result_method == 3 ? threshold : 0);
    out_value = use_black ? black : white;
    return true;
}

// 单 record 快速路径：直接传入已提取的原始波段像素，避免 per-record 的
// extract_mm1_side + build_onebyte_images(13 波段) + to_2byte(22 图) 全量开销。
static bool make_graph_record_fast(const uint8_t* raw_wave,
                                   const std::string& wtable_path,
                                   const std::string& wave_name,
                                   const std::string& niti_type, int grad_type, int gain,
                                   int threshold, int color_point,
                                   int area_x, int area_y, int area_w, int area_h,
                                   bool use_black, int result_method,
                                   int& out_value, std::string& err) {
    ImageEngine eng;
    // 仅装入当前需要的单波段：oneimg 供 NiBlack，twoimg 供 Gra+Bin/Bin
    std::vector<uint8_t> one(raw_wave, raw_wave + singan2::ONESIZE);
    std::vector<uint16_t> two(one.begin(), one.end());
    eng.oneimg[wave_name] = std::move(one);
    eng.twoimg[wave_name] = std::move(two);
    eng.tab_no = name_to_tab(wave_name);
    eng.w_table = &get_wtable(wtable_path);
    if (niti_type == "Gra+Bin") {
        eng.gradient(grad_type, gain);
        niti_on_twoimg(eng, eng.tab_no, threshold);
    } else if (niti_type == "Bin") {
        niti_on_twoimg(eng, eng.tab_no, threshold);
    } else if (niti_type == "NiBlack") {
        eng.niblack(threshold);
    } else {
        err = "未知的 niti_type: " + niti_type;
        return false;
    }
    const auto& img = eng.twoimg_at(eng.tab_no);
    auto [black, white] = compute_supple_result(img, area_x, area_y, area_w, area_h,
                                                color_point, result_method,
                                                result_method == 3 ? threshold : 0);
    out_value = use_black ? black : white;
    return true;
}

// ---- 分析：运行算法并序列化 ----
static std::string run_and_serialize(const std::string& dat_path, int record,
                                     const std::string& zfile_path, int kin, int country) {
    std::vector<int> s2, etc;
    singan2::run_algorithm(dat_path, record, zfile_path, "" /*wtable 空=理论表*/, kin, country,
                           s2, etc);
    std::string body = "{\"s2\":";
    body += to_json_array(s2);
    body += ",\"etc\":";
    body += to_json_array(etc);
    body += "}";
    return body;
}

// ---- 预计算缓存：打开文件/首次分析即后台计算全部 record 的 S2/ETC ----
// 复刻 OLD MFC「整文件常驻内存 + 指针直取」：一次算完常驻，之后任意 record 的
// Statistics 直接命中缓存（秒回），避免上千 record 重复全量计算（Web Statistics 慢的根因之二）。
// 主流方案：服务端懒加载 + 后台预热（类似 OHIF/Napari 的整序列预载），命中后零计算。

// ---- 调试日志基础设施（必须在 PrecomputeCache 之前定义，供其记录带级别/模块的日志）----
static std::mutex g_dbg_mutex;  // 调试日志全局锁
// 当前线程 id 字符串（多线程死锁/竞态定位时区分不同 worker 线程）
static std::string tid() {
    std::ostringstream oss;
    oss << std::this_thread::get_id();
    return oss.str();
}
// 生成带毫秒的时间戳（格式：%Y-%m-%d %H:%M:%S.mmm），供 dbg/debug_log 复用，便于定位竞态时序。
static std::string dbg_time() {
    try {
        auto now = std::chrono::system_clock::now();
        std::time_t t = std::chrono::system_clock::to_time_t(now);
        auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()) % 1000;
        std::tm tm_buf{};
        localtime_s(&tm_buf, &t);
        char buf[32] = {0};
        std::strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &tm_buf);
        char out_buf[48] = {0};
        std::snprintf(out_buf, sizeof(out_buf), "%s.%03d", buf, (int)ms.count());
        return std::string(out_buf);
    } catch (...) {
        return "";
    }
}
// 带级别与模块的调试日志：level ∈ DEBUG/INFO/WARNING/ERROR，
// module 标识来源（analyze-batch / precache / graph-make / session / upload 等）。
static void dbg(const std::string& level, const std::string& module, const std::string& msg) {
    try {
        std::lock_guard<std::mutex> lk(g_dbg_mutex);
        std::ofstream out("singan2_debug.log", std::ios::app);
        if (!out) return;
        out << "[" << dbg_time() << "] " << level << " [" << module << "] " << msg << "\n";
        out.flush();
    } catch (...) {
        // 调试日志失败不影响主流程
    }
}

namespace {

struct PrecomputedRecord {
    std::vector<int> s2;
    std::vector<int> etc;
    bool computed = false;
};

struct PrecomputeEntry {
    std::recursive_mutex mu;  // 递归锁：消除同线程重复加锁抛 resource_deadlock 的隐患
    int record_count = 0;
    std::vector<PrecomputedRecord> recs;
    bool warming = false;        // 后台预热线程是否已在跑（防止重复启动）
    std::string dat_path, zfile_path;
    int kin = 1, country = 0;
};

std::map<std::string, std::shared_ptr<PrecomputeEntry>>& pc_map() {
    static std::map<std::string, std::shared_ptr<PrecomputeEntry>> m;
    return m;
}
std::recursive_mutex& pc_map_mu() {
    static std::recursive_mutex m;
    return m;
}
// key 含 dat_path/zfile_path/kin/country：四者任一变化都会得到独立缓存（保证结果正确）
std::string pc_key(const std::string& dat_path, const std::string& zfile_path, int kin, int country) {
    return dat_path + "|" + zfile_path + "|" + std::to_string(kin) + "|" + std::to_string(country);
}

// 懒创建 entry（解析 record_count 一次），并初始化 recs 容量
std::shared_ptr<PrecomputeEntry> pc_get_or_create(const std::string& dat_path,
                                                  const std::string& zfile_path,
                                                  int kin, int country, int record_count) {
    std::string key = pc_key(dat_path, zfile_path, kin, country);
    std::lock_guard<std::recursive_mutex> lk(pc_map_mu());
    auto& m = pc_map();
    auto it = m.find(key);
    if (it != m.end()) return it->second;
    auto e = std::make_shared<PrecomputeEntry>();
    e->dat_path = dat_path;
    e->zfile_path = zfile_path;
    e->kin = kin;
    e->country = country;
    e->record_count = record_count;
    e->recs.resize(record_count);
    m[key] = e;
    return e;
}

// 后台补全所有 record（跳过已算的），使后续任意 record 命中缓存
void pc_warm_async(std::shared_ptr<PrecomputeEntry> e) {
    {
        std::lock_guard<std::recursive_mutex> lk(e->mu);
        if (e->warming) {
            dbg("DEBUG", "precache", "后台补全已在运行 dat=" + e->dat_path + " 跳过重复启动 thread=" + tid());
            return;  // 已有预热线程在跑，避免重复启动
        }
        e->warming = true;
    }
    dbg("INFO", "precache", "启动后台补全 dat=" + e->dat_path
        + " record_count=" + std::to_string(e->record_count) + " thread=" + tid());
    auto tw0 = std::chrono::steady_clock::now();
    std::thread([e, tw0]() {
        const int rc = e->record_count;
        int done = 0;
        for (int r = 0; r < rc; ++r) {
            {
                std::lock_guard<std::recursive_mutex> lk(e->mu);
                if (e->recs[r].computed) continue;  // 已算则跳过
            }
            std::vector<int> s2, etc;
            try {
                singan2::run_algorithm(e->dat_path, r, e->zfile_path, "" /*wtable 空=理论表*/,
                                       e->kin, e->country, s2, etc);
            } catch (const std::exception& ex) {
                // 单 record 失败跳过，不阻断其余；记录以定位异常 record
                dbg("WARNING", "precache", "后台补全 record=" + std::to_string(r)
                    + " 异常=" + ex.what() + " thread=" + tid());
                continue;
            }
            std::lock_guard<std::recursive_mutex> lk(e->mu);
            e->recs[r].s2 = std::move(s2);
            e->recs[r].etc = std::move(etc);
            e->recs[r].computed = true;
            done++;
        }
        auto tw1 = std::chrono::steady_clock::now();
        long long wms = std::chrono::duration_cast<std::chrono::milliseconds>(tw1 - tw0).count();
        std::lock_guard<std::recursive_mutex> lk(e->mu);
        e->warming = false;
        dbg("INFO", "precache", "后台补全完成 dat=" + e->dat_path
            + " 新算=" + std::to_string(done) + " 总record=" + std::to_string(rc)
            + " 耗时=" + std::to_string(wms) + "ms");
    }).detach();
}

// 取单 record：命中缓存直接返回（hit=true）；未命中则同步计算并写缓存，同时触发后台补全其余
void pc_get_or_compute(const std::string& dat_path, const std::string& zfile_path,
                       int kin, int country, int record_count, int rec,
                       std::vector<int>& s2, std::vector<int>& etc, bool& hit) {
    auto e = pc_get_or_create(dat_path, zfile_path, kin, country, record_count);
    {
        std::lock_guard<std::recursive_mutex> lk(e->mu);
        if (rec >= 0 && rec < (int)e->recs.size() && e->recs[rec].computed) {
            s2 = e->recs[rec].s2;
            etc = e->recs[rec].etc;
            hit = true;
            dbg("DEBUG", "precache", "命中缓存 rec=" + std::to_string(rec) + " thread=" + tid());
            return;
        }
    }
    hit = false;
    dbg("DEBUG", "precache", "未命中 rec=" + std::to_string(rec) + " thread=" + tid() + " 开始 run_algorithm");
    auto t0 = std::chrono::steady_clock::now();
    try {
        // 未命中：同步计算（失败抛异常，由调用方记入 errs）；WTable 已在 core 内静态缓存
        singan2::run_algorithm(dat_path, rec, zfile_path, "" /*wtable 空=理论表*/,
                               kin, country, s2, etc);
    } catch (const std::exception& ex) {
        dbg("ERROR", "precache", "run_algorithm 异常 rec=" + std::to_string(rec)
            + " thread=" + tid() + " err=" + ex.what());
        throw;  // 交由 analyze-batch worker 记入 errs
    }
    auto t1 = std::chrono::steady_clock::now();
    long long ms = std::chrono::duration_cast<std::chrono::milliseconds>(t1 - t0).count();
    std::lock_guard<std::recursive_mutex> lk(e->mu);
    if (rec >= 0 && rec < (int)e->recs.size()) {
        e->recs[rec].s2 = s2;
        e->recs[rec].etc = etc;
        e->recs[rec].computed = true;
    }
    dbg("DEBUG", "precache", "已计算 rec=" + std::to_string(rec)
        + " 耗时=" + std::to_string(ms) + "ms thread=" + tid());
    pc_warm_async(e);  // 首次出现该 entry 即启动后台补全（首轮若已全算则线程立即退出）
}

}  // namespace

static int form_int(const httplib::MultipartFormData& form, const std::string& key, int def) {
    if (!form.has_field(key)) return def;
    try {
        return std::stoi(form.get_field(key));
    } catch (...) {
        return def;
    }
}

static std::string form_str(const httplib::MultipartFormData& form, const std::string& key,
                            const std::string& def) {
    if (!form.has_field(key)) return def;
    return form.get_field(key);
}

static void set_cors(httplib::Response& res) {
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type");
}

static const char* kJsonType = "application/json; charset=utf-8";

static void send_err(httplib::Response& res, int status, const std::string& msg) {
    set_cors(res);
    res.status = status;
    res.set_content(std::string("{\"error\":\"") + json_escape(msg) + "\"}", kJsonType);
}

static void send_ok(httplib::Response& res, const std::string& body) {
    set_cors(res);
    res.set_content(body, kJsonType);
}

// 调试日志：落盘到 CWD 下的 singan2_debug.log，便于开发跟踪（如 Statistics IR2 返回空时定位路径/后端问题）。
// 带时间戳，文件锁保证多线程安全；任意异常静默忽略，不影响主流程。
// （g_dbg_mutex 已提前到 PrecomputeCache 之前定义，供 dbg/tid 复用）
static void debug_log(const std::string& msg) {
    try {
        std::lock_guard<std::mutex> lk(g_dbg_mutex);
        std::ofstream out("singan2_debug.log", std::ios::app);
        if (!out) return;
        out << "[" << dbg_time() << "] " << msg << "\n";
        out.flush();
    } catch (...) {
        // 调试日志失败不影响主流程
    }
}

// ============ ATB（复刻 OLD WinMain.cpp LoadATB / SetDefaultATBList / LoadCTB）============
// 文件格式：普通 = 128 area × 512 条目 × 8B（无头）；SRU = 32B 头("SRU") + 256 area × 1024 条目 × 8B。
// 条目 8 字节 = [x, y, w, h, th1, th2, th3, th4]；条目序号 ii：方向 = ii%4(A/B/C/D)，note 号 = ii/4+1。
static const int ATB_AREAS = 128;         // 普通 ATB 区域数（OLD global_ATBS[128]）
static const int ATB_ENTRIES = 512;       // 普通 ATB 每 area 条目数
static const int ATB_SRU_AREAS = 256;     // SRU ATB 区域数
static const int ATB_SRU_ENTRIES = 1024;  // SRU ATB 每 area 条目数
static const int ATB_ENTRY_BYTES = 8;     // 每条目字节数
static const int ATB_SRU_HEADER = 32;     // SRU 文件头长度（OLD MAIN.H SRU_HEADER_SIZE）

static std::mutex g_atb_mutex;            // 保护下方 ATB 缓存状态
static std::vector<uint8_t> g_atb_table;  // 全部 area 的连续字节（areas*entries*8）
static std::vector<uint8_t> g_atb_header; // SRU 头原文（写回时原样保留）
static bool g_atb_sru = false;            // 是否 SRU 文件（OLD is_sru_ATB）
static std::string g_atb_path;            // 当前编辑文件路径（OLD global_ATB_edit_file）

// 区域名（复刻 OLD GetATBAreaName：%4X 为区域基址 0x4000 起）
static std::string atb_area_name(int no) {
    char buf[100];
    const int base = 0x4000;
    if (no == 1) snprintf(buf, sizeof(buf), "%4X WM1", base + no - 1);
    else if (no == 2) snprintf(buf, sizeof(buf), "%4X WM2", base + no - 1);
    else if (no == 3) snprintf(buf, sizeof(buf), "%4X Thread", base + no - 1);
    else if (no == 4) snprintf(buf, sizeof(buf), "%4X IR1", base + no - 1);
    else if (no == 5) snprintf(buf, sizeof(buf), "%4X IR2", base + no - 1);
    else if (no == 6) snprintf(buf, sizeof(buf), "%4X IR3", base + no - 1);
    else if (no == 7) snprintf(buf, sizeof(buf), "%4X Dirt", base + no - 1);
    else if (no == 8) snprintf(buf, sizeof(buf), "%4X Hologram", base + no - 1);
    else if (no == 9) snprintf(buf, sizeof(buf), "%4X WM(20x20)", base + no - 1);
    else if (no <= 19) snprintf(buf, sizeof(buf), "%4X ETC-%3d", base + no - 1, no - 9);
    else snprintf(buf, sizeof(buf), "%4X ETC-%3d Sup-%3d", base + no - 1, no - 9, no - 19);
    return buf;
}

// 列表行（复刻 OLD SetDefaultATBList 的格式串，前端与文件字节一一对应）
static std::string atb_line(int idx, const uint8_t* e) {
    static const char dir[5] = "ABCD";
    char buf[128];
    snprintf(buf, sizeof(buf), "%03d %03d%c: %03d,%03d,%03d,%03d,%03d,%03d,%03d,%03d",
             idx + 1, idx / 4 + 1, dir[idx % 4],
             e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7]);
    return buf;
}

// 从原始 JSON 数组文本解析 int（"bytes":[1,2,...]），容错空白
static std::vector<int> json_parse_int_array(const std::string& raw) {
    std::vector<int> out;
    std::string num;
    for (char c : raw) {
        if ((c >= '0' && c <= '9') || c == '-') num += c;
        else if (!num.empty()) { out.push_back(std::stoi(num)); num.clear(); }
    }
    if (!num.empty()) out.push_back(std::stoi(num));
    return out;
}

// 生成某个 area 的 lines + bytes JSON（调用方必须已持有 g_atb_mutex）
static std::string atb_area_json_locked(int area, int entries) {
    const uint8_t* base = g_atb_table.data() + (size_t)area * entries * ATB_ENTRY_BYTES;
    std::string lines = "[";
    std::string bytes = "[";
    for (int i = 0; i < entries; i++) {
        if (i) { lines += ","; bytes += ","; }
        lines += "\"" + json_escape(atb_line(i, base + (size_t)i * ATB_ENTRY_BYTES)) + "\"";
        for (int b = 0; b < ATB_ENTRY_BYTES; b++) {
            bytes += std::to_string(base[(size_t)i * ATB_ENTRY_BYTES + b]);
            if (b < ATB_ENTRY_BYTES - 1) bytes += ",";
        }
    }
    lines += "]";
    bytes += "]";
    return "{\"area\":" + std::to_string(area) +
           ",\"entries\":" + std::to_string(entries) +
           ",\"lines\":" + lines + ",\"bytes\":" + bytes + "}";
}

// POST /api/atb/load 响应体：读文件 + 缓存全表 + 返回 area 名单与 area#0 列表
static std::string atb_load_json(const std::string& path) {
    std::ifstream fp(path, std::ios::binary);
    if (!fp.is_open()) throw std::runtime_error("Load ATB failed! " + path);
    std::vector<uint8_t> raw((std::istreambuf_iterator<char>(fp)), std::istreambuf_iterator<char>());
    fp.close();
    if (raw.size() < 3) throw std::runtime_error("ATB 文件过小: " + path);

    const bool sru = raw[0] == 'S' && raw[1] == 'R' && raw[2] == 'U'; // OLD CFileAccess::IsSRUFile
    const size_t headerLen = sru ? (size_t)ATB_SRU_HEADER : 0;
    const size_t areas = sru ? ATB_SRU_AREAS : ATB_AREAS;
    const size_t entries = sru ? ATB_SRU_ENTRIES : ATB_ENTRIES;
    const size_t need = areas * entries * ATB_ENTRY_BYTES;
    if (raw.size() < headerLen + need) throw std::runtime_error("ATB 文件不完整: " + path);

    std::lock_guard<std::mutex> lk(g_atb_mutex);
    g_atb_sru = sru;
    g_atb_path = path;
    if (sru) g_atb_header.assign(raw.begin(), raw.begin() + headerLen);
    else g_atb_header.clear();
    g_atb_table.assign(raw.begin() + headerLen, raw.begin() + headerLen + need);

    // area 名单（OLD LoadATB 固定填 128 项，普通/SRU 通用）
    std::string names = "[";
    for (int i = 1; i <= ATB_AREAS; i++) {
        if (i > 1) names += ",";
        names += "\"" + json_escape(atb_area_name(i)) + "\"";
    }
    names += "]";
    std::string inner = atb_area_json_locked(0, (int)entries).substr(1); // 去掉开头 '{'
    return "{\"path\":\"" + json_escape(path) +
           "\",\"isSru\":" + (sru ? "true" : "false") +
           ",\"areaCount\":" + std::to_string(areas) +
           ",\"areaNames\":" + names + "," + inner;
}

// POST /api/atb/ctb 响应体（复刻 OLD LoadCTB 的解析）
static std::string atb_ctb_json(const std::string& path) {
    std::ifstream fp(path, std::ios::binary);
    if (!fp.is_open()) throw std::runtime_error("Load CTB failed! " + path);
    std::vector<uint8_t> raw((std::istreambuf_iterator<char>(fp)), std::istreambuf_iterator<char>());
    fp.close();
    const bool sru = raw.size() >= 3 && raw[0] == 'S' && raw[1] == 'R' && raw[2] == 'U';
    const size_t off = sru ? (size_t)ATB_SRU_HEADER : 0;
    // arrayOffsetCTB[256]：UINT32 × 256（小端）；denoNo = off[4] - off[3]
    if (off + 256 * 4 > raw.size()) throw std::runtime_error("CTB 文件不完整: " + path);
    auto u32 = [&](size_t i) {
        const size_t p = off + i * 4;
        return (uint32_t)raw[p] | ((uint32_t)raw[p + 1] << 8) |
               ((uint32_t)raw[p + 2] << 16) | ((uint32_t)raw[p + 3] << 24);
    };
    const uint32_t o3 = u32(3), o4 = u32(4);
    if (o4 < o3) throw std::runtime_error("CTB 偏移异常: " + path);
    uint32_t denoNo = o4 - o3;
    if (denoNo > 256) denoNo = 256; // OLD noteLengthCTB/noteHeightCTB 上限 256
    const size_t dataOff = off + 256 * 4 + (size_t)o3 * 2;
    if (dataOff + (size_t)denoNo * 4 > raw.size()) throw std::runtime_error("CTB 文件不完整: " + path);

    // 布局：heights[denoNo] 后跟 lengths[denoNo]（OLD 两次 fread 的顺序）
    std::string notes = "[";
    for (uint32_t i = 0; i < denoNo; i++) {
        const size_t p = dataOff + (size_t)i * 2;
        const uint16_t h = (uint16_t)(raw[p] | (raw[p + 1] << 8));
        const uint16_t w = (uint16_t)(raw[p + denoNo * 2] | (raw[p + denoNo * 2 + 1] << 8));
        if (i) notes += ",";
        char buf[64];
        snprintf(buf, sizeof(buf), "Note:%03d = %03d x %03d", i + 1, w, h); // OLD LoadCTB 格式
        notes += std::string("\"") + buf + "\"";
    }
    notes += "]";
    return "{\"path\":\"" + json_escape(path) + "\",\"notes\":" + notes + "}";
}

int main(int argc, char** argv) {
    int port = 8080;
    if (argc > 1) {
        try {
            port = std::stoi(argv[1]);
        } catch (...) {
            port = 8080;
        }
    }

    httplib::Server svr;

    svr.set_pre_routing_handler([](const httplib::Request& req, httplib::Response& res) {
        if (req.method == "OPTIONS") {
            set_cors(res);
            res.status = 204;
            return httplib::Server::HandlerResponse::Handled;
        }
        return httplib::Server::HandlerResponse::Unhandled;
    });

    svr.Get("/health", [](const httplib::Request&, httplib::Response& res) {
        send_ok(res, "{\"status\":\"ok\"}");
    });

    // 本地文件浏览：供前端「Load... / Load Size...」选择新文件（浏览器拿不到本地绝对路径，
    // 由 server 代为列目录，等价 OLD GetOpenFileName）。path 可为目录或文件（文件取其所在目录）。
    // GET /api/fs/list?path=<dir|file>&ext=.bin -> { path, parent, dirs[], files[] }
    svr.Get("/api/fs/list", [](const httplib::Request& req, httplib::Response& res) {
        set_cors(res);
        try {
            const std::string path = req.has_param("path") ? req.get_param_value("path") : "";
            std::string ext = req.has_param("ext") ? req.get_param_value("ext") : "";
            for (auto& c : ext) c = (char)::tolower((unsigned char)c); // 后缀过滤统一小写

            std::filesystem::path p = path.empty()
                ? std::filesystem::current_path()
                : std::filesystem::path(path);
            std::error_code ec;
            if (!std::filesystem::exists(p, ec)) {
                send_err(res, 404, "path 不存在: " + path);
                return;
            }
            if (std::filesystem::is_regular_file(p, ec)) p = p.parent_path();
            p = p.lexically_normal(); // 规范化 ".." 等相对段，保证返回路径可直接再导航

            std::string dirs = "[", files = "[";
            for (std::filesystem::directory_iterator it(p, ec), end; it != end; it.increment(ec)) {
                if (ec) break;
                const std::string name = it->path().filename().string();
                if (!name.empty() && name[0] == '.') continue; // 跳过隐藏项
                std::error_code ec2;
                if (it->is_directory(ec2)) {
                    if (dirs.size() > 1) dirs += ",";
                    dirs += "\"" + json_escape(name) + "\"";
                } else {
                    std::string low = name;
                    for (auto& c : low) c = (char)::tolower((unsigned char)c);
                    if (!ext.empty() &&
                        (low.size() < ext.size() ||
                         low.compare(low.size() - ext.size(), ext.size(), ext) != 0)) continue;
                    if (files.size() > 1) files += ",";
                    files += "\"" + json_escape(name) + "\"";
                }
            }
            dirs += "]";
            files += "]";
            send_ok(res, std::string("{\"path\":\"") + json_escape(p.string()) +
                     "\",\"parent\":\"" + json_escape(p.parent_path().string()) +
                     "\",\"dirs\":" + dirs + ",\"files\":" + files + "}");
        } catch (const std::exception& e) {
            send_err(res, 500, e.what());
        }
    });

    // 读取后端 C++ 调试日志（singan2_debug.log），供前端日志查看器预览。
    // 返回 { exists:bool, size:int, content:string(转义后) }，文件不存在时 exists=false。
    svr.Get("/api/debug-log", [](const httplib::Request&, httplib::Response& res) {
        set_cors(res);
        try {
            const std::string path = "singan2_debug.log";
            if (!std::filesystem::exists(path)) {
                res.set_content("{\"exists\":false,\"size\":0,\"content\":\"\"}", kJsonType);
                return;
            }
            std::ifstream in(path, std::ios::in | std::ios::binary);
            if (!in) {
                res.set_content("{\"exists\":false,\"size\":0,\"content\":\"\"}", kJsonType);
                return;
            }
            std::ostringstream ss;
            ss << in.rdbuf();
            const std::string content = ss.str();
            // 转义 JSON 特殊字符，避免换行/引号破坏响应结构
            std::string safe;
            safe.reserve(content.size() + 16);
            for (char c : content) {
                switch (c) {
                    case '"': safe += "\\\""; break;
                    case '\\': safe += "\\\\"; break;
                    case '\n': safe += "\\n"; break;
                    case '\r': safe += "\\r"; break;
                    case '\t': safe += "\\t"; break;
                    default: safe += c;
                }
            }
            std::ostringstream body;
            body << "{\"exists\":true,\"size\":" << content.size() << ",\"content\":\"" << safe << "\"}";
            res.set_content(body.str(), kJsonType);
        } catch (const std::exception& ex) {
            send_err(res, 500, std::string("read debug log failed: ") + ex.what());
        }
    });

    // ============ P0 基础数据链路 ============
    svr.Post("/api/session/open", [](const httplib::Request& req, httplib::Response& res) {
        std::string dat_path = json_get_str(req.body, "dat_path", "");
        if (dat_path.empty()) {
            send_err(res, 400, "dat_path 必填");
            return;
        }
        std::error_code ec;
        if (!fs::exists(dat_path, ec)) {
            send_err(res, 404, "数据文件不存在: " + dat_path);
            return;
        }
        auto blocks = singan2::parse_blocks(dat_path);
        int side_count = 0;
        for (const auto& b : blocks) {
            if (std::get<1>(b) == 5) side_count++;  // MM1_Side
        }
        int record_count = side_count / singan2::WAVE_COUNT;
        std::string body = "{\"dat_path\":\"" + json_escape(dat_path) + "\"";
        body += ",\"record_count\":" + std::to_string(record_count);
        body += ",\"wave_count\":13,\"waves\":[";
        for (int i = 0; i < 13; i++) {
            if (i) body += ",";
            body += "{\"index\":" + std::to_string(i) + ",\"name\":\"" + kWaveNames[i] + "\"}";
        }
        body += "]}";
        send_ok(res, body);
    });

    svr.Post("/api/image", [](const httplib::Request& req, httplib::Response& res) {
        std::string dat_path = json_get_str(req.body, "dat_path", "");
        if (dat_path.empty()) {
            send_err(res, 400, "dat_path 必填");
            return;
        }
        int record = json_get_int(req.body, "record", 0);
        std::string mode = json_get_str(req.body, "mode", "raw");  // raw | 2byte | intermediate
        std::string wtable_path = json_get_str(req.body, "wtable_path", "");
        int red_off = json_get_int(req.body, "red_offset", 128);
        int grn_off = json_get_int(req.body, "grn_offset", 128);
        std::string name = resolve_wave_name(req.body, "wave", 0);

        ImageEngine eng;
        std::string err;
        if (!build_engine(dat_path, record, wtable_path, eng, err)) {
            send_err(res, 400, err);
            return;
        }

        int mn = 0, mx = 0;
        std::string enc, data;
        if (mode == "intermediate") {
            try {
                eng.compute_intermediate_waves(red_off, grn_off);
            } catch (const std::exception& e) {
                send_err(res, 500, std::string("中间波段计算失败: ") + e.what());
                return;
            }
            const std::vector<uint8_t>* p = eng.oneimg_find(name);
            if (!p) {
                send_err(res, 400, "中间波段不存在(应为 Img7..Img15): " + name);
                return;
            }
            enc = "u8";
            data = encode_u8(*p, mn, mx);
        } else if (mode == "2byte") {
            const std::vector<uint16_t>* p = eng.twoimg_find(name);
            if (!p) {
                // 中间波段(Img7..Img15)需先算中间波才有 2byte 版（MFC global_twoimg 同语义）
                try { eng.compute_intermediate_waves(red_off, grn_off); } catch (...) {}
                p = eng.twoimg_find(name);
            }
            if (!p) {
                send_err(res, 400, "波段不存在: " + name);
                return;
            }
            enc = "u16le";
            data = encode_u16(*p, mn, mx);
        } else {
            const std::vector<uint8_t>* p = eng.oneimg_find(name);
            if (!p) {
                send_err(res, 400, "波段不存在: " + name);
                return;
            }
            enc = "u8";
            data = encode_u8(*p, mn, mx);
        }

        std::string body = "{\"record\":" + std::to_string(record);
        body += ",\"wave\":\"" + json_escape(name) + "\"";
        body += ",\"mode\":\"" + json_escape(mode) + "\"";
        body += ",\"width\":" + std::to_string(singan2::X_SIZE);
        body += ",\"height\":" + std::to_string(singan2::Y_SIZE);
        body += ",\"encoding\":\"" + enc + "\"";
        body += ",\"min\":" + std::to_string(mn);
        body += ",\"max\":" + std::to_string(mx);
        body += ",\"data\":\"" + data + "\"}";
        send_ok(res, body);
    });

    // DSP-ARM Function 页（Information Display 第 4 页，复刻 OLD JProc.cpp dsparm_set）：
    // 读函数名文件 GBVM_DSP_ARM.txt（每行一个函数名，空行也产生空名条目——忠实 OLD 解析），
    // 与小图像段组合输出。查找顺序：CWD → CWD\data。OLD 取 global_small_image[1580+j] 大端 u16；
    // 本工程 extract_small_image 已去 1024B 头，故对应 seg[1580-1024+j]。
    // 文件缺失时返回 found:false（等价 OLD "Cannot find Function Name File"）。
    svr.Post("/api/dsparm", [](const httplib::Request& req, httplib::Response& res) {
        const std::string dat_path = json_get_str(req.body, "dat_path", "");
        const int record = json_get_int(req.body, "record", 0);
        std::ifstream fp("GBVM_DSP_ARM.txt", std::ios::binary);
        if (!fp.is_open()) fp.open("data\\GBVM_DSP_ARM.txt", std::ios::binary);
        if (!fp.is_open()) {
            send_ok(res, "{\"found\":false,\"message\":\"Cannot find Function Name File (GBVM_DSP_ARM.txt)\"}");
            return;
        }
        std::vector<std::string> names;
        std::string line;
        while (std::getline(fp, line)) {
            while (!line.empty() && (line.back() == '\r' || line.back() == '\n')) line.pop_back();
            names.push_back(line); // 空行也保留（OLD 解析同样产生空名条目）
        }
        fp.close();

        std::vector<uint8_t> seg;
        if (!dat_path.empty()) seg = singan2::extract_small_image(dat_path, record);

        std::string items = "[";
        for (size_t j = 0; j < names.size(); j++) {
            const int no = 1580 + static_cast<int>(j);
            int val = 0;
            if ((int)seg.size() >= no - 1024 + 2 && no >= 1024) {
                const size_t off = (size_t)no - 1024;
                val = (seg[off] << 8) | seg[off + 1];
            }
            if (j) items += ",";
            char hex[8];
            snprintf(hex, sizeof(hex), "%4X", val);
            items += std::string("{\"no\":") + std::to_string(no) +
                     ",\"hex\":\"" + hex + "\",\"dec\":" + std::to_string(val) +
                     ",\"name\":\"" + json_escape(names[j]) + "\"}";
        }
        items += "]";
        send_ok(res, std::string("{\"found\":true,\"count\":") + std::to_string(names.size()) +
                     ",\"items\":" + items + "}");
    });

    svr.Post("/api/small-image", [](const httplib::Request& req, httplib::Response& res) {
        std::string dat_path = json_get_str(req.body, "dat_path", "");
        if (dat_path.empty()) {
            send_err(res, 400, "dat_path 必填");
            return;
        }
        int record = json_get_int(req.body, "record", 0);
        std::vector<uint8_t> seg = singan2::extract_small_image(dat_path, record);
        if (seg.empty()) {
            send_err(res, 400, "小图读取失败：record 越界");
            return;
        }
        int mn = 0, mx = 0;
        std::string data = encode_u8(seg, mn, mx);
        singan2::SmallImageValidation v = singan2::extract_small_image_validation(dat_path, record);
        std::string body = "{\"record\":" + std::to_string(record);
        body += ",\"size\":" + std::to_string(seg.size());
        body += ",\"min\":" + std::to_string(mn);
        body += ",\"max\":" + std::to_string(mx);
        body += ",\"data\":\"" + data + "\"";
        // P4 修正：Validation Result 字段来自小图像段(OLD/MainRun.cpp 第 833-843 行)，非 s2
        body += ",\"validation\":{\"han\":\"" + json_escape(v.han) + "\",\"kekka\":\"" +
                json_escape(v.kekka) + "\",\"le\":" + std::to_string(v.le) +
                ",\"se\":" + std::to_string(v.se) +
                ",\"ir_adictive\":" + std::to_string(v.ir_adictive) +
                ",\"g_adictive\":" + std::to_string(v.g_adictive) +
                ",\"binary_adictive\":" + std::to_string(v.binary_adictive) +
                ",\"speed\":" + std::to_string(v.speed) + "}";
        body += "}";
        send_ok(res, body);
    });

    // ============ 整通道批量下发（网页「秒载 1000 张」核心）============
    // OLD MFC 把整文件常驻内存，翻帧只是 fseek+memcpy（亚毫秒）；网页版若逐帧发 HTTP+base64
    // 则每帧一次往返。本端点一次返回某波段全部 record 的像素为二进制扁平缓冲
    // (record_count * ONESIZE 字节)，浏览器常驻为 Uint8Array 后翻帧只做内存切片，零网络、瞬时。
    // 现代图像序列/医学影像查看器（OHIF、Napari、视频帧播放器）均采用此「整序列预载」范式。
    svr.Post("/api/images/channel", [](const httplib::Request& req, httplib::Response& res) {
        std::string dat_path = json_get_str(req.body, "dat_path", "");
        std::string wave = json_get_str(req.body, "wave", "Img1");
        if (dat_path.empty()) {
            send_err(res, 400, "dat_path 必填");
            return;
        }
        std::vector<uint8_t> buf = singan2::extract_wave_all(dat_path, wave);
        fprintf(stderr, "[channel] extract_wave_all done: bytes=%zu\n", buf.size());
        if (buf.empty()) {
            send_err(res, 400, "波段不支持或文件损坏/越界: " + wave);
            return;
        }
        set_cors(res);
        res.set_header("X-Width", std::to_string(singan2::X_SIZE));
        res.set_header("X-Height", std::to_string(singan2::Y_SIZE));
        res.set_header("X-Record-Count",
                       std::to_string(static_cast<int>(buf.size()) / singan2::ONESIZE));
        res.set_header("X-Encoding", "u8");
        res.set_content(std::string(buf.begin(), buf.end()), "application/octet-stream");
    });

    // ============ 文件缓存管理（mariner_reader 进程级 LRU 缓存）============
    svr.Get("/api/cache/stats", [](const httplib::Request&, httplib::Response& res) {
        size_t cap = singan2::file_cache_capacity();
        std::string body = "{\"bytes\":" + std::to_string(singan2::file_cache_bytes());
        body += ",\"capacity\":" + std::to_string(cap);
        body += ",\"capacity_mb\":" + std::to_string(cap / (1024 * 1024));
        body += ",\"file_count\":" + std::to_string(singan2::file_cache_file_count()) + "}";
        send_ok(res, body);
    });

    svr.Post("/api/cache/clear", [](const httplib::Request&, httplib::Response& res) {
        size_t cleared = singan2::file_cache_bytes();
        singan2::file_cache_clear();
        send_ok(res, "{\"ok\":true,\"cleared_bytes\":" + std::to_string(cleared) + "}");
    });

    svr.Post("/api/cache/set-capacity", [](const httplib::Request& req, httplib::Response& res) {
        long long mb = json_get_int(req.body, "mb", 2048);
        if (mb < 1) mb = 1;
        singan2::file_cache_set_capacity(static_cast<size_t>(mb) * 1024 * 1024);
        send_ok(res, "{\"ok\":true,\"capacity_mb\":" + std::to_string(mb) + "}");
    });

    // ============ P1 分析链路 ============
    svr.Post("/api/analyze-path", [](const httplib::Request& req, httplib::Response& res) {
        std::string dat_path = json_get_str(req.body, "dat_path", "");
        std::string zfile_path = json_get_str(req.body, "zfile_path", "");
        int record = json_get_int(req.body, "record", 0);
        int kin = json_get_int(req.body, "kin", 1);
        int country = json_get_int(req.body, "country", 0);
        if (dat_path.empty() || zfile_path.empty()) {
            debug_log("[analyze-path] 400 dat_path=" + dat_path + " zfile_path=" + zfile_path + " reason=必填项为空");
            send_err(res, 400, "dat_path 与 zfile_path 均必填");
            return;
        }
        try {
            send_ok(res, run_and_serialize(dat_path, record, zfile_path, kin, country));
        } catch (const std::exception& e) {
            debug_log("[analyze-path] 异常 dat_path=" + dat_path + " zfile_path=" + zfile_path + " record=" + std::to_string(record) + " err=" + e.what());
            send_err(res, 500, e.what());
        }
    });

    // 批量分析：单文件多 record 一次请求返回，避免前端逐条发数百次 HTTP（Statistics 慢的根因）
    // 服务端按 start/step 展开取样序号，内部并行计算（每 record 的 ImageEngine/ALL32 均为局部状态，无数据竞争）
    svr.Post("/api/analyze-batch", [](const httplib::Request& req, httplib::Response& res) {
        std::string dat_path = json_get_str(req.body, "dat_path", "");
        std::string zfile_path = json_get_str(req.body, "zfile_path", "");
        int kin = json_get_int(req.body, "kin", 1);
        int country = json_get_int(req.body, "country", 0);
        int start = json_get_int(req.body, "start", 0);
        int step = json_get_int(req.body, "step", 1);
        if (step < 1) step = 1;
        int count = json_get_int(req.body, "count", 1);
        if (count < 1) count = 1;
        bool warm = json_get_bool(req.body, "warm", false);  // true=仅预热缓存，响应不含 results（省带宽）
        if (dat_path.empty() || zfile_path.empty()) {
            debug_log("[analyze-batch] 400 dat_path=" + dat_path + " zfile_path=" + zfile_path + " reason=必填项为空");
            send_err(res, 400, "dat_path 与 zfile_path 均必填");
            return;
        }
        try {
            auto t0 = std::chrono::steady_clock::now();
            auto blocks = singan2::parse_blocks(dat_path);
            int side_count = 0;
            for (const auto& b : blocks) if (std::get<1>(b) == 5) side_count++;  // MM1_Side
            int record_count = side_count / singan2::WAVE_COUNT;
            // 一次返回该文件在 start/step 下全部取样记录（对齐 MFC 一次性全量返回），
            // 仅受本文件 record 数约束；服务端多线程并行计算，避免逐条请求。
            int startVal = std::max(0, std::min(record_count - 1, start));
            int available = std::max(1, (int)(std::max(0, record_count - 1 - startVal) / step) + 1);
            int n = std::min(count, available);
            std::vector<std::vector<int>> s2s(n), etcs(n);
            std::vector<std::string> errs(n);

            // 后台预热(warm)只填充缓存、不返回 results，应主动让出 CPU 给前台
            // 交互(graph-make / Statistics)，故限制为较低线程数；前台请求(warm=false)
            // 用满核数以保证 Statistics 命中缓存后秒回。
            int nthreads = (int)std::thread::hardware_concurrency();
            if (nthreads < 1) nthreads = 1;
            if (warm) {
                int warm_threads = (nthreads + 1) / 3;  // 约 1/3 核，避免拖慢前台
                if (warm_threads < 2) warm_threads = 2;
                if (warm_threads > 6) warm_threads = 6;
                nthreads = warm_threads;
            }
            if (nthreads > n) nthreads = n;
            dbg("INFO", "analyze-batch", "进入 dat=" + dat_path + " zfile=" + zfile_path
                + " start=" + std::to_string(start) + " step=" + std::to_string(step)
                + " count=" + std::to_string(count) + " warm=" + (warm ? "1" : "0")
                + " record_count=" + std::to_string(record_count) + " 返回n=" + std::to_string(n)
                + " 线程数=" + std::to_string(nthreads));
            auto worker = [&](int lo, int hi) {
                for (int i = lo; i < hi; i++) {
                    int rec = std::max(0, std::min(record_count - 1, startVal + i * step));
                    bool hit = false;
                    try {
                        // 优先命中预计算缓存（秒回）；未命中则同步算并触发后台补全其余 record
                        pc_get_or_compute(dat_path, zfile_path, kin, country, record_count, rec,
                                          s2s[i], etcs[i], hit);
                    } catch (const std::exception& e) {
                        errs[i] = e.what();
                        dbg("ERROR", "analyze-batch", "rec=" + std::to_string(rec)
                            + " 异常=" + e.what() + " thread=" + tid());
                    }
                }
            };
            if (nthreads <= 1) {
                worker(0, n);
            } else {
                std::vector<std::thread> pool;
                int chunk = (n + nthreads - 1) / nthreads;
                for (int t = 0; t < nthreads; t++) {
                    int lo = t * chunk, hi = std::min(lo + chunk, n);
                    if (lo >= hi) break;
                    pool.emplace_back(worker, lo, hi);
                }
                for (auto& th : pool) th.join();
            }

            // 调试日志：记录单次批量分析的「请求/返回/有效/跳过」数量，便于定位 IR2 空白等问题
            {
                int valid = 0, skip = 0;
                std::vector<std::string> err_samples;
                for (const auto& e : errs) {
                    if (e.empty()) valid++;
                    else { skip++; if (err_samples.size() < 3) err_samples.push_back(e); }
                }
                std::string dbg_msg = "[analyze-batch] 请求 dat_path=" + dat_path
                                + " zfile_path=" + zfile_path
                                + " start=" + std::to_string(start)
                                + " step=" + std::to_string(step)
                                + " count(请求)=" + std::to_string(count)
                                + " | record_count=" + std::to_string(record_count)
                                + " available=" + std::to_string(available)
                                + " 返回 n=" + std::to_string(n)
                                + " 有效=" + std::to_string(valid)
                                + " 跳过=" + std::to_string(skip);
                if (!err_samples.empty()) {
                    dbg_msg += " 样例错误=";
                    for (size_t i = 0; i < err_samples.size(); ++i) {
                        if (i) dbg_msg += " | ";
                        dbg_msg += err_samples[i];
                    }
                }
                debug_log(dbg_msg);
                dbg(skip > 0 ? "WARNING" : "INFO", "analyze-batch", dbg_msg);
            }

            auto t1 = std::chrono::steady_clock::now();
            long long elapsed_ms = std::chrono::duration_cast<std::chrono::milliseconds>(t1 - t0).count();
            std::string body;
            if (warm) {
                // 仅预热：响应不含 results（避免上千 record 的大 JSON 回传，省带宽）
                body = "{\"warmed\":" + std::to_string(n)
                     + ",\"record_count\":" + std::to_string(record_count)
                     + ",\"elapsed_ms\":" + std::to_string(elapsed_ms) + "}";
            } else {
                body = "{\"count\":" + std::to_string(n)
                     + ",\"record_count\":" + std::to_string(record_count)
                     + ",\"elapsed_ms\":" + std::to_string(elapsed_ms) + ",\"results\":[";
                for (int i = 0; i < n; i++) {
                    if (i) body += ",";
                    int rec = std::max(0, std::min(record_count - 1, startVal + i * step));
                    if (!errs[i].empty()) {
                        body += "{\"record\":" + std::to_string(rec) + ",\"error\":" + json_escape(errs[i]) + "}";
                    } else {
                        body += "{\"record\":" + std::to_string(rec)
                             + ",\"s2\":" + to_json_array(s2s[i])
                             + ",\"etc\":" + to_json_array(etcs[i]) + "}";
                    }
                }
                body += "]}";
            }
            send_ok(res, body);
        } catch (const std::exception& e) {
            send_err(res, 500, e.what());
        }
    });

    svr.Post("/api/analyze", [](const httplib::Request& req, httplib::Response& res) {
        if (!req.form.has_file("dat")) {
            send_err(res, 400, "缺少上传文件字段 dat");
            return;
        }
        const auto& f = req.form.get_file("dat");
        int record = form_int(req.form, "record", 0);
        int kin = form_int(req.form, "kin", 1);
        int country = form_int(req.form, "country", 0);
        std::string zfile_path = form_str(req.form, "zfile_path", "");

        fs::path tmp = fs::temp_directory_path() /
                       ("singan2_upload_" + std::to_string(std::time(nullptr)) + "_" +
                        std::to_string(std::rand()) + ".dat");
        {
            std::ofstream out(tmp, std::ios::binary);
            out.write(f.content.data(), static_cast<std::streamsize>(f.content.size()));
        }
        try {
            std::string body = run_and_serialize(tmp.string(), record, zfile_path, kin, country);
            std::error_code ec;
            fs::remove(tmp, ec);
            send_ok(res, body);
        } catch (const std::exception& e) {
            std::error_code ec;
            fs::remove(tmp, ec);
            send_err(res, 500, e.what());
        }
    });

    // ============ P0b 文件上传（拖拽 / 文件选择）============
    // 复刻 OLD DropDlg 的“拖入 .dat 即加载”：把上传文件落到服务器侧 uploads/ 目录，
    // 保留不删除，返回路径供 /api/session/open 后续打开（与 /api/analyze 不同，后者用完即删）。
    // 流式上传：不再把整个请求体缓冲进内存，支持数十~数百 MB 的大 .dat 文件。
    // 前端以二进制 body 直接 POST（Content-Type: application/octet-stream），
    // 文件名通过查询参数 name（URL 编码）或请求头 X-File-Name 传递。
    // 同时兼容老的 multipart/form-data（dat/file 字段）上传方式。
    svr.Post("/api/upload",
             [](const httplib::Request& req, httplib::Response& res,
                const httplib::ContentReader& content_reader) {
                 // 解析目标文件名（去掉客户端路径，防止目录穿越）
                 std::string raw = req.get_param_value("name");
                 if (raw.empty()) raw = req.get_header_value("X-File-Name");
                 std::string name = raw.empty() ? "upload.dat" : url_decode(raw);
                 std::string base = name.substr(name.find_last_of("/\\") + 1);
                 if (base.empty()) base = "upload.dat";

                 std::error_code ec;
                 fs::path dir = fs::current_path() / "uploads";
                 fs::create_directories(dir, ec);
                 fs::path outp = dir / ("singan2_" + std::to_string(std::time(nullptr)) +
                                        "_" + std::to_string(std::rand()) + "_" + base);

                 std::ofstream out(outp, std::ios::binary);
                 if (!out) {
                     send_err(res, 500, "无法创建上传文件: " + outp.string());
                     return;
                 }

                 bool ok = false;
                 if (req.is_multipart_form_data()) {
                     ok = content_reader(
                         [&](const httplib::FormData& fd) {
                             if (!fd.filename.empty()) {
                                 std::string b =
                                     fd.filename.substr(fd.filename.find_last_of("/\\") + 1);
                                 if (!b.empty()) base = b;
                             }
                             return true;
                         },
                         [&](const char* data, size_t len) {
                             if (len > 0)
                                 out.write(data, static_cast<std::streamsize>(len));
                             return true;
                         });
                 } else {
                     ok = content_reader([&](const char* data, size_t len) {
                         if (len > 0) out.write(data, static_cast<std::streamsize>(len));
                         return true;
                     });
                 }
                 out.close();

                 if (!ok) {
                     send_err(res, 500, "上传写入中断或被客户端取消");
                     fs::remove(outp, ec);
                     return;
                 }

                 std::string body = "{\"ok\":true,\"path\":\"" + json_escape(outp.string()) +
                                    "\",\"name\":\"" + json_escape(base) + "\"}";
                 send_ok(res, body);
             });

    // ============ P2 图像处理 ============
    svr.Post("/api/imageops", [](const httplib::Request& req, httplib::Response& res) {
        std::string dat_path = json_get_str(req.body, "dat_path", "");
        if (dat_path.empty()) {
            send_err(res, 400, "dat_path 必填");
            return;
        }
        int record = json_get_int(req.body, "record", 0);
        std::string wtable_path = json_get_str(req.body, "wtable_path", "");
        std::string name = resolve_wave_name(req.body, "wave", 0);

        ImageEngine eng;
        std::string err;
        if (!build_engine(dat_path, record, wtable_path, eng, err)) {
            send_err(res, 400, err);
            return;
        }
        eng.tab_no = name_to_tab(name);

        std::string ops_raw = json_get_raw(req.body, "ops");
        std::vector<std::string> applied;
        for (const std::string& opobj : json_array_objects(ops_raw)) {
            std::string op = json_get_str(opobj, "op", "");
            try {
                if (op == "gradient") {
                    int gtype = json_get_int(opobj, "gtype", 0);
                    int amp = json_get_int(opobj, "amp", 1);
                    if (gtype == 3) {
                        eng.laplacian(amp);
                        applied.push_back("laplacian");
                    } else if (gtype == 4) {
                        eng.prewitt(amp);
                        applied.push_back("prewitt");
                    } else {
                        eng.gradient(gtype, amp);
                        applied.push_back("gradient");
                    }
                } else if (op == "niti") {
                    eng.niti(json_get_int(opobj, "s", 128));
                    applied.push_back("niti");
                } else if (op == "niblack") {
                    eng.niblack(json_get_int(opobj, "s", 15));
                    applied.push_back("niblack");
                } else if (op == "smooth") {
                    eng.smooth();
                    applied.push_back("smooth");
                } else if (op == "median") {
                    eng.median();
                    applied.push_back("median");
                } else if (op == "color") {
                    eng.color(json_get_int(opobj, "offset", 0));
                    applied.push_back("color");
                } else if (op == "intermediate") {
                    eng.compute_intermediate_waves(json_get_int(opobj, "red_offset", 128),
                                                   json_get_int(opobj, "grn_offset", 128));
                    applied.push_back("intermediate");
                } else if (op == "to2byte") {
                    eng.to_2byte();
                    applied.push_back("to2byte");
                }
            } catch (const std::exception& e) {
                send_err(res, 500, std::string("算子 ") + op + " 执行失败: " + e.what());
                return;
            }
        }

        // 处理结果存放于 twoimg[tab]
        const std::vector<uint16_t>* p = eng.twoimg_find(name);
        if (!p) {
            send_err(res, 400, "波段不存在: " + name);
            return;
        }
        int mn = 0, mx = 0;
        std::string data = encode_u16(*p, mn, mx);
        std::string body = "{\"record\":" + std::to_string(record);
        body += ",\"wave\":\"" + json_escape(name) + "\"";
        body += ",\"ops\":[";
        for (size_t i = 0; i < applied.size(); i++) {
            if (i) body += ",";
            body += "\"" + json_escape(applied[i]) + "\"";
        }
        body += "],\"width\":" + std::to_string(singan2::X_SIZE);
        body += ",\"height\":" + std::to_string(singan2::Y_SIZE);
        body += ",\"encoding\":\"u16le\"";
        body += ",\"min\":" + std::to_string(mn);
        body += ",\"max\":" + std::to_string(mx);
        body += ",\"data\":\"" + data + "\"}";
        send_ok(res, body);
    });

    // ============ P3 Graph ============
    // 复刻 OLD Ren.cpp S2_gr + OnDrawGraph.cpp CGR_CLASS：
    // 批量分析多个 record，每个 record 返回 S2[1..32]+etc[1..12]（共 44 列）。
    // 前端用函数列号（global_select_no）取某一列画"函数值×record序号"曲线，并输出 txt 列表。
    svr.Post("/api/graph/make", [](const httplib::Request& req, httplib::Response& res) {
        std::string dat_path = json_get_str(req.body, "dat_path", "");
        if (dat_path.empty()) {
            send_err(res, 400, "dat_path 必填");
            return;
        }
        std::string zfile_path = json_get_str(req.body, "zfile_path", "");
        int kin = json_get_int(req.body, "kin", 1);
        int country = json_get_int(req.body, "country", 0);
        int max_records = json_get_int(req.body, "max_records", 16);
        if (max_records < 1) max_records = 1;
        if (max_records > 8192) max_records = 8192;
        int start_record = json_get_int(req.body, "start_record", 0);
        if (start_record < 0) start_record = 0;
        int step = json_get_int(req.body, "step", 1);
        if (step < 1) step = 1;

        std::error_code ec;
        if (!fs::exists(dat_path, ec)) {
            send_err(res, 404, "数据文件不存在: " + dat_path);
            return;
        }
        auto blocks = singan2::parse_blocks(dat_path);
        int side_count = 0;
        for (const auto& b : blocks) {
            if (std::get<1>(b) == 5) side_count++;  // MM1_Side
        }
        int record_count = side_count / singan2::WAVE_COUNT;
        if (start_record >= record_count) start_record = 0;

        // Make Graph 真实语义：CreateGraph1 + ComputeSuppleResult，返回每 record 的像素数
        std::string wtable_path = json_get_str(req.body, "wtable_path", "");
        std::string wave_name = resolve_wave_name(req.body, "wave", 0);
        std::string niti_type = json_get_str(req.body, "niti_type", "Gra+Bin");
        int grad_type = json_get_int(req.body, "grad_type", 0);
        int gain = json_get_int(req.body, "gain", 1);
        int threshold = json_get_int(req.body, "threshold", 90);
        int color_point = json_get_int(req.body, "color_point", 150);
        int area_x = json_get_int(req.body, "area_x", 0);
        int area_y = json_get_int(req.body, "area_y", 0);
        int area_w = json_get_int(req.body, "area_w", 20);
        int area_h = json_get_int(req.body, "area_h", 20);
        bool use_black = json_get_bool(req.body, "black", true);
        // 测量方法（OLD IDC_LIST_GRAPH_FUNS）：0=Sum pixels 1=width 2=height(TBD) 3=differenct neighbour 4=(TBD)
        int result_method = json_get_int(req.body, "result_method", 0);
        if (result_method < 0 || result_method > 4) result_method = 0;

        // 先按 start/step/max_records 展开本次要处理的 record 序号（越界即止）
        std::vector<int> recs;
        recs.reserve(max_records);
        for (int r = 0; r < max_records; r++) {
            int rec = start_record + r * step;
            if (rec >= record_count) break;
            recs.push_back(rec);
        }
        int m = (int)recs.size();
        std::vector<int>  values(m, 0);
        std::vector<char> ok(m, 0);

        // 并行化：原始波段走单波次全 record 提取（一次 memcpy 大局，避免 per-record 的
        // extract_mm1_side + build_onebyte_images 全 13 波段开销）；中间波段保持原逐 record 路径。
        int nthreads = (int)std::thread::hardware_concurrency();
        if (nthreads < 1) nthreads = 1;
        if (nthreads > m) nthreads = m;
        bool use_fast_path = is_raw_wave_name(wave_name);
        std::vector<uint8_t> flat;
        if (use_fast_path) {
            flat = singan2::extract_wave_all(dat_path, wave_name);
            if (flat.empty()) {
                send_err(res, 500, "批量提取波段失败: " + wave_name);
                return;
            }
        }
        auto t0 = std::chrono::steady_clock::now();
        dbg("INFO", "graph-make", "进入 dat=" + dat_path + " wave=" + wave_name + " max_records=" + std::to_string(max_records)
            + " start=" + std::to_string(start_record) + " step=" + std::to_string(step) + " record_count=" + std::to_string(record_count)
            + " 线程数=" + std::to_string(nthreads) + " fast_path=" + (use_fast_path ? "1" : "0"));
        auto worker = [&](int lo, int hi) {
            for (int i = lo; i < hi; i++) {
                std::string err;
                int v = 0;
                bool ok_i = false;
                if (use_fast_path) {
                    const uint8_t* ptr = flat.data() + static_cast<size_t>(recs[i]) * singan2::ONESIZE;
                    ok_i = make_graph_record_fast(ptr, wtable_path, wave_name, niti_type,
                                                  grad_type, gain, threshold, color_point,
                                                  area_x, area_y, area_w, area_h, use_black,
                                                  result_method, v, err);
                } else {
                    ok_i = make_graph_record(dat_path, recs[i], wtable_path, wave_name, niti_type,
                                             grad_type, gain, threshold, color_point,
                                             area_x, area_y, area_w, area_h, use_black,
                                             result_method, v, err);
                }
                if (ok_i) {
                    values[i] = v; ok[i] = 1;
                } else {
                    dbg("WARNING", "graph-make", "record=" + std::to_string(recs[i])
                        + " 失败=" + err + " thread=" + tid());
                }
            }
        };
        if (nthreads <= 1) {
            worker(0, m);
        } else {
            std::vector<std::thread> pool;
            int chunk = (m + nthreads - 1) / nthreads;
            for (int t = 0; t < nthreads; t++) {
                int lo = t * chunk;
                int hi = std::min(lo + chunk, m);
                if (lo >= hi) break;
                pool.emplace_back(worker, lo, hi);
            }
            for (auto& th : pool) th.join();
        }
        auto t1 = std::chrono::steady_clock::now();
        double elapsed = std::chrono::duration<double, std::milli>(t1 - t0).count();
        dbg("INFO", "graph-make", "计算耗时 elapsed_ms=" + std::to_string(elapsed)
            + " records=" + std::to_string(m) + " ms/record=" + std::to_string(elapsed / std::max(1, m)));

        // 组装 rows（失败记录跳过，record 号保持原值，与旧逻辑一致）
        std::string rows_json = "[";
        bool first = true;
        for (int i = 0; i < m; i++) {
            if (!ok[i]) continue;
            if (!first) rows_json += ",";
            first = false;
            rows_json += "{\"record\":" + std::to_string(recs[i]);
            rows_json += ",\"value\":" + std::to_string(values[i]) + "}";
        }
        rows_json += "]";

        std::string body = "{\"record_count\":" + std::to_string(record_count);
        body += ",\"note\":\"[复刻 OLD CreateGraph1/ComputeSuppleResult] 跨 record 像素统计：每行 = 一个 record 在选区内的黑/白像素数\"";
        body += ",\"wave\":\"" + json_escape(wave_name) + "\"";
        body += ",\"threshold\":" + std::to_string(threshold);
        body += ",\"black\":" + std::string(use_black ? "true" : "false");
        body += ",\"rows\":" + rows_json;
        body += "}";
        dbg("INFO", "graph-make", "完成 dat=" + dat_path + " wave=" + wave_name + " 返回行数=" + std::to_string(m));
        send_ok(res, body);
    });

    svr.Post("/api/graph/combine", [](const httplib::Request& req, httplib::Response& res) {
        // a/b 为数值数组；mode: diff(默认) | max | min | avg
        std::string mode = json_get_str(req.body, "mode", "diff");
        auto to_vec = [](const std::string& raw) {
            std::vector<double> v;
            size_t i = 0;
            while (i < raw.size()) {
                while (i < raw.size() && !std::isdigit(static_cast<unsigned char>(raw[i])) &&
                       raw[i] != '-' && raw[i] != '.' && raw[i] != '+')
                    i++;
                size_t s = i;
                while (i < raw.size() &&
                       (std::isdigit(static_cast<unsigned char>(raw[i])) || raw[i] == '.' ||
                        raw[i] == '-' || raw[i] == '+' || raw[i] == 'e' || raw[i] == 'E'))
                    i++;
                if (i > s) {
                    try { v.push_back(std::stod(raw.substr(s, i - s))); } catch (...) {}
                } else {
                    break;
                }
            }
            return v;
        };
        std::vector<double> a = to_vec(json_get_raw(req.body, "a"));
        std::vector<double> b = to_vec(json_get_raw(req.body, "b"));
        size_t n = std::min(a.size(), b.size());
        std::vector<double> out(n);
        for (size_t i = 0; i < n; i++) {
            if (mode == "max") out[i] = std::max(a[i], b[i]);
            else if (mode == "min") out[i] = std::min(a[i], b[i]);
            else if (mode == "avg") out[i] = (a[i] + b[i]) / 2.0;
            else out[i] = a[i] - b[i];
        }
        std::string body = "{\"mode\":\"" + json_escape(mode) + "\"";
        body += ",\"count\":" + std::to_string(n);
        body += ",\"series\":" + to_json_array(out, 4) + "}";
        send_ok(res, body);
    });

    // .grp 以 JSON 文本存取（原版二进制格式未移植）
    svr.Post("/api/graph/save", [](const httplib::Request& req, httplib::Response& res) {
        std::string path = json_get_str(req.body, "path", "");
        if (path.empty()) {
            send_err(res, 400, "path 必填");
            return;
        }
        std::string series = json_get_raw(req.body, "series");
        if (series.empty()) series = "[]";
        std::ofstream out(path, std::ios::binary);
        if (!out) {
            send_err(res, 500, "无法写入: " + path);
            return;
        }
        out << series;
        out.close();
        send_ok(res, std::string("{\"ok\":true,\"path\":\"") + json_escape(path) +
                         "\",\"note\":\"[需补移植] 采用 JSON 文本，原版 .grp 二进制格式未移植\"}");
    });

    svr.Post("/api/graph/load", [](const httplib::Request& req, httplib::Response& res) {
        std::string path = json_get_str(req.body, "path", "");
        if (path.empty()) {
            send_err(res, 400, "path 必填");
            return;
        }
        std::ifstream in(path, std::ios::binary);
        if (!in) {
            send_err(res, 404, "文件不存在: " + path);
            return;
        }
        std::ostringstream ss;
        ss << in.rdbuf();
        send_ok(res, std::string("{\"path\":\"") + json_escape(path) + "\",\"series\":" + ss.str() + "}");
    });

    // ---- .GPH 原版二进制格式存取（复刻 OLD IDC_BUTTON_SAVE_GRAPH / DisplayGraphs）----
    // 布局：USHORT head[100]（[0]=tabNo [1]=startX [2]=startY [3]=rangeX [4]=rangeY [5]=s
    //       [6]=count1 [7]=count2 [8]=drawBlack，其余 0）+ series1[MAX_DATA] + series2[MAX_DATA]。
    // MAX_DATA = 2300（OLD MAIN.H），文件总长 = 200 + 2*2300*2 = 9400 字节。
    static const int GPH_MAX_DATA = 2300;
    svr.Post("/api/graph/gph-save", [](const httplib::Request& req, httplib::Response& res) {
        std::string path = json_get_str(req.body, "path", "");
        if (path.empty()) {
            send_err(res, 400, "path 必填");
            return;
        }
        try {
            std::vector<int> s1 = json_parse_int_array(json_get_raw(req.body, "series1"));
            std::vector<int> s2 = json_parse_int_array(json_get_raw(req.body, "series2"));
            if ((int)s1.size() > GPH_MAX_DATA || (int)s2.size() > GPH_MAX_DATA) {
                send_err(res, 400, "series 超过 MAX_DATA=2300");
                return;
            }
            uint16_t head[100] = {0};
            head[0] = (uint16_t)json_get_int(req.body, "tab_no", 0);
            head[1] = (uint16_t)json_get_int(req.body, "start_x", 0);
            head[2] = (uint16_t)json_get_int(req.body, "start_y", 0);
            head[3] = (uint16_t)json_get_int(req.body, "range_x", 0);
            head[4] = (uint16_t)json_get_int(req.body, "range_y", 0);
            head[5] = (uint16_t)json_get_int(req.body, "s", 0);
            head[6] = (uint16_t)s1.size();
            head[7] = (uint16_t)s2.size();
            head[8] = json_get_bool(req.body, "black", true) ? 1 : 0;

            std::ofstream out(path, std::ios::binary | std::ios::trunc);
            if (!out.is_open()) {
                send_err(res, 500, "无法写入: " + path);
                return;
            }
            out.write(reinterpret_cast<const char*>(head), sizeof(head));
            for (int i = 0; i < GPH_MAX_DATA; i++) {
                uint16_t v = (i < (int)s1.size()) ? (uint16_t)s1[i] : 0;
                out.write(reinterpret_cast<const char*>(&v), sizeof(v));
            }
            for (int i = 0; i < GPH_MAX_DATA; i++) {
                uint16_t v = (i < (int)s2.size()) ? (uint16_t)s2[i] : 0;
                out.write(reinterpret_cast<const char*>(&v), sizeof(v));
            }
            out.close();
            send_ok(res, std::string("{\"ok\":true,\"path\":\"") + json_escape(path) +
                     "\",\"count1\":" + std::to_string(s1.size()) +
                     ",\"count2\":" + std::to_string(s2.size()) + "}");
        } catch (const std::exception& e) {
            send_err(res, 500, e.what());
        }
    });

    svr.Post("/api/graph/gph-load", [](const httplib::Request& req, httplib::Response& res) {
        std::string path = json_get_str(req.body, "path", "");
        if (path.empty()) {
            send_err(res, 400, "path 必填");
            return;
        }
        std::ifstream in(path, std::ios::binary);
        if (!in) {
            send_err(res, 404, "文件不存在: " + path);
            return;
        }
        uint16_t head[100];
        in.read(reinterpret_cast<char*>(head), sizeof(head));
        if (!in) {
            send_err(res, 500, "GPH 文件不完整（头不足 200 字节）: " + path);
            return;
        }
        std::vector<uint16_t> s1(GPH_MAX_DATA), s2(GPH_MAX_DATA);
        in.read(reinterpret_cast<char*>(s1.data()), s1.size() * sizeof(uint16_t));
        in.read(reinterpret_cast<char*>(s2.data()), s2.size() * sizeof(uint16_t));
        in.close();
        const int count1 = std::min<int>(head[6], GPH_MAX_DATA);
        const int count2 = std::min<int>(head[7], GPH_MAX_DATA);
        std::string j1 = "[", j2 = "[";
        for (int i = 0; i < count1; i++) { if (i) j1 += ","; j1 += std::to_string(s1[i]); }
        for (int i = 0; i < count2; i++) { if (i) j2 += ","; j2 += std::to_string(s2[i]); }
        j1 += "]"; j2 += "]";
        send_ok(res, std::string("{\"path\":\"") + json_escape(path) +
                 "\",\"head\":{\"tabNo\":" + std::to_string(head[0]) +
                 ",\"startX\":" + std::to_string(head[1]) +
                 ",\"startY\":" + std::to_string(head[2]) +
                 ",\"rangeX\":" + std::to_string(head[3]) +
                 ",\"rangeY\":" + std::to_string(head[4]) +
                 ",\"s\":" + std::to_string(head[5]) +
                 ",\"black\":" + (head[8] ? "true" : "false") + "}" +
                 ",\"series1\":" + j1 + ",\"series2\":" + j2 + "}");
    });

    // ============ Ren SM_dsp.dat 落盘（复刻 OLD Ren.cpp Ren/ComboRen + DspOverWrite）============
    // OLD 语义：每处理一张券，把含头 small 段(8192B)整行复制进 s_img_stock，再按 Setting Dialogue
    // 勾选覆盖结果列（S2/DEN/Dart 均先做上下位字节反转=大端落盘，Ren.cpp :82-96），最后追加写文件。
    // Web 简化：一次批量算完 start_record 起 count 张（count<=0=到文件尾），一次性追加写入。
    // 行布局（相对含头 small 段，Ren.cpp :141-144 / :112-133 / :100-106）：
    //   [2096]=Dart1(etc[10])  [2098]=Dart2(etc[11])
    //   [2184+2(i-12)] i=12..31 与 [2144+2(i-32)] i=32..51 = DEN12..51（"DEN 12-31"勾选同覆盖两段）
    //   [2224+2(i-1)]  i=1..11  = DEN1..11
    //   [2352+2(i-1)]  i=1..32  = S2[1..32]（Overwrite S1..S32 逐列勾选）
    // 注意：DEN 值 OLD 由各国算法(Russia/HongKong 等)写 global_DEN，Web 尚未移植 → 勾选位置写 0。
    // 写盘时机（OLD）：Ren 循环内 !GR[0]&&!GR[1] 才写（Create1/2 勾选时改存图表数据、不写文件，
    // 即 Setting Dialogue 两条日文注释的语义）；前端在 Statistics(Calculate all) 完成后按此条件调用。
    svr.Post("/api/ren/sm-dsp", [](const httplib::Request& req, httplib::Response& res) {
        std::string dat_path = json_get_str(req.body, "dat_path", "");
        std::string zfile_path = json_get_str(req.body, "zfile_path", "");
        int kin = json_get_int(req.body, "kin", 1);
        int country = json_get_int(req.body, "country", 0);
        int start_record = json_get_int(req.body, "start_record", 0);
        int count = json_get_int(req.body, "count", 0);   // <=0 = 到文件尾
        std::string out_path = json_get_str(req.body, "out_path", "");
        if (dat_path.empty() || zfile_path.empty()) {
            send_err(res, 400, "dat_path 与 zfile_path 均必填");
            return;
        }
        try {
            // 勾选状态（缺省全 1，与 OLD WinMain 初始化一致）
            std::vector<int> ov = json_parse_int_array(json_get_raw(req.body, "overwrite"));
            std::vector<int> den11 = json_parse_int_array(json_get_raw(req.body, "den1to11"));
            const bool denRest = json_get_bool(req.body, "den12to31", true);
            const bool dart1 = json_get_bool(req.body, "dart1", true);
            const bool dart2 = json_get_bool(req.body, "dart2", true);
            bool ovArr[33] = { false };
            for (int i = 1; i <= 32; i++) ovArr[i] = ((int)ov.size() == 32) ? (ov[i - 1] != 0) : true;
            bool denArr[52] = { false };
            for (int i = 1; i <= 11; i++) denArr[i] = ((int)den11.size() == 11) ? (den11[i - 1] != 0) : true;
            for (int i = 12; i < 52; i++) denArr[i] = denRest;

            auto blocks = singan2::parse_blocks(dat_path);
            int side_count = 0;
            for (const auto& b : blocks) if (std::get<1>(b) == 5) side_count++;  // MM1_Side
            const int record_count = side_count / singan2::WAVE_COUNT;
            if (start_record < 0) start_record = 0;
            if (start_record >= record_count) {
                send_err(res, 400, "start_record 越界: record_count=" + std::to_string(record_count));
                return;
            }
            const int n = count > 0 ? std::min(count, record_count - start_record)
                                    : record_count - start_record;

            // 输出文件：数据文件名扩展名替换为 SM_dsp.dat（OLD DspOverWrite :41-45）
            if (out_path.empty()) {
                std::filesystem::path p(dat_path);
                out_path = (p.parent_path() / (p.stem().string() + "SM_dsp.dat")).string();
            }

            const size_t ROW = 8192;  // SMALL_SIZE
            std::vector<uint8_t> blob;
            blob.reserve((size_t)n * ROW);
            std::vector<int> fails;
            std::vector<int> den(52, 0);  // DEN 全局累积（OLD：Ren 循环内跨 record 保留，Russia 等有 +=）
            auto t0 = std::chrono::steady_clock::now();
            for (int k = 0; k < n; k++) {
                const int rec = start_record + k;
                std::vector<uint8_t> row = singan2::extract_small_image(dat_path, rec);
                if (row.empty()) {
                    fails.push_back(rec);
                    row.assign(ROW, 0);
                }
                std::vector<int> s2, etc;
                try {
                    singan2::run_algorithm(dat_path, rec, zfile_path, "", kin, country, s2, etc, &den);
                } catch (const std::exception& e) {
                    dbg("WARNING", "ren-sm-dsp", "rec=" + std::to_string(rec)
                        + " 分析失败=" + e.what() + " 该行结果列写 0");
                    if (fails.empty() || fails.back() != rec) fails.push_back(rec);
                    s2.assign(33, 0);
                    etc.assign(15, 0);
                }
                // OLD Ren.cpp :82-96 上下位字节反转后小端 memcpy ≡ 原始值大端落盘
                auto put_u16 = [&](size_t off, int v) {
                    const uint16_t x = (uint16_t)(v & 0xFFFF);
                    row[off] = (uint8_t)(x >> 8);
                    row[off + 1] = (uint8_t)(x & 0xFF);
                };
                if (dart1 && (int)etc.size() > 10) put_u16(2096, etc[10]);
                if (dart2 && (int)etc.size() > 11) put_u16(2098, etc[11]);
                for (int i = 12; i < 32; i++) if (denArr[i] && (int)den.size() > i) put_u16(2184 + 2 * (i - 12), den[i]);
                for (int i = 32; i < 52; i++) if (denArr[i] && (int)den.size() > i) put_u16(2144 + 2 * (i - 32), den[i]);
                for (int i = 1; i <= 11; i++) if (denArr[i] && (int)den.size() > i) put_u16(2224 + 2 * (i - 1), den[i]);
                for (int i = 1; i <= 32; i++) if (ovArr[i] && (int)s2.size() > i) put_u16(2352 + 2 * (i - 1), s2[i]);
                blob.insert(blob.end(), row.begin(), row.end());
            }
            auto t1 = std::chrono::steady_clock::now();
            double elapsed = std::chrono::duration<double, std::milli>(t1 - t0).count();
            dbg("INFO", "ren-sm-dsp", "写入 records=" + std::to_string(n)
                + " out=" + out_path + " 失败=" + std::to_string(fails.size())
                + " elapsed_ms=" + std::to_string(elapsed));

            // 追加写（OLD DspOverWrite：读旧文件 + 拼接 + 写回）
            std::vector<uint8_t> old;
            {
                std::ifstream in(out_path, std::ios::binary);
                if (in) old.assign(std::istreambuf_iterator<char>(in), std::istreambuf_iterator<char>());
            }
            std::ofstream out(out_path, std::ios::binary | std::ios::trunc);
            if (!out.is_open()) {
                send_err(res, 500, "无法写入: " + out_path);
                return;
            }
            if (!old.empty()) out.write(reinterpret_cast<const char*>(old.data()), (std::streamsize)old.size());
            out.write(reinterpret_cast<const char*>(blob.data()), (std::streamsize)blob.size());
            out.close();

            std::string fj = "[";
            for (size_t i = 0; i < fails.size(); i++) { if (i) fj += ","; fj += std::to_string(fails[i]); }
            fj += "]";
            send_ok(res, "{\"written\":true,\"out_path\":\"" + json_escape(out_path) +
                    "\",\"records\":" + std::to_string(n) +
                    ",\"appended_bytes\":" + std::to_string(blob.size()) +
                    ",\"existing_bytes\":" + std::to_string(old.size()) +
                    ",\"failed_records\":" + fj + "}");
        } catch (const std::exception& e) {
            send_err(res, 500, e.what());
        }
    });

    // ============ P4 ATB / VTB / 坐标 ============
    svr.Post("/api/zfile/parse", [](const httplib::Request& req, httplib::Response& res) {
        std::string path = json_get_str(req.body, "path", "");
        if (path.empty()) {
            send_err(res, 400, "path 必填");
            return;
        }
        try {
            auto areas = singan2::parse_zfile(path, json_get_str(req.body, "encoding", "shift_jis"));
            // Setting Dialogue checkZ 闭环：25 功能段（已按 checkZ 显示序排列，
            // 下标 i 与 settings.checkZ[i] 一一对应），复刻 ZAHYO_READ.CPP + ELIA.cpp draw_e
            auto funcs = singan2::parse_zfile_funcs(path);
            std::string body = "{\"path\":\"" + json_escape(path) + "\"";
            body += ",\"count\":" + std::to_string(areas.size()) + ",\"areas\":[";
            for (size_t i = 0; i < areas.size(); i++) {
                const auto& a = areas[i];
                if (i) body += ",";
                body += "{\"x1\":" + std::to_string(a.x1) + ",\"y1\":" + std::to_string(a.y1) +
                        ",\"x2\":" + std::to_string(a.x2) + ",\"y2\":" + std::to_string(a.y2) +
                        ",\"a_low\":" + std::to_string(a.a_low) +
                        ",\"a_high\":" + std::to_string(a.a_high) +
                        ",\"b_low\":" + std::to_string(a.b_low) +
                        ",\"b_high\":" + std::to_string(a.b_high) +
                        ",\"area_min\":" + std::to_string(a.area_min) + "}";
            }
            body += "]";
            body += ",\"funcs\":[";
            for (size_t i = 0; i < funcs.size(); i++) {
                if (i) body += ",";
                body += "{\"name\":\"" + json_escape(funcs[i].name) + "\",\"rows\":[";
                for (size_t k = 0; k < funcs[i].notes.size(); k++) {
                    if (k) body += ",";
                    const auto& r = funcs[i].notes[k];
                    body += "[" + std::to_string(r.x1) + "," + std::to_string(r.y1) +
                            "," + std::to_string(r.x2) + "," + std::to_string(r.y2) + "]";
                }
                body += "]}";
            }
            body += "]}";
            send_ok(res, body);
        } catch (const std::exception& e) {
            send_err(res, 500, std::string("坐标文件解析失败: ") + e.what());
        }
    });

    // ============ P4 VTB 模板解析（移植自 OLD/CTemplateVTB.cpp CTemplateVTB::Load）============
    // 二进制布局（小端）：header(8×u32) + mode(5×8 u32) + route(208 u32) + command 流(u16)。
    // command 流按 mode(6) -> process(8) -> command 分组：
    //   每个 command = {function(u16), len(u16), params[len](u16), sum(u16)}；
    //   function==0xffff 表示该 process 结束，切换到下一 process（process 满 8 进下一 mode）。
    struct VtbCmd { uint16_t function; uint16_t len; std::vector<uint16_t> params; uint16_t sum; };
    struct VtbProc { int count = 0; std::vector<VtbCmd> commands; };
    struct VtbMode { VtbProc process[8]; };

    const auto parse_vtb_to_json = [](const std::string& path) -> std::string {
        std::ifstream fp(path, std::ios::binary);
        if (!fp) return std::string("{\"path\":\"") + json_escape(path) + "\",\"error\":\"无法打开文件\"}";
        std::vector<uint8_t> buf((std::istreambuf_iterator<char>(fp)), std::istreambuf_iterator<char>());
        fp.close();
        // header + mode + route 共 32 + 160 + 832 = 1024 字节
        const size_t kHeaderModeRoute = 32 + 160 + 832;
        if (buf.size() < kHeaderModeRoute + 2) {
            return std::string("{\"path\":\"") + json_escape(path) + "\",\"error\":\"文件过小\"}";
        }
        bool sru = (buf.size() > 3 && buf[0] == 'S' && buf[1] == 'R' && buf[2] == 'U');
        size_t pos = sru ? 32 : 0;          // SRU 文件头部有 32 字节 sruHeader
        pos += kHeaderModeRoute;

        // command 流：剩余字节按 u16 小端读入
        std::vector<uint16_t> vtbData;
        vtbData.reserve((buf.size() - pos) / 2);
        for (size_t i = pos; i + 1 < buf.size(); i += 2) {
            vtbData.push_back(static_cast<uint16_t>(buf[i] | (buf[i + 1] << 8)));
        }

        std::vector<VtbMode> vtb(6);
        size_t idx = 0;
        int indexMode = 0, indexProcess = 0, indexCommand = 0;
        bool sectionEnd = false;
        while (idx < vtbData.size() && indexMode < 6) {
            uint16_t function = vtbData[idx];
            if (function == 0xffff) {
                sectionEnd = true;
            } else {
                VtbCmd c;
                c.function = function;
                idx++;
                if (idx >= vtbData.size()) break;
                c.len = vtbData[idx];
                for (int p = 0; p < c.len && idx < vtbData.size(); p++) {
                    idx++;
                    if (idx >= vtbData.size()) break;
                    c.params.push_back(vtbData[idx]);
                }
                idx++;
                if (idx < vtbData.size()) c.sum = vtbData[idx];
                vtb[indexMode].process[indexProcess].commands.push_back(c);
                indexCommand++;
            }
            if (sectionEnd) {
                vtb[indexMode].process[indexProcess].count = indexCommand + 1;
                indexCommand = 0;
                indexProcess++;
                if (indexProcess >= 8) {
                    indexProcess = 0;
                    indexMode++;
                }
                sectionEnd = false;
            }
            idx++;
        }

        std::string body = "{\"path\":\"" + json_escape(path) + "\",\"sru\":" +
                            (sru ? "true" : "false") + ",\"modes\":[";
        for (int m = 0; m < 6; m++) {
            if (m) body += ",";
            body += "{\"index\":" + std::to_string(m) + ",\"processes\":[";
            for (int pr = 0; pr < 8; pr++) {
                if (pr) body += ",";
                const VtbProc& proc = vtb[m].process[pr];
                body += "{\"index\":" + std::to_string(pr) + ",\"count\":" +
                        std::to_string(proc.count) + ",\"commands\":[";
                for (size_t ci = 0; ci < proc.commands.size(); ci++) {
                    if (ci) body += ",";
                    const VtbCmd& cmd = proc.commands[ci];
                    body += "{\"function\":" + std::to_string(cmd.function) +
                            ",\"len\":" + std::to_string(cmd.len) + ",\"params\":[";
                    for (size_t pi = 0; pi < cmd.params.size(); pi++) {
                        if (pi) body += ",";
                        body += std::to_string(cmd.params[pi]);
                    }
                    body += "],\"sum\":" + std::to_string(cmd.sum) + "}";
                }
                body += "]}";
            }
            body += "]}";
        }
        body += "],\"note\":\"VTB 已解析(" + std::to_string(vtbData.size()) + " u16)\"}";
        return body;
    };

    svr.Post("/api/atb/load", [](const httplib::Request& req, httplib::Response& res) {
        std::string path = json_get_str(req.body, "path", "");
        if (path.empty()) {
            send_err(res, 400, "path 必填");
            return;
        }
        try {
            send_ok(res, atb_load_json(path));
        } catch (const std::exception& e) {
            send_err(res, 500, e.what());
        }
    });

    // 切换 area（复刻 OLD IDC_COMBO_ATB_TYPE CBN_SELCHANGE -> SetDefaultATBList）
    svr.Post("/api/atb/area", [](const httplib::Request& req, httplib::Response& res) {
        int index = json_get_int(req.body, "index", 0);
        try {
            std::lock_guard<std::mutex> lk(g_atb_mutex);
            if (g_atb_table.empty()) {
                send_err(res, 400, "ATB 未加载，请先 Load...");
                return;
            }
            int entries = g_atb_sru ? ATB_SRU_ENTRIES : ATB_ENTRIES;
            int area = index < 0 ? 0 : index;
            send_ok(res, atb_area_json_locked(area, entries));
        } catch (const std::exception& e) {
            send_err(res, 500, e.what());
        }
    });

    // 更新条目并写回文件（复刻 OLD Save/Update、Clear、Clear 4D、Set 4D 的公共写回路径）
    // body: { area, entry, bytes:[8] }；entry 为 area 内条目序号（0 起）
    svr.Post("/api/atb/update", [](const httplib::Request& req, httplib::Response& res) {
        int area = json_get_int(req.body, "area", 0);
        int entry = json_get_int(req.body, "entry", -1);
        std::string raw = json_get_raw(req.body, "bytes");
        try {
            // 解析 8 字节数组（对应 OLD updateBytes / updateBytesDirB/C/D）
            std::vector<int> vals = json_parse_int_array(raw);
            if ((int)vals.size() != ATB_ENTRY_BYTES) {
                send_err(res, 400, "bytes 必须为 8 个整数");
                return;
            }
            std::lock_guard<std::mutex> lk(g_atb_mutex);
            if (g_atb_table.empty()) {
                send_err(res, 400, "ATB 未加载，请先 Load...");
                return;
            }
            int areas = g_atb_sru ? ATB_SRU_AREAS : ATB_AREAS;
            int entries = g_atb_sru ? ATB_SRU_ENTRIES : ATB_ENTRIES;
            if (area < 0 || area >= areas || entry < 0 || entry >= entries) {
                send_err(res, 400, "area/entry 越界");
                return;
            }
            uint8_t* dst = g_atb_table.data() + (size_t)area * entries * ATB_ENTRY_BYTES
                           + (size_t)entry * ATB_ENTRY_BYTES;
            for (int i = 0; i < ATB_ENTRY_BYTES; i++) dst[i] = (uint8_t)(vals[i] & 0xFF);

            // 整表写回（SRU 文件先写回原 32 字节头，与 OLD fwrite(SRU_FILE_HEADER_ATB) 一致）
            std::ofstream fp(g_atb_path, std::ios::binary | std::ios::trunc);
            if (!fp.is_open()) {
                send_err(res, 500, "Cannot Write File!! " + g_atb_path);
                return;
            }
            if (g_atb_sru && !g_atb_header.empty()) {
                fp.write(reinterpret_cast<const char*>(g_atb_header.data()),
                         (std::streamsize)g_atb_header.size());
            }
            fp.write(reinterpret_cast<const char*>(g_atb_table.data()),
                     (std::streamsize)g_atb_table.size());
            fp.close();

            std::string body = atb_area_json_locked(area, entries);
            body.pop_back(); // 去掉 '}'，附加提示
            body += ",\"written\":true}";
            send_ok(res, body);
        } catch (const std::exception& e) {
            send_err(res, 500, e.what());
        }
    });

    // Load Size...（复刻 OLD LoadCTB：解析 CTB 的 note 尺寸列表）
    svr.Post("/api/atb/ctb", [](const httplib::Request& req, httplib::Response& res) {
        std::string path = json_get_str(req.body, "path", "");
        if (path.empty()) {
            send_err(res, 400, "path 必填");
            return;
        }
        try {
            send_ok(res, atb_ctb_json(path));
        } catch (const std::exception& e) {
            send_err(res, 500, e.what());
        }
    });

    svr.Post("/api/vtb/load", [&parse_vtb_to_json](const httplib::Request& req, httplib::Response& res) {
        std::string path = json_get_str(req.body, "path", "");
        if (path.empty()) {
            send_err(res, 400, "path 必填");
            return;
        }
        try {
            send_ok(res, parse_vtb_to_json(path));
        } catch (const std::exception& e) {
            send_err(res, 500, e.what());
        }
    });

    // ============ P5 保存与配置 ============
    svr.Post("/api/export/csv", [](const httplib::Request& req, httplib::Response& res) {
        std::string path = json_get_str(req.body, "path", "");
        if (path.empty()) {
            send_err(res, 400, "path 必填");
            return;
        }
        std::string header = json_get_str(req.body, "header", "");
        std::string rows_raw = json_get_raw(req.body, "rows");
        std::ofstream out(path, std::ios::binary);
        if (!out) {
            send_err(res, 500, "无法写入: " + path);
            return;
        }
        if (!header.empty()) out << header << "\r\n";
        size_t written = 0;
        for (const std::string& row : json_array_elements(rows_raw)) {
            // 行内各字段：支持数值或字符串，按出现顺序输出
            std::string line;
            size_t i = 1;  // 跳过 '['
            bool first = true;
            while (i < row.size() && row[i] != ']') {
                char c = row[i];
                if (c == '{' || c == '[') {
                    std::string sub = json_balanced(row, i);
                    i += sub.size();
                    continue;
                }
                if (c == '"') {
                    size_t e = row.find('"', i + 1);
                    if (e == std::string::npos) break;
                    std::string v = json_escape(row.substr(i + 1, e - i - 1));
                    if (!first) line += ",";
                    line += v;
                    first = false;
                    i = e + 1;
                    continue;
                }
                if (std::isdigit(static_cast<unsigned char>(c)) || c == '-' || c == '+') {
                    size_t s = i;
                    while (i < row.size() &&
                           (std::isdigit(static_cast<unsigned char>(row[i])) || row[i] == '.' ||
                            row[i] == '-' || row[i] == '+'))
                        i++;
                    if (!first) line += ",";
                    line += row.substr(s, i - s);
                    first = false;
                    continue;
                }
                i++;
            }
            out << line << "\r\n";
            written++;
        }
        out.close();
        send_ok(res, "{\"ok\":true,\"path\":\"" + json_escape(path) + "\",\"rows\":" +
                         std::to_string(written) + "}");
    });

    svr.Post("/api/config/save", [](const httplib::Request& req, httplib::Response& res) {
        std::string path = json_get_str(req.body, "path", "");
        if (path.empty()) {
            send_err(res, 400, "path 必填");
            return;
        }
        std::string config = json_get_raw(req.body, "config");
        if (config.empty()) config = "{}";
        std::ofstream out(path, std::ios::binary);
        if (!out) {
            send_err(res, 500, "无法写入: " + path);
            return;
        }
        out << config;
        out.close();
        send_ok(res, std::string("{\"ok\":true,\"path\":\"") + json_escape(path) +
                         "\",\"note\":\"[需补移植] 采用 JSON 配置，原版 singan2.si2 格式未移植\"}");
    });

    svr.Post("/api/config/load", [](const httplib::Request& req, httplib::Response& res) {
        std::string path = json_get_str(req.body, "path", "");
        if (path.empty()) {
            send_err(res, 400, "path 必填");
            return;
        }
        std::ifstream in(path, std::ios::binary);
        if (!in) {
            send_err(res, 404, "配置文件不存在: " + path);
            return;
        }
        std::ostringstream ss;
        ss << in.rdbuf();
        send_ok(res, std::string("{\"path\":\"") + json_escape(path) + "\",\"config\":" +
                         (ss.str().empty() ? std::string("{}") : ss.str()) + "}");
    });

    // 本地单机构建工具：上传的 .dat 可达数百 MB，放宽 httplib 默认 100MB 上传上限到 4GB
    svr.set_payload_max_length(4UL * 1024 * 1024 * 1024);

    // 关闭 Nagle 算法（TCP_NODELAY）。否则大响应体（如整通道 17MB 二进制）在回环网卡上
    // 会因 Nagle + 延迟 ACK 相互等待而严重降速（21KB 小响应不受影响，17MB 可慢到 10+ 秒）。
    // 本服务仅本地单机使用，关闭 Nagle 无副作用，大块下发吞吐立即恢复。
    svr.set_tcp_nodelay(true);

    // 并发模型：httplib 默认即为多线程（线程池 base=max(8, 硬件线程数-1)、max=4×base），
    // 这里显式声明以保持意图清晰，并集中在一处便于按需调大并发上限。
    // 效果：上传大文件（655MB 约 6.5s）期间，取图 / Make Graph 等其它请求可在其它线程并行处理，不被阻塞。
    // 线程安全前提：WTable 缓存已由 std::mutex 保护（见 get_wtable），ImageEngine 每次请求本地构造，无共享可变状态。
    svr.new_task_queue = [] {
        const size_t base = (std::max)(8u, std::thread::hardware_concurrency() > 0
                                              ? std::thread::hardware_concurrency() - 1
                                              : 0);
        return new httplib::ThreadPool(base, base * 4);
    };

    std::cout << "[server] SINGAN2 HTTP API listening on port " << port << " ..." << std::endl;
    if (!svr.listen("0.0.0.0", port)) {
        std::cerr << "[server] Failed to bind port " << port << " (already in use?)" << std::endl;
        return 1;
    }
    return 0;
}
