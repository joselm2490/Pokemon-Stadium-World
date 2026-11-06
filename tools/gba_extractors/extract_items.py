#!/usr/bin/env python3
"""
Item & Dialogue Pointer Table Extractor for Radical Red / FireRed (gItems at 0x3DB028)
"""

import json
import os
import struct
import sys

sys.path.append(os.path.dirname(__file__))
from extract_tables import decode_gf_string

def extract_items(rom_path, base_out_dir):
    with open(rom_path, 'rb') as f:
        rom = f.read()

    data_dir = os.path.join(base_out_dir, "data")
    os.makedirs(data_dir, exist_ok=True)

    items = []
    # gItems starts at 0x3DB028 in BPRE, 44 bytes per struct Item
    for i in range(1, 375):
        off = 0x3DB028 + i * 44
        if off + 44 > len(rom):
            break
        raw_name = rom[off : off + 14]
        name = decode_gf_string(raw_name)
        if not name or name.startswith('???') or name == '':
            continue
        item_id, price = struct.unpack('<HH', rom[off+14 : off+18])
        hold_effect = rom[off+18]
        parameter = rom[off+19]
        desc_ptr = struct.unpack('<I', rom[off+20 : off+24])[0]
        
        description = ""
        if 0x08000000 <= desc_ptr < 0x0A000000:
            desc_off = desc_ptr & 0x01FFFFFF
            end = rom.find(b'\xFF', desc_off)
            if end != -1:
                description = decode_gf_string(rom[desc_off:end+1]).replace('\n', ' ')

        items.append({
            "index": i,
            "id": item_id,
            "name": name,
            "price": price,
            "hold_effect": hold_effect,
            "parameter": parameter,
            "desc_ptr": f"0x{desc_ptr:08X}",
            "description": description
        })

    json_path = os.path.join(data_dir, "items.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)
    print(f"[+] {len(items)} objetos con descripciones y diálogos exportados a {json_path}")

if __name__ == "__main__":
    rom = sys.argv[1]
    out = sys.argv[2]
    extract_items(rom, out)

