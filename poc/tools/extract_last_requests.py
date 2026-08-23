# -*- coding: utf-8 -*-
"""
提取 CodeBuddy 对话导出 JSON 中最后两个 request 的关键内容，
帮助了解"我们现在干什么"。
"""
import io
import os
import json
import sys

BASE = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI"
TARGET = None
for name in os.listdir(BASE):
    if name.endswith(".json"):
        TARGET = os.path.join(BASE, name)

with io.open(TARGET, "r", encoding="utf-8") as f:
    data = json.load(f)

conv = data["data"]["conversations"][0]
reqs = conv["requests"]
print("requests:", len(reqs))

# 只关注最后两个 request
for ridx in (len(reqs) - 2, len(reqs) - 1):
    r = reqs[ridx]
    print("\n" + "=" * 80)
    print("REQUEST[%d] id=%s" % (ridx, r.get("id")))
    msgs = r.get("messages", [])
    for mi, m in enumerate(msgs):
        role = m.get("role")
        raw = m.get("message") or ""
        # 尝试解析内嵌 JSON message
        try:
            inner = json.loads(raw)
            text_parts = []
            for c in inner.get("content", []):
                if c.get("type") == "text":
                    text_parts.append(c.get("text", ""))
                elif c.get("type") == "reasoning":
                    text_parts.append("[reasoning] " + c.get("text", ""))
                elif c.get("type") == "tool-call":
                    text_parts.append("[tool-call] %s(%s)" % (c.get("toolName"), json.dumps(c.get("args"), ensure_ascii=False)[:200]))
                elif c.get("type") == "tool-result":
                    res = c.get("result", {})
                    text_parts.append("[tool-result] %s" % json.dumps(res, ensure_ascii=False)[:200])
                else:
                    text_parts.append("[%s]" % c.get("type"))
            content = "\n".join(text_parts)
        except Exception:
            content = raw[:2000]
        print("-" * 70)
        print("#%d %s len=%d" % (mi, role, len(raw)))
        print(content[:1500])
