"""
Battle Engine Core - Radical Red / Gen 8 CFRU Turn-Based Combat Logic:
- Turn-order resolution (Priority brackets, Speed stat, Speed ties)
- Complete Damage Formula (Level, Power, Atk/Def or SpAtk/SpDef, STAB, Type effectiveness, Crit, Random factor)
- Status ailments (Burn, Paralyze, Sleep, Poison, Toxic, Freeze)
- Stat stage multipliers (-6 to +6)
"""

import math
import random

TYPE_EFFECTIVENESS = {
    'NORMAL': {'ROCK': 0.5, 'GHOST': 0.0, 'STEEL': 0.5},
    'FIGHTING': {'NORMAL': 2.0, 'FLYING': 0.5, 'POISON': 0.5, 'ROCK': 2.0, 'BUG': 0.5, 'GHOST': 0.0, 'STEEL': 2.0, 'PSYCHIC': 0.5, 'ICE': 2.0, 'DARK': 2.0, 'FAIRY': 0.5},
    'FLYING': {'FIGHTING': 2.0, 'ROCK': 0.5, 'BUG': 2.0, 'STEEL': 0.5, 'GRASS': 2.0, 'ELECTRIC': 0.5},
    'POISON': {'POISON': 0.5, 'GROUND': 0.5, 'ROCK': 0.5, 'GHOST': 0.5, 'STEEL': 0.0, 'GRASS': 2.0, 'FAIRY': 2.0},
    'GROUND': {'FLYING': 0.0, 'POISON': 2.0, 'ROCK': 2.0, 'STEEL': 2.0, 'FIRE': 2.0, 'GRASS': 0.5, 'ELECTRIC': 2.0, 'BUG': 0.5},
    'ROCK': {'FIGHTING': 0.5, 'FLYING': 2.0, 'GROUND': 0.5, 'BUG': 2.0, 'STEEL': 0.5, 'FIRE': 2.0, 'ICE': 2.0},
    'BUG': {'FIGHTING': 0.5, 'FLYING': 0.5, 'POISON': 0.5, 'GHOST': 0.5, 'STEEL': 0.5, 'FIRE': 0.5, 'GRASS': 2.0, 'PSYCHIC': 2.0, 'DARK': 2.0, 'FAIRY': 0.5},
    'GHOST': {'NORMAL': 0.0, 'GHOST': 2.0, 'PSYCHIC': 2.0, 'DARK': 0.5},
    'STEEL': {'ROCK': 2.0, 'STEEL': 0.5, 'FIRE': 0.5, 'WATER': 0.5, 'ELECTRIC': 0.5, 'ICE': 2.0, 'FAIRY': 2.0},
    'FIRE': {'ROCK': 0.5, 'BUG': 2.0, 'STEEL': 2.0, 'FIRE': 0.5, 'WATER': 0.5, 'GRASS': 2.0, 'ICE': 2.0, 'DRAGON': 0.5},
    'WATER': {'GROUND': 2.0, 'ROCK': 2.0, 'FIRE': 2.0, 'WATER': 0.5, 'GRASS': 0.5, 'DRAGON': 0.5},
    'GRASS': {'FLYING': 0.5, 'POISON': 0.5, 'GROUND': 2.0, 'ROCK': 2.0, 'BUG': 0.5, 'STEEL': 0.5, 'FIRE': 0.5, 'WATER': 2.0, 'GRASS': 0.5, 'DRAGON': 0.5},
    'ELECTRIC': {'FLYING': 2.0, 'GROUND': 0.0, 'WATER': 2.0, 'GRASS': 0.5, 'ELECTRIC': 0.5, 'DRAGON': 0.5},
    'PSYCHIC': {'FIGHTING': 2.0, 'POISON': 2.0, 'STEEL': 0.5, 'PSYCHIC': 0.5, 'DARK': 0.0},
    'ICE': {'FLYING': 2.0, 'GROUND': 2.0, 'STEEL': 0.5, 'FIRE': 0.5, 'WATER': 0.5, 'GRASS': 2.0, 'ICE': 0.5, 'DRAGON': 2.0},
    'DRAGON': {'STEEL': 0.5, 'DRAGON': 2.0, 'FAIRY': 0.0},
    'DARK': {'FIGHTING': 0.5, 'GHOST': 2.0, 'PSYCHIC': 2.0, 'DARK': 0.5, 'FAIRY': 0.5},
    'FAIRY': {'FIGHTING': 2.0, 'POISON': 0.5, 'STEEL': 0.5, 'FIRE': 0.5, 'DRAGON': 2.0, 'DARK': 2.0}
}

def get_type_effectiveness(atk_type: str, def_types: list) -> float:
    mult = 1.0
    for d_type in def_types:
        if d_type in TYPE_EFFECTIVENESS.get(atk_type, {}):
            mult *= TYPE_EFFECTIVENESS[atk_type][d_type]
    return mult

def get_stat_multiplier(stage: int) -> float:
    stage = max(-6, min(6, stage))
    if stage >= 0:
        return (2 + stage) / 2.0
    else:
        return 2.0 / (2 - stage)

def calculate_damage(attacker, defender, move, is_critical=False, rng_roll=None):
    if move['power'] == 0:
        return 0, 1.0, False

    level = attacker.get('level', 50)
    power = move['power']
    split = move.get('split', 'PHYSICAL')

    # Attack & Defense stat resolution
    if split == 'PHYSICAL':
        atk_stat = attacker['stats']['attack'] * get_stat_multiplier(attacker['stages'].get('attack', 0))
        def_stat = defender['stats']['defense'] * get_stat_multiplier(defender['stages'].get('defense', 0))
        if attacker.get('status') == 'BURN':
            atk_stat *= 0.5
    else: # SPECIAL
        atk_stat = attacker['stats']['sp_attack'] * get_stat_multiplier(attacker['stages'].get('sp_attack', 0))
        def_stat = defender['stats']['sp_defense'] * get_stat_multiplier(defender['stages'].get('sp_defense', 0))

    # Base formula (Gen 5-8):
    # Damage = ((((2 * Level / 5 + 2) * Power * A / D) / 50) + 2) * Targets * Weather * Badge * Critical * random * STAB * Type * Burn * other
    base_dmg = (((2 * level / 5 + 2) * power * (atk_stat / def_stat)) / 50) + 2

    if is_critical:
        base_dmg *= 1.5

    # Random factor: 0.85 to 1.00 (in GBA: 85 to 100 / 100)
    rand_mult = (rng_roll if rng_roll is not None else random.randint(85, 100)) / 100.0
    base_dmg *= rand_mult

    # STAB (Same Type Attack Bonus)
    move_type = move.get('type_name', 'NORMAL')
    if move_type in attacker.get('types', []):
        base_dmg *= 1.5

    # Type effectiveness
    type_mult = get_type_effectiveness(move_type, defender.get('types', []))
    base_dmg *= type_mult

    return math.floor(base_dmg), type_mult, is_critical

def resolve_turn_order(action_a, action_b):
    """
    Determines which combatant acts first.
    action: {'priority': int, 'speed': int, 'actor': 'player'|'opponent'}
    """
    if action_a['priority'] != action_b['priority']:
        return action_a if action_a['priority'] > action_b['priority'] else action_b
    if action_a['speed'] != action_b['speed']:
        return action_a if action_a['speed'] > action_b['speed'] else action_b
    # Speed tie
    return action_a if random.random() < 0.5 else action_b
