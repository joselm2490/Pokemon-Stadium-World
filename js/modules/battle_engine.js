// ====================================================================
// MOTOR DE COMBATE POR TURNOS OFICIAL POKÉMON STADIUM / SHOWDOWN
// Sincronizado en tiempo real para 2 jugadores en Supabase / LocalStorage
// ====================================================================

class StadiumBattleEngine {
  // Traducir nombre de tipo en español a inglés para consultar el TypeChart de Showdown
  static TYPE_TO_EN = {
    'Acero': 'Steel', 'Agua': 'Water', 'Bicho': 'Bug', 'Dragón': 'Dragon',
    'Eléctrico': 'Electric', 'Fantasma': 'Ghost', 'Fuego': 'Fire', 'Hada': 'Fairy',
    'Hielo': 'Ice', 'Lucha': 'Fighting', 'Normal': 'Normal', 'Planta': 'Grass',
    'Psíquico': 'Psychic', 'Roca': 'Rock', 'Siniestro': 'Dark', 'Tierra': 'Ground',
    'Veneno': 'Poison', 'Volador': 'Flying', 'Estelar': 'Stellar'
  };

  static getTypeEffectiveness(moveType, targetTypes) {
    if (!window.SHOWDOWN_TYPECHART) return 1.0;
    const moveEn = this.TYPE_TO_EN[moveType] || moveType;
    let multiplier = 1.0;

    for (const t of (targetTypes || [])) {
      const targetEn = (this.TYPE_TO_EN[t] || t).toLowerCase();
      const chartEntry = window.SHOWDOWN_TYPECHART[targetEn];
      if (chartEntry && chartEntry.damageTaken && chartEntry.damageTaken[moveEn] !== undefined) {
        const dt = chartEntry.damageTaken[moveEn];
        if (dt === 1) multiplier *= 2.0;       // Super eficaz
        else if (dt === 2) multiplier *= 0.5;  // No muy eficaz
        else if (dt === 3) multiplier *= 0.0;  // Inmune
      }
    }
    return multiplier;
  }

  // Inicializar estado de combate completo para la sala
  static initBattleState(room) {
    const players = room.jugadores || [];
    if (players.length < 2) return null;

    const p1 = players[0];
    const p2 = players[1];

    function setupCombatant(p) {
      const team = (p.equipo_pokemon || []).map((poke, idx) => {
        const hpStat = (poke.stats && poke.stats.hp) ? poke.stats.hp : 100;
        // Fórmula estándar de HP a nivel 50: floor((2 * base + 31 + floor(85/4)) * 50 / 100) + 50 + 10
        const maxHp = Math.floor((2 * hpStat + 31) * 50 / 100) + 60;
        return {
          id: poke.id || (idx + 1),
          num: poke.num,
          name: poke.name,
          types: poke.types || ['Normal'],
          stats: poke.stats || { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
          maxHp: maxHp,
          currentHp: maxHp,
          movimientos: (poke.movimientos || []).map(m => ({
            id: m.id,
            nombre: m.nombre || m.name,
            nombre_ingles: m.nombre_ingles || m.name || m.nombre,
            tipo: m.tipo || m.type || 'Normal',
            categoria: m.categoria || m.category || 'Físico',
            potencia: m.potencia !== undefined ? m.potencia : 60,
            precision: m.precision !== undefined ? m.precision : 100,
            pp: m.pp || 15,
            maxPp: m.pp || 15
          })),
          fainted: false
        };
      });

      return {
        apodo: p.apodo,
        es_anfitrion: !!p.es_anfitrion,
        team: team,
        activeIndex: 0,
        pendingAction: null // { type: 'move'|'switch', moveIndex: 0, targetPokemonIndex: 0 }
      };
    }

    return {
      turn: 1,
      phase: 'awaiting_actions', // 'awaiting_actions', 'resolving_turn', 'finished'
      winner: null,
      p1: setupCombatant(p1),
      p2: setupCombatant(p2),
      logs: [
        `⚔️ ¡Comienza el combate en la Arena Stadium!`,
        `👑 ${p1.apodo} envía a ${p1.equipo_pokemon[0]?.name || 'Pokémon'}!`,
        `🎮 ${p2.apodo} envía a ${p2.equipo_pokemon[0]?.name || 'Pokémon'}!`
      ]
    };
  }

  // Calcular daño usando la fórmula oficial de Pokémon Showdown
  static calculateDamage(attacker, defender, move) {
    const level = 50;
    const cat = (move.categoria || '').toLowerCase();
    const isSpecial = cat.includes('esp') || cat.includes('spec');
    const isStatus = cat.includes('est') || cat.includes('stat');

    if (isStatus || move.potencia === null || move.potencia === 0) {
      return { damage: 0, isStatus: true, eff: 1.0, isCrit: false };
    }

    const A = isSpecial ? (attacker.stats.spa || 100) : (attacker.stats.atk || 100);
    const D = isSpecial ? (defender.stats.spd || 100) : (defender.stats.def || 100);
    const power = move.potencia || 60;

    let base = Math.floor(Math.floor((Math.floor((2 * level) / 5 + 2) * power * A) / D) / 50) + 2;

    // STAB (Same Type Attack Bonus) = 1.5x
    const atkTypes = attacker.types || [];
    if (atkTypes.includes(move.tipo)) {
      base = Math.floor(base * 1.5);
    }

    // Efectividad por tipos
    const eff = this.getTypeEffectiveness(move.tipo, defender.types);
    base = Math.floor(base * eff);

    // Golpe crítico (aprox. 1/16 prob)
    const isCrit = Math.random() < 0.0625;
    if (isCrit) {
      base = Math.floor(base * 1.5);
    }

    // Variación aleatoria (0.85 a 1.00)
    const roll = 0.85 + Math.random() * 0.15;
    const finalDamage = Math.max(1, Math.floor(base * roll));

    return { damage: finalDamage, isStatus: false, eff, isCrit };
  }

  // Ejecutar turno cuando ambos jugadores hayan enviado su acción
  static resolveTurn(battleState) {
    if (!battleState || battleState.phase === 'finished') return battleState;

    const p1 = battleState.p1;
    const p2 = battleState.p2;
    const p1Active = p1.team[p1.activeIndex];
    const p2Active = p2.team[p2.activeIndex];

    const logs = [`--- Turno ${battleState.turn} ---`];
    const showdownCommands = [`|turn|${battleState.turn}`];

    // Manejo de cambios de Pokémon (prioridad máxima antes que movimientos)
    if (p1.pendingAction?.type === 'switch') {
      p1.activeIndex = p1.pendingAction.targetIndex;
      const swPoke = p1.team[p1.activeIndex];
      logs.push(`🔄 ${p1.apodo} retira a su Pokémon y envía a ${swPoke.name}!`);
      showdownCommands.push(`|switch|p1a: ${swPoke.name}|${swPoke.name}|${swPoke.currentHp}/${swPoke.maxHp}`);
    }
    if (p2.pendingAction?.type === 'switch') {
      p2.activeIndex = p2.pendingAction.targetIndex;
      const swPoke = p2.team[p2.activeIndex];
      logs.push(`🔄 ${p2.apodo} retira a su Pokémon y envía a ${swPoke.name}!`);
      showdownCommands.push(`|switch|p2a: ${swPoke.name}|${swPoke.name}|${swPoke.currentHp}/${swPoke.maxHp}`);
    }

    const currentP1 = p1.team[p1.activeIndex];
    const currentP2 = p2.team[p2.activeIndex];

    // Determinar orden de movimientos según Velocidad (Spe)
    const p1Spe = currentP1.stats?.spe || 100;
    const p2Spe = currentP2.stats?.spe || 100;
    const p1First = p1Spe > p2Spe ? true : (p1Spe < p2Spe ? false : Math.random() < 0.5);

    const firstCombatant = p1First ? { player: p1, poke: currentP1, oppPlayer: p2, oppPoke: currentP2, action: p1.pendingAction, sideId: 'p1a', oppSideId: 'p2a' } 
                                  : { player: p2, poke: currentP2, oppPlayer: p1, oppPoke: currentP1, action: p2.pendingAction, sideId: 'p2a', oppSideId: 'p1a' };
    const secondCombatant = p1First ? { player: p2, poke: currentP2, oppPlayer: p1, oppPoke: currentP1, action: p2.pendingAction, sideId: 'p2a', oppSideId: 'p1a' } 
                                   : { player: p1, poke: currentP1, oppPlayer: p2, oppPoke: currentP2, action: p1.pendingAction, sideId: 'p1a', oppSideId: 'p2a' };

    function executeMove(att, def) {
      if (att.poke.fainted || def.poke.fainted) return;
      if (!att.action || att.action.type !== 'move') return;

      const move = att.poke.movimientos[att.action.moveIndex];
      if (!move) return;

      // Disminuir PP
      if (move.pp > 0) move.pp--;

      const showdownMoveName = move.nombre_ingles || move.nombre;
      logs.push(`💥 ¡${att.poke.name} de ${att.player.apodo} usa ${move.nombre}!`);
      showdownCommands.push(`|move|${att.sideId}: ${att.poke.name}|${showdownMoveName}|${def.sideId}: ${def.poke.name}`);

      // Verificar precisión
      const acc = move.precision || 100;
      if (acc < 100 && Math.random() * 100 > acc) {
        logs.push(`💨 ¡El ataque de ${att.poke.name} ha fallado!`);
        showdownCommands.push(`|-miss|${att.sideId}: ${att.poke.name}`);
        return;
      }

      const res = StadiumBattleEngine.calculateDamage(att.poke, def.poke, move);

      if (res.isStatus) {
        logs.push(`✨ ¡${move.nombre} surte efecto en el campo de batalla!`);
        return;
      }

      if (res.eff === 0) {
        logs.push(`🛡️ No afecta a ${def.poke.name}...`);
        showdownCommands.push(`|-immune|${def.sideId}: ${def.poke.name}`);
        return;
      }

      def.poke.currentHp = Math.max(0, def.poke.currentHp - res.damage);
      showdownCommands.push(`|-damage|${def.sideId}: ${def.poke.name}|${def.poke.currentHp}/${def.poke.maxHp}`);

      if (res.isCrit) {
        logs.push(`🎯 ¡Un golpe crítico!`);
        showdownCommands.push(`|-crit|${def.sideId}: ${def.poke.name}`);
      }
      if (res.eff > 1.0) {
        logs.push(`🔥 ¡Es súper eficaz! (-${res.damage} PS)`);
        showdownCommands.push(`|-supereffective|${def.sideId}: ${def.poke.name}`);
      } else if (res.eff < 1.0) {
        logs.push(`🍃 No es muy eficaz... (-${res.damage} PS)`);
        showdownCommands.push(`|-resisted|${def.sideId}: ${def.poke.name}`);
      } else {
        logs.push(`💥 Ha causado ${res.damage} puntos de daño a ${def.poke.name}.`);
      }

      if (def.poke.currentHp <= 0) {
        def.poke.fainted = true;
        logs.push(`💀 ¡${def.poke.name} de ${def.player.apodo} se ha debilitado!`);
        showdownCommands.push(`|faint|${def.sideId}: ${def.poke.name}`);

        // Auto-cambiar al siguiente disponible en el equipo del defensor
        const nextIdx = def.player.team.findIndex(p => !p.fainted);
        if (nextIdx !== -1) {
          def.player.activeIndex = nextIdx;
          const nextPoke = def.player.team[nextIdx];
          logs.push(`👉 ${def.player.apodo} envía a combatir a ${nextPoke.name}!`);
          showdownCommands.push(`|switch|${def.sideId}: ${nextPoke.name}|${nextPoke.name}|${nextPoke.currentHp}/${nextPoke.maxHp}`);
        }
      }
    }

    executeMove(firstCombatant, secondCombatant);
    executeMove(secondCombatant, firstCombatant);

    // Limpiar acciones pendientes
    p1.pendingAction = null;
    p2.pendingAction = null;

    // Verificar condición de victoria
    const p1AllFainted = p1.team.every(p => p.fainted);
    const p2AllFainted = p2.team.every(p => p.fainted);

    if (p1AllFainted && p2AllFainted) {
      battleState.phase = 'finished';
      battleState.winner = 'Empate';
      logs.push(`🏆 ¡Ambos entrenadores han quedado sin Pokémon! ¡El combate termina en EMPATE!`);
      showdownCommands.push(`|tie`);
    } else if (p2AllFainted) {
      battleState.phase = 'finished';
      battleState.winner = p1.apodo;
      logs.push(`🏆 ¡Todos los Pokémon de ${p2.apodo} se han debilitado! ¡${p1.apodo} GANA EL COMBATE!`);
      showdownCommands.push(`|win|${p1.apodo}`);
    } else if (p1AllFainted) {
      battleState.phase = 'finished';
      battleState.winner = p2.apodo;
      logs.push(`🏆 ¡Todos los Pokémon de ${p1.apodo} se han debilitado! ¡${p2.apodo} GANA EL COMBATE!`);
      showdownCommands.push(`|win|${p2.apodo}`);
    } else {
      battleState.turn++;
    }

    battleState.logs.push(...logs);
    battleState.latestCommands = showdownCommands;
    return battleState;
  }
}

if (typeof window !== 'undefined') {
  window.StadiumBattleEngine = StadiumBattleEngine;
}
