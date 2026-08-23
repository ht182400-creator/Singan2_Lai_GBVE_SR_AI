"""精确统计 X_ATB_ZAR 每个分组的数据行数，判断是否与 ReadZFile 的 dNumber=Global_Dem*4 对齐。"""
import logging

logging.basicConfig(level=logging.INFO,
                    format='[%(asctime)s.%(msecs)03d] %(levelname)-5s %(message)s')
logger = logging.getLogger("count_groups")


def main():
    path = r"e:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\data\X_ATB_ZAR_132006050001.txt"
    lines = open(path, "rb").read().decode("shift_jis", "replace").splitlines()

    # 找所有分组标题行（行首为【）
    headers = [(i, ln.strip()) for i, ln in enumerate(lines) if ln.strip().startswith("【")]
    logger.info("分组标题总数=%d: %s", len(headers), [h[1] for h in headers])

    # 统计每个标题下一段（到下一个标题之前）的数据行数（9字段整数行）
    def is_data_row(ln):
        parts = ln.replace('、', ',').replace('，', ',').split(',')
        if len(parts) != 9:
            return False
        try:
            for p in parts:
                int(p.strip())
            return True
        except ValueError:
            return False

    counts = []
    for k, (idx, name) in enumerate(headers):
        start = idx + 1
        end = headers[k + 1][0] if k + 1 < len(headers) else len(lines)
        seg = lines[start:end]
        data_rows = [ln for ln in seg if is_data_row(ln)]
        counts.append((name, len(data_rows)))
        logger.info("  %-14s 数据行数=%d (区间 L%d..L%d, 含空行/标题=%d)",
                    name, len(data_rows), start + 1, end, len(seg))

    uniq = sorted(set(c for _, c in counts))
    logger.info("各组行数集合=%s", uniq)
    if len(uniq) == 1:
        d = uniq[0]
        logger.info("✅ 所有组行数一致=%d -> 若 Global_Dem*4==%d 则 dNumber 对齐, ReadZFile 可正确解析", d, d)
    else:
        logger.warning("⚠ 各组行数不一致, dNumber 无法同时对齐所有组, ReadZFile 会错位")


if __name__ == "__main__":
    main()
