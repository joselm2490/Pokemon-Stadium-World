#!/usr/bin/env python3
"""
Master Item Sprites, Logic & Usage Extractor for Radical Red (Complete CFRU Expansion):
- gItems: 0x13C0000 (750+ items including all Hold Items, Berries, Consumables, Mega Stones)
- gItemIconTable: 0x13C8100 (750 expanded 24x24 pixel icons with individual palettes)
- Decodes name, price, pocket, holdEffect, battleUsage, fieldUseFunc and description.
"""

import json
import os
import struct
import sys
from PIL import Image

sys.path.append(os.path.dirname(__file__))
from extract_graphics import decompress_lz77, parse_palette_bgr555, save_jasc_pal
from extract_tables import decode_gf_string

# 24x24 pixel GBA item icon renderer
# A 24x24 icon has 9 tiles (3x3 tiles of 8x8 pixels = 288 bytes 4bpp)
def render_item_icon(raw_4bpp, pal_rgb, output_path):
    width, height = 24, 24
    expected_size = (width * height) // 2
    if len(raw_4bpp) < expected_size:
        raw_4bpp = raw_4bpp + b'\x00' * (expected_size - len(raw_4bpp))

    img = Image.new('P', (width, height))
    pixels = []
    tiles_x = 3
    tiles_y = 3

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

    img.putpalette(pal_rgb)
    img.putdata(pixels)
    img.save(output_path)

def extract_all_items_and_icons(rom_path, base_out_dir):
    with open(rom_path, 'rb') as f:
        rom = f.read()

    ITEMS_BASE = 0x13C0000
    ICONS_BASE = 0x13C8100
    TOTAL_ITEMS = 750

    out_img_dir = os.path.join(base_out_dir, "graphics", "items")
    out_data_dir = os.path.join(base_out_dir, "data")
    os.makedirs(out_img_dir, exist_ok=True)
    os.makedirs(out_data_dir, exist_ok=True)

    print(f"[*] Ripeando {TOTAL_ITEMS} objetos expandidos (iconos 24x24, paletas y lógica de uso)...")

    items_db = []
    icons_success = 0

    for i in range(TOTAL_ITEMS):
        item_off = ITEMS_BASE + i * 44
        icon_off = ICONS_BASE + i * 8

        # 1. Parse struct Item
        raw_name = rom[item_off : item_off + 14]
        name = decode_gf_string(raw_name)
        item_id, price = struct.unpack('<HH', rom[item_off+14 : item_off+18])
        hold_effect = rom[item_off+18]
        parameter = rom[item_off+19]
        desc_ptr = struct.unpack('<I', rom[item_off+20 : item_off+24])[0]
        pocket = rom[item_off+25]
        field_func = struct.unpack('<I', rom[item_off+28 : item_off+32])[0]
        battle_usage = struct.unpack('<I', rom[item_off+32 : item_off+36])[0]
        battle_func = struct.unpack('<I', rom[item_off+36 : item_off+40])[0]

        description = ""
        if 0x08000000 <= desc_ptr < 0x0A000000:
            d_off = desc_ptr & 0x01FFFFFF
            end = rom.find(b'\xFF', d_off)
            if end != -1:
                description = decode_gf_string(rom[d_off:end+1]).replace('\n', ' ')

        # 2. Extract Icon & Palette
        icon_ptr, pal_ptr = struct.unpack('<II', rom[icon_off : icon_off + 8])
        has_icon = False
        if 0x08000000 <= icon_ptr < 0x0A000000 and 0x08000000 <= pal_ptr < 0x0A000000:
            raw_icon = decompress_lz77(rom[icon_ptr & 0x01FFFFFF : (icon_ptr & 0x01FFFFFF) + 0x1000])
            raw_pal = decompress_lz77(rom[pal_ptr & 0x01FFFFFF : (pal_ptr & 0x01FFFFFF) + 0x200])
            if raw_icon and raw_pal:
                pal_rgb = parse_palette_bgr555(raw_pal)
                png_path = os.path.join(out_img_dir, f"item_{i:03d}.png")
                pal_path = os.path.join(out_img_dir, f"item_{i:03d}.pal")
                render_item_icon(raw_icon, pal_rgb, png_path)
                save_jasc_pal(pal_rgb, pal_path)
                has_icon = True
                icons_success += 1

        items_db.append({
            "index": i,
            "id": item_id,
            "name": name if name else f"Item_{i}",
            "price": price,
            "pocket": pocket,
            "hold_effect": hold_effect,
            "parameter": parameter,
            "field_use_func": f"0x{field_func:08X}",
            "battle_usage": battle_usage,
            "battle_use_func": f"0x{battle_func:08X}",
            "has_icon": has_icon,
            "description": description
        })

    json_path = os.path.join(out_data_dir, "items.json")
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(items_db, jf, indent=2, ensure_ascii=False)

    print(f"[+] {icons_success}/{TOTAL_ITEMS} iconos 24x24 exportados limpiamente a {out_img_dir}/")
    print(f"[+] Base de datos completa con lógica de uso actualizada en {json_path}")

if __name__ == "__main__":
    extract_all_items_and_icons(sys.argv[1], sys.argv[2])

