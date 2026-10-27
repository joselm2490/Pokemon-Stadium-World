-- ====================================================================
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
