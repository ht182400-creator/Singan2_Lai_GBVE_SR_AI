import sys
sys.path.insert(0, r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\poc")
import struct, json
from parse.mariner_reader import parse_blocks, extract_mm1_side, BLOCK_HEADER, MM1_SIDE_BLOCK

dat = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\data\2A_DA_111017_115542.dat"
data = open(dat, "rb").read()
print("dat size:", len(data), "head:", data[:8])

blocks = parse_blocks(dat)
print("num blocks:", len(blocks))
print("first 3 blocks:", blocks[:3])
side = [b for b in blocks if b[1] == 5]
print("num MM1_Side blocks:", len(side))
print("first 2 side blocks:", side[:2])

# 手动复现 extract_mm1_side 第一块
b0 = side[0]
off = b0[3] + BLOCK_HEADER
seg = data[off:off + MM1_SIDE_BLOCK]
print("side[0] offset:", b0[3], "BLOCK_HEADER:", BLOCK_HEADER, "data_off:", off)
print("seg[0:8] (poc):", list(seg[:8]))

golden = open(r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\poc\output\global_onedat_rec0.bin", "rb").read()
print("golden[0:8]:", list(golden[:8]))
print("seg == golden?", seg == golden)

# readzfile 模拟
zfile = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\data\ZAR\X_ATB_ZAR_132006050001.txt"
raw = bytearray(open(zfile, "rb").read())
for i in range(len(raw) - 1):
    if raw[i] == 0x81 and raw[i + 1] in (0x41, 0x81):
        raw[i] = 0x2C
        raw[i + 1] = 0x20
content = raw.decode("latin-1")
cnt = 0
for line in content.split("\n"):
    s = "".join(c if (c.isdigit() or c in ",.-") else " " for c in line)
    nums = [x for x in s.split() if x.lstrip("-").isdigit()]
    if len(nums) >= 9:
        cnt += 1
print("readzfile-sim areas>=9:", cnt)