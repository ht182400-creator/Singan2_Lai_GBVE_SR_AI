// Malaysia（マレーシア）专用处理 —— 1:1 复刻 OLD Malaysia.cpp（S2[17..21]/S2[26]）
#include "singan2/country_context.h"

namespace singan2 {

void malaysia_(CountryCtx& ctx) {
    C_SI2& c_si2 = *ctx.csi2;

    // ---- 全息（ホログラム）----
    {
        if (ctx.zname("Horo", "RightX") && ctx.zname("Horo", "RightY")) {
            ctx.to_2byte();
            (*ctx.s2)[17] = static_cast<unsigned short>(c_si2.horo2(
                ctx.zname("Horo", "LeftX"), ctx.zname("Horo", "LeftY"),
                ctx.zname("Horo", "RightX"), ctx.zname("Horo", "RightY"),
                to_i64(ctx.img(1))));
        } else {
            (*ctx.s2)[17] = static_cast<unsigned short>(
                c_si2.horo2(0, 0, 20, 20, to_i64(ctx.img(1))));
        }
    }
    // ---- ひげ（胡须，etc1 区域 Img1/Img3 和）----
    {
        uint32_t a = 0, c = 0;
        ctx.to_2byte();
        {
            const auto& img1 = ctx.img(1);
            const auto& img3 = ctx.img(3);
            const int ly = ctx.zname("etc1", "LeftY");
            const int ry = ctx.zname("etc1", "RightY");
            const int lx = ctx.zname("etc1", "LeftX");
            const int rx = ctx.zname("etc1", "RightX");
            for (int i = 0, ii = 0; i < Y_SIZE; i++) {
                for (int j = 0; j < X_SIZE; j++, ii++) {
                    if (i >= ly && i < ry && j >= lx && j < rx) {
                        a += img1[ii];
                        c += img3[ii];
                    }
                }
            }
        }
        if (a > 65535) a = 65535;
        if (c > 65535) c = 65535;
        a >>= 2; a <<= 2;  // 削除下位 2 位
        c >>= 2; c <<= 2;
        (*ctx.s2)[19] = static_cast<unsigned short>(a);
        (*ctx.s2)[20] = static_cast<unsigned short>(c);
    }
    // ---- Malaysia 专用：S2[18] = S2[15]*50 + S2[13] ----
    {
        (*ctx.s2)[18] = (*ctx.s2)[15] * 50 + (*ctx.s2)[13];
    }
    // ---- Function 21: etc3 色差强调（(IR-G)^2/8 图像 Img12）----
    {
        long ct;
        if (ctx.zname("etc3", "RightX") && ctx.zname("etc3", "RightY")) {
            ctx.to_2byte();
            ctx.tab(11);
            ct = c_si2.average_concentration2(
                ctx.zname("etc3", "LeftX"), ctx.zname("etc3", "LeftY"),
                ctx.zname("etc3", "RightX"), ctx.zname("etc3", "RightY"),
                to_i64(ctx.img(12)), 1);
            ct >>= 2;
            if (ct > 65535) ct = 65535;
        } else {
            ct = 0;
        }
        (*ctx.s2)[21] = static_cast<unsigned short>(ct);
    }
    // ---- Function 26: etc8 色差强调（金种判定用辅助函数）----
    {
        long ct;
        if (ctx.zname("etc8", "RightX") && ctx.zname("etc8", "RightY")) {
            ctx.to_2byte();
            ctx.tab(11);
            ct = c_si2.average_concentration2(
                ctx.zname("etc8", "LeftX"), ctx.zname("etc8", "LeftY"),
                ctx.zname("etc8", "RightX"), ctx.zname("etc8", "RightY"),
                to_i64(ctx.img(12)), 1);
            ct >>= 2;
            if (ct > 65535) ct = 65535;
        } else {
            ct = 0;
        }
        (*ctx.s2)[26] = static_cast<unsigned short>(ct);
    }
}

}  // namespace singan2
