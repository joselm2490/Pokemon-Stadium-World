#!/usr/bin/env python3
"""
ETL Builder: Extrae todos los movimientos de Pokémon desde WikiDex
y construye la base de datos relacional (SQLite), así como volcados
en JSON, CSV y SQL.
"""

import os
import re
import csv
import json
import sqlite3
from html import unescape

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_HTML = "/home/jose/.gemini/antigravity-ide/brain/a7a324ee-0353-433c-b173-33e15fd73912/.system_generated/steps/8/content.md"
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "pokemon_game.db")
JSON_PATH = os.path.join(DATA_DIR, "movimientos.json")
CSV_PATH = os.path.join(DATA_DIR, "movimientos.csv")
SQL_DUMP_PATH = os.path.join(DATA_DIR, "movimientos_dump.sql")
SCHEMA_SQL_PATH = os.path.join(BASE_DIR, "database", "schema.sql")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(os.path.join(BASE_DIR, "database"), exist_ok=True)

TIPOS_INFO = [
    (1, "Normal", "Normal", "#A8A878"),
    (2, "Fuego", "Fire", "#F08030"),
    (3, "Agua", "Water", "#6890F0"),
    (4, "Planta", "Grass", "#78C850"),
    (5, "Eléctrico", "Electric", "#F8D030"),
    (6, "Hielo", "Ice", "#98D8D8"),
    (7, "Lucha", "Fighting", "#C03028"),
    (8, "Veneno", "Poison", "#A040A0"),
    (9, "Tierra", "Ground", "#E0C068"),
    (10, "Volador", "Flying", "#A890F0"),
    (11, "Psíquico", "Psychic", "#F85888"),
    (12, "Bicho", "Bug", "#A8B820"),
    (13, "Roca", "Rock", "#B8A038"),
    (14, "Fantasma", "Ghost", "#705898"),
    (15, "Dragón", "Dragon", "#7038F8"),
    (16, "Siniestro", "Dark", "#705848"),
    (17, "Acero", "Steel", "#B8B8D0"),
    (18, "Hada", "Fairy", "#EE99AC"),
    (19, "Estelar", "Stellar", "#45C8B8")
]

CLASES_INFO = [
    (1, "Físico", "Physical", "#E53E3E"),
    (2, "Especial", "Special", "#3182CE"),
    (3, "Estado", "Status", "#718096")
]

TIPO_NAME_TO_ID = {t[1]: t[0] for t in TIPOS_INFO}
CLASE_NAME_TO_ID = {c[1]: c[0] for c in CLASES_INFO}

def clean_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r'<sup.*?</sup>', '', text)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = unescape(text)
    return ' '.join(text.split())

def parse_moves(source_path: str):
    with open(source_path, 'r', encoding='utf-8') as f:
        html = f.read()

    tables = re.findall(r'<table class=\"tabpokemon[^\"]*\">.*?</table>', html, re.DOTALL)
    if len(tables) < 2:
        raise ValueError(f"Se esperaban al menos 2 tablas 'tabpokemon', encontradas: {len(tables)}")

    moves = []
    
    # --- TABLA 0: Movimientos estándar y Z (920 entradas) ---
    t0 = tables[0]
    last_full = None
    for idx, row in enumerate(re.findall(r'<tr>(.*?)</tr>', t0, re.DOTALL)):
        tds = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        if not tds:
            continue

        # Detección de filas Z secundarias (rowspan = 2)
        if len(tds) == 2 and last_full is not None:
            mid_raw = clean_text(tds[0])
            c_m = re.search(r'alt=\"Clase\s*(?:de\s*)?([^\"]+)\"', tds[1], re.IGNORECASE)
            mclass = c_m.group(1).capitalize().strip() if c_m else "Especial"
            
            item = dict(last_full)
            item['codigo'] = mid_raw.zfill(4)
            item['id'] = int(mid_raw)
            item['clase'] = mclass
            item['es_movimiento_z'] = 1
            moves.append(item)
            continue

        if len(tds) != 9:
            continue

        mid_raw = clean_text(tds[0])
        mid = int(mid_raw) if mid_raw.isdigit() else len(moves) + 1

        # Nombre en inglés
        en_match = re.search(r'<i>(.*?)</i>', tds[1])
        en_name = clean_text(en_match.group(1)) if en_match else ""

        # Nombres en español
        es_419 = re.search(r'lang=\"es-419\">(.*?)</span>', tds[1])
        es_es = re.search(r'lang=\"es-ES\">(.*?)</span>', tds[1])
        if es_es:
            sp_name = clean_text(es_es.group(1))
            alt_name = clean_text(es_419.group(1)) if es_419 else ""
        else:
            name_match = re.search(r'<a[^>]*>(.*?)</a>', tds[1])
            sp_name = clean_text(name_match.group(1)) if name_match else clean_text(tds[1].split('<i>')[0])
            alt_name = ""

        # Generación
        gen_m = re.search(r'alt=\"(\d+)\"', tds[2])
        gen = int(gen_m.group(1)) if gen_m else 1

        # Descripción
        desc = clean_text(tds[3])

        # Tipo
        t_es = re.search(r'lang=\"es-ES\".*?alt=\"Tipo\s+([^\"]+)\"', tds[4])
        if t_es:
            mtype = t_es.group(1).strip()
        else:
            t_m = re.search(r'alt=\"Tipo\s+([^\"]+)\"', tds[4])
            mtype = t_m.group(1).strip() if t_m else "Normal"
        
        # Normalizar sinónimos regionales
        if mtype.lower() == 'pelea':
            mtype = 'Lucha'
        elif mtype.lower() == 'insecto':
            mtype = 'Bicho'

        # Clase
        c_m = re.search(r'alt=\"Clase\s*(?:de\s*)?([^\"]+)\"', tds[5], re.IGNORECASE)
        mclass = c_m.group(1).capitalize().strip() if c_m else "Físico"

        # Potencia, Precisión, PP
        p_raw = clean_text(tds[6])
        a_raw = clean_text(tds[7])
        pp_raw = clean_text(tds[8])

        potencia = int(p_raw) if p_raw.isdigit() else None
        precision = int(a_raw) if a_raw.isdigit() else None
        pp = int(pp_raw) if pp_raw.isdigit() else None

        es_z = 1 if ("Poder Z" in desc or "Movimiento Z" in desc or "Cristal Z" in desc or "cite_note-MovZ" in row) else 0

        item = {
            'id': mid,
            'codigo': mid_raw.zfill(4),
            'nombre': sp_name,
            'nombre_alt': alt_name,
            'nombre_ingles': en_name,
            'gen': gen,
            'descripcion': desc,
            'tipo': mtype,
            'clase': mclass,
            'potencia': potencia,
            'potencia_texto': p_raw,
            'precision': precision,
            'precision_texto': a_raw,
            'pp': pp,
            'pp_texto': pp_raw,
            'prioridad': 0,
            'es_gigamax': 0,
            'es_movimiento_z': es_z
        }
        moves.append(item)
        last_full = item

    # --- TABLA 1: Movimientos Gigamax (33 entradas) ---
    t1 = tables[1]
    g_count = 0
    next_id = max(m['id'] for m in moves) + 1 if moves else 1000

    for row in re.findall(r'<tr>(.*?)</tr>', t1, re.DOTALL):
        tds = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        if not tds or len(tds) < 7:
            continue

        gid_num = clean_text(tds[0])
        codigo = f"G{gid_num.zfill(2)}"

        en_m = re.search(r'<i>(.*?)</i>', tds[1])
        en_name = clean_text(en_m.group(1)) if en_m else ""

        es_419 = re.search(r'lang=\"es-419\">(.*?)</span>', tds[1])
        es_es = re.search(r'lang=\"es-ES\">(.*?)</span>', tds[1])
        if es_es:
            sp_name = clean_text(es_es.group(1))
            alt_name = clean_text(es_419.group(1)) if es_419 else ""
        else:
            name_m = re.search(r'<a[^>]*>(.*?)</a>', tds[1])
            sp_name = clean_text(name_m.group(1)) if name_m else clean_text(tds[1].split('<i>')[0])
            alt_name = ""

        gen_m = re.search(r'alt=\"(\d+)\"', tds[2])
        gen = int(gen_m.group(1)) if gen_m else 8

        desc = clean_text(tds[3])

        t_es = re.search(r'lang=\"es-ES\".*?alt=\"Tipo\s+([^\"]+)\"', tds[4])
        if t_es:
            mtype = t_es.group(1).strip()
        else:
            t_m = re.search(r'alt=\"Tipo\s+([^\"]+)\"', tds[4])
            mtype = t_m.group(1).strip() if t_m else "Normal"
        if mtype.lower() == 'pelea':
            mtype = 'Lucha'
        elif mtype.lower() == 'insecto':
            mtype = 'Bicho'

        c_m = re.search(r'alt=\"Clase\s*(?:de\s*)?([^\"]+)\"', tds[5], re.IGNORECASE)
        mclass = c_m.group(1).capitalize().strip() if c_m else "Físico"

        p_raw = clean_text(tds[6])
        potencia = int(p_raw) if p_raw.isdigit() else None

        item = {
            'id': next_id,
            'codigo': codigo,
            'nombre': sp_name,
            'nombre_alt': alt_name,
            'nombre_ingles': en_name,
            'gen': gen,
            'descripcion': desc,
            'tipo': mtype,
            'clase': mclass,
            'potencia': potencia,
            'potencia_texto': p_raw,
            'precision': None,
            'precision_texto': "-",
            'pp': None,
            'pp_texto': "-",
            'prioridad': 0,
            'es_gigamax': 1,
            'es_movimiento_z': 0
        }
        moves.append(item)
        next_id += 1
        g_count += 1

    return moves

def build_schema_sql():
    sql = """-- ====================================================================
-- ESQUEMA DE BASE DE DATOS: POKÉMON STADIUM WORLD
-- Diseñado para motores de videojuegos (Godot, Unity, Web, Python, etc.)
-- ====================================================================

PRAGMA foreign_keys = ON;

-- --------------------------------------------------------------------
-- 1. TABLA: tipos
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tipos (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    nombre_ingles TEXT NOT NULL,
    color_hex TEXT NOT NULL
);

-- --------------------------------------------------------------------
-- 2. TABLA: clases_movimiento
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clases_movimiento (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    nombre_ingles TEXT NOT NULL,
    color_hex TEXT NOT NULL
);

-- --------------------------------------------------------------------
-- 3. TABLA: movimientos
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos (
    id INTEGER PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    nombre_alt TEXT,
    nombre_ingles TEXT NOT NULL,
    gen INTEGER NOT NULL,
    descripcion TEXT,
    tipo_id INTEGER REFERENCES tipos(id),
    tipo TEXT NOT NULL,
    clase_id INTEGER REFERENCES clases_movimiento(id),
    clase TEXT NOT NULL,
    potencia INTEGER,
    potencia_texto TEXT,
    precision INTEGER,
    precision_texto TEXT,
    pp INTEGER,
    pp_texto TEXT,
    prioridad INTEGER DEFAULT 0,
    es_gigamax INTEGER DEFAULT 0,
    es_movimiento_z INTEGER DEFAULT 0,
    contacto INTEGER DEFAULT 0,
    probabilidad_efecto INTEGER DEFAULT 0,
    efecto_secundario TEXT
);

CREATE INDEX IF NOT EXISTS idx_mov_nombre ON movimientos(nombre);
CREATE INDEX IF NOT EXISTS idx_mov_nombre_en ON movimientos(nombre_ingles);
CREATE INDEX IF NOT EXISTS idx_mov_tipo ON movimientos(tipo);
CREATE INDEX IF NOT EXISTS idx_mov_clase ON movimientos(clase);
CREATE INDEX IF NOT EXISTS idx_mov_gen ON movimientos(gen);

-- --------------------------------------------------------------------
-- 4. TABLA: efectividad_tipos (Tabla de debilidades / resistencias)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS efectividad_tipos (
    tipo_ataque_id INTEGER NOT NULL REFERENCES tipos(id),
    tipo_defensa_id INTEGER NOT NULL REFERENCES tipos(id),
    multiplicador REAL NOT NULL DEFAULT 1.0, -- 0.0 (inmune), 0.5 (resistente), 1.0 (normal), 2.0 (súper eficaz)
    PRIMARY KEY (tipo_ataque_id, tipo_defensa_id)
);

-- --------------------------------------------------------------------
-- 5. TABLA: pokemon (Preparada para la siguiente fase de datos)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pokemon (
    id INTEGER PRIMARY KEY,
    numero_pokedex INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    nombre_ingles TEXT NOT NULL,
    gen INTEGER NOT NULL,
    tipo1_id INTEGER NOT NULL REFERENCES tipos(id),
    tipo2_id INTEGER REFERENCES tipos(id),
    peso_kg REAL,
    altura_m REAL,
    ratio_captura INTEGER,
    experiencia_base INTEGER,
    curva_crecimiento TEXT
);

-- --------------------------------------------------------------------
-- 6. TABLA: estadisticas_base (Stats de cada Pokémon)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estadisticas_base (
    pokemon_id INTEGER PRIMARY KEY REFERENCES pokemon(id) ON DELETE CASCADE,
    hp INTEGER NOT NULL,
    ataque INTEGER NOT NULL,
    defensa INTEGER NOT NULL,
    ataque_especial INTEGER NOT NULL,
    defensa_especial INTEGER NOT NULL,
    velocidad INTEGER NOT NULL,
    total INTEGER GENERATED ALWAYS AS (hp + ataque + defensa + ataque_especial + defensa_especial + velocidad) STORED
);

-- --------------------------------------------------------------------
-- 7. TABLA: habilidades
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS habilidades (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL,
    nombre_ingles TEXT NOT NULL,
    descripcion TEXT
);

-- --------------------------------------------------------------------
-- 8. TABLA: pokemon_movimientos (Movimientos que aprende cada Pokémon)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pokemon_movimientos (
    pokemon_id INTEGER NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
    movimiento_id INTEGER NOT NULL REFERENCES movimientos(id) ON DELETE CASCADE,
    metodo_aprendizaje TEXT NOT NULL, -- 'nivel', 'mt', 'tutor', 'huevo', 'especial'
    nivel_aprendizaje INTEGER DEFAULT 1,
    PRIMARY KEY (pokemon_id, movimiento_id, metodo_aprendizaje, nivel_aprendizaje)
);
"""
    with open(SCHEMA_SQL_PATH, 'w', encoding='utf-8') as f:
        f.write(sql)
    return sql

def main():
    print("Iniciando extracción y generación de base de datos...")
    moves = parse_moves(SOURCE_HTML)
    print(f"-> Extraídos {len(moves)} movimientos en total.")

    # 1. Crear Schema SQL
    schema_sql = build_schema_sql()

    # 2. Inicializar SQLite
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.executescript(schema_sql)

    # Insertar tipos
    cursor.executemany(
        "INSERT INTO tipos (id, nombre, nombre_ingles, color_hex) VALUES (?, ?, ?, ?)",
        TIPOS_INFO
    )

    # Insertar clases
    cursor.executemany(
        "INSERT INTO clases_movimiento (id, nombre, nombre_ingles, color_hex) VALUES (?, ?, ?, ?)",
        CLASES_INFO
    )

    # Insertar movimientos
    insert_sql = """
    INSERT INTO movimientos (
        id, codigo, nombre, nombre_alt, nombre_ingles, gen, descripcion,
        tipo_id, tipo, clase_id, clase,
        potencia, potencia_texto, precision, precision_texto, pp, pp_texto,
        prioridad, es_gigamax, es_movimiento_z
    ) VALUES (
        :id, :codigo, :nombre, :nombre_alt, :nombre_ingles, :gen, :descripcion,
        :tipo_id, :tipo, :clase_id, :clase,
        :potencia, :potencia_texto, :precision, :precision_texto, :pp, :pp_texto,
        :prioridad, :es_gigamax, :es_movimiento_z
    )
    """

    db_rows = []
    for m in moves:
        m_copy = dict(m)
        m_copy['tipo_id'] = TIPO_NAME_TO_ID.get(m['tipo'])
        m_copy['clase_id'] = CLASE_NAME_TO_ID.get(m['clase'])
        db_rows.append(m_copy)

    cursor.executemany(insert_sql, db_rows)
    conn.commit()

    # Validar
    cursor.execute("SELECT count(*) FROM movimientos")
    count = cursor.fetchone()[0]
    print(f"-> Insertados con éxito {count} movimientos en SQLite ({DB_PATH}).")

    # 3. Guardar JSON
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(db_rows, f, ensure_ascii=False, indent=2)
    print(f"-> Exportado JSON en {JSON_PATH} ({len(db_rows)} registros).")

    # 4. Guardar CSV
    fieldnames = [
        'id', 'codigo', 'nombre', 'nombre_alt', 'nombre_ingles', 'gen',
        'descripcion', 'tipo', 'clase', 'potencia', 'potencia_texto',
        'precision', 'precision_texto', 'pp', 'pp_texto', 'es_gigamax', 'es_movimiento_z'
    ]
    with open(CSV_PATH, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(db_rows)
    print(f"-> Exportado CSV en {CSV_PATH}.")

    # 5. Generar Dump SQL universal
    with open(SQL_DUMP_PATH, 'w', encoding='utf-8') as f:
        f.write("-- ====================================================================\n")
        f.write("-- DUMP SQL: TABLA DE MOVIMIENTOS POKÉMON (953 MOVIMIENTOS COMPLETOS)\n")
        f.write("-- ====================================================================\n\n")
        f.write(schema_sql)
        f.write("\n\n-- DATOS DE TIPOS:\n")
        for t in TIPOS_INFO:
            f.write(f"INSERT INTO tipos (id, nombre, nombre_ingles, color_hex) VALUES ({t[0]}, '{t[1]}', '{t[2]}', '{t[3]}');\n")
        f.write("\n-- DATOS DE CLASES:\n")
        for c in CLASES_INFO:
            f.write(f"INSERT INTO clases_movimiento (id, nombre, nombre_ingles, color_hex) VALUES ({c[0]}, '{c[1]}', '{c[2]}', '{c[3]}');\n")
        f.write("\n-- DATOS DE MOVIMIENTOS:\n")
        for r in db_rows:
            def sql_str(val):
                if val is None:
                    return "NULL"
                return "'" + str(val).replace("'", "''") + "'"
            def sql_val(val):
                if val is None:
                    return "NULL"
                return str(val)

            f.write(
                f"INSERT INTO movimientos ("
                f"id, codigo, nombre, nombre_alt, nombre_ingles, gen, descripcion, "
                f"tipo_id, tipo, clase_id, clase, potencia, potencia_texto, "
                f"precision, precision_texto, pp, pp_texto, prioridad, es_gigamax, es_movimiento_z) VALUES ("
                f"{r['id']}, {sql_str(r['codigo'])}, {sql_str(r['nombre'])}, {sql_str(r['nombre_alt'])}, "
                f"{sql_str(r['nombre_ingles'])}, {r['gen']}, {sql_str(r['descripcion'])}, "
                f"{sql_val(r['tipo_id'])}, {sql_str(r['tipo'])}, {sql_val(r['clase_id'])}, {sql_str(r['clase'])}, "
                f"{sql_val(r['potencia'])}, {sql_str(r['potencia_texto'])}, "
                f"{sql_val(r['precision'])}, {sql_str(r['precision_texto'])}, "
                f"{sql_val(r['pp'])}, {sql_str(r['pp_texto'])}, "
                f"{r['prioridad']}, {r['es_gigamax']}, {r['es_movimiento_z']});\n"
            )

    print(f"-> Volcado SQL universal generado en {SQL_DUMP_PATH}.")
    conn.close()
    print("¡Construcción finalizada con éxito!")

if __name__ == '__main__':
    main()
