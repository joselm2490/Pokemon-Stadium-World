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
        // Si el anfitrión cerró la sala mientras otro estaba adentro o se canceló
        if (updated.estado === 'cancelada') {
          sessionStorage.removeItem('stadium_active_room_code');
          this.currentRoom = null;
          this.currentScreen = 'landing';
          alert('⚠️ El anfitrión ha salido y la sala fue cerrada.');
          this.renderCurrentView();
          return;
        }

        const hadDifferentMessages = JSON.stringify(this.currentRoom.mensajes) !== JSON.stringify(updated.mensajes);
        const hadDifferentPlayers = JSON.stringify(this.currentRoom.jugadores) !== JSON.stringify(updated.jugadores);
        const hadDifferentSettings = this.currentRoom.pokemon_por_jugador !== updated.pokemon_por_jugador || this.currentRoom.max_jugadores !== updated.max_jugadores;
        const hadDifferentFilters = JSON.stringify(this.currentRoom.ajustes) !== JSON.stringify(updated.ajustes);
        const hadDifferentHost = this.currentRoom.anfitrion_nombre !== updated.anfitrion_nombre;
        const enteredCombat = this.currentRoom.estado !== 'en_combate' && updated.estado === 'en_combate';
        
        this.currentRoom = updated;

        if (this.currentScreen === 'lobby') {
          if (enteredCombat) {
            this.renderCurrentView();
            this.showAssignedTeamModal();
          } else if (hadDifferentPlayers || hadDifferentSettings || hadDifferentHost || hadDifferentFilters) {
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

      <!-- MODAL PARA CREAR SALA (CON OPCIÓN DE CONTRASEÑA) -->
      <div class="battle-modal-overlay" id="createRoomModal" style="display: none;">
        <div class="battle-modal-card" style="max-width: 440px;">
          <div class="battle-modal-header">
            <h3>🚀 Crear Nueva Sala</h3>
            <button class="battle-modal-close" onclick="BatallaModule.closeCreateModal()">✕</button>
          </div>
          <div class="battle-modal-body">
            <div class="create-room-form-group">
              <label class="create-room-label">Pokémon por entrenador</label>
              <select id="createRoomPokemonCount" class="create-room-select">
                <option value="1">1 Pokémon (Duelo Rápido)</option>
                <option value="3" selected>3 Pokémon (Formato Estándar)</option>
                <option value="6">6 Pokémon (Combate Completo)</option>
              </select>
            </div>

            <div class="create-room-form-group" style="margin-top: 14px;">
              <label class="password-toggle-row">
                <input type="checkbox" id="createRoomHasPassword" onchange="BatallaModule.toggleCreatePasswordInput()" />
                <span class="password-toggle-text">🔒 Proteger sala con contraseña</span>
              </label>

              <div id="createRoomPasswordContainer" class="password-field-container" style="display: none;">
                <input 
                  type="password" 
                  id="createRoomPasswordInput" 
                  class="create-room-input" 
                  placeholder="Ingresa la contraseña de la sala"
                  maxlength="20"
                  autocomplete="new-password"
                />
                <span style="font-size: 0.76rem; color: #94a3b8; display: block; margin-top: 5px;">
                  Solo los entrenadores que ingresen esta clave podrán unirse.
                </span>
              </div>
            </div>

            <div id="createModalErrorMsg" style="color: #ef4444; font-size: 0.82rem; margin-top: 10px; display: none;"></div>

            <div class="battle-modal-actions" style="margin-top: 22px; display: flex; gap: 10px;">
              <button class="battle-primary-action-btn btn-crear-sala" style="flex: 1; padding: 12px;" onclick="BatallaModule.submitCreateRoom()">
                Confirmar y Crear
              </button>
              <button class="battle-secondary-action-btn" style="width: auto; padding: 12px 18px;" onclick="BatallaModule.closeCreateModal()">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL PARA UNIRSE A SALA: POR CÓDIGO O LISTA DE SALAS DISPONIBLES -->
      <div class="battle-modal-overlay" id="joinRoomModal" style="display: none;">
        <div class="battle-modal-card">
          <div class="battle-modal-header">
            <h3>🔑 Unirse a una Sala</h3>
            <button class="battle-modal-close" onclick="BatallaModule.closeJoinModal()">✕</button>
          </div>

          <!-- PESTAÑAS DE MODAL -->
          <div class="join-modal-tabs">
            <button class="join-tab-btn active" id="tabBtnCode" onclick="BatallaModule.switchJoinTab('code')">
              <span>⌨️</span> Por Código
            </button>
            <button class="join-tab-btn" id="tabBtnRooms" onclick="BatallaModule.switchJoinTab('rooms')">
              <span>🌐</span> Salas Disponibles
            </button>
          </div>

          <!-- CONTENIDO TAB 1: BÚSQUEDA POR CÓDIGO -->
          <div class="join-tab-content" id="joinTabContentCode">
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

            <!-- Campo de contraseña opcional si la sala la requiere -->
            <div id="joinPasswordGroup" style="margin-top: 14px; display: none;">
              <label class="create-room-label">🔒 Esta sala requiere contraseña:</label>
              <input 
                type="password" 
                id="joinRoomPasswordInput" 
                class="create-room-input" 
                placeholder="Contraseña de la sala" 
                maxlength="20"
                autocomplete="off"
              />
            </div>

            <div id="joinModalErrorMsg" style="color: #ef4444; font-size: 0.82rem; margin-top: 10px; display: none;"></div>
            <div class="battle-modal-actions" style="margin-top: 20px; display: flex; gap: 10px;">
              <button class="battle-primary-action-btn btn-crear-sala" style="flex: 1; padding: 12px;" onclick="BatallaModule.submitJoinRoom()">
                Entrar a la Sala
              </button>
              <button class="battle-secondary-action-btn" style="width: auto; padding: 12px 18px;" onclick="BatallaModule.closeJoinModal()">
                Cancelar
              </button>
            </div>
          </div>

          <!-- CONTENIDO TAB 2: EXPLORADOR DE SALAS DISPONIBLES -->
          <div class="join-tab-content" id="joinTabContentRooms" style="display: none;">
            <div class="rooms-browser-header">
              <span class="rooms-browser-title">Salas en vivo</span>
              <button class="btn-refresh-rooms" onclick="BatallaModule.loadAvailableRoomsList()">
                <span>🔄</span> Actualizar
              </button>
            </div>

            <div class="rooms-scroll-list" id="roomsListContainer">
              <div style="text-align: center; color: #94a3b8; padding: 24px;">
                Cargando salas disponibles...
              </div>
            </div>

            <div id="joinRoomsListErrorMsg" style="color: #ef4444; font-size: 0.82rem; margin-top: 10px; display: none;"></div>

            <div class="battle-modal-actions" style="margin-top: 16px; display: flex; justify-content: flex-end;">
              <button class="battle-secondary-action-btn" style="padding: 10px 18px;" onclick="BatallaModule.closeJoinModal()">
                Cerrar
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

        <!-- SUB-BARRA HORIZONTAL: JUGADORES EN SALA (EN UNA SOLA LÍNEA SUTIL ARRIBA) -->
        <div class="lobby-players-horizontal-bar">
          <div class="players-bar-label">
            <span class="players-bar-icon">👥</span>
            <span>JUGADORES:</span>
          </div>
          <div class="players-horizontal-list" id="lobbyPlayersList">
            ${room.jugadores.map((p) => {
              const isSelf = (p.apodo || '').toLowerCase() === myNick;
              return `
                <div class="player-hslot-chip ${isSelf ? 'is-self' : ''}">
                  <span class="player-hslot-badge">${p.es_anfitrion ? '👑 Anfitrión' : '🎮 Invitado'}</span>
                  <span class="player-hslot-name">${this.escapeHtml(p.apodo)} ${isSelf ? '<strong class="self-tag">(TÚ)</strong>' : ''}</span>
                  <span class="player-hslot-star">★</span>
                </div>
              `;
            }).join('')}
            ${room.jugadores.length < (room.max_jugadores || 2) ? `
              <div class="player-hslot-chip is-waiting">
                <span class="waiting-dot-pulse"></span>
                <span class="player-hslot-waiting">Esperando rival...</span>
              </div>
            ` : ''}
          </div>
          <div class="players-bar-count">
            <span class="panel-counter-badge" id="playersCountBadge">${room.jugadores.length}/${room.max_jugadores}</span>
          </div>
        </div>

        <!-- CUERPO PRINCIPAL DEL LOBBY (2 PARTES: IZQUIERDA FILTROS/AJUSTES - DERECHA CHAT) -->
        <main class="lobby-main-grid lobby-two-columns">
          <!-- PARTE IZQUIERDA: TODOS LOS FILTROS Y CONFIGURACIÓN DE LA PARTIDA -->
          <section class="lobby-card-panel settings-card-panel">
            <div class="panel-header-row">
              <div class="panel-title-wrap">
                <span class="panel-icon">⚙️</span>
                <span class="panel-title">AJUSTES Y FILTROS DE PARTIDA</span>
              </div>
              <span class="panel-subhint">Configura las reglas antes de iniciar</span>
            </div>

            <div class="settings-content-wrap">
              <!-- AJUSTES BÁSICOS EN FILA COMPACTA -->
              <div class="settings-summary-grid">
                <!-- AJUSTE 1: POKÉMON -->
                <div class="setting-row-item">
                  <div class="setting-label-col">
                    <span class="setting-item-icon">🎴</span>
                    <span class="setting-item-name">Pokémon por Jugador:</span>
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
                    <span class="setting-item-name">Límite de Jugadores:</span>
                  </div>
                  <div class="stepper-controls">
                    <span class="stepper-value" id="settingMaxPlayersVal">2</span>
                  </div>
                </div>
              </div>

              <!-- FILTRO 1: GENERACIÓN DE POKÉMON -->
              <div class="filter-setting-block">
                <div class="filter-setting-header">
                  <span>🌐</span> Generación:
                </div>
                <div class="filter-pills-row">
                  ${this.renderGenFilterPills(room.ajustes, isHost)}
                </div>
              </div>

              <!-- FILTRO 2: FORMA DE POKÉMON -->
              <div class="filter-setting-block">
                <div class="filter-setting-header">
                  <span>⭐</span> Forma:
                </div>
                <div class="filter-pills-row">
                  ${this.renderFormFilterPills(room.ajustes, isHost)}
                </div>
              </div>

              <!-- FILTRO 3: CATEGORÍAS DE RAREZA -->
              <div class="filter-setting-block">
                <div class="filter-setting-header">
                  <span>🏆</span> Categorías:
                </div>
                <div class="filter-pills-row">
                  ${this.renderCategoryFilterPills(room.ajustes, isHost)}
                </div>
              </div>

              <!-- BARRA INFERIOR DE AJUSTES: POOL & INFO COMPACTA -->
              <div class="pool-status-preview">
                <span>🎯 Criaturas en pool disponibles: <strong class="pool-count-badge" id="poolCountBadge">${this.getFilteredPokemonCount(room.ajustes)} Pokémon</strong></span>
                <span class="room-mini-badge">SALA ID: ${room.codigo}</span>
              </div>
            </div>
          </section>

          <!-- PARTE DERECHA: CHAT DEL LOBBY -->
          <section class="lobby-card-panel chat-card-panel">
            <div class="panel-header-row">
              <div class="panel-title-wrap">
                <span class="panel-icon">💬</span>
                <span class="panel-title">CHAT DE LA SALA</span>
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
                placeholder="Escribe un mensaje en la sala..." 
                autocomplete="off"
              />
              <button type="submit" class="chat-send-btn" title="Enviar mensaje">
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
        this.openCreateModal();
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
  static openCreateModal() {
    const modal = document.getElementById('createRoomModal');
    if (modal) {
      modal.style.display = 'flex';
      const checkbox = document.getElementById('createRoomHasPassword');
      if (checkbox) checkbox.checked = false;
      const passContainer = document.getElementById('createRoomPasswordContainer');
      if (passContainer) passContainer.style.display = 'none';
      const passInput = document.getElementById('createRoomPasswordInput');
      if (passInput) passInput.value = '';
      const err = document.getElementById('createModalErrorMsg');
      if (err) err.style.display = 'none';
    }
  }

  static closeCreateModal() {
    const modal = document.getElementById('createRoomModal');
    if (modal) modal.style.display = 'none';
  }

  static toggleCreatePasswordInput() {
    const checkbox = document.getElementById('createRoomHasPassword');
    const container = document.getElementById('createRoomPasswordContainer');
    const input = document.getElementById('createRoomPasswordInput');
    if (checkbox && container) {
      container.style.display = checkbox.checked ? 'block' : 'none';
      if (checkbox.checked && input) {
        input.focus();
      }
    }
  }

  static async submitCreateRoom() {
    const nick = (this.userNickname || 'Jose').trim() || 'Entrenador';
    localStorage.setItem('stadium_battle_nickname', nick);

    const selectPokemon = document.getElementById('createRoomPokemonCount');
    const pokemonCount = selectPokemon ? parseInt(selectPokemon.value, 10) : 3;

    const hasPassword = document.getElementById('createRoomHasPassword')?.checked;
    const passInput = document.getElementById('createRoomPasswordInput');
    const password = hasPassword && passInput ? passInput.value.trim() : null;

    if (hasPassword && !password) {
      const err = document.getElementById('createModalErrorMsg');
      if (err) {
        err.textContent = 'Por favor escribe la contraseña que deseas asignar a la sala.';
        err.style.display = 'block';
      }
      return;
    }

    let room = null;
    if (window.BattleRoomStore) {
      room = await window.BattleRoomStore.createRoom({
        hostNickname: nick,
        pokemonCount: pokemonCount,
        maxPlayers: 2,
        password: password
      });
    } else {
      const code = 'PXXE' + Math.floor(10 + Math.random() * 90);
      room = {
        codigo: code,
        anfitrion_nombre: nick,
        contrasena: password,
        estado: 'esperando',
        pokemon_por_jugador: pokemonCount,
        max_jugadores: 2,
        jugadores: [{ id: '1', apodo: nick, es_anfitrion: true }],
        mensajes: [{ id: 1, emisor: 'SISTEMA', mensaje: `¡Sala ${code} creada!`, es_sistema: true }]
      };
    }

    this.currentRoom = room;
    sessionStorage.setItem('stadium_active_room_code', room.codigo);

    this.closeCreateModal();
    if (window.SFX) window.SFX.playSuccess();
    this.currentScreen = 'lobby';
    this.renderCurrentView();
  }

  static async createRoom() {
    this.openCreateModal();
  }

  static openJoinModal() {
    const modal = document.getElementById('joinRoomModal');
    if (modal) {
      modal.style.display = 'flex';
      this.switchJoinTab('code');
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

  static switchJoinTab(tabName) {
    const tabBtnCode = document.getElementById('tabBtnCode');
    const tabBtnRooms = document.getElementById('tabBtnRooms');
    const tabContentCode = document.getElementById('joinTabContentCode');
    const tabContentRooms = document.getElementById('joinTabContentRooms');

    if (tabName === 'code') {
      if (tabBtnCode) tabBtnCode.classList.add('active');
      if (tabBtnRooms) tabBtnRooms.classList.remove('active');
      if (tabContentCode) tabContentCode.style.display = 'flex';
      if (tabContentRooms) tabContentRooms.style.display = 'none';
      const input = document.getElementById('joinRoomCodeInput');
      if (input) input.focus();
    } else {
      if (tabBtnCode) tabBtnCode.classList.remove('active');
      if (tabBtnRooms) tabBtnRooms.classList.add('active');
      if (tabContentCode) tabContentCode.style.display = 'none';
      if (tabContentRooms) tabContentRooms.style.display = 'flex';
      this.loadAvailableRoomsList();
    }

    if (window.SFX) window.SFX.playCardClick();
  }

  static async loadAvailableRoomsList() {
    const container = document.getElementById('roomsListContainer');
    const errorDiv = document.getElementById('joinRoomsListErrorMsg');
    if (errorDiv) errorDiv.style.display = 'none';
    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; color: #94a3b8; padding: 24px;">
        <span style="display: inline-block; animation: spin 1s infinite linear;">⚡</span> Consultando salas activas...
      </div>
    `;

    try {
      const rooms = window.BattleRoomStore 
        ? await window.BattleRoomStore.fetchAvailableRooms() 
        : [];

      if (!rooms || rooms.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; color: #64748b; padding: 28px 16px;">
            <p style="font-size: 1.1rem; margin-bottom: 6px;">🕹️ No hay salas creadas en este momento</p>
            <p style="font-size: 0.8rem; color: #94a3b8;">¡Crea la primera sala y desafía a tus amigos!</p>
          </div>
        `;
        return;
      }

      container.innerHTML = rooms.map(room => {
        const estado = (room.estado || 'esperando').toLowerCase();
        const playersCount = room.jugadores_actuales !== undefined 
          ? room.jugadores_actuales 
          : (room.jugadores ? room.jugadores.length : 1);
        
        // REGLA SOLICITADA POR EL USUARIO:
        // Solo unirse a las que estén disponibles (estado esperando Y que solo tenga 1 jugador).
        // Si tiene 2 o más jugadores no se puede unir.
        const isAvailable = (estado === 'esperando') && (playersCount === 1);
        const hasPass = room.tiene_contrasena || !!room.contrasena;

        let statusClass = 'status-badge-esperando';
        let statusLabel = '🟢 DISPONIBLE';

        if (estado !== 'esperando') {
          statusClass = estado === 'en_combate' ? 'status-badge-combate' : 'status-badge-finalizada';
          statusLabel = estado === 'en_combate' ? '⚔️ EN COMBATE' : '⏹️ FINALIZADA';
        } else if (playersCount >= 2) {
          statusClass = 'status-badge-combate';
          statusLabel = '🔴 SALA LLENA';
        }

        const dateStr = room.creada_en 
          ? new Date(room.creada_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
          : '--:--';

        return `
          <div class="room-item-card ${isAvailable ? '' : 'is-full'}">
            <div class="room-info-left">
              <div class="room-code-tag">
                <span>🔑</span> ${this.escapeHtml(room.codigo)}
                ${hasPass ? `<span class="room-password-tag">🔒 Clave</span>` : ''}
              </div>
              <div class="room-host-line">
                Anfitrión: <span class="room-host-name">${this.escapeHtml(room.anfitrion_nombre || 'Entrenador')}</span>
              </div>
              <div class="room-meta-sub">
                <span>🕒 Creada: ${dateStr}</span>
                <span>•</span>
                <span>🎮 ${room.pokemon_por_jugador || 3} vs ${room.pokemon_por_jugador || 3}</span>
              </div>
            </div>

            <div class="room-info-right">
              <span class="room-status-badge ${statusClass}">
                ${statusLabel}
              </span>
              <span class="room-players-pill">
                👥 ${playersCount}/${room.max_jugadores || 2} Jugadores
              </span>
              ${isAvailable ? `
                <button 
                  class="btn-join-room-action"
                  onclick="BatallaModule.joinRoomDirectly('${this.escapeHtml(room.codigo)}', ${hasPass ? 'true' : 'false'})"
                >
                  Unirme
                </button>
              ` : `
                <button class="btn-join-room-action disabled" disabled title="Sala no disponible">
                  ${playersCount >= 2 ? 'Completa' : 'No disponible'}
                </button>
              `}
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Error cargando lista de salas:', err);
      container.innerHTML = `
        <div style="text-align: center; color: #ef4444; padding: 20px;">
          Error al consultar las salas. Intenta nuevamente.
        </div>
      `;
    }
  }

  static async joinRoomDirectly(code, requiresPassword = false) {
    const errorDiv = document.getElementById('joinRoomsListErrorMsg');
    if (errorDiv) errorDiv.style.display = 'none';

    let enteredPassword = '';
    if (requiresPassword) {
      const pass = prompt('🔒 Esta sala es privada. Ingresa la contraseña de la sala:');
      if (pass === null) return; // Cancelado por el usuario
      enteredPassword = pass.trim();
    }

    const nick = (this.userNickname || 'Invitado').trim() || 'Entrenador';
    localStorage.setItem('stadium_battle_nickname', nick);

    if (window.BattleRoomStore) {
      const res = await window.BattleRoomStore.joinRoom({
        code: code,
        userNickname: nick,
        password: enteredPassword
      });

      if (!res.ok) {
        if (res.requiresPassword && !requiresPassword) {
          // Si no sabíamos que tenía clave, volver a solicitar
          return this.joinRoomDirectly(code, true);
        }

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

  static async submitJoinRoom() {
    const input = document.getElementById('joinRoomCodeInput');
    const code = (input ? input.value : '').trim().toUpperCase();
    const errorDiv = document.getElementById('joinModalErrorMsg');
    const passGroup = document.getElementById('joinPasswordGroup');
    const passInput = document.getElementById('joinRoomPasswordInput');
    const enteredPassword = passInput ? passInput.value.trim() : '';

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
      const res = await window.BattleRoomStore.joinRoom({
        code: code,
        userNickname: nick,
        password: enteredPassword
      });

      if (!res.ok) {
        if (res.requiresPassword) {
          if (passGroup) passGroup.style.display = 'block';
          if (passInput) passInput.focus();
        }

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

  // ------------------------------------------------------------------
  // FILTROS Y AJUSTES DE PARTIDA (GENERACIÓN, FORMA, LEGENDARIOS)
  // ------------------------------------------------------------------
  static LEGENDARY_NUMS = new Set([
    144, 145, 146, 150, 151,
    243, 244, 245, 249, 250, 251,
    377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
    480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493,
    494, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,
    716, 717, 718, 719, 720, 721,
    772, 773, 785, 786, 787, 788, 789, 790, 791, 792,
    793, 794, 795, 796, 797, 798, 799, 800, 801, 802, 803, 804, 805, 806, 807, 808, 809,
    888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898, 905,
    1001, 1002, 1003, 1004, 1007, 1008, 1014, 1015, 1016, 1017, 1024, 1025
  ]);

  static REGIONAL_SUFFIXES = ['-Alola', '-Galar', '-Hisui', '-Paldea'];

  static isRegionalPokemon(p) {
    if (!p || !p.name) return false;
    return this.REGIONAL_SUFFIXES.some(suffix => p.name.endsWith(suffix) || p.name.includes(suffix + '-'));
  }

  static isLegendaryPokemon(p) {
    if (!p) return false;
    if (p.categoria_rareza) {
      return p.categoria_rareza === 'legendario';
    }
    return this.LEGENDARY_NUMS.has(p.num);
  }

  static isPseudoLegendaryPokemon(p) {
    if (!p) return false;
    if (p.categoria_rareza) {
      return p.categoria_rareza === 'pseudolegendario';
    }
    return [149, 248, 373, 376, 445, 635, 706, 784, 887, 998].includes(p.num);
  }

  static getPokemonRarityCategory(p) {
    if (!p) return 'estandar';
    if (p.categoria_rareza) return p.categoria_rareza;
    if (this.isLegendaryPokemon(p)) return 'legendario';
    if (this.isPseudoLegendaryPokemon(p)) return 'pseudolegendario';
    return 'estandar';
  }

  static renderGenFilterPills(ajustes = {}, isHost = true) {
    const gens = ajustes.generaciones || ['todas'];
    const allSelected = gens.includes('todas');

    const genItems = [
      { id: 'todas', label: 'Todas' },
      { id: '1', label: 'Gen 1 (Kanto)' },
      { id: '2', label: 'Gen 2 (Johto)' },
      { id: '3', label: 'Gen 3 (Hoenn)' },
      { id: '4', label: 'Gen 4 (Sinnoh)' },
      { id: '5', label: 'Gen 5 (Teselia)' },
      { id: '6', label: 'Gen 6 (Kalos)' },
      { id: '7', label: 'Gen 7 (Alola)' },
      { id: '8', label: 'Gen 8 (Galar/Hisui)' },
      { id: '9', label: 'Gen 9 (Paldea)' }
    ];

    return genItems.map(item => {
      const active = allSelected ? item.id === 'todas' : gens.includes(item.id);
      return `
        <button 
          class="filter-pill-btn ${active ? 'active' : ''}" 
          ${isHost ? '' : 'disabled'}
          onclick="BatallaModule.toggleGenFilter('${item.id}')"
        >
          ${item.label}
        </button>
      `;
    }).join('');
  }

  static renderFormFilterPills(ajustes = {}, isHost = true) {
    const formas = ajustes.formas || ['todas'];
    const allSelected = formas.includes('todas');

    const formItems = [
      { id: 'todas', label: 'Todas' },
      { id: 'estandar', label: 'Estándar' },
      { id: 'regionales', label: '🌎 Regionales' }
    ];

    return formItems.map(item => {
      const active = allSelected ? item.id === 'todas' : formas.includes(item.id);
      return `
        <button 
          class="filter-pill-btn ${active ? 'active' : ''}" 
          ${isHost ? '' : 'disabled'}
          onclick="BatallaModule.toggleFormFilter('${item.id}')"
        >
          ${item.label}
        </button>
      `;
    }).join('');
  }

  static renderCategoryFilterPills(ajustes = {}, isHost = true) {
    const cats = ajustes.categorias || ['todas'];
    const allSelected = cats.includes('todas');

    const catItems = [
      { id: 'todas', label: 'Todas' },
      { id: 'estandar', label: 'Estándar' },
      { id: 'legendario', label: '👑 Legendarios' },
      { id: 'pseudolegendario', label: '🐉 Pseudolegendarios' }
    ];

    return catItems.map(item => {
      const active = allSelected ? item.id === 'todas' : cats.includes(item.id);
      return `
        <button 
          class="filter-pill-btn ${active ? 'active' : ''}" 
          ${isHost ? '' : 'disabled'}
          onclick="BatallaModule.toggleCategoryFilter('${item.id}')"
        >
          ${item.label}
        </button>
      `;
    }).join('');
  }

  static toggleCategoryFilter(catId) {
    if (!this.currentRoom) return;
    if (!this.currentRoom.ajustes) {
      this.currentRoom.ajustes = { generaciones: ['todas'], formas: ['todas'], categorias: ['todas'] };
    }

    let cats = [...(this.currentRoom.ajustes.categorias || ['todas'])];

    if (catId === 'todas') {
      cats = ['todas'];
    } else {
      cats = cats.filter(c => c !== 'todas');
      if (cats.includes(catId)) {
        cats = cats.filter(c => c !== catId);
      } else {
        cats.push(catId);
      }
      if (cats.length === 0) {
        cats = ['todas'];
      }
    }

    this.currentRoom.ajustes.categorias = cats;
    if (window.BattleRoomStore) {
      window.BattleRoomStore.updateRoom(this.currentRoom);
    }
    this.renderCurrentView();
    if (window.SFX) window.SFX.playCardClick();
  }

  static toggleGenFilter(genId) {
    if (!this.currentRoom) return;
    if (!this.currentRoom.ajustes) {
      this.currentRoom.ajustes = { generaciones: ['todas'], formas: ['todas'], categorias: ['todas'] };
    }

    let gens = [...(this.currentRoom.ajustes.generaciones || ['todas'])];

    if (genId === 'todas') {
      gens = ['todas'];
    } else {
      gens = gens.filter(g => g !== 'todas');
      if (gens.includes(genId)) {
        gens = gens.filter(g => g !== genId);
      } else {
        gens.push(genId);
      }
      if (gens.length === 0) {
        gens = ['todas'];
      }
    }

    this.currentRoom.ajustes.generaciones = gens;
    if (window.BattleRoomStore) {
      window.BattleRoomStore.updateRoom(this.currentRoom);
    }
    this.renderCurrentView();
    if (window.SFX) window.SFX.playCardClick();
  }

  static toggleFormFilter(formId) {
    if (!this.currentRoom) return;
    if (!this.currentRoom.ajustes) {
      this.currentRoom.ajustes = { generaciones: ['todas'], formas: ['todas'], categorias: ['todas'] };
    }

    let formas = [...(this.currentRoom.ajustes.formas || ['todas'])];

    if (formId === 'todas') {
      formas = ['todas'];
    } else {
      formas = formas.filter(f => f !== 'todas');
      if (formas.includes(formId)) {
        formas = formas.filter(f => f !== formId);
      } else {
        formas.push(formId);
      }
      if (formas.length === 0) {
        formas = ['todas'];
      }
    }

    this.currentRoom.ajustes.formas = formas;
    if (window.BattleRoomStore) {
      window.BattleRoomStore.updateRoom(this.currentRoom);
    }
    this.renderCurrentView();
    if (window.SFX) window.SFX.playCardClick();
  }

  static getFilteredPokemonPool(ajustes = {}) {
    const all = window.POKEMON_DATA || [];
    const gens = ajustes.generaciones || ['todas'];
    const formas = ajustes.formas || ['todas'];
    const categorias = ajustes.categorias || (ajustes.legendarios === 'si' ? ['todas'] : (ajustes.legendarios === 'no' ? ['estandar', 'pseudolegendario'] : ['todas']));

    return all.filter(p => {
      // 1. Filtro de Categorías de Rareza ('estandar', 'legendario', 'pseudolegendario')
      if (!categorias.includes('todas')) {
        const cat = this.getPokemonRarityCategory(p);
        if (!categorias.includes(cat)) {
          return false;
        }
      }

      // 2. Filtro de Formas
      const isReg = this.isRegionalPokemon(p);
      if (!formas.includes('todas')) {
        const wantsRegional = formas.includes('regionales');
        const wantsStandard = formas.includes('estandar');

        if (isReg && !wantsRegional) return false;
        if (!isReg && !wantsStandard) return false;
      }

      // 3. Filtro de Generaciones
      if (!gens.includes('todas')) {
        const pGen = String(p.gen);
        const matchesGen = gens.includes(pGen);
        if (!matchesGen) return false;
      }

      return true;
    });
  }

  static getFilteredPokemonCount(ajustes = {}) {
    return this.getFilteredPokemonPool(ajustes).length;
  }

  static startMatch() {
    if (!this.currentRoom) return;
    const room = this.currentRoom;
    const canStart = room.jugadores && room.jugadores.length >= 2;

    if (!canStart) {
      alert('Se necesita al menos 2 jugadores para iniciar la partida.');
      return;
    }

    const pool = this.getFilteredPokemonPool(room.ajustes);
    const countNeeded = room.pokemon_por_jugador || 3;

    if (pool.length < countNeeded) {
      alert(`⚠️ No hay suficientes Pokémon en la reserva con los filtros seleccionados (Disponibles: ${pool.length}, Necesarios por jugador: ${countNeeded}). Ajusta los filtros para ampliar la reserva.`);
      return;
    }

    // Seleccionar de manera aleatoria los Pokémon para cada participante
    // con sus ataques predeterminados
    const players = room.jugadores || [];
    const usedIndices = new Set();

    players.forEach(player => {
      const team = [];
      let attempts = 0;
      while (team.length < countNeeded && attempts < 500) {
        attempts++;
        const randIndex = Math.floor(Math.random() * pool.length);
        if (!usedIndices.has(randIndex) || pool.length <= countNeeded * players.length) {
          usedIndices.add(randIndex);
          const basePoke = pool[randIndex];

          // Resolver movimientos predeterminados
          const moveIds = basePoke.movimientos_predeterminados || [];
          const resolvedMoves = [];
          if (window.MOVIMIENTOS_DATA) {
            moveIds.forEach(mid => {
              const m = window.MOVIMIENTOS_DATA.find(mv => mv.id === mid);
              if (m) resolvedMoves.push(m);
            });
          }

          team.push({
            id: basePoke.id,
            num: basePoke.num,
            name: basePoke.name,
            gen: basePoke.gen,
            types: basePoke.types,
            stats: basePoke.stats,
            abilities: basePoke.abilities,
            movimientos: resolvedMoves,
            movimientos_predeterminados: moveIds
          });
        }
      }
      player.equipo_pokemon = team;
      player.listo = true;
    });

    room.estado = 'en_combate';
    room.iniciada_en = new Date().toISOString();

    room.mensajes.push({
      id: (room.mensajes ? room.mensajes.length : 0) + 1,
      emisor: 'SISTEMA',
      mensaje: `⚔️ ¡El combate ha comenzado! Se han asignado ${countNeeded} Pokémon aleatorios con sus movimientos oficiales a cada entrenador.`,
      es_sistema: true,
      enviado_en: new Date().toISOString()
    });

    if (window.BattleRoomStore) {
      window.BattleRoomStore.updateRoom(room);
    }

    if (window.SFX) window.SFX.playSuccess();
    this.renderCurrentView();
    this.showAssignedTeamModal();
  }

  static showAssignedTeamModal() {
    const myNick = (this.userNickname || '').toLowerCase();
    const myPlayer = (this.currentRoom.jugadores || []).find(p => (p.apodo || '').toLowerCase() === myNick);
    if (!myPlayer || !myPlayer.equipo_pokemon || myPlayer.equipo_pokemon.length === 0) return;

    let modal = document.getElementById('assignedTeamModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'assignedTeamModal';
      modal.className = 'battle-modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="battle-modal-card" style="max-width: 650px;">
        <div class="battle-modal-header">
          <h3>🎮 ¡Tu Equipo Pokémon Asignado!</h3>
          <button class="battle-modal-close" onclick="document.getElementById('assignedTeamModal').style.display='none'">✕</button>
        </div>
        <div class="battle-modal-body">
          <p style="color: #94a3b8; font-size: 0.88rem; margin-bottom: 12px;">
            Generados aleatoriamente según los filtros activos de la sala (${this.currentRoom.pokemon_por_jugador} Pokémon con movimientos predeterminados):
          </p>

          <div class="assigned-team-grid">
            ${myPlayer.equipo_pokemon.map(poke => {
              const sprite = window.PokemonModule 
                ? window.PokemonModule.getPokemonSpriteUrl(poke) 
                : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${poke.num}.png`;

              const moveNames = poke.movimientos && poke.movimientos.length > 0 
                ? poke.movimientos.map(m => m.nombre).join(', ') 
                : 'Ataques listos';

              return `
                <div class="assigned-pokemon-card">
                  <img src="${sprite}" alt="${poke.name}" class="assigned-pokemon-img" onerror="this.src='https://play.pokemonshowdown.com/sprites/gen5/${poke.name.toLowerCase()}.png'" />
                  <div class="assigned-pokemon-name">${poke.name}</div>
                  <div class="assigned-pokemon-types">
                    ${(poke.types || []).map(t => `<span class="badge-type type-${t}" style="font-size:0.65rem; padding: 2px 6px;">${t}</span>`).join('')}
                  </div>
                  <div class="assigned-pokemon-moves" title="${moveNames}">
                    ${moveNames}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div class="battle-modal-actions" style="margin-top: 18px; display: flex; justify-content: flex-end;">
            <button class="battle-primary-action-btn btn-crear-sala" style="width: auto; padding: 10px 24px;" onclick="document.getElementById('assignedTeamModal').style.display='none'">
              ¡Entendido, al combate!
            </button>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
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
