// ====================================================================
// MOTOR DE COMBATE OFICIAL GBA RED (Radical Red / CFRU)
// Cero Showdown - 100% Datos y Reglas Matemáticas de la ROM red
// ====================================================================

class GBABattleEngine {
  static typeChart = null;
  static movesData = null;
  static speciesMapping = null;

  static async init() {
    if (this.typeChart && this.movesData) return;
    try {
      const [tcRes, movesRes, specRes] = await Promise.all([
        fetch('/assets/gba/data/type_chart.json'),
        fetch('/assets/gba/data/battle_moves.json'),
        fetch('/assets/gba/data/species_mapping.json')
      ]);
      
      const tcList = await tcRes.json();
      this.typeChart = {};
      for (const entry of tcList) {
        if (!this.typeChart[entry.attacker]) this.typeChart[entry.attacker] = {};
        this.typeChart[entry.attacker][entry.defender] = entry.multiplier;
      }

      this.movesData = await movesRes.json();
      this.speciesMapping = await specRes.json();
      console.log('⚔️ GBABattleEngine: Datos oficiales cargados.');
    } catch (e) {
      console.error('Error inicializando GBABattleEngine:', e);
    }
  }

  static getSpriteUrl(pokemonName, isBack = false) {
    if (!pokemonName) return isBack ? '/assets/gba/pokemon/species_0001/back.png' : '/assets/gba/pokemon/species_0001/front.png';
    const rawKey = pokemonName.toLowerCase().trim();
    const cleanKey = rawKey.replace(/[^a-z0-9]/g, '');
    let numStr = '0001';
    if (this.speciesMapping) {
      if (this.speciesMapping[cleanKey]) {
        numStr = this.speciesMapping[cleanKey];
      } else if (this.speciesMapping[rawKey]) {
        numStr = this.speciesMapping[rawKey];
      }
    }
    const side = isBack ? 'back.png' : 'front.png';
    return `/assets/gba/pokemon/species_${numStr}/${side}`;
  }

  static getTypeEffectiveness(atkType, defTypes) {
    if (!this.typeChart) return 1.0;
    const normAtk = (atkType || 'NORMAL').toUpperCase();
    let mult = 1.0;
    for (const d of (defTypes || [])) {
      const normDef = d.toUpperCase();
      if (this.typeChart[normAtk] && this.typeChart[normAtk][normDef] !== undefined) {
        mult *= this.typeChart[normAtk][normDef];
      }
    }
    return mult;
  }

  static getStatMultiplier(stage = 0) {
    const s = Math.max(-6, Math.min(6, stage));
    return s >= 0 ? (2 + s) / 2.0 : 2.0 / (2 - s);
  }

  // Fórmula Oficial Radical Red / CFRU Gen 8
  static calculateDamage(attacker, defender, move, isCritical = false) {
    if (!move || move.power === 0) {
      return { damage: 0, mult: 1.0, isCritical: false };
    }

    const level = attacker.level || 50;
    const power = move.power;
    const split = (move.split || 'PHYSICAL').toUpperCase();

    let atkStat = 100;
    let defStat = 100;

    const atkStages = attacker.stages || {};
    const defStages = defender.stages || {};

    if (split === 'PHYSICAL') {
      atkStat = (attacker.stats?.attack || 100) * this.getStatMultiplier(atkStages.attack || 0);
      defStat = (defender.stats?.defense || 100) * this.getStatMultiplier(defStages.defense || 0);
      if (attacker.status === 'BURN') atkStat *= 0.5;
    } else {
      atkStat = (attacker.stats?.sp_attack || attacker.stats?.special_attack || 100) * this.getStatMultiplier(atkStages.sp_attack || 0);
      defStat = (defender.stats?.sp_defense || defender.stats?.special_defense || 100) * this.getStatMultiplier(defStages.sp_defense || 0);
    }

    let baseDmg = (((2 * level / 5 + 2) * power * (atkStat / Math.max(1, defStat))) / 50) + 2;

    if (isCritical) {
      baseDmg *= 1.5;
    }

    // Variación aleatoria GBA: 85% a 100%
    const randMult = (Math.floor(Math.random() * 16) + 85) / 100.0;
    baseDmg *= randMult;

    // STAB
    const moveType = (move.type_name || move.type || 'NORMAL').toUpperCase();
    const attackerTypes = (attacker.types || []).map(t => t.toUpperCase());
    if (attackerTypes.includes(moveType)) {
      baseDmg *= 1.5;
    }

    // Efectividad de tipo
    const defTypes = (defender.types || []).map(t => t.toUpperCase());
    const mult = this.getTypeEffectiveness(moveType, defTypes);
    baseDmg *= mult;

    return {
      damage: Math.max(1, Math.floor(baseDmg)),
      mult,
      isCritical
    };
  }

  // Resolver orden de turnos por prioridad y velocidad
  static resolveTurnOrder(actionA, actionB) {
    if (actionA.priority !== actionB.priority) {
      return actionA.priority > actionB.priority ? [actionA, actionB] : [actionB, actionA];
    }
    if (actionA.speed !== actionB.speed) {
      return actionA.speed > actionB.speed ? [actionA, actionB] : [actionB, actionA];
    }
    return Math.random() < 0.5 ? [actionA, actionB] : [actionB, actionA];
  }
}

// Exportar globalmente
window.GBABattleEngine = GBABattleEngine;

// Compatibilidad con la arquitectura de salas
class StadiumBattleEngine {
  static initBattleState(room) {
    const players = room.jugadores || [];
    if (players.length < 2) return null;

    const p1 = players[0];
    const p2 = players[1];

    function setupCombatant(p) {
      const team = (p.equipo_pokemon || []).map((poke, idx) => {
        const hpStat = (poke.stats && poke.stats.hp) ? poke.stats.hp : 100;
        const maxHp = Math.floor((2 * hpStat + 31) * 50 / 100) + 60;
        return {
          id: poke.id || (idx + 1),
          num: poke.num,
          name: poke.name,
          types: poke.types || ['Normal'],
          stats: poke.stats || { hp: maxHp, attack: 100, defense: 100, sp_attack: 100, sp_defense: 100, speed: 100 },
          maxHp: maxHp,
          currentHp: maxHp,
          level: 50,
          status: null,
          stages: { attack: 0, defense: 0, sp_attack: 0, sp_defense: 0, speed: 0 },
          moves: (poke.movimientos && poke.movimientos.length > 0) ? poke.movimientos.map(m => ({
            name: m.nombre_ingles || m.nombre,
            power: m.potencia || 0,
            type: m.tipo || 'Normal',
            split: m.clase === 'Especial' ? 'SPECIAL' : 'PHYSICAL',
            pp: m.pp || 20,
            currentPp: m.pp || 20,
            priority: 0
          })) : [
            { name: 'Tackle', power: 40, type: 'Normal', split: 'PHYSICAL', pp: 35, currentPp: 35, priority: 0 },
            { name: 'Quick Attack', power: 40, type: 'Normal', split: 'PHYSICAL', pp: 30, currentPp: 30, priority: 1 }
          ]
        };
      });

      return {
        apodo: p.apodo,
        team: team,
        activeIndex: 0,
        pendingAction: null
      };
    }

    return {
      turn: 1,
      phase: 'turn_in_progress',
      winner: null,
      logs: [`¡Comienza la batalla entre ${p1.apodo} y ${p2.apodo}!`],
      p1: setupCombatant(p1),
      p2: setupCombatant(p2)
    };
  }

  static resolveTurn(bs) {
    if (!bs || !bs.p1 || !bs.p2) return;

    const p1 = bs.p1;
    const p2 = bs.p2;
    const a1 = p1.pendingAction || { type: 'move', moveIndex: 0 };
    const a2 = p2.pendingAction || { type: 'move', moveIndex: 0 };

    const poke1 = p1.team[p1.activeIndex || 0];
    const poke2 = p2.team[p2.activeIndex || 0];

    // Resolver cambios de Pokémon primero
    if (a1.type === 'switch') {
      p1.activeIndex = a1.targetIndex;
      bs.logs.push(`¡${p1.apodo} cambió a ${p1.team[p1.activeIndex].name}!`);
    }
    if (a2.type === 'switch') {
      p2.activeIndex = a2.targetIndex;
      bs.logs.push(`¡${p2.apodo} cambió a ${p2.team[p2.activeIndex].name}!`);
    }

    // Resolver movimientos
    const moveActions = [];
    if (a1.type === 'move') {
      const m1 = poke1.moves[a1.moveIndex] || poke1.moves[0];
      moveActions.push({ actor: 'p1', user: p1, poke: poke1, target: p2, targetPoke: poke2, move: m1, speed: poke1.stats.speed, priority: m1.priority || 0 });
    }
    if (a2.type === 'move') {
      const m2 = poke2.moves[a2.moveIndex] || poke2.moves[0];
      moveActions.push({ actor: 'p2', user: p2, poke: poke2, target: p1, targetPoke: poke1, move: m2, speed: poke2.stats.speed, priority: m2.priority || 0 });
    }

    if (moveActions.length === 2) {
      const [first, second] = GBABattleEngine.resolveTurnOrder(moveActions[0], moveActions[1]);
      this._applyMoveAction(first, bs);
      if (first.targetPoke.currentHp > 0) {
        this._applyMoveAction(second, bs);
      }
    } else if (moveActions.length === 1) {
      this._applyMoveAction(moveActions[0], bs);
    }

    // Limpiar acciones pendientes
    p1.pendingAction = null;
    p2.pendingAction = null;
    bs.turn = (bs.turn || 1) + 1;

    // Registrar eventos para la cola de animación
    bs.turnEvents = bs.turnEvents || [];

    // Verificar condición de victoria
    const p1Alive = p1.team.some(p => p.currentHp > 0);
    const p2Alive = p2.team.some(p => p.currentHp > 0);

    if (!p1Alive && !p2Alive) {
      bs.phase = 'finished';
      bs.winner = 'Empate';
      bs.logs.push('¡Todos los Pokémon se han debilitado! ¡Empate!');
      bs.turnEvents.push({ type: 'finish', winner: 'Empate', message: '¡Todos los Pokémon se han debilitado! ¡Empate!' });
    } else if (!p1Alive) {
      bs.phase = 'finished';
      bs.winner = p2.apodo;
      bs.logs.push(`¡${p1.apodo} no tiene más Pokémon! ¡${p2.apodo} gana el combate!`);
      bs.turnEvents.push({ type: 'finish', winner: p2.apodo, message: `¡${p1.apodo} no tiene más Pokémon! ¡${p2.apodo} gana!` });
    } else if (!p2Alive) {
      bs.phase = 'finished';
      bs.winner = p1.apodo;
      bs.logs.push(`¡${p2.apodo} no tiene más Pokémon! ¡${p1.apodo} gana el combate!`);
      bs.turnEvents.push({ type: 'finish', winner: p1.apodo, message: `¡${p2.apodo} no tiene más Pokémon! ¡${p1.apodo} gana!` });
    }
  }

  static _applyMoveAction(action, bs) {
    const { actor, user, poke, target, targetPoke, move } = action;
    bs.turnEvents = bs.turnEvents || [];

    bs.logs.push(`¡${poke.name} de ${user.apodo} usó ${move.name}!`);
    bs.turnEvents.push({
      type: 'attack',
      actor: actor, // 'p1' o 'p2'
      pokeName: poke.name,
      userName: user.apodo,
      moveName: move.name,
      moveType: move.type,
      message: `¡${poke.name} de ${user.apodo} usó ${move.name}!`
    });

    const result = GBABattleEngine.calculateDamage(poke, targetPoke, move);
    const prevHp = targetPoke.currentHp;
    targetPoke.currentHp = Math.max(0, targetPoke.currentHp - result.damage);

    let effectivenessMsg = null;
    if (result.mult > 1.0) {
      effectivenessMsg = '¡Es muy eficaz!';
      bs.logs.push(effectivenessMsg);
    } else if (result.mult === 0.0) {
      effectivenessMsg = 'No tuvo ningún efecto...';
      bs.logs.push(effectivenessMsg);
    } else if (result.mult < 1.0 && result.mult > 0) {
      effectivenessMsg = 'No es muy eficaz...';
      bs.logs.push(effectivenessMsg);
    }

    bs.turnEvents.push({
      type: 'damage',
      target: actor === 'p1' ? 'p2' : 'p1',
      targetPokeName: targetPoke.name,
      damage: result.damage,
      prevHp: prevHp,
      newHp: targetPoke.currentHp,
      maxHp: targetPoke.maxHp,
      isSuperEffective: result.mult > 1.0,
      effectivenessMsg: effectivenessMsg
    });

    if (targetPoke.currentHp === 0) {
      bs.logs.push(`¡${targetPoke.name} enemigo se debilitó!`);
      bs.turnEvents.push({
        type: 'faint',
        target: actor === 'p1' ? 'p2' : 'p1',
        pokeName: targetPoke.name,
        message: `¡${targetPoke.name} se debilitó!`
      });

      // Cambio automático al siguiente disponible
      const nextIdx = target.team.findIndex(p => p.currentHp > 0);
      if (nextIdx !== -1) {
        target.activeIndex = nextIdx;
        bs.logs.push(`¡${target.apodo} envió a ${target.team[nextIdx].name}!`);
        bs.turnEvents.push({
          type: 'switch_in',
          target: actor === 'p1' ? 'p2' : 'p1',
          pokeName: target.team[nextIdx].name,
          level: target.team[nextIdx].level || 50,
          currentHp: target.team[nextIdx].currentHp,
          maxHp: target.team[nextIdx].maxHp,
          message: `¡${target.apodo} envió a ${target.team[nextIdx].name}!`
        });
      }
    }
  }
}

window.StadiumBattleEngine = StadiumBattleEngine;
