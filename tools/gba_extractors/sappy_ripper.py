#!/usr/bin/env python3
"""
Sappy / M4A Sound Extractor & MID/SF2 Automation Tool
"""

import struct
import os
import sys

def parse_song_header(rom, header_offset):
    tracks = rom[header_offset]
    blocks = rom[header_offset+1]
    prio = rom[header_offset+2]
    reverb = rom[header_offset+3]
    voice_tbl_ptr = struct.unpack('<I', rom[header_offset+4:header_offset+8])[0]
    track_ptrs = []
    for t in range(tracks):
        t_ptr = struct.unpack('<I', rom[header_offset+8+t*4:header_offset+12+t*4])[0]
        track_ptrs.append(t_ptr)
    return {
        'tracks': tracks,
        'blocks': blocks,
        'prio': prio,
        'reverb': reverb,
        'voice_table': voice_tbl_ptr,
        'track_ptrs': track_ptrs
    }

def dump_soundfont_sf2_plan(rom, song_table_off, num_songs):
    print(f"[*] Escaneando {num_songs} canciones en SongTable (0x{song_table_off:08X})...")
    # Genera el plan de exportación para sf2 / mid
    # ...

