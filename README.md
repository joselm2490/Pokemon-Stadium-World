# 🎮 Pokémon Stadium World - Base de Datos

Bienvenido al proyecto **Pokémon Stadium World**. Este repositorio contiene la arquitectura de base de datos relacional y catálogo de datos diseñado para el desarrollo del videojuego de Pokémon.

---

## 📦 Estructura del Proyecto

```
Pokemon-Stadium-World/
├── database/
│   ├── pokemon_game.db        # Base de datos SQLite completa lista para producción
│   ├── pokemon_stadium.sql    # Volcado SQL universal con todas las tablas e inserts
│   ├── schema.sql             # Esquema DDL SQL del videojuego
│   ├── pokemon.json           # Catálogo Pokédex estructurado con stats y learnsets
│   ├── movimientos.json       # 953 movimientos en formato JSON estructurado
│   └── movimientos.csv        # 953 movimientos en CSV (Excel/Sheets)
├── js/
│   ├── app.js                 # Motor principal del juego y gestión de sprites (AttackSpriteManager)
│   ├── movimientos_data.js    # Carga de datos de movimientos para el navegador
│   └── pokemon_data.js        # Carga de datos de la Pokédex para el navegador
├── css/
│   └── stadium.css            # Estilos visuales del juego estilo Pokémon Stadium
├── scripts/
│   ├── build_pokemon.mjs      # Generador de datos de Pokédex y learnsets
│   └── populate_pokemon_db.py # Script para poblar SQLite desde los JSON
├── sprites/                   # Badges e íconos oficiales descargados de tipos y categorías
├── index.html                 # Videojuego y explorador web interactivo
└── README.md                  # Documentación
```

---

## 📊 1. Base de Datos de Movimientos (953 Registros)

Se han procesado e integrado **todos los 953 movimientos** oficiales de Pokémon (desde la Generación 1 hasta la Generación 9), incluyendo:
- **920 Movimientos Estándar**: Movimientos de batalla regulares y movimientos Z de cada clase (Físico / Especial).
- **33 Movimientos Gigamax**: Ataques característicos de la mecánica Dinamax/Gigamax.

### Campos por Movimiento:
1. `id` / `codigo`: Identificador numérico oficial (ej. `0001`, `0053`, `G01`).
2. `nombre`: Nombre en español (ej. `Lanzallamas`, `Golpe Kárate`).
3. `nombre_alt`: Variante regional si difiere (ej. Hispanoamérica: `Golpe Karate`).
4. `nombre_ingles`: Nombre oficial en inglés (ej. `Flamethrower`, `Karate Chop`).
5. `gen`: Generación en la que se introdujo (1 al 9).
6. `descripcion`: Descripción detallada del efecto en combate en español.
7. `tipo`: Tipo elemental (`Normal`, `Fuego`, `Agua`, `Planta`, `Eléctrico`, `Hielo`, `Lucha`, `Veneno`, `Tierra`, `Volador`, `Psíquico`, `Bicho`, `Roca`, `Fantasma`, `Dragón`, `Siniestro`, `Acero`, `Hada`, `Estelar`).
8. `clase`: Categoría del ataque (`Físico`, `Especial`, `Estado`).
9. `potencia` / `potencia_texto`: Daño base numérico (o `NULL` / `Varía` si es de estado o condicional).
10. `precision` / `precision_texto`: Probabilidad de acierto (o `NULL` / `-` si nunca falla).
11. `pp` / `pp_texto`: Puntos de Poder base.
12. `prioridad`: Prioridad de turno (-7 a +5, por defecto 0).
13. `es_gigamax`: Bandera booleana (1 para ataques Gigamax).
14. `es_movimiento_z`: Bandera booleana (1 para movimientos Z).

---

## 🛠️ 2. Esquema Relacional de la Base de Datos

El archivo [`database/schema.sql`](file:///home/jose/Pokemon-Stadium-World/database/schema.sql) incluye las tablas fundamentales del juego:

- `tipos`: Catálogo de los 19 tipos elementales con colores HEX y traducción.
- `clases_movimiento`: `Físico`, `Especial`, `Estado`.
- `movimientos`: Catálogo completo con claves foráneas a `tipos` y `clases_movimiento`.
- `efectividad_tipos`: Matriz de debilidades, resistencias e inmunidades.
- `pokemon`: Especies de Pokémon, número de Pokédex, tipos, altura, peso, stats y `movimientos_predeterminados` (JSON Array con los 4 movimientos predeterminados oficiales extraídos de anexos).
- `estadisticas_base`: HP, Ataque, Defensa, At. Especial, Def. Especial, Velocidad y Stat Total *(preparada)*.
- `habilidades`: Habilidades pasivas de combate *(preparada)*.
- `pokemon_movimientos`: Tabla relacional de qué movimientos aprende cada Pokémon por nivel, MT, tutor o huevo *(preparada)*.
- `salas_batalla`: Gestión de salas multijugador con código único aleatorio de 6 caracteres (ej. `PXXE69`), anfitrión, estado (`esperando`, `en_combate`, etc.) y reglas.
- `sala_jugadores`: Registro de entrenadores presentes en la sala, condición de anfitrión, estado de preparación y equipo.
- `sala_mensajes`: Historial completo del chat del lobby y eventos de sistema en tiempo real.
- `sala_estadisticas`: Registro de métricas de combate, turnos, daño, Pokémon debilitados y duración.

---

## 🚀 3. Formas de Consulta y Uso

### A. Consulta en Terminal (CLI)
Puedes realizar búsquedas instantáneas con [`scripts/query_moves.py`](file:///home/jose/Pokemon-Stadium-World/scripts/query_moves.py):

```bash
# Ver estadísticas generales
python3 scripts/query_moves.py --stats

# Buscar un movimiento por nombre (español o inglés)
python3 scripts/query_moves.py --search "Lanzallamas"
python3 scripts/query_moves.py --search "Earthquake"

# Filtrar por Tipo y Clase
python3 scripts/query_moves.py --tipo Dragón --clase Especial

# Filtrar por Generación y Potencia mínima
python3 scripts/query_moves.py --gen 1 --min-potencia 100

# Ver un movimiento aleatorio
python3 scripts/query_moves.py --random
```

### B. Explorador Web Interactivo
Abre el archivo [`viewer/index.html`](file:///home/jose/Pokemon-Stadium-World/viewer/index.html) en tu navegador o inicia un servidor local:

```bash
python3 -m http.server 8000
# Abrir en http://localhost:8000/viewer/
```

### C. Conexión directa a SQLite en Python / Game Engines (Godot / Unity)
```python
import sqlite3

conn = sqlite3.connect("database/pokemon_game.db")
cursor = conn.cursor()

# Obtener todos los ataques de Fuego con potencia > 80
cursor.execute("""
    SELECT nombre, nombre_ingles, potencia, precision, pp
    FROM movimientos
    WHERE tipo = 'Fuego' AND potencia >= 80
    ORDER BY potencia DESC
""")

for row in cursor.fetchall():
    print(row)
```

---

## 📋 Próximos Pasos Sugeridos
1. **Tabla de Efectividades de Tipos**: Matriz 18x18 de daño (súper eficaz x2, poco eficaz x0.5, inmune x0).
2. **Tabla de Pokémon y Estadísticas**: Datos de cada especie (nombre, tipos, estadísticas base: PS, Ataque, Defensa, Velocidad, etc.).
3. **Learnsets (Movimientos aprendibles)**: Relacionar qué Pokémon aprende qué movimientos por nivel, MT o tutor.
4. **Lógica de Combate**: Fórmulas de daño de Pokémon Stadium / Pokémon Showdown.
