// c_si2.cpp — C_SI2 实现，复刻 c_si2.py
#include "singan2/c_si2.h"

#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <tuple>

namespace singan2 {
namespace {

std::vector<int64_t> to_i64(const std::vector<uint16_t>& v) {
    std::vector<int64_t> r(v.size());
    for (size_t k = 0; k < v.size(); k++) r[k] = v[k];
    return r;
}
std::vector<int64_t> to_i64_u8(const std::vector<uint8_t>& v) {
    std::vector<int64_t> r(v.size());
    for (size_t k = 0; k < v.size(); k++) r[k] = v[k];
    return r;
}

}  // namespace

C_SI2::C_SI2(const ImageEngine* engine, const ZAHYO_PARAM* zparam, int kin_, bool ztype_,
             const std::vector<uint8_t>* small)
    : eng(engine), zp(zparam), kin(kin_), ztype(ztype_) {
    if (small) small_image = *small;
}

bool C_SI2::bounds(int y_lo, int y_hi, int x_lo, int x_hi,
                   int& i0, int& i1, int& j0, int& j1) {
    i0 = std::max(y_lo + 1, 0);
    i1 = std::min(y_hi - 1, Y_SIZE - 1);
    j0 = std::max(x_lo + 1, 0);
    j1 = std::min(x_hi - 1, X_SIZE - 1);
    if (i0 > i1 || j0 > j1) return false;
    return true;
}

bool C_SI2::z_wariai(int x, int y, int xx, int yy, int& xo, int& yo, int& xxo, int& yyo) const {
    xo = x; yo = y; xxo = xx; yyo = yy;
    if (small_image.size() < 5792) return false;
    int speed = (static_cast<int>(small_image[5790]) << 8) | static_cast<int>(small_image[5791]);
    int w_speed = (eng && speed < static_cast<int>(eng->w_table->table.size()))
                      ? static_cast<int>(eng->w_table->table[speed])
                      : 0;
    const int y_ = y;
    yo = (y * 256 * w_speed) >> 16;
    yyo = (((yy - y_) * 256 * w_speed) >> 16) + yo;
    return true;
}

void C_SI2::adjust(int x, int y, int xx, int yy, int& xo, int& yo, int& xxo, int& yyo) const {
    if (ztype) {
        int tx, ty, txx, tyy;
        if (z_wariai(x, y, xx, yy, tx, ty, txx, tyy)) {
            xo = tx; yo = ty; xxo = txx; yyo = tyy;
            return;
        }
    }
    xo = x; yo = y; xxo = xx; yyo = yy;
}

int C_SI2::average_concentration2(int x, int y, int xx, int yy,
                                  const std::vector<int64_t>& img, int itype) {
    adjust(x, y, xx, yy, x, y, xx, yy);
    if (itype == 0) {
        int i0, i1, j0, j1;
        if (!bounds(y, yy - 1, x, xx - 1, i0, i1, j0, j1)) return 0;
        int64_t sum = 0;
        for (int i = i0; i <= i1; i++)
            for (int j = j0; j <= j1; j++) sum += img[i * X_SIZE + j];
        return static_cast<int>(sum);
    }
    if (itype == 1 || itype == 2 || itype == 3) {
        int i0, i1, j0, j1;
        if (!bounds(y - 1, yy, x - 1, xx, i0, i1, j0, j1)) return 0;
        if (itype == 1) {
            int64_t sum = 0;
            for (int i = i0; i <= i1; i++)
                for (int j = j0; j <= j1; j++) sum += img[i * X_SIZE + j];
            return static_cast<int>(sum);
        }
        if (!eng) throw std::runtime_error("average_concentration2 type>=2 需要 engine");
        const std::vector<uint16_t>* pimg1 = eng->twoimg_find("Img1");
        const std::vector<uint16_t>* pimg2 = eng->twoimg_find("Img2");
        if (!pimg1 || !pimg2) throw std::runtime_error("average_concentration2 type>=2 需要 twoimg.Img1/Img2");
        std::vector<int64_t> a1 = to_i64(*pimg1);
        std::vector<int64_t> a2 = to_i64(*pimg2);
        int64_t s1 = 0, s2 = 0;
        for (int i = i0; i <= i1; i++)
            for (int j = j0; j <= j1; j++) {
                s1 += a1[i * X_SIZE + j];
                s2 += a2[i * X_SIZE + j];
            }
        if (itype == 2) return static_cast<int>(s1 - s2);
        // itype == 3
        if (small_image.size() < 2254) throw std::runtime_error("average_concentration2 type=3 需要 small_image");
        int red_add = (static_cast<int>(small_image[2250]) << 8) | static_cast<int>(small_image[2251]);
        int grn_add = (static_cast<int>(small_image[2252]) << 8) | static_cast<int>(small_image[2253]);
        int w3000 = static_cast<int>(eng->w_table->table[3000]);
        int64_t dat = (s2 * (red_add - grn_add) * w3000) >> 16;
        return static_cast<int>(s1 - dat);
    }
    return -1;
}

int C_SI2::monochrome_ratio2(int x, int y, int xx, int yy, const std::vector<int64_t>& img) {
    adjust(x, y, xx, yy, x, y, xx, yy);
    int i0, i1, j0, j1;
    if (!bounds(y, yy - 1, x, xx - 1, i0, i1, j0, j1)) return 0;
    int cnt = 0;
    for (int i = i0; i <= i1; i++)
        for (int j = j0; j <= j1; j++)
            if (img[i * X_SIZE + j] != 0) cnt++;
    return cnt;
}

int C_SI2::Rinsetu2(int x, int y, int xx, int yy, const std::vector<int64_t>& img) {
    adjust(x, y, xx, yy, x, y, xx, yy);
    int bh_i0, bh_i1, bh_j0, bh_j1;
    bool bh = bounds(y - 1, yy, x - 1, xx - 1, bh_i0, bh_i1, bh_j0, bh_j1);
    int bv_i0, bv_i1, bv_j0, bv_j1;
    bool bv = bounds(y - 1, yy - 1, x - 1, xx, bv_i0, bv_i1, bv_j0, bv_j1);

    if (!bh && !bv) {
        std::vector<int64_t> a1 = (eng && eng->twoimg_find("Img1"))
                                      ? to_i64(*eng->twoimg_find("Img1"))
                                      : img;
        int64_t total = 0;
        for (int i = 0; i < 20; i++)
            for (int j = 0; j < 19; j++) {
                int64_t d = std::abs(a1[i * X_SIZE + j] - a1[i * X_SIZE + j + 1]);
                if (d > 10) total += d;
            }
        for (int i = 0; i < 19; i++)
            for (int j = 0; j < 20; j++) {
                int64_t d = std::abs(a1[i * X_SIZE + j] - a1[(i + 1) * X_SIZE + j]);
                if (d > 10) total += d;
            }
        if (total > 65535) total = 65535;
        return static_cast<int>(total);
    }
    int64_t total = 0;
    if (bh) {
        for (int i = bh_i0; i <= bh_i1; i++)
            for (int j = bh_j0; j <= bh_j1; j++) {
                if (j + 1 >= X_SIZE) continue;
                int64_t d = std::abs(img[i * X_SIZE + j] - img[i * X_SIZE + j + 1]);
                if (d > 10) total += d;
            }
    }
    if (bv) {
        for (int i = bv_i0; i <= bv_i1; i++) {
            if (i + 1 >= Y_SIZE) continue;
            for (int j = bv_j0; j <= bv_j1; j++) {
                int64_t d = std::abs(img[i * X_SIZE + j] - img[(i + 1) * X_SIZE + j]);
                if (d > 10) total += d;
            }
        }
    }
    if (total > 65535) total = 65535;
    return static_cast<int>(total);
}

int C_SI2::RINSETU(int x, int y, int xx, int yy, const std::vector<int64_t>& img) {
    adjust(x, y, xx, yy, x, y, xx, yy);
    int bh_i0, bh_i1, bh_j0, bh_j1;
    bool bh = bounds(y - 1, yy, x - 1, xx - 1, bh_i0, bh_i1, bh_j0, bh_j1);
    int bv_i0, bv_i1, bv_j0, bv_j1;
    bool bv = bounds(y - 1, yy - 1, x - 1, xx, bv_i0, bv_i1, bv_j0, bv_j1);

    int64_t total = 0;
    if (!bh && !bv) {
        int b0 = static_cast<int>(img[0]);
        int d1 = std::abs(b0 - static_cast<int>(img[1]));
        int d2 = std::abs(b0 - static_cast<int>(img[X_SIZE]));
        if (10 < d1) total += 380 * d1;
        if (10 < d2) total += 380 * d2;
    } else {
        if (bh) {
            for (int i = bh_i0; i <= bh_i1; i++)
                for (int j = bh_j0; j <= bh_j1; j++) {
                    if (j + 1 >= X_SIZE) continue;
                    int64_t d = std::abs(img[i * X_SIZE + j] - img[i * X_SIZE + j + 1]);
                    if (d > 10) total += d;
                }
        }
        if (bv) {
            for (int i = bv_i0; i <= bv_i1; i++) {
                if (i + 1 >= Y_SIZE) continue;
                for (int j = bv_j0; j <= bv_j1; j++) {
                    int64_t d = std::abs(img[i * X_SIZE + j] - img[(i + 1) * X_SIZE + j]);
                    if (d > 10) total += d;
                }
            }
        }
    }
    if (total < 0) total = 0;
    if (total > 65535) total = 65535;
    return static_cast<int>(total);
}

int C_SI2::sikisa() {
    if (small_image.size() < 440) return 0;
    int sa = 0;
    for (int i = 0; i < 220; i++)
        sa += std::abs(static_cast<int>(small_image[i]) - static_cast<int>(small_image[i + 220]));
    return sa;
}

int C_SI2::Suka_Kyotyo(int x, int y, int xx, int yy, const std::vector<int64_t>& img) {
    adjust(x, y, xx, yy, x, y, xx, yy);
    int i0, i1, j0, j1;
    if (!bounds(y, yy - 1, x, xx - 1, i0, i1, j0, j1)) {
        int64_t ct = 0;
        for (int i = 1; i < 19; i++)
            for (int j = 1; j < 19; j++) ct += (img[i * X_SIZE + j] & 0xff);
        ct >>= 2;
        if (ct > 65535) ct = 65535;
        return static_cast<int>(ct);
    }
    int64_t ct = 0;
    for (int i = i0; i <= i1; i++)
        for (int j = j0; j <= j1; j++) ct += (img[i * X_SIZE + j] & 0xff);
    ct >>= 2;
    if (ct > 65535) ct = 65535;
    return static_cast<int>(ct);
}

int C_SI2::Siki_Kyotyo(int x, int y, int xx, int yy, const std::vector<int64_t>& img) {
    adjust(x, y, xx, yy, x, y, xx, yy);
    int i0, i1, j0, j1;
    if (!bounds(y + 1, yy - 2, x + 1, xx - 2, i0, i1, j0, j1)) {
        int64_t ct = 256 * static_cast<int>(img[0]);
        ct >>= 2;
        if (ct > 65535) ct = 65535;
        return static_cast<int>(ct);
    }
    int64_t ct = 0;
    for (int i = i0; i <= i1; i++)
        for (int j = j0; j <= j1; j++) ct += img[i * X_SIZE + j];
    ct >>= 2;
    if (ct > 65535) ct = 65535;
    return static_cast<int>(ct);
}

int C_SI2::infrared_white_ratio2(int x, int y, int xx, int yy, const std::vector<int64_t>& img) {
    adjust(x, y, xx, yy, x, y, xx, yy);
    int i0, i1, j0, j1;
    if (!bounds(y, yy + 1, x, xx + 1, i0, i1, j0, j1)) return 0;
    int cnt = 0;
    for (int i = i0; i <= i1; i++)
        for (int j = j0; j <= j1; j++)
            if (img[i * X_SIZE + j] != 0) cnt++;
    return cnt;
}

int C_SI2::img_datecount(int x, int y, int xx, int yy, int minv, int maxv,
                         const std::vector<int64_t>& img, int itype) {
    adjust(x, y, xx, yy, x, y, xx, yy);
    int i0, i1, j0, j1;
    if (itype == 0)
        bounds(y, yy - 1, x, xx - 1, i0, i1, j0, j1);
    else
        bounds(y - 1, yy, x - 1, xx, i0, i1, j0, j1);
    if (i0 > i1 || j0 > j1) return 0;
    int cnt = 0;
    for (int i = i0; i <= i1; i++)
        for (int j = j0; j <= j1; j++) {
            int64_t v = img[i * X_SIZE + j];
            if (v >= minv && v <= maxv) cnt++;
        }
    return cnt;
}

int C_SI2::soil_(int x, int y, int xx, int yy, const std::vector<int64_t>& img) {
    adjust(x, y, xx, yy, x, y, xx, yy);
    int i0, i1, j0, j1;
    if (!bounds(y - 1, yy, x - 1, xx, i0, i1, j0, j1)) {
        int64_t ct = 0;
        for (int i = 0; i < 20; i++)
            for (int j = 0; j < 20; j++) ct += img[i * X_SIZE + j];
        return static_cast<int>(ct);
    }
    int64_t ct = 0;
    for (int i = i0; i <= i1; i++)
        for (int j = j0; j <= j1; j++) ct += img[i * X_SIZE + j];
    return static_cast<int>(ct);
}

int C_SI2::soil2_(int x, int y, int xx, int yy, const std::vector<int64_t>& img) {
    adjust(x, y, xx, yy, x, y, xx, yy);
    int i0, i1, j0, j1;
    if (!bounds(y - 1, yy, x - 1, xx, i0, i1, j0, j1)) {
        int cnt = 0;
        for (int i = 0; i < 20; i++)
            for (int j = 0; j < 20; j++)
                if (img[i * X_SIZE + j] >= 206) cnt++;
        return cnt;
    }
    int cnt = 0;
    for (int i = i0; i <= i1; i++)
        for (int j = j0; j <= j1; j++)
            if (img[i * X_SIZE + j] >= 206) cnt++;
    return cnt;
}

int C_SI2::soil_soil() {
    if (!zp) throw std::runtime_error("soil_soil 需要 zp");
    int x = zp->at("Yogore", "LeftX", kin);
    int y = zp->at("Yogore", "LeftY", kin);
    int xx = zp->at("Yogore", "RightX", kin);
    int yy = zp->at("Yogore", "RightY", kin);
    const std::vector<uint16_t>* pimg3 = eng ? eng->twoimg_find("Img3") : nullptr;
    const std::vector<uint16_t>* pimg1 = eng ? eng->twoimg_find("Img1") : nullptr;
    if (!pimg1) pimg1 = pimg3;
    if (xx && yy) {
        if (!pimg3) throw std::runtime_error("soil_soil 需要 twoimg.Img3");
        int ret = average_concentration2(x, y, xx, yy, to_i64(*pimg3), 1);
        ret >>= 4;
        int s2_2 = (s2 && s2->size() > 2) ? (*s2)[2] : 0;
        int s2_11 = (s2 && s2->size() > 11) ? (*s2)[11] : 0;
        ret += s2_2 + s2_11;
        ret >>= 1;
        ret = 0xffff - ret;
        return ret & 0xffff;
    } else {
        if (!pimg1) throw std::runtime_error("soil_soil fallback 需要 twoimg.Img1");
        int ret = average_concentration2(0, 0, 20, 20, to_i64(*pimg1), 1);
        ret >>= 4;
        int s2_2 = (s2 && s2->size() > 2) ? (*s2)[2] : 0;
        int s2_11 = (s2 && s2->size() > 11) ? (*s2)[11] : 0;
        ret += s2_2 + s2_11;
        ret >>= 1;
        ret = 0xffff - ret;
        return ret & 0xffff;
    }
}

// ---- 国家函数用（复刻 OLD C_SI2.CPP，供 countries/ 各国移植调用）----

// OLD C_SI2.CPP :243-289。Ave=(sum*w_Table[ct])>>14；
// 区域 (y,xx]×(x,xx]：内层 (y,yy-1)×(x,xx-1) 用像素值，边缘用 0 参与分散。
int C_SI2::distribution2(int x, int y, int xx, int yy, const std::vector<int64_t>& img,
                         int sum, int ct, int /*type*/) {
    adjust(x, y, xx, yy, x, y, xx, yy);
    const int w_speed = (eng && ct >= 0 && ct < static_cast<int>(eng->w_table->table.size()))
                            ? static_cast<int>(eng->w_table->table[ct]) : 0;
    const uint64_t ave = (static_cast<uint64_t>(sum) * static_cast<uint64_t>(w_speed)) >> 14;
    int i0, i1, j0, j1;
    const bool in = bounds(y, yy + 1, x, xx + 1, i0, i1, j0, j1);  // (y,xx]×(x,xx]
    uint64_t b = 0;
    if (in) {
        for (int i = i0; i <= i1; i++) {
            for (int j = j0; j <= j1; j++) {
                if (i > y && i < yy - 1 && j > x && j < xx - 1)
                    b += static_cast<uint64_t>(img[i * X_SIZE + j] - static_cast<int64_t>(ave)) *
                         static_cast<uint64_t>(img[i * X_SIZE + j] - static_cast<int64_t>(ave));
                else
                    b += ave * ave;  // OLD: (0-Ave)^2（Ave>=0）
            }
        }
    }
    return static_cast<int>(b >> 8);  // OLD :286 无封顶，返回 ULONG
}

// OLD C_SI2.CPP :350-418。区域取自 Sukasi2；空区域→默认 1..19。
// 1:1 注意：OLD 的 im 缓冲不清尾（memset Y_SIZE*X_SIZE），且比较循环含 im[ii+1] 越界读；
// 这里等价实现（ii+1 越界处按 0 处理）。
int C_SI2::wave_type(int /*i*/, int /*j*/, const std::vector<int64_t>& img, int /*num*/) {
    if (!zp) throw std::runtime_error("wave_type 需要 zp");
    const int rx = zp->at("Sukasi2", "RightX", kin);
    const int ry = zp->at("Sukasi2", "RightY", kin);
    std::vector<uint8_t> im(static_cast<size_t>(Y_SIZE) * X_SIZE, 0);
    if (rx && ry) {
        const int ly = zp->at("Sukasi2", "LeftY", kin);
        const int lx = zp->at("Sukasi2", "LeftX", kin);
        for (int i = 0; i < Y_SIZE; i++)
            for (int j = 0; j < X_SIZE; j++)
                if (i > ly && i < ry - 1 && j > lx && j < rx - 1)
                    im[i * X_SIZE + j] = static_cast<uint8_t>(img[i * X_SIZE + j]);
    } else {
        for (int i = 0; i < Y_SIZE; i++)
            for (int j = 0; j < X_SIZE; j++)
                if (i > 0 && i < 19 && j > 0 && j < 19)
                    im[i * X_SIZE + j] = static_cast<uint8_t>(img[i * X_SIZE + j]);
    }
    int ct = 0;
    for (int ii = 0; ii < static_cast<int>(im.size()) - 1; ii++)
        if (im[ii] == 255 && im[ii + 1] == 0) ct++;
    return ct;
}

// OLD C_SI2.CPP :480-547。0xff-像素，>0xd0 部分累加；区域 [y,yy-1]×[x,xx-1]；
// 空(c=0)→默认 20×20（同一张图）；封顶 65535。
int C_SI2::horo2(int x, int y, int xx, int yy, const std::vector<int64_t>& img) {
    adjust(x, y, xx, yy, x, y, xx, yy);
    int i0, i1, j0, j1;
    int64_t sum = 0;
    if (bounds(y - 1, yy, x - 1, xx, i0, i1, j0, j1)) {
        for (int i = i0; i <= i1; i++)
            for (int j = j0; j <= j1; j++) {
                int dat = 0xff - static_cast<int>(img[i * X_SIZE + j]);
                if (dat > 0xd0) { dat -= 0xd0; sum += dat; }
            }
    } else {
        for (int i = 0; i < 20; i++)
            for (int j = 0; j < 20; j++) {
                int dat = 0xff - static_cast<int>(img[i * X_SIZE + j]);
                if (dat > 0xd0) { dat -= 0xd0; sum += dat; }
            }
    }
    return static_cast<int>(sum > 65535 ? 65535 : sum);
}

// OLD C_SI2.CPP :549-588。low<像素<high 计数；区域 [y,yy-1]×[x,xx-1]；无封顶。
int C_SI2::horo3(int x, int y, int xx, int yy, const std::vector<int64_t>& img, int low, int high) {
    adjust(x, y, xx, yy, x, y, xx, yy);
    int i0, i1, j0, j1;
    int64_t sum = 0;
    if (bounds(y - 1, yy, x - 1, xx, i0, i1, j0, j1)) {
        for (int i = i0; i <= i1; i++)
            for (int j = j0; j <= j1; j++) {
                const int dat = static_cast<int>(img[i * X_SIZE + j]);
                if (dat > low && dat < high) sum++;
            }
    }
    return static_cast<int>(sum > 65535 ? 65535 : sum);
}

// OLD C_SI2.CPP :590-629。low<=像素<=high 计数；区域 [y,yy-1]×[x,xx-1]；封顶 65535。
int C_SI2::horo4(int x, int y, int xx, int yy, const std::vector<int64_t>& img, int low, int high) {
    adjust(x, y, xx, yy, x, y, xx, yy);
    int i0, i1, j0, j1;
    int64_t sum = 0;
    if (bounds(y - 1, yy, x - 1, xx, i0, i1, j0, j1)) {
        for (int i = i0; i <= i1; i++)
            for (int j = j0; j <= j1; j++) {
                const int dat = static_cast<int>(img[i * X_SIZE + j]);
                if (dat >= low && dat <= high) sum++;
            }
    }
    return static_cast<int>(sum > 65535 ? 65535 : sum);
}

}  // namespace singan2
