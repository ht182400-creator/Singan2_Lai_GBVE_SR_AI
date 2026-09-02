#!/usr/bin/env python3
"""临时校验：用与 server.cpp parse_vtb_to_json 相同的算法解析 VTB 样本，确认二进制布局正确。"""
import sys, json

def parse_vtb(path):
    with open(path, 'rb') as f:
        buf = f.read()
    sru = buf[:3] == b'SRU'
    pos = (32 if sru else 0) + (32 + 160 + 832)
    vtb_data = [buf[i] | (buf[i + 1] << 8) for i in range(pos, len(buf) - 1, 2)]
    vtb = [{'process': [{'count': 0, 'commands': []} for _ in range(8)]} for _ in range(6)]
    idx = 0
    im = ip = ic = 0
    section_end = False
    while idx < len(vtb_data) and im < 6:
        fn = vtb_data[idx]
        if fn == 0xffff:
            section_end = True
        else:
            c = {'function': fn, 'len': 0, 'params': []}
            idx += 1
            if idx >= len(vtb_data):
                break
            c['len'] = vtb_data[idx]
            for _ in range(c['len']):
                idx += 1
                if idx >= len(vtb_data):
                    break
                c['params'].append(vtb_data[idx])
            idx += 1
            if idx < len(vtb_data):
                c['sum'] = vtb_data[idx]
            vtb[im]['process'][ip]['commands'].append(c)
            ic += 1
        if section_end:
            vtb[im]['process'][ip]['count'] = ic + 1
            ic = 0
            ip += 1
            if ip >= 8:
                ip = 0
                im += 1
            section_end = False
        idx += 1
    return buf, sru, vtb_data, vtb

if __name__ == '__main__':
    path = sys.argv[1]
    buf, sru, vtb_data, vtb = parse_vtb(path)
    print(f"file_size={len(buf)} sru={sru} vtbData_len={len(vtb_data)}")
    total_cmds = 0
    for m in range(6):
        for p in range(8):
            cmds = vtb[m]['process'][p]['commands']
            total_cmds += len(cmds)
            if cmds:
                sample = cmds[0]
                print(f"  mode[{m}].proc[{p}] count={len(cmds)} "
                      f"sample_fn={sample['function']} len={sample['len']} "
                      f"params={sample['params'][:6]}")
    print(f"total_commands={total_cmds}")
