#pragma once
#include <cstdint>
#include <vector>
#include <string>
#include "singan2/types.h"
#include "singan2/imageops.h"
#include "singan2/zahyo_param.h"

// SINGAN2 真券判定2计算类（复刻 c_si2.py / C_SI2.CPP）
namespace singan2 {

class C_SI2 {
public:
    const ImageEngine* eng = nullptr;
    const ZAHYO_PARAM* zp = nullptr;
    int kin = 1;
    bool ztype = false;
    std::vector<uint8_t> small_image;
    std::vector<int>* s2 = nullptr;  // 指向 All32Engine::s2(供 soil_soil)

    C_SI2(const ImageEngine* engine, const ZAHYO_PARAM* zparam, int kin_ = 1, bool ztype_ = false,
          const std::vector<uint8_t>* small = nullptr);

    // 区域统计(图像以 int64 一维向量传入，ONESIZE 长)
    int average_concentration2(int x, int y, int xx, int yy, const std::vector<int64_t>& img, int itype);
    int monochrome_ratio2(int x, int y, int xx, int yy, const std::vector<int64_t>& img);
    int Rinsetu2(int x, int y, int xx, int yy, const std::vector<int64_t>& img);
    int RINSETU(int x, int y, int xx, int yy, const std::vector<int64_t>& img);
    int sikisa();
    int Suka_Kyotyo(int x, int y, int xx, int yy, const std::vector<int64_t>& img);
    int Siki_Kyotyo(int x, int y, int xx, int yy, const std::vector<int64_t>& img);
    int infrared_white_ratio2(int x, int y, int xx, int yy, const std::vector<int64_t>& img);
    int img_datecount(int x, int y, int xx, int yy, int minv, int maxv,
                      const std::vector<int64_t>& img, int itype);
    int soil_(int x, int y, int xx, int yy, const std::vector<int64_t>& img);
    int soil2_(int x, int y, int xx, int yy, const std::vector<int64_t>& img);
    int soil_soil();

private:
    // 模拟 C++ 区域条件 i>y_lo && i<y_hi && j>x_lo && j<x_hi，返回闭区间 [i0,i1]x[j0,j1]
    static bool bounds(int y_lo, int y_hi, int x_lo, int x_hi,
                       int& i0, int& i1, int& j0, int& j1);
    bool z_wariai(int x, int y, int xx, int yy, int& xo, int& yo, int& xxo, int& yyo) const;
    void adjust(int x, int y, int xx, int yy, int& xo, int& yo, int& xxo, int& yyo) const;
};

}  // namespace singan2
