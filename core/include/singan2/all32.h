#pragma once
#include <vector>
#include <string>
#include "singan2/types.h"
#include "singan2/imageops.h"
#include "singan2/zahyo_param.h"
#include "singan2/c_si2.h"

// ALL32 计算主流程（复刻 all32.py）
namespace singan2 {

class All32Engine {
public:
    ImageEngine* eng;                  // 非 const：run() 需修改 eng 状态
    const ZAHYO_PARAM* zp = nullptr;
    int kin = 1;
    bool ztype = false;
    int country = 0;
    std::vector<int> s2;               // S2[0..32]
    std::vector<int> etc;              // global_etc[0..14]
    C_SI2 csi2_;

    All32Engine(ImageEngine* engine, const ZAHYO_PARAM* zparam, int kin_ = 1, bool ztype_ = false,
                const std::vector<uint8_t>* small = nullptr, int select_country = 0);
    void run();

private:
    int zname(const std::string& prefix, const std::string& field) const;
};

}  // namespace singan2
