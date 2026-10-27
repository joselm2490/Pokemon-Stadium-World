#!/usr/bin/env python3
"""
Herramienta CLI para buscar y consultar movimientos en la base de datos de Pokémon.
Uso:
    python3 scripts/query_moves.py --search "impactrueno"
    python3 scripts/query_moves.py --tipo Fuego --clase Especial
    python3 scripts/query_moves.py --gen 1 --min-potencia 100
    python3 scripts/query_moves.py --stats
    python3 scripts/query_moves.py --random
"""

import sys
import os
import sqlite3
import argparse

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "pokemon_game.db")

def get_connection():
    if not os.path.exists(DB_PATH):
        print(f"Error: Base de datos no encontrada en {DB_PATH}. Ejecuta scripts/build_database.py primero.")
        sys.exit(1)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def print_move(m):
    alt = f" (LA: {m['nombre_alt']})" if m['nombre_alt'] else ""
    pot = m['potencia_texto'] if m['potencia_texto'] else "-"
    prec = m['precision_texto'] if m['precision_texto'] else "-"
    pp = m['pp_texto'] if m['pp_texto'] else "-"
    
    tags = []
    if m['es_gigamax']:
        tags.append("[GIGAMAX]")
    if m['es_movimiento_z']:
        tags.append("[MOV-Z]")
    tag_str = " " + " ".join(tags) if tags else ""

    print(f"┌─ [{m['codigo']}] {m['nombre']}{alt} / {m['nombre_ingles']}{tag_str}")
    print(f"│  Tipo: {m['tipo']:<10} | Clase: {m['clase']:<10} | Gen: {m['gen']}")
    print(f"│  Potencia: {pot:<6} | Precisión: {prec:<6} | PP: {pp}")
    print(f"│  Descripción: {m['descripcion']}")
    print(f"└─────────────────────────────────────────────────────────────")

def show_stats():
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT count(*) FROM movimientos")
    total = c.fetchone()[0]
    print(f"\n=== ESTADÍSTICAS DE MOVIMIENTOS ({total} en total) ===")
    
    print("\n--- Por Generación ---")
    c.execute("SELECT gen, count(*) FROM movimientos GROUP BY gen ORDER BY gen")
    for row in c.fetchall():
        print(f"  Gen {row[0]}: {row[1]} movimientos")
        
    print("\n--- Por Tipo ---")
    c.execute("SELECT tipo, count(*) FROM movimientos GROUP BY tipo ORDER BY count(*) DESC")
    for row in c.fetchall():
        print(f"  {row[0]:<12}: {row[1]}")
        
    print("\n--- Por Clase ---")
    c.execute("SELECT clase, count(*) FROM movimientos GROUP BY clase ORDER BY count(*) DESC")
    for row in c.fetchall():
        print(f"  {row[0]:<12}: {row[1]}")
        
    c.execute("SELECT count(*) FROM movimientos WHERE es_gigamax = 1")
    g_count = c.fetchone()[0]
    c.execute("SELECT count(*) FROM movimientos WHERE es_movimiento_z = 1")
    z_count = c.fetchone()[0]
    print(f"\nMovimientos Gigamax: {g_count}")
    print(f"Movimientos Z: {z_count}\n")
    conn.close()

def main():
    parser = argparse.ArgumentParser(description="Consulta movimientos Pokémon en la base de datos.")
    parser.add_argument("--search", "-s", help="Buscar por nombre (español o inglés)")
    parser.add_argument("--tipo", "-t", help="Filtrar por tipo (ej. Fuego, Agua, Dragón)")
    parser.add_argument("--clase", "-c", help="Filtrar por clase (Físico, Especial, Estado)")
    parser.add_argument("--gen", "-g", type=int, help="Filtrar por generación (1 a 9)")
    parser.add_argument("--min-potencia", type=int, help="Potencia mínima")
    parser.add_argument("--random", "-r", action="store_true", help="Mostrar un movimiento aleatorio")
    parser.add_argument("--stats", action="store_true", help="Mostrar resumen y estadísticas globales")
    parser.add_argument("--limit", "-l", type=int, default=15, help="Límite de resultados (por defecto 15)")

    args = parser.parse_args()

    if args.stats:
        show_stats()
        return

    conn = get_connection()
    c = conn.cursor()

    if args.random:
        c.execute("SELECT * FROM movimientos ORDER BY RANDOM() LIMIT 1")
        row = c.fetchone()
        if row:
            print_move(row)
        conn.close()
        return

    query = "SELECT * FROM movimientos WHERE 1=1"
    params = []

    if args.search:
        query += " AND (nombre LIKE ? OR nombre_alt LIKE ? OR nombre_ingles LIKE ?)"
        term = f"%{args.search}%"
        params.extend([term, term, term])

    if args.tipo:
        query += " AND tipo LIKE ?"
        params.append(f"%{args.tipo}%")

    if args.clase:
        query += " AND clase LIKE ?"
        params.append(f"%{args.clase}%")

    if args.gen:
        query += " AND gen = ?"
        params.append(args.gen)

    if args.min_potencia is not None:
        query += " AND potencia >= ?"
        params.append(args.min_potencia)

    query += " ORDER BY id LIMIT ?"
    params.append(args.limit)

    c.execute(query, params)
    rows = c.fetchall()

    if not rows:
        print("No se encontraron movimientos con los criterios especificados.")
    else:
        print(f"\nResultados encontrados ({len(rows)}{' [limitado]' if len(rows) == args.limit else ''}):\n")
        for r in rows:
            print_move(r)

    conn.close()

if __name__ == '__main__':
    main()
