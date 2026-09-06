#include "singan2/mariner_reader.h"

#include <algorithm>
#include <chrono>
#include <fstream>
#include <list>
#include <map>
#include <mutex>
#include <cstdio>

namespace singan2 {

namespace {

// 批量读取整个文件（seek/tellg/read）。
// 旧实现用 istreambuf_iterator 逐字符读 21MB 文件耗时数秒，是 /api/image 慢的主因。
std::vector<uint8_t> read_file(const std::string& path) {
    std::ifstream f(path, std::ios::binary);
    if (!f) return {};
    f.seekg(0, std::ios::end);
    const std::streamoff len = f.tellg();
    if (len <= 0) return {};
    std::vector<uint8_t> data(static_cast<size_t>(len));
    f.seekg(0, std::ios::beg);
    f.read(reinterpret_cast<char*>(data.data()), len);
    if (!f && !f.eof()) return {};
    data.resize(static_cast<size_t>(f.gcount()));
    return data;
}

const char* enum_image_type(int t) {
    switch (t) {
        case 0:  return "Head1";
        case 1:  return "Head2";
        case 2:  return "MM1Yose";
        case 3:  return "MM8_Img";
        case 4:  return "MM1_Img";
        case 5:  return "MM1_Side";
        case 6:  return "Magnetic";
        case 7:  return "Thickness";
        case 8:  return "UV";
        case 9:  return "HEAD_SRU";
        case 12: return "SRU_Correction";
        case 13: return "SRU_MM8";
        case 14: return "SRU_Img";
        case 15: return "SRU_Side";
        case 16: return "SRU_Mag";
        case 17: return "SRU_Thickness";
        case 18: return "SRU_SNR";
        case 99: return "Other";
        default: return nullptr;
    }
}

// 对已加载的文件数据做块链遍历（偏移严格递增，必然终止）
std::vector<BlockInfo> parse_blocks_data(const std::vector<uint8_t>& data) {
    std::vector<BlockInfo> blocks;
    const size_t n = data.size();
    const bool is_sru = (n >= 3 && data[0] == 'S' && data[1] == 'R' && data[2] == 'U');
    size_t offset = is_sru ? 3 : 0;
    while (offset + BLOCK_HEADER <= n) {
        const uint8_t* h = &data[offset];
        uint32_t data_size = static_cast<uint32_t>(h[0]) |
                             (static_cast<uint32_t>(h[1]) << 8) |
                             (static_cast<uint32_t>(h[2]) << 16) |
                             (static_cast<uint32_t>(h[3]) << 24);
        const int image_type = h[4];
        const char* name = enum_image_type(image_type);
        std::string type_name = name ? std::string(name)
                                     : ("UNKNOWN(" + std::to_string(image_type) + ")");
        blocks.emplace_back(type_name, image_type, data_size, static_cast<uint32_t>(offset));
        if (data_size == 0) break;  // 防止死循环
        offset += data_size;
    }
    return blocks;
}

}  // namespace

// ---- 文件缓存（LRU，容量上限可调）----
// 大 .dat 一个文件即含上千枚（1000 枚 ≈ 213MB），只缓存文件本体一份，切片近零开销。
namespace {

struct FileCache {
    std::mutex mu;
    std::map<std::string, std::pair<std::vector<uint8_t>, std::list<std::string>::iterator>> entries;
    std::list<std::string> lru;  // front = 最近使用
    size_t total = 0;
    size_t cap = [] {
        size_t mb = 2048;  // 默认 2048MB
        if (const char* env = std::getenv("SINGAN2_FILE_CACHE_MB")) {
            try { mb = std::stoul(env); } catch (...) {}
        }
        return mb * 1024ULL * 1024ULL;
    }();

    void evict_while_over() {
        while (total > cap && !lru.empty()) {
            const std::string& old_key = lru.back();
            auto it = entries.find(old_key);
            if (it == entries.end()) { lru.pop_back(); continue; }
            total -= it->second.first.size();
            entries.erase(it);
            lru.pop_back();
        }
    }
};

FileCache& file_cache() {
    static FileCache c;
    return c;
}

}  // namespace

const std::vector<uint8_t>& load_file_cached(const std::string& path) {
    FileCache& c = file_cache();
    std::lock_guard<std::mutex> lk(c.mu);

    auto it = c.entries.find(path);
    if (it != c.entries.end()) {
        c.lru.splice(c.lru.begin(), c.lru, it->second.second);  // 提到 front
        return it->second.first;
    }
    std::vector<uint8_t> data = read_file(path);
    c.total += data.size();
    c.lru.push_front(path);
    auto ins = c.entries.emplace(path,
        std::make_pair(std::move(data), c.lru.begin())).first;
    c.evict_while_over();
    return ins->second.first;
}

size_t file_cache_bytes() { return file_cache().total; }
size_t file_cache_capacity() { return file_cache().cap; }
void file_cache_set_capacity(size_t bytes) {
    FileCache& c = file_cache();
    std::lock_guard<std::mutex> lk(c.mu);
    c.cap = bytes;
    c.evict_while_over();
}
size_t file_cache_file_count() {
    FileCache& c = file_cache();
    std::lock_guard<std::mutex> lk(c.mu);
    return c.entries.size();
}
void file_cache_clear() {
    FileCache& c = file_cache();
    std::lock_guard<std::mutex> lk(c.mu);
    c.entries.clear();
    c.lru.clear();
    c.total = 0;
}

// ---- MM1_Side 偏移缓存（按文件缓存 type=5 块偏移列表）----
// 批量分析 1044 枚时，原 extract_mm1_side 每次都扫描整个 .dat 文件，
// 造成 O(n*m) 重复扫描；缓存 side_offsets 后只需一次扫描。
namespace {
struct SideOffsetsCache {
    std::mutex mu;
    std::map<std::string, std::vector<uint32_t>> data;
};
SideOffsetsCache& side_offsets_cache() {
    static SideOffsetsCache c;
    return c;
}
}  // namespace

static std::vector<uint32_t> get_side_offsets(const std::string& file_path) {
    SideOffsetsCache& c = side_offsets_cache();
    {
        std::lock_guard<std::mutex> lk(c.mu);
        auto it = c.data.find(file_path);
        if (it != c.data.end()) return it->second;
    }
    const std::vector<uint8_t>& data = load_file_cached(file_path);
    std::vector<uint32_t> offsets;
    if (!data.empty()) {
        const size_t n = data.size();
        const bool is_sru = (n >= 3 && data[0] == 'S' && data[1] == 'R' && data[2] == 'U');
        size_t offset = is_sru ? 3 : 0;
        while (offset + BLOCK_HEADER <= n) {
            const uint8_t* h = &data[offset];
            uint32_t data_size = static_cast<uint32_t>(h[0]) |
                                 (static_cast<uint32_t>(h[1]) << 8) |
                                 (static_cast<uint32_t>(h[2]) << 16) |
                                 (static_cast<uint32_t>(h[3]) << 24);
            if (h[4] == 5) offsets.push_back(static_cast<uint32_t>(offset));
            if (data_size == 0) break;
            offset += data_size;
        }
    }
    std::lock_guard<std::mutex> lk(c.mu);
    c.data[file_path] = offsets;
    return c.data[file_path];
}

// ---- Small image 元数据缓存（按文件缓存 one_data_size / length_mm_file_header）----
namespace {
struct SmallMetaCache {
    std::mutex mu;
    std::map<std::string, std::pair<uint32_t, uint32_t>> data;
};
SmallMetaCache& small_meta_cache() {
    static SmallMetaCache c;
    return c;
}
}  // namespace

static std::pair<uint32_t, uint32_t> get_small_meta(const std::string& file_path) {
    SmallMetaCache& c = small_meta_cache();
    {
        std::lock_guard<std::mutex> lk(c.mu);
        auto it = c.data.find(file_path);
        if (it != c.data.end()) return it->second;
    }
    const std::vector<uint8_t>& data = load_file_cached(file_path);
    uint32_t length_mm_file_header = 0;
    uint32_t one_data_size = 0;
    if (!data.empty()) {
        auto blocks = parse_blocks_data(data);
        bool first_data = false;
        for (const auto& b : blocks) {
            const int itype = std::get<1>(b);
            const uint32_t dsize = std::get<2>(b);
            if (itype == 0) {  // Head1
                length_mm_file_header = dsize;
                continue;
            }
            if (itype == 1) {  // Head2
                if (first_data) break;
                first_data = true;
            }
            one_data_size += dsize;
        }
    }
    std::pair<uint32_t, uint32_t> meta{one_data_size, length_mm_file_header};
    std::lock_guard<std::mutex> lk(c.mu);
    c.data[file_path] = meta;
    return c.data[file_path];
}

std::vector<BlockInfo> parse_blocks(const std::string& file_path) {
    return parse_blocks_data(load_file_cached(file_path));
}

std::vector<uint8_t> extract_mm1_side(const std::string& file_path, int record_index) {
    const std::vector<uint8_t>& data = load_file_cached(file_path);
    if (data.empty()) return {};

    std::vector<uint32_t> side_offsets = get_side_offsets(file_path);
    const int start = record_index * WAVE_COUNT;
    if (start < 0 || start + WAVE_COUNT > static_cast<int>(side_offsets.size())) {
        return {};
    }
    std::vector<uint8_t> global_onedat;
    global_onedat.reserve(GLOBAL_ONEDAT_SIZE);
    for (int k = 0; k < WAVE_COUNT; ++k) {
        const size_t data_off = static_cast<size_t>(side_offsets[start + k]) + BLOCK_HEADER;
        global_onedat.insert(global_onedat.end(),
                             data.begin() + data_off,
                             data.begin() + data_off + MM1_SIDE_BLOCK);
    }
    return global_onedat;
}

// 波段名(13 个原始波段) -> 块内序号 k（与 build_onebyte_images 的 kImgName 一一对应）。
// 其余波段(Img7..Img15 等中间波段)为运行时计算，不落盘，返回 -1。
static int wave_name_to_k(const std::string& name) {
    static const char* kImgName[WAVE_COUNT] = {
        "Img1", "Img20", "Img21", "Img22", "Img2", "Img3", "Img4",
        "Img5", "Img6", "Img16", "Img17", "Img18", "Img19"
    };
    for (int k = 0; k < WAVE_COUNT; ++k) {
        if (name == kImgName[k]) return k;
    }
    return -1;
}

std::vector<uint8_t> extract_wave_all(const std::string& file_path, const std::string& wave_name) {
    const auto t0 = std::chrono::steady_clock::now();
    const std::vector<uint8_t>& data = load_file_cached(file_path);
    const auto t1 = std::chrono::steady_clock::now();
    if (data.empty()) return {};

    const int k = wave_name_to_k(wave_name);
    if (k < 0) return {};

    std::vector<uint32_t> side_offsets = get_side_offsets(file_path);
    const auto t2 = std::chrono::steady_clock::now();
    const int count = static_cast<int>(side_offsets.size()) / WAVE_COUNT;
    if (count <= 0) return {};

    // 单枚单波段的像素位于第 r 枚第 k 块内，块头之后即 ONESIZE 字节（块内无额外 stride）。
    // 直接 memcpy 进预分配缓冲：避免 std::vector::insert 在 Debug 下逐元素的迭代器调试检查
    // （1044 枚 × ONESIZE ≈ 17MB 逐字节检查会慢到数秒）；Release 下两者等价。
    const size_t stride = static_cast<size_t>(ONESIZE);
    std::vector<uint8_t> out(stride * static_cast<size_t>(count));
    const uint8_t* src_base = data.data();
    uint8_t* dst = out.data();
    for (int r = 0; r < count; ++r) {
        const size_t rec_base =
            static_cast<size_t>(side_offsets[r * WAVE_COUNT + k]) + BLOCK_HEADER;
        if (rec_base + stride > data.size()) break;  // 越界保护
        memcpy(dst + static_cast<size_t>(r) * stride, src_base + rec_base, stride);
    }
    const auto t3 = std::chrono::steady_clock::now();
    fprintf(stderr, "[extract_wave_all] load=%.1fms offsets=%.1fms copy=%.1fms count=%d bytes=%zu\n",
            std::chrono::duration<double, std::milli>(t1 - t0).count(),
            std::chrono::duration<double, std::milli>(t2 - t1).count(),
            std::chrono::duration<double, std::milli>(t3 - t2).count(),
            count, out.size());
    return out;
}

std::vector<uint8_t> extract_small_image(const std::string& file_path, int record_index) {
    const std::vector<uint8_t>& data = load_file_cached(file_path);
    if (data.empty()) return {};

    const auto meta = get_small_meta(file_path);
    const uint32_t one_data_size = meta.first;
    const uint32_t length_mm_file_header = meta.second;
    const uint32_t offset = one_data_size * static_cast<uint32_t>(record_index) +
                            length_mm_file_header + BLOCK_HEADER;
    if (offset + SMALL_SIZE > data.size()) return {};
    std::vector<uint8_t> seg(data.begin() + offset, data.begin() + offset + SMALL_SIZE);
    // memcpy(global_small_image, global_small_image+1024, SMALL_SIZE-1024)
    for (int i = 0; i < SMALL_SIZE - SMALL_SKIP; ++i) {
        seg[i] = seg[i + SMALL_SKIP];
    }
    return seg;
}

std::vector<uint8_t> extract_small_image_raw(const std::string& file_path, int record_index) {
    const std::vector<uint8_t>& data = load_file_cached(file_path);
    if (data.empty()) return {};

    const auto meta = get_small_meta(file_path);
    const uint32_t one_data_size = meta.first;
    const uint32_t length_mm_file_header = meta.second;
    const uint32_t offset = one_data_size * static_cast<uint32_t>(record_index) +
                            length_mm_file_header + BLOCK_HEADER;
    if (offset + SMALL_SIZE > data.size()) return {};
    // 不做 SMALL_SKIP 去头：SM_dsp.dat 行结构（Ren.cpp DspOverWrite）偏移相对含头数据
    return std::vector<uint8_t>(data.begin() + offset, data.begin() + offset + SMALL_SIZE);
}

SmallImageValidation extract_small_image_validation(const std::string& file_path, int record_index) {
    const std::vector<uint8_t>& data = load_file_cached(file_path);
    SmallImageValidation out;
    if (data.empty()) return out;

    auto blocks = parse_blocks_data(data);
    uint32_t length_mm_file_header = 0;
    uint32_t one_data_size = 0;
    bool first_data = false;
    for (const auto& b : blocks) {
        const int itype = std::get<1>(b);
        const uint32_t dsize = std::get<2>(b);
        if (itype == 0) {  // Head1
            length_mm_file_header = dsize;
            continue;
        }
        if (itype == 1) {  // Head2
            if (first_data) break;
            first_data = true;
        }
        one_data_size += dsize;
    }
    const uint32_t offset = one_data_size * static_cast<uint32_t>(record_index) +
                            length_mm_file_header + BLOCK_HEADER;
    if (offset + SMALL_SIZE > data.size()) return out;

    const uint8_t* p = data.data() + offset;
    // 原始(去头前)偏移，对应 OLD/MainRun.cpp 第 833-843 行
    // （注：extract_small_image 会去掉前 SMALL_SKIP=1024 字节头，而这些字段偏移 <1024，
    //   故必须在此用原始段直接计算，不能用去头后的小图）
    auto u16 = [&](size_t i) -> int {
        return (static_cast<int>(p[i]) << 8) | static_cast<int>(p[i + 1]);
    };
    char buf[16];
    snprintf(buf, sizeof(buf), "%X%X%X%X", p[4220], p[4221], p[4222], p[4223]);
    out.han = buf;
    snprintf(buf, sizeof(buf), "%02X%02X%02X%02X", p[0], p[1], p[2], p[3]);
    out.kekka = buf;
    out.le = u16(894);
    out.se = u16(896);
    out.ir_adictive = u16(898);
    out.g_adictive = u16(890);
    out.binary_adictive = u16(892);
    out.speed = u16(4438);
    return out;
}

std::vector<OnebyteImage> build_onebyte_images(const std::vector<uint8_t>& global_onedat) {
    std::vector<OnebyteImage> images;
    if (global_onedat.size() != GLOBAL_ONEDAT_SIZE) return images;
    // WAVE_TO_IMG: k -> img_name（按 k=0..12 顺序）
    static const char* kImgName[WAVE_COUNT] = {
        "Img1", "Img20", "Img21", "Img22", "Img2", "Img3", "Img4",
        "Img5", "Img6", "Img16", "Img17", "Img18", "Img19"
    };
    for (int k = 0; k < WAVE_COUNT; ++k) {
        const int base = (ONESIZE + SIZE_NON_GBVX) * k;
        OnebyteImage img;
        img.name = kImgName[k];
        img.data = std::vector<uint8_t>(global_onedat.data() + base,
                                        global_onedat.data() + base + ONESIZE);
        images.push_back(std::move(img));
    }
    return images;
}

}  // namespace singan2
