# -*- coding: utf-8 -*-
"""
gen_expected.py — 统计 KIN 坐标非零情况 + 用真实坐标生成 40 枚预期 S2

输出:
  1. kin_stats.json  — 每个 KIN 的关键段坐标非零统计
  2. expected_kin1.json — KIN=1 真实坐标下 40 枚的 S2[1..16]+etc
"""
import os
import sys
import json
import logging

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
POC_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, POC_DIR)

from parse.mariner_reader import extract_mm1_side, build_onebyte_images, extract_small_image
from parse.zahyo_reader import parse_zahyo
from algo.imageops import ImageEngine
from algo.wtable import load_w_table
from algo.all32 import All32Engine

DAT = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\ZAR\2A_DA_111017_115542.dat"
ZFILE = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\ZAR\X_ATB_ZAR_132006050001.txt"
WTABLE = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug\GBV_DIV_H.bin"
OUT = os.path.join(SCRIPT_DIR, "expected_kin1.json")
KINSTAT = os.path.join(SCRIPT_DIR, "kin_stats.json")


def main():
    logging.basicConfig(level=logging.WARNING, format="%(levelname)-5s %(message)s")
    w_table = load_w_table(WTABLE)
    zp = parse_zahyo(ZFILE)

    # 统计 KIN=1..72 关键段坐标非零
    stats = {}
    for kin in range(1, 73):
        row = {"kin": kin}
        for prefix in ("Sukasi1", "old_sukasi", "Thred", "Sekigai1", "Yogore", "Horo"):
            lx = zp.get("%s_LeftX" % prefix, [0])[kin] if kin < len(zp.get("%s_LeftX" % prefix, [0])) else 0
            rx = zp.get("%s_RightX" % prefix, [0])[kin] if kin < len(zp.get("%s_RightX" % prefix, [0])) else 0
            row[prefix] = 1 if (lx or rx) else 0
        stats[kin] = row

    zero_all = [kin for kin, r in stats.items() if not (r["Sukasi1"] or r["old_sukasi"] or r["Thred"] or r["Sekigai1"] or r["Yogore"])]
    nonzero_all = [kin for kin, r in stats.items() if r["Sukasi1"] and r["old_sukasi"]]
    logging.warning("全部关键段为 0 的 KIN: %s", zero_all)
    logging.warning("Sukasi1+old_sukasi 都非零的 KIN(前10): %s", nonzero_all[:10])
    with open(KINSTAT, "w", encoding="utf-8") as fp:
        json.dump(stats, fp, ensure_ascii=False, indent=1)
    logging.warning("kin_stats.json 已写入 %d 项", len(stats))

    # 用真实坐标 KIN=1 跑 40 枚预期值
    results = []
    for rec in range(40):
        global_onedat = extract_mm1_side(DAT, rec)
        images = build_onebyte_images(global_onedat)
        small_image = extract_small_image(DAT, rec)
        engine = ImageEngine(w_table)
        engine.set_oneimg(images)
        engine.compute_intermediate_waves()
        algo = All32Engine(engine, zp, kin=1, ztype=False, small_image=small_image, select_country=0)
        s2, etc = algo.run()
        results.append({
            "record": rec,
            "S2": s2[1:33],
            "etc10": etc[10],
            "etc11": etc[11],
        })
        if rec % 5 == 0:
            logging.warning("rec%d S2[1..16]=%s etc[10]=%d etc[11]=%d",
                            rec, s2[1:17], etc[10], etc[11])
    with open(OUT, "w", encoding="utf-8") as fp:
        json.dump({"kin": 1, "results": results}, fp, ensure_ascii=False, indent=1)
    logging.warning("expected_kin1.json 已写入 40 枚结果")


if __name__ == "__main__":
    main()
