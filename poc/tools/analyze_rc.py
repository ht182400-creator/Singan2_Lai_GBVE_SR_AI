import re
p = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\resource.rc"
b = open(p, "rb").read()
print("first16:", b[:16].hex())
print("BOM:", b[:3] == b"\xef\xbb\xbf")
# 找所有 >=0x80 的连续字节
runs = re.findall(rb"[\x80-\xff]+", b)
print("non-ascii runs:", len(runs))
for r in runs[:30]:
    dec8 = None
    try:
        dec8 = r.decode("utf-8")
    except Exception:
        pass
    decs = None
    try:
        decs = r.decode("shift_jis")
    except Exception:
        pass
    print(repr(r), "utf8=", repr(dec8), "sjis=", repr(decs))