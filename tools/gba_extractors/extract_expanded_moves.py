#!/usr/bin/env python3
"""
Master Move & Battle Animation Extractor for Radical Red (Complete CFRU Expansion):
- Move Names: 0x10EEEDC (1007 moves, 17 bytes stride)
- Move Data / Stats: 0x11521D0 (821 combat moves with power, acc, pp, type, effect)
- Move Animations Table: 0x100BC00 (936 battle animation scripts)
"""

import json
import os
import struct
import sys

sys.path.append(os.path.dirname(__file__))
from extract_tables import decode_gf_string

def extract_expanded_moves_and_anims(rom_path, base_out_dir):
    with open(rom_path, 'rb') as f:
        rom = f.read()

    print(f"[*] Cargando ROM: {len(rom)} bytes")

    data_dir = os.path.join(base_out_dir, "data")
    anim_dir = os.path.join(data_dir, "battle_anims")
    os.makedirs(anim_dir, exist_ok=True)

    # 1. Expanded Move Names (0x10EEEDC - 1007 entries, 17 bytes each)
    print("[*] Extrayendo 1007 nombres de movimientos expandidos...")
    move_names = []
    for i in range(1007):
        off = 0x10EEEDC + i * 17
        chunk = rom[off : off + 17]
        name = decode_gf_string(chunk)
        move_names.append({"id": i, "name": name})

    with open(os.path.join(data_dir, "move_names.json"), "w", encoding="utf-8") as f:
        json.dump(move_names, f, indent=2, ensure_ascii=False)
    print(f"[+] 1007 nombres de movimientos guardados en data/move_names.json")

    # 2. Expanded Battle Move Stats (0x11521D0 - 821 entries, 12 bytes each)
    print("[*] Extrayendo 821 estadísticas de combate de movimientos...")
    battle_moves = []
    for i in range(821):
        off = 0x11521D0 + i * 12
        chunk = rom[off : off + 12]
        effect, power, m_type, acc, pp, sec, target, prio = struct.unpack('<BBBBBBBb', chunk[:8])
        name = move_names[i]["name"] if i < len(move_names) else ""
        battle_moves.append({
            "id": i,
            "name": name,
            "power": power,
            "type": m_type,
            "accuracy": acc,
            "pp": pp,
            "secondary_effect": sec,
            "target": target,
            "priority": prio
        })

    with open(os.path.join(data_dir, "battle_moves.json"), "w", encoding="utf-8") as f:
        json.dump(battle_moves, f, indent=2, ensure_ascii=False)
    print(f"[+] 821 datos de combate guardados en data/battle_moves.json")

    # 3. Expanded Battle Animation Scripts (0x100BC00 - 936 entries)
    print("[*] Extrayendo y desensamblando 936 scripts de animación de movimientos...")
    anims_index = []
    for i in range(936):
        off = 0x100BC00 + i * 4
        ptr = struct.unpack('<I', rom[off:off+4])[0]
        script_off = ptr & 0x01FFFFFF
        script_bytes = rom[script_off : script_off + 256]
        hex_data = " ".join(f"{b:02X}" for b in script_bytes[:64])
        
        bin_path = os.path.join(anim_dir, f"anim_{i:03d}.bin")
        with open(bin_path, "wb") as bf:
            bf.write(script_bytes[:128])

        name = move_names[i]["name"] if i < len(move_names) else ""
        anims_index.append({
            "move_id": i,
            "name": name,
            "script_pointer": f"0x{ptr:08X}",
            "file_offset": f"0x{script_off:06X}",
            "header_bytecode": hex_data
        })

    with open(os.path.join(data_dir, "battle_animations.json"), "w", encoding="utf-8") as f:
        json.dump(anims_index, f, indent=2, ensure_ascii=False)
    print(f"[+] 936 animaciones de combate volcadas en data/battle_anims/ y catalogadas en data/battle_animations.json")

if __name__ == "__main__":
    extract_expanded_moves_and_anims(sys.argv[1], sys.argv[2])

