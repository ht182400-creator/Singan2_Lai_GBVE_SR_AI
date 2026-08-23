# -*- coding: utf-8 -*-
"""
verify_small_image.py — 验证 global_small_image 提取并计算 sikisa(S2[12]) 是否匹配 a.csv

C++ 读取流程（MainRun.cpp:813-826 + 848）:
  offset = oneDataSize*iData + lengthSruHeader(0) + offsetMmDataHeader(0) + lengthMmFileHeader + 24
  fread(global_small_image, SMALL_SIZE=8192)
  if data1OrData2==1: memcpy(global_small_image, global_small_image+1024, SMALL_SIZE-1024)
sikisa = sum(|small[i] - small[i+220]|), i=0..219
"""
import struct
import sys
import logging
import traceback

DAT = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\ZAR\2A_DA_111017_115542.dat"
CSV = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug\a.csv"

HEADER = 24
SMALL_SIZE = 8192
SKIP = 1024


def parse_blocks(data):
    n = len(data)
    offset = 0
    blocks = []
    while offset + HEADER <= n:
        hdr = data[offset:offset + HEADER]
        dsize = struct.unpack("<I", hdr[0:4])[0]
        itype = hdr[4] & 0xFF
        blocks.append((itype, dsize, offset))
        if dsize <= 0:
            break
        offset += dsize
    return blocks


def compute_layout(blocks):
    length_mm_file_header = 0
    one_data_size = 0
    first_data = False
    for (itype, dsize, off) in blocks:
        if itype == 0:
            length_mm_file_header = dsize
            continue
        if itype == 1:
            if first_data:
                break  # oneRecordEnd
            first_data = True
        one_data_size += dsize
    return length_mm_file_header, one_data_size


def extract_small_image(data, record_index, length_mm_file_header, one_data_size):
    offset = one_data_size * record_index + length_mm_file_header + 24
    seg = bytearray(data[offset:offset + SMALL_SIZE])
    # memcpy(global_small_image, global_small_image + 1024, SMALL_SIZE - 1024)
    for i in range(SMALL_SIZE - SKIP):
        seg[i] = seg[i + SKIP]
    return bytes(seg)


def main():
    logging.basicConfig(level=logging.INFO, format="%(levelname)-5s %(message)s")
    try:
        data = open(DAT, "rb").read()
        blocks = parse_blocks(data)
        lmfh, ods = compute_layout(blocks)
        logging.info("lengthMmFileHeader=%d oneDataSize=%d", lmfh, ods)

        # 读 a.csv 期望 S2[12]
        import csv as _csv
        rows = list(_csv.reader(open(CSV, encoding="gbk", errors="replace")))
        exp12 = int(rows[0][12])
        exp11 = int(rows[0][11])
        logging.info("a.csv record0: S2[12]=%d S2[11]=%d", exp12, exp11)

        for rec in (0, 1):
            sm = extract_small_image(data, rec, lmfh, ods)
            sikisa = 0
            for i in range(220):
                sikisa += abs(sm[i] - sm[i + 220])
            # speed 字段
            speed = (sm[5790] << 8) + sm[5791]
            red_add = (sm[2250] << 8) + sm[2251]
            grn_add = (sm[2252] << 8) + sm[2253]
            logging.info("record%d: sikisa=%d (期望 S2[12]=%d)  speed=%d red_add=%d grn_add=%d",
                         rec, sikisa, exp12 if rec == 0 else -1, speed, red_add, grn_add)
            # 前40字节可视化
            logging.info("  small[0..20]=%s", " ".join("%02X" % x for x in sm[0:20]))
            logging.info("  small[220..240]=%s", " ".join("%02X" % x for x in sm[220:240]))
    except Exception as exc:
        logging.error("异常: %s\n%s", exc, traceback.format_exc())
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
