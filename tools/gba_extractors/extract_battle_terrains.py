#!/usr/bin/env python3
"""
Battle Backgrounds & Terrain Environments Extractor for Radical Red:
- sBattleTerrainTable: 0x24EE34 (10 Battle Terrains: Grass, Long Grass, Sand, Underwater, Water, Pond, Mountain, Cave, Building, Plain)
Renders full 240x160 GBA Battle Backgrounds and Pokemon Battle Platforms.
"""

import os
import struct
import sys
from PIL import Image

sys.path.append(os.path.dirname(__file__))
from extract_graphics import decompress_lz77, parse_palette_bgr555, save_jasc_pal

def render_tilemap_bg(tileset_raw, tilemap_raw, pal_rgb, width_tiles=30, height_tiles=20):
    # Width 30 tiles = 240 px, Height 20 tiles = 160 px (GBA standard screen resolution)
    # A GBA tile is 8x8 pixels 4bpp (32 bytes)
    img = Image.new('RGB', (width_tiles * 8, height_tiles * 8))
    pixels = img.load()

    # Pre-decode all tiles in tileset
    num_tiles = len(tileset_raw) // 32
    decoded_tiles = []
    for t in range(num_tiles):
        tile_data = []
        base = t * 32
        for y in range(8):
            row = []
            for x in range(4):
                b = tileset_raw[base + y * 4 + x]
                row.append(b & 0x0F)
                row.append((b >> 4) & 0x0F)
            tile_data.append(row)
        decoded_tiles.append(tile_data)

    # Empty 8x8 tile
    empty_tile = [[0]*8 for _ in range(8)]

    # Tilemap has 32x32 tiles (or width_tiles * height_tiles)
    for ty in range(height_tiles):
        for tx in range(width_tiles):
            idx = (ty * 32 + tx) * 2
            if idx + 2 > len(tilemap_raw):
                continue
            entry = struct.unpack('<H', tilemap_raw[idx:idx+2])[0]
            tile_num = entry & 0x03FF
            hflip = (entry >> 10) & 1
            vflip = (entry >> 11) & 1
            pal_bank = (entry >> 12) & 0x0F

            tile_pixels = decoded_tiles[tile_num] if tile_num < len(decoded_tiles) else empty_tile

            for py in range(8):
                src_y = 7 - py if vflip else py
                for px in range(8):
                    src_x = 7 - px if hflip else px
                    color_idx = tile_pixels[src_y][src_x]
                    
                    # Resolve RGB color from palette
                    pal_offset = (pal_bank * 16 + color_idx) * 3
                    if pal_offset + 3 <= len(pal_rgb):
                        r = pal_rgb[pal_offset]
                        g = pal_rgb[pal_offset + 1]
                        b = pal_rgb[pal_offset + 2]
                    else:
                        r, g, b = (0, 0, 0)
                    
                    pixels[tx * 8 + px, ty * 8 + py] = (r, g, b)

    return img

def extract_all_battle_terrains(rom_path, base_out_dir):
    with open(rom_path, 'rb') as f:
        rom = f.read()

    TERRAINS = [
        'grass', 'long_grass', 'sand', 'underwater', 'water',
        'pond', 'mountain', 'cave', 'building', 'plain'
    ]

    out_dir = os.path.join(base_out_dir, "graphics", "battle_backgrounds")
    os.makedirs(out_dir, exist_ok=True)

    TABLE_OFF = 0x24EE34
    print(f"[*] Ripeando {len(TERRAINS)} fondos de combate y ambientes completos...")

    for i, name in enumerate(TERRAINS):
        base = TABLE_OFF + i * 20
        ts_ptr, tm_ptr, ets_ptr, etm_ptr, pal_ptr = struct.unpack('<IIIII', rom[base:base+20])

        ts_off = ts_ptr & 0x01FFFFFF
        tm_off = tm_ptr & 0x01FFFFFF
        ets_off = ets_ptr & 0x01FFFFFF
        etm_off = etm_ptr & 0x01FFFFFF
        pal_off = pal_ptr & 0x01FFFFFF

        tileset = decompress_lz77(rom[ts_off : ts_off + 0x4000])
        tilemap = decompress_lz77(rom[tm_off : tm_off + 0x2000])
        pal_raw = decompress_lz77(rom[pal_off : pal_off + 0x200])

        if not (tileset and tilemap and pal_raw):
            continue

        pal_rgb = parse_palette_bgr555(pal_raw)
        
        # Save raw palette
        save_jasc_pal(pal_rgb[:48], os.path.join(out_dir, f"{name}.pal"))

        # Render 240x160 Background
        bg_img = render_tilemap_bg(tileset, tilemap, pal_rgb, 30, 20)
        bg_img.save(os.path.join(out_dir, f"{name}_bg.png"))

        # Render Platform (entryTileset + entryTilemap)
        entry_ts = decompress_lz77(rom[ets_off : ets_off + 0x2000])
        entry_tm = decompress_lz77(rom[etm_off : etm_off + 0x2000])
        if entry_ts and entry_tm:
            platform_img = render_tilemap_bg(entry_ts, entry_tm, pal_rgb, 30, 10)
            platform_img.save(os.path.join(out_dir, f"{name}_platform.png"))

        print(f"[+] Ambiente {name.upper()}: Fondo (240x160) y Plataforma de combate ripeados.")

if __name__ == "__main__":
    extract_all_battle_terrains(sys.argv[1], sys.argv[2])

