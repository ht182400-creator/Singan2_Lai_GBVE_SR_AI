// 待移植国家占位（下轮逐个 1:1 填充；当前行为 = S2[17..32] 保持 0，与 v0.7.x 一致）
// 对应 OLD：USA.cpp(2000L) / Chia.cpp(China_,657L) / HongKong.cpp(2850L,含DEN) /
//           Russia.cpp(807L,含DEN) / Turkey.cpp(254L) / Indonesia.cpp(170L) /
//           England.cpp(341L) / Thai.cpp(367L) / SaudiArabia.cpp(303L,含DEN) / Czech.cpp(139L,全注释→空)
// 注意：Czech.cpp 与 SouthAfrica 同为全注释模板，此处先给空体即为 1:1。
#include "singan2/country_context.h"

namespace singan2 {

void usa_(CountryCtx& /*ctx*/)          {}  // TODO: 1:1 移植 USA.cpp（58 处 S2[17..32]）
void china_(CountryCtx& /*ctx*/)        {}  // TODO: 1:1 移植 Chia.cpp::China_（含 S2[20] Rinsetu2）
void hongkong_(CountryCtx& /*ctx*/)     {}  // TODO: 1:1 移植 HongKong.cpp（29 处 S2 + 51 处 DEN）
void russia_(CountryCtx& /*ctx*/)       {}  // TODO: 1:1 移植 Russia.cpp（8 处 S2 + 21 处 DEN，含 DEN[12..31]=i）
void turkey_(CountryCtx& /*ctx*/)       {}  // TODO: 1:1 移植 Turkey.cpp
void indonesia_(CountryCtx& /*ctx*/)    {}  // TODO: 1:1 移植 Indonesia.cpp（18 处 S2）
void england_(CountryCtx& /*ctx*/)      {}  // TODO: 1:1 移植 England.cpp（11 处 S2）
void thai_(CountryCtx& /*ctx*/)         {}  // TODO: 1:1 移植 Thai.cpp（8 处 S2）
void saudi_arabia_(CountryCtx& /*ctx*/) {}  // TODO: 1:1 移植 SaudiArabia.cpp（9 处 S2 + 5 处 DEN）
void south_africa_(CountryCtx& /*ctx*/) {}  // OLD 全注释 → 空操作（已完成 1:1）
void czech_(CountryCtx& /*ctx*/)        {}  // OLD 全注释 → 空操作（已完成 1:1）

}  // namespace singan2
