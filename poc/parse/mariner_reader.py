# -*- coding: utf-8 -*-
"""
mariner_reader.py — SINGAN2 Mariner 数据文件(.dat)解析层

复刻原工程 CTemplateData::CheckFile 的块链遍历逻辑 + MainRun::ReadImgDataNew
的 MM1_Side 提取逻辑，把数据文件还原为算法层(C_SI2)需要的 global_onedat 缓冲。

设计原则（遵循项目编码规范）：
  - 不依赖任何 Win32 API，纯 Python 标准库，可直接作为 WASM/Node 移植参考
  - 所有魔法数字提取为常量
  - 关键函数 try-catch + logging（毫秒格式）

图像尺寸固定 88×186（硬编码，文件内 width/height 字段为 0，已验证）
S2 算法输入为 MM1_Side（8bit/像素），每波段 16368 字节 + 24 字节填充 = 16392 字节/块
"""
import os
import logging
import struct
import traceback

# ----------------------------------------------------------------------------
# 常量定义（与 MAIN.H / CDataHeader.h / MainRun.cpp 保持一致）
# ----------------------------------------------------------------------------
Y_SIZE = 88                       # 图像高度（行）
X_SIZE = 186                      # 图像宽度（列）
ONESIZE = Y_SIZE * X_SIZE         # 单波段像素数 = 16368
SIZE_NON_GBVX = 24                # 每波段间填充字节（GBVX）
MM1_SIDE_BLOCK = ONESIZE + SIZE_NON_GBVX   # 单 MM1_Side 块字节 = 16392
WAVE_COUNT = 13                   # MM1_Side 波段数
BLOCK_HEADER = 24                 # 块头字节数（sizeof(BYTE[24])=24，CheckFile 用 fread(dataHeader,24)；
                                  # small_image 偏移验证 = lengthMmFileHeader+24，数据从块头后开始）
GLOBAL_ONEDAT_SIZE = MM1_SIDE_BLOCK * WAVE_COUNT  # 单枚 global_onedat = 213096
SMALL_SIZE = 8192                 # MAIN.H SMALL_SIZE（缩小数据+DSP+AR）
SMALL_SKIP = 1024                 # 读取后 memcpy 跳过的头部字节数

# 块类型枚举（CDataHeader.h EnumImageType）
ENUM_IMAGE_TYPE = {
    0: "Head1", 1: "Head2", 2: "MM1Yose", 3: "MM8_Img", 4: "MM1_Img",
    5: "MM1_Side", 6: "Magnetic", 7: "Thickness", 8: "UV", 9: "HEAD_SRU",
    12: "SRU_Correction", 13: "SRU_MM8", 14: "SRU_Img", 15: "SRU_Side",
    16: "SRU_Mag", 17: "SRU_Thickness", 18: "SRU_SNR", 99: "Other",
}

# 波段 k -> 目标图像(Img1..Img22) 的映射（MainRun.cpp ReadImgDataNew memcpy 顺序）
# k 为 global_onedat 内第 k 个 (onesize+24) 间隔的波段索引
WAVE_TO_IMG = {
    0: "Img1", 4: "Img2", 5: "Img3", 6: "Img4", 7: "Img5", 8: "Img6",
    9: "Img16", 10: "Img17", 11: "Img18", 12: "Img19",
    1: "Img20", 2: "Img21", 3: "Img22",
}

LOG_FORMAT = "[%(asctime)s.%(msecs)03d] %(levelname)-5s %(name)s:%(lineno)d  %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def get_logger():
    """获取模块 logger（避免重复 addHandler）"""
    return logging.getLogger("mariner_reader")


def parse_blocks(file_path):
    """遍历 .dat 块链，返回块列表 [(type_name, type_id, data_size, data_offset), ...]

    复刻 CheckFile 的块链遍历：每个块头部 32 字节，前 4 字节小端为 dataSize，
    第 5 字节为 imageType。offset 累加 dataSize 跳到下一块。
    """
    logger = get_logger()
    blocks = []
    try:
        with open(file_path, "rb") as fp:
            data = fp.read()
        n = len(data)
        is_sru = (n >= 3 and data[0:3] == b"SRU")
        offset = 3 if is_sru else 0
        logger.debug("parse_blocks: 文件=%s 大小=%d SRU=%s 起始offset=%d",
                     os.path.basename(file_path), n, is_sru, offset)
        while offset + BLOCK_HEADER <= n:
            header = data[offset:offset + BLOCK_HEADER]
            data_size = struct.unpack("<I", header[0:4])[0]
            image_type = header[4]
            type_name = ENUM_IMAGE_TYPE.get(image_type, "UNKNOWN(%d)" % image_type)
            blocks.append((type_name, image_type, data_size, offset))
            if data_size <= 0:
                logger.error("非法块 dataSize=%d @ offset=%d，停止防止死循环", data_size, offset)
                break
            offset += data_size
        logger.info("parse_blocks 完成: 共解析 %d 个块", len(blocks))
    except Exception as exc:
        logger.error("parse_blocks 异常: %s\n%s", exc, traceback.format_exc())
        raise
    return blocks


def extract_mm1_side(file_path, record_index=0):
    """提取指定枚(record_index)的 MM1_Side 数据，拼成 global_onedat(213096 字节)

    返回: bytes(global_onedat) 或 None（越界时）
    """
    logger = get_logger()
    try:
        blocks = parse_blocks(file_path)
        side_blocks = [b for b in blocks if b[1] == 5]  # type==5 MM1_Side
        logger.info("MM1_Side 块总数=%d，预计可组成 %d 枚",
                    len(side_blocks), len(side_blocks) // WAVE_COUNT)
        start = record_index * WAVE_COUNT
        if start + WAVE_COUNT > len(side_blocks):
            logger.error("record_index=%d 越界（仅有 %d 个 MM1_Side 块）",
                         record_index, len(side_blocks))
            return None
        with open(file_path, "rb") as fp:
            data = fp.read()
        global_onedat = bytearray()
        for k in range(WAVE_COUNT):
            blk = side_blocks[start + k]
            data_offset = blk[3] + BLOCK_HEADER   # 跳过 32 字节块头
            seg = data[data_offset:data_offset + MM1_SIDE_BLOCK]
            if len(seg) != MM1_SIDE_BLOCK:
                logger.error("MM1_Side 块 %d 数据长度异常=%d（期望 %d）",
                             start + k, len(seg), MM1_SIDE_BLOCK)
                return None
            global_onedat.extend(seg)
        logger.info("提取第 %d 枚 global_onedat: 长度=%d（期望 %d）",
                    record_index, len(global_onedat), GLOBAL_ONEDAT_SIZE)
        return bytes(global_onedat)
    except Exception as exc:
        logger.error("extract_mm1_side 异常: %s\n%s", exc, traceback.format_exc())
        raise


def extract_small_image(file_path, record_index=0):
    """提取指定枚的 global_small_image（8192 字节，跳过前 1024 后 memcpy 前移）

    复刻 MainRun.cpp ReadImgDataNew readSmallImage 分支:
      offset = oneDataSize*iData + lengthSruHeader + offsetMmDataHeader
               + lengthMmFileHeader + sizeof(dataHeader)=24
      随后 memcpy(global_small_image, global_small_image+1024, SMALL_SIZE-1024)

    返回: bytes(SMALL_SIZE) 或 None
    """
    logger = get_logger()
    try:
        data = open(file_path, "rb").read()
        blocks = parse_blocks(file_path)
        # 计算 lengthMmFileHeader(Head1) 与 oneDataSize（CheckFile 逻辑）
        length_mm_file_header = 0
        one_data_size = 0
        first_data = False
        for (tname, itype, dsize, off) in blocks:
            if itype == 0:                      # Head1
                length_mm_file_header = dsize
                continue
            if itype == 1:                      # Head2
                if first_data:
                    break                       # oneRecordEnd
                first_data = True
            one_data_size += dsize
        offset = one_data_size * record_index + length_mm_file_header + 24
        seg = bytearray(data[offset:offset + SMALL_SIZE])
        if len(seg) != SMALL_SIZE:
            logger.error("small_image 长度异常=%d（期望 %d）@offset=%d",
                         len(seg), SMALL_SIZE, offset)
            return None
        # memcpy(global_small_image, global_small_image+1024, SMALL_SIZE-1024)
        for i in range(SMALL_SIZE - SMALL_SKIP):
            seg[i] = seg[i + SMALL_SKIP]
        logger.info("提取第 %d 枚 small_image: offset=%d 长度=%d",
                    record_index, offset, len(seg))
        return bytes(seg)
    except Exception as exc:
        logger.error("extract_small_image 异常: %s\n%s", exc, traceback.format_exc())
        raise


def build_onebyte_images(global_onedat):
    """按 ReadImgDataNew 的 memcpy 布局，从 global_onedat 还原 8bit 波段图像

    返回: dict {img_name: bytearray(16368)}，仅含 WAVE_TO_IMG 定义的 13 个波段
    """
    logger = get_logger()
    images = {}
    try:
        if len(global_onedat) != GLOBAL_ONEDAT_SIZE:
            logger.error("global_onedat 长度=%d 不符期望 %d",
                         len(global_onedat), GLOBAL_ONEDAT_SIZE)
            return images
        for k, img_name in WAVE_TO_IMG.items():
            base = (ONESIZE + SIZE_NON_GBVX) * k
            seg = global_onedat[base:base + ONESIZE]
            images[img_name] = bytearray(seg)
        logger.info("build_onebyte_images 完成: 还原 %d 个波段图像", len(images))
    except Exception as exc:
        logger.error("build_onebyte_images 异常: %s\n%s", exc, traceback.format_exc())
        raise
    return images
