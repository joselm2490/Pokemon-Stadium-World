// ====================================================================
// CLIENTE WEBSOCKET Y API PARA DJANGO CHANNELS (FRONTEND)
// ====================================================================

window.StadiumDjangoWS = {
  socket: null,
  currentRoomCode: null,
  listeners: new Map(),
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  isConnecting: false,

  // Determinar la URL del servidor WebSocket de Django (Render o Localhost)
  getWsBaseUrl() {
    // Si estamos en localhost, conectar al puerto de Django local
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'ws://127.0.0.1:8000/ws/sala/';
    }
    // En producción (Vercel), conectar al servicio Daphne en Render
    // Puedes sobrescribir window.DJANGO_WS_URL en producción si tienes un subdominio específico
    return window.DJANGO_WS_URL || 'wss://pokemon-stadium-backend.onrender.com/ws/sala/';
  },

  // Conectar al socket de una sala específica
  connect(roomCode) {
    if (!roomCode) return;
    const cleanCode = roomCode.trim().toUpperCase();

    // Si ya estamos conectados a esta sala, no reconectar
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.currentRoomCode === cleanCode) {
      return;
    }

    this.disconnect();
    this.currentRoomCode = cleanCode;
    this.isConnecting = true;

    const wsUrl = `${this.getWsBaseUrl()}${cleanCode}/`;
    console.log(`[DjangoWS] Conectando a WebSocket: ${wsUrl}`);

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log(`[DjangoWS] Conexión establecida con la sala ${cleanCode}`);
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.emit('connected', { roomCode: cleanCode });
      };

      this.socket.onmessage = (event) => {
        try {
          const data = json.loads ? json.loads(event.data) : JSON.parse(event.data);
          this.handleIncomingMessage(data);
        } catch (err) {
          console.warn('[DjangoWS] Error parseando mensaje WebSocket:', err);
        }
      };

      this.socket.onclose = (event) => {
        console.log(`[DjangoWS] Socket cerrado (código: ${event.code})`);
        this.isConnecting = false;
        this.emit('disconnected', event);
        this.attemptReconnect();
      };

      this.socket.onerror = (err) => {
        console.warn('[DjangoWS] Error en conexión WebSocket:', err);
        this.isConnecting = false;
        this.emit('error', err);
      };
    } catch (e) {
      console.error('[DjangoWS] Excepción al instanciar WebSocket:', e);
      this.isConnecting = false;
    }
  },

  disconnect() {
    if (this.socket) {
      this.socket.onclose = null; // evitar reintentos automáticos intencionales
      this.socket.close();
      this.socket = null;
    }
    this.currentRoomCode = null;
    this.isConnecting = false;
  },

  attemptReconnect() {
    if (!this.currentRoomCode || this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    console.log(`[DjangoWS] Reintentando conexión en ${delay}ms (Intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    setTimeout(() => {
      if (this.currentRoomCode) {
        this.connect(this.currentRoomCode);
      }
    }, delay);
  },

  // Enviar paquete estructurado a Django Channels
  send(action, payload = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn(`[DjangoWS] No se puede enviar '${action}', socket no conectado.`);
      return false;
    }
    const message = JSON.stringify({ action, ...payload });
    this.socket.send(message);
    return true;
  },

  // Acciones comunes de sala
  sendChat(sender, message) {
    return this.send('send_chat', { sender, message });
  },

  setPokemonCount(count) {
    return this.send('set_pokemon_count', { count });
  },

  setPlayerReady(nickname, ready) {
    return this.send('player_ready', { nickname, ready });
  },

  confirmTeam(nickname, team) {
    return this.send('confirm_team', { nickname, team });
  },

  sendBattleAction(actionPayload) {
    return this.send('battle_action', { payload: actionPayload });
  },

  // Procesamiento de mensajes entrantes desde Django Channels
  handleIncomingMessage(data) {
    const type = data.type;
    switch (type) {
      case 'room_state':
      case 'room_updated':
        if (data.room && window.BattleRoomStore) {
          window.BattleRoomStore.updateRoom(data.room);
        }
        if (data.both_confirmed && window.BatallaModule) {
          window.BatallaModule.handleBothTeamsConfirmed(data.room);
        }
        this.emit('room_update', data.room);
        break;

      case 'chat_message':
        this.emit('chat_message', data.message);
        break;

      case 'battle_action':
        this.emit('battle_action', data.payload);
        break;

      default:
        this.emit(type, data);
        break;
    }
  },

  // Sistema de suscripción a eventos (Observer pattern)
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  },

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const filtered = this.listeners.get(event).filter(cb => cb !== callback);
    this.listeners.set(event, filtered);
  },

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try { cb(data); } catch (e) { console.error(`Error en listener de ${event}:`, e); }
      });
    }
  }
};
