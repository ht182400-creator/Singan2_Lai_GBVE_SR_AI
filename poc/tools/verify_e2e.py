"""真实端到端自洽验证：.dat -> extract -> build_images -> ImageEngine -> all32 -> 对比 expected_kin1.json(record 0)"""
import sys, json, os
sys.path.insert(0, r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\poc")
os.chdir(r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\poc")

from parse.mariner_reader import extract_mm1_side, build_onebyte_images, extract_small_image
from parse.zahyo_reader import parse_zahyo
from algo.imageops import ImageEngine
from algo.wtable import gen_w_table
from algo.all32 import All32Engine

DAT = r"..\data\2A_DA_111017_115542.dat"
ZF = r"..\data\ZAR\X_ATB_ZAR_132006050001.txt"
REC, KIN = 0, 1

print("[1] extract_mm1_side + build_onebyte_images")
god = extract_mm1_side(DAT, REC)
images = build_onebyte_images(god)
small_image = extract_small_image(DAT, REC)  # 必须传入，sikisa 依赖它
print("    small_image 长度 =", len(small_image) if small_image else None)

print("[2] ImageEngine 准备 (set_oneimg + compute_intermediate_waves)")
eng = ImageEngine(gen_w_table())
eng.set_oneimg(images)
eng.compute_intermediate_waves()

print("[3] parse_zahyo + All32Engine.run (传入 small_image)")
zp = parse_zahyo(ZF)
s2, etc = All32Engine(eng, zp, kin=KIN, small_image=small_image).run()
print("    poc  S2[1:33] =", s2[1:33])
print("    poc  etc[10] =", etc[10], " etc[11] =", etc[11])

print("[4] 对比 expected_kin1.json (record 0)")
exp = json.load(open(r"tools\expected_kin1.json", encoding="utf-8"))
print("    expected 顶层:", type(exp).__name__,
      "keys:", list(exp.keys()) if isinstance(exp, dict) else "len=%d" % len(exp))
exp0 = exp["results"][REC]
print("    record0 类型:", type(exp0).__name__,
      "keys:", list(exp0.keys()) if isinstance(exp0, dict) else "N/A")
e_s2 = exp0.get("S2") or exp0.get("s2")
e_etc = exp0.get("etc") or exp0.get("ETC")
print("    expected S2[1:33] =", (e_s2[1:33] if e_s2 else None))

if e_s2:
    # 正确对齐：gen_expected 存的是 s2[1:33]，故 expected.S2 即 poc s2[1:33]
    poc_s2 = s2[1:33]
    exp_s2 = e_s2[:32]
    diffs = [(i + 1, poc_s2[i], exp_s2[i]) for i in range(min(len(poc_s2), len(exp_s2)))
             if poc_s2[i] != exp_s2[i]]
    print("    >>> 正确对齐 S2[1:33] vs expected.S2[:32] 差异项数:", len(diffs))
    for d in diffs[:32]:
        print("        S2[%d]: poc=%s  expected=%s" % d)
    print("    >>> S2 全部匹配:", len(diffs) == 0)
    # etc 对比
    if e_etc:
        ediffs = [(i, etc[i], e_etc[i]) for i in range(min(len(etc), len(e_etc)))
                  if etc[i] != e_etc[i]]
        print("    >>> etc 差异项数:", len(ediffs),
              " (etc10: poc=%s exp=%s, etc11: poc=%s exp=%s)" %
              (etc[10], e_etc[10], etc[11], e_etc[11]))
if e_etc:
    ed = [(i, etc[i], e_etc[i]) for i in range(min(len(etc), len(e_etc)))
          if etc[i] != e_etc[i]]
    print("    >>> etc 差异项数:", len(ed))
    for d in ed[:16]:
        print("        etc[%d]: poc=%s  expected=%s" % d)
print("[done]")