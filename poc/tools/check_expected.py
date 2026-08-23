p = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\poc\tools\expected_kin1.json"
import json
d = json.load(open(p, encoding="utf-8"))
b = d["b"]
print("keys:", list(d.keys()))
print("len b:", len(b))
print("min/max:", min(b), max(b))
print("first 30:", b[:30])