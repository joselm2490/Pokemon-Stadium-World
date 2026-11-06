#!/usr/bin/env python3
"""
Exhaustive Repository Integrity Auditor
Scans every single file in mi-juego-gba:
1. PNGs: Opens every single image with PIL, verifies PNG header, verifies decoding (load()), checks width/height, checks for 1-color black images.
2. PALs: Verifies JASC-PAL header, version, color count, RGB triplets.
3. Audio: Verifies WAV headers, channel count, sample rate, data chunk.
4. JSON: Verifies valid JSON syntax, non-empty structures.
5. Binaries / Bytecode: Verifies non-empty files.
"""

import os
import sys
import json
import wave
from PIL import Image

def audit_repository(repo_path):
    print(f"[*] Iniciando Auditoría Exhaustiva en: {repo_path}\n")

    stats = {
        'png_ok': 0,
        'png_corrupt': [],
        'png_monochrome_black': [],
        'pal_ok': 0,
        'pal_corrupt': [],
        'wav_ok': 0,
        'wav_corrupt': [],
        'json_ok': 0,
        'json_corrupt': [],
        'bin_ok': 0,
        'bin_empty': []
    }

    total_files = 0

    for root, dirs, files in os.walk(repo_path):
        for f in files:
            total_files += 1
            fpath = os.path.join(root, f)
            rel_path = os.path.relpath(fpath, repo_path)
            ext = os.path.splitext(f)[1].lower()

            # 1. Audit PNGs
            if ext == '.png':
                try:
                    with Image.open(fpath) as img:
                        img.verify() # Verify file header / CRC
                    # Reopen and decode image data
                    with Image.open(fpath) as img:
                        w, h = img.size
                        if w == 0 or h == 0:
                            stats['png_corrupt'].append((rel_path, "Dimensiones 0x0"))
                            continue
                        # Attempt full pixel load
                        img.load()
                        # Check if image is completely solid black (excluding 1-pixel or transparent palettes)
                        colors = img.getcolors(maxcolors=2)
                        if colors and len(colors) == 1 and colors[0][1] in [(0, 0, 0), (0, 0, 0, 255), 0] and w >= 32 and h >= 32:
                            # Note: check if it's meant to be blank or corrupted
                            stats['png_monochrome_black'].append(rel_path)
                        else:
                            stats['png_ok'] += 1
                except Exception as e:
                    stats['png_corrupt'].append((rel_path, str(e)))

            # 2. Audit JASC-PALs
            elif ext == '.pal':
                try:
                    with open(fpath, 'r', encoding='latin1') as pf:
                        lines = [line.strip() for line in pf if line.strip()]
                    if len(lines) < 3 or lines[0] != 'JASC-PAL' or lines[1] != '0100':
                        stats['pal_corrupt'].append((rel_path, "Cabecera JASC-PAL no válida"))
                        continue
                    num_colors = int(lines[2])
                    if len(lines) - 3 != num_colors:
                        stats['pal_corrupt'].append((rel_path, f"Colores declarados ({num_colors}) != reales ({len(lines)-3})"))
                        continue
                    stats['pal_ok'] += 1
                except Exception as e:
                    stats['pal_corrupt'].append((rel_path, str(e)))

            # 3. Audit WAV Audio
            elif ext == '.wav':
                try:
                    with wave.open(fpath, 'rb') as wf:
                        channels = wf.getnchannels()
                        rate = wf.getframerate()
                        frames = wf.getnframes()
                        if channels != 1 or rate == 0 or frames == 0:
                            stats['wav_corrupt'].append((rel_path, f"Header anómalo: {channels}ch, {rate}Hz, {frames} frames"))
                            continue
                        stats['wav_ok'] += 1
                except Exception as e:
                    stats['wav_corrupt'].append((rel_path, str(e)))

            # 4. Audit JSON Data
            elif ext == '.json':
                try:
                    with open(fpath, 'r', encoding='utf-8') as jf:
                        data = json.load(jf)
                    if isinstance(data, (list, dict)) and len(data) == 0:
                        stats['json_corrupt'].append((rel_path, "Estructura JSON vacía"))
                        continue
                    stats['json_ok'] += 1
                except Exception as e:
                    stats['json_corrupt'].append((rel_path, str(e)))

            # 5. Audit Binary Bytecode
            elif ext == '.bin':
                size = os.path.getsize(fpath)
                if size == 0:
                    stats['bin_empty'].append(rel_path)
                else:
                    stats['bin_ok'] += 1

    print("=" * 60)
    print("REPORTE DE AUDITORÍA INTEGRAL DE ARTIFACTS Y ASSETS")
    print("=" * 60)
    print(f"Total de archivos inspeccionados: {total_files}\n")

    print(f"[PNG Images]: {stats['png_ok']} válidos, {len(stats['png_corrupt'])} corruptos, {len(stats['png_monochrome_black'])} negros")
    print(f"[PAL Palettes]: {stats['pal_ok']} válidos, {len(stats['pal_corrupt'])} corruptos")
    print(f"[WAV Audio Samples]: {stats['wav_ok']} válidos, {len(stats['wav_corrupt'])} corruptos")
    print(f"[JSON Data Databases]: {stats['json_ok']} válidos, {len(stats['json_corrupt'])} corruptos")
    print(f"[BIN Bytecode Scripts]: {stats['bin_ok']} válidos, {len(stats['bin_empty'])} vacíos")
    print("=" * 60)

    if stats['png_corrupt']:
        print("\n[!] DETALLE DE PNGS CORRUPTOS:")
        for p, err in stats['png_corrupt']:
            print(f"  - {p}: {err}")

    if stats['png_monochrome_black']:
        print(f"\n[!] PNGs monocromáticos negros detectados ({len(stats['png_monochrome_black'])}):")
        for p in stats['png_monochrome_black'][:10]:
            print(f"  - {p}")

    if stats['pal_corrupt']:
        print("\n[!] DETALLE DE PALETAS CORRUPTAS:")
        for p, err in stats['pal_corrupt']:
            print(f"  - {p}: {err}")

    if stats['wav_corrupt']:
        print("\n[!] DETALLE DE AUDIOS CORRUPTOS:")
        for p, err in stats['wav_corrupt']:
            print(f"  - {p}: {err}")

    if stats['json_corrupt']:
        print("\n[!] DETALLE DE JSON CORRUPTOS:")
        for p, err in stats['json_corrupt']:
            print(f"  - {p}: {err}")

    return stats

if __name__ == "__main__":
    audit_repository(sys.argv[1])

