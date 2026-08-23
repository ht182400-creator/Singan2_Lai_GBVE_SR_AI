# -*- coding: utf-8 -*-
"""分析 Z 坐标 txt 的段标题与每段行数。"""
import io
import os

f = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\ZAR\X_ATB_ZAR_132006050001.txt"
with io.open(f, "r", encoding="shift_jis", errors="replace") as fp:
    lines = fp.readlines()

print("total lines:", len(lines))
print("--- section headers ---")
data_line = 0
for i, raw in enumerate(lines):
    l = raw.strip()
    if "\u3010" in l:  # 【
        print("L%d [dataLines=%d]: %s" % (i, data_line, l[:50]))
        data_line = 0
    elif l:
        data_line += 1
print("last dataLines:", data_line)
