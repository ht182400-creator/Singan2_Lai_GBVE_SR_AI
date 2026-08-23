# -*- coding: utf-8 -*-
"""
all32.py — ALL32 计算主流程复刻（S2[1..16] 共通函数部分）

复刻来源: ALL32.cpp ALL32(hDlg)
流程（严格按 ALL32.cpp 顺序）:
  段1 梯度なし・二値化なし: sikisa(S2[12]), Rinsetu2(S2[1]), soil_(etc[10])
  段2 赤外と緑の差分:       average_concentration2(type=2) (S2[2])
  段3 梯度あり・二値化なし:  Gradient Sobel; S2[5]/S2[7]/S2[13]
  段4 梯度あり・二値化あり:  Gradient Sobel + NITI; S2[6]/S2[8]
  段5 梯度なし・二値化:      NITI; S2[14]/S2[15]/S2[16]
  段6 既存すかし(20x20):    Gradient Normal amp16; S2[3]/S2[4]
  段7 邻接微分:             RINSETU (S2[9])
  段8 すかし強調:           Suka_Kyotyo (S2[10])
  段9 色差強調:             smooth + Gradient Sobel; Siki_Kyotyo (S2[11])
  S2[17..32] 国家专用（暂留接口，后续按国家实现）
"""
import numpy as np
import logging
import traceback

from .c_si2 import C_SI2

MAX_FUNC = 32


def get_logger():
    return logging.getLogger("all32")


class All32Engine:
    """ALL32 计算引擎。"""

    def __init__(self, img_engine, zparam, kin=1, ztype=False, small_image=None,
                 select_country=0):
        self.eng = img_engine
        self.zp = zparam
        self.kin = kin
        self.ztype = ztype
        self.small_image = small_image
        self.country = select_country
        self.s2 = [0] * (MAX_FUNC + 1)   # S2[0..32]
        self.etc = [0] * 15               # global_etc[0..14]
        self.csi2 = C_SI2(img_engine, zparam, kin, ztype, small_image)
        self.csi2.s2 = self.s2

    def _zname(self, prefix, field):
        """从 zparam 取 KIN 索引值。"""
        key = "%s_%s" % (prefix, field)
        arr = self.zp.get(key)
        if arr is None:
            return 0
        return arr[self.kin] if self.kin < len(arr) else 0

    def run(self):
        """执行全部 S2 计算。返回 (s2_list, etc_list)。

        s2_list: S2[1..32]（索引0为0）
        etc_list: global_etc[0..14]
        """
        try:
            eng = self.eng
            # ------------------------------------------------------------------//
            # 段1 梯度なし・二値化なし
            # ------------------------------------------------------------------//
            self.s2[12] = self.csi2.sikisa() & 0xffff

            self.s2[1] = self.csi2.Rinsetu2(
                self._zname("old_sukasi", "LeftX"), self._zname("old_sukasi", "LeftY"),
                self._zname("old_sukasi", "RightX"), self._zname("old_sukasi", "RightY"),
                eng.twoimg.get("Img2"))

            # 旧汚れ
            xx = self._zname("Yogore", "RightX")
            yy = self._zname("Yogore", "RightY")
            if xx and yy:
                yogore = self.csi2.soil_(
                    self._zname("Yogore", "LeftX"), self._zname("Yogore", "LeftY"),
                    xx, yy, eng.twoimg.get("Img3"))
            else:
                yogore = self.csi2.soil_(0, 0, 20, 20, eng.twoimg.get("Img1"))
            self.etc[10] = (yogore >> 2) & 0xffff
            self.etc[10] = 0xffff - self.etc[10]

            # ------------------------------------------------------------------//
            # 段2 赤外と緑の差分
            # ------------------------------------------------------------------//
            sa = self.csi2.average_concentration2(
                self._zname("old_sukasi", "LeftX"), self._zname("old_sukasi", "LeftY"),
                self._zname("old_sukasi", "RightX"), self._zname("old_sukasi", "RightY"),
                eng.twoimg.get("Img1"), 2)
            sa *= -1
            if sa < 0:
                self.s2[2] = 1
            else:
                self.s2[2] = sa & 0xffff

            # ------------------------------------------------------------------//
            # 段3 梯度あり・二値化なし（Gradient Sobel amp1）
            # ------------------------------------------------------------------//
            eng.tab_no = 0
            eng.gradient(0, 1)   # Sobel, amp=1
            img1 = eng.twoimg.get("Img1").copy()
            eng.tab_no = 1
            eng.gradient(0, 1)
            img2 = eng.twoimg.get("Img2").copy()

            # すかし1
            if self._zname("Sukasi1", "RightX") and self._zname("Sukasi1", "RightY"):
                ct = self.csi2.average_concentration2(
                    self._zname("Sukasi1", "LeftX"), self._zname("Sukasi1", "LeftY"),
                    self._zname("Sukasi1", "RightX"), self._zname("Sukasi1", "RightY"),
                    img1, 0)
                ct = ct >> 2
                if ct > 65535:
                    ct = 65535
                self.s2[5] = ct & 0xffff

                ct = self.csi2.average_concentration2(
                    self._zname("Sukasi1", "LeftX"), self._zname("Sukasi1", "LeftY"),
                    self._zname("Sukasi1", "RightX"), self._zname("Sukasi1", "RightY"),
                    img2, 0)
                ct = ct >> 2
                if ct > 65535:
                    ct = 65535
                self.s2[7] = ct & 0xffff
            else:
                self.s2[5] = 0
                self.s2[7] = 0

            # Thread
            if self._zname("Thred", "RightX") and self._zname("Thred", "RightY"):
                ct = self.csi2.average_concentration2(
                    self._zname("Thred", "LeftX"), self._zname("Thred", "LeftY"),
                    self._zname("Thred", "RightX"), self._zname("Thred", "RightY"),
                    img1, 0)
                ct = ct >> 2
                if ct > 65535:
                    ct = 65355
                self.s2[13] = ct & 0xffff
            else:
                self.s2[13] = 0

            # ------------------------------------------------------------------//
            # 段4 梯度あり・二値化あり（NITI + Gradient）
            # ------------------------------------------------------------------//
            eng.to_2byte()   # 恢复原始图像
            eng.tab_no = 0
            eng.gradient(0, 1)
            eng.tab_no = 1
            eng.gradient(0, 1)

            eng.tab_no = 0
            eng.niti(self._zname("Sukasi1", "niti_1"))
            eng.tab_no = 1
            eng.niti(self._zname("Sukasi1", "niti_2"))

            if self._zname("Sukasi1", "RightX") and self._zname("Sukasi1", "RightY"):
                self.s2[6] = self.csi2.monochrome_ratio2(
                    self._zname("Sukasi1", "LeftX"), self._zname("Sukasi1", "LeftY"),
                    self._zname("Sukasi1", "RightX"), self._zname("Sukasi1", "RightY"),
                    eng.twoimg.get("Img1"))
                self.s2[8] = self.csi2.monochrome_ratio2(
                    self._zname("Sukasi1", "LeftX"), self._zname("Sukasi1", "LeftY"),
                    self._zname("Sukasi1", "RightX"), self._zname("Sukasi1", "RightY"),
                    eng.twoimg.get("Img2"))
            else:
                self.s2[6] = 0
                self.s2[8] = 0

            # ------------------------------------------------------------------//
            # 段5 梯度なし・二値化（赤外白率）
            # ------------------------------------------------------------------//
            eng.to_2byte()
            eng.tab_no = 0
            eng.niti(self._zname("Sekigai1", "niti_1"))
            self.s2[14] = self.csi2.infrared_white_ratio2(
                self._zname("Sekigai1", "LeftX"), self._zname("Sekigai1", "LeftY"),
                self._zname("Sekigai1", "RightX"), self._zname("Sekigai1", "RightY"),
                eng.twoimg.get("Img1"))

            eng.to_2byte()
            eng.tab_no = 0
            eng.niti(self._zname("Sekigai2", "niti_1"))
            self.s2[15] = self.csi2.infrared_white_ratio2(
                self._zname("Sekigai2", "LeftX"), self._zname("Sekigai2", "LeftY"),
                self._zname("Sekigai2", "RightX"), self._zname("Sekigai2", "RightY"),
                eng.twoimg.get("Img1"))

            eng.to_2byte()
            eng.tab_no = 0
            eng.niti(self._zname("Sekigai3", "niti_1"))
            self.s2[16] = self.csi2.infrared_white_ratio2(
                self._zname("Sekigai3", "LeftX"), self._zname("Sekigai3", "LeftY"),
                self._zname("Sekigai3", "RightX"), self._zname("Sekigai3", "RightY"),
                eng.twoimg.get("Img1"))

            # ------------------------------------------------------------------//
            # 段6 既存すかし（20x20, Gradient Normal amp16）
            # ------------------------------------------------------------------//
            eng.to_2byte()
            eng.tab_no = 0
            eng.gradient(2, 16)
            eng.tab_no = 1
            eng.gradient(2, 16)

            if self._zname("old_sukasi", "RightX") and self._zname("old_sukasi", "RightY"):
                ct = self.csi2.average_concentration2(
                    self._zname("old_sukasi", "LeftX"), self._zname("old_sukasi", "LeftY"),
                    self._zname("old_sukasi", "RightX"), self._zname("old_sukasi", "RightY"),
                    eng.twoimg.get("Img1"), 0)
                if ct > 65535:
                    ct = 65535
                if ct < 0:
                    ct = 0
                self.s2[3] = ct & 0xffff

                ct = self.csi2.average_concentration2(
                    self._zname("old_sukasi", "LeftX"), self._zname("old_sukasi", "LeftY"),
                    self._zname("old_sukasi", "RightX"), self._zname("old_sukasi", "RightY"),
                    eng.twoimg.get("Img2"), 0)
                if ct > 65535:
                    ct = 65535
                if ct < 0:
                    ct = 0
                self.s2[4] = ct & 0xffff
            else:
                self.s2[3] = 0
                self.s2[4] = 0

            # ------------------------------------------------------------------//
            # 段7 邻接微分 RINSETU
            # ------------------------------------------------------------------//
            eng.to_2byte()
            ct = self.csi2.RINSETU(
                self._zname("Sukasi1", "LeftX"), self._zname("Sukasi1", "LeftY"),
                self._zname("Sukasi1", "RightX"), self._zname("Sukasi1", "RightY"),
                eng.twoimg.get("Img1"))
            if ct > 65535:
                ct = 65535
            self.s2[9] = ct & 0xffff

            # ------------------------------------------------------------------//
            # 段8 すかし強調
            # ------------------------------------------------------------------//
            eng.to_2byte()
            eng.tab_no = 6
            eng.gradient(0, 1)
            ct = self.csi2.Suka_Kyotyo(
                self._zname("Sukasi1", "LeftX"), self._zname("Sukasi1", "LeftY"),
                self._zname("Sukasi1", "RightX"), self._zname("Sukasi1", "RightY"),
                eng.twoimg.get("Img7"))
            if ct > 65535:
                ct = 65535
            self.s2[10] = ct & 0xffff

            # ------------------------------------------------------------------//
            # 段9 色差強調（smooth + Gradient Sobel）
            # ------------------------------------------------------------------//
            eng.to_2byte()
            eng.tab_no = 11
            eng.smooth()
            eng.gradient(0, 1)
            ct = self.csi2.Siki_Kyotyo(
                self._zname("Sukasi1", "LeftX"), self._zname("Sukasi1", "LeftY"),
                self._zname("Sukasi1", "RightX"), self._zname("Sukasi1", "RightY"),
                eng.twoimg.get("Img12"))
            if ct > 65535:
                ct = 65535
            self.s2[11] = ct & 0xffff

            # ------------------------------------------------------------------//
            # S2[17..32] 国家专用（暂留接口）
            # ------------------------------------------------------------------//
            # TODO: 按 global_SelectCountry 分派（Euro_/USA_/China_/HongKong_/...）

            # soil_soil (etc[11])
            self.etc[11] = self.csi2.soil_soil() & 0xffff

            get_logger().info("ALL32 计算完成: S2[1..16]=%s", self.s2[1:17])
            return self.s2, self.etc
        except Exception as exc:
            get_logger().error("ALL32 异常: %s\n%s", exc, traceback.format_exc())
            raise
