import { Pokedex } from '../anexos/pokemon-showdown/data/pokedex.ts';
import { Learnsets } from '../anexos/pokemon-showdown/data/learnsets.ts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function toID(s) {
  return ('' + (s || '')).toLowerCase().replace(/[^a-z0-9]/g, '');
}

const TYPE_TRANSLATIONS = {
  'Normal': 'Normal',
  'Fire': 'Fuego',
  'Water': 'Agua',
  'Grass': 'Planta',
  'Electric': 'Eléctrico',
  'Ice': 'Hielo',
  'Fighting': 'Lucha',
  'Poison': 'Veneno',
  'Ground': 'Tierra',
  'Flying': 'Volador',
  'Psychic': 'Psíquico',
  'Bug': 'Bicho',
  'Rock': 'Roca',
  'Ghost': 'Fantasma',
  'Dragon': 'Dragón',
  'Dark': 'Siniestro',
  'Steel': 'Acero',
  'Fairy': 'Hada',
  'Stellar': 'Estelar'
};

const TYPE_NAME_TO_ID = {
  'Normal': 1, 'Fuego': 2, 'Agua': 3, 'Planta': 4, 'Eléctrico': 5,
  'Hielo': 6, 'Lucha': 7, 'Veneno': 8, 'Tierra': 9, 'Volador': 10,
  'Psíquico': 11, 'Bicho': 12, 'Roca': 13, 'Fantasma': 14, 'Dragón': 15,
  'Siniestro': 16, 'Acero': 17, 'Hada': 18, 'Estelar': 19
};

// Cargar movimientos existentes
const movesJsonPath = path.join(ROOT, 'database', 'movimientos.json');
const moves = JSON.parse(fs.readFileSync(movesJsonPath, 'utf8'));
const moveToId = new Map();
for (const m of moves) {
  if (m.nombre_ingles) {
    moveToId.set(toID(m.nombre_ingles), m.id);
  }
}

console.log(`Cargados ${moves.length} movimientos de referencia.`);

// Cargar sets predeterminados de combates desde anexos
const randomBattleFiles = [
  path.join(ROOT, 'anexos', 'pokemon-showdown', 'data', 'random-battles', 'gen9', 'sets.json'),
  path.join(ROOT, 'anexos', 'pokemon-showdown', 'data', 'random-battles', 'gen9baby', 'sets.json'),
  path.join(ROOT, 'anexos', 'pokemon-showdown', 'data', 'random-battles', 'gen8', 'sets.json'),
  path.join(ROOT, 'anexos', 'pokemon-showdown', 'data', 'random-battles', 'gen7', 'sets.json'),
  path.join(ROOT, 'anexos', 'pokemon-showdown', 'data', 'random-battles', 'gen6', 'sets.json'),
  path.join(ROOT, 'anexos', 'pokemon-showdown', 'data', 'random-battles', 'gen5', 'sets.json'),
  path.join(ROOT, 'anexos', 'pokemon-showdown', 'data', 'random-battles', 'gen4', 'sets.json'),
  path.join(ROOT, 'anexos', 'pokemon-showdown', 'data', 'random-battles', 'gen3', 'sets.json'),
  path.join(ROOT, 'anexos', 'pokemon-showdown', 'data', 'random-battles', 'gen2', 'sets.json'),
  path.join(ROOT, 'anexos', 'pokemon-showdown', 'data', 'random-battles', 'gen1', 'data.json'),
  path.join(ROOT, 'anexos', 'pokemon-showdown', 'data', 'random-battles', 'gen7letsgo', 'data.json'),
  path.join(ROOT, 'anexos', 'pokemon-showdown', 'data', 'random-battles', 'gen8bdsp', 'data.json'),
];

const poolBySpecies = new Map();
for (const file of randomBattleFiles) {
  if (!fs.existsSync(file)) continue;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [spId, val] of Object.entries(data)) {
      const cleanId = toID(spId);
      if (poolBySpecies.has(cleanId)) continue;
      const movesList = [];
      if (Array.isArray(val.sets)) {
        for (const s of val.sets) {
          if (Array.isArray(s.movepool)) {
            for (const m of s.movepool) {
              const mId = moveToId.get(toID(m));
              if (mId && !movesList.includes(mId)) movesList.push(mId);
            }
          }
        }
      } else if (Array.isArray(val.moves)) {
        for (const m of val.moves) {
          const mId = moveToId.get(toID(m));
          if (mId && !movesList.includes(mId)) movesList.push(mId);
        }
        if (Array.isArray(val.essentialMoves)) {
          for (const m of val.essentialMoves) {
            const mId = moveToId.get(toID(m));
            if (mId && !movesList.includes(mId)) movesList.push(mId);
          }
        }
      }
      if (movesList.length > 0) {
        poolBySpecies.set(cleanId, movesList);
      }
    }
  } catch (err) {
    console.warn(`Error leyendo archivo de sets ${file}:`, err.message);
  }
}

// Cargar sets de alquiler oficiales de Pokémon Stadium 1
const stadiumRulesPath = path.join(ROOT, 'anexos', 'pokemon-showdown', 'data', 'mods', 'gen1stadium', 'rulesets.ts');
const stadiumRentals = new Map();
if (fs.existsSync(stadiumRulesPath)) {
  const stadiumText = fs.readFileSync(stadiumRulesPath, 'utf8');
  const regex = /case\s+'([^']+)':[\s\S]*?set\.moves\s*=\s*\[(.*?)\];/g;
  let match;
  while ((match = regex.exec(stadiumText)) !== null) {
    const spName = toID(match[1]);
    const movesStr = match[2];
    const moveMatches = movesStr.match(/'([^']+)'/g);
    if (moveMatches) {
      const ids = moveMatches
        .map(m => moveToId.get(toID(m.replace(/'/g, ''))))
        .filter(Boolean);
      if (ids.length > 0) {
        stadiumRentals.set(spName, ids);
      }
    }
  }
}

console.log(`Cargados ${poolBySpecies.size} sets competitivos y ${stadiumRentals.size} sets de Pokémon Stadium.`);

function get4DefaultMoves(key, baseKey, availableMoveIds) {
  const cleanKey = toID(key);
  const cleanBase = toID(baseKey || '');

  let chosen = [];

  // 1. Prioridad: Sets competitivos oficiales de Showdown (Gen 9 -> Gen 1 / LC)
  if (poolBySpecies.has(cleanKey)) {
    chosen = poolBySpecies.get(cleanKey).slice(0, 4);
  } else if (cleanBase && poolBySpecies.has(cleanBase)) {
    chosen = poolBySpecies.get(cleanBase).slice(0, 4);
  }

  // 2. Prioridad: Sets oficiales de alquiler de Pokémon Stadium
  if (chosen.length < 4) {
    if (stadiumRentals.has(cleanKey)) {
      for (const mId of stadiumRentals.get(cleanKey)) {
        if (!chosen.includes(mId)) chosen.push(mId);
        if (chosen.length === 4) break;
      }
    } else if (cleanBase && stadiumRentals.has(cleanBase)) {
      for (const mId of stadiumRentals.get(cleanBase)) {
        if (!chosen.includes(mId)) chosen.push(mId);
        if (chosen.length === 4) break;
      }
    }
  }

  // 3. Prioridad: Movimientos aprendidos por nivel más altos y recientes en Learnsets
  if (chosen.length < 4) {
    const ls = (Learnsets[key] && Learnsets[key].learnset) || (cleanBase && Learnsets[cleanBase] && Learnsets[cleanBase].learnset) || {};
    const levelMoves = [];
    for (const [mName, sources] of Object.entries(ls)) {
      const mId = moveToId.get(mName);
      if (!mId) continue;
      let maxGen = 0, maxLvl = 0, isLevel = false;
      for (const s of sources) {
        const m = s.match(/^([0-9])([A-Z])([0-9]*)$/);
        if (m) {
          const gen = parseInt(m[1], 10);
          const type = m[2];
          const lvl = parseInt(m[3], 10) || 1;
          if (type === 'L') {
            isLevel = true;
            if (gen > maxGen || (gen === maxGen && lvl > maxLvl)) {
              maxGen = gen;
              maxLvl = lvl;
            }
          }
        }
      }
      if (isLevel) {
        levelMoves.push({ id: mId, gen: maxGen, lvl: maxLvl });
      }
    }

    // Ordenar por generación descendente y nivel descendente
    levelMoves.sort((a, b) => b.gen - a.gen || b.lvl - a.lvl);
    for (const lm of levelMoves) {
      if (!chosen.includes(lm.id)) chosen.push(lm.id);
      if (chosen.length === 4) break;
    }
  }

  // 4. Fallback final: completar con los movimientos aprendidos disponibles del Pokémon
  if (chosen.length < 4 && Array.isArray(availableMoveIds)) {
    for (const mId of availableMoveIds) {
      if (!chosen.includes(mId)) chosen.push(mId);
      if (chosen.length === 4) break;
    }
  }

  return chosen;
}

const pokemonList = [];
let serialId = 1;

for (const [key, p] of Object.entries(Pokedex)) {
  if (!p.num || p.num <= 0 || p.num > 1025) continue;

  const name = p.name;
  const forme = p.forme || '';

  // 1. ELIMINAR MEGAS Y GIGAMAX
  const isMega = forme.toLowerCase().startsWith('mega') || name.includes('-Mega') || name.startsWith('Mega-');
  const isGmax = forme.toLowerCase() === 'gmax' || name.endsWith('-Gmax');
  if (isMega || isGmax) continue;

  // 2. ELIMINAR TOTEMS
  if (forme.toLowerCase().includes('totem') || name.includes('Totem')) continue;

  // 3. ELIMINAR VARIANTES COSMÉTICAS, GORRAS, STARTERS Y COMBATE
  if (p.num === 25 && key !== 'pikachu') continue;
  if (p.num === 133 && key !== 'eevee') continue;
  if (p.num === 172 && key !== 'pichu') continue;

  // 4. FORMAS REGIONALES OFICIALES (Alola, Galar, Hisui, Paldea)
  const isAlola = forme.toLowerCase().includes('alola') || name.includes('-Alola');
  const isGalar = forme.toLowerCase().includes('galar') || name.includes('-Galar');
  const isHisui = forme.toLowerCase().includes('hisui') || name.includes('-Hisui');
  const isPaldea = forme.toLowerCase().includes('paldea') || name.includes('-Paldea');
  const isRegional = isAlola || isGalar || isHisui || isPaldea;

  if (name.includes('Darmanitan-Galar-Zen')) continue;
  if (name.includes('Pikachu-Alola')) continue;

  // Si tiene forma o especie base pero NO es una forma regional oficial, excluirla
  // (evita formas alternativas de combate de Castform, Rotom, Arceus, etc.)
  if ((p.forme || p.baseSpecies) && !isRegional) {
    continue;
  }

  // 5. ASIGNACIÓN CORRECTA Y REAL DE GENERACIONES
  let gen = 1;
  if (isAlola) {
    gen = 7;
  } else if (isGalar || isHisui) {
    gen = 8;
  } else if (isPaldea) {
    gen = 9;
  } else {
    if (p.num <= 151) gen = 1;
    else if (p.num <= 251) gen = 2;
    else if (p.num <= 386) gen = 3;
    else if (p.num <= 493) gen = 4;
    else if (p.num <= 649) gen = 5;
    else if (p.num <= 721) gen = 6;
    else if (p.num <= 809) gen = 7;
    else if (p.num <= 905) gen = 8;
    else gen = 9;
  }

  const baseKey = p.baseSpecies ? toID(p.baseSpecies) : key;
  const ls = (Learnsets[key] && Learnsets[key].learnset) || (Learnsets[baseKey] && Learnsets[baseKey].learnset) || {};

  const moveIdsSet = new Set();
  for (const moveName of Object.keys(ls)) {
    const mId = moveToId.get(moveName);
    if (mId) {
      moveIdsSet.add(mId);
    }
  }

  const availableMoves = Array.from(moveIdsSet).sort((a, b) => a - b);
  const defaultMoves = get4DefaultMoves(key, p.baseSpecies, availableMoves);

  const typesEn = p.types || ['Normal'];
  const typesEs = typesEn.map(t => TYPE_TRANSLATIONS[t] || t);
  const tipo1Id = TYPE_NAME_TO_ID[typesEs[0]] || 1;
  const tipo2Id = typesEs[1] ? (TYPE_NAME_TO_ID[typesEs[1]] || null) : null;

  const bs = p.baseStats || { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 };
  const total = (bs.hp || 0) + (bs.atk || 0) + (bs.def || 0) + (bs.spa || 0) + (bs.spd || 0) + (bs.spe || 0);

  const abilities = [];
  if (p.abilities) {
    for (const val of Object.values(p.abilities)) {
      if (val && !abilities.includes(val)) abilities.push(val);
    }
  }

  const entry = {
    id: key,
    db_id: serialId++,
    num: p.num,
    name: p.name,
    nombre_ingles: p.name,
    gen: gen,
    types: typesEs,
    types_en: typesEn,
    tipo1_id: tipo1Id,
    tipo2_id: tipo2Id,
    stats: {
      hp: bs.hp || 0,
      atk: bs.atk || 0,
      def: bs.def || 0,
      spa: bs.spa || 0,
      spd: bs.spd || 0,
      spe: bs.spe || 0,
      total: total
    },
    heightm: p.heightm || 0,
    weightkg: p.weightkg || 0,
    color: p.color || 'White',
    abilities: abilities,
    movimientos_predeterminados: defaultMoves,
    moves: availableMoves
  };

  pokemonList.push(entry);
}

// Ordenar por número y nombre
pokemonList.sort((a, b) => {
  if (a.num !== b.num) return a.num - b.num;
  return a.name.localeCompare(b.name);
});

// Reasignar db_id consecutivos
pokemonList.forEach((p, index) => {
  p.db_id = index + 1;
});

console.log(`Procesados ${pokemonList.length} Pokémon.`);

// Guardar database/pokemon.json
const jsonDest = path.join(ROOT, 'database', 'pokemon.json');
fs.writeFileSync(jsonDest, JSON.stringify(pokemonList, null, 2), 'utf8');
console.log(`Guardado ${jsonDest}`);

// Guardar js/pokemon_data.js minificado para el frontend del navegador
const jsDest = path.join(ROOT, 'js', 'pokemon_data.js');
const jsContent = `/**
 * BASE DE DATOS DE POKÉMON - POKÉMON STADIUM WORLD
 * Total Pokémon: ${pokemonList.length}
 */
window.POKEMON_DATA = ${JSON.stringify(pokemonList)};
`;
fs.writeFileSync(jsDest, jsContent, 'utf8');
console.log(`Guardado ${jsDest} (${(fs.statSync(jsDest).size / 1024).toFixed(1)} KB)`);
