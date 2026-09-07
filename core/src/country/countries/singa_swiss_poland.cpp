// Singapore / Switzerland / Poland —— 1:1 复刻 OLD Singa.cpp / Swiss.cpp / Poland.cpp
// （三国均为极短实现；OLD 中 Poland 整个函数体被注释，1:1 保持空操作）
#include "singan2/country_context.h"

namespace singan2 {

// OLD Singa.cpp :11-23：To2byte() 后调用 Euro_（"与 Euro 相同"）
void singa_(CountryCtx& ctx) {
    ctx.to_2byte();
    euro_(ctx);
}

// OLD Swiss.cpp :11-34：函数体主体被注释，直接调用 Euro_
void swiss_(CountryCtx& ctx) {
    euro_(ctx);
}

// OLD Poland.cpp :11-139：全部计算代码处于 /* */ 注释中，函数体为空
void poland_(CountryCtx& /*ctx*/) {
}

}  // namespace singan2
