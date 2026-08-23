p = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug\X_ATB_ZAR_132006050001.txt"
text = open(p, "rb").read().decode("shift_jis", errors="replace")
lines = text.splitlines()
sections = []
cur = None
for ln in lines:
    if ln.startswith("\u3010"):
        if cur: sections.append(cur)
        cur = [ln.strip().split()[0], 0]
    else:
        if cur and ln.strip() and "," in ln:
            cur[1] += 1
if cur: sections.append(cur)
for name, n in sections:
    print(name, "datalines=", n)
print("total sections:", len(sections))