#!/usr/bin/env python3
"""
GBA pret-style Asset Extractor for Radical Red / FireRed
Extracts Pokémon sprites, Trainer sprites, and Palettes to standard directory structure.
"""

import os
import struct
import sys
from PIL import Image

def decompress_lz77(data, max_size=0x20000):
    if len(data) < 4 or data[0] != 0x10:
        return None
    uncompressed_size = data[1] | (data[2] << 8) | (data[3] << 16)
    if uncompressed_size > max_size or uncompressed_size == 0:
        return None
    out = bytearray()
    idx = 4
    try:
        while len(out) < uncompressed_size and idx < len(data):
            flags = data[idx]
            idx += 1
            for bit in range(7, -1, -1):
                if idx >= len(data):
                    break
                if (flags >> bit) & 1:
                    if idx + 1 >= len(data):
                        break
                    b1 = data[idx]
                    b2 = data[idx+1]
                    idx += 2
                    disp = (((b1 & 0x0F) << 8) | b2) + 1
                    length = (b1 >> 4) + 3
                    start = len(out) - disp
                    if start < 0:
                        return None
                    for _ in range(length):
                        if start < len(out):
                            out.append(out[start])
                            start += 1
                        else:
                            out.append(0)
                else:
                    out.append(data[idx])
                    idx += 1
                if len(out) >= uncompressed_size:
                    break
        return bytes(out[:uncompressed_size])
    except Exception:
        return None

def parse_palette_bgr555(raw_palette_bytes):
    if len(raw_palette_bytes) >= 4 and raw_palette_bytes[0] == 0x10:
        decomp = decompress_lz77(raw_palette_bytes)
        if decomp:
            raw_palette_bytes = decomp
    palette_rgb = []
    num_colors = min(16, len(raw_palette_bytes) // 2)
    for i in range(num_colors):
        color = struct.unpack('<H', raw_palette_bytes[i*2 : i*2+2])[0]
        r = (color & 0x001F) << 3
        g = ((color >> 5) & 0x001F) << 3
        b = ((color >> 10) & 0x001F) << 3
        palette_rgb.extend([r, g, b])
    # Pad to 16 colors if needed
    while len(palette_rgb) < 48:
        palette_rgb.extend([0, 0, 0])
    return palette_rgb

def save_jasc_pal(palette_rgb, path):
    with open(path, 'w') as f:
        f.write("JASC-PAL\n0100\n16\n")
        for i in range(16):
            r = palette_rgb[i*3]
            g = palette_rgb[i*3+1]
            b = palette_rgb[i*3+2]
            f.write(f"{r} {g} {b}\n")

def raw_4bpp_to_png(raw_4bpp, palette_rgb, output_path, width=64, height=64):
    expected_size = (width * height) // 2
    if len(raw_4bpp) < expected_size:
        raw_4bpp = raw_4bpp + b'\x00' * (expected_size - len(raw_4bpp))
    
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

def extract_all_graphics(rom_path, base_out_dir):
    with open(rom_path, 'rb') as f:
        rom = f.read()

    print(f"[*] Cargando ROM: {len(rom)} bytes")

    # 1. Mon palettes
    # 0x23730C -> 1028 palettes
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

    # 2. Pokemon Front Sprites
    # gMonFrontPicTable at 0x2350AC
    pkmn_dir = os.path.join(base_out_dir, "graphics", "pokemon")
    os.makedirs(pkmn_dir, exist_ok=True)
    
    print("[*] Extrayendo sprites frontales de Pokémon...")
    front_count = 0
    for i in range(440):
        off = 0x2350AC + i * 8
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
            png_path = os.path.join(species_dir, "front.png")
            pal_path = os.path.join(species_dir, "normal.pal")
            raw_4bpp_to_png(decomp, pal, png_path, 64, 64)
            save_jasc_pal(pal, pal_path)
            front_count += 1
    print(f"[+] {front_count} sprites frontales de Pokémon extraídos.")

    # 3. Trainer Sprites
    # gTrainerFrontPicTable at 0x23957C (296 entries)
    # gTrainerPaletteTable at 0x239A1C
    trainer_dir = os.path.join(base_out_dir, "graphics", "trainers")
    os.makedirs(trainer_dir, exist_ok=True)
    
    print("[*] Extrayendo sprites de entrenadores...")
    trainer_count = 0
    for i in range(148):
        s_off = 0x23957C + i * 8
        p_off = 0x239A1C + i * 8
        s_ptr, s_tag = struct.unpack('<II', rom[s_off:s_off+8])
        p_ptr, p_tag = struct.unpack('<II', rom[p_off:p_off+8])
        if s_ptr < 0x08000000 or s_ptr >= 0x0A000000:
            break
        sprite_off = s_ptr & 0x01FFFFFF
        pal_off = p_ptr & 0x01FFFFFF
        raw_lz = rom[sprite_off : sprite_off + 0x2000]
        raw_pal = rom[pal_off : pal_off + 64]
        decomp = decompress_lz77(raw_lz)
        pal = parse_palette_bgr555(raw_pal)
        if decomp:
            t_sub = os.path.join(trainer_dir, f"trainer_{i:03d}")
            os.makedirs(t_sub, exist_ok=True)
            png_path = os.path.join(t_sub, "front.png")
            pal_path = os.path.join(t_sub, "normal.pal")
            raw_4bpp_to_png(decomp, pal, png_path, 64, 64)
            save_jasc_pal(pal, pal_path)
            trainer_count += 1
    print(f"[+] {trainer_count} sprites de entrenadores extraídos.")

if __name__ == "__main__":
    rom = sys.argv[1]
    out = sys.argv[2]
    extract_all_graphics(rom, out)

