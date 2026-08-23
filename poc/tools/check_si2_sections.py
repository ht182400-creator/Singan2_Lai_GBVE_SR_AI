# -*- coding: utf-8 -*-
"""check_si2_sections.py — 查看 si2 的 [選択座標ファイルＮｏ] 和 [その他座標ファイル] 段"""
import sys

p = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug\singan2.si2"
data = open(p, "rb").read()
text = data.decode("shift_jis", errors="replace")
lines = text.splitlines()

for i, ln in enumerate(lines):
    if any(k in ln for k in ("\u9078\u629e", "\u305d\u306e\u4ed6", "\u5ea7\u6a19")):
        print(i, repr(ln))
        for j in range(i + 1, min(i + 6, len(lines))):
            if lines[j].strip():
                print("   ", repr(lines[j]))
        print()

print("=== \u305d\u306e\u4ed6\u5ea7\u6a19\u30d5\u30a1\u30a4\u30eb \u6bb5\u4ee5\u540e\u5168\u90e8\u884c ===")
found = False
for i, ln in enumerate(lines):
    if "\u305d\u306e\u4ed6\u5ea7\u6a19" in ln:
        found = True
        start = i
        break
if found:
    for ln in lines[start:start + 8]:
        print(repr(ln))
