#!/usr/bin/env python3
"""
GBA pret-style Audio & Sample Extractor for Radical Red / FireRed (M4A / Sappy)
Extracts PCM samples to standard 16-bit WAV files and dumps Song / Track descriptors.
"""

import os
import struct
import sys
import wave

def dump_pcm_samples(rom, voice_tables, out_dir):
    wav_dir = os.path.join(out_dir, "samples")
    os.makedirs(wav_dir, exist_ok=True)
    
    seen_wavs = set()
    extracted_count = 0
    
    for vt in sorted(list(voice_tables)):
        vt_off = vt & 0x01FFFFFF
        for inst in range(128):
            i_off = vt_off + inst * 16
            if i_off + 16 > len(rom):
                break
            i_type = rom[i_off]
            if i_type == 0: # DirectSound PCM
                w_ptr = struct.unpack('<I', rom[i_off+4:i_off+8])[0]
                if 0x08000000 <= w_ptr < 0x0A000000 and w_ptr not in seen_wavs:
                    seen_wavs.add(w_ptr)
                    w_off = w_ptr & 0x01FFFFFF
                    w_type, status = struct.unpack('<HH', rom[w_off:w_off+4])
                    freq, loop, size = struct.unpack('<III', rom[w_off+4:w_off+16])
                    
                    sample_rate = freq >> 10
                    if sample_rate == 0 or sample_rate > 96000 or size == 0 or size > 0x100000:
                        continue
                    
                    raw_pcm = rom[w_off+16 : w_off+16+size]
                    if len(raw_pcm) < size:
                        continue
                    
                    # GBA PCM is 8-bit signed (-128 to 127). Convert to 16-bit signed PCM
                    pcm16 = bytearray()
                    for b in raw_pcm:
                        val = struct.unpack('b', bytes([b]))[0] # signed -128..127
                        val16 = val << 8
                        pcm16.extend(struct.pack('<h', val16))
                    
                    wav_file = os.path.join(wav_dir, f"sample_{w_ptr:08X}_{sample_rate}Hz.wav")
                    with wave.open(wav_file, 'wb') as wf:
                        wf.setnchannels(1)
                        wf.setsampwidth(2)
                        wf.setframerate(sample_rate)
                        wf.writeframes(pcm16)
                    
                    extracted_count += 1
                    
    print(f"[+] {extracted_count} muestras de audio PCM ripeadas a WAV (16-bit PCM).")

def dump_songs_info(rom, out_dir):
    songs_dir = os.path.join(out_dir, "songs")
    os.makedirs(songs_dir, exist_ok=True)
    
    songs_inc = os.path.join(out_dir, "songs.csv")
    with open(songs_inc, "w") as f:
        f.write("song_id,header_ptr,track_count,priority,reverb,voice_table\n")
        for i in range(348):
            off = 0x4A32CC + i * 8
            h_ptr, param = struct.unpack('<II', rom[off:off+8])
            if 0x08000000 <= h_ptr < 0x0A000000:
                h_off = h_ptr & 0x01FFFFFF
                tracks, blocks, prio, rev = rom[h_off], rom[h_off+1], rom[h_off+2], rom[h_off+3]
                vt_ptr = struct.unpack('<I', rom[h_off+4:h_off+8])[0]
                f.write(f"{i},0x{h_ptr:08X},{tracks},{prio},{rev},0x{vt_ptr:08X}\n")
    print(f"[+] 348 entradas de SongTable indexadas en {songs_inc}")

def extract_all_sound(rom_path, base_out_dir):
    with open(rom_path, 'rb') as f:
        rom = f.read()

    sound_dir = os.path.join(base_out_dir, "sound")
    os.makedirs(sound_dir, exist_ok=True)
    
    # 1. Gather all VoiceTables
    voice_tables = set()
    for i in range(348):
        off = 0x4A32CC + i * 8
        h_ptr = struct.unpack('<I', rom[off:off+4])[0]
        if 0x08000000 <= h_ptr < 0x0A000000:
            h_off = h_ptr & 0x01FFFFFF
            vt_ptr = struct.unpack('<I', rom[h_off+4:h_off+8])[0]
            if 0x08000000 <= vt_ptr < 0x0A000000:
                voice_tables.add(vt_ptr)
                
    print(f"[*] Localizadas {len(voice_tables)} VoiceTables activas en la SongTable.")
    dump_pcm_samples(rom, voice_tables, sound_dir)
    dump_songs_info(rom, sound_dir)

if __name__ == "__main__":
    rom = sys.argv[1]
    out = sys.argv[2]
    extract_all_sound(rom, out)

