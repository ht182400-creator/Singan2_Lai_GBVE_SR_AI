#pragma once
#include <cstdint>
#include <map>
#include <string>
#include <vector>
#include "singan2/types.h"
#include "singan2/mariner_reader.h"
#include "singan2/wtable.h"

// SINGAN2 图像处理基础函数（复刻 imageops.py / GRADIENT.CPP / NITI.CPP / smooth_median.cpp / To2byte.cpp / bvmath.cpp）
// 不依赖任何 Win32 API，纯标准库
namespace singan2 {

class ImageEngine {
public:
    int tab_no = 0;                                  // 当前处理波段(global_TabNo)
    const WTable* w_table = nullptr;                 // 除法表(load/gen)
    std::map<std::string, std::vector<uint8_t>> oneimg;    // 1字节图像(ONESIZE)
    std::map<std::string, std::vector<uint16_t>> twoimg;   // 2字节图像(ONESIZE)

    // 数据准备
    void set_oneimg(const std::vector<OnebyteImage>& images);
    void to_2byte();                                  // oneimg.Img1..Img22 -> twoimg
    void compute_intermediate_waves(int red_offset = 128, int grn_offset = 128);  // 计算 Img7..Img15

    // 图像访问
    const std::vector<uint8_t>& oneimg_at(int tab) const;
    const std::vector<uint16_t>& twoimg_at(int tab) const;
    const std::vector<uint16_t>* twoimg_find(const std::string& name) const;
    const std::vector<uint8_t>* oneimg_find(const std::string& name) const;
    void to_2byte_orver_write(int tab, const std::vector<uint16_t>& img2byte);

    // 算子
    void gradient(int gtype, int amp);               // 0=Sobel,1=Roberts,2=Normal
    void laplacian(int amp);
    void prewitt(int amp);
    void niti(int s);
    void niblack(int s);
    void smooth();
    void median();
    void color(int offset);                          // 亮度偏移（对应 OLD step movement / global_color_point）

    // DSP 平方根（静态）
    static int rute(int u_bunsan, int left, int right, const WTable& wt);
    static int old_rute(int u_bunsan);
};

}  // namespace singan2
