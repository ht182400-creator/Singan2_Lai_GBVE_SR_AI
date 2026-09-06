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
// 缓存按字节上限做 LRU 淘汰（默认 2048MB，可用环境变量 SINGAN2_FILE_CACHE_MB 覆盖），
// 因此打开上千枚的大 .dat（如 1000 枚 ≈ 213MB/文件）也只需缓存文件本体一份。
const std::vector<uint8_t>& load_file_cached(const std::string& file_path);

// 文件缓存管理（供 server 的 /api/cache 端点使用）
size_t file_cache_bytes();            // 当前缓存占用字节
size_t file_cache_capacity();         // 容量上限字节
void   file_cache_set_capacity(size_t bytes);  // 调整容量上限（触发 LRU 收缩）
size_t file_cache_file_count();       // 缓存的文件数
void   file_cache_clear();            // 清空缓存

// 提取第 record_index 枚的 MM1_Side 数据，拼成 global_onedat(GLOBAL_ONEDAT_SIZE 字节)
// 越界/失败时返回空 vector
std::vector<uint8_t> extract_mm1_side(const std::string& file_path, int record_index = 0);

// 一次提取整文件某个波段（wave_name，如 "Img1".."Img22" 中已落盘的原始 13 波段）的全部 record 像素，
// 拼成 record_count * ONESIZE 的扁平缓冲（record r 的像素位于 [r*ONESIZE, (r+1)*ONESIZE)）。
// 供网页「整通道一次载入、逐帧秒切」使用（对应 OLD 文件常驻内存 + 指针直取，翻帧零磁盘/零网络）。
// 越界 / 不支持的波段名返回空 vector。
std::vector<uint8_t> extract_wave_all(const std::string& file_path, const std::string& wave_name);

// 提取指定枚的 global_small_image(SMALL_SIZE 字节)
// 行为 = OLD MainRun :826 fread + :848 去头左移 1024B（前 7168B 左移，尾 1024B 保留原始残留）。
// Ren.cpp DspOverWrite 的 s_img_stock 行源即此去头后 buffer（SM_dsp.dat 行内偏移
// 2096/2144/2184/2224/2352 均相对去头数据）。
std::vector<uint8_t> extract_small_image(const std::string& file_path, int record_index = 0);

// 按 OLD/MainRun.cpp 第 833-843 行原版偏移，从原始(去头前)小图段解析 Validation Result 字段
struct SmallImageValidation {
  std::string han;             // [4220..4223]  %X%X%X%X
  std::string kekka;           // [0..3]        %02X%02X%02X%02X
  int le = 0, se = 0;          // [894..895] / [896..897]
  int ir_adictive = 0;         // [898..899]
  int g_adictive = 0;          // [890..891]
  int binary_adictive = 0;     // [892..893]
  int speed = 0;               // [4438..4439]
};
SmallImageValidation extract_small_image_validation(const std::string& file_path, int record_index = 0);

// 单波段 8bit 图像
struct OnebyteImage {
    std::string name;             // 如 "Img1"
    std::vector<uint8_t> data;    // ONESIZE 字节
};

// 从 global_onedat 还原 13 个波段图像（按 WAVE_TO_IMG 映射）
std::vector<OnebyteImage> build_onebyte_images(const std::vector<uint8_t>& global_onedat);

}  // namespace singan2
