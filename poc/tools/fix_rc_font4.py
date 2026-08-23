p = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\resource.rc"
text = open(p, "rb").read().decode("utf-8")
text2 = text.replace("\u4ff5\u4ffd \u67e7\u632c", "MS Mincho")
print("changed:", text != text2)
open(p, "wb").write(text2.encode("utf-8"))
for i, ln in enumerate(text2.splitlines()):
    if "FONT" in ln and any(ord(c) > 127 for c in ln):
        print("STILL JA:", i, repr(ln))
    elif "FONT" in ln:
        print("OK:", i, repr(ln[:80]))