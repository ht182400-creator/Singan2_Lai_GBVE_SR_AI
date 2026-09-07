// Taiwan（台湾）专用处理 —— 1:1 复刻 OLD Taiwan.cpp（S2[17]/S2[19]/S2[20]，其余预留 0）
#include "singan2/country_context.h"

namespace singan2 {

void taiwan_(CountryCtx& ctx) {
    C_SI2& c_si2 = *ctx.csi2;
    unsigned short ct;

    // ---- Function 17: 全息 ----
    {
        ctx.to_2byte();
        if (ctx.zname("Horo", "RightX") && ctx.zname("Horo", "RightY")) {
            (*ctx.s2)[17] = static_cast<unsigned short>(c_si2.horo2(
                ctx.zname("Horo", "LeftX"), ctx.zname("Horo", "LeftY"),
                ctx.zname("Horo", "RightX"), ctx.zname("Horo", "RightY"),
                to_i64(ctx.img(1))));
        } else {
            (*ctx.s2)[17] = 0;
        }
    }
    // ---- Function 18: 预备 ----
    {
        (*ctx.s2)[18] = 0;
    }
    // ---- Function 20: etc1 梯度后取白比率 ----
    {
        ctx.to_2byte();
        ctx.tab(0);
        ctx.gradient_sobel();
        ctx.img_stock = true;
        ctx.niti(ctx.zname("etc1", "niti_threshold1"));
        ctx.img_stock = false;
        if (ctx.zname("etc1", "RightY") && ctx.zname("etc1", "RightX")) {
            ct = static_cast<unsigned short>(c_si2.monochrome_ratio2(
                ctx.zname("etc1", "LeftX"), ctx.zname("etc1", "LeftY"),
                ctx.zname("etc1", "RightX"), ctx.zname("etc1", "RightY"),
                to_i64(ctx.img(1))));
        } else {
            ct = 0;
        }
        (*ctx.s2)[19] = ct;
    }
    // ---- Function 20: etc2 梯度后取白比率 ----
    {
        ctx.to_2byte();
        ctx.tab(0);
        ctx.gradient_sobel();
        ctx.img_stock = true;
        ctx.niti(ctx.zname("etc2", "niti_threshold1"));
        ctx.img_stock = false;
        if (ctx.zname("etc2", "RightY") && ctx.zname("etc2", "RightX")) {
            ct = static_cast<unsigned short>(c_si2.monochrome_ratio2(
                ctx.zname("etc2", "LeftX"), ctx.zname("etc2", "LeftY"),
                ctx.zname("etc2", "RightX"), ctx.zname("etc2", "RightY"),
                to_i64(ctx.img(1))));
        } else {
            ct = 0;
        }
        (*ctx.s2)[20] = ct;
    }
    // ---- Function 21-32: 预备 ----
    for (int i = 21; i <= 32; i++) (*ctx.s2)[i] = 0;
}

}  // namespace singan2
