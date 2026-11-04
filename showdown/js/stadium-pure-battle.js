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

  function renderControls(mySide, rivalSide, bs) {
    const movesGrid = document.getElementById('movesGrid');
    const switchesBar = document.getElementById('switchesBar');
    const promptText = document.getElementById('promptText');

    if (!movesGrid || !switchesBar) return;

    if (bs.phase === 'finished') {
      promptText.textContent = `🏆 ¡Combate terminado! Ganador: ${bs.winner}`;
      movesGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #4ade80; font-weight: 800; padding: 14px;">El duelo ha concluido.</div>`;
      switchesBar.innerHTML = '';
      return;
    }

    if (mySide.pendingAction) {
      promptText.textContent = '⏳ Esperando la acción del rival...';
      movesGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #94a3b8; padding: 14px;">Acción enviada. Esperando al contrincante...</div>`;
      switchesBar.innerHTML = '';
      return;
    }

    promptText.textContent = `🎮 ¿Qué debería hacer ${activePokemon ? activePokemon.name : 'tu Pokémon'}?`;

    // 1. Botones de los 4 Movimientos
    const moves = (activePokemon && activePokemon.movimientos) ? activePokemon.movimientos : [];
    movesGrid.innerHTML = moves.map((m, idx) => {
      const type = m.tipo || 'Normal';
      const color = TYPE_COLORS[type] || '#A8A878';
      const disabled = m.pp <= 0 ? 'disabled' : '';

      return `
        <button 
          class="move-btn" 
          style="background: linear-gradient(135deg, ${color}, #1e293b);"
          data-move-idx="${idx}"
          ${disabled}
          onclick="window.selectMove(${idx})"
        >
          <span>${m.nombre}</span>
          <span class="pp-tag">${m.pp}/${m.maxPp} PP</span>
        </button>
      `;
    }).join('');

    // 2. Botones de Cambiar Pokémon
    const team = mySide.team || [];
    const switchable = team.map((p, idx) => ({ p, idx })).filter(item => item.idx !== mySide.activeIndex);

    switchesBar.innerHTML = `
      <span class="switch-label">CAMBIAR:</span>
      ${switchable.map(item => {
        const p = item.p;
        const isFainted = p.fainted || p.currentHp <= 0;
        const hpPercent = Math.max(0, Math.floor((p.currentHp / p.maxHp) * 100));

        return `
          <button 
            class="switch-btn" 
            ${isFainted ? 'disabled' : ''}
            onclick="window.selectSwitch(${item.idx})"
          >
            <span>${p.name}</span>
            <span style="font-size: 0.72rem; color: ${isFainted ? '#ef4444' : '#4ade80'}; font-weight: 800;">${isFainted ? 'Debilitado' : hpPercent + '%'}</span>
          </button>
        `;
      }).join('')}
    `;
  }

  // Interacción de usuario: seleccionar ataque
  window.selectMove = function(moveIndex) {
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
