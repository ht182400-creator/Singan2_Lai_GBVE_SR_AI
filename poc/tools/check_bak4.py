import re
for name in [r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\resource.rc.bak4",
             r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\resource.rc"]:
    b = open(name, "rb").read()
    print("===", name.split("\\")[-1], "first16:", b[:16].hex(), "BOM:", b[:3]==b"\xef\xbb\xbf")
    # 找 UTF-8 日文假名 す (e3 81 99) か (e3 81 8b) し (e3 81 97)
    for label, pat in [("sukasi-utf8", b"\xe3\x81\x99\xe3\x81\x8b\xe3\x81\x97"),
                       ("sukasi-sjis", b"\x82\x59\x82\x6d\x82\x6c"),
                       ("MSPGothic-utf8", "MS PGothic".encode()),
                       ("MSPGothic-sjis", b"\x82\x6c\x82\x53\x20\x0f\x50")]:
        print("  ", label, "found at", b.find(pat))
    # 统计非ascii run
    runs = re.findall(rb"[\x80-\xff]+", b)
    print("  non-ascii runs:", len(runs))
    # 打印第一个 run 的解码
    if runs:
        r = runs[0]
        for enc in ("utf-8","shift_jis","gbk"):
            try:
                print("   run0", enc, "=", repr(r.decode(enc))[:60])
                break
            except Exception:
                pass