// M3 HTTP API 服务：包装已验证的 C++ 算法层，对外提供 JSON 接口。
// 技术栈：cpp-httplib（单头文件，Windows 下使用 Winsock，无 OpenSSL 依赖）。
//
// 端点总览（P0–P5 模块功能同步，详见 docs/11_模块功能同步方案_P0-P5.md）：
//   GET  /health                    健康检查
//   -- P0 基础数据链路 --
//   POST /api/session/open          {dat_path}                     -> {record_count, wave_count, waves[]}
//   POST /api/image                 {dat_path,record,wave,mode,...}-> {width,height,encoding,min,max,data(base64)}
//   POST /api/small-image           {dat_path,record}              -> {size,data(base64)}
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
//   POST /api/zfile/parse           {path,encoding}                -> {areas[]}
//   POST /api/atb/load              {path}                          [需补移植：ATB 二进制格式需反推]
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

// 在指定矩形区域内统计黑/白像素数（复刻 ComputeSuppleResult case 0：summary pixels）
static std::pair<int, int> count_black_white(const std::vector<uint16_t>& img,
                                             int x, int y, int w, int h,
                                             int color_point) {
    int black = 0, white = 0;
    int offset = color_point - 150;
    int x1 = std::max(0, x);
    int y1 = std::max(0, y);
    int x2 = std::min(singan2::X_SIZE, x + w);
    int y2 = std::min(singan2::Y_SIZE, y + h);
    for (int i = y1; i < y2; i++) {
        for (int j = x1; j < x2; j++) {
            int color = static_cast<int>(img[i * singan2::X_SIZE + j]) + offset;
            if (color > 255) color = 255;
            if (color < 0) color = 0;
            if (color == 0) black++;
            else if (color == 255) white++;
        }
    }
    return {black, white};
}

// 单 record 计算 Make Graph 像素数
static bool make_graph_record(const std::string& dat_path, int record,
                              const std::string& wtable_path, const std::string& wave_name,
                              const std::string& niti_type, int grad_type, int gain,
                              int threshold, int color_point,
                              int area_x, int area_y, int area_w, int area_h,
                              bool use_black,
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
    auto [black, white] = count_black_white(two, area_x, area_y, area_w, area_h, color_point);
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
static std::mutex g_dbg_mutex;
static void debug_log(const std::string& msg) {
    try {
        std::lock_guard<std::mutex> lk(g_dbg_mutex);
        std::ofstream out("singan2_debug.log", std::ios::app);
        if (!out) return;
        std::time_t t = std::time(nullptr);
        char buf[32] = {0};
        std::tm tm_buf{};
        localtime_s(&tm_buf, &t);
        std::strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &tm_buf);
        out << "[" << buf << "] " << msg << "\n";
        out.flush();
    } catch (...) {
        // 调试日志失败不影响主流程
    }
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

            int nthreads = (int)std::thread::hardware_concurrency();
            if (nthreads < 1) nthreads = 1;
            if (nthreads > n) nthreads = n;
            auto worker = [&](int lo, int hi) {
                for (int i = lo; i < hi; i++) {
                    int rec = std::max(0, std::min(record_count - 1, startVal + i * step));
                    try {
                        singan2::run_algorithm(dat_path, rec, zfile_path, "" /*wtable 空=理论表*/,
                                              kin, country, s2s[i], etcs[i]);
                    } catch (const std::exception& e) {
                        errs[i] = e.what();
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
                std::string dbg = "[analyze-batch] 请求 dat_path=" + dat_path
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
                    dbg += " 样例错误=";
                    for (size_t i = 0; i < err_samples.size(); ++i) {
                        if (i) dbg += " | ";
                        dbg += err_samples[i];
                    }
                }
                debug_log(dbg);
            }

            auto t1 = std::chrono::steady_clock::now();
            long long elapsed_ms = std::chrono::duration_cast<std::chrono::milliseconds>(t1 - t0).count();
            std::string body = "{\"count\":" + std::to_string(n)
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

        // 并行化：每个 record 的计算相互独立（make_graph_record 内部持有局部 ImageEngine，
        // 文件读取走带锁的 LRU 缓存），各线程只写自己的下标，无数据竞争。
        int nthreads = (int)std::thread::hardware_concurrency();
        if (nthreads < 1) nthreads = 1;
        if (nthreads > m) nthreads = m;
        auto worker = [&](int lo, int hi) {
            for (int i = lo; i < hi; i++) {
                std::string err;
                int v = 0;
                if (make_graph_record(dat_path, recs[i], wtable_path, wave_name, niti_type,
                                      grad_type, gain, threshold, color_point,
                                      area_x, area_y, area_w, area_h, use_black, v, err)) {
                    values[i] = v; ok[i] = 1;
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

    // ============ P4 ATB / VTB / 坐标 ============
    svr.Post("/api/zfile/parse", [](const httplib::Request& req, httplib::Response& res) {
        std::string path = json_get_str(req.body, "path", "");
        if (path.empty()) {
            send_err(res, 400, "path 必填");
            return;
        }
        try {
            auto areas = singan2::parse_zfile(path, json_get_str(req.body, "encoding", "shift_jis"));
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
        send_ok(res, std::string("{\"path\":\"") + json_escape(path) +
                         "\",\"items\":[],\"note\":\"[需补移植] ATB 二进制格式(OLD 未提供 CTemplateATB，需由 X_ATB_*.txt 对照 X_ATB_*.bin 反推)\"}");
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
