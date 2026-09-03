import struct
p = r'E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\uploads\singan2_1788341459_18467_12_100D_B.dat'
with open(p, 'rb') as f:
    raw = f.read()
print('file size:', len(raw), 'bytes =', round(len(raw)/1024/1024, 2), 'MB')
print('header bytes (first 16):', raw[:16].hex())
is_sru = raw[:3] == b'SRU'
print('is_sru:', is_sru)
offset = 3 if is_sru else 0
cnt = 0
types = {}
side_count = 0
while offset + 5 <= len(raw):
    size = struct.unpack('<I', raw[offset:offset+4])[0]
    itype = raw[offset+4]
    types[itype] = types.get(itype, 0) + 1
    cnt += 1
    if itype == 5:
        side_count += 1
    if size == 0:
        print('zero-size block at offset', offset, 'after', cnt, 'blocks')
        break
    offset += size
print('total blocks:', cnt)
print('type counts:', types)
print('side_count (type 5):', side_count)
print('estimated records (side_count / 13):', side_count // 13)
print('final offset:', offset, 'of', len(raw))
