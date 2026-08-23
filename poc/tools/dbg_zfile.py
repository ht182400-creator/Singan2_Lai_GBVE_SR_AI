import sys, os
sys.path.insert(0, r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\poc")
from parse.readzfile import parse_zfile

zfile = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\data\ZAR\X_ATB_ZAR_132006050001.txt"
areas = parse_zfile(zfile)
print("poc parse_zfile len:", len(areas))
if areas:
    print("first:", areas[0])

raw = open(zfile, "rb").read()
print("file size:", len(raw))
print("first 200 bytes (raw repr):", repr(raw[:200]))
try:
    txt = raw.decode("shift_jis", errors="replace")
    print("first 3 lines:", txt.splitlines()[:3])
except Exception as e:
    print("decode err", e)

# 统计：哪些行含数字
lines = raw.decode("shift_jis", errors="replace").splitlines()
num_digit_lines = sum(1 for ln in lines if any(c.isdigit() for c in ln))
print("total lines:", len(lines), "lines with digit:", num_digit_lines)