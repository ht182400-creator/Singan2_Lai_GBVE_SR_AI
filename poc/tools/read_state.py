import json, os, glob

# find Singa doc by size
candidates = []
for p in glob.glob(r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\*.json"):
    candidates.append((os.path.getsize(p), p))
candidates.sort(reverse=True)
print("Singa doc:", candidates[0])

with open(candidates[0][1], encoding="utf-8", errors="replace") as f:
    head = f.read(15000)
print("=== Singa doc head 15000 chars ===")
print(head)

print("\n\n=== expected_kin1.json ===")
exp = json.load(open(r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\poc\tools\expected_kin1.json", encoding="utf-8"))
print("keys:", list(exp.keys()))
for k, v in exp.items():
    if isinstance(v, list):
        print(k, "len=", len(v), "min=", min(v) if v else None, "max=", max(v) if v else None)
        print("  first 6:", v[:6])
    elif isinstance(v, dict):
        print(k, "keys=", list(v.keys())[:10])
    else:
        print(k, "=", v)

print("\n=== areas.json ===")
out = json.load(open(r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\poc\output\areas.json", encoding="utf-8"))
if isinstance(out, dict):
    print("keys:", list(out.keys())[:5])
    for k in list(out.keys())[:3]:
        v = out[k]
        if isinstance(v, list):
            print(k, "len=", len(v), "first5=", v[:5])