p = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\resource.rc"
b = open(p, "rb").read()

# Step 1: current UTF-8 bytes -> mojibake Unicode string M
M = b.decode("utf-8", errors="replace")

# Step 2: M 是原 UTF-8 bytes 被 GBK 误读的结果, 恢复原 UTF-8 bytes: M.encode('gbk')
try:
    orig_utf8_bytes = M.encode("gbk")
    print("gbk encode OK, len:", len(orig_utf8_bytes))
except Exception as e:
    print("gbk encode fail:", e)
    # 试 errors ignore
    orig_utf8_bytes = M.encode("gbk", errors="ignore")
    print("gbk encode ignore OK, len:", len(orig_utf8_bytes))

# Step 3: 原 UTF-8 bytes -> 真正日文 Unicode
try:
    orig = orig_utf8_bytes.decode("utf-8")
    print("RECOVERED (first 800 chars):")
    print(orig[:800])
    print("\n--- search すかし ---")
    idx = orig.find("\u3059\u304b\u3057")
    print("sokasi index:", idx)
    if idx >= 0:
        print(orig[max(0, idx - 20):idx + 30])
    print("\n--- search MS PGothic ---")
    idx2 = orig.find("MS PGothic")
    print("MS PGothic index:", idx2)
    print("\n--- count non-ascii ---")
    cnt = sum(1 for c in orig if ord(c) > 127)
    print("non-ascii chars:", cnt)
except Exception as e:
    print("utf-8 decode fail:", e)