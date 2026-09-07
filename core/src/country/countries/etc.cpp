// Etc（その他/default）专用处理 —— 1:1 复刻 OLD Etc.cpp::Etc_
// 活跃部分：S2[17](horo4)/S2[18](etc5)/S2[19](etc1)/S2[20](etc2)；S2[30..32]/S2[28] 段在 OLD 中被注释。
// OLD 尾部的自由函数 Sum_H（补偿值加算）仅被注释代码调用，活跃路径不涉及，故不移植。
#include "singan2/country_context.h"

namespace singan2 {

void etc_(CountryCtx& ctx) {
    C_SI2& c_si2 = *ctx.csi2;
    long ct;

    // ---- Function 17: 全息（horo4，下限=niti_threshold、上限=bibun_threshold）----
    {
        ctx.to_2byte();
        if (ctx.zname("Horo", "RightX") && ctx.zname("Horo", "RightY")) {
            (*ctx.s2)[17] = static_cast<unsigned short>(c_si2.horo4(
                ctx.zname("Horo", "LeftX"), ctx.zname("Horo", "LeftY"),
                ctx.zname("Horo", "RightX"), ctx.zname("Horo", "RightY"),
                to_i64(ctx.img(1)),
                ctx.zname("Horo", "niti_threshold1"),
                ctx.zname("Horo", "bibun_threshold1")));
        } else {
            (*ctx.s2)[17] = 0;
        }
    }
    // ---- Function 18: etc5 红外强调（Img7@tab6 全加算/4）----
    {
        ctx.to_2byte();
        if (ctx.zname("etc5", "RightX") && ctx.zname("etc5", "RightY")) {
            ctx.to_2byte();
            ctx.tab(6);
            ct = c_si2.average_concentration2(
                ctx.zname("etc5", "LeftX"), ctx.zname("etc5", "LeftY"),
                ctx.zname("etc5", "RightX"), ctx.zname("etc5", "RightY"),
                to_i64(ctx.img(7)), 1);
            ct >>= 2;
            if (ct > 65535) ct = 65535;
        } else {
            ct = 0;
        }
        (*ctx.s2)[18] = static_cast<unsigned short>(ct);
    }
    // ---- Function 19: etc1 梯度+二值化后白比率 ----
    {
        ctx.to_2byte();
        ctx.tab(0);
        ctx.gradient_sobel();
        ctx.img_stock = true;
        ctx.niti(ctx.zname("etc1", "niti_threshold1"));
        ctx.img_stock = false;
        if (ctx.zname("etc1", "RightY") && ctx.zname("etc1", "RightX")) {
            ct = static_cast<long>(c_si2.monochrome_ratio2(
                ctx.zname("etc1", "LeftX"), ctx.zname("etc1", "LeftY"),
                ctx.zname("etc1", "RightX"), ctx.zname("etc1", "RightY"),
                to_i64(ctx.img(1))));
        } else {
            ct = 0;
        }
        (*ctx.s2)[19] = static_cast<unsigned short>(ct);
    }
    // ---- Function 20: etc2 色差强调（Img12@tab11）----
    {
        if (ctx.zname("etc2", "RightX") && ctx.zname("etc2", "RightY")) {
            ctx.to_2byte();
            ctx.tab(11);
            ct = c_si2.average_concentration2(
                ctx.zname("etc2", "LeftX"), ctx.zname("etc2", "LeftY"),
                ctx.zname("etc2", "RightX"), ctx.zname("etc2", "RightY"),
                to_i64(ctx.img(12)), 1);
            ct >>= 2;
            if (ct > 65535) ct = 65535;
        } else {
            ct = 0;
        }
        (*ctx.s2)[20] = static_cast<unsigned short>(ct);
    }
    // ---- 以下（S2[30]/[31]/[32]/[28] Sum_H 补正）在 OLD 中被 /* */ 注释，1:1 保持不实现 ----
}

}  // namespace singan2
