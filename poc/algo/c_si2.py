# -*- coding: utf-8 -*-
"""
c_si2.py — C_SI2 类算法复刻（SINGAN2 真券判定2计算类）

复刻来源: C_SI2.CPP（行号见各方法 docstring）
依赖: imageops.ImageEngine（提供 global_twoimg 等）

区域语义说明（关键）:
  原版全部区域函数都形如:
    for(i=0; i<Y_SIZE; i++) for(j=0; j<X_SIZE; j++, img++)
      if( i > y_lo && i < y_hi && j > x_lo && j < x_hi ) { ... }
  等价于整数集合:
    i ∈ [max(0, y_lo+1), min(Y_SIZE-1, y_hi-1)]
    j ∈ [max(0, x_lo+1), min(X_SIZE-1, x_hi-1)]
  当该集合为空（如坐标全 0 时 y_hi-1 = -1）→ 区域空 → c==0。
  不能直接用 numpy 切片 arr[y+1:yy-1]（负索引会取到整幅图），必须显式判断边界。
"""

import numpy as np
import logging
import traceback

from .imageops import Y_SIZE, X_SIZE, ONESIZE


def get_logger():
    return logging.getLogger("c_si2")


class C_SI2:
    """复刻 C_SI2 类。需要外部注入 ImageEngine（提供 twoimg / oneimg / w_table）。"""

    def __init__(self, engine, zparam, kin=1, ztype=False, small_image=None):
        """
        参数:
            engine: ImageEngine 实例（已 set_oneimg + to_2byte）
            zparam: ZAHYO_PARAM 兼容字典（zahyo_reader.parse_zahyo 输出）
            kin: KIN 面额方向号（C++ 从 combo+1）
            ztype: global_Ztype（速度变换坐标，默认 False）
            small_image: global_small_image 字节数组（sikisa 用）
        """
        self.eng = engine
        self.zp = zparam
        self.kin = kin
        self.ztype = ztype
        if small_image is not None:
            self.small_image = np.frombuffer(bytes(small_image), dtype=np.uint8)
        else:
            self.small_image = np.zeros(0, dtype=np.uint8)

    # ------------------------------------------------------------------//
    # 内部工具：C++ 区域边界 -> numpy 切片
    # ------------------------------------------------------------------//
    @staticmethod
    def _bounds(y_lo, y_hi, x_lo, x_hi):
        """模拟 C++ 条件 `i > y_lo && i < y_hi && j > x_lo && j < x_hi`。

        返回 (i0, i1, j0, j1)（numpy 右开切片），区域为空返回 None。
        """
        i0 = max(y_lo + 1, 0)
        i1 = min(y_hi - 1, Y_SIZE - 1)
        j0 = max(x_lo + 1, 0)
        j1 = min(x_hi - 1, X_SIZE - 1)
        if i0 > i1 or j0 > j1:
            return None
        return (i0, i1 + 1, j0, j1 + 1)

    # ------------------------------------------------------------------//
    # z_wariai: 输送速度换算坐标（C_SI2.CPP:32-68）
    # ------------------------------------------------------------------//
    def _z_wariai(self, x, y, xx, yy):
        """速度换算坐标（global_Ztype=True 时调用）。"""
        try:
            if self.small_image.size < 5792:
                return x, y, xx, yy
            speed = (int(self.small_image[5790]) << 8) + int(self.small_image[5791])
            y_ = y
            w_speed = int(self.eng.w_table[speed]) if speed < len(self.eng.w_table) else 0
            y = (y * 256 * w_speed) >> 16
            yy_new = (yy - y_) * 256 * w_speed >> 16
            yy_new += y
            return x, y, xx, yy_new
        except Exception as exc:
            get_logger().error("z_wariai 异常: %s\n%s", exc, traceback.format_exc())
            return x, y, xx, yy

    def _adjust(self, x, y, xx, yy):
        if self.ztype:
            return self._z_wariai(x, y, xx, yy)
        return x, y, xx, yy

    # ------------------------------------------------------------------//
    # average_concentration2 — C_SI2.CPP:107-221
    # ------------------------------------------------------------------//
    def average_concentration2(self, x, y, xx, yy, img, itype):
        """合计值取得。

        type 0: i>y && i<yy-1 && j>x && j<xx-1（梯度后 Sum，外圈1像素不加）
        type 1: i>y-1 && i<yy && j>x-1 && j<xx（区域整体）
        type 2: 区域整体，强制 赤外-绿 (Img1-Img2)
        type 3: 区域整体，赤外 - 绿*(赤外加算-绿加算)*wTable[3000]>>16
        无 fallback，区域空返回 0。
        """
        try:
            x, y, xx, yy = self._adjust(x, y, xx, yy)
            if itype in (0,):
                b = self._bounds(y, yy - 1, x, xx - 1)
                if b is None:
                    return 0
                arr = np.asarray(img, dtype=np.int64).reshape(Y_SIZE, X_SIZE)
                return int(arr[b[0]:b[1], b[2]:b[3]].sum())
            if itype in (1, 2, 3):
                b = self._bounds(y - 1, yy, x - 1, xx)
                if b is None:
                    return 0
                if itype == 1:
                    arr = np.asarray(img, dtype=np.int64).reshape(Y_SIZE, X_SIZE)
                    return int(arr[b[0]:b[1], b[2]:b[3]].sum())
                img1 = self.eng.twoimg.get("Img1")
                img2 = self.eng.twoimg.get("Img2")
                if img1 is None or img2 is None:
                    raise ValueError("type=%d 需要 twoimg.Img1/Img2" % itype)
                a1 = np.asarray(img1, dtype=np.int64).reshape(Y_SIZE, X_SIZE)
                a2 = np.asarray(img2, dtype=np.int64).reshape(Y_SIZE, X_SIZE)
                s1 = a1[b[0]:b[1], b[2]:b[3]]
                s2 = a2[b[0]:b[1], b[2]:b[3]]
                if itype == 2:
                    return int((s1 - s2).sum())
                # type 3
                red_add = (int(self.small_image[2250]) << 8) + int(self.small_image[2251])
                grn_add = (int(self.small_image[2252]) << 8) + int(self.small_image[2253])
                w3000 = int(self.eng.w_table[3000]) if len(self.eng.w_table) > 3000 else 0
                dat = (s2 * (red_add - grn_add) * w3000) >> 16
                return int((s1 - dat).sum())
            return -1
        except Exception as exc:
            get_logger().error("average_concentration2 异常: %s\n%s", exc, traceback.format_exc())
            raise

    # ------------------------------------------------------------------//
    # monochrome_ratio2 — C_SI2.CPP:306-334
    # ------------------------------------------------------------------//
    def monochrome_ratio2(self, x, y, xx, yy, img):
        """白黑比率：i>y && i<yy-1 && j>x && j<xx-1，非零像素计数。无 fallback。"""
        try:
            x, y, xx, yy = self._adjust(x, y, xx, yy)
            b = self._bounds(y, yy - 1, x, xx - 1)
            if b is None:
                return 0
            arr = np.asarray(img, dtype=np.int64).reshape(Y_SIZE, X_SIZE)
            sub = arr[b[0]:b[1], b[2]:b[3]]
            return int((sub != 0).sum())
        except Exception as exc:
            get_logger().error("monochrome_ratio2 异常: %s\n%s", exc, traceback.format_exc())
            raise

    # ------------------------------------------------------------------//
    # Rinsetu2 — C_SI2.CPP:882-979
    # ------------------------------------------------------------------//
    def Rinsetu2(self, x, y, xx, yy, img):
        """邻接微分值（绿透过）。

        横向 i>y-1 && i<yy && j>x-1 && j<xx-1：右邻差>10 则累加
        纵向 i>y-1 && i<yy-1 && j>x-1 && j<xx：下邻差>10 则累加
        若两个循环均未执行（c==0）→ fallback 20x20 区域，图像用 global_twoimg.Img1。
        """
        try:
            x, y, xx, yy = self._adjust(x, y, xx, yy)
            arr = np.asarray(img, dtype=np.int64).reshape(Y_SIZE, X_SIZE)

            # 主区域横向
            bh = self._bounds(y - 1, yy, x - 1, xx - 1)
            # 主区域纵向
            bv = self._bounds(y - 1, yy - 1, x - 1, xx)
            if bh is None and bv is None:
                # fallback: 用 Img1，20x20（横向 j∈[0,18] 比较 j 与 j+1，纵向 i∈[0,18]）
                img1 = self.eng.twoimg.get("Img1")
                if img1 is None:
                    img1 = img
                a1 = np.asarray(img1, dtype=np.int64).reshape(Y_SIZE, X_SIZE)
                total = 0
                # 横向: i∈[0,19], j∈[0,18]，比较 a1[i][j] 与 a1[i][j+1]
                d = np.abs(a1[0:20, 0:19] - a1[0:20, 1:20])
                total += int(d[d > 10].sum())
                # 纵向: i∈[0,18], j∈[0,19]，比较 a1[i][j] 与 a1[i+1][j]
                d = np.abs(a1[0:19, 0:20] - a1[1:20, 0:20])
                total += int(d[d > 10].sum())
            else:
                total = 0
                if bh is not None:
                    # 横向：j ∈ [j0, j1]，比较 j 与 j+1（C++ 不检查 j+1 越界，故列区间为 [j0, j1+1]）
                    d = np.abs(arr[bh[0]:bh[1], bh[2]:bh[3]] - arr[bh[0]:bh[1], bh[2] + 1:bh[3] + 1])
                    total += int(d[d > 10].sum())
                if bv is not None:
                    # 纵向：i ∈ [i0, i1]，比较 i 与 i+1
                    d = np.abs(arr[bv[0]:bv[1], bv[2]:bv[3]] - arr[bv[0] + 1:bv[1] + 1, bv[2]:bv[3]])
                    total += int(d[d > 10].sum())
            if total > 65535:
                total = 65535
            return total
        except Exception as exc:
            get_logger().error("Rinsetu2 异常: %s\n%s", exc, traceback.format_exc())
            raise

    # ------------------------------------------------------------------//
    # RINSETU — C_SI2.CPP:1050-1148
    # ------------------------------------------------------------------//
    def RINSETU(self, x, y, xx, yy, img):
        """邻接微分。横向 i>=y && i<yy && j>=x && j<xx-1；纵向 i>=y && i<yy-1 && j>=x && j<xx。
        c==0 退化为 20x20（用传入 img）。"""
        try:
            x, y, xx, yy = self._adjust(x, y, xx, yy)
            arr = np.asarray(img, dtype=np.int64).reshape(Y_SIZE, X_SIZE)

            bh = self._bounds(y - 1, yy, x - 1, xx - 1)
            bv = self._bounds(y - 1, yy - 1, x - 1, xx)
            if bh is None and bv is None:
                # fallback 20x20。原版 C_SI2.CPP:1111-1141 内层循环没有 img++，
                # 导致指针固定，结果 = 380 * |buf[0]-buf[1]| (若>10) + 380 * |buf[0]-buf[X_SIZE]| (若>10)
                b0 = int(arr[0, 0])
                d1 = abs(b0 - int(arr[0, 1]))
                d2 = abs(b0 - int(arr[1, 0]))
                total = 0
                if 10 < d1:
                    total += 380 * d1
                if 10 < d2:
                    total += 380 * d2
            else:
                total = 0
                if bh is not None:
                    d = np.abs(arr[bh[0]:bh[1], bh[2]:bh[3]] - arr[bh[0]:bh[1], bh[2] + 1:bh[3] + 1])
                    total += int(d[d > 10].sum())
                if bv is not None:
                    d = np.abs(arr[bv[0]:bv[1], bv[2]:bv[3]] - arr[bv[0] + 1:bv[1] + 1, bv[2]:bv[3]])
                    total += int(d[d > 10].sum())
            if total < 0:
                total = 0
            if total > 65535:
                total = 65535
            return total
        except Exception as exc:
            get_logger().error("RINSETU 异常: %s\n%s", exc, traceback.format_exc())
            raise

    # ------------------------------------------------------------------//
    # sikisa — C_SI2.CPP:859-870
    # ------------------------------------------------------------------//
    def sikisa(self):
        """色差：sum(abs(small[i] - small[i+220])), i=0..219。"""
        try:
            if self.small_image.size < 440:
                return 0
            sa = 0
            for i in range(220):
                sa += abs(int(self.small_image[i]) - int(self.small_image[i + 220]))
            return sa
        except Exception as exc:
            get_logger().error("sikisa 异常: %s\n%s", exc, traceback.format_exc())
            raise

    # ------------------------------------------------------------------//
    # Suka_Kyotyo — C_SI2.CPP:1154-1199
    # ------------------------------------------------------------------//
    def Suka_Kyotyo(self, x, y, xx, yy, img):
        """すかし赤外強調：区域 i>y && i<yy-1 && j>x && j<xx-1，累加(BYTE)img，
        c==0 退化 20x20（i>0 && i<19 && j>0 && j<19）。"""
        try:
            x, y, xx, yy = self._adjust(x, y, xx, yy)
            arr = np.asarray(img, dtype=np.int64).reshape(Y_SIZE, X_SIZE)

            b = self._bounds(y, yy - 1, x, xx - 1)
            if b is None:
                # fallback: arr[1:19, 1:19]
                ct = int((arr[1:19, 1:19] & 0xff).sum())
            else:
                ct = int((arr[b[0]:b[1], b[2]:b[3]] & 0xff).sum())
            ct = ct >> 2
            if ct > 65535:
                ct = 65535
            return ct
        except Exception as exc:
            get_logger().error("Suka_Kyotyo 异常: %s\n%s", exc, traceback.format_exc())
            raise

    # ------------------------------------------------------------------//
    # Siki_Kyotyo — C_SI2.CPP:1205-1255
    # ------------------------------------------------------------------//
    def Siki_Kyotyo(self, x, y, xx, yy, img):
        """すかし色差強調：区域 i>y+1 && i<yy-2 && j>x+1 && j<xx-2，
        c==0 退化 20x20（i>1 && i<18 && j>1 && j<18）。"""
        try:
            x, y, xx, yy = self._adjust(x, y, xx, yy)
            arr = np.asarray(img, dtype=np.int64).reshape(Y_SIZE, X_SIZE)

            b = self._bounds(y + 1, yy - 2, x + 1, xx - 2)
            if b is None:
                # fallback 20x20。原版 C_SI2.CPP:1235-1244 内层循环没有 img++，
                # 指针固定，结果 = 256 * buf[0]（16*16 个满足条件的像素）
                ct = 256 * int(arr[0, 0])
            else:
                ct = int(arr[b[0]:b[1], b[2]:b[3]].sum())
            ct = ct >> 2
            if ct > 65535:
                ct = 65535
            return ct
        except Exception as exc:
            get_logger().error("Siki_Kyotyo 异常: %s\n%s", exc, traceback.format_exc())
            raise

    # ------------------------------------------------------------------//
    # infrared_white_ratio2 — C_SI2.CPP:432-463
    # ------------------------------------------------------------------//
    def infrared_white_ratio2(self, x, y, xx, yy, img):
        """赤外白率：i>y && i<=yy && j>x && j<=xx，非零像素计数。"""
        try:
            x, y, xx, yy = self._adjust(x, y, xx, yy)
            b = self._bounds(y, yy + 1, x, xx + 1)
            if b is None:
                return 0
            arr = np.asarray(img, dtype=np.int64).reshape(Y_SIZE, X_SIZE)
            sub = arr[b[0]:b[1], b[2]:b[3]]
            return int((sub != 0).sum())
        except Exception as exc:
            get_logger().error("infrared_white_ratio2 异常: %s\n%s", exc, traceback.format_exc())
            raise

    # ------------------------------------------------------------------//
    # img_datecount — C_SI2.CPP:1312-1348
    # ------------------------------------------------------------------//
    def img_datecount(self, x, y, xx, yy, minv, maxv, img, itype):
        """指定画素值计数（min<=val<=max）。
        type0: i>y && i<yy-1 && j>x && j<xx-1（外圈1像素去掉）
        type1: i>=y && i<yy && j>=x && j<xx（区域整体）"""
        try:
            x, y, xx, yy = self._adjust(x, y, xx, yy)
            if itype == 0:
                b = self._bounds(y, yy - 1, x, xx - 1)
            else:
                b = self._bounds(y - 1, yy, x - 1, xx)
            if b is None:
                return 0
            arr = np.asarray(img, dtype=np.int64).reshape(Y_SIZE, X_SIZE)
            sub = arr[b[0]:b[1], b[2]:b[3]]
            return int(((sub >= minv) & (sub <= maxv)).sum())
        except Exception as exc:
            get_logger().error("img_datecount 异常: %s\n%s", exc, traceback.format_exc())
            raise

    # ------------------------------------------------------------------//
    # soil_ — C_SI2.CPP:669-714
    # ------------------------------------------------------------------//
    def soil_(self, x, y, xx, yy, img):
        """旧汚れ：区域 i>y-1 && i<yy && j>x-1 && j<xx 整体累加；ct==0 退化为 20x20。"""
        try:
            x, y, xx, yy = self._adjust(x, y, xx, yy)
            arr = np.asarray(img, dtype=np.int64).reshape(Y_SIZE, X_SIZE)

            b = self._bounds(y - 1, yy, x - 1, xx)
            if b is None:
                return int(arr[0:20, 0:20].sum())
            return int(arr[b[0]:b[1], b[2]:b[3]].sum())
        except Exception as exc:
            get_logger().error("soil_ 异常: %s\n%s", exc, traceback.format_exc())
            raise

    # ------------------------------------------------------------------//
    # soil2_ — C_SI2.CPP:760-806
    # ------------------------------------------------------------------//
    def soil2_(self, x, y, xx, yy, img):
        """新汚れ：区域 i>y-1 && i<yy && j>x-1 && j<xx 中 >=206 像素计数；ct==0 退化 20x20。"""
        try:
            x, y, xx, yy = self._adjust(x, y, xx, yy)
            arr = np.asarray(img, dtype=np.int64).reshape(Y_SIZE, X_SIZE)

            b = self._bounds(y - 1, yy, x - 1, xx)
            if b is None:
                return int((arr[0:20, 0:20] >= 206).sum())
            return int((arr[b[0]:b[1], b[2]:b[3]] >= 206).sum())
        except Exception as exc:
            get_logger().error("soil2_ 异常: %s\n%s", exc, traceback.format_exc())
            raise

    # ------------------------------------------------------------------//
    # soil_soil — C_SI2.CPP:1261-1294
    # ------------------------------------------------------------------//
    def soil_soil(self):
        """新汚れ(和田式)：avg(Yogore区域,Img3,type1)>>4 + (S2[2]+S2[11])/2，然后 0xffff -。"""
        try:
            x = self.zp.get("Yogore_LeftX", [0] * (self.kin + 1))[self.kin]
            y = self.zp.get("Yogore_LeftY", [0] * (self.kin + 1))[self.kin]
            xx = self.zp.get("Yogore_RightX", [0] * (self.kin + 1))[self.kin]
            yy = self.zp.get("Yogore_RightY", [0] * (self.kin + 1))[self.kin]
            img3 = self.eng.twoimg.get("Img3")
            img1 = self.eng.twoimg.get("Img1")
            if img1 is None:
                img1 = img3
            if xx and yy:
                if img3 is None:
                    raise ValueError("soil_soil 需要 twoimg.Img3")
                ret = self.average_concentration2(x, y, xx, yy, img3, 1)
            else:
                # 原版 C_SI2.CPP:1286 fallback 用 Img1
                ret = self.average_concentration2(0, 0, 20, 20, img1, 1)
            ans = ret >> 4
            s2_2 = self.s2[2] if self.s2 and len(self.s2) > 2 else 0
            s2_11 = self.s2[11] if self.s2 and len(self.s2) > 11 else 0
            ans += s2_2 + s2_11
            ans = ans >> 1
            ans = 0xffff - ans
            return ans & 0xffff
        except Exception as exc:
            get_logger().error("soil_soil 异常: %s\n%s", exc, traceback.format_exc())
            raise

    # 供 soil_soil 使用的 S2 结果暂存
    s2 = None
