#!/usr/bin/env python3
import sqlite3
import json
import urllib.request
import sys
import time

import os

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://kxsyygajkghokcyxavhe.supabase.co/rest/v1")
API_KEY = os.environ.get("SUPABASE_SECRET_KEY", "")

HEADERS = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

def post_batch(table, rows):
    url = f"{SUPABASE_URL}/{table}"
    data = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            return response.status
    except urllib.error.HTTPError as e:
        print(f"Error HTTP en {table}: {e.code} - {e.read().decode('utf-8')}")
        raise e

def migrate_table(sqlite_cursor, table_name, columns, batch_size=500):
    print(f"📦 Migrando {table_name}...")
    col_str = ", ".join(columns)
    sqlite_cursor.execute(f"SELECT {col_str} FROM {table_name}")
    
    batch = []
    total = 0
    for row in sqlite_cursor:
        record = {}
        for idx, col in enumerate(columns):
            val = row[idx]
            record[col] = val
        batch.append(record)
        
        if len(batch) >= batch_size:
            post_batch(table_name, batch)
            total += len(batch)
            print(f"  -> {total} registros enviados...")
            batch = []
            time.sleep(0.1)
            
    if batch:
        post_batch(table_name, batch)
        total += len(batch)
        print(f"  -> Total final {table_name}: {total}")
    print(f"✅ {table_name} migrado con éxito.\n")

def main():
    conn = sqlite3.connect("database/pokemon_game.db")
    cur = conn.cursor()
    
    # 1. clases_movimiento
    migrate_table(cur, "clases_movimiento", ["id", "nombre", "nombre_ingles", "color_hex"])

    # 2. tipos
    migrate_table(cur, "tipos", ["id", "nombre", "nombre_ingles", "color_hex"])

    # 3. efectividad_tipos
    migrate_table(cur, "efectividad_tipos", ["tipo_ataque_id", "tipo_defensa_id", "multiplicador"])

    # 4. movimientos
    migrate_table(cur, "movimientos", [
        "id", "codigo", "nombre", "nombre_alt", "nombre_ingles", "gen", "descripcion",
        "tipo_id", "tipo", "clase_id", "clase", "potencia", "potencia_texto",
        "precision", "precision_texto", "pp", "pp_texto", "prioridad", "es_gigamax",
        "es_movimiento_z", "contacto", "probabilidad_efecto", "efecto_secundario"
    ])

    # 5. pokemon
    migrate_table(cur, "pokemon", [
        "id", "numero_pokedex", "nombre", "nombre_ingles", "gen", "tipo1_id", "tipo2_id",
        "peso_kg", "altura_m", "ratio_captura", "experiencia_base", "curva_crecimiento",
        "movimientos_predeterminados"
    ])

    # 6. estadisticas_base
    migrate_table(cur, "estadisticas_base", [
        "pokemon_id", "hp", "ataque", "defensa", "ataque_especial", "defensa_especial", "velocidad"
    ])

    # 7. pokemon_movimientos (lotes de 2000)
    migrate_table(cur, "pokemon_movimientos", [
        "pokemon_id", "movimiento_id", "metodo_aprendizaje", "nivel_aprendizaje"
    ], batch_size=2000)

    print("🎉 Migración completa exitosa a Supabase!")

if __name__ == "__main__":
    main()

