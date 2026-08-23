# -*- coding: utf-8 -*-


"""
分析 CodeBuddy 对话导出 JSON 的末尾 1000 行结构，帮助决定如何写入解读文档。
仅用于分析，不修改原文件。
"""
import io
import os
import json

BASE = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI"
TARGET = None
for name in os.listdir(BASE):
    if name.endswith(".json"):
        TARGET = os.path.join(BASE, name)

with io.open(TARGET, "r", encoding="utf-8") as f:
    lines = f.readlines()

total = len(lines)
print("total lines:", total)
start = total - 1000
print("last 1000 start (0-based):", start, "=> 1-based line", start + 1)

# 打印最后 1000 行的前 40 行（截断显示）
for i in range(start, start + 40):
    line = lines[i].rstrip("\r\n")
    print(i + 1, repr(line[:300]))

print("---- 文件末尾 30 行 ----")
for i in range(total - 30, total):
    line = lines[i].rstrip("\r\n")
    print(i + 1, repr(line[:300]))
