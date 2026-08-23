import ftfy

bak = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\resource.rc.ftfy_bak"
out = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\resource.rc"
b = open(bak, "rb").read()
M = b.decode("utf-8", errors="replace")
fixed = ftfy.fix_text(M)

# 检查是否含未配对的 surrogate (会导致 UTF-8 encode 失败)
fixed_clean = fixed.encode("utf-16-le", errors="replace").decode("utf-16-le")
# 写 UTF-8 (无 BOM)
open(out, "wb").write(fixed_clean.encode("utf-8"))
print("saved UTF-8, len:", len(fixed_clean.encode("utf-8")))
# 验证
v = fixed_clean.encode("utf-8")
print("roundtrip:", v.decode("utf-8") == fixed_clean)

# 找 WM 和 etc 标签附近的上下文
for q in ["WM", "Setting Dialogue", "Watermark"]:
    idx = fixed_clean.find(q)
    if idx >= 0:
        print(f"\n{q!r} at {idx}:")
        print(repr(fixed_clean[max(0,idx-20):idx+60]))