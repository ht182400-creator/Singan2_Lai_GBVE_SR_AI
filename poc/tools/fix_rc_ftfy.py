import ftfy
p = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\resource.rc"
b = open(p, "rb").read()

# Step 1: bytes -> str (lenient utf-8)
M = b.decode("utf-8", errors="replace")

# Step 2: ftfy 修复 mojibake
fixed = ftfy.fix_text(M)
print("=== ftfy fixed (first 1200 chars) ===")
print(fixed[:1200])
print("\n=== stats ===")
print("non-ascii in fixed:", sum(1 for c in fixed if ord(c) > 127))
print("\n=== look for すかし ===")
idx = fixed.find("\u3059\u304b\u3057")
print("すかし index:", idx)
if idx >= 0:
    print("context:", repr(fixed[max(0, idx - 30):idx + 30]))

# Save the recovered file (UTF-8, no BOM)
backup = p + ".ftfy_bak"
open(backup, "wb").write(b)
open(p, "wb").write(fixed.encode("utf-8"))
print(f"\nsaved fixed rc, backup at {backup}")