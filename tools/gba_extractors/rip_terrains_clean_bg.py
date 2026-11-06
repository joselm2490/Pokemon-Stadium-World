import os
import struct
from PIL import Image

def decompress_lz77(data):
    if len(data) < 4 or data[0] != 0x10:
        return None
    size = data[1] | (data[2] << 8) | (data[3] << 16)
    out = bytearray()
    idx = 4
    while len(out) < size and idx < len(data):
        flags = data[idx]
        idx += 1
        for i in range(8):
            if len(out) >= size:
                break
            if (flags >> (7 - i)) & 1:
                if idx + 1 >= len(data):
                    break
                b1 = data[idx]
                b2 = data[idx + 1]
                idx += 2
                count = (b1 >> 4) + 3
                disp = (((b1 & 0x0F) << 8) | b2) + 1
                for _ in range(count):
                    out.append(out[-disp])
            else:
                out.append(data[idx])
                idx += 1
    return bytes(out)

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

def render_background_240x160(tileset_raw, tilemap_raw, full_pal, bg_color):
    img = Image.new('RGB', (240, 160), bg_color)
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
                    # Color 0 is transparent (reveals bg_color)
                    if c_idx != 0:
                        r, g, b = full_pal[pal_bank * 16 + c_idx]
                        pixels[tx * 8 + px, ty * 8 + py] = (r, g, b)

    return img

def render_platform_128x48(entry_tileset_raw, entry_tilemap_raw, full_pal):
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

def main():
    rom_path = "/home/jose/Escritorio/Nueva carpeta 1/proyectos-rea/red/Radical Red (4.10).gba"
    base_dir = "/home/jose/Escritorio/Nueva carpeta 1/proyectos-rea/red/mi-juego-gba"
    out_dir = os.path.join(base_dir, "graphics", "battle_backgrounds")
    os.makedirs(out_dir, exist_ok=True)

    with open(rom_path, 'rb') as f:
        rom = f.read()

    TERRAINS = [
        'grass', 'long_grass', 'sand', 'underwater', 'water',
        'pond', 'mountain', 'cave', 'building', 'plain'
    ]

    TABLE_OFF = 0x24EE34

    for i, name in enumerate(TERRAINS):
        base = TABLE_OFF + i * 20
        ts_ptr, tm_ptr, ets_ptr, etm_ptr, pal_ptr = struct.unpack('<IIIII', rom[base:base+20])

        tileset = decompress_lz77(rom[(ts_ptr & 0x01FFFFFF) : (ts_ptr & 0x01FFFFFF) + 0x4000])
        tilemap = decompress_lz77(rom[(tm_ptr & 0x01FFFFFF) : (tm_ptr & 0x01FFFFFF) + 0x2000])
        pal_raw = decompress_lz77(rom[(pal_ptr & 0x01FFFFFF) : (pal_ptr & 0x01FFFFFF) + 0x200])

        if not (tileset and tilemap and pal_raw):
            continue

        full_pal = [(0, 0, 0)] * 256
        num_colors = len(pal_raw) // 2

        # Terrain palettes loaded to Bank 1, 2, 3
        for c_idx in range(num_colors):
            c = struct.unpack('<H', pal_raw[c_idx*2 : c_idx*2+2])[0]
            r = (c & 0x1F) << 3
            g = ((c >> 5) & 0x1F) << 3
            b = ((c >> 10) & 0x1F) << 3
            full_pal[16 + c_idx] = (r, g, b)

        # Bank 4 platform uses Bank 1 colors
        for c_idx in range(min(16, num_colors)):
            full_pal[64 + c_idx] = full_pal[16 + c_idx]

        # Natural floor color from the terrain palette (Color 1 of Subpalette 0)
        # instead of the green-screen / magenta hardware color key
        floor_color = full_pal[17]

        # 1. Clean Background 240x160
        bg_img = render_background_240x160(tileset, tilemap, full_pal, floor_color)
        bg_img.save(os.path.join(out_dir, f"{name}_bg.png"))

        # 2. Transparent Platform Pedestal
        ets_raw = decompress_lz77(rom[(ets_ptr & 0x01FFFFFF) : (ets_ptr & 0x01FFFFFF) + 0x2000])
        etm_raw = decompress_lz77(rom[(etm_ptr & 0x01FFFFFF) : (etm_ptr & 0x01FFFFFF) + 0x2000])
        if ets_raw and etm_raw:
            platform_img = render_platform_128x48(ets_raw, etm_raw, full_pal)
            platform_img.save(os.path.join(out_dir, f"{name}_platform.png"))

            # 3. Clean Composite Scene
            composite_scene = bg_img.copy()
            composite_scene.paste(platform_img, (112, 48), platform_img)
            composite_scene.paste(platform_img, (0, 100), platform_img)
            composite_scene.save(os.path.join(out_dir, f"{name}_scene_composite.png"))

        print(f"[+] Re-renderizado {name}: sin color clave fosforescente, fondo suave y plataforma nítida.")

if __name__ == "__main__":
    main()
