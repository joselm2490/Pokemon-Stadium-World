-- ====================================================================
-- ESQUEMA DE BASE DE DATOS: POKÉMON STADIUM WORLD (POSTGRESQL / SUPABASE)
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. TABLA: tipos
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tipos (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    nombre_ingles TEXT NOT NULL,
    color_hex TEXT NOT NULL
);

-- --------------------------------------------------------------------
-- 2. TABLA: clases_movimiento
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clases_movimiento (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    nombre_ingles TEXT NOT NULL,
    color_hex TEXT NOT NULL
);

-- --------------------------------------------------------------------
-- 3. TABLA: movimientos
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos (
    id SERIAL PRIMARY KEY,
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
-- 5. TABLA: pokemon
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pokemon (
    id SERIAL PRIMARY KEY,
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
    curva_crecimiento TEXT,
    categoria_rareza TEXT NOT NULL DEFAULT 'estandar', -- 'estandar', 'legendario', 'pseudolegendario'
    movimientos_predeterminados TEXT, -- JSON Array con los 4 IDs de movimientos predeterminados
    preevolucion INTEGER REFERENCES pokemon(id) ON DELETE SET NULL, -- ID del Pokémon preevolución
    evolucion INTEGER REFERENCES pokemon(id) ON DELETE SET NULL,    -- ID del Pokémon evolución directa
    campeon INTEGER NOT NULL DEFAULT 0,                            -- 1 si está en fase final, 0 si no
    fase INTEGER NOT NULL DEFAULT 1                                -- Fase evolutiva: 1 (básica), 2 (primera evo), 3 (segunda evo)
);

CREATE INDEX IF NOT EXISTS idx_poke_categoria_rareza ON pokemon(categoria_rareza);
CREATE INDEX IF NOT EXISTS idx_poke_preevolucion ON pokemon(preevolucion);
CREATE INDEX IF NOT EXISTS idx_poke_evolucion ON pokemon(evolucion);
CREATE INDEX IF NOT EXISTS idx_poke_campeon ON pokemon(campeon);
CREATE INDEX IF NOT EXISTS idx_poke_fase ON pokemon(fase);

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
    id SERIAL PRIMARY KEY,
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

-- --------------------------------------------------------------------
-- 9. TABLA: usuarios (Sistema de registro y autenticación)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    contrasena TEXT NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ultimo_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(LOWER(email));

-- ====================================================================
-- SISTEMA MULTIJUGADOR: SALAS, JUGADORES, MENSAJES Y ESTADÍSTICAS
-- ====================================================================

-- --------------------------------------------------------------------
-- 10. TABLA: salas_batalla
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salas_batalla (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    contrasena TEXT DEFAULT NULL, -- Contraseña opcional de la sala privada
    anfitrion_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    anfitrion_nombre TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'esperando', -- 'esperando', 'en_combate', 'finalizada', 'cancelada'
    pokemon_por_jugador INTEGER NOT NULL DEFAULT 3,
    max_jugadores INTEGER NOT NULL DEFAULT 2,
    jugadores_actuales INTEGER NOT NULL DEFAULT 1,
    jugadores TEXT DEFAULT NULL, -- JSON opcional con el arreglo de jugadores [{ id, apodo, es_anfitrion, listo, conectado }]
    ajustes TEXT DEFAULT NULL, -- JSON con filtros de partida: { generaciones: ['todas'], formas: ['todas'], legendarios: 'no' }
    ganador_nombre TEXT,
    creada_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    iniciada_en TIMESTAMPTZ,
    finalizada_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_salas_codigo ON salas_batalla(LOWER(codigo));
CREATE INDEX IF NOT EXISTS idx_salas_estado ON salas_batalla(estado);

-- --------------------------------------------------------------------
-- 11. TABLA: sala_jugadores
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sala_jugadores (
    id SERIAL PRIMARY KEY,
    sala_id INTEGER NOT NULL REFERENCES salas_batalla(id) ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    apodo TEXT NOT NULL,
    es_anfitrion INTEGER NOT NULL DEFAULT 0, -- 1 = Anfitrión, 0 = Invitado
    equipo_pokemon TEXT, -- JSON Array con IDs de Pokémon seleccionados
    listo INTEGER NOT NULL DEFAULT 0, -- 1 = Listo para comenzar
    conectado INTEGER NOT NULL DEFAULT 1, -- 1 = Conectado, 0 = Desconectado
    unido_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sala_id, apodo)
);

CREATE INDEX IF NOT EXISTS idx_sala_jugadores_sala ON sala_jugadores(sala_id);

-- --------------------------------------------------------------------
-- 12. TABLA: sala_mensajes (Chat del Lobby)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sala_mensajes (
    id SERIAL PRIMARY KEY,
    sala_id INTEGER NOT NULL REFERENCES salas_batalla(id) ON DELETE CASCADE,
    emisor TEXT NOT NULL, -- Apodo del jugador o 'SISTEMA'
    mensaje TEXT NOT NULL,
    es_sistema INTEGER NOT NULL DEFAULT 0, -- 1 = Evento de sistema, 0 = Chat de usuario
    enviado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sala_mensajes_sala ON sala_mensajes(sala_id);

-- --------------------------------------------------------------------
-- 13. TABLA: sala_estadisticas (Historial y métricas de partidas)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sala_estadisticas (
    id SERIAL PRIMARY KEY,
    sala_id INTEGER NOT NULL UNIQUE REFERENCES salas_batalla(id) ON DELETE CASCADE,
    total_turnos INTEGER DEFAULT 0,
    total_dano_causado INTEGER DEFAULT 0,
    pokemon_debilitados INTEGER DEFAULT 0,
    movimientos_usados INTEGER DEFAULT 0,
    duracion_segundos INTEGER DEFAULT 0,
    mvp_pokemon_id INTEGER REFERENCES pokemon(id),
    datos_combate TEXT -- JSON detallado con el registro turno por turno
);
