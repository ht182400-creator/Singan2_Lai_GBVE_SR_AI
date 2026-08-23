"""对照检查 ReadZFile 的 magic 校验字节与用户坐标文件头部。"""
import re


def main():
    # 读取源码二进制，提取 strcmp(str, "...") 里的 magic 串
    with open(r"e:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\ZAHYO_READ.CPP", "rb") as f:
        data = f.read()
    m = re.search(rb'strcmp\(str, "([^"]+)"\)', data)
    if m:
        s = m.group(1)
        print("MAGIC len=", len(s), "hex=", s.hex())
        print("MAGIC dec(shift_jis)=", s.decode("shift_jis", "replace"))

    # 用户坐标文件头部对照
    zpath = r"e:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\data\X_ATB_ZAR_132006050001.txt"
    with open(zpath, "rb") as f:
        z = f.read(12)
    print("ZAR  head len=", len(z), "hex=", z.hex())
    print("ZAR  head dec=", z.decode("shift_jis", "replace"))


if __name__ == "__main__":
    main()
