import re
p = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\resource.rc"
text = open(p, "rb").read().decode("utf-8")
before = text
text = re.sub(r'FONT 9, "[^"]*", 0, 0, 0x0', 'FONT 9, "MS PGothic", 0, 0, 0x0', text)
text = re.sub(r'FONT 9, "[^"]*"(?=[\r\n])', 'FONT 9, "MS PGothic"', text)
print("changed:", text != before)
open(p, "wb").write(text.encode("utf-8"))
for i, ln in enumerate(text.splitlines()):
    if "FONT" in ln:
        print(i, repr(ln))