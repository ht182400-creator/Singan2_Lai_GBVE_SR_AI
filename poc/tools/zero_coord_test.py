# -*- coding: utf-8 -*-
"""zero_coord_test.py — 验证 a.csv 是否在 Z 坐标全 0 状态下导出"""
import os
import sys
import logging

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
POC_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, POC_DIR)

from parse.mariner_reader import extract_mm1_side, build_onebyte_images, extract_small_image
from parse.zahyo_reader import parse_zahyo, _new_zahyo_param
from algo.imageops import ImageEngine
from algo.wtable import load_w_table
from algo.all32 import All32Engine

DAT = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\ZAR\2A_DA_111017_115542.dat"
ZFILE = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\ZAR\X_ATB_ZAR_132006050001.txt"
WTABLE = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug\GBV_DIV_H.bin"
CSV = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug\a.csv"


def main():
    logging.basicConfig(level=logging.WARNING, format="%(levelname)-5s %(message)s")
    import csv as _csv
    rows = list(_csv.reader(open(CSV, encoding="gbk", errors="replace")))
    exp = [int(rows[0][j]) for j in range(1, 33)]
    logging.warning("a.csv 期望: S2[1..16]=%s", exp[:16])

    global_onedat = extract_mm1_side(DAT, 0)
    images = build_onebyte_images(global_onedat)
    small_image = extract_small_image(DAT, 0)
    w_table = load_w_table(WTABLE)

    engine = ImageEngine(w_table)
    engine.set_oneimg(images)
    engine.compute_intermediate_waves()

    # 场景1: 全 0 坐标
    zp0 = _new_zahyo_param()
    algo0 = All32Engine(engine, zp0, kin=1, ztype=False,
                        small_image=small_image, select_country=0)
    s2_0, etc_0 = algo0.run()
    logging.warning("场景1 全0坐标: S2[1..16]=%s", s2_0[1:17])
    logging.warning("  etc[10]=%d etc[11]=%d (a.csv col44=%d col45=%d)",
                    etc_0[10], etc_0[11], int(rows[0][43]), int(rows[0][44]))

    # 场景2: 真实坐标 KIN=1
    zp1 = parse_zahyo(ZFILE)
    algo1 = All32Engine(engine, zp1, kin=1, ztype=False,
                        small_image=small_image, select_country=0)
    s2_1, etc_1 = algo1.run()
    logging.warning("场景2 真实坐标KIN1: S2[1..16]=%s", s2_1[1:17])


if __name__ == "__main__":
    main()
