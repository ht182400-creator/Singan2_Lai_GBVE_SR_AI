// all32.cpp — All32Engine 实现，复刻 all32.py run()
#include "singan2/all32.h"
#include "singan2/country_context.h"

#include <algorithm>
#include <stdexcept>

namespace singan2 {

All32Engine::All32Engine(ImageEngine* engine, const ZAHYO_PARAM* zparam, int kin_, bool ztype_,
                         const std::vector<uint8_t>* small, int select_country,
                         std::vector<int>* den_accum)
    : eng(engine), zp(zparam), kin(kin_), ztype(ztype_), country(select_country),
      small(small), s2(33, 0), etc(15, 0), den(52, 0), den_accum(den_accum),
      csi2_(engine, zparam, kin_, ztype_, small) {
    csi2_.s2 = &s2;
}

int All32Engine::zname(const std::string& prefix, const std::string& field) const {
    std::string f = field;
    if (ztype) {
        if (f == "LeftX" || f == "RightX")
            f = (f == "LeftX") ? "LeftY" : "RightY";
        else if (f == "LeftY" || f == "RightY")
            f = (f == "LeftY") ? "LeftX" : "RightX";
    }
    return zp->at(prefix, f, kin);
}

void All32Engine::run() {
    ImageEngine* eng = this->eng;

    // 段1 梯度なし・二値化なし
    s2[12] = csi2_.sikisa() & 0xffff;

    s2[1] = csi2_.Rinsetu2(
        zname("old_sukasi", "LeftX"), zname("old_sukasi", "LeftY"),
        zname("old_sukasi", "RightX"), zname("old_sukasi", "RightY"),
        to_i64(eng->twoimg_at(1)));  // Img2

    int xx = zname("Yogore", "RightX");
    int yy = zname("Yogore", "RightY");
    int yogore;
    if (xx && yy) {
        yogore = csi2_.soil_(zname("Yogore", "LeftX"), zname("Yogore", "LeftY"), xx, yy,
                             to_i64(eng->twoimg_at(2)));  // Img3
    } else {
        yogore = csi2_.soil_(0, 0, 20, 20, to_i64(eng->twoimg_at(0)));  // Img1
    }
    etc[10] = (yogore >> 2) & 0xffff;
    etc[10] = 0xffff - etc[10];

    // 段2 赤外と緑の差分
    int sa = csi2_.average_concentration2(
        zname("old_sukasi", "LeftX"), zname("old_sukasi", "LeftY"),
        zname("old_sukasi", "RightX"), zname("old_sukasi", "RightY"),
        to_i64(eng->twoimg_at(0)), 2);  // Img1, type=2
    sa *= -1;
    if (sa < 0)
        s2[2] = 1;
    else
        s2[2] = sa & 0xffff;

    // 段3 梯度 Sobel amp1
    eng->tab_no = 0;
    eng->gradient(0, 1);
    std::vector<int64_t> img1 = to_i64(eng->twoimg_at(0));
    eng->tab_no = 1;
    eng->gradient(0, 1);
    std::vector<int64_t> img2 = to_i64(eng->twoimg_at(1));

    if (zname("Sukasi1", "RightX") && zname("Sukasi1", "RightY")) {
        int ct = csi2_.average_concentration2(
            zname("Sukasi1", "LeftX"), zname("Sukasi1", "LeftY"),
            zname("Sukasi1", "RightX"), zname("Sukasi1", "RightY"), img1, 0);
        ct >>= 2;
        if (ct > 65535) ct = 65535;
        s2[5] = ct & 0xffff;
        ct = csi2_.average_concentration2(
            zname("Sukasi1", "LeftX"), zname("Sukasi1", "LeftY"),
            zname("Sukasi1", "RightX"), zname("Sukasi1", "RightY"), img2, 0);
        ct >>= 2;
        s2[7] = ct & 0xffff;  // 复刻 poc：此处无 >65535 检查
    } else {
        s2[5] = 0;
        s2[7] = 0;
    }

    if (zname("Thred", "RightX") && zname("Thred", "RightY")) {
        int ct = csi2_.average_concentration2(
            zname("Thred", "LeftX"), zname("Thred", "LeftY"),
            zname("Thred", "RightX"), zname("Thred", "RightY"), img1, 0);
        ct >>= 2;
        if (ct > 65535) ct = 65355;  // 复刻 poc 笔误(65535)
        s2[13] = ct & 0xffff;
    } else {
        s2[13] = 0;
    }

    // 段4 梯度 + 二値化 NITI
    eng->to_2byte();
    eng->tab_no = 0;
    eng->gradient(0, 1);
    eng->tab_no = 1;
    eng->gradient(0, 1);
    eng->tab_no = 0;
    eng->niti(zname("Sukasi1", "niti_1"));
    eng->tab_no = 1;
    eng->niti(zname("Sukasi1", "niti_2"));
    if (zname("Sukasi1", "RightX") && zname("Sukasi1", "RightY")) {
        s2[6] = csi2_.monochrome_ratio2(
            zname("Sukasi1", "LeftX"), zname("Sukasi1", "LeftY"),
            zname("Sukasi1", "RightX"), zname("Sukasi1", "RightY"),
            to_i64(eng->twoimg_at(0)));
        s2[8] = csi2_.monochrome_ratio2(
            zname("Sukasi1", "LeftX"), zname("Sukasi1", "LeftY"),
            zname("Sukasi1", "RightX"), zname("Sukasi1", "RightY"),
            to_i64(eng->twoimg_at(1)));
    } else {
        s2[6] = 0;
        s2[8] = 0;
    }

    // 段5 無梯度・二値化 赤外白率
    eng->to_2byte();
    eng->tab_no = 0;
    eng->niti(zname("Sekigai1", "niti_1"));
    s2[14] = csi2_.infrared_white_ratio2(
        zname("Sekigai1", "LeftX"), zname("Sekigai1", "LeftY"),
        zname("Sekigai1", "RightX"), zname("Sekigai1", "RightY"),
        to_i64(eng->twoimg_at(0)));
    eng->to_2byte();
    eng->tab_no = 0;
    eng->niti(zname("Sekigai2", "niti_1"));
    s2[15] = csi2_.infrared_white_ratio2(
        zname("Sekigai2", "LeftX"), zname("Sekigai2", "LeftY"),
        zname("Sekigai2", "RightX"), zname("Sekigai2", "RightY"),
        to_i64(eng->twoimg_at(0)));
    eng->to_2byte();
    eng->tab_no = 0;
    eng->niti(zname("Sekigai3", "niti_1"));
    s2[16] = csi2_.infrared_white_ratio2(
        zname("Sekigai3", "LeftX"), zname("Sekigai3", "LeftY"),
        zname("Sekigai3", "RightX"), zname("Sekigai3", "RightY"),
        to_i64(eng->twoimg_at(0)));

    // 段6 既存すかし 20x20 Gradient Normal amp16
    eng->to_2byte();
    eng->tab_no = 0;
    eng->gradient(2, 16);
    eng->tab_no = 1;
    eng->gradient(2, 16);
    if (zname("old_sukasi", "RightX") && zname("old_sukasi", "RightY")) {
        int ct = csi2_.average_concentration2(
            zname("old_sukasi", "LeftX"), zname("old_sukasi", "LeftY"),
            zname("old_sukasi", "RightX"), zname("old_sukasi", "RightY"),
            to_i64(eng->twoimg_at(0)), 0);
        if (ct > 65535) ct = 65535;
        if (ct < 0) ct = 0;
        s2[3] = ct & 0xffff;
        ct = csi2_.average_concentration2(
            zname("old_sukasi", "LeftX"), zname("old_sukasi", "LeftY"),
            zname("old_sukasi", "RightX"), zname("old_sukasi", "RightY"),
            to_i64(eng->twoimg_at(1)), 0);
        if (ct > 65535) ct = 65535;
        if (ct < 0) ct = 0;
        s2[4] = ct & 0xffff;
    } else {
        s2[3] = 0;
        s2[4] = 0;
    }

    // 段7 隣接微分 RINSETU
    eng->to_2byte();
    {
        int ct = csi2_.RINSETU(
            zname("Sukasi1", "LeftX"), zname("Sukasi1", "LeftY"),
            zname("Sukasi1", "RightX"), zname("Sukasi1", "RightY"),
            to_i64(eng->twoimg_at(0)));
        if (ct > 65535) ct = 65535;
        s2[9] = ct & 0xffff;
    }

    // 段8 すかし強調
    eng->to_2byte();
    eng->tab_no = 6;
    eng->gradient(0, 1);
    {
        int ct = csi2_.Suka_Kyotyo(
            zname("Sukasi1", "LeftX"), zname("Sukasi1", "LeftY"),
            zname("Sukasi1", "RightX"), zname("Sukasi1", "RightY"),
            to_i64(eng->twoimg_at(6)));
        if (ct > 65535) ct = 65535;
        s2[10] = ct & 0xffff;
    }

    // 段9 色差強調 smooth + Gradient Sobel
    eng->to_2byte();
    eng->tab_no = 11;
    eng->smooth();
    eng->gradient(0, 1);
    {
        int ct = csi2_.Siki_Kyotyo(
            zname("Sukasi1", "LeftX"), zname("Sukasi1", "LeftY"),
            zname("Sukasi1", "RightX"), zname("Sukasi1", "RightY"),
            to_i64(eng->twoimg_at(11)));
        if (ct > 65535) ct = 65535;
        s2[11] = ct & 0xffff;
    }

    // S2[17..32] 国家专用（复刻 OLD ALL32 switch(global_SelectCountry) → 各国 cpp）
    {
        CountryCtx cctx;
        cctx.eng = eng;
        cctx.zp = zp;
        cctx.kin = kin;
        cctx.country = country;
        cctx.small = small;
        cctx.s2 = &s2;
        cctx.etc = &etc;
        cctx.den = &den;
        cctx.csi2 = &csi2_;
        run_country(country, cctx);
    }

    etc[11] = csi2_.soil_soil() & 0xffff;
}

}  // namespace singan2
