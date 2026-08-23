# -*- coding: utf-8 -*-
"""
readzfile.py — 坐标/区域文件(X_ATB_*.txt)解析层

复刻原工程 ZAHYO_READ.CPP::ReadZFile 的文本坐标解析逻辑。
文件格式（Shift-JIS 日文表头 + 数据行）：
  行1: 开始X,开始Y,终了X,终了Y,A阈值下限,A阈值上限,B阈值下限,B阈值上限,面积最小値
  后续每行: 一个矩形区域 + 阈值（逗号分隔，可能是全角/半角逗号）

解析后输出区域列表，供算法层做阈值判定与面积统计。
"""
import os
import logging
import traceback
import csv
import io

# ----------------------------------------------------------------------------
# 常量定义
# ----------------------------------------------------------------------------
EXPECTED_HEADER_COLS = 9        # 表头列数：开始X,开始Y,终了X,终了Y,A下,A上,B下,B上,面积最小
AREA_KEY = "area_min"           # 面积最小値 字段名

LOG_FORMAT = "[%(asctime)s.%(msecs)03d] %(levelname)-5s %(name)s:%(lineno)d  %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def get_logger():
    return logging.getLogger("readzfile")


def _split_csv_line(line):
    """兼容全角逗号(，)与半角逗号(,)的分隔"""
    # 先统一替换为半角逗号
    line = line.replace("，", ",").replace("、", ",")
    # 用 csv 解析以兼容引号
    reader = csv.reader(io.StringIO(line))
    for row in reader:
        return [c.strip() for c in row]
    return []


def parse_zfile(file_path, encoding="shift_jis"):
    """解析坐标文件，返回区域字典列表

    每个区域: {
      "x1":int, "y1":int, "x2":int, "y2":int,
      "a_low":int, "a_high":int, "b_low":int, "b_high":int,
      "area_min":int
    }
    """
    logger = get_logger()
    areas = []
    try:
        with open(file_path, "r", encoding=encoding, errors="replace") as fp:
            lines = fp.readlines()
        logger.debug("读取坐标文件 %s 共 %d 行", os.path.basename(file_path), len(lines))
        header_seen = False
        for ln_no, raw in enumerate(lines, 1):
            line = raw.strip()
            if not line:
                continue
            cols = _split_csv_line(line)
            if not cols:
                continue
            # 表头：含中文/日文列名，跳过
            if not header_seen:
                # 表头通常含 '开始' 或非数字首列
                try:
                    int(cols[0])
                except ValueError:
                    header_seen = True
                    logger.debug("跳过表头行 %d: %s", ln_no, line[:40])
                    continue
            # 数据行
            try:
                nums = [int(float(c)) for c in cols[:EXPECTED_HEADER_COLS]]
            except (ValueError, IndexError) as exc:
                logger.warning("行 %d 解析失败（列数=%d）: %s", ln_no, len(cols), line[:60])
                continue
            if len(nums) < EXPECTED_HEADER_COLS:
                logger.warning("行 %d 列数不足=%d，跳过", ln_no, len(nums))
                continue
            area = {
                "x1": nums[0], "y1": nums[1], "x2": nums[2], "y2": nums[3],
                "a_low": nums[4], "a_high": nums[5], "b_low": nums[6],
                "b_high": nums[7], "area_min": nums[8],
            }
            areas.append(area)
        logger.info("parse_zfile 完成: 解析 %d 个区域", len(areas))
    except Exception as exc:
        logger.error("parse_zfile 异常: %s\n%s", exc, traceback.format_exc())
        raise
    return areas


def load_atbs(file_path, encoding="shift_jis"):
    """兼容别名：返回区域列表（global_ATBS 的 Python 等价物）"""
    return parse_zfile(file_path, encoding)
