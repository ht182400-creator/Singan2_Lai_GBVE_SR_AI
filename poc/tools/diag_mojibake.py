p = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\resource.rc"
b = open(p, "rb").read()

# 当前字节 decode 成 Unicode (UTF-8 mojibake string)
M = b.decode("utf-8", errors="replace")

# 尝试恢复：原 UTF-8 日文被 GBK 编码又 UTF-8 写出 -> 恢复 M -> 原日文
# 方法: M 这个 unicode 字符串，其 code point 实际是 GBK 编码的字节当 unicode 看待
# 即 原 UTF-8 bytes = M 的每个 code point 当作 GBK 字节拼接
# 用 latin-1 把 M 编码成字节 (code point 0-255 直接当字节), 然后这些字节按 GBK 解码得原 Unicode 日文字符串

import codecs

# 收集 M 中 code point <= 255 的字符，编码成字节
try:
    recovered_bytes = M.encode("latin-1")
except UnicodeEncodeError as e:
    print("latin-1 encode fail:", e)
    recovered_bytes = M.encode("latin-1", errors="ignore")

print("recovered bytes len:", len(recovered_bytes))

# 这些字节 = 原 UTF-8 bytes. 按 UTF-8 解码得 Unicode 日文
try:
    recovered = recovered_bytes.decode("utf-8")
    print("RECOVERED:", recovered[:500])
except Exception as e:
    print("utf-8 decode fail:", e)
    # 试 GBK
    try:
        recovered = recovered_bytes.decode("gbk")
        print("recovered as GBK:", recovered[:300])
    except Exception as e2:
        print("gbk fail:", e2)

# 也试 ftfy 风格: M.encode('cp1252').decode('utf-8')
try:
    r2 = M.encode("cp1252", errors="ignore").decode("utf-8", errors="replace")
    print("CP1252->UTF8:", r2[:300])
except Exception as e:
    print("cp1252 fail:", e)