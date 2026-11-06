#!/usr/bin/env python3
"""
Master Battle Menu & Interface System Extractor for Radical Red:
1. Action Selection Menu (Complete 120x48 pixel quadrant box: Fight, Bag, Pokemon, Run)
2. Individual 4 Action Buttons:
   - button_fight.png (Atacar / Luchar)
   - button_bag.png (Mochila / Objeto)
   - button_pokemon.png (Cambiar Pokémon)
   - button_run.png (Huir / Escapar)
3. Move Selection Menu Sub-panel (Move 1..4 slots with PP and Type frame)
4. All 18 Elemental Type Badges (Normal, Fire, Water, Grass, Electric, Ice, Fighting, 
   Poison, Ground, Flying, Psychic, Bug, Rock, Ghost, Dragon, Steel, Dark, Fairy)
"""

import os
import struct
import sys
from PIL import Image

sys.path.append(os.path.dirname(__file__))
from extract_graphics import decompress_lz77, parse_palette_bgr555, save_jasc_pal

def decode_tiles_4bpp(raw_bytes):
    num_tiles = len(raw_bytes) // 32
    decoded = []
    for t in range(num_tiles):
        tile_data = []
        base = t * 32
        for y in range(8):
            row = []
            for x in range(4):
                b = raw_bytes[base + y * 4 + x]
                row.append(b & 0x0F)
                row.append((b >> 4) & 0x0F)
            tile_data.append(row)
        decoded.append(tile_data)
    return decoded

def extract_battle_menu_system(rom_path, base_out_dir):
    with open(rom_path, 'rb') as f:
        rom = f.read()

    out_dir = os.path.join(base_out_dir, "graphics", "battle_interface")
    os.makedirs(out_dir, exist_ok=True)

    print("[*] Ripeando el menú de batalla completo (Luchar, Mochila, Pokémon, Huir)...")

    # 1. Action Buttons Tileset: 0xD00C00 (8192 bytes = 256 tiles)
    btn_tiles_raw = decompress_lz77(rom[0xD00C00 : 0xD00C00 + 0x4000])
    decoded_btn_tiles = decode_tiles_4bpp(btn_tiles_raw)

    # Action Selection Tilemap at 0xD0162C (32x6 tiles = 192 entries)
    action_tm_raw = decompress_lz77(rom[0xD0162C : 0xD0162C + 0x400])
    action_entries = struct.unpack(f'<{len(action_tm_raw)//2}H', action_tm_raw)

    # Interface Palette
    pal_raw = rom[0xD00BD0 : 0xD00BD0 + 48]
    pal_rgb = parse_palette_bgr555(pal_raw)

    # 2. Render Action Selection Menu (120x48 pixels) - The right box with the 4 options
    # In the 32x6 tilemap, columns 15 to 29 represent the action menu box (15 tiles wide = 120 px, 6 tiles high = 48 px)
    menu_img = Image.new('RGB', (120, 48), (255, 255, 255))
    pixels_menu = menu_img.load()

    empty_tile = [[0]*8 for _ in range(8)]
    for ty in range(6):
        for tx in range(15):
            col = 15 + tx
            entry = action_entries[ty * 32 + col]
            tile_num = entry & 0x03FF
            hflip = (entry >> 10) & 1
            vflip = (entry >> 11) & 1

            t_data = decoded_btn_tiles[tile_num] if tile_num < len(decoded_btn_tiles) else empty_tile
            for py in range(8):
                src_y = 7 - py if vflip else py
                for px in range(8):
                    src_x = 7 - px if hflip else px
                    c_idx = t_data[src_y][src_x]
                    # Color lookup
                    r = pal_rgb[c_idx * 3]
                    g = pal_rgb[c_idx * 3 + 1]
                    b = pal_rgb[c_idx * 3 + 2]
                    pixels_menu[tx * 8 + px, ty * 8 + py] = (r, g, b)

    menu_img.save(os.path.join(out_dir, "action_selection_menu.png"))
    print("[+] action_selection_menu.png (120x48) generado.")

    # 3. Crop individual buttons from the 4 quadrants of the action menu:
    # FIGHT: top-left (x=0..60, y=0..24)
    # BAG: top-right (x=60..120, y=0..24)
    # POKEMON: bottom-left (x=0..60, y=24..48)
    # RUN: bottom-right (x=60..120, y=24..48)
    btn_fight = menu_img.crop((0, 0, 60, 24))
    btn_fight.save(os.path.join(out_dir, "button_fight.png"))

    btn_bag = menu_img.crop((60, 0, 120, 24))
    btn_bag.save(os.path.join(out_dir, "button_bag.png"))

    btn_pokemon = menu_img.crop((0, 24, 60, 48))
    btn_pokemon.save(os.path.join(out_dir, "button_pokemon.png"))

    btn_run = menu_img.crop((60, 24, 120, 48))
    btn_run.save(os.path.join(out_dir, "button_run.png"))
    print("[+] 4 botones individuales extraídos: button_fight, button_bag, button_pokemon, button_run.")

    # 4. Render Move Selection Menu Box at 0xD01724 (240x48)
    # When FIGHT is pressed, the battle box expands to select moves:
    move_tm_raw = decompress_lz77(rom[0xD01724 : 0xD01724 + 0x400])
    move_entries = struct.unpack(f'<{len(move_tm_raw)//2}H', move_tm_raw)
    move_menu_img = Image.new('RGB', (240, 48), (255, 255, 255))
    pixels_move = move_menu_img.load()

    for ty in range(6):
        for tx in range(30):
            entry = move_entries[ty * 32 + tx]
            tile_num = entry & 0x03FF
            hflip = (entry >> 10) & 1
            vflip = (entry >> 11) & 1

            t_data = decoded_btn_tiles[tile_num] if tile_num < len(decoded_btn_tiles) else empty_tile
            for py in range(8):
                src_y = 7 - py if vflip else py
                for px in range(8):
                    src_x = 7 - px if hflip else px
                    c_idx = t_data[src_y][src_x]
                    r = pal_rgb[c_idx * 3]
                    g = pal_rgb[c_idx * 3 + 1]
                    b = pal_rgb[c_idx * 3 + 2]
                    pixels_move[tx * 8 + px, ty * 8 + py] = (r, g, b)

    move_menu_img.save(os.path.join(out_dir, "move_selection_box.png"))
    print("[+] move_selection_box.png (240x48) generado.")

    # 5. Extract Elemental Type Badges (0xD03A10)
    types_raw = decompress_lz77(rom[0xD03A10 : 0xD03A10 + 0x1000])
    types_decoded = decode_tiles_4bpp(types_raw)

    types_dir = os.path.join(out_dir, "type_badges")
    os.makedirs(types_dir, exist_ok=True)

    TYPE_NAMES = [
        "normal", "fighting", "flying", "poison", "ground", "rock",
        "bug", "ghost", "steel", "mystery", "fire", "water",
        "grass", "electric", "psychic", "ice", "dragon", "dark", "fairy"
    ]

    # Palettes for types: Tag 10021 / 10022 at 0xD039E8 / 0xD03D48
    type_pal_raw = rom[0xD039E8 : 0xD039E8 + 32]
    type_pal = parse_palette_bgr555(type_pal_raw)

    print(f"[*] Extrayendo {len(TYPE_NAMES)} chapas de tipos elementales de combate...")
    for t_idx, t_name in enumerate(TYPE_NAMES):
        base_tile = t_idx * 4 # Each badge is 4 tiles (32x8 px or 32x14)
        if base_tile + 4 > len(types_decoded):
            break

        badge_img = Image.new('RGB', (32, 14), (255, 255, 255))
        pix_b = badge_img.load()

        # Render 4 tiles horizontally (32 px) x 2 tiles vertically (14 px)
        for tile_i in range(4):
            t_data = types_decoded[base_tile + tile_i]
            for py in range(8):
                if py >= 14: continue
                for px in range(8):
                    c_idx = t_data[py][px]
                    r = type_pal[c_idx * 3]
                    g = type_pal[c_idx * 3 + 1]
                    b = type_pal[c_idx * 3 + 2]
                    pix_b[tile_i * 8 + px, py] = (r, g, b)

        badge_img.save(os.path.join(types_dir, f"type_{t_name}.png"))

    print(f"[+] {len(TYPE_NAMES)} iconos de tipos elementales exportados en {types_dir}/")

if __name__ == "__main__":
    extract_battle_menu_system(sys.argv[1], sys.argv[2])

