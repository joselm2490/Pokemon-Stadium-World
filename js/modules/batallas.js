// ====================================================================
// MÓDULO: MODO BATALLA STADIUM (LOBBY Y SALAS MULTIJUGADOR)
// Integra almacenamiento persistente con BattleRoomStore
// ====================================================================

class BatallaModule {
  static pokemonList = [];
  static movesById = new Map();

  // Estados: 'landing' (Imagen 1) | 'lobby' (Imagen 2) | 'battle'
  static currentScreen = 'landing';

  // Datos del jugador y la sala actual
  static userNickname = 'Jose';
  static currentRoom = null;
  static unsubscribeStore = null;

  static getUserNickname() {
    if (window.AuthManager && window.AuthManager.isLoggedIn()) {
      const user = window.AuthManager.getCurrentUser();
      if (user) {
        if (user.username) return user.username;
        if (user.nombre) return user.nombre.split(' ')[0];
      }
    }
    const savedNick = localStorage.getItem('stadium_battle_nickname');
    if (savedNick) return savedNick;
    return 'Entrenador';
  }

  static syncUserNickname() {
    this.userNickname = this.getUserNickname();
  }

  static init(pokemonList = [], movesByIdMap = new Map()) {
    this.pokemonList = pokemonList;
    this.movesById = movesByIdMap;

    // Inicializar el store de salas si está disponible
    if (window.BattleRoomStore) {
      window.BattleRoomStore.init();

      // Suscribirse a cambios en tiempo real desde otras pestañas/dispositivos
      if (this.unsubscribeStore) this.unsubscribeStore();
      this.unsubscribeStore = window.BattleRoomStore.subscribe((event, data) => {
        this.handleStoreUpdate(event, data);
      });
    }

    // Obtener apodo guardado o de la sesión de usuario
    this.syncUserNickname();

    // Revisar si había una sala activa guardada en sesión
    const savedRoomCode = sessionStorage.getItem('stadium_active_room_code');
    if (savedRoomCode && window.BattleRoomStore) {
      const room = window.BattleRoomStore.getRoomByCode(savedRoomCode);
      if (room && room.estado === 'esperando') {
        this.currentRoom = room;
        this.currentScreen = 'lobby';
      } else {
        sessionStorage.removeItem('stadium_active_room_code');
        this.currentScreen = 'landing';
      }
    }

    this.renderCurrentView();
  }

  static handleStoreUpdate(eventType, data) {
    if (!this.currentRoom) return;

    // Si la sala activa fue actualizada en otra pestaña o mediante Supabase/Storage
    if (window.BattleRoomStore) {
      const updated = window.BattleRoomStore.getRoomByCode(this.currentRoom.codigo);
      if (updated) {
        const hadDifferentMessages = JSON.stringify(this.currentRoom.mensajes) !== JSON.stringify(updated.mensajes);
        const hadDifferentPlayers = JSON.stringify(this.currentRoom.jugadores) !== JSON.stringify(updated.jugadores);
        const hadDifferentSettings = this.currentRoom.pokemon_por_jugador !== updated.pokemon_por_jugador || this.currentRoom.max_jugadores !== updated.max_jugadores;
        
        this.currentRoom = updated;

        if (this.currentScreen === 'lobby') {
          if (hadDifferentPlayers || hadDifferentSettings) {
            this.renderCurrentView();
          } else if (hadDifferentMessages) {
            this.renderChatOnly();
          }
        }
      }
    }
  }

  static renderCurrentView() {
    const container = document.getElementById('view-batalla');
    if (!container) return;

    // Sincronizar el apodo antes de renderizar la vista de aterrizaje
    if (this.currentScreen === 'landing') {
      this.syncUserNickname();
      this.renderLandingScreen(container);
    } else if (this.currentScreen === 'lobby') {
      this.renderLobbyScreen(container);
    }
  }

  static renderChatOnly() {
    const chatContainer = document.getElementById('lobbyChatContainer');
    if (!chatContainer || !this.currentRoom) return;

    chatContainer.innerHTML = (this.currentRoom.mensajes || []).map((msg) => `
      <div class="chat-msg-row ${msg.es_sistema ? 'msg-system' : ''}">
        ${msg.es_sistema
          ? `<span class="sys-msg">${this.escapeHtml(msg.mensaje)}</span>`
          : `<strong>${this.escapeHtml(msg.emisor)}:</strong> <span>${this.escapeHtml(msg.mensaje)}</span>`
        }
      </div>
    `).join('');

    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // ------------------------------------------------------------------
  // PANTALLA 1: MENÚ DE ACCESO / APODO / CREAR Y UNIRSE (IMAGEN 1)
  // ------------------------------------------------------------------
  static renderLandingScreen(container) {
    const isLogged = window.AuthManager && window.AuthManager.isLoggedIn();

    container.innerHTML = `
      <div class="stadium-battle-wrapper battle-landing-wrapper">
        <!-- BARRA SUPERIOR DE ESTADO DEL SERVIDOR -->
        <header class="battle-topbar">
          <div class="battle-topbar-left">
            <div class="battle-branding-header">
              <div class="footer-pokeball-mini"></div>
              <div class="footer-brand-text">
                <strong>POKÉMON STADIUM WORLD</strong>
                <span>WEB GAME ENGINE & DATABASE</span>
              </div>
            </div>
          </div>
          <div class="battle-topbar-right">
            <div class="server-status-pill">
              <span class="status-indicator-dot online"></span>
              <span class="status-text">Servidor Conectado</span>
            </div>
            <div class="version-tag">v2.0 Web & Móvil</div>
            <button class="battle-exit-btn" onclick="BatallaModule.exitBattleModule()">
              <span class="exit-icon">✕</span>
              <span>Salir</span>
            </button>
          </div>
        </header>

        <!-- CONTENIDO CENTRAL -->
        <main class="battle-landing-center">
          <div class="arena-logo-badge">
            <div class="arena-pokeball-circle"></div>
          </div>
          <h1 class="arena-brand-heading">Arena Stadium</h1>

          <!-- TARJETA FLOTANTE DE ACCESO -->
          <div class="battle-card-box">
            <!-- CAMPO DE APODO -->
            <div class="apodo-field-group">
              <div class="apodo-label-row">
                <span class="apodo-label">
                  <span class="label-user-icon">${isLogged ? '🔒' : '👤'}</span> TU APODO ${isLogged ? '<span class="apodo-locked-tag">(Cuenta Verificada)</span>' : ''}
                </span>
                <span class="apodo-counter" id="apodoCharCounter">${(this.userNickname || '').length}/15</span>
              </div>
              <div class="apodo-input-wrapper ${isLogged ? 'is-locked' : ''}">
                <input 
                  type="text" 
                  id="battleNicknameInput" 
                  class="apodo-input ${isLogged ? 'apodo-input-locked' : ''}" 
                  maxlength="15" 
                  value="${this.escapeHtml(this.userNickname)}"
                  placeholder="Tu apodo"
                  autocomplete="off"
                  ${isLogged ? 'readonly title="Apodo fijado por tu sesión de entrenador"' : ''}
                />
                ${!isLogged ? `
                  <button class="dice-btn" id="randomizeNickBtn" title="Generar apodo aleatorio">
                    🎲
                  </button>
                ` : `
                  <span class="lock-indicator" title="Sesión activa">🔒</span>
                `}
              </div>
            </div>

            <!-- BOTONES DE ACCIÓN -->
            <button class="battle-primary-action-btn btn-crear-sala" id="btnCrearSala">
              <span class="btn-action-icon">🚀</span>
              <span class="btn-action-text">CREAR SALA</span>
            </button>

            <button class="battle-primary-action-btn btn-unirse-sala" id="btnUnirseSala">
              <span class="btn-action-icon">🔑</span>
              <span class="btn-action-text">UNIRSE A SALA</span>
            </button>

            <button class="battle-secondary-action-btn btn-como-jugar" id="btnComoJugar">
              <span class="btn-help-icon">❓</span>
              <span>¿CÓMO JUGAR?</span>
            </button>
          </div>
        </main>

        <!-- FOOTER INFORMATIVO -->
        <footer class="battle-landing-footer">
          <div class="battle-footer-hint" style="margin: 0 auto; text-align: center;">
            <span class="hint-icon">💡</span> Comparte el código de 6 caracteres para jugar juntos desde cualquier pantalla
          </div>
        </footer>
      </div>

      <!-- MODAL PARA UNIRSE A SALA MEDIANTE CÓDIGO ÚNICO -->
      <div class="battle-modal-overlay" id="joinRoomModal" style="display: none;">
        <div class="battle-modal-card">
          <div class="battle-modal-header">
            <h3>🔑 Unirse a una Sala</h3>
            <button class="battle-modal-close" onclick="BatallaModule.closeJoinModal()">✕</button>
          </div>
          <div class="battle-modal-body">
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 14px;">
              Ingresa el código único de 6 caracteres que te compartió el anfitrión:
            </p>
            <input 
              type="text" 
              id="joinRoomCodeInput" 
              class="join-code-input" 
              placeholder="Ej: PXXE69" 
              maxlength="6"
              style="text-transform: uppercase;"
              autocomplete="off"
            />
            <div id="joinModalErrorMsg" style="color: #ef4444; font-size: 0.8rem; margin-top: 8px; display: none;"></div>
            <div class="battle-modal-actions" style="margin-top: 18px; display: flex; gap: 10px;">
              <button class="battle-primary-action-btn btn-crear-sala" style="flex: 1; padding: 12px;" onclick="BatallaModule.submitJoinRoom()">
                Entrar a la Sala
              </button>
              <button class="battle-secondary-action-btn" style="width: auto; padding: 12px 18px;" onclick="BatallaModule.closeJoinModal()">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupLandingEvents();
  }

  // ------------------------------------------------------------------
  // PANTALLA 2: SALA DE ESPERA / LOBBY (IMAGEN 2)
  // ------------------------------------------------------------------
  static renderLobbyScreen(container) {
    if (!this.currentRoom) {
      this.currentScreen = 'landing';
      this.renderLandingScreen(container);
      return;
    }

    const room = this.currentRoom;
    const myNick = (this.userNickname || '').toLowerCase();
    const isHost = (room.anfitrion_nombre || '').toLowerCase() === myNick;
    const canStart = room.jugadores && room.jugadores.length >= 2;

    container.innerHTML = `
      <div class="stadium-battle-wrapper battle-lobby-wrapper">
        <!-- BARRA SUPERIOR DEL LOBBY -->
        <header class="lobby-header-bar">
          <div class="lobby-header-left">
            <div class="battle-branding-header" style="margin-right: 12px;">
              <div class="footer-pokeball-mini"></div>
              <div class="footer-brand-text">
                <strong>POKÉMON STADIUM WORLD</strong>
                <span>WEB GAME ENGINE & DATABASE</span>
              </div>
            </div>
            <div class="lobby-pokeball-brand"></div>
            <h2 class="lobby-brand-title">Arena Stadium</h2>
            <div class="lobby-status-pill">SALA DE ESPERA</div>
          </div>

          <div class="lobby-header-right">
            <div class="room-code-tag" id="roomCodeBadge" onclick="BatallaModule.copyRoomCode()" title="Clic para copiar código">
              <span class="room-label">SALA:</span>
              <span class="room-code-val">${room.codigo}</span>
              <span class="copy-icon">📋</span>
            </div>
            <button class="battle-exit-btn" onclick="BatallaModule.leaveRoom()">
              <span class="exit-icon">✕</span>
              <span>Salir</span>
            </button>
          </div>
        </header>

        <!-- CUERPO PRINCIPAL DEL LOBBY (3 COLUMNAS) -->
        <main class="lobby-main-grid">
          <!-- COLUMNA 1: JUGADORES EN SALA (TABLA: sala_jugadores) -->
          <section class="lobby-card-panel players-card-panel">
            <div class="panel-header-row">
              <div class="panel-title-wrap">
                <span class="panel-icon">👥</span>
                <span class="panel-title">JUGADORES EN SALA</span>
              </div>
              <span class="panel-counter-badge" id="playersCountBadge">${room.jugadores.length}/${room.max_jugadores}</span>
            </div>

            <div class="players-list-scroll" id="lobbyPlayersList">
              ${room.jugadores.map((p) => {
                const isSelf = (p.apodo || '').toLowerCase() === myNick;
                return `
                  <div class="player-slot-item ${isSelf ? 'is-self' : ''}">
                    <div class="player-info-meta">
                      <div class="player-name-line">
                        ${p.es_anfitrion ? '<span class="crown-icon">👑</span>' : ''}
                        <span class="p-name">${this.escapeHtml(p.apodo)} ${isSelf ? '<span class="self-tag">(TÚ)</span>' : ''}</span>
                      </div>
                      <div class="player-role-sub">${p.es_anfitrion ? '👑 Anfitrión' : 'Participante'}</div>
                    </div>
                    <div class="player-star-indicator">
                      <span class="star-icon">★</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </section>

          <!-- COLUMNA 2: AJUSTES DE PARTIDA (TABLA: salas_batalla) -->
          <section class="lobby-card-panel settings-card-panel">
            <div class="panel-header-row">
              <div class="panel-title-wrap">
                <span class="panel-icon">⚙️</span>
                <span class="panel-title">AJUSTES DE PARTIDA</span>
              </div>
              <span class="panel-subhint">Configura antes de iniciar</span>
            </div>

            <div class="settings-content-wrap">
              <!-- AJUSTE 1: POKÉMONES -->
              <div class="setting-row-item">
                <div class="setting-label-col">
                  <span class="setting-item-icon">🎴</span>
                  <span class="setting-item-name">Pokemones:</span>
                </div>
                <div class="stepper-controls">
                  <button class="stepper-btn" ${isHost ? '' : 'disabled style="opacity: 0.4;"'} onclick="BatallaModule.adjustPokemonCount(-1)">-</button>
                  <span class="stepper-value" id="settingPokemonVal">${room.pokemon_por_jugador}</span>
                  <button class="stepper-btn" ${isHost ? '' : 'disabled style="opacity: 0.4;"'} onclick="BatallaModule.adjustPokemonCount(1)">+</button>
                </div>
              </div>

              <!-- AJUSTE 2: MÁX. JUGADORES -->
              <div class="setting-row-item">
                <div class="setting-label-col">
                  <span class="setting-item-icon">👥</span>
                  <span class="setting-item-name">Máx. Jugadores:</span>
                </div>
                <div class="stepper-controls">
                  <span class="stepper-value" id="settingMaxPlayersVal">2</span>
                </div>
              </div>

              <!-- RESUMEN DE ESTADÍSTICAS DE LA SALA -->
              <div style="margin-top: auto; padding: 12px; background: rgba(8, 12, 22, 0.6); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); font-size: 0.78rem; color: #94a3b8;">
                <div style="font-weight: 700; color: #38bdf8; margin-bottom: 4px;">📊 Registro de la Sala</div>
                <div>Código ID: <span style="color:#fff; font-family: monospace;">${room.codigo}</span></div>
                <div>Estado: <span style="color:#2ed573;">${room.estado.toUpperCase()}</span></div>
                <div>Creada: <span style="color:#fff;">${new Date(room.creada_en).toLocaleTimeString()}</span></div>
              </div>
            </div>
          </section>

          <!-- COLUMNA 3: CHAT DEL LOBBY (TABLA: sala_mensajes) -->
          <section class="lobby-card-panel chat-card-panel">
            <div class="panel-header-row">
              <div class="panel-title-wrap">
                <span class="panel-icon">💬</span>
                <span class="panel-title">CHAT DEL LOBBY</span>
              </div>
            </div>

            <div class="chat-messages-container" id="lobbyChatContainer">
              ${(room.mensajes || []).map((msg) => `
                <div class="chat-msg-row ${msg.es_sistema ? 'msg-system' : ''}">
                  ${msg.es_sistema
                    ? `<span class="sys-msg">${this.escapeHtml(msg.mensaje)}</span>`
                    : `<strong>${this.escapeHtml(msg.emisor)}:</strong> <span>${this.escapeHtml(msg.mensaje)}</span>`
                  }
                </div>
              `).join('')}
            </div>

            <form class="chat-input-bar" onsubmit="BatallaModule.sendChatMessage(event)">
              <input 
                type="text" 
                id="lobbyChatInput" 
                class="chat-text-input" 
                placeholder="Escribe un mensaje..." 
                autocomplete="off"
              />
              <button type="submit" class="chat-send-btn" title="Enviar">
                <span class="send-icon">➤</span>
              </button>
            </form>
          </section>
        </main>

        <!-- FOOTER DEL LOBBY -->
        <footer class="lobby-footer-bar">
          <div class="lobby-start-action-center" style="width: 100%;">
            <div class="lobby-waiting-hint" id="lobbyWaitingStatusText">
              ${canStart 
                ? '✅ ¡Todos los entrenadores listos! Puedes iniciar la partida.'
                : `⏳ Esperando a que se una al menos 1 amigo para comenzar (${room.jugadores.length}/${room.max_jugadores} jugadores)`
              }
            </div>
            <button 
              class="btn-iniciar-partida ${canStart ? 'ready' : 'disabled'}" 
              id="btnIniciarPartida"
              ${canStart ? '' : 'disabled'}
              onclick="BatallaModule.startMatch()"
            >
              INICIAR PARTIDA
            </button>
          </div>
        </footer>
      </div>
    `;

    this.setupLobbyEvents();
  }

  // ------------------------------------------------------------------
  // GESTIÓN DE EVENTOS: PANTALLA DE ACCESO
  // ------------------------------------------------------------------
  static setupLandingEvents() {
    const isLogged = window.AuthManager && window.AuthManager.isLoggedIn();
    const nickInput = document.getElementById('battleNicknameInput');
    const counter = document.getElementById('apodoCharCounter');
    
    // Solo permitir edición de apodo si el usuario no tiene sesión iniciada
    if (!isLogged && nickInput && counter) {
      nickInput.addEventListener('input', (e) => {
        const val = e.target.value || '';
        this.userNickname = val;
        counter.textContent = `${val.length}/15`;
        localStorage.setItem('stadium_battle_nickname', val);
      });
    }

    const randomBtn = document.getElementById('randomizeNickBtn');
    if (!isLogged && randomBtn) {
      randomBtn.addEventListener('click', () => {
        const sampleNicks = ['Ash', 'Red', 'Blue', 'Gary', 'Cynthia', 'Brock', 'Misty', 'Lance', 'Leon', 'Oak', 'Gold', 'Silver', 'Steven', 'N'];
        const random = sampleNicks[Math.floor(Math.random() * sampleNicks.length)];
        this.userNickname = random;
        if (nickInput) nickInput.value = random;
        if (counter) counter.textContent = `${random.length}/15`;
        localStorage.setItem('stadium_battle_nickname', random);
        if (window.SFX) window.SFX.playCardClick();
      });
    }

    const btnCrear = document.getElementById('btnCrearSala');
    if (btnCrear) {
      btnCrear.addEventListener('click', () => {
        this.createRoom();
      });
    }

    const btnUnirse = document.getElementById('btnUnirseSala');
    if (btnUnirse) {
      btnUnirse.addEventListener('click', () => {
        this.openJoinModal();
      });
    }

    const btnHelp = document.getElementById('btnComoJugar');
    if (btnHelp) {
      btnHelp.addEventListener('click', () => {
        alert('🎮 MODO ARENA STADIUM MULTIJUGADOR:\n\n1. Crea una sala: Se generará un código único de 6 caracteres (ej: PXXE69).\n2. Comparte ese código con tu amigo para que entre pulsando "UNIRSE A SALA".\n3. Ambos aparecerán en la lista de jugadores y podrán comunicarse mediante el chat del lobby.\n4. Configura cuántos Pokémon llevará cada uno (de 1 a 6).\n5. ¡Pulsa "INICIAR PARTIDA" cuando estén listos para el combate!');
      });
    }
  }

  // ------------------------------------------------------------------
  // OPERACIONES DE SALA (INTEGRADAS CON BASE DE DATOS Y STORAGE)
  // ------------------------------------------------------------------
  static createRoom() {
    const nick = (this.userNickname || 'Jose').trim() || 'Entrenador';
    localStorage.setItem('stadium_battle_nickname', nick);

    let room = null;
    if (window.BattleRoomStore) {
      room = window.BattleRoomStore.createRoom({
        hostNickname: nick,
        pokemonCount: 3,
        maxPlayers: 2
      });
    } else {
      // Respaldo en memoria
      const code = 'PXXE' + Math.floor(10 + Math.random() * 90);
      room = {
        codigo: code,
        anfitrion_nombre: nick,
        estado: 'esperando',
        pokemon_por_jugador: 3,
        max_jugadores: 2,
        jugadores: [{ id: '1', apodo: nick, es_anfitrion: true }],
        mensajes: [{ id: 1, emisor: 'SISTEMA', mensaje: `¡Sala ${code} creada!`, es_sistema: true }]
      };
    }

    this.currentRoom = room;
    sessionStorage.setItem('stadium_active_room_code', room.codigo);

    if (window.SFX) window.SFX.playSuccess();
    this.currentScreen = 'lobby';
    this.renderCurrentView();
  }

  static openJoinModal() {
    const modal = document.getElementById('joinRoomModal');
    if (modal) {
      modal.style.display = 'flex';
      const errorDiv = document.getElementById('joinModalErrorMsg');
      if (errorDiv) errorDiv.style.display = 'none';
      const input = document.getElementById('joinRoomCodeInput');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  }

  static closeJoinModal() {
    const modal = document.getElementById('joinRoomModal');
    if (modal) modal.style.display = 'none';
  }

  static submitJoinRoom() {
    const input = document.getElementById('joinRoomCodeInput');
    const code = (input ? input.value : '').trim().toUpperCase();
    const errorDiv = document.getElementById('joinModalErrorMsg');

    if (!code || code.length < 4) {
      if (errorDiv) {
        errorDiv.textContent = 'Por favor ingresa un código de 6 caracteres válido.';
        errorDiv.style.display = 'block';
      }
      return;
    }

    const nick = (this.userNickname || 'Invitado').trim() || 'Entrenador';
    localStorage.setItem('stadium_battle_nickname', nick);

    if (window.BattleRoomStore) {
      const res = window.BattleRoomStore.joinRoom({
        code: code,
        userNickname: nick
      });

      if (!res.ok) {
        if (errorDiv) {
          errorDiv.textContent = res.error;
          errorDiv.style.display = 'block';
        } else {
          alert(res.error);
        }
        return;
      }

      this.currentRoom = res.room;
    }

    sessionStorage.setItem('stadium_active_room_code', code);
    this.closeJoinModal();
    if (window.SFX) window.SFX.playSuccess();
    this.currentScreen = 'lobby';
    this.renderCurrentView();
  }

  static copyRoomCode() {
    if (!this.currentRoom) return;
    navigator.clipboard.writeText(this.currentRoom.codigo).then(() => {
      const badge = document.getElementById('roomCodeBadge');
      if (badge) {
        const original = badge.innerHTML;
        badge.innerHTML = `<span class="room-label">¡COPIADO!</span> <span class="room-code-val">${this.currentRoom.codigo}</span>`;
        setTimeout(() => { badge.innerHTML = original; }, 1800);
      }
    }).catch(() => {
      prompt('Código de sala para compartir:', this.currentRoom.codigo);
    });
  }

  static leaveRoom() {
    if (confirm('¿Deseas salir de la sala de espera?')) {
      if (this.currentRoom && window.BattleRoomStore) {
        window.BattleRoomStore.leaveRoom(this.currentRoom.codigo, this.userNickname);
      }
      sessionStorage.removeItem('stadium_active_room_code');
      this.currentRoom = null;
      this.currentScreen = 'landing';
      this.renderCurrentView();
    }
  }

  static exitBattleModule() {
    if (window.StadiumRouter) {
      window.StadiumRouter.navigate('pokemon');
    }
  }

  // ------------------------------------------------------------------
  // GESTIÓN DEL LOBBY (AJUSTES, CHAT, START)
  // ------------------------------------------------------------------
  static setupLobbyEvents() {
    const chatContainer = document.getElementById('lobbyChatContainer');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  static adjustPokemonCount(delta) {
    if (!this.currentRoom) return;
    let next = this.currentRoom.pokemon_por_jugador + delta;
    if (next < 1) next = 1;
    if (next > 6) next = 6;
    this.currentRoom.pokemon_por_jugador = next;

    if (window.BattleRoomStore) {
      window.BattleRoomStore.updateRoom(this.currentRoom);
    }

    const el = document.getElementById('settingPokemonVal');
    if (el) el.textContent = next;
    if (window.SFX) window.SFX.playCardClick();
  }

  static adjustMaxPlayers(delta) {
    if (!this.currentRoom) return;
    let next = this.currentRoom.max_jugadores + delta;
    if (next < 2) next = 2;
    if (next > 8) next = 8;
    this.currentRoom.max_jugadores = next;

    if (window.BattleRoomStore) {
      window.BattleRoomStore.updateRoom(this.currentRoom);
    }

    const el = document.getElementById('settingMaxPlayersVal');
    if (el) el.textContent = next;
    const badge = document.getElementById('playersCountBadge');
    if (badge) badge.textContent = `${this.currentRoom.jugadores.length}/${next}`;
    if (window.SFX) window.SFX.playCardClick();
  }

  static sendChatMessage(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('lobbyChatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text || !this.currentRoom) return;

    const sender = (this.userNickname || 'Jose').trim();
    input.value = '';

    if (window.BattleRoomStore) {
      window.BattleRoomStore.addMessage(this.currentRoom.codigo, sender, text);
    } else {
      if (!this.currentRoom.mensajes) this.currentRoom.mensajes = [];
      this.currentRoom.mensajes.push({
        id: this.currentRoom.mensajes.length + 1,
        emisor: sender,
        mensaje: text,
        es_sistema: false
      });
    }

    this.renderChatOnly();
    if (window.SFX) window.SFX.playCardClick();
  }

  static startMatch() {
    alert('⚔️ ¡Partida iniciada! Continuando la construcción de las batallas paso a paso...');
  }

  static escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

if (typeof window !== 'undefined') {
  window.BatallaModule = BatallaModule;
}
