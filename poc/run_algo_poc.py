# -*- coding: utf-8 -*-
"""
run_algo_poc.py — M1 POC 驱动脚本（S2 算法层验证）

目标：验证算法层可脱离 Win32 独立计算出 S2[1..16]，与 a.csv 对拍。

用法:
  python run_algo_poc.py --dat <dat路径> --zfile <坐标txt路径> --wtable <GBV_DIV_H.bin>
                         [--record 0] [--kin 1] [--country 0] [--csv <a.csv>]
"""
import os
import sys
import json
import logging
import traceback
import argparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from parse.mariner_reader import extract_mm1_side, build_onebyte_images, extract_small_image
from parse.zahyo_reader import parse_zahyo
from algo.imageops import ImageEngine
from algo.wtable import load_w_table, gen_w_table
from algo.all32 import All32Engine

LOG_FORMAT = "[%(asctime)s.%(msecs)03d] %(levelname)-5s %(name)s:%(lineno)d  %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def init_logger(log_dir):
    os.makedirs(log_dir, exist_ok=True)
    import datetime
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = os.path.join(log_dir, "poc_algo_%s.log" % ts)
    logger = logging.getLogger("poc_algo")
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
    parser.add_argument("--wtable", default=None, help="GBV_DIV_H.bin 路径(缺省用理论表)")
    parser.add_argument("--record", type=int, default=0, help="枚索引")
    parser.add_argument("--kin", type=int, default=1, help="KIN 面额方向号")
    parser.add_argument("--country", type=int, default=0, help="global_SelectCountry")
    parser.add_argument("--csv", default=None, help="a.csv 对拍文件")
    args = parser.parse_args(argv[1:])

    logger = init_logger(os.path.join(SCRIPT_DIR, "logs"))
    logger.info("===== M1 POC(S2算法层) 启动 =====")
    logger.info("dat=%s zfile=%s record=%d kin=%d country=%d",
                args.dat, args.zfile, args.record, args.kin, args.country)

    try:
        # 1. 提取 global_onedat -> 波段图像
        global_onedat = extract_mm1_side(args.dat, args.record)
        if global_onedat is None:
            logger.error("extract_mm1_side 返回 None")
            return 2
        images = build_onebyte_images(global_onedat)
        logger.info("波段数=%d", len(images))

        # 1.5 提取 global_small_image（sikisa/soil_soil 依赖）
        small_image = extract_small_image(args.dat, args.record)
        logger.info("small_image 长度=%s", len(small_image) if small_image else None)

        # 2. 加载 w_Table
        if args.wtable:
            w_table = load_w_table(args.wtable)
            logger.info("w_Table 从文件加载: %d 项", len(w_table))
        else:
            w_table = gen_w_table()
            logger.warning("未提供 GBV_DIV_H.bin，使用理论表(65536/n)")

        # 3. 初始化图像引擎
        engine = ImageEngine(w_table)
        engine.set_oneimg(images)
        engine.compute_intermediate_waves()

        # 4. 解析 Z 坐标
        zp = parse_zahyo(args.zfile)
        logger.info("Z 坐标解析完成")

        # 5. 执行 ALL32
        algo = All32Engine(engine, zp, kin=args.kin, ztype=False,
                           small_image=small_image, select_country=args.country)
        s2, etc = algo.run()
        logger.info("S2[1..16] = %s", s2[1:17])
        logger.info("S2[1..32] = %s", s2[1:33])
        logger.info("global_etc[10]=%d [11]=%d", etc[10], etc[11])

        # 6. 与 a.csv 对拍
        if args.csv and os.path.exists(args.csv):
            import csv as _csv
            with open(args.csv, "r", encoding="gbk", errors="replace") as fp:
                rows = list(_csv.reader(fp))
            if args.record < len(rows):
                row = rows[args.record]
                expected = [int(v) for v in row[1:33]]  # S2[1..32]
                diffs = []
                for i in range(1, 33):
                    exp = expected[i - 1]
                    got = s2[i]
                    if exp != got:
                        diffs.append((i, exp, got))
                logger.info("a.csv 对拍: 枚%d 差异数=%d/32", args.record + 1, len(diffs))
                for d in diffs[:20]:
                    logger.info("  S2[%d]: 期望=%d 实际=%d diff=%d", d[0], d[1], d[2], d[2] - d[1])
                if not diffs:
                    logger.info("**** 全 32 项完全一致! ****")
            else:
                logger.warning("a.csv 行数不足, record=%d 行数=%d", args.record, len(rows))

        # 7. 输出 JSON
        out_dir = os.path.join(SCRIPT_DIR, "output")
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, "s2_result_rec%d.json" % args.record), "w", encoding="utf-8") as fp:
            json.dump({"S2": s2[1:33], "etc": etc, "kin": args.kin},
                      fp, ensure_ascii=False, indent=2)
        logger.info("===== M1 POC 算法层执行完成 =====")
        return 0
    except Exception as exc:
        logger.error("POC 主流程异常: %s\n%s", exc, traceback.format_exc())
        return 1


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except Exception as exc:
        logging.getLogger("poc_algo").error("致命异常: %s\n%s", exc, traceback.format_exc())
        sys.exit(2)
