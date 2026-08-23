// M3 HTTP API 服务：包装已验证的 C++ 算法层 run_algorithm，对外提供 JSON 接口。
// 技术栈：cpp-httplib（单头文件，Windows 下使用 Winsock，无 OpenSSL 依赖）。
//
// 提供的端点：
//   GET  /health                  健康检查，返回 {"status":"ok"}
//   POST /api/analyze             多部件上传 .dat（字段 dat=文件，record/kin/country/zfile_path 可选）
//   POST /api/analyze-path        以 JSON 体指定本地路径 {dat_path, zfile_path, record, kin, country}
//
// 所有接口返回 application/json。成功: {"s2":[...],"etc":[...]}；失败: {"error":"..."}。

#include <cstdint>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

#include "httplib.h"
#include "singan2/algo.h"

namespace fs = std::filesystem;

// ---- 极简 JSON 解析辅助（仅用于可信请求体，提取少数字段）----
static std::string json_get_str(const std::string& body, const std::string& key,
                                const std::string& def) {
    std::string pat = "\"" + key + "\"";
    size_t p = body.find(pat);
    if (p == std::string::npos) return def;
    size_t c = body.find(':', p + pat.size());
    if (c == std::string::npos) return def;
    size_t q1 = body.find('"', c + 1);
    if (q1 == std::string::npos) return def;
    size_t q2 = body.find('"', q1 + 1);
    if (q2 == std::string::npos) return def;
    return body.substr(q1 + 1, q2 - q1 - 1);
}

static int json_get_int(const std::string& body, const std::string& key, int def) {
    std::string pat = "\"" + key + "\"";
    size_t p = body.find(pat);
    if (p == std::string::npos) return def;
    size_t c = body.find(':', p + pat.size());
    if (c == std::string::npos) return def;
    size_t s = c + 1;
    while (s < body.size() && (body[s] == ' ' || body[s] == '\t')) s++;
    size_t e = s;
    while (e < body.size() && (std::isdigit(static_cast<unsigned char>(body[e])) || body[e] == '-')) e++;
    if (e == s) return def;
    try {
        return std::stoi(body.substr(s, e - s));
    } catch (...) {
        return def;
    }
}

// ---- 向量序列化为 JSON 数组 ----
static std::string to_json_array(const std::vector<int>& v) {
    std::string s = "[";
    for (size_t i = 0; i < v.size(); i++) {
        if (i) s += ",";
        s += std::to_string(v[i]);
    }
    s += "]";
    return s;
}

// 运行算法并序列化为结果 JSON；异常时返回 {"error":...}
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

// 从 multipart 表单安全读取整型/字符串字段
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

// 给响应附加 CORS 头，便于后续 Web 前端跨域调用
static void set_cors(httplib::Response& res) {
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type");
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

    // 预路由：处理 OPTIONS 预检
    svr.set_pre_routing_handler([](const httplib::Request& req, httplib::Response& res) {
        if (req.method == "OPTIONS") {
            set_cors(res);
            res.status = 204;
            return httplib::Server::HandlerResponse::Handled;
        }
        return httplib::Server::HandlerResponse::Unhandled;
    });

    svr.Get("/health", [](const httplib::Request&, httplib::Response& res) {
        set_cors(res);
        res.set_content("{\"status\":\"ok\"}", "application/json");
    });

    // 多部件上传 .dat
    svr.Post("/api/analyze", [](const httplib::Request& req, httplib::Response& res) {
        set_cors(res);
        if (!req.form.has_file("dat")) {
            res.status = 400;
            res.set_content("{\"error\":\"缺少上传文件字段 dat\"}", "application/json");
            return;
        }
        const auto& f = req.form.get_file("dat");
        int record = form_int(req.form, "record", 0);
        int kin = form_int(req.form, "kin", 1);
        int country = form_int(req.form, "country", 0);
        std::string zfile_path = form_str(req.form, "zfile_path", "");

        // 落盘为临时文件后调用算法
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
            res.set_content(body, "application/json");
        } catch (const std::exception& e) {
            std::error_code ec;
            fs::remove(tmp, ec);
            res.status = 500;
            res.set_content(std::string("{\"error\":\"") + e.what() + "\"}", "application/json");
        }
    });

    // 以本地路径方式分析（便于联调与自动化测试）
    svr.Post("/api/analyze-path", [](const httplib::Request& req, httplib::Response& res) {
        set_cors(res);
        std::string dat_path = json_get_str(req.body, "dat_path", "");
        std::string zfile_path = json_get_str(req.body, "zfile_path", "");
        int record = json_get_int(req.body, "record", 0);
        int kin = json_get_int(req.body, "kin", 1);
        int country = json_get_int(req.body, "country", 0);
        if (dat_path.empty() || zfile_path.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"dat_path 与 zfile_path 均必填\"}", "application/json");
            return;
        }
        try {
            std::string body = run_and_serialize(dat_path, record, zfile_path, kin, country);
            res.set_content(body, "application/json");
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(std::string("{\"error\":\"") + e.what() + "\"}", "application/json");
        }
    });

    std::cout << "[server] SINGAN2 HTTP API listening on port " << port << " ..." << std::endl;
    if (!svr.listen("0.0.0.0", port)) {
        std::cerr << "[server] Failed to bind port " << port << " (already in use?)" << std::endl;
        return 1;
    }
    return 0;
}
