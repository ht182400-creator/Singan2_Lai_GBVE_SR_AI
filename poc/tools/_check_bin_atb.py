#!/usr/bin/env python3
import struct, os
bin_path = r"e:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\release\X_ATB_ZAR_132006050001.bin"
b = open(bin_path, "rb").read()
print(f"BIN size={len(b)} = 128 securities * 4096 bytes")
nonempty = []
for sec in range(128):
    base = sec * 4096
    block = b[base:base+4096]
    if any(v != 0 for v in block):
        nonempty.append(sec)
print(f"non-empty securities: {nonempty[:30]} ... total={len(nonempty)}")

# Print first nonempty security all 128 denos * 4 faces
print("\nFirst non-empty security (sec=0) areas [face0..face3]:")
for face in range(4):
    print(f"  face{face} (deno 0..11):")
    for deno in range(12):
        off = face*128*8 + deno*8
        a = struct.unpack("<BBBBBBBB", b[off:off+8])
        print(f"    deno{deno}: {a}")
