# -*- coding: utf-8 -*-
"""fix_si2_others.py — 修复 si2 的 [その他座標ファイル] 段为单一有效路径

a.csv 全 0 根因：Z 对话框 IDC_Z_COMBO 列表里 Zfilename_[0] 是 WCR_tool 乱码路径，
ReadZFile 打开失败 → dwSize=0 → return FALSE → global_Zparam 全 0。
直接改 si2 的 [その他座標ファイル] 段，只留一条指向 debug\X_ATB_ZAR_132006050001.txt。
"""
import io
import os
import sys

p = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug\singan2.si2"
data = open(p, "rb").read()
text = data.decode("shift_jis", errors="replace")
lines = text.splitlines()

new_path = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug\X_ATB_ZAR_132006050001.txt"
print("target file exists:", os.path.exists(new_path))

# 找 [その他座標ファイル] 段：清空段后所有非段标题行，只留 new_path
start = None
for i, ln in enumerate(lines):
    if "\u305d\u306e\u4ed6\u5ea7\u6a19\u30d5\u30a1\u30a4\u30eb" in ln:
        start = i
        break
print("[その他座標ファイル] 段 index:", start)
if start is None:
    print("section not found")
    sys.exit(1)

end = start + 1
while end < len(lines) and not lines[end].startswith("["):
    end += 1
print("old section lines (start..end):")
for j in range(start, min(end, start + 8)):
    print("  ", repr(lines[j]))

# 替换
new_section = ["[\u305d\u306e\u4ed6\u5ea7\u6a19\u30d5\u30a1\u30a4\u30eb]", new_path, ""]
new_lines = lines[:start] + new_section + lines[end:]
# 段间用 \r\n
new_text = "\r\n".join(new_lines) + "\r\n"
new_bytes = new_text.encode("shift_jis", errors="replace")
# 备份
bak = p + ".bak3"
if not os.path.exists(bak):
    open(bak, "wb").write(data)
    print("backup ->", bak)
open(p, "wb").write(new_bytes)
print("si2 updated")

# 验证
data2 = open(p, "rb").read()
text2 = data2.decode("shift_jis", errors="replace")
lines2 = text2.splitlines()
for i, ln in enumerate(lines2):
    if "\u305d\u306e\u4ed6\u5ea7\u6a19" in ln or "\u5ea7\u6a19" in ln or "2A_DA" in ln:
        print("  ", i, repr(ln))
