#!/usr/bin/env python3
"""
Correct Battle Animation VFX Sprites Extractor for Radical Red:
- gBattleAnimPicTable: 0x100A3C0 (371 sprite sheets)
- gBattleAnimPaletteTable: 0x100AF58 (371 matching palettes)
Extracts non-corrupted 4bpp indexed PNGs with their exact game palettes!
"""

import os
import struct
import sys
from PIL import Image

sys.path.append(os.path.dirname(__file__))
from extract_graphics import decompress_lz77, parse_palette_bgr555, save_jasc_pal

def tiles_4bpp_to_png(raw_4bpp, palette_rgb, output_path, width, height):
    expected_size = (width * height) // 2
    if len(raw_4bpp) < expected_size:
        raw_4bpp = raw_4bpp + b'\x00' * (expected_size - len(raw_4bpp))
    elif len(raw_4bpp) > expected_size:
        raw_4bpp = raw_4bpp[:expected_size]

    img = Image.new('P', (width, height))
    pixels = []
    tiles_x = width // 8
    tiles_y = height // 8

    for ty in range(tiles_y):
        for py in range(8):
            for tx in range(tiles_x):
                tile_idx = ty * tiles_x + tx
                tile_offset = tile_idx * 32 + py * 4
                for px in range(4):
                    byte_val = raw_4bpp[tile_offset + px]
                    p1 = byte_val & 0x0F
                    p2 = (byte_val >> 4) & 0x0F
                    pixels.extend([p1, p2])

    img.putpalette(palette_rgb)
    img.putdata(pixels)
    img.save(output_path)

def extract_battle_anim_vfx(rom_path, base_out_dir):
    with open(rom_path, 'rb') as f:
        rom = f.read()

    PIC_TABLE_OFF = 0x100A3C0
    PAL_TABLE_OFF = 0x100A3C0 + 371 * 8
    TOTAL_ENTRIES = 371

    out_dir = os.path.join(base_out_dir, "graphics", "battle_anims")
    os.makedirs(out_dir, exist_ok=True)

    print(f"[*] Extrayendo {TOTAL_ENTRIES} hojas de animación de ataques con sus paletas dedicadas...")

    # Load 371 Palettes
    palettes = {}
    default_pal = [0] * 48
    for i in range(16):
        default_pal[i*3] = i * 16
        default_pal[i*3+1] = i * 16
        default_pal[i*3+2] = i * 16

    for i in range(TOTAL_ENTRIES):
        off = PAL_TABLE_OFF + i * 8
        p_ptr, s = struct.unpack('<II', rom[off:off+8])
        tag = s & 0xFFFF
        if 0x08000000 <= p_ptr < 0x0A000000:
            raw_pal = rom[p_ptr & 0x01FFFFFF : (p_ptr & 0x01FFFFFF) + 64]
            palettes[tag] = parse_palette_bgr555(raw_pal)

    success = 0
    for i in range(TOTAL_ENTRIES):
        off = PIC_TABLE_OFF + i * 8
        s_ptr, s = struct.unpack('<II', rom[off:off+8])
        size = s & 0xFFFF
        tag = s >> 16

        if not (0x08000000 <= s_ptr < 0x0A000000):
            continue

        raw_lz = rom[s_ptr & 0x01FFFFFF : (s_ptr & 0x01FFFFFF) + 0x4000]
        decomp = decompress_lz77(raw_lz)
        if not decomp:
            continue

        d_len = len(decomp)
        total_tiles = d_len // 32

        # Determinar dimensiones geométricas según cantidad de tiles
        if total_tiles <= 1:
            w, h = 8, 8
        elif total_tiles == 2:
            w, h = 16, 8
        elif total_tiles == 4:
            w, h = 16, 16
        elif total_tiles == 8:
            w, h = 32, 16
        elif total_tiles == 12:
            w, h = 32, 24
        elif total_tiles == 16:
            w, h = 32, 32
        elif total_tiles == 24:
            w, h = 64, 24
        elif total_tiles == 32:
            w, h = 64, 32
        elif total_tiles >= 64:
            tiles_x = 8 # 64 px
            tiles_y = (total_tiles + 7) // 8
            w, h = tiles_x * 8, tiles_y * 8
        else:
            tiles_x = 4 # 32 px
            tiles_y = (total_tiles + 3) // 4
            w, h = tiles_x * 8, tiles_y * 8

        pal = palettes.get(tag, default_pal)
        png_path = os.path.join(out_dir, f"anim_tag_{tag}_{i:03d}.png")
        pal_path = os.path.join(out_dir, f"anim_tag_{tag}_{i:03d}.pal")

        tiles_4bpp_to_png(decomp, pal, png_path, w, h)
        save_jasc_pal(pal, pal_path)
        success += 1

    print(f"[+] {success}/{TOTAL_ENTRIES} hojas de sprites VFX generadas limpiamente en {out_dir}/")

if __name__ == "__main__":
    extract_battle_anim_vfx(sys.argv[1], sys.argv[2])

