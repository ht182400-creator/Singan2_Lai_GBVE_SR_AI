#pragma once
#include <cstdint>
#include <string>
#include <vector>
#include <tuple>
#include "singan2/types.h"

// SINGAN2 Mariner 数据文件(.dat)解析层
// 复刻原工程 CTemplateData::CheckFile 的块链遍历 + MainRun::ReadImgDataNew 的 MM1_Side 提取
// 不依赖任何 Win32 API，纯标准库
namespace singan2 {

// 块链遍历结果: (类型名, 类型ID, 数据大小, 数据偏移)
using BlockInfo = std::tuple<std::string, int, uint32_t, uint32_t>;
std::vector<BlockInfo> parse_blocks(const std::string& file_path);

// 整文件读取（带进程级缓存 + 线程安全）。同一 .dat 反复切片时近零开销。
const std::vector<uint8_t>& load_file_cached(const std::string& file_path);

// 提取第 record_index 枚的 MM1_Side 数据，拼成 global_onedat(GLOBAL_ONEDAT_SIZE 字节)
// 越界/失败时返回空 vector
std::vector<uint8_t> extract_mm1_side(const std::string& file_path, int record_index = 0);

// 提取指定枚的 global_small_image(SMALL_SIZE 字节)
std::vector<uint8_t> extract_small_image(const std::string& file_path, int record_index = 0);

// 单波段 8bit 图像
struct OnebyteImage {
    std::string name;             // 如 "Img1"
    std::vector<uint8_t> data;    // ONESIZE 字节
};

// 从 global_onedat 还原 13 个波段图像（按 WAVE_TO_IMG 映射）
std::vector<OnebyteImage> build_onebyte_images(const std::vector<uint8_t>& global_onedat);

}  // namespace singan2
