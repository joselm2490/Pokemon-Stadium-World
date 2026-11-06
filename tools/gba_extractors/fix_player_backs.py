import os
import struct
from PIL import Image

def decompress_lz77(data):
    if len(data) < 4 or data[0] != 0x10:
        return None
    decomp_size = data[1] | (data[2] << 8) | (data[3] << 16)
    out = bytearray()
    idx = 4
    while len(out) < decomp_size and idx < len(data):
        flags = data[idx]
        idx += 1
        for i in range(8):
            if len(out) >= decomp_size:
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

def bgr555_to_rgb(raw_pal_bytes):
    # Parse exactly 16 colors (32 bytes)
    rgb_list = []
    for i in range(16):
        c = struct.unpack('<H', raw_pal_bytes[i*2 : i*2+2])[0]
        r = (c & 0x1F) << 3
        g = ((c >> 5) & 0x1F) << 3
        b = ((c >> 10) & 0x1F) << 3
        rgb_list.extend([r, g, b])
    return rgb_list

def save_jasc_pal(rgb_list, path):
    with open(path, 'w', encoding='utf-8') as f:
        f.write("JASC-PAL\n0100\n16\n")
        for i in range(16):
            r = rgb_list[i*3]
            g = rgb_list[i*3 + 1]
            b = rgb_list[i*3 + 2]
            f.write(f"{r} {g} {b}\n")

def raw_4bpp_to_png(raw_4bpp, palette_rgb, output_path, width=64, height=64, transparent_bg=False):
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
    
    # Save standard indexed PNG with transparency tag on index 0
    img.save(output_path, transparency=0)

def main():
    rom_path = "/home/jose/Escritorio/Nueva carpeta 1/proyectos-rea/red/Radical Red (4.10).gba"
    base_dir = "/home/jose/Escritorio/Nueva carpeta 1/proyectos-rea/red/mi-juego-gba"
    trainers_dir = os.path.join(base_dir, "graphics", "trainers")

    with open(rom_path, 'rb') as f:
        rom = f.read()

    characters = [
        ('player_back_red', 0, 5, 0x08E76EE4),
        ('player_back_leaf', 5, 5, 0x08E76F0C),
        ('player_back_brendan', 10, 5, 0x08E550A4),
        ('player_back_may', 15, 5, 0x08E553CC),
        ('player_back_pokedude', 20, 4, 0x08E76F34),
        ('player_back_old_man', 24, 2, 0x08E76EE4),
    ]

    for name, start_frame, count, pal_ptr in characters:
        char_dir = os.path.join(trainers_dir, name)
        os.makedirs(char_dir, exist_ok=True)

        pal_off = pal_ptr & 0x01FFFFFF
        decomp_pal = decompress_lz77(rom[pal_off : pal_off + 0x200])
        if not decomp_pal or len(decomp_pal) < 32:
            print(f"[-] Error descomprimiendo paleta para {name}")
            continue
        
        palette_rgb = bgr555_to_rgb(decomp_pal)
        
        # Guardar normal.pal
        pal_path = os.path.join(char_dir, "normal.pal")
        save_jasc_pal(palette_rgb, pal_path)

        for f_idx in range(count):
            table_idx = start_frame + f_idx
            ptr = struct.unpack('<I', rom[0x234718 + table_idx * 8 : 0x234718 + table_idx * 8 + 4])[0]
            off = ptr & 0x01FFFFFF
            raw_data = rom[off : off + 0x800]
            
            frame_png = os.path.join(char_dir, f"frame_{f_idx}.png")
            raw_4bpp_to_png(raw_data, palette_rgb, frame_png, 64, 64)
            
            if f_idx == 0:
                back_png = os.path.join(char_dir, "back.png")
                raw_4bpp_to_png(raw_data, palette_rgb, back_png, 64, 64)

        print(f"[+] Regenerado {name}: {count} frames con paleta completa de 16 colores y transparencia.")

if __name__ == "__main__":
    main()
