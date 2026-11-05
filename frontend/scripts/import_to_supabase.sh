#!/usr/bin/env bash
set -euo pipefail

# -------------------------------------------------------------------------
#  CONFIGURACIÓN – DATOS que ya nos diste
# -------------------------------------------------------------------------
PROJECT_REF="kxsyygajkghokcyxavhe"
SUPABASE_URL="https://$PROJECT_REF.supabase.co"
DB_HOST="db.$PROJECT_REF.supabase.co"
DB_USER="postgres"
DB_PASSWORD="Keiler*2490"
DB_NAME="postgres"
# -------------------------------------------------------------------------

# Cadena de conexión PostgreSQL (usada por psql)
export PGPASSWORD="$DB_PASSWORD"
CONN="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:5432/$DB_NAME?sslmode=require"

# -------------------------------------------------------------------------
#  1️⃣  Crear el esquema (tablas, índices, FK) a partir de tu schema.sql
# -------------------------------------------------------------------------
echo "⏳  Creando esquema en Supabase..."
psql "$CONN" -f database/schema.sql

# -------------------------------------------------------------------------
#  2️⃣  Importar CSVs (movimientos y demás)
# -------------------------------------------------------------------------
echo "📥  Importando movimientos.csv → tabla movimientos"
psql "$CONN" -c "\copy public.movimientos FROM '$(pwd)/database/movimientos.csv' CSV HEADER;"

# -------------------------------------------------------------------------
#  3️⃣  Importar Pokémon (json → csv → tabla pokemon)
# -------------------------------------------------------------------------
echo "📥  Convirtiendo pokemon.json a CSV temporal..."
jq -r '.[] | [
  .id,
  .numero_pokedex,
  .nombre,
  .nombre_ingles,
  .gen,
  .tipo1_id,
  (.tipo2_id // "NULL"),
  .peso_kg,
  .altura_m,
  .ratio_captura,
  .experiencia_base,
  .curva_crecimiento,
  (.movimientos_predeterminados | @json)
] | @csv' database/pokemon.json > /tmp/pokemon_tmp.csv

echo "📥  Importando pokemon_tmp.csv → tabla pokemon"
psql "$CONN" -c "\copy public.pokemon FROM '/tmp/pokemon_tmp.csv' CSV QUOTE '"' ESCAPE '\\' NULL 'NULL';"
rm /tmp/pokemon_tmp.csv

# -------------------------------------------------------------------------
#  4️⃣  (Opcional) Cargar otras tablas auxiliares (tipos, clases_movimiento, …)
# -------------------------------------------------------------------------
# Ejemplo: si tuvieras tipos.csv
# psql "$CONN" -c "\copy public.tipos FROM '$(pwd)/database/tipos.csv' CSV HEADER;"

echo "✅  Todo cargado en Supabase. ¡Revisa el Table editor del dashboard!"

