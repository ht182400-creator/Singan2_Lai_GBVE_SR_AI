"""模拟原版 ReadZFile 在 X_ATB_ZAR 上的解析行为，判断是否错位。

重点复刻 ZAHYO_READ.CPP:16 的逻辑：
- 前 12 字节必须 == 【すかし１】
- 跳过首行(到第一个 0x0a)
- Sukasi1: 读 dNumber 行, 每行 9 字段逗号分隔
- 跳空行, Sukasi2: 读 dNumber 行
- 跳空行, Thread: 读 dNumber 行
dNumber = Global_Dem * 4 (运行期由币种决定, 此处按常见值测算)
"""
import logging

logging.basicConfig(level=logging.INFO,
                    format='[%(asctime)s.%(msecs)03d] %(levelname)-5s %(message)s')
logger = logging.getLogger("sim_readzfile")


def is_data_row(line: str) -> bool:
    """9 字段逗号分隔且均为整数 => 视为 ReadZFile 期望的数据行。"""
    parts = line.replace('、', ',').replace('，', ',').split(',')
    if len(parts) != 9:
        return False
    try:
        for p in parts:
            int(p.strip())
        return True
    except ValueError:
        return False


def main():
    path = r"e:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\data\X_ATB_ZAR_132006050001.txt"
    with open(path, "rb") as f:
        raw = f.read()
    # 1) magic 校验
    magic = raw[:12]
    logger.info("magic hex=%s dec=%s", magic.hex(), magic.decode("shift_jis", "replace"))
    if magic != "【すかし１】".encode("shift_jis"):
        logger.error("magic 不匹配, ReadZFile 会 return FALSE")
        return
    logger.info("magic 校验通过 -> 坐标可被 ReadZFile 加载")

    # 2) 解码文本, 看结构
    text = raw.decode("shift_jis", "replace")
    lines = text.splitlines()
    logger.info("总行数=%d", len(lines))
    logger.info("前 12 行预览:")
    for i, ln in enumerate(lines[:12]):
        logger.info("  L%d: %s", i + 1, ln[:80])

    # 找分组标题行
    group_rows = [(i + 1, ln) for i, ln in enumerate(lines)
                  if ln.strip().startswith("【") or ln.strip().startswith("]")]
    logger.info("发现分组标题行数=%d", len(group_rows))
    for r in group_rows[:20]:
        logger.info("  标题 L%d: %s", r[0], r[1][:60])

    # 3) 模拟首行跳过 + Sukasi1 连续解析
    # 首行是第 1 行(索引0), 从索引1开始是数据(按 ReadZFile 行96-98)
    data_start = 1
    # 连续数据行计数(直到遇到第一个非数据行)
    cont = 0
    first_bad = None
    for idx in range(data_start, len(lines)):
        if is_data_row(lines[idx]):
            cont += 1
        else:
            first_bad = (idx + 1, lines[idx][:60])
            break
    logger.info("从第2行起连续可解析的数据行数=%d, 首个非数据行: L%d=%s",
                cont, first_bad[0] if first_bad else -1,
                first_bad[1] if first_bad else "无")

    # 4) 假设 dNumber 取常见值, 看是否撞到分组标题
    for dnum in (64, 88, 164):
        # Sukasi1 读 dnum 行(从索引1起), 检查这 dnum 行里是否含非数据行
        seg = lines[1:1 + dnum]
        bad = [(1 + j + 1, seg[j][:40]) for j, ln in enumerate(seg) if not is_data_row(ln)]
        logger.info("假设 dNumber=%d: Sukasi1 段内非数据行=%s", dnum,
                    bad[:3] if bad else "无(全为数据行)")


if __name__ == "__main__":
    main()
