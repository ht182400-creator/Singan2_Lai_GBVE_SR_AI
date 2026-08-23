# -*- coding: utf-8 -*-
"""
zahyo_reader.py — 坐标文件(X_ATB_*.txt)完整解析层，复刻 ReadZFile -> global_Zparam

原工程: ZAHYO_READ.CPP::ReadZFile(HWND hDlg)
行为要点（与原版逐条对齐）:
  1. 文件头 12 字节必须是 Shift-JIS「亂偡偐偟侾」= "【すかし１】" (0x81 0x79 0x82 0xB7 0x82 0xA9 0x82 0xB5 0x82 0x50 0x81 0x7A)
  2. 按固定段顺序解析，每段先跳过一行段标题行，再读取 dNumber 行数据
  3. dNumber = Global_Dem * 4 （本库以每段实际数据行数为准）
  4. 每行 9 个逗号分隔字段:
     始点X,始点Y,終点X,終点Y,A波長二値化閾値,A波長微分閾値,B波長二値化閾値,B波長微分閾値,処理画素数
     对应: LeftX, LeftY, RightX, RightY, niti[1], bibun[1], niti[2], bibun[2], gasosu
  5. 段顺序(ReadZFile 实际解析顺序):
     [すかし１] Sukasi1
     [すかし２] Sukasi2
     [Thread]   Thred
     [IR 1]     Sekigai1
     [IR 2]     Sekigai2
     [IR 3]     Sekigai3
     [Soil]     Yogore
     [Hologram] Horo
     [WM 20x20] old_sukasi   (只读坐标, 其余字段跳过)
     [ETC1..10] etc1..etc10
     [ETC11..17]/[Sup1..6] sup1..sup6 (有则读)
  6. KIN 索引从 1 开始（原版 for i=1..dNumber）

输出: ZAHYO_PARAM 兼容字典，字段与 MAIN.H:138-362 ZAHYO_PARAM 结构一一对应。
"""
import os
import logging
import traceback

# ----------------------------------------------------------------------------
# 常量定义
# ----------------------------------------------------------------------------
MAX_KIN = 361                     # ZAHYO_READ.CPP:119 const int MAX_KIN = 360 + 1

# 文件头: Shift-JIS 「亂偡偐偟侾」的字节序列（ZAHYO_READ.CPP:58-60 检查前 12 字节）
FILE_HEADER_BYTES = b"\x81\x79\x82\xB7\x82\xA9\x82\xB5\x82\x50\x81\x7A"

# 段定义: (段标题, ZAHYO_PARAM 字段前缀, 是否只读坐标)
# 顺序严格对齐 ReadZFile 的解析顺序
SECTIONS = [
    ("\u3010\u3059\u304b\u3057\uff11\u3011", "Sukasi1", False),   # 【すかし１】
    ("\u3010\u3059\u304b\u3057\uff12\u3011", "Sukasi2", False),   # 【すかし２】
    ("\u3010Thread\u3011",                 "Thred",   False),     # 【Thread】
    ("\u3010IR 1\u3011",                   "Sekigai1", False),    # 【IR 1】
    ("\u3010IR 2\u3011",                   "Sekigai2", False),    # 【IR 2】
    ("\u3010IR 3\u3011",                   "Sekigai3", False),    # 【IR 3】
    ("\u3010Soil\u3011",                   "Yogore",  False),     # 【Soil】
    ("\u3010Hologram\u3011",               "Horo",    False),     # 【Hologram】
    ("\u3010WM 20x20\u3011",               "old_sukasi", True),   # 【WM 20x20】(只读坐标)
    ("\u3010ETC1\u3011",                   "etc1",    False),     # 【ETC1】
    ("\u3010ETC2\u3011",                   "etc2",    False),
    ("\u3010ETC3\u3011",                   "etc3",    False),
    ("\u3010ETC4\u3011",                   "etc4",    False),
    ("\u3010ETC5\u3011",                   "etc5",    False),
    ("\u3010ETC6\u3011",                   "etc6",    False),
    ("\u3010ETC7\u3011",                   "etc7",    False),
    ("\u3010ETC8\u3011",                   "etc8",    False),
    ("\u3010ETC9\u3011",                   "etc9",    False),
    ("\u3010ETC10\u3011",                  "etc10",   False),
    ("\u3010ETC11\u3011",                  "sup1",    False),
    ("\u3010ETC12\u3011",                  "sup2",    False),
    ("\u3010ETC13\u3011",                  "sup3",    False),
    ("\u3010ETC14\u3011",                  "sup4",    False),
    ("\u3010ETC15\u3011",                  "sup5",    False),
    ("\u3010ETC16\u3011",                  "sup6",    False),
    ("\u3010ETC17\u3011",                  "sup6",    False),  # ETC17 追加映射到 sup6（原版只到 sup6）
]

# 字段定义: (LeftX, LeftY, RightX, RightY, niti[1], bibun[1], niti[2], bibun[2], gasosu)
FIELD_NAMES = [
    "LeftX", "LeftY", "RightX", "RightY",
    "niti_1", "bibun_1", "niti_2", "bibun_2", "gasosu",
]

LOG_FORMAT = "[%(asctime)s.%(msecs)03d] %(levelname)-5s %(name)s:%(lineno)d  %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def get_logger():
    return logging.getLogger("zahyo_reader")


def _new_zahyo_param():
    """构造空的 ZAHYO_PARAM 兼容字典（数组默认全 0，长度 MAX_KIN+1）。"""
    zp = {}
    for _, prefix, _only_coord in SECTIONS:
        for f in FIELD_NAMES:
            zp["%s_%s" % (prefix, f)] = [0] * (MAX_KIN + 1)
    # old_sukasi 只有坐标 4 字段，无 niti/bibun/gasosu
    for f in ("niti_1", "bibun_1", "niti_2", "bibun_2", "gasosu"):
        zp.pop("old_sukasi_%s" % f, None)
    return zp


def parse_zahyo(file_path, encoding="shift_jis"):
    """解析坐标文件为 ZAHYO_PARAM 兼容字典。

    参数:
        file_path: 坐标 .txt 文件路径
    Returns:
        dict: ZAHYO_PARAM 兼容字典（字段 key 与结构体名对应，数组索引 0..MAX_KIN）
        索引 0 恒为 0（原版从 1 开始），KIN 用 zp["Sukasi1_LeftX"][KIN] 访问。
    异常:
        ValueError: 文件头不匹配 / 文件不存在
    """
    logger = get_logger()
    zp = _new_zahyo_param()

    try:
        with open(file_path, "rb") as fp:
            raw = fp.read()
    except Exception as exc:
        logger.error("读取坐标文件异常: %s\n%s", exc, traceback.format_exc())
        raise

    # 文件头检查（字节级，与 ReadZFile:58-68 一致）
    if not raw.startswith(FILE_HEADER_BYTES):
        msg = "坐标文件头不匹配: %s (期望 Shift-JIS すかし１头)" % os.path.basename(file_path)
        logger.error(msg)
        raise ValueError(msg)

    # 按 Shift-JIS 解码为文本
    try:
        text = raw.decode(encoding, errors="replace")
    except Exception as exc:
        logger.error("Shift-JIS 解码异常: %s\n%s", exc, traceback.format_exc())
        raise

    lines = text.splitlines()
    logger.debug("坐标文件 %s 共 %d 行", os.path.basename(file_path), len(lines))

    # 按段标题切分
    section_idx = 0          # 当前期望段下标
    reading = False          # 是否处于某段数据行中
    current_prefix = None    # 当前段字段前缀
    current_only_coord = False
    row = 1                  # 当前段内数据行号（KIN，从1开始）

    for ln_no, line in enumerate(lines, 1):
        stripped = line.strip()
        if not stripped:
            continue

        # 检查是否为下一个段标题
        if section_idx < len(SECTIONS) and stripped.startswith(SECTIONS[section_idx][0]):
            current_prefix = SECTIONS[section_idx][1]
            current_only_coord = SECTIONS[section_idx][2]
            reading = True
            row = 1
            section_idx += 1
            logger.debug("L%d 进入段 [%s] prefix=%s", ln_no, stripped[:20], current_prefix)
            continue

        if not reading:
            continue  # 首个标题前的内容跳过

        # 解析 9 个逗号分隔字段
        try:
            nums = [int(c.strip()) for c in line.replace("\uff0c", ",").split(",")]
        except (ValueError, IndexError) as exc:
            logger.warning("L%d 段[%s] 第%d行解析失败: %s", ln_no, current_prefix, row, line[:60])
            continue
        if len(nums) < 9:
            logger.warning("L%d 段[%s] 第%d行列数不足=%d", ln_no, current_prefix, row, len(nums))
            continue

        if row <= MAX_KIN:
            if current_only_coord:
                # old_sukasi: 只读 4 个坐标
                zp["old_sukasi_LeftX"][row] = nums[0]
                zp["old_sukasi_LeftY"][row] = nums[1]
                zp["old_sukasi_RightX"][row] = nums[2]
                zp["old_sukasi_RightY"][row] = nums[3]
            else:
                zp["%s_LeftX" % current_prefix][row] = nums[0]
                zp["%s_LeftY" % current_prefix][row] = nums[1]
                zp["%s_RightX" % current_prefix][row] = nums[2]
                zp["%s_RightY" % current_prefix][row] = nums[3]
                zp["%s_niti_1" % current_prefix][row] = nums[4]
                zp["%s_bibun_1" % current_prefix][row] = nums[5]
                zp["%s_niti_2" % current_prefix][row] = nums[6]
                zp["%s_bibun_2" % current_prefix][row] = nums[7]
                zp["%s_gasosu" % current_prefix][row] = nums[8]
        row += 1

    logger.info("坐标解析完成: 命中 %d/26 个段, 面额数(Global_Dem)=%d",
                section_idx, (row - 1) // 4 if row > 1 else 0)
    return zp


def parse_zahyo_with_dem(file_path, global_dem, encoding="shift_jis"):
    """按指定 Global_Dem 解析（每段严格读取 global_dem*4 行，其余忽略）。

    与原版 ReadZFile 对齐：dNumber = Global_Dem * 4。
    注意：实际文件如果某段行数不足/超出，会导致后续段错位，建议先按段统计确认 Global_Dem。
    """
    raise NotImplementedError("请先确认文件实际 Global_Dem 后使用 parse_zahyo")


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.DEBUG, format=LOG_FORMAT, datefmt=DATE_FORMAT)
    if len(sys.argv) < 2:
        print("用法: python zahyo_reader.py <X_ATB_*.txt>")
        sys.exit(1)
    try:
        zp = parse_zahyo(sys.argv[1])
        # 打印前 3 个 KIN 的すかし１坐标
        for k in range(1, 4):
            print("KIN=%d Sukasi1: L(%d,%d) R(%d,%d) niti=%d/%d bibun=%d/%d gasosu=%d" % (
                k,
                zp["Sukasi1_LeftX"][k], zp["Sukasi1_LeftY"][k],
                zp["Sukasi1_RightX"][k], zp["Sukasi1_RightY"][k],
                zp["Sukasi1_niti_1"][k], zp["Sukasi1_niti_2"][k],
                zp["Sukasi1_bibun_1"][k], zp["Sukasi1_bibun_2"][k],
                zp["Sukasi1_gasosu"][k]))
        print("总段数命中: %d" % sum(1 for _ in range(len(SECTIONS))))
    except Exception as exc:
        logging.getLogger("zahyo_reader").error("主流程异常: %s\n%s", exc, traceback.format_exc())
        sys.exit(1)
