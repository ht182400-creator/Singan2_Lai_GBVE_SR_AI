# -*- coding: utf-8 -*-
"""
将"项目构架与解读文档"作为最后一条 assistant 文本消息，
追加写入 CodeBuddy 对话导出 JSON（保持 JSON 结构有效）。

文档内容来源：poc/tools/arch_doc.md
写入位置：最后一个 request 的 messages 数组末尾。
"""
import io
import os
import json
import uuid
from datetime import datetime, timezone

BASE = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI"
TARGET = None
for name in os.listdir(BASE):
    if name.endswith(".json"):
        TARGET = os.path.join(BASE, name)

# 读取文档
DOC_PATH = os.path.join(BASE, "poc", "tools", "arch_doc.md")
with io.open(DOC_PATH, "r", encoding="utf-8") as f:
    doc_text = f.read()

with io.open(TARGET, "r", encoding="utf-8") as f:
    data = json.load(f)

conv = data["data"]["conversations"][0]
reqs = conv["requests"]
last_req = reqs[-1]
req_id = last_req.get("id")

# 构造内嵌 message（纯 text 内容块）
inner = {"role": "assistant", "content": [{"type": "text", "text": doc_text}]}
inner_json = json.dumps(inner, ensure_ascii=False, separators=(",", ":"))

now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
extra = json.dumps(
    {
        "requestId": req_id,
        "modelId": "hy3",
        "modelName": "Hy3",
        "isHelperMessage": False,
    },
    ensure_ascii=False,
    separators=(",", ":"),
)

new_msg = {
    "role": "assistant",
    "message": inner_json,
    "id": str(uuid.uuid4()).replace("-", ""),
    "extra": extra,
    "createdAt": now,
}

last_req.setdefault("messages", []).append(new_msg)
if "state" in last_req:
    last_req["state"] = "running"

data["data"]["lastMessageAt"] = now

with io.open(TARGET, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write("\n")

# 校验回读
with io.open(TARGET, "r", encoding="utf-8") as f:
    data2 = json.load(f)
r2 = data2["data"]["conversations"][0]["requests"][-1]
tail = r2["messages"][-1]
tail_inner = json.loads(tail["message"])
print("OK 校验通过")
print("last msg id:", tail["id"])
print("last msg blocks:", [c.get("type") for c in tail_inner["content"]])
print("last msg text len:", len(tail_inner["content"][0]["text"]))
print("state:", r2["state"])
