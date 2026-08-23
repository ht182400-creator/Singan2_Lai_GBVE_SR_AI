# -*- coding: utf-8 -*-
"""
wtable.py — 除法表 GBV_DIV_H.bin 加载（复刻 WinMain.cpp w_Read）

w_Table[n] 约为 65536/n（16位定点），用于代替除法。
读取: 整个文件按 UINT16 小端读入。
"""
import os
import numpy as np
import logging
import traceback

W_TABLE_SIZE = 16384  # 32768 bytes / 2


def get_logger():
    return logging.getLogger("wtable")


def load_w_table(file_path):
    """加载 GBV_DIV_H.bin -> w_Table (np.uint16 数组)。

    参数:
        file_path: GBV_DIV_H.bin 路径
    返回:
        np.ndarray(16384,) uint16
    异常:
        IOError: 文件读取失败
    """
    try:
        with open(file_path, "rb") as fp:
            raw = fp.read()
        if len(raw) != W_TABLE_SIZE * 2:
            get_logger().warning("w_Table 文件大小 %d (期望 %d)，仍尝试读取", len(raw), W_TABLE_SIZE * 2)
        n = min(len(raw) // 2, W_TABLE_SIZE)
        arr = np.frombuffer(raw[:n * 2], dtype="<u2").astype(np.uint16)
        if n < W_TABLE_SIZE:
            arr = np.pad(arr, (0, W_TABLE_SIZE - n), mode="constant", constant_values=0)
        get_logger().info("w_Table 加载完成: %d 项", n)
        return arr
    except Exception as exc:
        get_logger().error("加载 GBV_DIV_H.bin 异常: %s\n%s", exc, traceback.format_exc())
        raise


def gen_w_table():
    """生成理论 w_Table（65536/n），用于无 bin 文件时调试。"""
    n = np.arange(1, W_TABLE_SIZE + 1, dtype=np.float64)
    vals = (65536.0 / n)
    arr = np.clip(vals, 0, 65535).astype(np.uint16)
    # 索引0 为 0（C++ memset 后 w_Table[0]=0）
    return np.concatenate(([0], arr[:W_TABLE_SIZE - 1]))
