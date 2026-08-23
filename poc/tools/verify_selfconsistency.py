"""验证 poc 端到端自洽性 + 解析层 golden 闭合。
A. poc 实时跑 all32(当前.dat) -> s2_result
B. 对比 expected_kin1.json (record 0)
C. 验证 golden global_onedat_rec0.bin == poc extract_mm1_side(当前.dat)
"""
import sys, json, os
sys.path.insert(0, r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\poc")
os.chdir(r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\poc")
from algo.all32 import All32Engine
from parse.mariner_reader import extract_mm1_side

DAT = r"..\data\2A_DA_111017_115542.dat"
ZF = r"..\data\ZAR\X_ATB_ZAR_132006050001.txt"
REC = 0

print("=" * 64)
print("A. 端到端 poc 实时运行 (当前 .dat, record 0)")
res = All32Engine(DAT, ZF, REC).process()
s2 = res["S2"]
etc = res.get("etc", [])
print("   S2[0:16] =", s2[:16])
print("   etc10 =", etc[10] if len(etc) > 10 else None,
      " etc11 =", etc[11] if len(etc) > 11 else None)
print("   S2 长度 =", len(s2), " etc 长度 =", len(etc))

print("=" * 64)
print("B. 与 expected_kin1.json 对比 (record 0)")
exp = json.load(open(r"tools\expected_kin1.json", encoding="utf-8"))
if isinstance(exp, dict):
    exp0 = exp.get("records", exp.get(str(REC), list(exp.values())[REC]))
elif isinstance(exp, list):
    exp0 = exp[REC]
print("   expected 顶层类型:", type(exp).__name__,
      " record0 键:", list(exp0.keys()) if isinstance(exp0, dict) else type(exp0))
e_s2 = exp0.get("S2") or exp0.get("s2") or exp0.get("result", {}).get("S2")
e_etc = exp0.get("etc") or exp0.get("ETC") or exp0.get("result", {}).get("etc")
print("   expected S2[0:16] =", e_s2[:16] if e_s2 else None)
diff = sum(1 for a, b in zip(s2, e_s2)) if e_s2 else -1
diff_bad = sum(1 for a, b in zip(s2, e_s2) if a != b) if e_s2 else -1
print("   S2 长度一致:", len(s2) == len(e_s2) if e_s2 else False,
      " S2 差异项数:", diff_bad)
if e_etc:
    print("   etc10 match:", etc[10] == e_etc[10],
          " etc11 match:", etc[11] == e_etc[11])

print("=" * 64)
print("C. M0 解析层 golden 闭合 (当前 .dat)")
seg = extract_mm1_side(DAT, REC)
seg_bytes = bytes(seg) if isinstance(seg, list) else seg
golden = open(r"output\global_onedat_rec0.bin", "rb").read()
print("   poc extract_mm1_side 长度:", len(seg_bytes),
      " golden 长度:", len(golden))
print("   M0 golden == poc extract_mm1_side:", seg_bytes == golden)
print("=" * 64)