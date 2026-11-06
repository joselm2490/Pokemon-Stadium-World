#!/usr/bin/env python3
"""
GBA pret-style Text & Data Tables Extractor for Radical Red / FireRed
Decodes custom Pokémon GameFreak charset and exports data tables to C/JSON.
"""

import json
import os
import struct
import sys

# GameFreak Custom Charset Table (English FireRed / Emerald standard)
GF_CHARMAP = {
    0x00: ' ',
    0x01: 'À', 0x02: 'Á', 0x03: 'Â', 0x04: 'Ç', 0x05: 'È', 0x06: 'É', 0x07: 'Ê', 0x08: 'Ë',
    0x09: 'Ì', 0x0B: 'Î', 0x0C: 'Ï', 0x0D: 'Ò', 0x0E: 'Ó', 0x0F: 'Ô', 0x10: 'Œ', 0x11: 'Ù',
    0x12: 'Ú', 0x13: 'Û', 0x14: 'Ñ', 0x15: 'ß', 0x16: 'à', 0x17: 'á', 0x19: 'ç', 0x1A: 'è',
    0x1B: 'é', 0x1C: 'ê', 0x1D: 'ë', 0x1E: 'ì', 0x20: 'î', 0x21: 'ï', 0x22: 'ò', 0x23: 'ó',
    0x24: 'ô', 0x25: 'œ', 0x26: 'ù', 0x27: 'ú', 0x28: 'û', 0x29: 'ñ', 0x2A: 'º', 0x2B: 'ª',
    0x2D: '&', 0x2E: '+',
    0x34: '[LV]', 0x35: '=', 0x36: ';',
    0x51: '¿', 0x52: '¡', 0x53: '[PK]', 0x54: '[MN]', 0x55: '[PO]', 0x56: '[KE]', 0x57: '[BL]', 0x58: '[OC]', 0x59: '[K]',
    0x5A: 'Í', 0x5B: '%', 0x5C: '(', 0x5D: ')',
    0x68: 'â', 0x6F: 'í',
    0x79: '[UP]', 0x7A: '[DOWN]', 0x7B: '[LEFT]', 0x7C: '[RIGHT]',
    0x85: '<', 0x86: '>',
    0xA1: '0', 0xA2: '1', 0xA3: '2', 0xA4: '3', 0xA5: '4', 0xA6: '5', 0xA7: '6', 0xA8: '7', 0xA9: '8', 0xAA: '9',
    0xAB: '!', 0xAC: '?', 0xAD: '.', 0xAE: '-', 0xAF: '·', 0xB0: '...', 0xB1: '“', 0xB2: '”', 0xB3: '‘', 0xB4: '’',
    0xB5: '♂', 0xB6: '♀', 0xB7: '$', 0xB8: ',', 0xB9: '×', 0xBA: '/',
    0xBB: 'A', 0xBC: 'B', 0xBD: 'C', 0xBE: 'D', 0xBF: 'E', 0xC0: 'F', 0xC1: 'G', 0xC2: 'H', 0xC3: 'I', 0xC4: 'J',
    0xC5: 'K', 0xC6: 'L', 0xC7: 'M', 0xC8: 'N', 0xC9: 'O', 0xCA: 'P', 0xCB: 'Q', 0xCC: 'R', 0xCD: 'S', 0xCE: 'T',
    0xCF: 'U', 0xD0: 'V', 0xD1: 'W', 0xD2: 'X', 0xD3: 'Y', 0xD4: 'Z',
    0xD5: 'a', 0xD6: 'b', 0xD7: 'c', 0xD8: 'd', 0xD9: 'e', 0xDA: 'f', 0xDB: 'g', 0xDC: 'h', 0xDD: 'i', 0xDE: 'j',
    0xDF: 'k', 0xE0: 'l', 0xE1: 'm', 0xE2: 'n', 0xE3: 'o', 0xE4: 'p', 0xE5: 'q', 0xE6: 'r', 0xE7: 's', 0xE8: 't',
    0xE9: 'u', 0xEA: 'v', 0xEB: 'w', 0xEC: 'x', 0xED: 'y', 0xEE: 'z',
    0xEF: '▶', 0xF0: ':', 0xF1: 'Ä', 0xF2: 'Ö', 0xF3: 'Ü', 0xF4: 'ä', 0xF5: 'ö', 0xF6: 'ü',
    0xFE: '\n', 0xFF: '' # 0xFF is String Terminator
}

def decode_gf_string(raw_bytes):
    chars = []
    for b in raw_bytes:
        if b == 0xFF:
            break
        chars.append(GF_CHARMAP.get(b, f'\\x{b:02X}'))
    return "".join(chars)

def extract_all_tables(rom_path, base_out_dir):
    with open(rom_path, 'rb') as f:
        rom = f.read()

    data_dir = os.path.join(base_out_dir, "data")
    os.makedirs(data_dir, exist_ok=True)

    # 1. Species Names (0x245EE0, 11 bytes each)
    species_list = []
    for i in range(414):
        off = 0x245EE0 + i * 11
        chunk = rom[off:off+11]
        name = decode_gf_string(chunk)
        species_list.append({"id": i, "name": name})

    species_json = os.path.join(data_dir, "species_names.json")
    with open(species_json, "w", encoding="utf-8") as f:
        json.dump(species_list, f, indent=2, ensure_ascii=False)
    print(f"[+] {len(species_list)} especies exportadas a {species_json}")

    # 2. Move Names (0x247094, 13 bytes each)
    moves_list = []
    for i in range(355):
        off = 0x247094 + i * 13
        chunk = rom[off:off+13]
        name = decode_gf_string(chunk)
        moves_list.append({"id": i, "name": name})

    moves_json = os.path.join(data_dir, "move_names.json")
    with open(moves_json, "w", encoding="utf-8") as f:
        json.dump(moves_list, f, indent=2, ensure_ascii=False)
    print(f"[+] {len(moves_list)} movimientos exportados a {moves_json}")

    # 3. Battle Moves Data (0x250C04, 12 bytes each)
    battle_moves = []
    for i in range(355):
        off = 0x250C04 + i * 12
        chunk = rom[off:off+12]
        effect, power, m_type, acc, pp, sec, target, prio = struct.unpack('<BBBBBBBb', chunk[:8])
        name = moves_list[i]["name"] if i < len(moves_list) else ""
        battle_moves.append({
            "id": i,
            "name": name,
            "power": power,
            "type": m_type,
            "accuracy": acc,
            "pp": pp,
            "priority": prio,
            "target": target
        })

    b_moves_json = os.path.join(data_dir, "battle_moves.json")
    with open(b_moves_json, "w", encoding="utf-8") as f:
        json.dump(battle_moves, f, indent=2, ensure_ascii=False)
    print(f"[+] {len(battle_moves)} estadísticas de combate exportadas a {b_moves_json}")

    # 4. Generate C include table (data/text.inc)
    text_inc = os.path.join(data_dir, "text.inc")
    with open(text_inc, "w", encoding="utf-8") as f:
        f.write("@ Radical Red / FireRed Decompiled Data Tables\n\n")
        f.write(".section .rodata\n")
        f.write(".align 2\n\n")
        f.write(".global gSpeciesNames\ngSpeciesNames:\n")
        for s in species_list:
            f.write(f'    .string "{s["name"]}"\n')
        f.write("\n.global gMoveNames\ngMoveNames:\n")
        for m in moves_list:
            f.write(f'    .string "{m["name"]}"\n')
    print(f"[+] Tablas ensambladas exportadas a {text_inc}")

if __name__ == "__main__":
    rom = sys.argv[1]
    out = sys.argv[2]
    extract_all_tables(rom, out)

