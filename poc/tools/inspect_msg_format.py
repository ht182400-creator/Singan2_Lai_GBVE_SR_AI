# -*- coding: utf-8 -*-
"""查看现有 assistant 消息的完整结构，确保追加的消息格式一致。"""
import io, os, json

d = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI"
p = None
for n in os.listdir(d):
    if n.endswith(".json"):
        p = os.path.join(d, n)

data = json.load(io.open(p, "r", encoding="utf-8"))
conv = data["data"]["conversations"][0]
reqs = conv["requests"]
print("requests:", len(reqs))

for ri in range(len(reqs) - 1, -1, -1):
    msgs = reqs[ri].get("messages", [])
    for mi in range(len(msgs) - 1, -1, -1):
        m = msgs[mi]
        if m.get("role") == "assistant":
            print("=== req[%d] msg[%d] keys=%s" % (ri, mi, list(m.keys())))
            print("id:", m.get("id"))
            print("extra:", str(m.get("extra"))[:500])
            print("createdAt:", m.get("createdAt"))
            raw = m.get("message")
            print("message type:", type(raw).__name__)
            print("message raw head:", str(raw)[:500])
            # 尝试解析 message
            try:
                inner = json.loads(raw)
                print("inner keys:", list(inner.keys()))
                print("inner role:", inner.get("role"))
                print("content[0]:", str(inner.get("content", [{}])[0])[:300])
            except Exception as e:
                print("message parse fail:", e)
            # 打印该 request 的顶层字段
            print("REQ top keys:", list(reqs[ri].keys()))
            print("REQ state:", reqs[ri].get("state"))
            raise SystemExit
