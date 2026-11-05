/**
 * Conector de Batalla Pura Pokémon Stadium World + Pokémon Showdown BattleScene
 * Controla exclusivamente:
 * 1. La animación de combate visual oficial (Battle / BattleScene de Showdown)
 * 2. La botonera interactiva de ataques y cambio de Pokémon
 * 3. La comunicación bidireccional con la ventana padre (BatallaModule / BattleRoomStore)
 */
(function() {
  function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  const userNick = (getQueryParam('user') || 'Entrenador').trim();
  const rivalNick = (getQueryParam('rival') || 'Rival').trim();
  const roomCode = (getQueryParam('room') || 'TUTORIAL').trim();
  const isHost = getQueryParam('host') === '1' || getQueryParam('host') === 'true';

  let battleInstance = null;
  let currentRoomData = null;
  let activePokemon = null;
  let isActionLocked = false;

  const TYPE_COLORS = {
    'Normal': '#A8A878', 'Fuego': '#F08030', 'Agua': '#6890F0', 'Planta': '#78C850',
    'Eléctrico': '#F8D030', 'Hielo': '#98D8D8', 'Lucha': '#C03028', 'Veneno': '#A040A0',
    'Tierra': '#E0C068', 'Volador': '#A890F0', 'Psíquico': '#F85888', 'Bicho': '#A8B820',
    'Roca': '#B8A038', 'Fantasma': '#705898', 'Dragón': '#7038F8', 'Siniestro': '#705848',
    'Acero': '#B8B8D0', 'Hada': '#EE99AC', 'Estelar': '#45C8B8'
  };

  // Redirigir recursos de efectos a Showdown oficial CDN para evitar errores 404 locales
  if (window.Dex) {
    Dex.resourcePrefix = 'https://play.pokemonshowdown.com/';
    Dex.fxPrefix = 'https://play.pokemonshowdown.com/fx/';
  }

  // Inicializar instancia de batalla pura de Showdown vinculada al DOM
  function initBattle() {
    const $frame = $('#battleStage');
    const $log = $('#battleLog');

    try {
      battleInstance = new Battle({
        id: `battle-${roomCode.toLowerCase()}`,
        $frame: $frame,
        $logFrame: $log,
        log: [
          '|player|p1|' + (isHost ? userNick : rivalNick) + '|102',
          '|player|p2|' + (isHost ? rivalNick : userNick) + '|101',
          '|teamsize|p1|3',
          '|teamsize|p2|3',
          '|gametype|singles',
          '|gen|9',
          '|tier|[Gen 9] Stadium World'
        ],
        isReplay: false,
        paused: false,
        autoresize: true
      });

      console.log('✅ [Pure Battle] Showdown BattleScene inicializado correctamente.');

      // Interceptar etiquetas flotantes de animación para garantizar traducción al español
      if (battleInstance && battleInstance.scene && typeof battleInstance.scene.resultAnim === 'function') {
        const animTranslations = {
          'Resisted': 'Resistido',
          'Super-effective': 'Súper eficaz',
          'Critical hit': 'Golpe crítico',
          'Immune': 'Inmune',
          'Missed': 'Falló',
          'Protected': 'Protegido',
          'Paralyzed': 'Paralizado',
          'Frozen': 'Congelado',
          'Asleep': 'Dormido',
          'Poisoned': 'Envenenado',
          'Burned': 'Quemado',
          'Confused': 'Confuso',
          'Flinched': 'Retrocedió',
          'Failed': 'Falló'
        };
        const origResultAnim = battleInstance.scene.resultAnim;
        battleInstance.scene.resultAnim = function(pokemon, result, type) {
          if (typeof result === 'string' && animTranslations[result]) {
            result = animTranslations[result];
          }
          return origResultAnim.call(this, pokemon, result, type);
        };
      }
    } catch (err) {
      console.error('❌ [Pure Battle] Error inicializando BattleScene:', err);
    }
  }

  // Notificar a la ventana padre que el frame está listo para recibir el estado de combate
  function notifyReady() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'pure-battle-ready', roomCode: roomCode }, '*');
    }
  }

  // Escuchar mensajes de la ventana padre (datos de sala, turnos, logs de batalla)
  window.addEventListener('message', function(ev) {
    if (!ev.data) return;
    const msg = ev.data;

    if (msg.type === 'update-battle-state') {
      console.log('📥 [Pure Battle] Mensaje update-battle-state recibido del parent:', msg.room?.battle_state?.turn);
      onBattleStateUpdated(msg.room);
    } else if (msg.type === 'stadium-forfeit-and-close') {
      if (battleInstance) {
        battleInstance.destroy();
        battleInstance = null;
      }
    }
  });

  function onBattleStateUpdated(room) {
    if (!room || !room.battle_state) return;
    currentRoomData = room;
    const bs = room.battle_state;

    // Determinar qué lado es el usuario actual
    const mySide = (bs.p1.apodo || '').toLowerCase() === userNick.toLowerCase() ? bs.p1 : bs.p2;
    const rivalSide = (bs.p1.apodo || '').toLowerCase() === userNick.toLowerCase() ? bs.p2 : bs.p1;

    // Si el turno avanzó o ya no hay acción pendiente en el estado oficial, desbloquear interacción
    if (!mySide.pendingAction) {
      isActionLocked = false;
    }

    activePokemon = mySide.team[mySide.activeIndex];
    const rivalPokemon = rivalSide.team[rivalSide.activeIndex];

    // Actualizar indicador de turno
    const turnEl = document.getElementById('turnIndicator');
    if (turnEl) turnEl.textContent = `Turno ${bs.turn}`;

    // Renderizar botones de Ataques y Relevos
    renderControls(mySide, rivalSide, bs);

    // Ocultar pantalla de carga una vez recibido el estado de la batalla
    const loader = document.getElementById('arenaLoader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => { loader.style.display = 'none'; }, 300);
    }

    // Alimentar líneas al motor visual de Showdown si hay logs nuevos
    feedLogsToShowdown(mySide, rivalSide, activePokemon, rivalPokemon, bs);
  }

  // Diccionario de traducción de tipos a nombres de clase oficiales de Showdown
  const SHOWDOWN_TYPE_CLASS = {
    'Normal': 'Normal', 'Fuego': 'Fire', 'Agua': 'Water', 'Planta': 'Grass',
    'Eléctrico': 'Electric', 'Electrico': 'Electric', 'Hielo': 'Ice', 'Lucha': 'Fighting',
    'Veneno': 'Poison', 'Tierra': 'Ground', 'Volador': 'Flying', 'Psíquico': 'Psychic',
    'Psiquico': 'Psychic', 'Bicho': 'Bug', 'Roca': 'Rock', 'Fantasma': 'Ghost',
    'Dragón': 'Dragon', 'Dragon': 'Dragon', 'Siniestro': 'Dark', 'Acero': 'Steel',
    'Hada': 'Fairy', 'Estelar': 'Stellar'
  };

  // Tabla simplificada de efectividad de tipos para el tooltip
  const TYPE_EFF_CHART = {
    'Normal': { 'Roca': 0.5, 'Fantasma': 0, 'Acero': 0.5 },
    'Fuego': { 'Fuego': 0.5, 'Agua': 0.5, 'Planta': 2, 'Hielo': 2, 'Bicho': 2, 'Roca': 0.5, 'Dragón': 0.5, 'Acero': 2 },
    'Agua': { 'Fuego': 2, 'Agua': 0.5, 'Planta': 0.5, 'Tierra': 2, 'Roca': 2, 'Dragón': 0.5 },
    'Planta': { 'Fuego': 0.5, 'Agua': 2, 'Planta': 0.5, 'Veneno': 0.5, 'Tierra': 2, 'Volador': 0.5, 'Bicho': 0.5, 'Roca': 2, 'Dragón': 0.5, 'Acero': 0.5 },
    'Eléctrico': { 'Agua': 2, 'Planta': 0.5, 'Eléctrico': 0.5, 'Tierra': 0, 'Volador': 2, 'Dragón': 0.5 },
    'Hielo': { 'Fuego': 0.5, 'Agua': 0.5, 'Planta': 2, 'Hielo': 0.5, 'Tierra': 2, 'Volador': 2, 'Dragón': 2, 'Acero': 0.5 },
    'Lucha': { 'Normal': 2, 'Hielo': 2, 'Veneno': 0.5, 'Volador': 0.5, 'Psíquico': 0.5, 'Bicho': 0.5, 'Roca': 2, 'Fantasma': 0, 'Siniestro': 2, 'Acero': 2, 'Hada': 0.5 },
    'Veneno': { 'Planta': 2, 'Veneno': 0.5, 'Tierra': 0.5, 'Roca': 0.5, 'Fantasma': 0.5, 'Acero': 0, 'Hada': 2 },
    'Tierra': { 'Fuego': 2, 'Planta': 0.5, 'Eléctrico': 2, 'Veneno': 2, 'Volador': 0, 'Bicho': 0.5, 'Roca': 2, 'Acero': 2 },
    'Volador': { 'Planta': 2, 'Eléctrico': 0.5, 'Lucha': 2, 'Bicho': 2, 'Roca': 0.5, 'Acero': 0.5 },
    'Psíquico': { 'Lucha': 2, 'Veneno': 2, 'Psíquico': 0.5, 'Siniestro': 0, 'Acero': 0.5 },
    'Bicho': { 'Fuego': 0.5, 'Planta': 2, 'Lucha': 0.5, 'Veneno': 0.5, 'Volador': 0.5, 'Fantasma': 0.5, 'Psíquico': 2, 'Siniestro': 2, 'Acero': 0.5, 'Hada': 0.5 },
    'Roca': { 'Fuego': 2, 'Hielo': 2, 'Lucha': 0.5, 'Tierra': 0.5, 'Volador': 2, 'Bicho': 2, 'Acero': 0.5 },
    'Fantasma': { 'Normal': 0, 'Psíquico': 2, 'Fantasma': 2, 'Siniestro': 0.5 },
    'Dragón': { 'Dragón': 2, 'Acero': 0.5, 'Hada': 0 },
    'Siniestro': { 'Lucha': 0.5, 'Psíquico': 2, 'Fantasma': 2, 'Siniestro': 0.5, 'Hada': 0.5 },
    'Acero': { 'Fuego': 0.5, 'Agua': 0.5, 'Eléctrico': 0.5, 'Hielo': 2, 'Roca': 2, 'Acero': 0.5, 'Hada': 2 },
    'Hada': { 'Fuego': 0.5, 'Lucha': 2, 'Veneno': 0.5, 'Dragón': 2, 'Siniestro': 2, 'Acero': 0.5 }
  };

  function getMoveEffectiveness(moveType, targetTypes) {
    if (!moveType || !targetTypes || !TYPE_EFF_CHART[moveType]) return 1.0;
    let mult = 1.0;
    targetTypes.forEach(t => {
      const chart = TYPE_EFF_CHART[moveType];
      if (chart && chart[t] !== undefined) mult *= chart[t];
    });
    return mult;
  }

  function renderControls(mySide, rivalSide, bs) {
    const movesGrid = document.getElementById('movesGrid');
    const switchesBar = document.getElementById('switchesBar');
    const promptText = document.getElementById('promptText');
    const tooltipEl = document.getElementById('moveTooltip');

    if (!movesGrid || !switchesBar) return;

    if (bs.phase === 'finished') {
      promptText.textContent = `🏆 ¡Combate terminado! Ganador: ${bs.winner}`;
      movesGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #16a34a; font-weight: 800; padding: 12px;">El duelo ha concluido.</div>`;
      switchesBar.innerHTML = '';
      if (tooltipEl) tooltipEl.style.display = 'none';
      return;
    }

    if (mySide.pendingAction || isActionLocked) {
      promptText.textContent = '⏳ Ejecutando turno... Por favor espera';
      movesGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #64748b; font-weight: 700; padding: 12px;">⚔️ Procesando acciones del turno...</div>`;
      switchesBar.innerHTML = '';
      if (tooltipEl) tooltipEl.style.display = 'none';
      return;
    }

    const currentPokeName = activePokemon ? activePokemon.name : 'tu Pokémon';
    promptText.innerHTML = `¿Qué debería hacer <strong>${currentPokeName}</strong>?`;

    const rivalActivePoke = rivalSide ? rivalSide.team[rivalSide.activeIndex] : null;

    // 1. Botones de los 4 Movimientos (con clases oficiales type-<Tipo> de sim-types.css pero etiquetas en ESPAÑOL)
    const moves = (activePokemon && activePokemon.movimientos) ? activePokemon.movimientos : [];
    movesGrid.innerHTML = moves.map((m, idx) => {
      const typeEs = m.tipo || 'Normal';
      const typeEn = SHOWDOWN_TYPE_CLASS[typeEs] || 'Normal';
      const disabled = m.pp <= 0 ? 'disabled' : '';

      return `
        <button 
          class="movemenu-btn type-${typeEn}" 
          data-move-idx="${idx}"
          ${disabled}
          onclick="window.selectMove(${idx})"
          onmouseenter="window.onMoveHover(${idx}, this)"
          onmouseleave="window.onMoveLeave()"
        >
          <div class="move-name-text">${m.nombre}</div>
          <div class="move-meta-row">
            <span class="move-meta-type">${typeEs}</span>
            <span class="move-meta-pp">${m.pp}/${m.maxPp}</span>
          </div>
        </button>
      `;
    }).join('');

    // 2. Botones de Cambiar Pokémon (Grandes, claros, con miniatura, nombre y salud)
    const team = mySide.team || [];
    const switchable = team.map((p, idx) => ({ p, idx })).filter(item => item.idx !== mySide.activeIndex);

    switchesBar.innerHTML = switchable.map(item => {
      const p = item.p;
      const isFainted = p.fainted || p.currentHp <= 0;
      const hpPercent = Math.max(0, Math.floor((p.currentHp / p.maxHp) * 100));

      // Formatear correctamente el nombre para Showdown sprites (preservando guiones de formas regionales: golem-alola, vulpix-alola, etc.)
      const nameL = (p.name || 'pikachu').toLowerCase();
      let slug = nameL.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const primaryUrl = `https://play.pokemonshowdown.com/sprites/gen5/${slug}.png`;
      const fallbackUrl = p.num ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.num}.png` : `https://play.pokemonshowdown.com/sprites/dex/${slug}.png`;

      return `
        <button 
          class="switchmenu-btn" 
          ${isFainted ? 'disabled' : ''}
          onclick="window.selectSwitch(${item.idx})"
        >
          <img src="${primaryUrl}" class="switchmenu-icon" alt="${p.name}" onerror="if(this.src!=='${fallbackUrl}'){this.src='${fallbackUrl}';}else{this.style.opacity='0';}" />
          <div class="switchmenu-info">
            <span class="switchmenu-name">${p.name}</span>
            <span class="switchmenu-hp" style="color: ${isFainted ? '#ef4444' : '#16a34a'};">
              ${isFainted ? '💀 Debilitado' : hpPercent + '% PS'}
            </span>
          </div>
        </button>
      `;
    }).join('');
  }

  // Manejador del Tooltip flotante oficial en Hover
  window.onMoveHover = function(moveIdx, btnEl) {
    const tooltipEl = document.getElementById('moveTooltip');
    if (!tooltipEl || !activePokemon || !activePokemon.movimientos) return;

    const m = activePokemon.movimientos[moveIdx];
    if (!m) return;

    const typeEs = m.tipo || 'Normal';
    const typeEn = SHOWDOWN_TYPE_CLASS[typeEs] || 'Normal';
    const cat = m.categoria || 'Físico';
    const catColor = cat.toLowerCase().includes('esp') ? '#2563eb' : (cat.toLowerCase().includes('fís') ? '#dc2626' : '#6b7280');
    const typeColor = TYPE_COLORS[typeEs] || '#71717a';

    // Determinar efectividad contra el rival actual
    const rivalPoke = currentRoomData?.battle_state ? 
      ((currentRoomData.battle_state.p1.apodo || '').toLowerCase() === userNick.toLowerCase() ? 
        currentRoomData.battle_state.p2.team[currentRoomData.battle_state.p2.activeIndex] : 
        currentRoomData.battle_state.p1.team[currentRoomData.battle_state.p1.activeIndex]) : null;

    let effHtml = '';
    if (rivalPoke && m.categoria !== 'Estado') {
      const mult = getMoveEffectiveness(typeEs, rivalPoke.types || []);
      if (mult === 0) {
        effHtml = `<div class="tooltip-eff-row" style="color: #64748b;">🛡️ Sin efecto contra ${rivalPoke.name} (0×)</div>`;
      } else if (mult >= 2.0) {
        effHtml = `<div class="tooltip-eff-row" style="color: #16a34a;">🔥 Súper eficaz contra ${rivalPoke.name} (${mult}×)</div>`;
      } else if (mult <= 0.5) {
        effHtml = `<div class="tooltip-eff-row" style="color: #dc2626;">△ Poco eficaz contra ${rivalPoke.name} (${mult}×)</div>`;
      } else {
        effHtml = `<div class="tooltip-eff-row" style="color: #475569;">Eficacia normal contra ${rivalPoke.name} (1×)</div>`;
      }
    }

    tooltipEl.innerHTML = `
      <div class="tooltip-header-row">
        <span class="tooltip-move-title">${m.nombre}</span>
        <div class="tooltip-icons-row">
          <span class="tooltip-badge" style="background: ${typeColor};">${typeEs.toUpperCase()}</span>
          <span class="tooltip-badge" style="background: ${catColor};">${cat.toUpperCase()}</span>
        </div>
      </div>
      <div class="tooltip-stats-row">
        <span>Potencia: <strong>${m.potencia ? m.potencia : '—'}</strong></span>
        <span>Precisión: <strong>${m.precision ? m.precision + '%' : '—'}</strong></span>
        <span>PP: <strong>${m.pp}/${m.maxPp}</strong></span>
      </div>
      <div class="tooltip-desc">
        ${m.descripcion || 'Sin descripción especial.'}
      </div>
      ${effHtml}
    `;

    // Posicionar tooltip encima del botón que dispara el evento
    const rect = btnEl.getBoundingClientRect();
    const parentRect = document.getElementById('battleControlsBar').getBoundingClientRect();
    tooltipEl.style.left = Math.max(8, (rect.left - parentRect.left)) + 'px';
    tooltipEl.style.display = 'block';
  };

  window.onMoveLeave = function() {
    const tooltipEl = document.getElementById('moveTooltip');
    if (tooltipEl) tooltipEl.style.display = 'none';
  };

    // Interacción de usuario: seleccionar ataque
  window.selectMove = function(moveIndex) {
    if (isActionLocked) {
      console.warn('⚠️ [Pure Battle] Acción bloqueada: ya se envió una orden para este turno.');
      return;
    }
    isActionLocked = true;

    // Deshabilitar botones de inmediato visualmente para evitar clics repetidos
    const movesGrid = document.getElementById('movesGrid');
    const switchesBar = document.getElementById('switchesBar');
    const promptText = document.getElementById('promptText');
    const tooltipEl = document.getElementById('moveTooltip');
    if (tooltipEl) tooltipEl.style.display = 'none';

    if (promptText) promptText.textContent = '⏳ Ejecutando ataque... Por favor espera';
    if (movesGrid) movesGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #64748b; font-weight: 700; padding: 12px;">⚔️ Procesando movimiento...</div>`;
    if (switchesBar) switchesBar.innerHTML = '';

    console.log('🔘 [Pure Battle] Click en movimiento:', moveIndex, 'Nombre:', activePokemon?.movimientos?.[moveIndex]?.nombre);
    if (window.parent && window.parent !== window) {
      console.log('📤 [Pure Battle] Enviando postMessage pure-battle-action (move) a parent');
      window.parent.postMessage({
        type: 'pure-battle-action',
        action: { type: 'move', moveIndex: moveIndex },
        userNick: userNick
      }, '*');
    } else {
      console.warn('⚠️ [Pure Battle] No hay window.parent para enviar la acción');
    }
  };

  // Interacción de usuario: seleccionar cambio de Pokémon
  window.selectSwitch = function(targetIndex) {
    if (isActionLocked) {
      console.warn('⚠️ [Pure Battle] Acción bloqueada: ya se envió una orden para este turno.');
      return;
    }
    isActionLocked = true;

    const movesGrid = document.getElementById('movesGrid');
    const switchesBar = document.getElementById('switchesBar');
    const promptText = document.getElementById('promptText');
    const tooltipEl = document.getElementById('moveTooltip');
    if (tooltipEl) tooltipEl.style.display = 'none';

    if (promptText) promptText.textContent = '⏳ Cambiando Pokémon... Por favor espera';
    if (movesGrid) movesGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #64748b; font-weight: 700; padding: 12px;">🔄 Realizando cambio...</div>`;
    if (switchesBar) switchesBar.innerHTML = '';

    console.log('🔘 [Pure Battle] Click en cambiar Pokémon a índice:', targetIndex);
    if (window.parent && window.parent !== window) {
      console.log('📤 [Pure Battle] Enviando postMessage pure-battle-action (switch) a parent');
      window.parent.postMessage({
        type: 'pure-battle-action',
        action: { type: 'switch', targetIndex: targetIndex },
        userNick: userNick
      }, '*');
    } else {
      console.warn('⚠️ [Pure Battle] No hay window.parent para enviar la acción');
    }
  };

  // Sincronizar logs en el visualizador y el panel lateral
  let lastLogCount = 0;
  let initialFieldSynced = false;

  function feedLogsToShowdown(mySide, rivalSide, myPoke, oppPoke, bs) {
    // Sincronización inicial exacta en el primer turno para alinear los sprites con los Pokémon del usuario
    if (battleInstance && !initialFieldSynced && myPoke && oppPoke) {
      initialFieldSynced = true;
      try {
        battleInstance.addBatch([
          `|switch|p1a: ${myPoke.name}|${myPoke.name}|${myPoke.currentHp}/${myPoke.maxHp}`,
          `|switch|p2a: ${oppPoke.name}|${oppPoke.name}|${oppPoke.currentHp}/${oppPoke.maxHp}`,
          `|turn|1`
        ]);
        console.log('✅ [Pure Battle] Sprites iniciales sincronizados en Showdown:', myPoke.name, 'vs', oppPoke.name);
      } catch (e) {
        console.warn('⚠️ [Pure Battle] Error al sincronizar sprites iniciales:', e);
      }
    }

    const logs = bs.logs || [];
    if (logs.length > lastLogCount) {
      const newLines = logs.slice(lastLogCount);
      lastLogCount = logs.length;

      const logDiv = document.getElementById('battleLog');
      if (logDiv) {
        newLines.forEach(l => {
          const p = document.createElement('div');
          p.style.marginBottom = '6px';
          p.style.padding = '4px 6px';
          p.style.borderLeft = '2px solid rgba(56, 189, 248, 0.4)';
          p.textContent = l;
          logDiv.appendChild(p);
        });
        logDiv.scrollTop = logDiv.scrollHeight;
      }

      // Añadir comandos de animación oficiales a la instancia de Battle de Showdown
      if (battleInstance) {
        try {
          if (bs.latestCommands && bs.latestCommands.length > 0) {
            console.log('🎬 [Pure Battle] Ejecutando comandos en Showdown Battle:', bs.latestCommands);
            battleInstance.addBatch(bs.latestCommands);
          }
        } catch (e) {
          console.warn('[Pure Battle] Log sync warning:', e);
        }
      }
    }
  }

  // Inicialización al cargar la página con reintentos para asegurar conexión con el padre
  $(document).ready(function() {
    initBattle();
    notifyReady();
    
    // Si la ventana padre tardó en montar el bridge, reintentar la notificación
    let retries = 0;
    const readyInterval = setInterval(function() {
      if (currentRoomData || retries > 10) {
        clearInterval(readyInterval);
        // Garantizar que la pantalla de carga no se quede pegada
        const loader = document.getElementById('arenaLoader');
        if (loader && loader.style.display !== 'none') {
          loader.style.opacity = '0';
          setTimeout(() => { loader.style.display = 'none'; }, 300);
        }
      } else {
        retries++;
        notifyReady();
      }
    }, 400);
  });
})();
