#!/usr/bin/env python3
"""
Extended Graphics Extractor for Radical Red / FireRed
Extracts:
1. Pokémon Back Sprites (gMonBackPicTable - up to 1468 entries)
2. Trainer Battle Back Sprites (sTrainerBackPicTable at 0x234718)
3. Battle Animation Scripts and Table indices (0x1C6A04 - 332 move animations)
"""

import json
import os
import struct
import sys

sys.path.append(os.path.dirname(__file__))
from extract_graphics import decompress_lz77, parse_palette_bgr555, raw_4bpp_to_png, save_jasc_pal

def extract_extended(rom_path, base_out_dir):
    with open(rom_path, 'rb') as f:
        rom = f.read()

    print(f"[*] Cargando ROM: {len(rom)} bytes")

    # 1. Mon palettes
    mon_palettes = {}
    for i in range(1028):
        off = 0x23730C + i * 8
        ptr, tag = struct.unpack('<II', rom[off:off+8])
        if ptr < 0x08000000 or ptr >= 0x0A000000:
            break
        pal_off = ptr & 0x01FFFFFF
        raw_pal = rom[pal_off : pal_off + 64]
        mon_palettes[i] = parse_palette_bgr555(raw_pal)

    default_pal = [0] * 48
    for i in range(16):
        default_pal[i*3] = i * 16
        default_pal[i*3+1] = i * 16
        default_pal[i*3+2] = i * 16

    # 2. Pokemon Back Sprites (gMonBackPicTable at 0x23654C, 1468 entries)
    pkmn_dir = os.path.join(base_out_dir, "graphics", "pokemon")
    os.makedirs(pkmn_dir, exist_ok=True)
    
    print("[*] Extrayendo sprites de ESPALDA de Pokémon (gMonBackPicTable)...")
    back_count = 0
    for i in range(1468):
        off = 0x23654C + i * 8
        ptr, size_tag = struct.unpack('<II', rom[off:off+8])
        if ptr < 0x08000000 or ptr >= 0x0A000000:
            break
        sprite_off = ptr & 0x01FFFFFF
        raw_lz = rom[sprite_off : sprite_off + 0x2000]
        decomp = decompress_lz77(raw_lz)
        if decomp:
            species_dir = os.path.join(pkmn_dir, f"species_{i:04d}")
            os.makedirs(species_dir, exist_ok=True)
            pal = mon_palettes.get(i, default_pal)
            png_path = os.path.join(species_dir, "back.png")
            raw_4bpp_to_png(decomp, pal, png_path, 64, 64)
            back_count += 1
    print(f"[+] {back_count} sprites de ESPALDA de Pokémon extraídos.")

    # 3. Trainer Battle Back Sprites (sTrainerBackPicTable at 0x234718)
    trainer_dir = os.path.join(base_out_dir, "graphics", "trainers")
    os.makedirs(trainer_dir, exist_ok=True)

    print("[*] Extrayendo sprites de ESPALDA de Entrenadores (sTrainerBackPicTable)...")
    t_back_count = 0
    # Player palettes: Red back pal is at 0x08E69EBC or nearby
    for i in range(26):
        off = 0x234718 + i * 8
        ptr, size_tag = struct.unpack('<II', rom[off:off+8])
        if ptr < 0x08000000 or ptr >= 0x0A000000:
            break
        sprite_off = ptr & 0x01FFFFFF
        raw_lz = rom[sprite_off : sprite_off + 0x2000]
        decomp = decompress_lz77(raw_lz)
        if decomp:
            t_sub = os.path.join(trainer_dir, f"player_back_{i:02d}")
            os.makedirs(t_sub, exist_ok=True)
            # Default grayscale or read palette from ROM
            png_path = os.path.join(t_sub, "back.png")
            raw_4bpp_to_png(decomp, default_pal, png_path, 64, 64)
            t_back_count += 1
    print(f"[+] {t_back_count} sprites de ESPALDA de Entrenadores extraídos.")

    # 4. Battle Animations (gBattleAnims_Moves at 0x1C6A04, 332 entries)
    anim_dir = os.path.join(base_out_dir, "data", "battle_anims")
    os.makedirs(anim_dir, exist_ok=True)
    
    print("[*] Desensamblando y volcando 332 scripts de Animaciones de Ataque...")
    anims_index = []
    for i in range(332):
        off = 0x1C6A04 + i * 4
        ptr = struct.unpack('<I', rom[off:off+4])[0]
        script_off = ptr & 0x01FFFFFF
        # Battle anim scripts terminate with 0x08 (end of script) or specific opcode sequence
        # Read up to 256 bytes
        script_bytes = rom[script_off : script_off + 256]
        hex_data = " ".join(f"{b:02X}" for b in script_bytes[:64])
        
        # Save raw binary bytecode
        bin_path = os.path.join(anim_dir, f"anim_{i:03d}.bin")
        with open(bin_path, "wb") as bf:
            bf.write(script_bytes[:128])

        anims_index.append({
            "move_id": i,
            "script_pointer": f"0x{ptr:08X}",
            "file_offset": f"0x{script_off:06X}",
            "header_bytecode": hex_data
        })

    anim_json = os.path.join(base_out_dir, "data", "battle_animations.json")
    with open(anim_json, "w", encoding="utf-8") as jf:
        json.dump(anims_index, jf, indent=2)
    print(f"[+] 332 animaciones de combate indexadas y guardadas en {anim_json} y {anim_dir}/")

if __name__ == "__main__":
    rom = sys.argv[1]
    out = sys.argv[2]
    extract_extended(rom, out)

