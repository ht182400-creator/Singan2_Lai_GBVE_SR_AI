import ftfy

# 读 bak4 (fix_rc_font 之前备份, 也被双重编码过)
bak = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\resource.rc.ftfy_bak"
out = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\resource.rc"
b = open(bak, "rb").read()
M = b.decode("utf-8", errors="replace")
fixed = ftfy.fix_text(M)

# 按 Shift-JIS (cp932) 编码写回，符合 #pragma code_page(932)
fixed_sjis = fixed.encode("cp932")
print("encoded sjis len:", len(fixed_sjis))
open(out, "wb").write(fixed_sjis)
print("saved as Shift-JIS (cp932)")

# 验证：再读回来，按 cp932 解码，应该得到原始 Unicode
verify = fixed_sjis.decode("cp932")
print("roundtrip OK:", verify == fixed)
print("\n=== fixed (head) ===")
print(verify[:1000])
print("\n=== search MS PGothic and ＭＳ ===")
for q in ["MS PGothic", "\uff2d\uff33"]:
    idx = verify.find(q)
    print(f"{q!r} at {idx}")