#!/usr/bin/env python3
"""
ATB .bin 解析参考实现（验证用）。
对应原工程 WinMain.cpp:LoadATB 与 OnDrawPaint.cpp 中的 global_ATBS[128][512*8]。
"""
import struct
import logging
import traceback
from typing import Dict, List, Tuple, Optional

# 与原工程 MAIN.H:507 对齐
ATB_SECURITY_COUNT = 128          # global_ATBS 第一维
ATB_DENOS_PER_SECURITY = 512      # 128 * 4 = 512 (4 faces x 128 denos)
ATB_FACE_COUNT = 4
ATB_AREA_BYTES = 8
ATB_SECURITY_SIZE = ATB_DENOS_PER_SECURITY * ATB_AREA_BYTES  # 4096
ATB_FILE_SIZE = ATB_SECURITY_COUNT * ATB_SECURITY_SIZE        # 524288

# GetATBAreaName 映射（WinMain.cpp:3100）
ATB_AREA_NAMES = {
    0: "WM1",
    1: "WM2",
    2: "Thread",
    3: "IR1",
    4: "IR2",
    5: "IR3",
    6: "Dirt",
    7: "Hologram",
    8: "WM(20x20)",
}

log = logging.getLogger(__name__)


def _get_area_name(sec_idx: int) -> str:
    """复刻 GetATBAreaName 的命名规则。"""
    if sec_idx in ATB_AREA_NAMES:
        return f"{0x4000 + sec_idx:04X} {ATB_AREA_NAMES[sec_idx]}"
    if 9 <= sec_idx < 19:
        return f"{0x4000 + sec_idx:04X} ETC-{sec_idx - 9:3d}"
    if sec_idx >= 19:
        return f"{0x4000 + sec_idx:04X} ETC-{sec_idx - 9:3d} Sup-{sec_idx - 19:3d}"
    return f"{0x4000 + sec_idx:04X} Unknown"


def parse_atb_bin(file_path: str) -> Tuple[bytes, Dict[int, List[Dict[str, int]]]]:
    """
    解析 ATB .bin 文件。

    参数:
        file_path: ATB .bin 文件路径
    返回:
        (raw_bytes, parsed) 其中 parsed[security_index] = 非空区域列表
        每个区域 dict 字段: x1, y1, width, height, a_threshold, a_diff_threshold,
                            b_threshold, b_diff_threshold, deno, face, name
    异常:
        IOError: 文件读失败
        ValueError: 文件大小不符合 ATB_FILE_SIZE
    """
    try:
        with open(file_path, "rb") as fpr:
            raw = fpr.read()
    except Exception as exc:
        log.error("读取 ATB bin 文件异常: %s\n%s", exc, traceback.format_exc())
        raise

    if len(raw) != ATB_FILE_SIZE:
        msg = f"ATB bin 大小异常: {len(raw)} (期望 {ATB_FILE_SIZE})"
        log.error(msg)
        raise ValueError(msg)

    parsed: Dict[int, List[Dict[str, int]]] = {}
    for sec in range(ATB_SECURITY_COUNT):
        base = sec * ATB_SECURITY_SIZE
        security_block = raw[base:base + ATB_SECURITY_SIZE]
        areas: List[Dict[str, int]] = []
        for deno in range(128):  # 仅 128 denos，4 faces
            for face in range(ATB_FACE_COUNT):
                off = (deno * ATB_FACE_COUNT + face) * ATB_AREA_BYTES
                a = security_block[off:off + ATB_AREA_BYTES]
                x1, y1, width, height, a_th, a_diff, b_th, b_diff = struct.unpack("<BBBBBBBB", a)
                if x1 == 0 and y1 == 0 and width == 0 and height == 0:
                    continue
                areas.append({
                    "x1": x1,
                    "y1": y1,
                    "width": width,
                    "height": height,
                    "a_threshold": a_th,
                    "a_diff_threshold": a_diff,
                    "b_threshold": b_th,
                    "b_diff_threshold": b_diff,
                    "deno": deno,
                    "face": face,
                })
        if areas:
            parsed[sec] = areas

    log.info("解析 ATB bin 完成: %s 个 security 非空", len(parsed))
    return raw, parsed


def get_nonempty_summary(parsed: Dict[int, List[Dict[str, int]]]) -> List[str]:
    """返回非空 security 摘要列表。"""
    lines = []
    for sec in sorted(parsed.keys()):
        lines.append(f"security {sec:3d} ({_get_area_name(sec)}): {len(parsed[sec])} areas")
    return lines


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, format="[%(asctime)s.%(msecs)03d] %(levelname)-5s %(name)s:%(lineno)d  %(message)s")
    if len(sys.argv) < 2:
        print("用法: python _atb_reader.py <ATB.bin>")
        sys.exit(1)
    try:
        raw, parsed = parse_atb_bin(sys.argv[1])
        for line in get_nonempty_summary(parsed):
            print(line)
    except Exception as exc:
        log.error("主流程异常: %s\n%s", exc, traceback.format_exc())
        sys.exit(1)
