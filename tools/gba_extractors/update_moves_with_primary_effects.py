import json
import os
import struct

EFFECT_NAMES = {
    0x00: "EFFECT_HIT",
    0x01: "EFFECT_SLEEP",
    0x02: "EFFECT_POISON_HIT",
    0x03: "EFFECT_ABSORB",
    0x04: "EFFECT_BURN_HIT",
    0x05: "EFFECT_FREEZE_HIT",
    0x06: "EFFECT_PARALYZE_HIT",
    0x07: "EFFECT_EXPLOSION",
    0x08: "EFFECT_DREAM_EATER",
    0x09: "EFFECT_MIRROR_MOVE",
    0x0A: "EFFECT_ATTACK_UP",
    0x0B: "EFFECT_DEFENSE_UP",
    0x0C: "EFFECT_SPEED_UP",
    0x0D: "EFFECT_SPECIAL_ATTACK_UP",
    0x0E: "EFFECT_SPECIAL_DEFENSE_UP",
    0x0F: "EFFECT_ACCURACY_UP",
    0x10: "EFFECT_EVASION_UP",
    0x11: "EFFECT_ALWAYS_HIT",
    0x12: "EFFECT_ATTACK_DOWN",
    0x13: "EFFECT_DEFENSE_DOWN",
    0x14: "EFFECT_SPEED_DOWN",
    0x15: "EFFECT_SPECIAL_ATTACK_DOWN",
    0x16: "EFFECT_SPECIAL_DEFENSE_DOWN",
    0x17: "EFFECT_ACCURACY_DOWN",
    0x18: "EFFECT_EVASION_DOWN",
    0x19: "EFFECT_HAZE",
    0x1A: "EFFECT_BIDE",
    0x1B: "EFFECT_RAMPAGE",
    0x1C: "EFFECT_ROAR",
    0x1D: "EFFECT_MULTI_HIT",
    0x1E: "EFFECT_CONVERSION",
    0x1F: "EFFECT_FLINCH_HIT",
    0x20: "EFFECT_RESTORE_HP",
    0x21: "EFFECT_TOXIC",
    0x22: "EFFECT_PAY_DAY",
    0x23: "EFFECT_LIGHT_SCREEN",
    0x24: "EFFECT_TRI_ATTACK",
    0x25: "EFFECT_REST",
    0x26: "EFFECT_OHKO",
    0x27: "EFFECT_RAZOR_WIND",
    0x28: "EFFECT_SUPER_FANG",
    0x29: "EFFECT_DRAGON_RAGE",
    0x2A: "EFFECT_TRAP",
    0x2B: "EFFECT_HIGH_CRITICAL",
    0x2C: "EFFECT_DOUBLE_HIT",
    0x2D: "EFFECT_RECOIL_IF_MISS",
    0x2E: "EFFECT_MIST",
    0x2F: "EFFECT_FOCUS_ENERGY",
    0x30: "EFFECT_RECOIL",
    0x31: "EFFECT_CONFUSE",
    0x32: "EFFECT_ATTACK_UP_2",
    0x33: "EFFECT_DEFENSE_UP_2",
    0x34: "EFFECT_SPEED_UP_2",
    0x35: "EFFECT_SPECIAL_ATTACK_UP_2",
    0x36: "EFFECT_SPECIAL_DEFENSE_UP_2",
    0x37: "EFFECT_ACCURACY_UP_2",
    0x38: "EFFECT_EVASION_UP_2",
    0x39: "EFFECT_TRANSFORM",
    0x3A: "EFFECT_ATTACK_DOWN_2",
    0x3B: "EFFECT_DEFENSE_DOWN_2",
    0x3C: "EFFECT_SPEED_DOWN_2",
    0x3D: "EFFECT_SPECIAL_ATTACK_DOWN_2",
    0x3E: "EFFECT_SPECIAL_DEFENSE_DOWN_2",
    0x3F: "EFFECT_ACCURACY_DOWN_2",
    0x40: "EFFECT_EVASION_DOWN_2",
    0x41: "EFFECT_REFLECT",
    0x42: "EFFECT_POISON",
    0x43: "EFFECT_PARALYZE",
    0x44: "EFFECT_ATTACK_DOWN_HIT",
    0x45: "EFFECT_DEFENSE_DOWN_HIT",
    0x46: "EFFECT_SPEED_DOWN_HIT",
    0x47: "EFFECT_SPECIAL_ATTACK_DOWN_HIT",
    0x48: "EFFECT_SPECIAL_DEFENSE_DOWN_HIT",
    0x49: "EFFECT_ACCURACY_DOWN_HIT",
    0x4A: "EFFECT_EVASION_DOWN_HIT",
    0x4B: "EFFECT_SKY_ATTACK",
    0x4C: "EFFECT_CONFUSE_HIT",
    0x4D: "EFFECT_TWINEEDLE",
    0x4E: "EFFECT_VITAL_THROW",
    0x4F: "EFFECT_SUBSTITUTE",
    0x50: "EFFECT_RECHARGE",
    0x51: "EFFECT_RAGE",
    0x52: "EFFECT_MIMIC",
    0x53: "EFFECT_METRONOME",
    0x54: "EFFECT_LEECH_SEED",
    0x55: "EFFECT_SPLASH",
    0x56: "EFFECT_DISABLE"
}

TYPE_NAMES = {
    0: 'NORMAL', 1: 'FIGHTING', 2: 'FLYING', 3: 'POISON', 4: 'GROUND', 5: 'ROCK',
    6: 'BUG', 7: 'GHOST', 8: 'STEEL', 9: 'MYSTERY', 10: 'FIRE', 11: 'WATER',
    12: 'GRASS', 13: 'ELECTRIC', 14: 'PSYCHIC', 15: 'ICE', 16: 'DRAGON', 17: 'DARK',
    23: 'FAIRY'
}

rom_path = "/home/jose/Escritorio/Nueva carpeta 1/proyectos-rea/red/Radical Red (4.10).gba"
data_dir = "/home/jose/Escritorio/Nueva carpeta 1/proyectos-rea/red/mi-juego-gba/data"

with open(rom_path, 'rb') as f:
    rom = f.read()

with open(os.path.join(data_dir, "move_names.json"), 'r', encoding='utf-8') as f:
    move_names = json.load(f)

battle_moves = []
for i in range(821):
    off = 0x11521D0 + i * 12
    chunk = rom[off : off + 12]
    effect, power, m_type, acc, pp, sec_chance, target, prio = struct.unpack('<BBBBBBBb', chunk[:8])
    extra = struct.unpack('<I', chunk[8:12])[0]
    
    # Split: Physical (0), Special (1), Status (2)
    split_id = (extra >> 8) & 0xFF
    split_name = "STATUS" if power == 0 else ("SPECIAL" if split_id == 1 else "PHYSICAL")
    
    name = move_names[i]["name"] if i < len(move_names) else f"MOVE_{i}"
    effect_label = EFFECT_NAMES.get(effect, f"EFFECT_0x{effect:02X}")
    type_label = TYPE_NAMES.get(m_type, f"TYPE_{m_type}")

    battle_moves.append({
        "id": i,
        "name": name,
        "primary_effect": effect,
        "primary_effect_name": effect_label,
        "power": power,
        "type": m_type,
        "type_name": type_label,
        "accuracy": acc,
        "pp": pp,
        "secondary_effect_chance": sec_chance,
        "target": target,
        "priority": prio,
        "split": split_name
    })

out_file = os.path.join(data_dir, "battle_moves.json")
with open(out_file, 'w', encoding='utf-8') as f:
    json.dump(battle_moves, f, indent=2, ensure_ascii=False)

print(f"[+] Actualizados los 821 movimientos con sus efectos primarios, secundarios, prioridad y división Física/Especial en {out_file}")
