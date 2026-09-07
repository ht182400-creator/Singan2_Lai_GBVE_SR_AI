// Euro（ユーロ）专用处理 —— 1:1 复刻 OLD Euro.cpp（S2[17..28]）
#include "singan2/country_context.h"

namespace singan2 {

void euro_(CountryCtx& ctx) {
    C_SI2& c_si2 = *ctx.csi2;
    long cc = 0;

    // ---- 全息（ホログラム）----
    {
        ctx.to_2byte();
        (*ctx.s2)[17] = static_cast<unsigned short>(c_si2.horo2(
            ctx.zname("Horo", "LeftX"), ctx.zname("Horo", "LeftY"),
            ctx.zname("Horo", "RightX"), ctx.zname("Horo", "RightY"),
            to_i64(ctx.img(1))));
    }
    // ---- 波形红外浓度 ----
    {
        ctx.tab(0);
        ctx.gradient_sobel();
        cc = c_si2.average_concentration2(
            ctx.zname("Sukasi2", "LeftX"), ctx.zname("Sukasi2", "LeftY"),
            ctx.zname("Sukasi2", "RightX"), ctx.zname("Sukasi2", "RightY"),
            to_i64(ctx.img(1)), 0);
        cc >>= 2;
        if (cc > 65535) cc = 65535;
        (*ctx.s2)[18] = static_cast<unsigned short>(cc);
    }
    // ---- 波形红外白比率 ----
    {
        ctx.tab(0);
        ctx.img_stock = true;  // OLD: global_img_stock = TRUE（ロック）
        ctx.niti(ctx.zname("Sukasi2", "niti_threshold1"));
        ctx.img_stock = false;
        (*ctx.s2)[19] = static_cast<unsigned short>(c_si2.monochrome_ratio2(
            ctx.zname("Sukasi2", "LeftX"), ctx.zname("Sukasi2", "LeftY"),
            ctx.zname("Sukasi2", "RightX"), ctx.zname("Sukasi2", "RightY"),
            to_i64(ctx.img(1))));
    }
    // ---- 波形红外分散 ----
    {
        ctx.to_2byte();
        ctx.gradient_sobel();
        cc = c_si2.distribution2(
            ctx.zname("Sukasi2", "LeftX"), ctx.zname("Sukasi2", "LeftY"),
            ctx.zname("Sukasi2", "RightX"), ctx.zname("Sukasi2", "RightY"),
            to_i64(ctx.img(1)), (*ctx.s2)[18],
            ctx.zname("Sukasi2", "gasosu"), 0);
        if (cc > 65535) cc = 65535;
        (*ctx.s2)[20] = static_cast<unsigned short>(cc);
    }
    // ---- 波形数（A-C+offset 图像 Img8）----
    {
        ctx.tab(7);
        ctx.gradient_sobel();
        ctx.img_stock = true;
        ctx.niti(ctx.zname("Sukasi2", "bibun_threshold1"));
        ctx.img_stock = true;  // OLD 原样：此处仍为 TRUE（:140）
        (*ctx.s2)[21] = static_cast<unsigned short>(
            c_si2.wave_type(0, 0, to_i64(ctx.img(8)), 2));  // 第一第二参数为 NULL
    }
    // ---- 线程绿透过浓度 ----
    {
        ctx.to_2byte();
        ctx.tab(1);
        ctx.gradient_sobel();
        cc = c_si2.average_concentration2(
            ctx.zname("Thred", "LeftX"), ctx.zname("Thred", "LeftY"),
            ctx.zname("Thred", "RightX"), ctx.zname("Thred", "RightY"),
            to_i64(ctx.img(2)), 0);
        cc >>= 2;
        if (cc > 65535) cc = 65535;
        (*ctx.s2)[22] = static_cast<unsigned short>(cc);
    }
    // ---- 绿反射<全面><左><右>：OLD 中 small_add 调用被注释，空块 ----
    {
    }
    // ---- 透射红外分散 ----
    {
        ctx.to_2byte();
        ctx.tab(0);
        ctx.gradient_sobel();
        cc = c_si2.distribution2(
            ctx.zname("Sukasi1", "LeftX"), ctx.zname("Sukasi1", "LeftY"),
            ctx.zname("Sukasi1", "RightX"), ctx.zname("Sukasi1", "RightY"),
            to_i64(ctx.img(1)), (*ctx.s2)[5],
            ctx.zname("Sukasi1", "gasosu"), 0);
        if (cc > 65535) cc = 65535;
        (*ctx.s2)[23] = static_cast<unsigned short>(cc);
    }
    // ---- 透射绿分散 ----
    {
        ctx.to_2byte();
        ctx.tab(1);
        ctx.gradient_sobel();
        cc = c_si2.distribution2(
            ctx.zname("Sukasi1", "LeftX"), ctx.zname("Sukasi1", "LeftY"),
            ctx.zname("Sukasi1", "RightX"), ctx.zname("Sukasi1", "RightY"),
            to_i64(ctx.img(2)), (*ctx.s2)[7],
            ctx.zname("Sukasi1", "gasosu"), 0);
        if (cc > 65535) cc = 65535;
        (*ctx.s2)[24] = static_cast<unsigned short>(cc);
    }
    // ---- 波形绿透过浓度 ----
    {
        ctx.to_2byte();
        ctx.tab(1);
        ctx.gradient_sobel();
        cc = c_si2.average_concentration2(
            ctx.zname("Sukasi2", "LeftX"), ctx.zname("Sukasi2", "LeftY"),
            ctx.zname("Sukasi2", "RightX"), ctx.zname("Sukasi2", "RightY"),
            to_i64(ctx.img(2)), 0);
        cc >>= 2;
        if (cc > 65535) cc = 65535;
        (*ctx.s2)[25] = static_cast<unsigned short>(cc);
    }
    // ---- 波形绿白比率 ----
    {
        ctx.to_2byte();
        ctx.tab(1);
        ctx.gradient_sobel();
        ctx.img_stock = true;
        ctx.niti(ctx.zname("Sukasi2", "niti_threshold2"));
        ctx.img_stock = false;
        (*ctx.s2)[26] = static_cast<unsigned short>(c_si2.monochrome_ratio2(
            ctx.zname("Sukasi2", "LeftX"), ctx.zname("Sukasi2", "LeftY"),
            ctx.zname("Sukasi2", "RightX"), ctx.zname("Sukasi2", "RightY"),
            to_i64(ctx.img(2))));
    }
    // ---- 波形绿透过分散 ----
    {
        ctx.to_2byte();
        ctx.tab(1);
        ctx.gradient_sobel();
        cc = c_si2.distribution2(
            ctx.zname("Sukasi2", "LeftX"), ctx.zname("Sukasi2", "LeftY"),
            ctx.zname("Sukasi2", "RightX"), ctx.zname("Sukasi2", "RightY"),
            to_i64(ctx.img(2)), (*ctx.s2)[25],
            ctx.zname("Sukasi2", "gasosu"), 0);
        if (cc > 65535) cc = 65535;
        (*ctx.s2)[27] = static_cast<unsigned short>(cc);
    }
    // ---- 波形数（B-C+offset 图像 Img9）----
    {
        ctx.to_2byte();
        ctx.tab(8);
        ctx.gradient_sobel();
        ctx.img_stock = true;
        ctx.niti(ctx.zname("Sukasi2", "bibun_threshold2"));
        ctx.img_stock = false;
        (*ctx.s2)[28] = static_cast<unsigned short>(
            c_si2.wave_type(0, 0, to_i64(ctx.img(9)), 2));
    }
}

}  // namespace singan2
