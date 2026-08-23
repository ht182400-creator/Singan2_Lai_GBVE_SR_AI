# -*- coding: utf-8 -*-
"""
run_poc.py — M0 POC 驱动脚本（数据解析层验证）

目标：验证 SINGAN2 算法层可脱离 Win32 独立跑通的第一步——
  1. 用 mariner_reader 从 .dat 提取第 0 枚 MM1_Side -> global_onedat
  2. 用 readzfile 解析坐标文件 -> 区域列表
  3. 把还原的 onebyte 波段图像做基础统计（灰度积分），输出供后续对拍
  4. 全程 logging（毫秒格式 + 文件日志），异常不吞

用法:
  python run_poc.py --dat <dat路径> --zfile <坐标txt路径> [--record 0] [--out <输出目录>]
"""
import os
import sys
import json
import logging
import traceback
import argparse

# 将 parse 目录加入导入路径
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from parse.mariner_reader import (
    extract_mm1_side, build_onebyte_images, GLOBAL_ONEDAT_SIZE,
    ONESIZE, Y_SIZE, X_SIZE,
)
from parse.readzfile import parse_zfile

LOG_FORMAT = "[%(asctime)s.%(msecs)03d] %(levelname)-5s %(name)s:%(lineno)d  %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def init_logger(log_dir):
    os.makedirs(log_dir, exist_ok=True)
    import datetime
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = os.path.join(log_dir, "poc_%s.log" % ts)
    logger = logging.getLogger("poc")
    logger.setLevel(logging.DEBUG)
    fmt = logging.Formatter(LOG_FORMAT, DATE_FORMAT)
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    ch.setFormatter(fmt)
    logger.addHandler(ch)
    try:
        fh = logging.FileHandler(log_path, encoding="utf-8")
        fh.setLevel(logging.DEBUG)
        fh.setFormatter(fmt)
        logger.addHandler(fh)
    except Exception as exc:
        logger.warning("文件日志初始化失败: %s", exc)
    return logger


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--dat", required=True, help=".dat 数据文件路径")
    parser.add_argument("--zfile", required=True, help="坐标 .txt 文件路径")
    parser.add_argument("--record", type=int, default=0, help="枚索引(默认0)")
    parser.add_argument("--out", default=None, help="输出目录")
    args = parser.parse_args(argv[1:])

    log_dir = os.path.join(SCRIPT_DIR, "logs")
    logger = init_logger(log_dir)
    logger.info("===== M0 POC 启动 =====")
    logger.info("dat=%s  zfile=%s  record=%d", args.dat, args.zfile, args.record)

    try:
        # 步骤1：提取 MM1_Side -> global_onedat
        global_onedat = extract_mm1_side(args.dat, args.record)
        if global_onedat is None:
            logger.error("extract_mm1_side 返回 None，终止")
            return 2
        assert len(global_onedat) == GLOBAL_ONEDAT_SIZE, "global_onedat 长度异常"

        # 步骤2：还原 8bit 波段图像
        images = build_onebyte_images(global_onedat)
        logger.info("还原波段: %s", list(images.keys()))

        # 步骤3：基础统计（灰度积分，作为 S2[1] 类的占位参考）
        stats = {}
        for name, buf in images.items():
            total = sum(buf)
            stats[name] = {
                "min": min(buf), "max": max(buf),
                "mean": round(total / len(buf), 2), "sum": total,
            }
        logger.info("各波段灰度统计(前3): %s", dict(list(stats.items())[:3]))

        # 步骤4：解析坐标
        areas = parse_zfile(args.zfile)
        logger.info("坐标区域数=%d", len(areas))

        # 步骤5：输出到文件（供后续算法层/对拍使用）
        out_dir = args.out or os.path.join(SCRIPT_DIR, "output")
        os.makedirs(out_dir, exist_ok=True)
        # global_onedat 二进制
        with open(os.path.join(out_dir, "global_onedat_rec%d.bin" % args.record), "wb") as fp:
            fp.write(global_onedat)
        # 统计 JSON
        with open(os.path.join(out_dir, "wave_stats_rec%d.json" % args.record), "w", encoding="utf-8") as fp:
            json.dump(stats, fp, ensure_ascii=False, indent=2)
        # 坐标 JSON
        with open(os.path.join(out_dir, "areas.json"), "w", encoding="utf-8") as fp:
            json.dump(areas, fp, ensure_ascii=False, indent=2)
        logger.info("输出已写入: %s", out_dir)
        logger.info("===== M0 POC 解析层验证通过 =====")
        return 0
    except Exception as exc:
        logger.error("POC 主流程异常: %s\n%s", exc, traceback.format_exc())
        return 1


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except Exception as exc:
        logging.getLogger("poc").error("致命异常: %s\n%s", exc, traceback.format_exc())
        sys.exit(2)
