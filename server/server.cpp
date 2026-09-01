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
//   POST /api/graph/make            {dat_path,record,zfile_path,wave,mode}
//   POST /api/graph/combine         {a[],b[],mode}
//   POST /api/graph/save|load       {path[,series]}
//   -- P4 ATB / VTB / 坐标 --
//   POST /api/zfile/parse           {path,encoding}                -> {areas[]}
//   POST /api/atb/load              {path}                          [需补移植 CTemplate]
//   POST /api/vtb/load              {path}                          [需补移植 CTemplateVTB]
//   -- P5 保存与配置 --
//   POST /api/export/csv            {path,header,rows}
//   POST /api/config/save|load      {path[,config]}
//
// 说明：P3–P5 中依赖未移植 MFC 模块（CreateGraph/OnDrawPaint/CGR_CLASS/CTemplateVTB/save_load/si2）
// 的部分，返回结构已按前端需要定义，实现为"可用近似"，并在响应中带 note 标注 [需补移植]。

#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstdint>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
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

// ---- 除法表加载（带缓存）----
static const WTable& get_wtable(const std::string& path) {
    static WTable cached;
    static std::string cached_path;
    static bool loaded = false;
    std::string key = path.empty() ? std::string("<theory>") : path;
    if (loaded && cached_path == key) return cached;
    if (path.empty()) {
        cached = singan2::gen_w_table();
    } else {
        try {
            cached = singan2::load_w_table(path);
        } catch (...) {
            cached = singan2::gen_w_table();
        }
    }
    cached_path = key;
    loaded = true;
    return cached;
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
        std::string body = "{\"record\":" + std::to_string(record);
        body += ",\"size\":" + std::to_string(seg.size());
        body += ",\"min\":" + std::to_string(mn);
        body += ",\"max\":" + std::to_string(mx);
        body += ",\"data\":\"" + data + "\"}";
        send_ok(res, body);
    });

    // ============ P1 分析链路 ============
    svr.Post("/api/analyze-path", [](const httplib::Request& req, httplib::Response& res) {
        std::string dat_path = json_get_str(req.body, "dat_path", "");
        std::string zfile_path = json_get_str(req.body, "zfile_path", "");
        int record = json_get_int(req.body, "record", 0);
        int kin = json_get_int(req.body, "kin", 1);
        int country = json_get_int(req.body, "country", 0);
        if (dat_path.empty() || zfile_path.empty()) {
            send_err(res, 400, "dat_path 与 zfile_path 均必填");
            return;
        }
        try {
            send_ok(res, run_and_serialize(dat_path, record, zfile_path, kin, country));
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
                    eng.gradient(json_get_int(opobj, "gtype", 0), json_get_int(opobj, "amp", 1));
                    applied.push_back("gradient");
                } else if (op == "niti") {
                    eng.niti(json_get_int(opobj, "s", 128));
                    applied.push_back("niti");
                } else if (op == "smooth") {
                    eng.smooth();
                    applied.push_back("smooth");
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
    // [需补移植] 原版 CreateGraph.cpp / OnDrawPaint.cpp / CGR_CLASS 未移植，
    // 此处以"按坐标区域统计 + 列剖面"生成可用序列，语义对齐待补移植后校准。
    svr.Post("/api/graph/make", [](const httplib::Request& req, httplib::Response& res) {
        std::string dat_path = json_get_str(req.body, "dat_path", "");
        if (dat_path.empty()) {
            send_err(res, 400, "dat_path 必填");
            return;
        }
        int record = json_get_int(req.body, "record", 0);
        std::string zfile_path = json_get_str(req.body, "zfile_path", "");
        std::string wtable_path = json_get_str(req.body, "wtable_path", "");
        std::string name = resolve_wave_name(req.body, "wave", 0);

        ImageEngine eng;
        std::string err;
        if (!build_engine(dat_path, record, wtable_path, eng, err)) {
            send_err(res, 400, err);
            return;
        }
        const std::vector<uint8_t>* img = eng.oneimg_find(name);
        if (!img) {
            send_err(res, 400, "波段不存在: " + name);
            return;
        }

        // 区域：优先用坐标文件，否则整幅
        std::vector<singan2::Area> areas;
        if (!zfile_path.empty()) {
            try {
                areas = singan2::parse_zfile(zfile_path,
                                             json_get_str(req.body, "encoding", "shift_jis"));
            } catch (...) {
                areas.clear();
            }
        }
        if (areas.empty()) {
            singan2::Area whole;
            whole.x1 = 0; whole.y1 = 0; whole.x2 = singan2::X_SIZE - 1; whole.y2 = singan2::Y_SIZE - 1;
            areas.push_back(whole);
        }
        // 坐标文件可能含上千区域，默认只取前 N 个，避免响应过大
        int max_areas = json_get_int(req.body, "max_areas", 8);
        if (max_areas < 1) max_areas = 1;
        if (max_areas > 256) max_areas = 256;

        const int W = singan2::X_SIZE, H = singan2::Y_SIZE;
        std::string series_json = "[";
        std::string stats_json = "[";
        bool first_series = true, first_stat = true;
        int ai = 0;
        for (const auto& a : areas) {
            if (ai >= max_areas) break;
            int x1 = std::max(0, std::min(a.x1, W - 1)), x2 = std::max(0, std::min(a.x2, W - 1));
            int y1 = std::max(0, std::min(a.y1, H - 1)), y2 = std::max(0, std::min(a.y2, H - 1));
            if (x2 < x1) std::swap(x1, x2);
            if (y2 < y1) std::swap(y1, y2);

            // 列剖面：每列均值
            std::vector<double> prof;
            prof.reserve(x2 - x1 + 1);
            double sum = 0, sum2 = 0;
            int cnt = 0, mnv = 255, mxv = 0;
            for (int x = x1; x <= x2; x++) {
                double col = 0;
                for (int y = y1; y <= y2; y++) {
                    int v = (*img)[y * W + x];
                    col += v;
                    sum += v; sum2 += static_cast<double>(v) * v;
                    cnt++;
                    if (v < mnv) mnv = v;
                    if (v > mxv) mxv = v;
                }
                prof.push_back(col / static_cast<double>(y2 - y1 + 1));
            }
            double avg = cnt ? sum / cnt : 0;
            double var = cnt ? (sum2 / cnt - avg * avg) : 0;
            if (var < 0) var = 0;

            if (!first_series) series_json += ",";
            first_series = false;
            series_json += "{\"name\":\"Area" + std::to_string(ai) +
                           "\",\"points\":" + to_json_array(prof, 3) + "}";

            char buf[64];
            if (!first_stat) stats_json += ",";
            first_stat = false;
            stats_json += "{\"index\":" + std::to_string(ai);
            stats_json += ",\"area\":{\"x1\":" + std::to_string(a.x1) +
                          ",\"y1\":" + std::to_string(a.y1) +
                          ",\"x2\":" + std::to_string(a.x2) +
                          ",\"y2\":" + std::to_string(a.y2) + "}";
            std::snprintf(buf, sizeof(buf), "%.4f", avg);
            stats_json += std::string(",\"avg\":") + buf;
            std::snprintf(buf, sizeof(buf), "%.4f", std::sqrt(var));
            stats_json += std::string(",\"std\":") + buf;
            stats_json += ",\"min\":" + std::to_string(mnv);
            stats_json += ",\"max\":" + std::to_string(mxv);
            stats_json += "}";
            ai++;
        }
        series_json += "]";
        stats_json += "]";

        std::string body = "{\"record\":" + std::to_string(record);
        body += ",\"wave\":\"" + json_escape(name) + "\"";
        body += ",\"note\":\"[需补移植] 原版 CreateGraph/OnDrawPaint 未移植，当前为按区域列剖面近似\"";
        body += ",\"series\":" + series_json;
        body += ",\"stats\":" + stats_json;
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

    // [需补移植] ATB / VTB 依赖 CTemplate* / CTemplateVTB，尚未移植
    svr.Post("/api/atb/load", [](const httplib::Request& req, httplib::Response& res) {
        std::string path = json_get_str(req.body, "path", "");
        send_ok(res, std::string("{\"path\":\"") + json_escape(path) +
                         "\",\"items\":[],\"note\":\"[需补移植] ATB 依赖 CTemplate*/ATB 逻辑，尚未移植\"}");
    });

    svr.Post("/api/vtb/load", [](const httplib::Request& req, httplib::Response& res) {
        std::string path = json_get_str(req.body, "path", "");
        send_ok(res, std::string("{\"path\":\"") + json_escape(path) +
                         "\",\"items\":[],\"note\":\"[需补移植] VTB 依赖 CTemplateVTB，尚未移植\"}");
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

    std::cout << "[server] SINGAN2 HTTP API listening on port " << port << " ..." << std::endl;
    if (!svr.listen("0.0.0.0", port)) {
        std::cerr << "[server] Failed to bind port " << port << " (already in use?)" << std::endl;
        return 1;
    }
    return 0;
}
