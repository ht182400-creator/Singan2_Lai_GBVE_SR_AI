#include "singan2/mariner_reader.h"

#include <algorithm>
#include <fstream>
#include <map>
#include <mutex>

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

// 整文件缓存：导航时反复读同一 .dat，缓存后切片近零开销。
// std::map 节点地址稳定且从不删除，返回的引用在解锁后仍然有效。
const std::vector<uint8_t>& load_file_cached(const std::string& path) {
    static std::mutex mu;
    static std::map<std::string, std::vector<uint8_t>> cache;
    std::lock_guard<std::mutex> lk(mu);
    const auto it = cache.find(path);
    if (it != cache.end()) return it->second;
    return cache.emplace(path, read_file(path)).first->second;
}

std::vector<BlockInfo> parse_blocks(const std::string& file_path) {
    return parse_blocks_data(load_file_cached(file_path));
}

std::vector<uint8_t> extract_mm1_side(const std::string& file_path, int record_index) {
    const std::vector<uint8_t>& data = load_file_cached(file_path);
    if (data.empty()) return {};

    // 单次扫描收集 MM1_Side(type=5) 块偏移
    std::vector<uint32_t> side_offsets;
    {
        const size_t n = data.size();
        const bool is_sru = (n >= 3 && data[0] == 'S' && data[1] == 'R' && data[2] == 'U');
        size_t offset = is_sru ? 3 : 0;
        while (offset + BLOCK_HEADER <= n) {
            const uint8_t* h = &data[offset];
            uint32_t data_size = static_cast<uint32_t>(h[0]) |
                                 (static_cast<uint32_t>(h[1]) << 8) |
                                 (static_cast<uint32_t>(h[2]) << 16) |
                                 (static_cast<uint32_t>(h[3]) << 24);
            if (h[4] == 5) side_offsets.push_back(static_cast<uint32_t>(offset));
            if (data_size == 0) break;
            offset += data_size;
        }
    }

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

std::vector<uint8_t> extract_small_image(const std::string& file_path, int record_index) {
    const std::vector<uint8_t>& data = load_file_cached(file_path);
    if (data.empty()) return {};

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
    if (offset + SMALL_SIZE > data.size()) return {};
    std::vector<uint8_t> seg(data.begin() + offset, data.begin() + offset + SMALL_SIZE);
    // memcpy(global_small_image, global_small_image+1024, SMALL_SIZE-1024)
    for (int i = 0; i < SMALL_SIZE - SMALL_SKIP; ++i) {
        seg[i] = seg[i + SMALL_SKIP];
    }
    return seg;
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
