// algo.cpp — M2 顶层入口，复刻 run_algo_poc.py 主流程
#include "singan2/algo.h"

#include <stdexcept>
#include "singan2/mariner_reader.h"
#include "singan2/zahyo_param.h"
#include "singan2/wtable.h"
#include "singan2/imageops.h"
#include "singan2/all32.h"

namespace singan2 {

void run_algorithm(const std::string& dat_path, int record,
                   const std::string& zfile_path, const std::string& wtable_path,
                   int kin, int country,
                   std::vector<int>& s2_out, std::vector<int>& etc_out) {
    // 1) 提取单面 213096 字节
    std::vector<uint8_t> onedat;
    try {
        onedat = extract_mm1_side(dat_path, record);
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("extract_mm1_side 失败: ") + e.what());
    }

    // 2) 构建 13 波段图像
    std::vector<OnebyteImage> images = build_onebyte_images(onedat);

    // 3) 提取 small 图像(8192 字节)
    std::vector<uint8_t> small = extract_small_image(dat_path, record);

    // 4) w_table（空路径 -> 理论表，与 poc 基准一致）
    WTable wt = wtable_path.empty() ? gen_w_table() : load_w_table(wtable_path);

    // 5) ImageEngine + 中间波段
    ImageEngine eng;
    eng.w_table = &wt;
    eng.set_oneimg(images);
    eng.compute_intermediate_waves();
    eng.to_2byte();

    // 6) 解析坐标文件
    ZAHYO_PARAM zp = parse_zahyo_param(zfile_path);

    // 7) ALL32 主流程
    All32Engine all(&eng, &zp, kin, false, &small, country);
    all.run();

    s2_out = std::move(all.s2);
    etc_out = std::move(all.etc);
}

}  // namespace singan2
