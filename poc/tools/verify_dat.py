# -*- coding: utf-8 -*-
"""
verify_dat.py — MarinerFormat 数据文件可解析性校验工具

复刻 SINGAN2 中 CTemplateData::CheckFile 的逻辑，验证 .dat 文件是否能被
原始代码正确解析。重点输出：
  - 是否为 SRU 容器文件
  - 各 imageType 块的数量与总字节
  - 推算的 dataCount（数据枚数）
  - dataDamaged 标记（文件是否整齐 / 是否损坏）

用法：
  python verify_dat.py <dat文件路径> [<dat文件路径2> ...]

日志规范：logging 模块，格式含毫秒；输出到控制台与 logs/verify_dat_<时间戳>.log
"""
import os
import sys
import logging
import traceback

# ----------------------------------------------------------------------------
# 常量定义（与 CDataHeader.h / CTemplateData.cpp 保持一致）
# ----------------------------------------------------------------------------
# 块头部在文件中的固定偏移（小端）
HEADER_SIZE = 32                 # sizeof(CDataHeader) 对象占用字节（含 4 个 const int 成员）
DATA_SIZE_OFFSET = 0             # dataSize 位于头部前 4 字节
IMAGE_TYPE_OFFSET = 4            # imageType 位于头部第 5 字节

# EnumImageType 枚举（CDataHeader.h）
ENUM_IMAGE_TYPE = {
    0: "Head1",
    1: "Head2",
    2: "MM1Yose",
    3: "MM8_Img",
    4: "MM1_Img",
    5: "MM1_Side",
    6: "Magnetic",
    7: "Thickness",
    8: "UV",
    9: "HEAD_SRU",
    12: "SRU_Correction",
    13: "SRU_MM8",
    14: "SRU_Img",
    15: "SRU_Side",
    16: "SRU_Mag",
    17: "SRU_Thickness",
    18: "SRU_SNR",
    99: "Other",
}

LOG_FORMAT = "[%(asctime)s.%(msecs)03d] %(levelname)-5s %(name)s:%(lineno)d  %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def init_logger(log_dir):
    """初始化日志：控制台 + 文件（TimedRotating 风格按时间戳命名）"""
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "verify_dat_%s.log" % _ts())
    logger = logging.getLogger("verify_dat")
    logger.setLevel(logging.DEBUG)
    fmt = logging.Formatter(LOG_FORMAT, DATE_FORMAT)

    # 控制台
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    ch.setFormatter(fmt)
    logger.addHandler(ch)

    # 文件（初始化失败不影响主流程）
    try:
        fh = logging.FileHandler(log_path, encoding="utf-8")
        fh.setLevel(logging.DEBUG)
        fh.setFormatter(fmt)
        logger.addHandler(fh)
    except Exception as exc:
        logger.warning("文件日志初始化失败，仅使用控制台输出: %s", exc)
    return logger


def _ts():
    import datetime
    return datetime.datetime.now().strftime("%Y%m%d_%H%M%S")


def verify_one(fp_path, logger):
    """复刻 CheckFile，返回结构化校验结果"""
    result = {
        "path": fp_path,
        "file_size": 0,
        "is_sru": False,
        "blocks": [],            # [(type_name, data_size), ...]
        "type_bytes": {},        # type_name -> 总字节
        "type_count": {},        # type_name -> 块数
        "data_count": 0,
        "data_damaged": False,
        "error": None,
    }
    try:
        with open(fp_path, "rb") as fp:
            data = fp.read()
        result["file_size"] = len(data)

        # 判断是否 SRU 容器（前 3 字节 'S','R','U'）
        if len(data) >= 3 and data[0:3] == b"SRU":
            result["is_sru"] = True
            offset = 3  # 简化：实际代码 sizeof(sruHeader) 未必是 3，但 CheckFile 用 fseek 跳 SRU 头
            logger.debug("检测到 SRU 容器标记")
        else:
            offset = 0

        # 复刻 CheckFile 遍历逻辑
        one_data_size = 0
        length_sru_header = 3 if result["is_sru"] else 0
        length_mm_file_header = 0
        first_data = False
        one_record_end = False
        unknown_types = set()

        remaining = len(data) - offset
        while remaining > 0:
            if offset + HEADER_SIZE > len(data):
                logger.warning("块头部越界: offset=%d, 剩余=%d", offset, remaining)
                break
            header = data[offset:offset + HEADER_SIZE]
            data_size = int.from_bytes(header[DATA_SIZE_OFFSET:DATA_SIZE_OFFSET + 4], "little")
            image_type = header[IMAGE_TYPE_OFFSET]
            type_name = ENUM_IMAGE_TYPE.get(image_type, "UNKNOWN(%d)" % image_type)
            if image_type not in ENUM_IMAGE_TYPE:
                unknown_types.add(image_type)

            # 防死循环保护：dataSize 非法（<=0）说明不是标准块链格式
            if data_size <= 0:
                logger.error("非法块 dataSize=%d @ offset=%d，停止解析防止死循环", data_size, offset)
                logger.error("该偏移处原始字节(64B): %s", data[offset:offset + 64].hex())
                result["error"] = "非标准块链格式：offset=%d 处 dataSize=%d" % (offset, data_size)
                break

            # 死循环保护：dataSize<=0 会导致 offset 不前进、无限循环（如格式异常文件）
            if data_size <= 0:
                logger.error("非法块 dataSize=%d @ offset=%d，停止解析防止死循环", data_size, offset)
                logger.error("该偏移处原始字节(64B): %s", data[offset:offset + 64].hex())
                break
            result["blocks"].append((type_name, data_size))
            result["type_bytes"][type_name] = result["type_bytes"].get(type_name, 0) + data_size
            result["type_count"][type_name] = result["type_count"].get(type_name, 0) + 1

            # 复刻 switch 分支（仅处理 Head1 / Head2 / 累加 oneDataSize）
            if image_type == 0:  # Head1（文件头）
                length_mm_file_header = data_size
            elif image_type == 1:  # Head2（记录分隔）
                if first_data:
                    one_record_end = True
                else:
                    first_data = True

            # notHeader1Data: 除 Head1 外都累加
            if image_type != 0:
                one_data_size += data_size

            remaining -= data_size
            offset += data_size
            if one_record_end:
                break
            if remaining <= 0:
                break

        # 计算 dataCount / dataDamaged（复刻 CheckFile 末尾）
        if one_data_size > 0:
            payload = len(data) - length_sru_header - length_mm_file_header
            result["data_count"] = payload // one_data_size
            if payload % one_data_size != 0:
                result["data_damaged"] = True

        if unknown_types:
            logger.warning("出现未识别 imageType: %s", sorted(unknown_types))
        result["unknown_types"] = sorted(unknown_types)
        logger.info("解析完成: %s  size=%d  dataCount=%d  damaged=%s",
                    os.path.basename(fp_path), len(data), result["data_count"], result["data_damaged"])
    except Exception as exc:
        logger.error("校验异常: %s\n%s", exc, traceback.format_exc())
        result["error"] = str(exc)
    return result


def main(argv):
    if len(argv) < 2:
        print("用法: python verify_dat.py <dat1> [<dat2> ...]")
        return 1
    script_dir = os.path.dirname(os.path.abspath(__file__))
    log_dir = os.path.join(os.path.dirname(script_dir), "logs")
    logger = init_logger(log_dir)

    logger.info("===== MarinerFormat 数据文件校验开始 =====")
    for path in argv[1:]:
        if not os.path.exists(path):
            logger.error("文件不存在: %s", path)
            continue
        logger.info("----- 校验文件: %s -----", path)
        res = verify_one(path, logger)
        # 汇总输出
        logger.info("文件大小: %d 字节 (%.2f MB)", res["file_size"], res["file_size"] / 1024.0 / 1024.0)
        logger.info("SRU 容器: %s", res["is_sru"])
        logger.info("数据枚数 dataCount(估算): %d", res["data_count"])
        logger.info("dataDamaged(损坏/不整齐): %s", res["data_damaged"])
        logger.info("各块统计:")
        for tname in sorted(res["type_bytes"].keys()):
            logger.info("  %-14s 块数=%d  总字节=%d",
                        tname, res["type_count"].get(tname, 0), res["type_bytes"][tname])
        # 打印前若干块序列，便于人工核对结构
        head_blocks = res["blocks"][:12]
        logger.info("块序列(前 %d): %s", len(head_blocks), head_blocks)
    logger.info("===== 校验结束 =====")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except Exception as exc:
        logging.getLogger("verify_dat").error("主流程异常: %s\n%s", exc, traceback.format_exc())
        sys.exit(2)
