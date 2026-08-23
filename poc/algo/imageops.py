# -*- coding: utf-8 -*-
"""
imageops.py — SINGAN2 图像处理基础函数（Python 复刻）

复刻来源（按文件）：
  - GRADIENT.CPP  :: Gradient(type, amp)        Sobel/Roberts/通常 梯度
  - NITI.CPP      :: NITI(s)                    单纯二值化
  - smooth_median.cpp :: smooth()              移动平均法
  - To2byte.cpp   :: To2byte()                 1字节->2字节拷贝
  - To2byte_orver_write.cpp :: To2byte_orver_write() 处理结果写回 global_twoimg
  - MainRun.cpp   :: Inimg()                    按 TabNo 选择原始图像
  - bvmath.cpp    :: Rute() / Old_Rute()        DSP 平方根

设计：
  - 全部用 numpy 向量化，结果与 C++ 逐像素计算一致
  - 图像以二维数组 (Y_SIZE, X_SIZE) 或一维数组表示
"""
import math
import numpy as np
import logging
import traceback

# ----------------------------------------------------------------------------
# 常量（与 MAIN.H / 各算法文件一致）
# ----------------------------------------------------------------------------
Y_SIZE = 88
X_SIZE = 186
ONESIZE = Y_SIZE * X_SIZE

# w_Table 大小（GBV_DIV_H.bin 大小 / 2）
W_TABLE_SIZE = 32768 // 2


def get_logger():
    return logging.getLogger("imageops")


class ImageEngine:
    """图像处理引擎：持有 global_oneimg / global_twoimg / w_Table 等全局状态。

    对应 C++ 全局量：global_oneimg, global_twoimg, global_TabNo, w_Table。
    """

    def __init__(self, w_table=None):
        # global_oneimg: 1字节图像 (Y_SIZE, X_SIZE)，名 Img1..Img15
        self.oneimg = {}
        # global_twoimg: 2字节图像 (Y_SIZE, X_SIZE)
        self.twoimg = {}
        # 当前处理波段号（对应 global_TabNo）
        self.tab_no = 0
        # 除法表 w_Table（长度 16384，w_Table[n] 约等于 65536/n）
        self.w_table = w_table if w_table is not None else np.zeros(W_TABLE_SIZE, dtype=np.uint16)

    # ------------------------------------------------------------------//
    # 数据准备
    # ------------------------------------------------------------------//
    def set_oneimg(self, img_dict):
        """从波段图像字典填充 global_oneimg（Img1..Img22）。

        参数:
            img_dict: {波段名: np.ndarray(ONESIZE,)} 来自 mariner_reader.build_onebyte_images
        """
        try:
            for name, buf in img_dict.items():
                arr = np.frombuffer(bytes(buf), dtype=np.uint8).reshape(Y_SIZE, X_SIZE)
                self.oneimg[name] = arr
            logger = get_logger()
            logger.debug("oneimg 波段: %s", sorted(self.oneimg.keys()))
        except Exception as exc:
            get_logger().error("set_oneimg 异常: %s\n%s", exc, traceback.format_exc())
            raise

    def to_2byte(self):
        """To2byte(): 把 global_oneimg 的 Img1..Img22 拷贝到 global_twoimg。"""
        try:
            for i in range(1, 23):
                key = "Img%d" % i
                if key in self.oneimg:
                    self.twoimg[key] = self.oneimg[key].astype(np.uint16)
        except Exception as exc:
            get_logger().error("to_2byte 异常: %s\n%s", exc, traceback.format_exc())
            raise

    def compute_intermediate_waves(self, red_offset=128, grn_offset=128):
        """ReadImgDataNew 中间波段计算（MainRun.cpp:908-1021 对应部分）。

        计算 Img7..Img15（写入 oneimg），并把 Img1..22 全部拷贝到 twoimg。
           Img7  = Img1^2 / 64            (clamp 0..255)
           Img8  = Img1 - Img3 + red_offset   (clamp 0..255)
           Img9  = Img2 - Img3 + grn_offset   (clamp 0..255)
           Img10 = abs(Img1 - Img2)           (clamp 0..255)
           Img11 = Img1 - Img2                (clamp 0..255)
           Img12 = (Img1-Img2)^2 / 8          (clamp 0..255)
           Img13 = Img2 - Img1                (clamp 0..255)
           Img14 = Img1 & Img2
           Img15 = Img1 | Img2
        """
        try:
            i1 = self.oneimg["Img1"].astype(np.int64)
            i2 = self.oneimg["Img2"].astype(np.int64)
            i3 = self.oneimg["Img3"].astype(np.int64)

            def clamp(dat):
                return np.clip(dat, 0, 255).astype(np.uint8)

            w64 = int(self.w_table[64]) if len(self.w_table) > 64 else 0
            w8 = int(self.w_table[8]) if len(self.w_table) > 8 else 0

            self.oneimg["Img7"] = clamp((i1 * i1) * w64 >> 16)
            self.oneimg["Img8"] = clamp(i1 - i3 + red_offset)
            self.oneimg["Img9"] = clamp(i2 - i3 + grn_offset)
            self.oneimg["Img10"] = clamp(np.abs(i1 - i2))
            self.oneimg["Img11"] = clamp(i1 - i2)
            self.oneimg["Img12"] = clamp((i1 - i2) * (i1 - i2) * w8 >> 16)
            self.oneimg["Img13"] = clamp(i2 - i1)
            self.oneimg["Img14"] = clamp(np.bitwise_and(self.oneimg["Img1"].astype(np.int64),
                                                        self.oneimg["Img2"].astype(np.int64)))
            self.oneimg["Img15"] = clamp(np.bitwise_or(self.oneimg["Img1"].astype(np.int64),
                                                       self.oneimg["Img2"].astype(np.int64)))
            self.to_2byte()
            get_logger().debug("compute_intermediate_waves 完成: oneimg=%s",
                               sorted(self.oneimg.keys()))
        except Exception as exc:
            get_logger().error("compute_intermediate_waves 异常: %s\n%s", exc, traceback.format_exc())
            raise

    def inimg(self):
        """Inimg(): 按 global_TabNo 选择原始图像，返回 (img1byte, img2byte)。

        img1byte: 1字节图像 (Y_SIZE, X_SIZE)
        img2byte: 2字节图像 (Y_SIZE, X_SIZE)
        """
        try:
            tab = self.tab_no
            key1 = "Img%d" % (tab + 1)
            key2 = "Img%d" % (tab + 1)
            if key1 not in self.oneimg:
                raise ValueError("oneimg 缺少 %s" % key1)
            img1byte = self.oneimg[key1].copy()
            img2byte = self.twoimg.get(key2, np.zeros((Y_SIZE, X_SIZE), dtype=np.uint16)).copy()
            return img1byte, img2byte
        except Exception as exc:
            get_logger().error("inimg 异常: %s\n%s", exc, traceback.format_exc())
            raise

    def to_2byte_orver_write(self, img2byte):
        """To2byte_orver_write(): 处理结果写回 global_twoimg.Img{tab_no+1}。"""
        try:
            tab = self.tab_no
            key = "Img%d" % (tab + 1)
            self.twoimg[key] = np.asarray(img2byte, dtype=np.uint16).reshape(Y_SIZE, X_SIZE)
        except Exception as exc:
            get_logger().error("to_2byte_orver_write 异常: %s\n%s", exc, traceback.format_exc())
            raise

    # ------------------------------------------------------------------//
    # 梯度
    # ------------------------------------------------------------------//
    @staticmethod
    def _gradient_kernels(gtype):
        """返回 (cx, cy) 3x3 卷积核。gtype: 0=Sobel 1=Roberts 2=通常"""
        if gtype == 0:
            cx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.int64)
            cy = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=np.int64)
        elif gtype == 1:
            cx = np.array([[0, 0, 0], [0, 1, 0], [0, 0, -1]], dtype=np.int64)
            cy = np.array([[0, 0, 0], [0, 0, 1], [0, -1, 0]], dtype=np.int64)
        else:  # 2: 通常
            cx = np.array([[0, 0, 0], [0, 1, -1], [0, 0, 0]], dtype=np.int64)
            cy = np.array([[0, 0, 0], [0, 1, 0], [0, -1, 0]], dtype=np.int64)
        return cx, cy

    def gradient(self, gtype, amp):
        """Gradient(type, amp): 梯度处理，结果写回 twoimg.Img{tab_no+1}。

        对应 GRADIENT.CPP Gradient()。逐像素:
          xx = sum(cx[k]*d[k])  yy = sum(cy[k]*d[k])
          case 0/1: xxyy = Rute(xx^2+yy^2, 0, 0x100); zz=amp*xxyy; clamp [0,255]
          case 2:   xxyy = Old_Rute(xx^2+yy^2); if<=15 ->0; zz=amp*xxyy; (USHORT截断)
        仅处理内部区域 i∈[1,Y-2], j∈[1,X-2]；边界像素保持 twoimg 原始值（Inimg 拷贝）。
        """
        try:
            img1byte, img2byte = self.inimg()
            cx, cy = self._gradient_kernels(gtype)
            # 扩展图像边缘（C++ 从 i=1..Y-2, j=1..X-2）
            padded = np.pad(img1byte.astype(np.int64), 1, mode="constant", constant_values=0)
            # 计算 xx, yy
            xx = (cx[0, 0] * padded[0:-2, 0:-2] + cx[0, 1] * padded[0:-2, 1:-1] + cx[0, 2] * padded[0:-2, 2:]
                  + cx[1, 0] * padded[1:-1, 0:-2] + cx[1, 1] * padded[1:-1, 1:-1] + cx[1, 2] * padded[1:-1, 2:]
                  + cx[2, 0] * padded[2:, 0:-2] + cx[2, 1] * padded[2:, 1:-1] + cx[2, 2] * padded[2:, 2:])
            yy = (cy[0, 0] * padded[0:-2, 0:-2] + cy[0, 1] * padded[0:-2, 1:-1] + cy[0, 2] * padded[0:-2, 2:]
                  + cy[1, 0] * padded[1:-1, 0:-2] + cy[1, 1] * padded[1:-1, 1:-1] + cy[1, 2] * padded[1:-1, 2:]
                  + cy[2, 0] * padded[2:, 0:-2] + cy[2, 1] * padded[2:, 1:-1] + cy[2, 2] * padded[2:, 2:])
            xxyy = xx * xx + yy * yy

            if gtype in (0, 1):
                # Rute 二分迭代平方根（Rute(xxyy, 0, 0x100)）
                out = np.empty_like(xxyy, dtype=np.int64)
                for idx in range(xxyy.size):
                    out.flat[idx] = self._rute(int(xxyy.flat[idx]), 0, 0x0100, self.w_table)
                # 利得: zz = amp * xxyy; clamp [0,255]
                zz = amp * out
                zz = np.clip(zz, 0, 255)
            else:
                # Old_Rute 线性平方根
                out = np.empty_like(xxyy, dtype=np.int64)
                for idx in range(xxyy.size):
                    v = int(xxyy.flat[idx])
                    r = self._old_rute(v)
                    out.flat[idx] = r if r > 15 else 0
                # 利得: zz = amp * xxyy; USHORT 截断(溢出取低16位)
                zz = (amp * out) & 0xffff
            # 只写内部区域，边界保持 twoimg 原始值
            result = np.asarray(img2byte, dtype=np.int64).copy()
            result[1:Y_SIZE - 1, 1:X_SIZE - 1] = zz[1:Y_SIZE - 1, 1:X_SIZE - 1]
            self.to_2byte_orver_write(result.astype(np.uint16))
        except Exception as exc:
            get_logger().error("gradient 异常: %s\n%s", exc, traceback.format_exc())
            raise

    @staticmethod
    def _rute(u_bunsan, left_threashold, right_threashold, w_table):
        """Rute(): 二分迭代平方根（bvmath.cpp Rute）。

        7 次迭代：if center^2 < uBunsan: left=center else right=center
        然后 center = (left+right)*w_Table[2]>>16。
        """
        center = 0x80
        w2 = int(w_table[2]) if w_table is not None else 32768
        for _ in range(7):
            if center * center < u_bunsan:
                left_threashold = center
                center = ((left_threashold + right_threashold) * w2) >> 16
            else:
                right_threashold = center
                center = ((left_threashold + right_threashold) * w2) >> 16
        left_threashold = center
        center = ((left_threashold + right_threashold) * w2) >> 16
        return center

    @staticmethod
    def _old_rute(u_bunsan):
        """Old_Rute(): 线性平方根（bvmath.cpp Old_Rute）。"""
        i = 0
        while True:
            if i * i > u_bunsan:
                return i - 1
            i += 1

    # ------------------------------------------------------------------//
    # 二值化
    # ------------------------------------------------------------------//
    def niti(self, s):
        """NITI(s): 单纯二值化，>=s 置 0xff，否则 0，写回 twoimg.Img{tab_no+1}。"""
        try:
            img1byte, _ = self.inimg()
            out = np.where(img1byte >= s, 0xff, 0).astype(np.uint16)
            self.to_2byte_orver_write(out)
        except Exception as exc:
            get_logger().error("niti 异常: %s\n%s", exc, traceback.format_exc())
            raise

    # ------------------------------------------------------------------//
    # 移动平均（smooth）
    # ------------------------------------------------------------------//
    def smooth(self):
        """smooth(): 移动平均（smooth_median.cpp:61-110）。

        仅处理内部区域 i∈[1,Y-2], j∈[1,X-2]：
          buf = (3x3 和) * w_Table[9] >> 16 + 中心像素；clamp 255
        边界像素保持 twoimg 原始值。
        """
        try:
            img1byte, img2byte = self.inimg()
            padded = np.pad(img1byte.astype(np.int64), 1, mode="constant", constant_values=0)
            buf = (padded[0:-2, 0:-2] + padded[0:-2, 1:-1] + padded[0:-2, 2:]
                   + padded[1:-1, 0:-2] + padded[1:-1, 1:-1] + padded[1:-1, 2:]
                   + padded[2:, 0:-2] + padded[2:, 1:-1] + padded[2:, 2:])
            # buf * w_Table[9] >> 16（w_Table[9]≈7282），再加中心像素，clamp 255
            out = (buf * int(self.w_table[9])) >> 16
            out += img1byte.astype(np.int64)
            out = np.clip(out, 0, 255)
            result = np.asarray(img2byte, dtype=np.int64).copy()
            result[1:Y_SIZE - 1, 1:X_SIZE - 1] = out[1:Y_SIZE - 1, 1:X_SIZE - 1]
            self.to_2byte_orver_write(result.astype(np.uint16))
        except Exception as exc:
            get_logger().error("smooth 异常: %s\n%s", exc, traceback.format_exc())
            raise
