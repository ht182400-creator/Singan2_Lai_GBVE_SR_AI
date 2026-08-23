# -*- coding: utf-8 -*-
"""查看现有 assistant 消息的 extra 完整内容与 message 内部结构。"""
import io, os, json

d = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI"
p = None
for n in os.listdir(d):
    if n.endswith(".json"):
        p = os.path.join(d, n)

data = json.load(io.open(p, "r", encoding="utf-8"))
conv = data["data"]["conversations"][0]
reqs = conv["requests"]
r = reqs[-1]
msgs = r.get("messages", [])

# 打印最后一条 assistant 消息的 extra（解析后）与 message(解析后) content 各块
for m in reversed(msgs):
    if m.get("role") == "assistant":
        print("extra raw:", str(m.get("extra"))[:600])
        try:
            extra = json.loads(m.get("extra"))
            print("extra parsed keys:", list(extra.keys()))
            print("extra parsed:", json.dumps(extra, ensure_ascii=False)[:600])
        except Exception as e:
            print("extra parse fail:", e)
        try:
            inner = json.loads(m.get("message"))
            print("inner content blocks:", [c.get("type") for c in inner.get("content", [])])
            print("inner keys:", list(inner.keys()))
        except Exception as e:
            print("message parse fail:", e)
        break

# 打印 request 顶层结构
print("REQ keys:", list(r.keys()))
print("REQ id:", r.get("id"))
print("REQ type:", r.get("type"))
print("REQ state:", r.get("state"))
# 打印整个 request 的完整结构（不含 messages 内容）
r_slim = {k: (("[%d msgs]" % len(v)) if k == "messages" else v) for k, v in r.items()}
print("REQ slim:", json.dumps(r_slim, ensure_ascii=False, indent=2))
