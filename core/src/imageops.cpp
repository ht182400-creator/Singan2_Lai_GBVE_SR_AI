// imageops.cpp — ImageEngine 实现，复刻 imageops.py
#include "singan2/imageops.h"

#include <cmath>
#include <stdexcept>

namespace singan2 {

void ImageEngine::set_oneimg(const std::vector<OnebyteImage>& images) {
    for (const auto& im : images) {
        oneimg[im.name] = im.data;
    }
}

void ImageEngine::to_2byte() {
    for (int i = 1; i <= 22; i++) {
        std::string key = "Img" + std::to_string(i);
        auto it = oneimg.find(key);
        if (it != oneimg.end()) {
            std::vector<uint16_t> v(it->second.size());
            for (size_t k = 0; k < it->second.size(); k++) v[k] = it->second[k];
            twoimg[key] = std::move(v);
        }
    }
}

void ImageEngine::compute_intermediate_waves(int red_offset, int grn_offset) {
    if (w_table == nullptr) throw std::runtime_error("ImageEngine.w_table 未设置");
    const auto i1 = oneimg.find("Img1");
    const auto i2 = oneimg.find("Img2");
    const auto i3 = oneimg.find("Img3");
    if (i1 == oneimg.end() || i2 == oneimg.end() || i3 == oneimg.end())
        throw std::runtime_error("compute_intermediate_waves 需要 Img1/Img2/Img3");

    const int N = Y_SIZE * X_SIZE;
    std::vector<int64_t> a1(N), a2(N), a3(N);
    for (int k = 0; k < N; k++) {
        a1[k] = i1->second[k];
        a2[k] = i2->second[k];
        a3[k] = i3->second[k];
    }

    const int w64 = static_cast<int>(w_table->table[64]);
    const int w8 = static_cast<int>(w_table->table[8]);
    auto clamp = [](int64_t v) -> uint8_t {
        if (v < 0) v = 0;
        if (v > 255) v = 255;
        return static_cast<uint8_t>(v);
    };

    std::vector<uint8_t> Img7(N), Img8(N), Img9(N), Img10(N), Img11(N),
        Img12(N), Img13(N), Img14(N), Img15(N);
    for (int k = 0; k < N; k++) {
        Img7[k] = clamp((a1[k] * a1[k]) * w64 >> 16);
        Img8[k] = clamp(a1[k] - a3[k] + red_offset);
        Img9[k] = clamp(a2[k] - a3[k] + grn_offset);
        Img10[k] = clamp(std::abs(a1[k] - a2[k]));
        Img11[k] = clamp(a1[k] - a2[k]);
        Img12[k] = clamp((a1[k] - a2[k]) * (a1[k] - a2[k]) * w8 >> 16);
        Img13[k] = clamp(a2[k] - a1[k]);
        Img14[k] = clamp(a1[k] & a2[k]);
        Img15[k] = clamp(a1[k] | a2[k]);
    }
    oneimg["Img7"] = std::move(Img7);
    oneimg["Img8"] = std::move(Img8);
    oneimg["Img9"] = std::move(Img9);
    oneimg["Img10"] = std::move(Img10);
    oneimg["Img11"] = std::move(Img11);
    oneimg["Img12"] = std::move(Img12);
    oneimg["Img13"] = std::move(Img13);
    oneimg["Img14"] = std::move(Img14);
    oneimg["Img15"] = std::move(Img15);
    to_2byte();
}

const std::vector<uint8_t>& ImageEngine::oneimg_at(int tab) const {
    return oneimg.at("Img" + std::to_string(tab + 1));
}
const std::vector<uint16_t>& ImageEngine::twoimg_at(int tab) const {
    return twoimg.at("Img" + std::to_string(tab + 1));
}
const std::vector<uint16_t>* ImageEngine::twoimg_find(const std::string& name) const {
    auto it = twoimg.find(name);
    return it == twoimg.end() ? nullptr : &it->second;
}
const std::vector<uint8_t>* ImageEngine::oneimg_find(const std::string& name) const {
    auto it = oneimg.find(name);
    return it == oneimg.end() ? nullptr : &it->second;
}
void ImageEngine::to_2byte_orver_write(int tab, const std::vector<uint16_t>& img2byte) {
    twoimg["Img" + std::to_string(tab + 1)] = img2byte;
}

void ImageEngine::gradient(int gtype, int amp) {
    if (w_table == nullptr) throw std::runtime_error("ImageEngine.w_table 未设置");
    const std::vector<uint8_t>& img1byte = oneimg_at(tab_no);
    const std::vector<uint16_t>& img2byte = twoimg_at(tab_no);

    // 边缘填充(常数0)
    std::vector<int64_t> padded((Y_SIZE + 2) * (X_SIZE + 2), 0);
    for (int i = 0; i < Y_SIZE; i++)
        for (int j = 0; j < X_SIZE; j++)
            padded[(i + 1) * (X_SIZE + 2) + (j + 1)] = img1byte[i * X_SIZE + j];

    int cx[3][3] = {0}, cy[3][3] = {0};
    if (gtype == 0) {  // Sobel
        cx[0][0] = -1; cx[0][2] = 1; cx[1][0] = -2; cx[1][2] = 2; cx[2][0] = -1; cx[2][2] = 1;
        cy[0][0] = -1; cy[0][1] = -2; cy[0][2] = -1; cy[2][0] = 1; cy[2][1] = 2; cy[2][2] = 1;
    } else if (gtype == 1) {  // Roberts
        cx[1][1] = 1; cx[2][2] = -1;
        cy[1][2] = 1; cy[2][1] = -1;
    } else {  // 通常
        cx[1][1] = 1; cx[1][2] = -1;
        cy[1][1] = 1; cy[2][1] = -1;
    }

    const int N = Y_SIZE * X_SIZE;
    std::vector<int64_t> zz(N, 0);
    for (int i = 0; i < Y_SIZE; i++) {
        for (int j = 0; j < X_SIZE; j++) {
            int64_t sx = 0, sy = 0;
            for (int ki = 0; ki < 3; ki++)
                for (int kj = 0; kj < 3; kj++) {
                    int64_t v = padded[(i + ki) * (X_SIZE + 2) + (j + kj)];
                    sx += cx[ki][kj] * v;
                    sy += cy[ki][kj] * v;
                }
            int64_t xxyy = sx * sx + sy * sy;
            int64_t val = 0;
            if (gtype == 0 || gtype == 1) {
                int64_t r = rute(static_cast<int>(xxyy), 0, 0x0100, *w_table);
                val = amp * r;
                if (val < 0) val = 0;
                if (val > 255) val = 255;
            } else {
                int64_t r = old_rute(static_cast<int>(xxyy));
                if (r <= 15) r = 0;
                val = (amp * r) & 0xffff;
            }
            zz[i * X_SIZE + j] = val;
        }
    }
    std::vector<uint16_t> result = img2byte;
    for (int i = 1; i < Y_SIZE - 1; i++)
        for (int j = 1; j < X_SIZE - 1; j++)
            result[i * X_SIZE + j] = static_cast<uint16_t>(zz[i * X_SIZE + j]);
    to_2byte_orver_write(tab_no, result);
}

void ImageEngine::niti(int s) {
    const std::vector<uint8_t>& img1byte = oneimg_at(tab_no);
    const int N = Y_SIZE * X_SIZE;
    std::vector<uint16_t> out(N);
    for (int k = 0; k < N; k++) out[k] = (img1byte[k] >= s) ? 0xff : 0;
    to_2byte_orver_write(tab_no, out);
}

void ImageEngine::smooth() {
    if (w_table == nullptr) throw std::runtime_error("ImageEngine.w_table 未设置");
    const std::vector<uint8_t>& img1byte = oneimg_at(tab_no);
    const std::vector<uint16_t>& img2byte = twoimg_at(tab_no);

    std::vector<int64_t> padded((Y_SIZE + 2) * (X_SIZE + 2), 0);
    for (int i = 0; i < Y_SIZE; i++)
        for (int j = 0; j < X_SIZE; j++)
            padded[(i + 1) * (X_SIZE + 2) + (j + 1)] = img1byte[i * X_SIZE + j];

    const int w9 = static_cast<int>(w_table->table[9]);
    const int N = Y_SIZE * X_SIZE;
    std::vector<int64_t> out(N, 0);
    for (int i = 0; i < Y_SIZE; i++) {
        for (int j = 0; j < X_SIZE; j++) {
            int64_t buf = padded[i * (X_SIZE + 2) + j] + padded[i * (X_SIZE + 2) + j + 1] + padded[i * (X_SIZE + 2) + j + 2]
                        + padded[(i + 1) * (X_SIZE + 2) + j] + padded[(i + 1) * (X_SIZE + 2) + j + 1] + padded[(i + 1) * (X_SIZE + 2) + j + 2]
                        + padded[(i + 2) * (X_SIZE + 2) + j] + padded[(i + 2) * (X_SIZE + 2) + j + 1] + padded[(i + 2) * (X_SIZE + 2) + j + 2];
            int64_t v = (buf * w9) >> 16;
            v += img1byte[i * X_SIZE + j];
            if (v < 0) v = 0;
            if (v > 255) v = 255;
            out[i * X_SIZE + j] = v;
        }
    }
    std::vector<uint16_t> result = img2byte;
    for (int i = 1; i < Y_SIZE - 1; i++)
        for (int j = 1; j < X_SIZE - 1; j++)
            result[i * X_SIZE + j] = static_cast<uint16_t>(out[i * X_SIZE + j]);
    to_2byte_orver_write(tab_no, result);
}

int ImageEngine::rute(int u_bunsan, int left, int right, const WTable& wt) {
    int center = 0x80;
    int w2 = static_cast<int>(wt.table[2]);
    for (int it = 0; it < 7; it++) {
        if (center * center < u_bunsan)
            left = center;
        else
            right = center;
        center = ((left + right) * w2) >> 16;
    }
    left = center;
    center = ((left + right) * w2) >> 16;
    return center;
}

int ImageEngine::old_rute(int u_bunsan) {
    int i = 0;
    while (true) {
        if (i * i > u_bunsan) return i - 1;
        i++;
    }
}

}  // namespace singan2
