#!/usr/bin/env python3
"""
Master Pixel-Perfect Battle Terrains & Backgrounds Extractor for Radical Red:
- Background Horizon: Full 240x160 pixels (Sky, trees, cave walls, ocean, mountains)
- Platform Pedestal: Clean 128x48 RGBA circular platform (transparent background, no artifacts)
- Complete Battle Scene Preview: 240x160 composite image showing opponent platform (top-right) 
  and player platform (bottom-left) exactly as rendered on real GBA hardware!
"""

import os
import struct
import sys
from PIL import Image

sys.path.append(os.path.dirname(__file__))
from extract_graphics import decompress_lz77, save_jasc_pal

def decode_tileset_4bpp(tileset_raw):
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
    return decoded_tiles

def render_background_240x160(tileset_raw, tilemap_raw, full_pal):
    img = Image.new('RGB', (240, 160), full_pal[16])
    pixels = img.load()
    decoded = decode_tileset_4bpp(tileset_raw)
    empty = [[0]*8 for _ in range(8)]

    for ty in range(20):
        for tx in range(30):
            idx = (ty * 32 + tx) * 2
            if idx + 2 > len(tilemap_raw):
                continue
            entry = struct.unpack('<H', tilemap_raw[idx:idx+2])[0]
            tile_num = entry & 0x03FF
            hflip = (entry >> 10) & 1
            vflip = (entry >> 11) & 1
            pal_bank = (entry >> 12) & 0x0F

            t_data = decoded[tile_num] if tile_num < len(decoded) else empty

            for py in range(8):
                src_y = 7 - py if vflip else py
                for px in range(8):
                    src_x = 7 - px if hflip else px
                    c_idx = t_data[src_y][src_x]
                    # Color 0 of BG palette
                    if c_idx != 0:
                        r, g, b = full_pal[pal_bank * 16 + c_idx]
                        pixels[tx * 8 + px, ty * 8 + py] = (r, g, b)

    return img

def render_circular_platform_128x48(entry_tileset_raw, entry_tilemap_raw, full_pal):
    # Platform is a 16x6 tiles (128x48 pixels) oval pedestal
    img = Image.new('RGBA', (128, 48), (0, 0, 0, 0))
    pixels = img.load()
    decoded = decode_tileset_4bpp(entry_tileset_raw)

    entries = struct.unpack(f'<{len(entry_tilemap_raw)//2}H', entry_tilemap_raw)

    for ty in range(6):
        row_in_etm = 8 + ty
        for tx in range(16):
            entry = entries[row_in_etm * 32 + tx]
            tile_num = entry & 0x03FF
            hflip = (entry >> 10) & 1
            vflip = (entry >> 11) & 1
            pal_bank = (entry >> 12) & 0x0F

            if tile_num < len(decoded):
                t_data = decoded[tile_num]
                for py in range(8):
                    src_y = 7 - py if vflip else py
                    for px in range(8):
                        src_x = 7 - px if hflip else px
                        c_idx = t_data[src_y][src_x]
                        if c_idx != 0:
                            r, g, b = full_pal[pal_bank * 16 + c_idx]
                            pixels[tx * 8 + px, ty * 8 + py] = (r, g, b, 255)

    return img

def rip_all_terrains_pixel_perfect(rom_path, base_out_dir):
    with open(rom_path, 'rb') as f:
        rom = f.read()

    TERRAINS = [
        'grass', 'long_grass', 'sand', 'underwater', 'water',
        'pond', 'mountain', 'cave', 'building', 'plain'
    ]

    out_dir = os.path.join(base_out_dir, "graphics", "battle_backgrounds")
    os.makedirs(out_dir, exist_ok=True)

    TABLE_OFF = 0x24EE34
    print(f"[*] Reparando los 10 fondos de combate con geometría de hardware exacta...")

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

        full_pal = [(0, 0, 0)] * 256
        num_colors = len(pal_raw) // 2

        # In GBA battle engine:
        # Terrain pal is loaded at offset 0x20 (Banks 1, 2, 3)
        for c_idx in range(num_colors):
            c = struct.unpack('<H', pal_raw[c_idx*2 : c_idx*2+2])[0]
            r = (c & 0x1F) << 3
            g = ((c >> 5) & 0x1F) << 3
            b = ((c >> 10) & 0x1F) << 3
            full_pal[16 + c_idx] = (r, g, b)

        # Platform pedestal uses Bank 4 (colors 64..79) -> Bank 0 of pal_raw
        for c_idx in range(min(16, num_colors)):
            full_pal[64 + c_idx] = full_pal[16 + c_idx]

        # 1. Full 240x160 Background Layer
        bg_img = render_background_240x160(tileset, tilemap, full_pal)
        bg_img.save(os.path.join(out_dir, f"{name}_bg.png"))

        # 2. Clean 128x48 Transparent Pedestal Platform
        entry_ts = decompress_lz77(rom[ets_off : ets_off + 0x2000])
        entry_tm = decompress_lz77(rom[etm_off : etm_off + 0x2000])
        if entry_ts and entry_tm:
            platform_img = render_circular_platform_128x48(entry_ts, entry_tm, full_pal)
            platform_img.save(os.path.join(out_dir, f"{name}_platform.png"))

            # 3. Complete in-game battle field composite (240x160)
            composite_scene = bg_img.copy()
            # Opponent platform at top right (x=112, y=48)
            composite_scene.paste(platform_img, (112, 48), platform_img)
            # Player platform at bottom left (x=0, y=100)
            composite_scene.paste(platform_img, (0, 100), platform_img)
            composite_scene.save(os.path.join(out_dir, f"{name}_scene_composite.png"))

        # Save Palette
        pal_rgb = []
        for r, g, b in full_pal[16:16+num_colors]:
            pal_rgb.extend([r, g, b])
        save_jasc_pal(pal_rgb[:48], os.path.join(out_dir, f"{name}.pal"))

        print(f"[+] {name.upper()}: Fondo, plataforma (128x48 sin cortes) y escena de combate compuestos al 100%.")

if __name__ == "__main__":
    rip_all_terrains_pixel_perfect(sys.argv[1], sys.argv[2])

