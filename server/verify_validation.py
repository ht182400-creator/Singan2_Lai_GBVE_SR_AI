#!/usr/bin/env python3
"""临时校验：复刻 core extract_small_image_validation 的偏移逻辑，对真实 .dat 验证
Validation Result 字段是否取到合理值（与 OLD/MainRun.cpp 第 833-843 行一致）。"""
import sys

BLOCK_HEADER = 24
SMALL_SIZE = 8192

def parse_blocks(data):
    blocks = []
    n = len(data)
    is_sru = data[:3] == b'SRU'
    offset = 3 if is_sru else 0
    while offset + BLOCK_HEADER <= n:
        ds = data[offset] | (data[offset+1] << 8) | (data[offset+2] << 16) | (data[offset+3] << 24)
        itype = data[offset+4]
        blocks.append((itype, ds, offset))
        if ds == 0:
            break
        offset += ds
    return blocks

def validate(dat_path, record_index):
    with open(dat_path, 'rb') as f:
        data = f.read()
    blocks = parse_blocks(data)
    length_mm_file_header = 0
    one_data_size = 0
    first_data = False
    for itype, ds, off in blocks:
        if itype == 0:  # Head1
            length_mm_file_header = ds
            continue
        if itype == 1:  # Head2
            if first_data:
                break
            first_data = True
        one_data_size += ds
    offset = one_data_size * record_index + length_mm_file_header + BLOCK_HEADER
    print(f"blocks={len(blocks)} Head1_hdrsize={length_mm_file_header} one_data_size={one_data_size} small_off={offset} (SMALL_SIZE={SMALL_SIZE})")
    if offset + SMALL_SIZE > len(data):
        print("offset 越界，无小图")
        return
    p = data[offset:offset + SMALL_SIZE]
    def u16(i):
        return (p[i] << 8) | p[i+1]
    def hex4(i, pad=True):
        return ''.join(f'{p[i+j]:02X}' if pad else f'{p[i+j]:X}' for j in range(4))
    print(f"  Ver.(han)      = {hex4(4220, False)}")
    print(f"  Validation(kekka)= {hex4(0, True)}")
    print(f"  LE  (894)      = {u16(894)}")
    print(f"  SE  (896)      = {u16(896)}")
    print(f"  IR Adictive(898)= {u16(898)}")
    print(f"  G Adictive (890)= {u16(890)}")
    print(f"  Binary(892)    = {u16(892)}")
    print(f"  Speed(4438)    = {u16(4438)}")

if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else r'E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\data\2A_DA_111017_115542.dat'
    rec = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    validate(path, rec)
