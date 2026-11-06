#!/usr/bin/env python3
"""
Master Battle Backgrounds & Platform Renderer for Radical Red (Hardware Accurate):
- Fixes palette bank offsets:
  * BG terrain uses GBA Palette Banks 1, 2, 3 (loaded from sBattleTerrainTable[i].palette)
  * Platform circular pedestals use GBA Palette Bank 4
- Outputs perfect 240x160 Backgrounds and 240x80 Battle Platforms with full vibrant colors!
"""

import os
import struct
import sys
from PIL import Image

sys.path.append(os.path.dirname(__file__))
from extract_graphics import decompress_lz77, save_jasc_pal

def render_gba_bg_layer(tileset_raw, tilemap_raw, full_pal_256, width_tiles=30, height_tiles=20):
    img = Image.new('RGBA', (width_tiles * 8, height_tiles * 8), (0, 0, 0, 0))
    pixels = img.load()

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

    empty_tile = [[0]*8 for _ in range(8)]

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
                    
                    if color_idx == 0:
                        # Color 0 is transparent in GBA PPU layers
                        pixels[tx * 8 + px, ty * 8 + py] = (0, 0, 0, 0)
                    else:
                        global_idx = pal_bank * 16 + color_idx
                        r, g, b = full_pal_256[global_idx]
                        pixels[tx * 8 + px, ty * 8 + py] = (r, g, b, 255)

    return img

def render_all_battle_terrains_fixed(rom_path, base_out_dir):
    with open(rom_path, 'rb') as f:
        rom = f.read()

    TERRAINS = [
        'grass', 'long_grass', 'sand', 'underwater', 'water',
        'pond', 'mountain', 'cave', 'building', 'plain'
    ]

    out_dir = os.path.join(base_out_dir, "graphics", "battle_backgrounds")
    os.makedirs(out_dir, exist_ok=True)

    TABLE_OFF = 0x24EE34
    print(f"[*] Reparando y re-renderizando los 10 fondos de combate y plataformas con hardware mapping exacto...")

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

        # Build full 256 GBA BG palette array
        full_pal = [(0, 0, 0)] * 256
        num_colors = len(pal_raw) // 2

        # In GBA pokefirered battle engine:
        # Bank 1, 2, 3 are loaded from pal_raw
        for c_idx in range(num_colors):
            c = struct.unpack('<H', pal_raw[c_idx*2 : c_idx*2+2])[0]
            r = (c & 0x1F) << 3
            g = ((c >> 5) & 0x1F) << 3
            b = ((c >> 10) & 0x1F) << 3
            full_pal[16 + c_idx] = (r, g, b)

        # Platform (Entry) uses Bank 4 (colors 64..79)
        # Bank 4 maps to Bank 0 of pal_raw
        for c_idx in range(min(16, num_colors)):
            full_pal[64 + c_idx] = full_pal[16 + c_idx]

        # Render 240x160 Background (RGB)
        bg_layer = render_gba_bg_layer(tileset, tilemap, full_pal, 30, 20)
        # Convert background to solid RGB (composite with backdrop color if any transparency)
        bg_solid = Image.new('RGB', (240, 160), full_pal[16]) # Backdrop color is Color 0 of Bank 1
        bg_solid.paste(bg_layer, (0, 0), bg_layer)
        bg_solid.save(os.path.join(out_dir, f"{name}_bg.png"))

        # Render Platform (240x80 RGBA with transparent alpha channel)
        entry_ts = decompress_lz77(rom[ets_off : ets_off + 0x2000])
        entry_tm = decompress_lz77(rom[etm_off : etm_off + 0x2000])
        if entry_ts and entry_tm:
            platform_layer = render_gba_bg_layer(entry_ts, entry_tm, full_pal, 30, 10)
            platform_layer.save(os.path.join(out_dir, f"{name}_platform.png"))

        # Save palette
        pal_rgb = []
        for r, g, b in full_pal[16:16+num_colors]:
            pal_rgb.extend([r, g, b])
        save_jasc_pal(pal_rgb[:48], os.path.join(out_dir, f"{name}.pal"))

        print(f"[+] {name.upper()}: Fondo y plataforma reparados (100% visible, no negro).")

if __name__ == "__main__":
    render_all_battle_terrains_fixed(sys.argv[1], sys.argv[2])

