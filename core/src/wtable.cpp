// wtable.cpp — 除法表 GBV_DIV_H.bin 加载，复刻 poc/algo/wtable.py
#include "singan2/wtable.h"

#include <cstdint>
#include <fstream>
#include <iterator>
#include <stdexcept>
#include <string>
#include <vector>

namespace singan2 {

WTable load_w_table(const std::string& path) {
    std::ifstream fp(path, std::ios::binary);
    if (!fp) throw std::runtime_error("无法打开 w_Table 文件: " + path);

    std::vector<uint8_t> raw((std::istreambuf_iterator<char>(fp)), std::istreambuf_iterator<char>());
    WTable wt;
    wt.table.assign(W_TABLE_SIZE, 0);

    // 文件按 UINT16 小端读入；不足 W_TABLE_SIZE 的部分保留 0(与 poc np.pad constant_values=0 一致)
    const size_t n = std::min(raw.size() / 2, static_cast<size_t>(W_TABLE_SIZE));
    for (size_t k = 0; k < n; k++) {
        const uint16_t v =
            static_cast<uint16_t>(raw[k * 2]) |
            static_cast<uint16_t>(static_cast<uint16_t>(raw[k * 2 + 1]) << 8);  // 小端
        wt.table[k] = v;
    }
    return wt;
}

WTable gen_w_table() {
    WTable wt;
    wt.table.assign(W_TABLE_SIZE, 0);  // table[0] = 0
    for (int i = 1; i < W_TABLE_SIZE; i++) {
        double v = 65536.0 / i;
        int iv = static_cast<int>(v);  // 截断(与 numpy astype(uint16) 行为一致)
        if (iv > 65535) iv = 65535;
        if (iv < 0) iv = 0;
        wt.table[i] = static_cast<uint16_t>(iv);
    }
    return wt;
}

}  // namespace singan2
