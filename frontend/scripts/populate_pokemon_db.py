#!/usr/bin/env python3
"""
Popula las tablas 'pokemon', 'estadisticas_base' y 'pokemon_movimientos'
en database/pokemon_game.db a partir de database/pokemon.json.
"""

import os
import json
import sqlite3

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "database", "pokemon_game.db")
JSON_PATH = os.path.join(BASE_DIR, "database", "pokemon.json")

def populate():
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        pokemon_list = json.load(f)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Asegurar que la columna movimientos_predeterminados exista en la tabla pokemon
    cur.execute("PRAGMA table_info(pokemon);")
    cols = [c[1] for c in cur.fetchall()]
    if "movimientos_predeterminados" not in cols:
        print("Agregando columna movimientos_predeterminados a la tabla pokemon...")
        cur.execute("ALTER TABLE pokemon ADD COLUMN movimientos_predeterminados TEXT;")

    print("Limpiando tablas de Pokémon previas...")
    cur.execute("DELETE FROM pokemon_movimientos;")
    cur.execute("DELETE FROM estadisticas_base;")
    cur.execute("DELETE FROM pokemon;")

    pokemon_rows = []
    stats_rows = []
    moves_rows = []

    for p in pokemon_list:
        p_id = p["db_id"]
        default_moves_json = json.dumps(p.get("movimientos_predeterminados", []))

        pokemon_rows.append((
            p_id,
            p["num"],
            p["name"],
            p["nombre_ingles"],
            p["gen"],
            p["tipo1_id"],
            p["tipo2_id"],
            p["weightkg"],
            p["heightm"],
            100, # ratio captura default
            100, # exp base default
            "Medium Fast",
            default_moves_json
        ))

        st = p["stats"]
        stats_rows.append((
            p_id,
            st["hp"],
            st["atk"],
            st["def"],
            st["spa"],
            st["spd"],
            st["spe"]
        ))

        # Registrar movimientos predeterminados en pokemon_movimientos
        for m_id in p.get("movimientos_predeterminados", []):
            moves_rows.append((
                p_id,
                m_id,
                "predeterminado",
                1
            ))

        # Registrar todos los movimientos aprendibles
        for m_id in p.get("moves", []):
            moves_rows.append((
                p_id,
                m_id,
                "nivel",
                1
            ))

    print(f"Insertando {len(pokemon_rows)} Pokémon en SQLite (con movimientos_predeterminados)...")
    cur.executemany("""
        INSERT INTO pokemon (id, numero_pokedex, nombre, nombre_ingles, gen, tipo1_id, tipo2_id, peso_kg, altura_m, ratio_captura, experiencia_base, curva_crecimiento, movimientos_predeterminados)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, pokemon_rows)

    print(f"Insertando {len(stats_rows)} registros de estadísticas base...")
    cur.executemany("""
        INSERT INTO estadisticas_base (pokemon_id, hp, ataque, defensa, ataque_especial, defensa_especial, velocidad)
        VALUES (?, ?, ?, ?, ?, ?, ?);
    """, stats_rows)

    print(f"Insertando {len(moves_rows)} relaciones Pokémon-Movimientos...")
    cur.executemany("""
        INSERT OR IGNORE INTO pokemon_movimientos (pokemon_id, movimiento_id, metodo_aprendizaje, nivel_aprendizaje)
        VALUES (?, ?, ?, ?);
    """, moves_rows)

    conn.commit()
    conn.close()
    print("¡Base de datos SQLite actualizada con éxito!")

if __name__ == "__main__":
    populate()
