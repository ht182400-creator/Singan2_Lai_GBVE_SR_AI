# -*- coding: utf-8 -*-
"""二进制文件分析工具：用于分析 SINGAN2 改造工程的数据文件/坐标文件格式。

当前用途：
- 查看 data/ 下 .dat / .bin 文件头部的十六进制内容，辅助确定文件格式。

用法：
    python tools/analyze_binary.py <文件路径> [--bytes N]

日志规范：使用 logging，禁止 print()。
"""

import argparse
import logging
import os
import sys

# 日志格式（精确到毫秒）
_LOG_FORMAT = "[%(asctime)s.%(msecs)03d] %(levelname)-5s %(name)s:%(lineno)d  %(message)s"
_LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# 默认查看字节数
DEFAULT_BYTES = 256
# 每行十六进制列数
HEX_COLUMNS = 16


def setup_logger() -> logging.Logger:
    """初始化控制台+文件双输出日志。

    Returns:
        logging.Logger: 配置好的 logger 实例
    """
    logger = logging.getLogger("analyze_binary")
    logger.setLevel(logging.DEBUG)
    logger.propagate = False

    # 控制台 handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(logging.Formatter(_LOG_FORMAT, _LOG_DATE_FORMAT))
    logger.addHandler(console_handler)

    # 文件 handler（带时间戳，不覆盖）
    try:
        log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "logs")
        os.makedirs(log_dir, exist_ok=True)
        import datetime

        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        log_path = os.path.join(log_dir, f"analyze_binary_{timestamp}.log")
        file_handler = logging.FileHandler(log_path, encoding="utf-8")
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(logging.Formatter(_LOG_FORMAT, _LOG_DATE_FORMAT))
        logger.addHandler(file_handler)
        logger.info("日志文件: %s", log_path)
    except OSError as exc:
        # 文件日志初始化失败不影响主流程
        logger.warning("文件日志初始化失败: %s", exc)

    return logger


def dump_hex(data: bytes, offset: int = 0) -> str:
    """将字节数据格式化为带偏移和 ASCII 的十六进制文本。

    Args:
        data (bytes): 待格式化字节
        offset (int): 起始偏移（用于显示文件绝对偏移）

    Returns:
        str: 格式化后的十六进制文本
    """
    lines = []
    for i in range(0, len(data), HEX_COLUMNS):
        chunk = data[i:i + HEX_COLUMNS]
        hex_part = " ".join(f"{b:02X}" for b in chunk)
        hex_part = hex_part.ljust(HEX_COLUMNS * 3 - 1)
        ascii_part = "".join(chr(b) if 32 <= b < 127 else "." for b in chunk)
        lines.append(f"{offset + i:08X}  {hex_part}  |{ascii_part}|")
    return "\n".join(lines)


def analyze_file(file_path: str, byte_count: int, logger: logging.Logger) -> None:
    """分析单个文件：读取头部并输出十六进制与统计信息。

    Args:
        file_path (str): 文件路径
        byte_count (int): 查看的字节数
        logger (logging.Logger): 日志器
    """
    if not os.path.isfile(file_path):
        logger.error("文件不存在: %s", file_path)
        return

    file_size = os.path.getsize(file_path)
    logger.info("文件: %s", file_path)
    logger.info("大小: %d 字节 (0x%X)", file_size, file_size)

    try:
        with open(file_path, "rb") as f:
            head = f.read(byte_count)
    except OSError as exc:
        logger.error("读取文件失败: %s", exc)
        return

    logger.info("===== 头部 %d 字节十六进制 =====", len(head))
    logger.info("\n%s", dump_hex(head, 0))

    # 常见格式探测
    magic = head[:4]
    if head.startswith(b"MZ"):
        logger.info("探测结果: PE 可执行文件 (MZ)")
    elif head.startswith(b"\x89PNG"):
        logger.info("探测结果: PNG 图像")
    elif head.startswith(b"GIF8"):
        logger.info("探测结果: GIF 图像")
    elif head.startswith(b"BM"):
        logger.info("探测结果: BMP 图像")
    elif head.startswith(b"II*\x00") or head.startswith(b"MM\x00*"):
        logger.info("探测结果: TIFF 图像")
    elif magic[:2] in (b"\xff\xd8",):
        logger.info("探测结果: JPEG 图像")
    else:
        logger.info("探测结果: 未知格式 (可能是自定义二进制，需要结合代码解析)")
        logger.info("前 4 字节: %s", " ".join(f"{b:02X}" for b in magic))


def main() -> None:
    """主入口：解析命令行参数并分析文件。"""
    logger = setup_logger()
    parser = argparse.ArgumentParser(description="SINGAN2 二进制文件分析工具")
    parser.add_argument("file_path", help="待分析文件路径")
    parser.add_argument("--bytes", type=int, default=DEFAULT_BYTES,
                        help=f"查看字节数，默认 {DEFAULT_BYTES}")
    args = parser.parse_args()

    logger.debug("main 入口: file=%s bytes=%d", args.file_path, args.bytes)
    analyze_file(args.file_path, args.bytes, logger)
    logger.info("分析完成")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # 顶层兜底，避免静默崩溃
        logging.exception("分析脚本异常")
        sys.exit(1)
