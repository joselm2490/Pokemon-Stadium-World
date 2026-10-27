# 🎮 Pokémon Stadium World - Base de Datos

Bienvenido al proyecto **Pokémon Stadium World**. Este repositorio contiene la arquitectura de base de datos relacional y catálogo de datos diseñado para el desarrollo del videojuego de Pokémon.

---

## 📦 Estructura del Proyecto

```
Pokemon-Stadium-World/
├── database/
│   └── schema.sql             # Esquema DDL SQL completo para el videojuego
├── data/
│   ├── pokemon_game.db        # Base de datos SQLite lista para usar
│   ├── movimientos.json       # 953 movimientos en formato JSON estructurado
│   ├── movimientos.csv        # 953 movimientos en CSV (Excel/Sheets)
│   └── movimientos_dump.sql   # Volcado SQL universal con todos los INSERTs
├── scripts/
│   ├── build_database.py      # Pipeline ETL que procesa WikiDex y genera los datos
│   └── query_moves.py         # Herramienta CLI de búsqueda y consulta en terminal
├── viewer/
│   ├── index.html             # Interfaz web interactiva estilo Pokémon Stadium
│   └── movimientos_data.json  # Copia de datos para el visor web
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
- `pokemon`: Especies de Pokémon, número de Pokédex, tipos, altura, peso, etc. *(preparada para el siguiente paso)*.
- `estadisticas_base`: HP, Ataque, Defensa, At. Especial, Def. Especial, Velocidad y Stat Total *(preparada)*.
- `habilidades`: Habilidades pasivas de combate *(preparada)*.
- `pokemon_movimientos`: Tabla relacional de qué movimientos aprende cada Pokémon por nivel, MT, tutor o huevo *(preparada)*.

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

conn = sqlite3.connect("data/pokemon_game.db")
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
