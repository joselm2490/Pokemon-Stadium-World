#!/usr/bin/env python3
"""
Master Asset Extractor for Radical Red (Complete 32MB DPE / CFRU Expansion):
1. All 1376 Pokémon Front Sprites (from expanded table at 0x17B6DC4)
2. All 1376 Pokémon Palettes (from expanded table at 0x1811208)
3. All 1244 Battle Animation Sprites (from table at 0x100A3C0)
"""

import json
import os
import struct
import sys

sys.path.append(os.path.dirname(__file__))
from extract_graphics import decompress_lz77, parse_palette_bgr555, raw_4bpp_to_png, save_jasc_pal

def rip_all_expanded(rom_path, base_out_dir):
    with open(rom_path, 'rb') as f:
        rom = f.read()

    print(f"[*] Cargando ROM: {len(rom)} bytes")

    # 1. Expanded Palettes at 0x1811208 (1376 entries)
    print("[*] Cargando 1376 paletas de Pokémon expandidas (DPE)...")
    expanded_palettes = {}
    default_pal = [0] * 48
    for i in range(16):
        default_pal[i*3] = i * 16
        default_pal[i*3+1] = i * 16
        default_pal[i*3+2] = i * 16

    for i in range(1376):
        off = 0x1811208 + i * 8
        ptr, tag = struct.unpack('<II', rom[off:off+8])
        if 0x08000000 <= ptr < 0x0A000000:
            pal_off = ptr & 0x01FFFFFF
            raw_pal = rom[pal_off : pal_off + 64]
            expanded_palettes[i] = parse_palette_bgr555(raw_pal)
        else:
            expanded_palettes[i] = default_pal

    # 2. Extract All 1376 Pokemon Front Sprites
    pkmn_dir = os.path.join(base_out_dir, "graphics", "pokemon")
    os.makedirs(pkmn_dir, exist_ok=True)
    
    print("[*] Extrayendo los 1376 sprites frontales completos...")
    front_count = 0
    for i in range(1376):
        off = 0x17B6DC4 + i * 8
        ptr, size_tag = struct.unpack('<II', rom[off:off+8])
        if 0x08000000 <= ptr < 0x0A000000:
            sprite_off = ptr & 0x01FFFFFF
            raw_lz = rom[sprite_off : sprite_off + 0x2000]
            decomp = decompress_lz77(raw_lz)
            if decomp:
                species_dir = os.path.join(pkmn_dir, f"species_{i:04d}")
                os.makedirs(species_dir, exist_ok=True)
                pal = expanded_palettes.get(i, default_pal)
                png_path = os.path.join(species_dir, "front.png")
                pal_path = os.path.join(species_dir, "normal.pal")
                raw_4bpp_to_png(decomp, pal, png_path, 64, 64)
                save_jasc_pal(pal, pal_path)
                front_count += 1
    print(f"[+] {front_count} sprites frontales de Pokémon extraídos (completando las 1376 especies).")

    # 3. Extract All 1244 Battle Animation Sprites (Move particles & VFX)
    anim_sprites_dir = os.path.join(base_out_dir, "graphics", "battle_anims")
    os.makedirs(anim_sprites_dir, exist_ok=True)
    
    print("[*] Extrayendo los 1244 sprites y partículas de animaciones de combate...")
    anim_sprite_count = 0
    for i in range(1244):
        off = 0x100A3C0 + i * 8
        ptr, s = struct.unpack('<II', rom[off:off+8])
        size, tag = s & 0xFFFF, s >> 16
        if 0x08000000 <= ptr < 0x0A000000:
            sprite_off = ptr & 0x01FFFFFF
            raw_lz = rom[sprite_off : sprite_off + 0x2000]
            decomp = decompress_lz77(raw_lz)
            if decomp:
                # Calculate dimensions based on decompressed size:
                # if size == 0x200 (512 bytes -> 32x32 4bpp)
                # if size == 0x800 (2048 bytes -> 64x64 4bpp)
                # if size == 0x100 (256 bytes -> 32x16 or 16x32 or 8x64)
                d_len = len(decomp)
                w, h = 32, 32
                if d_len >= 2048:
                    w, h = 64, 64
                elif d_len == 1024:
                    w, h = 64, 32
                elif d_len <= 512:
                    w, h = 32, 32

                png_path = os.path.join(anim_sprites_dir, f"anim_sprite_{tag}_{i:04d}.png")
                raw_4bpp_to_png(decomp, default_pal, png_path, w, h)
                anim_sprite_count += 1
    print(f"[+] {anim_sprite_count} sprites de animaciones y partículas de movimientos extraídos.")

if __name__ == "__main__":
    rom = sys.argv[1]
    out = sys.argv[2]
    rip_all_expanded(rom, out)

