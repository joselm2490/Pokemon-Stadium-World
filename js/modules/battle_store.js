// ====================================================================
// GESTOR DE ALMACENAMIENTO Y SINCRONIZACIÓN DE SALAS DE BATALLA
// Administra salas_batalla, sala_jugadores, sala_mensajes y sala_estadisticas
// Sincroniza entre pestañas/ventanas con BroadcastChannel y Storage Events
// ====================================================================

class BattleRoomStore {
  static ROOMS_STORAGE_KEY = 'stadium_salas_batalla_db';
  static SESSIONS_STORAGE_KEY = 'stadium_current_session_room';
  static channel = null;
  static listeners = new Set();

  static init() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('stadium_battle_sync_channel');
        this.channel.onmessage = (event) => {
          this.handleBroadcast(event.data);
        };
      } catch (e) {
        console.warn('BroadcastChannel no disponible, usando Storage Events');
      }
    }

    // Escuchar eventos de almacenamiento en otras pestañas/ventanas
    window.addEventListener('storage', (e) => {
      if (e.key === this.ROOMS_STORAGE_KEY) {
        this.notifyListeners('rooms_updated', this.getAllRooms());
      }
    });
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
  // OPERACIONES CRUD DE SALAS (salas_batalla)
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
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluye I, O, 0, 1 para evitar confusiones
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

  // Crear una nueva sala en la base de datos
  static createRoom({ hostNickname, pokemonCount = 3, maxPlayers = 2 }) {
    const code = this.generateUniqueRoomCode();
    const now = new Date().toISOString();

    const newRoom = {
      id: Date.now(),
      codigo: code,
      anfitrion_nombre: hostNickname,
      estado: 'esperando', // 'esperando', 'en_combate', 'finalizada', 'cancelada'
      pokemon_por_jugador: pokemonCount,
      max_jugadores: maxPlayers,
      jugadores_actuales: 1,
      creada_en: now,
      iniciada_en: null,
      finalizada_en: null,
      ganador_nombre: null,
      // TABLA sala_jugadores
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
      // TABLA sala_mensajes
      mensajes: [
        {
          id: 1,
          emisor: 'SISTEMA',
          mensaje: `¡Sala ${code} creada con éxito! Comparte el código para jugar.`,
          es_sistema: true,
          enviado_en: now
        }
      ],
      // TABLA sala_estadisticas
      estadisticas: {
        total_turnos: 0,
        total_dano_causado: 0,
        pokemon_debilitados: 0,
        movimientos_usados: 0,
        duracion_segundos: 0,
        datos_combate: []
      }
    };

    const rooms = this.getAllRooms();
    rooms.push(newRoom);
    this.saveAllRooms(rooms);

    return newRoom;
  }

  // Unir a un nuevo usuario a una sala existente mediante su código único
  static joinRoom({ code, userNickname }) {
    const room = this.getRoomByCode(code);
    if (!room) {
      return { ok: false, error: `No existe ninguna sala con el código "${code}". Verifica el código ingresado.` };
    }

    if (room.estado !== 'esperando') {
      return { ok: false, error: 'La sala ya no está disponible (la partida ya inició o finalizó).' };
    }

    // Verificar si el jugador ya está en la sala por su apodo
    const existingPlayer = room.jugadores.find(
      (j) => j.apodo.toLowerCase() === userNickname.toLowerCase()
    );

    const now = new Date().toISOString();

    if (existingPlayer) {
      // Re-conectar al jugador existente
      existingPlayer.conectado = true;
    } else {
      if (room.jugadores.length >= room.max_jugadores) {
        return { ok: false, error: `La sala está llena (Máximo ${room.max_jugadores} jugadores).` };
      }

      const newPlayer = {
        id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        apodo: userNickname,
        es_anfitrion: false,
        listo: false,
        conectado: true,
        unido_en: now,
        equipo_pokemon: []
      };

      room.jugadores.push(newPlayer);
      room.jugadores_actuales = room.jugadores.length;

      room.mensajes.push({
        id: room.mensajes.length + 1,
        emisor: 'SISTEMA',
        mensaje: `Entrenador ${userNickname} se ha unido a la sala.`,
        es_sistema: true,
        enviado_en: now
      });
    }

    this.updateRoom(room);
    return { ok: true, room };
  }

  // Actualizar configuración o datos de una sala
  static updateRoom(updatedRoom) {
    const rooms = this.getAllRooms();
    const index = rooms.findIndex((r) => r.codigo === updatedRoom.codigo);
    if (index !== -1) {
      rooms[index] = updatedRoom;
      this.saveAllRooms(rooms);
      this.broadcast('room_changed', updatedRoom);
    }
  }

  // Enviar mensaje al chat de la sala (sala_mensajes)
  static addMessage(code, emisor, mensaje) {
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
    return msgObj;
  }

  // Salir de una sala
  static leaveRoom(code, userNickname) {
    const room = this.getRoomByCode(code);
    if (!room) return;

    const isHost = room.anfitrion_nombre.toLowerCase() === userNickname.toLowerCase();

    if (isHost && room.jugadores.length <= 1) {
      // Si el anfitrión sale y está solo, marcar cancelada
      room.estado = 'cancelada';
      this.updateRoom(room);
    } else {
      room.jugadores = room.jugadores.filter(
        (j) => j.apodo.toLowerCase() !== userNickname.toLowerCase()
      );
      room.jugadores_actuales = room.jugadores.length;

      // Si el anfitrión salió pero quedan jugadores, transferir anfitrión
      if (isHost && room.jugadores.length > 0) {
        room.jugadores[0].es_anfitrion = true;
        room.anfitrion_nombre = room.jugadores[0].apodo;
      }

      room.mensajes.push({
        id: (room.mensajes ? room.mensajes.length : 0) + 1,
        emisor: 'SISTEMA',
        mensaje: `Entrenador ${userNickname} ha salido de la sala.`,
        es_sistema: true,
        enviado_en: new Date().toISOString()
      });

      this.updateRoom(room);
    }
  }
}

if (typeof window !== 'undefined') {
  window.BattleRoomStore = BattleRoomStore;
}

