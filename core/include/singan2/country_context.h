#pragma once
#include <cstdint>
#include <vector>
#include "singan2/types.h"
#include "singan2/imageops.h"
#include "singan2/zahyo_param.h"
#include "singan2/c_si2.h"

// 国家专用函数框架（复刻 OLD ALL32.CPP switch(global_SelectCountry) 分派的
// Euro_/USA_/HongKong_/Russia_... 各国 cpp，一国一文件，见 countries/ 目录）。
//
// OLD 语义对照（1:1 复刻约定，移植时逐行对应）：
//   global_twoimg.ImgN   → ctx.img(N-1)                     （Img1=tab0, Img2=tab1, Img7=tab6, Img8=tab7, Img12=tab11）
//   To2byte()            → ctx.to_2byte()
//   global_TabNo = k     → ctx.tab(k)
//   Gradient(Sobel_, 1)  → ctx.gradient_sobel()
//   Gradient(Normal_,16) → ctx.gradient_normal16()          （gtype: 0=Sobel,1=Roberts,2=Normal）
//   NITI(th)             → ctx.niti(th)
//   global_Zparam.X[KIN] → ctx.zname("X", "LeftX")          （= zp->at("X","LeftX",kin)）
//   global_Zparam.X_niti_threshold[1][KIN] → ctx.zname("X","niti_threshold1")
//   global_img_stock     → ctx.img_stock
//   S2[i] / global_etc[j] / DEN[i] → (*ctx.s2)[i] / (*ctx.etc)[j] / (*ctx.den)[i]
namespace singan2 {

// CCODE（复刻 OLD MAIN.H :31-66）
enum CCode : int {
    CCODE_NONE = 0, CCODE_EURO = 1, CCODE_USA = 2, CCODE_CHINA = 3,
    CCODE_HONGKONG = 4, CCODE_SINGAPOLE = 5, CCODE_SWISS = 6, CCODE_MALAYSIA = 7,
    CCODE_THAILAND = 8, CCODE_TAIWAN = 9, CCODE_INDNESIA = 10, CCODE_ENGLAND = 11,
    CCODE_JORDAN = 12, CCODE_JAPAN = 13, CCODE_EGYPT = 14, CCODE_RUSSIA = 15,
    CCODE_TURKEY = 16, CCODE_POLAND = 17, CCODE_SAUDI_ARABIA = 18,
    CCODE_SOUTH_AFRICA = 19, CCODE_MEXICO = 20, CCODE_AUSTRALIA = 21,
    CCODE_NEW_ZEALAND = 22, CCODE_CZECH = 23, CCODE_CANADA = 24, CCODE_QATAR = 25,
    CCODE_KUWAIT = 26, CCODE_OMAN = 27, CCODE_PHILIPPINES = 28, CCODE_IRAN = 29,
    CCODE_UAE = 30, CCODE_FOR_BV_CHECK = 31, CCODE_NORWAY = 36, CCODE_CHILI = 37,
};

struct CountryCtx {
    ImageEngine* eng = nullptr;
    const ZAHYO_PARAM* zp = nullptr;
    int kin = 1;
    int country = 0;
    const std::vector<uint8_t>* small = nullptr;
    std::vector<int>* s2 = nullptr;                 // S2[0..32]
    std::vector<int>* etc = nullptr;                // global_etc[0..14]
    std::vector<int>* den = nullptr;                // DEN[0..51]（HK/RU/SA 写；可 nullptr）
    C_SI2* csi2 = nullptr;
    bool img_stock = false;                         // global_img_stock

    // ---- OLD 语义辅助 ----
    void to_2byte() { eng->to_2byte(); }
    void gradient_sobel() { eng->gradient(0, 1); }
    void gradient_normal16() { eng->gradient(2, 16); }
    void niti(int th) { eng->niti(th); }
    void tab(int n) { eng->tab_no = n; }
    const std::vector<uint16_t>& img(int tab1based) { return eng->twoimg_at(tab1based - 1); }

    // global_Zparam.Section_Field[KIN]
    int zname(const std::string& section, const std::string& field) const {
        return zp->at(section, field, kin);
    }
};

// uint16 波段 → int64（与 all32.cpp 同款转换，供 C_SI2 函数使用）
inline std::vector<int64_t> to_i64(const std::vector<uint16_t>& v) {
    return std::vector<int64_t>(v.begin(), v.end());
}

// 各国家函数（countries/ 下实现，函数名与 OLD 一致小写）
void euro_(CountryCtx& ctx);
void usa_(CountryCtx& ctx);
void china_(CountryCtx& ctx);
void hongkong_(CountryCtx& ctx);
void singa_(CountryCtx& ctx);
void swiss_(CountryCtx& ctx);
void malaysia_(CountryCtx& ctx);
void thai_(CountryCtx& ctx);
void taiwan_(CountryCtx& ctx);
void indonesia_(CountryCtx& ctx);
void england_(CountryCtx& ctx);
void russia_(CountryCtx& ctx);
void turkey_(CountryCtx& ctx);
void poland_(CountryCtx& ctx);
void saudi_arabia_(CountryCtx& ctx);
void south_africa_(CountryCtx& ctx);
void czech_(CountryCtx& ctx);
void canada_(CountryCtx& ctx);
void etc_(CountryCtx& ctx);

// 分派入口（复刻 ALL32 的 switch；无 case 的国家 → etc_）
void run_country(int ccode, CountryCtx& ctx);

}  // namespace singan2
