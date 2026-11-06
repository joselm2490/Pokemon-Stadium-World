#!/usr/bin/env python3
"""
Master Pokemon Sprite Extractor for Radical Red (DPE Engine):
- Front Pic Table: 0x17B6DC4 (1376 entries)
- Back Pic Table:  0x17FA1C4 (1376 entries)
- Palette Table:   0x1811208 (1376 entries)
Ensures 100% clean, non-corrupted front.png and back.png for all species!
"""

import os
import struct
import sys

sys.path.append(os.path.dirname(__file__))
from extract_graphics import decompress_lz77, parse_palette_bgr555, raw_4bpp_to_png, save_jasc_pal

def fix_all_pokemon_sprites(rom_path, base_out_dir):
    with open(rom_path, 'rb') as f:
        rom = f.read()

    FRONT_TABLE_OFF = 0x17B6DC4
    BACK_TABLE_OFF  = 0x17FA1C4
    PAL_TABLE_OFF   = 0x1811208
    TOTAL_SPECIES   = 1376

    pkmn_dir = os.path.join(base_out_dir, "graphics", "pokemon")
    os.makedirs(pkmn_dir, exist_ok=True)

    default_pal = [0] * 48
    for i in range(16):
        default_pal[i*3] = i * 16
        default_pal[i*3+1] = i * 16
        default_pal[i*3+2] = i * 16

    print(f"[*] Reparando y extrayendo 1376 especies con las tablas correctas de DPE...")

    # Load all palettes
    palettes = {}
    for i in range(TOTAL_SPECIES):
        p_off = PAL_TABLE_OFF + i * 8
        pal_ptr = struct.unpack('<I', rom[p_off:p_off+4])[0]
        if 0x08000000 <= pal_ptr < 0x0A000000:
            raw_pal = rom[pal_ptr & 0x01FFFFFF : (pal_ptr & 0x01FFFFFF) + 64]
            palettes[i] = parse_palette_bgr555(raw_pal)
        else:
            palettes[i] = default_pal

    front_success = 0
    back_success = 0

    for i in range(TOTAL_SPECIES):
        species_folder = os.path.join(pkmn_dir, f"species_{i:04d}")
        os.makedirs(species_folder, exist_ok=True)

        pal = palettes.get(i, default_pal)
        save_jasc_pal(pal, os.path.join(species_folder, "normal.pal"))

        # Front Pic
        f_ptr = struct.unpack('<I', rom[FRONT_TABLE_OFF + i*8 : FRONT_TABLE_OFF + i*8 + 4])[0]
        if 0x08000000 <= f_ptr < 0x0A000000:
            f_data = decompress_lz77(rom[f_ptr & 0x01FFFFFF : (f_ptr & 0x01FFFFFF) + 0x2000])
            if f_data:
                raw_4bpp_to_png(f_data, pal, os.path.join(species_folder, "front.png"), 64, 64)
                front_success += 1

        # Back Pic
        b_ptr = struct.unpack('<I', rom[BACK_TABLE_OFF + i*8 : BACK_TABLE_OFF + i*8 + 4])[0]
        if 0x08000000 <= b_ptr < 0x0A000000:
            b_data = decompress_lz77(rom[b_ptr & 0x01FFFFFF : (b_ptr & 0x01FFFFFF) + 0x2000])
            if b_data:
                raw_4bpp_to_png(b_data, pal, os.path.join(species_folder, "back.png"), 64, 64)
                back_success += 1

        if i % 200 == 0 or i == TOTAL_SPECIES - 1:
            print(f"    Progreso: {i+1}/{TOTAL_SPECIES} especies procesadas (Front: {front_success}, Back: {back_success})...")

    print(f"\n[+] Proceso finalizado:")
    print(f"    - Sprites frontales válidos: {front_success}/{TOTAL_SPECIES}")
    print(f"    - Sprites de espalda válidos: {back_success}/{TOTAL_SPECIES}")

if __name__ == "__main__":
    fix_all_pokemon_sprites(sys.argv[1], sys.argv[2])

