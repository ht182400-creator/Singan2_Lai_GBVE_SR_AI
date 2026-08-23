import re
p = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\resource.rc"
text = open(p, "rb").read().decode("utf-8")
# 第382行 FONT 8, "俵俽 柧挬"（MS Mincho 的 UTF-8）→ "MS Mincho"
text2 = text.replace('\u4ff5\u4ff5\u4ff5 \u67d5\u632f', "MS Mincho")
print("changed:", text != text2)
open(p, "wb").write(text2.encode("utf-8"))
lines = text2.splitlines()
for i, ln in enumerate(lines):
    if "FONT" in ln:
        print(i, repr(ln[:80]))