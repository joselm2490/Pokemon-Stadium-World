/**
 * Integración automática de Pokémon Stadium World con Pokémon Showdown
 * Recibe el nickname del usuario, el rival y el equipo generado aleatoriamente
 * según los filtros de la sala (3 vs 3 o N vs N).
 */
(function() {
  function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  const userNick = (getQueryParam('user') || '').trim();
  const rivalNick = (getQueryParam('rival') || '').trim();
  const roomCode = (getQueryParam('room') || '').trim();
  const isHost = getQueryParam('host') === '1' || getQueryParam('host') === 'true';
  const packedTeam = getQueryParam('team') || '';

  console.log('[Stadium-Showdown Bridge] Iniciando bridge:', { userNick, rivalNick, roomCode, isHost, hasTeam: !!packedTeam });

  // 1. Inyectar el equipo en Showdown (localStorage y objeto PS.teams)
  if (packedTeam) {
    try {
      const teamObj = {
        name: `Sala ${roomCode || 'Stadium'}`,
        format: 'gen9customgame',
        folder: '',
        packedTeam: packedTeam,
        isBox: false
      };
      
      // Formato de storage de showdown_teams:
      // name|format|folder|packedTeam\n
      const teamLine = `${teamObj.name}|${teamObj.format}|${teamObj.folder}|${teamObj.packedTeam}`;
      localStorage.setItem('showdown_teams', teamLine);
      localStorage.setItem('showdown_teams_local', teamLine);
    } catch (e) {
      console.warn('[Stadium-Showdown Bridge] Error guardando equipo en localStorage:', e);
    }
  }

  // 2. Esperar a que Showdown inicialice PS y la conexión
  let attempts = 0;
  const maxAttempts = 150; // ~15 segundos máx
  const checkInterval = setInterval(() => {
    attempts++;
    if (typeof window.PS === 'undefined' || !window.PS.user || !window.PS.connection) {
      if (attempts >= maxAttempts) clearInterval(checkInterval);
      return;
    }

    clearInterval(checkInterval);
    setupBridge();
  }, 100);

  function setupBridge() {
    const PS = window.PS;

    // A. Asegurar que Showdown cargue el equipo recién inyectado
    if (packedTeam && PS.teams) {
      try {
        const teamLine = `Sala ${roomCode || 'Stadium'}|gen9customgame||${packedTeam}`;
        PS.teams.unpackAll(teamLine);
        if (PS.teams.list && PS.teams.list.length > 0) {
          PS.teams.curTeam = PS.teams.list[0];
        }
      } catch (err) {
        console.warn('[Stadium-Showdown Bridge] Error aplicando equipo en PS.teams:', err);
      }
    }

    // B. Establecer el apodo del usuario si está conectado o cambiarlo
    if (userNick) {
      // Si el socket ya está conectado, enviar /nick
      if (PS.connection && PS.connection.connected) {
        loginUser(userNick);
      } else {
        // Escuchar el evento de conexión
        const origHandleConnect = PS.connection.handleConnect;
        PS.connection.handleConnect = function() {
          origHandleConnect.apply(this, arguments);
          loginUser(userNick);
        };
      }
    }
  }

  let loggedIn = false;
  function loginUser(nickname) {
    if (loggedIn) return;
    const PS = window.PS;
    
    // Cambiar nombre sin pedir contraseña (servidor libre en Render)
    PS.send(`/nick ${nickname}`);
    loggedIn = true;
    console.log(`[Stadium-Showdown Bridge] Enviado comando /nick ${nickname}`);

    // C. Modo Tutorial o Desafío Multijugador
    if (roomCode === 'TUTORIAL') {
      setupTutorialBotBattle();
    } else {
      setupAutoChallenge();
    }
  }

  function setupTutorialBotBattle() {
    const PS = window.PS;
    console.log('[Stadium-Showdown Bridge] Iniciando combate Tutorial contra CPU...');
    
    // Crear o buscar partida rápida local en Showdown contra la IA integrada o ladder
    setTimeout(() => {
      try {
        if (packedTeam) {
          PS.send(`/utm ${packedTeam}`);
        }
        // Retar a bot o buscar combate directo en gen9customgame
        PS.send(`/challenge ${rivalNick || 'Profesor Oak'}, gen9customgame`);
      } catch (err) {
        console.warn('[Stadium-Showdown Bridge] Error en setupTutorialBotBattle:', err);
      }
    }, 1500);
  }

  function setupAutoChallenge() {
    const PS = window.PS;
    if (!rivalNick) return;

    // El Anfitrión es quien emite el reto (/challenge rival, gen9customgame)
    // El Invitado responde aceptando (/accept) cuando reciba el reto
    if (isHost) {
      let challengeAttempts = 0;
      const challengeTimer = setInterval(() => {
        challengeAttempts++;
        if (challengeAttempts > 10) {
          clearInterval(challengeTimer);
          return;
        }

        // Si ya estamos en una batalla o retando
        if (PS.room && PS.room.id && PS.room.id.startsWith('battle-')) {
          clearInterval(challengeTimer);
          return;
        }

        if (packedTeam) {
          PS.send(`/utm ${packedTeam}`);
        }
        PS.send(`/challenge ${rivalNick}, gen9customgame`);
        console.log(`[Stadium-Showdown Bridge] [Host] Desafiando a ${rivalNick} en gen9customgame...`);
      }, 2500);

      // Escuchar si entramos a una sala de combate para detener reintentos
      const origAddRoom = PS.addRoom;
      PS.addRoom = function(id) {
        if (id && id.startsWith('battle-')) {
          clearInterval(challengeTimer);
        }
        return origAddRoom.apply(this, arguments);
      };
    } else {
      // Modo Invitado: auto-aceptar reto proveniente del Host
      let acceptAttempts = 0;
      const acceptInterval = setInterval(() => {
        acceptAttempts++;
        if (acceptAttempts > 30) {
          clearInterval(acceptInterval);
          return;
        }

        // Si ya estamos en combate
        if (PS.room && PS.room.id && PS.room.id.startsWith('battle-')) {
          clearInterval(acceptInterval);
          return;
        }

        // Enviar /utm periódicamente para tener el equipo cargado antes del accept
        if (packedTeam) {
          PS.send(`/utm ${packedTeam}`);
        }
        // Intentar aceptar el reto de rivalNick
        PS.send(`/accept ${rivalNick}`);
      }, 2000);

      const origAddRoom = PS.addRoom;
      PS.addRoom = function(id) {
        if (id && id.startsWith('battle-')) {
          clearInterval(acceptInterval);
        }
        return origAddRoom.apply(this, arguments);
      };
    }

    // Escuchar mensajes desde la ventana padre (para rendición o desconexión limpia)
    window.addEventListener('message', function(ev) {
      if (!ev.data) return;
      if (ev.data.type === 'stadium-forfeit-and-close') {
        console.log('[Stadium-Showdown Bridge] Recibida orden de rendición y cierre.');
        try {
          if (PS.room && PS.room.id && PS.room.id.startsWith('battle-')) {
            PS.room.send('/forfeit');
            PS.room.send('/leave');
          }
          if (PS.connection) {
            PS.connection.disconnect();
          }
        } catch (e) {
          console.warn('[Stadium-Showdown Bridge] Error forzando desconexión:', e);
        }
      }
    });
  }
})();

