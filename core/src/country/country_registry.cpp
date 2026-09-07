// 国家分派注册表（复刻 OLD ALL32.CPP :395-474 的 switch(global_SelectCountry)）。
// 新增国家两步：① countries/ 下新建 xxx.cpp 实现 void xxx_(CountryCtx&)
//              ② 本文件 include + switch 加一个 case + CMakeLists 加一行。
#include "singan2/country_context.h"

namespace singan2 {

void run_country(int ccode, CountryCtx& ctx) {
    switch (ccode) {
        case CCODE_EURO:          euro_(ctx);         break;  // Euro.cpp
        case CCODE_USA:           usa_(ctx);          break;  // USA.cpp
        case CCODE_CHINA:         china_(ctx);        break;  // Chia.cpp（OLD 文件名即 Chia）
        case CCODE_HONGKONG:      hongkong_(ctx);     break;  // HongKong.cpp
        case CCODE_SINGAPOLE:     singa_(ctx);        break;  // Singa.cpp
        case CCODE_SWISS:         swiss_(ctx);        break;  // Swiss.cpp
        case CCODE_MALAYSIA:      malaysia_(ctx);     break;  // Malaysia.cpp
        case CCODE_THAILAND:      thai_(ctx);         break;  // Thai.cpp
        case CCODE_TAIWAN:        taiwan_(ctx);       break;  // Taiwan.cpp
        case CCODE_INDNESIA:      indonesia_(ctx);    break;  // Indonesia.cpp
        case CCODE_ENGLAND:       england_(ctx);      break;  // England.cpp
        case CCODE_RUSSIA:        russia_(ctx);       break;  // Russia.cpp
        case CCODE_TURKEY:        turkey_(ctx);       break;  // Turkey.cpp
        case CCODE_POLAND:        poland_(ctx);       break;  // Poland.cpp
        case CCODE_SAUDI_ARABIA:  saudi_arabia_(ctx); break;  // SaudiArabia.cpp
        case CCODE_SOUTH_AFRICA:  south_africa_(ctx); break;  // SouthAfrica.cpp
        case CCODE_CZECH:         czech_(ctx);        break;  // Czech.cpp
        case CCODE_CANADA:        canada_(ctx);       break;  // Canada.cpp
        default:                  etc_(ctx);          break;  // Etc.cpp（None 及未分派国家）
    }
}

}  // namespace singan2
