// ====================================================================
// GESTOR DE ALMACENAMIENTO Y SINCRONIZACIÓN DE SALAS DE BATALLA
// Administra salas_batalla, sala_jugadores, sala_mensajes
// Sincroniza en tiempo real con Supabase REST + BroadcastChannel + LocalStorage
// ====================================================================

class BattleRoomStore {
  static ROOMS_STORAGE_KEY = 'stadium_salas_batalla_db';
  static channel = null;
  static listeners = new Set();
  static pollingTimer = null;
  static activeRoomCode = null;

  static init() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('stadium_battle_sync_channel');
        this.channel.onmessage = (event) => {
          this.handleBroadcast(event.data);
        };
      } catch (e) {
        console.warn('BroadcastChannel no disponible');
      }
    }

    // Escuchar eventos de almacenamiento en otras pestañas
    window.addEventListener('storage', (e) => {
      if (e.key === this.ROOMS_STORAGE_KEY) {
        this.notifyListeners('rooms_updated', this.getAllRooms());
      }
    });

    // Iniciar sondeo en segundo plano con Supabase para sincronización en tiempo real
    this.startSupabasePolling();
  }

  static subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  static notifyListeners(eventType, data) {
    this.listeners.forEach((cb) => {
      try {
        cb(eventType, data);
      } catch (err) {
        console.error('Error en listener de BattleRoomStore:', err);
      }
    });
  }

  static broadcast(action, payload) {
    if (this.channel) {
      try {
        this.channel.postMessage({ action, payload, timestamp: Date.now() });
      } catch (e) {}
    }
  }

  static handleBroadcast(data) {
    if (!data || !data.action) return;
    this.notifyListeners(data.action, data.payload);
  }

  // ------------------------------------------------------------------
  // SINCRONIZACIÓN CON SUPABASE
  // ------------------------------------------------------------------
  static startSupabasePolling() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);

    // Polling regular cada 2.5 segundos para sincronizar chat, filtros y jugadores activos
    // Además revisa y expira automáticamente salas que hayan superado los 5 minutos en espera
    this.pollingTimer = setInterval(() => {
      this.syncActiveRoomFromSupabase();
      this.autoExpireWaitingRooms();
    }, 2500);
  }

  // REGLA: Límite de tiempo de 5 minutos en estado 'esperando'.
  // Al pasar 5 minutos sin iniciar combate, la sala pasa a 'finalizada' automáticamente.
  static async autoExpireWaitingRooms() {
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const nowMs = Date.now();
    const rooms = this.getAllRooms();
    let hasLocalChanges = false;

    for (const r of rooms) {
      if (r.estado === 'esperando' && r.creada_en) {
        const createdMs = new Date(r.creada_en).getTime();
        if (createdMs && (nowMs - createdMs) > FIVE_MINUTES_MS) {
          r.estado = 'finalizada';
          r.finalizada_en = new Date().toISOString();
          hasLocalChanges = true;

          if (window.StadiumSupabase && r.id) {
            try {
              window.StadiumSupabase.request(`salas_batalla?id=eq.${r.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                  estado: 'finalizada',
                  finalizada_en: r.finalizada_en
                })
              });
            } catch (e) {}
          }

          if (this.activeRoomCode && this.activeRoomCode.toUpperCase() === r.codigo.toUpperCase()) {
            this.notifyListeners('room_expired', r);
          }
        }
      }
    }

    if (hasLocalChanges) {
      this.saveAllRooms(rooms);
    }
  }

  static setActiveRoomCode(code) {
    this.activeRoomCode = code;
    if (code) {
      this.syncActiveRoomFromSupabase();
    }
  }

  static async syncActiveRoomFromSupabase() {
    if (!this.activeRoomCode || !window.StadiumSupabase) return;

    try {
      const code = this.activeRoomCode;
      // Consultar la sala en Supabase
      const roomRes = await window.StadiumSupabase.request(`salas_batalla?codigo=eq.${encodeURIComponent(code)}&select=*`);
      if (!roomRes.ok || !roomRes.data || roomRes.data.length === 0) return;

      const remoteRoom = roomRes.data[0];

      // Consultar jugadores de la sala
      const playersRes = await window.StadiumSupabase.request(`sala_jugadores?sala_id=eq.${remoteRoom.id}&select=*&order=id.asc`);
      const remotePlayers = playersRes.ok && playersRes.data ? playersRes.data : [];

      // Consultar mensajes de la sala
      const msgsRes = await window.StadiumSupabase.request(`sala_mensajes?sala_id=eq.${remoteRoom.id}&select=*&order=id.asc`);
      const remoteMsgs = msgsRes.ok && msgsRes.data ? msgsRes.data : [];

      const currentLocal = this.getRoomByCode(code);

      // Si hay jugadores en la tabla sala_jugadores, usarlos; si no, fallback a remoteRoom.jugadores
      let finalPlayers = [];
      if (remotePlayers.length > 0) {
        finalPlayers = remotePlayers.map(p => ({
          id: p.id,
          apodo: p.apodo,
          es_anfitrion: p.es_anfitrion === 1 || p.es_anfitrion === true,
          listo: p.listo === 1 || p.listo === true,
          conectado: p.conectado === 1 || p.conectado === true,
          unido_en: p.unido_en,
          equipo_pokemon: p.equipo_pokemon 
            ? (typeof p.equipo_pokemon === 'string' ? JSON.parse(p.equipo_pokemon) : p.equipo_pokemon) 
            : ((currentLocal && currentLocal.jugadores && currentLocal.jugadores.find(cj => cj.apodo.toLowerCase() === p.apodo.toLowerCase())?.equipo_pokemon) || [])
        }));
      } else if (remoteRoom.jugadores) {
        finalPlayers = typeof remoteRoom.jugadores === 'string' ? JSON.parse(remoteRoom.jugadores) : remoteRoom.jugadores;
      } else if (currentLocal && currentLocal.jugadores) {
        finalPlayers = currentLocal.jugadores;
      }

      const unifiedRoom = {
        id: remoteRoom.id,
        codigo: remoteRoom.codigo,
        contrasena: remoteRoom.contrasena || (currentLocal && currentLocal.contrasena) || null,
        tiene_contrasena: !!remoteRoom.contrasena || (currentLocal && !!currentLocal.contrasena) || false,
        anfitrion_nombre: remoteRoom.anfitrion_nombre,
        anfitrion_id: remoteRoom.anfitrion_id,
        estado: remoteRoom.estado,
        pokemon_por_jugador: remoteRoom.pokemon_por_jugador || 3,
        max_jugadores: remoteRoom.max_jugadores || 2,
        jugadores_actuales: finalPlayers.length || remoteRoom.jugadores_actuales || 1,
        creada_en: remoteRoom.creada_en,
        finalizada_en: remoteRoom.finalizada_en,
        // Ajustes de partida con filtros de Pokémon
        ajustes: (currentLocal && currentLocal.ajustes) || {
          generaciones: ['todas'],
          formas: ['todas'],
          categorias: ['todas']
        },
        jugadores: finalPlayers,
        mensajes: remoteMsgs.map(m => ({
          id: m.id,
          emisor: m.emisor,
          mensaje: m.mensaje,
          es_sistema: m.es_sistema === 1 || m.es_sistema === true,
          enviado_en: m.enviado_en
        }))
      };

      // Si los datos remotos son más completos, actualizar local y notificar
      const localRooms = this.getAllRooms();
      const idx = localRooms.findIndex(r => r.codigo === code);
      if (idx !== -1) {
        localRooms[idx] = unifiedRoom;
      } else {
        localRooms.push(unifiedRoom);
      }
      localStorage.setItem(this.ROOMS_STORAGE_KEY, JSON.stringify(localRooms));
      this.notifyListeners('room_changed', unifiedRoom);
    } catch (err) {
      console.warn('Error en syncActiveRoomFromSupabase:', err);
    }
  }

  // ------------------------------------------------------------------
  // OPERACIONES CRUD LOCALES Y REMOTAS
  // ------------------------------------------------------------------
  static getAllRooms() {
    try {
      const raw = localStorage.getItem(this.ROOMS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  static saveAllRooms(rooms) {
    try {
      localStorage.setItem(this.ROOMS_STORAGE_KEY, JSON.stringify(rooms));
      this.broadcast('rooms_updated', rooms);
    } catch (e) {
      console.error('Error guardando salas en storage:', e);
    }
  }

  static getRoomByCode(code) {
    if (!code) return null;
    const cleanCode = code.trim().toUpperCase();
    const rooms = this.getAllRooms();
    return rooms.find((r) => r.codigo === cleanCode) || null;
  }

  static generateUniqueRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 100) {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      exists = this.getRoomByCode(code) !== null;
      attempts++;
    }
    return code;
  }

  // Obtener lista de salas disponibles desde Supabase (combinadas con local)
  // FILTRO OBLIGATORIO:
  // Si una sala tiene estado 'finalizada' o 'cancelada' y han pasado más de 5 minutos, debe desaparecer.
  static async fetchAvailableRooms() {
    const localRooms = this.getAllRooms();
    const localMap = new Map();
    localRooms.forEach(r => localMap.set(r.codigo, r));

    let allCandidates = [];

    if (window.StadiumSupabase) {
      try {
        const res = await window.StadiumSupabase.request(
          'salas_batalla?select=id,codigo,contrasena,anfitrion_nombre,estado,pokemon_por_jugador,max_jugadores,jugadores_actuales,creada_en,finalizada_en&order=creada_en.desc&limit=30'
        );
        if (res.ok && Array.isArray(res.data)) {
          allCandidates = res.data.map(remote => {
            const loc = localMap.get(remote.codigo);
            const pass = remote.contrasena || (loc ? loc.contrasena : null);
            return {
              ...remote,
              contrasena: pass,
              tiene_contrasena: !!pass
            };
          });
        }
      } catch (e) {
        console.warn('Error trayendo salas desde Supabase, usando local:', e);
      }
    }

    if (allCandidates.length === 0) {
      allCandidates = localRooms.map(r => ({
        ...r,
        tiene_contrasena: !!r.contrasena
      }));
    }

    // Filtrar salas finalizadas/canceladas tras 5 minutos
    const nowMs = Date.now();
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    return allCandidates.filter(room => {
      const estado = (room.estado || '').toLowerCase();
      if (estado === 'finalizada' || estado === 'cancelada') {
        const finishedTime = room.finalizada_en ? new Date(room.finalizada_en).getTime() : 0;
        if (finishedTime && (nowMs - finishedTime) > FIVE_MINUTES_MS) {
          return false; // Desaparece tras 5 minutos
        }
      }
      return true;
    });
  }

  static async checkUserActiveInOtherRoom(userNickname, currentRoomCode = null) {
    if (!userNickname) return null;
    const nickClean = userNickname.trim().toLowerCase();
    const nowMs = Date.now();
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    // 1. Verificar en Supabase
    if (window.StadiumSupabase) {
      try {
        const res = await window.StadiumSupabase.request(
          `salas_batalla?estado=in.(esperando,en_combate)&select=id,codigo,estado,anfitrion_nombre,jugadores_actuales,creada_en`
        );
        if (res.ok && Array.isArray(res.data)) {
          for (const r of res.data) {
            if (currentRoomCode && r.codigo.toUpperCase() === currentRoomCode.toUpperCase()) {
              continue;
            }

            // Si la sala está en esperando pero pasaron más de 5 minutos, expira y no bloquea
            if (r.estado === 'esperando' && r.creada_en) {
              const cMs = new Date(r.creada_en).getTime();
              if (cMs && (nowMs - cMs) > FIVE_MINUTES_MS) {
                // Marcar como finalizada en segundo plano
                window.StadiumSupabase.request(`salas_batalla?id=eq.${r.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ estado: 'finalizada', finalizada_en: new Date().toISOString() })
                }).catch(() => {});
                continue;
              }
            }

            // Consultar si el apodo está en sala_jugadores de esta sala
            const pRes = await window.StadiumSupabase.request(
              `sala_jugadores?sala_id=eq.${r.id}&apodo=eq.${encodeURIComponent(userNickname.trim())}&select=id,apodo`
            );
            if (pRes.ok && pRes.data && pRes.data.length > 0) {
              return r; // Ya está activo en esta sala
            }
          }
        }
      } catch (e) {
        console.warn('Error verificando actividad en otras salas:', e);
      }
    }

    // 2. Verificar en LocalStorage
    const localRooms = this.getAllRooms();
    for (const r of localRooms) {
      if (currentRoomCode && r.codigo.toUpperCase() === currentRoomCode.toUpperCase()) continue;
      if (r.estado === 'esperando' || r.estado === 'en_combate') {
        if (r.estado === 'esperando' && r.creada_en) {
          const cMs = new Date(r.creada_en).getTime();
          if (cMs && (nowMs - cMs) > FIVE_MINUTES_MS) {
            r.estado = 'finalizada';
            r.finalizada_en = new Date().toISOString();
            continue;
          }
        }
        const inRoom = (r.jugadores || []).some(j => (j.apodo || '').toLowerCase() === nickClean);
        if (inRoom) return r;
      }
    }

    return null;
  }

  // Crear una nueva sala
  static async createRoom({ hostNickname, pokemonCount = 3, maxPlayers = 2, password = null, ajustes = null }) {
    // Regla: Si el usuario ya tenía otra sala activa anterior, abandonarla/cerrarla automáticamente para crear la nueva
    const activeInOther = await this.checkUserActiveInOtherRoom(hostNickname);
    if (activeInOther) {
      console.log(`[BattleRoomStore] El anfitrión ${hostNickname} tenía la sala ${activeInOther.codigo}. Cerrando automáticamente para crear una nueva sala...`);
      await this.leaveRoom(activeInOther.codigo, hostNickname);
    }

    const code = this.generateUniqueRoomCode();
    const now = new Date().toISOString();
    const cleanPassword = (password || '').trim() || null;

    const defaultAjustes = {
      generaciones: ['todas'],
      formas: ['todas'],
      categorias: ['todas'],
      ...(ajustes || {})
    };

    const newRoom = {
      id: Date.now(),
      codigo: code,
      contrasena: cleanPassword,
      tiene_contrasena: !!cleanPassword,
      anfitrion_nombre: hostNickname,
      estado: 'esperando', // 'esperando', 'en_combate', 'finalizada', 'cancelada'
      pokemon_por_jugador: pokemonCount,
      max_jugadores: maxPlayers,
      jugadores_actuales: 1,
      creada_en: now,
      iniciada_en: null,
      finalizada_en: null,
      ganador_nombre: null,
      ajustes: defaultAjustes,
      jugadores: [
        {
          id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          apodo: hostNickname,
          es_anfitrion: true,
          listo: true,
          conectado: true,
          unido_en: now,
          equipo_pokemon: []
        }
      ],
      mensajes: [
        {
          id: 1,
          emisor: 'SISTEMA',
          mensaje: `¡Sala ${code} creada con éxito! Comparte el código para jugar.`,
          es_sistema: true,
          enviado_en: now
        }
      ]
    };

    // Guardar localmente de inmediato
    const rooms = this.getAllRooms();
    rooms.unshift(newRoom);
    this.saveAllRooms(rooms);
    this.setActiveRoomCode(code);

    // Guardar en Supabase en segundo plano
    if (window.StadiumSupabase) {
      try {
        const payload = {
          codigo: code,
          contrasena: cleanPassword,
          anfitrion_nombre: hostNickname,
          estado: 'esperando',
          pokemon_por_jugador: pokemonCount,
          max_jugadores: maxPlayers,
          jugadores_actuales: 1,
          ajustes: JSON.stringify(defaultAjustes),
          jugadores: JSON.stringify(newRoom.jugadores)
        };

        const res = await window.StadiumSupabase.request('salas_batalla', {
          method: 'POST',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify(payload)
        });

        if (res.ok && res.data && res.data[0]) {
          const dbRoom = res.data[0];
          newRoom.id = dbRoom.id;

          // Registrar anfitrión en sala_jugadores
          await window.StadiumSupabase.request('sala_jugadores', {
            method: 'POST',
            body: JSON.stringify({
              sala_id: dbRoom.id,
              apodo: hostNickname,
              es_anfitrion: 1,
              listo: 1,
              conectado: 1
            })
          });

          // Registrar mensaje inicial del sistema
          await window.StadiumSupabase.request('sala_mensajes', {
            method: 'POST',
            body: JSON.stringify({
              sala_id: dbRoom.id,
              emisor: 'SISTEMA',
              mensaje: `¡Sala ${code} creada con éxito! Comparte el código para jugar.`,
              es_sistema: 1
            })
          });
        }
      } catch (err) {
        console.warn('Error guardando sala en Supabase:', err);
      }
    }

    return newRoom;
  }

  static async getRoomDetails(code) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) return null;

    if (window.StadiumSupabase) {
      try {
        const res = await window.StadiumSupabase.request(`salas_batalla?codigo=eq.${encodeURIComponent(cleanCode)}&select=*`);
        if (res.ok && res.data && res.data.length > 0) {
          const dbRoom = res.data[0];
          
          // Traer jugadores actuales de la sala desde Supabase
          const playersRes = await window.StadiumSupabase.request(`sala_jugadores?sala_id=eq.${dbRoom.id}&select=*&order=id.asc`);
          const remotePlayers = playersRes.ok && playersRes.data ? playersRes.data : [];

          // Traer mensajes
          const msgsRes = await window.StadiumSupabase.request(`sala_mensajes?sala_id=eq.${dbRoom.id}&select=*&order=id.asc`);
          const remoteMsgs = msgsRes.ok && msgsRes.data ? msgsRes.data : [];

          const local = this.getRoomByCode(cleanCode);
          const pass = dbRoom.contrasena || (local && local.contrasena) || null;

          // Si hay jugadores en la tabla relacional, usarlos; de lo contrario fallback a columna JSON o anfitrión
          let parsedJugadores = [];
          if (remotePlayers.length > 0) {
            parsedJugadores = remotePlayers.map(p => ({
              id: p.id,
              apodo: p.apodo,
              es_anfitrion: p.es_anfitrion === 1 || p.es_anfitrion === true,
              listo: p.listo === 1 || p.listo === true,
              conectado: p.conectado === 1 || p.conectado === true,
              unido_en: p.unido_en,
              equipo_pokemon: []
            }));
          } else if (dbRoom.jugadores) {
            parsedJugadores = typeof dbRoom.jugadores === 'string' ? JSON.parse(dbRoom.jugadores) : dbRoom.jugadores;
          } else {
            parsedJugadores = [{ id: 'host', apodo: dbRoom.anfitrion_nombre, es_anfitrion: true, listo: true, conectado: true, equipo_pokemon: [] }];
          }

          const fullRoom = {
            id: dbRoom.id,
            codigo: dbRoom.codigo,
            contrasena: pass,
            tiene_contrasena: !!pass,
            anfitrion_nombre: dbRoom.anfitrion_nombre,
            anfitrion_id: dbRoom.anfitrion_id,
            estado: dbRoom.estado,
            pokemon_por_jugador: dbRoom.pokemon_por_jugador || 3,
            max_jugadores: dbRoom.max_jugadores || 2,
            jugadores_actuales: parsedJugadores.length,
            creada_en: dbRoom.creada_en,
            finalizada_en: dbRoom.finalizada_en,
            ajustes: (local && local.ajustes) || (dbRoom.ajustes ? (typeof dbRoom.ajustes === 'string' ? JSON.parse(dbRoom.ajustes) : dbRoom.ajustes) : {
              generaciones: ['todas'],
              formas: ['todas'],
              categorias: ['todas']
            }),
            jugadores: parsedJugadores,
            mensajes: remoteMsgs.map(m => ({
              id: m.id,
              emisor: m.emisor,
              mensaje: m.mensaje,
              es_sistema: m.es_sistema === 1 || m.es_sistema === true,
              enviado_en: m.enviado_en
            }))
          };

          // Actualizar caché local
          this.updateRoom(fullRoom);
          return fullRoom;
        }
      } catch (e) {
        console.warn('Error en getRoomDetails Supabase:', e);
      }
    }

    const local = this.getRoomByCode(cleanCode);
    if (local) {
      return {
        ...local,
        tiene_contrasena: !!local.contrasena
      };
    }
    return null;
  }

  // Unirse a una sala (con validación de contraseña y límite de jugadores)
  static async joinRoom({ code, userNickname, password = '' }) {
    const cleanCode = (code || '').trim().toUpperCase();
    let room = this.getRoomByCode(cleanCode);

    // Intentar buscar en Supabase primero para asegurar datos actualizados
    if (window.StadiumSupabase) {
      try {
        const res = await window.StadiumSupabase.request(`salas_batalla?codigo=eq.${encodeURIComponent(cleanCode)}&select=*`);
        if (res.ok && res.data && res.data.length > 0) {
          const dbRoom = res.data[0];
          
          // Traer jugadores actuales
          const playersRes = await window.StadiumSupabase.request(`sala_jugadores?sala_id=eq.${dbRoom.id}&select=*`);
          const players = playersRes.ok && playersRes.data ? playersRes.data : [];

          // Traer mensajes
          const msgsRes = await window.StadiumSupabase.request(`sala_mensajes?sala_id=eq.${dbRoom.id}&select=*&order=id.asc`);
          const msgs = msgsRes.ok && msgsRes.data ? msgsRes.data : [];

          const existingLocal = this.getRoomByCode(cleanCode);
          const roomPass = dbRoom.contrasena || (existingLocal && existingLocal.contrasena) || null;

          room = {
            id: dbRoom.id,
            codigo: dbRoom.codigo,
            contrasena: roomPass,
            tiene_contrasena: !!roomPass,
            anfitrion_nombre: dbRoom.anfitrion_nombre,
            anfitrion_id: dbRoom.anfitrion_id,
            estado: dbRoom.estado,
            pokemon_por_jugador: dbRoom.pokemon_por_jugador || 3,
            max_jugadores: dbRoom.max_jugadores || 2,
            jugadores_actuales: players.length || dbRoom.jugadores_actuales || 1,
            creada_en: dbRoom.creada_en,
            finalizada_en: dbRoom.finalizada_en,
            ajustes: (existingLocal && existingLocal.ajustes) || (dbRoom.ajustes ? (typeof dbRoom.ajustes === 'string' ? JSON.parse(dbRoom.ajustes) : dbRoom.ajustes) : {
              generaciones: ['todas'],
              formas: ['todas'],
              categorias: ['todas']
            }),
            jugadores: players.map(p => ({
              id: p.id,
              apodo: p.apodo,
              es_anfitrion: p.es_anfitrion === 1,
              listo: p.listo === 1,
              conectado: p.conectado === 1,
              unido_en: p.unido_en,
              equipo_pokemon: []
            })),
            mensajes: msgs.map(m => ({
              id: m.id,
              emisor: m.emisor,
              mensaje: m.mensaje,
              es_sistema: m.es_sistema === 1,
              enviado_en: m.enviado_en
            }))
          };
        }
      } catch (e) {
        console.warn('Error verificando sala en Supabase:', e);
      }
    }

    if (!room) {
      return { ok: false, error: `No existe ninguna sala con el código "${cleanCode}". Verifica el código ingresado.` };
    }

    // Regla 1: Debe estar en estado esperando
    if (room.estado !== 'esperando') {
      return { ok: false, error: `La sala no está disponible. Estado actual: ${room.estado.toUpperCase()}.` };
    }

    const currentPlayers = room.jugadores || [];
    const existingPlayer = currentPlayers.find(
      (j) => j.apodo.toLowerCase() === userNickname.toLowerCase()
    );

    // Regla: Si el usuario ya está en otra sala activa, cambiarlo/moverlo automáticamente
    // abandonando la anterior para permitirle entrar o unirse a la nueva sin bloqueos
    if (!existingPlayer) {
      const activeInOther = await this.checkUserActiveInOtherRoom(userNickname, cleanCode);
      if (activeInOther) {
        console.log(`[BattleRoomStore] El usuario ${userNickname} estaba en la sala ${activeInOther.codigo}. Abandonando automáticamente para unirse a ${cleanCode}...`);
        await this.leaveRoom(activeInOther.codigo, userNickname);
      }
    }

    // Regla 2: Solo unirse si solo tiene 1 jugador (o si es el mismo reingresando)
    if (!existingPlayer && currentPlayers.length >= 2) {
      return { ok: false, error: 'Esta sala ya está completa (tiene 2 o más jugadores). Solo puedes unirte a salas con 1 jugador.' };
    }

    // Regla 3: Validación de contraseña de la sala
    if (room.contrasena) {
      const inputPass = (password || '').trim();
      if (!inputPass) {
        return { ok: false, requiresPassword: true, error: 'Esta sala es privada y requiere contraseña.' };
      }
      if (inputPass !== String(room.contrasena).trim()) {
        return { ok: false, requiresPassword: true, error: 'Contraseña de sala incorrecta. Intenta nuevamente.' };
      }
    }

    const now = new Date().toISOString();

    if (existingPlayer) {
      existingPlayer.conectado = true;
    } else {
      const newPlayer = {
        id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        apodo: userNickname,
        es_anfitrion: false,
        listo: false,
        conectado: true,
        unido_en: now,
        equipo_pokemon: []
      };

      currentPlayers.push(newPlayer);
      room.jugadores = currentPlayers;
      room.jugadores_actuales = currentPlayers.length;

      if (!room.mensajes) room.mensajes = [];
      room.mensajes.push({
        id: room.mensajes.length + 1,
        emisor: 'SISTEMA',
        mensaje: `Entrenador ${userNickname} se ha unido a la sala.`,
        es_sistema: true,
        enviado_en: now
      });

      // Registrar jugador en Supabase
      if (window.StadiumSupabase && room.id) {
        try {
          await window.StadiumSupabase.request('sala_jugadores', {
            method: 'POST',
            body: JSON.stringify({
              sala_id: room.id,
              apodo: userNickname,
              es_anfitrion: 0,
              listo: 0,
              conectado: 1
            })
          });

          await window.StadiumSupabase.request(`salas_batalla?id=eq.${room.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ 
              jugadores_actuales: currentPlayers.length,
              jugadores: JSON.stringify(currentPlayers)
            })
          });

          await window.StadiumSupabase.request('sala_mensajes', {
            method: 'POST',
            body: JSON.stringify({
              sala_id: room.id,
              emisor: 'SISTEMA',
              mensaje: `Entrenador ${userNickname} se ha unido a la sala.`,
              es_sistema: 1
            })
          });
        } catch (e) {
          console.warn('Error registrando jugador en Supabase:', e);
        }
      }
    }

    this.updateRoom(room);
    this.setActiveRoomCode(cleanCode);
    return { ok: true, room };
  }

  // Cambiar el estado 'listo' de un jugador (Invitado)
  static async togglePlayerReady(code, userNickname) {
    const room = this.getRoomByCode(code);
    if (!room) return null;

    const player = (room.jugadores || []).find(
      (j) => (j.apodo || '').toLowerCase() === (userNickname || '').toLowerCase()
    );
    if (!player) return null;

    player.listo = !player.listo;

    const now = new Date().toISOString();
    if (!room.mensajes) room.mensajes = [];
    room.mensajes.push({
      id: room.mensajes.length + 1,
      emisor: 'SISTEMA',
      mensaje: player.listo 
        ? `✅ ${userNickname} está ¡LISTO PARA EL COMBATE!`
        : `⏳ ${userNickname} ha cancelado su estado de listo.`,
      es_sistema: true,
      enviado_en: now
    });

    this.updateRoom(room);

    // Replicar en Supabase
    if (window.StadiumSupabase && room.id) {
      try {
        await window.StadiumSupabase.request(`sala_jugadores?sala_id=eq.${room.id}&apodo=eq.${encodeURIComponent(userNickname)}`, {
          method: 'PATCH',
          body: JSON.stringify({ listo: player.listo ? 1 : 0 })
        });

        await window.StadiumSupabase.request(`salas_batalla?id=eq.${room.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            jugadores: JSON.stringify(room.jugadores)
          })
        });

        await window.StadiumSupabase.request('sala_mensajes', {
          method: 'POST',
          body: JSON.stringify({
            sala_id: room.id,
            emisor: 'SISTEMA',
            mensaje: player.listo 
              ? `✅ ${userNickname} está ¡LISTO PARA EL COMBATE!`
              : `⏳ ${userNickname} ha cancelado su estado de listo.`,
            es_sistema: 1
          })
        });
      } catch (e) {
        console.warn('Error actualizando estado listo en Supabase:', e);
      }
    }

    return room;
  }

  // Actualizar configuración o datos de una sala
  static updateRoom(updatedRoom) {
    const rooms = this.getAllRooms();
    const index = rooms.findIndex((r) => r.codigo === updatedRoom.codigo);
    if (index !== -1) {
      rooms[index] = updatedRoom;
    } else {
      rooms.unshift(updatedRoom);
    }
    this.saveAllRooms(rooms);
    this.broadcast('room_changed', updatedRoom);
  }

  // Enviar mensaje al chat de la sala
  static async addMessage(code, emisor, mensaje) {
    const room = this.getRoomByCode(code);
    if (!room) return null;

    const msgObj = {
      id: (room.mensajes ? room.mensajes.length : 0) + 1,
      emisor,
      mensaje,
      es_sistema: false,
      enviado_en: new Date().toISOString()
    };

    if (!room.mensajes) room.mensajes = [];
    room.mensajes.push(msgObj);
    this.updateRoom(room);

    // Replicar en Supabase
    if (window.StadiumSupabase && room.id) {
      try {
        await window.StadiumSupabase.request('sala_mensajes', {
          method: 'POST',
          body: JSON.stringify({
            sala_id: room.id,
            emisor,
            mensaje,
            es_sistema: 0
          })
        });
      } catch (e) {
        console.warn('Error enviando mensaje a Supabase:', e);
      }
    }

    return msgObj;
  }

  // Salir de una sala:
  // Si el anfitrión sale y está solo: se cancela/cierra la sala.
  // Si hay otro jugador: ese jugador pasa automáticamente a ser el anfitrión.
  static async leaveRoom(code, userNickname) {
    const room = this.getRoomByCode(code);
    if (!room) return;

    this.setActiveRoomCode(null);
    const isHost = (room.anfitrion_nombre || '').toLowerCase() === (userNickname || '').toLowerCase();

    // Caso 1: El anfitrión sale y no hay más jugadores (está solo en la sala)
    if (isHost && (!room.jugadores || room.jugadores.length <= 1)) {
      room.estado = 'cancelada';
      room.finalizada_en = new Date().toISOString();
      room.jugadores = [];
      room.jugadores_actuales = 0;
      this.updateRoom(room);

      if (window.StadiumSupabase && room.id) {
        try {
          await window.StadiumSupabase.request(`sala_jugadores?sala_id=eq.${room.id}`, {
            method: 'DELETE'
          });
          await window.StadiumSupabase.request(`salas_batalla?id=eq.${room.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ 
              estado: 'cancelada', 
              jugadores_actuales: 0,
              finalizada_en: new Date().toISOString() 
            })
          });
        } catch (e) {}
      }
    } else {
      // Caso 2: Hay otro jugador en la sala
      room.jugadores = (room.jugadores || []).filter(
        (j) => j.apodo.toLowerCase() !== (userNickname || '').toLowerCase()
      );
      room.jugadores_actuales = room.jugadores.length;

      let newHostNick = null;
      if (isHost && room.jugadores.length > 0) {
        // El siguiente jugador pasa automáticamente a ser el anfitrión
        room.jugadores[0].es_anfitrion = true;
        room.anfitrion_nombre = room.jugadores[0].apodo;
        newHostNick = room.jugadores[0].apodo;

        room.mensajes.push({
          id: (room.mensajes ? room.mensajes.length : 0) + 1,
          emisor: 'SISTEMA',
          mensaje: `El anfitrión ${userNickname} ha salido. ${newHostNick} es ahora el nuevo anfitrión de la sala.`,
          es_sistema: true,
          enviado_en: new Date().toISOString()
        });
      } else {
        room.mensajes.push({
          id: (room.mensajes ? room.mensajes.length : 0) + 1,
          emisor: 'SISTEMA',
          mensaje: `Entrenador ${userNickname} ha salido de la sala.`,
          es_sistema: true,
          enviado_en: new Date().toISOString()
        });
      }

      this.updateRoom(room);

      if (window.StadiumSupabase && room.id) {
        try {
          await window.StadiumSupabase.request(`sala_jugadores?sala_id=eq.${room.id}&apodo=eq.${encodeURIComponent(userNickname)}`, {
            method: 'DELETE'
          });

          if (newHostNick) {
            // Actualizar en Supabase al nuevo anfitrión
            await window.StadiumSupabase.request(`sala_jugadores?sala_id=eq.${room.id}&apodo=eq.${encodeURIComponent(newHostNick)}`, {
              method: 'PATCH',
              body: JSON.stringify({ es_anfitrion: 1 })
            });

            await window.StadiumSupabase.request(`salas_batalla?id=eq.${room.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                anfitrion_nombre: newHostNick,
                jugadores_actuales: room.jugadores.length
              })
            });

            await window.StadiumSupabase.request('sala_mensajes', {
              method: 'POST',
              body: JSON.stringify({
                sala_id: room.id,
                emisor: 'SISTEMA',
                mensaje: `El anfitrión ${userNickname} ha salido. ${newHostNick} es ahora el nuevo anfitrión de la sala.`,
                es_sistema: 1
              })
            });
          } else {
            await window.StadiumSupabase.request(`salas_batalla?id=eq.${room.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                jugadores_actuales: room.jugadores.length
              })
            });
          }
        } catch (e) {}
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.BattleRoomStore = BattleRoomStore;
}
