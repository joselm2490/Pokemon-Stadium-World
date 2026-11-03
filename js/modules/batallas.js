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
    return '';
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

    // Revisar si la URL o la sesión traen una sala activa
    const urlHash = window.location.hash || '';
    let urlCode = null;
    const match = urlHash.match(/#\/batallas?\/([A-Za-z0-9]+)/i);
    if (match && match[1]) {
      urlCode = match[1].toUpperCase();
    }

    const savedRoomCode = urlCode || sessionStorage.getItem('stadium_active_room_code');
    if (savedRoomCode && window.BattleRoomStore) {
      this.handleRouteRoomCode(savedRoomCode);
    } else {
      this.currentScreen = 'landing';
      this.renderCurrentView();
    }
  }

  static async handleRouteRoomCode(roomCode) {
    if (!roomCode) {
      if (this.currentRoom && this.currentScreen === 'lobby') {
        this.renderCurrentView();
        return;
      }
      this.currentScreen = 'landing';
      this.renderCurrentView();
      return;
    }

    const code = roomCode.trim().toUpperCase();
    this.syncUserNickname();

    if (window.BattleRoomStore) {
      let room = await window.BattleRoomStore.getRoomDetails(code);
      if (room && (room.estado === 'esperando' || room.estado === 'en_combate')) {
        this.currentRoom = room;
        this.currentScreen = room.estado === 'en_combate' ? 'battle' : 'lobby';
        sessionStorage.setItem('stadium_active_room_code', code);
        window.BattleRoomStore.setActiveRoomCode(code);
        if (window.StadiumRouter) {
          window.StadiumRouter.updateBattleRoomUrl(code);
        }
        this.renderCurrentView();
        return;
      }
    }

    // Si la sala no existe o está finalizada, volver a landing
    sessionStorage.removeItem('stadium_active_room_code');
    if (window.StadiumRouter) {
      window.StadiumRouter.updateBattleRoomUrl(null);
    }
    this.currentRoom = null;
    this.currentScreen = 'landing';
    this.renderCurrentView();
  }

  static handleStoreUpdate(eventType, data) {
    if (!this.currentRoom) return;

    // Si la sala activa fue actualizada en otra pestaña o mediante Supabase/Storage
    if (window.BattleRoomStore) {
      if (eventType === 'room_expired' && data && data.codigo === this.currentRoom.codigo) {
        sessionStorage.removeItem('stadium_active_room_code');
        if (window.StadiumRouter) window.StadiumRouter.updateBattleRoomUrl(null);
        this.currentRoom = null;
        this.currentScreen = 'landing';
        alert('⌛ El tiempo de espera (5 minutos) ha expirado. La sala se ha cerrado automáticamente.');
        this.renderCurrentView();
        return;
      }

      const updated = window.BattleRoomStore.getRoomByCode(this.currentRoom.codigo);
      if (updated) {
        // Si el anfitrión cerró la sala mientras otro estaba adentro o se canceló
        if (updated.estado === 'cancelada') {
          sessionStorage.removeItem('stadium_active_room_code');
          if (window.StadiumRouter) window.StadiumRouter.updateBattleRoomUrl(null);
          this.currentRoom = null;
          this.currentScreen = 'landing';
          alert('⚠️ El anfitrión ha salido y la sala fue cerrada.');
          this.renderCurrentView();
          return;
        }

        // Si la sala pasó a finalizada (por ejemplo el rival se rindió y abandonó)
        if (updated.estado === 'finalizada') {
          sessionStorage.removeItem('stadium_active_room_code');
          if (window.StadiumRouter) window.StadiumRouter.updateBattleRoomUrl(null);
          
          // Desconectar proceso de Showdown
          try {
            const iframe = document.getElementById('showdownBattleFrame');
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage({ type: 'stadium-forfeit-and-close' }, '*');
            }
          } catch (e) {}

          const ganador = updated.ganador;
          const myNick = (this.userNickname || '').toLowerCase();
          const iWon = (ganador || '').toLowerCase() === myNick;

          const msg = iWon 
            ? `🏆 ¡TU RIVAL SE RINDIÓ! Has ganado el combate. La sala y el duelo han finalizado.`
            : `⌛ La sala y el combate han finalizado.`;

          alert(msg);
          this.currentRoom = null;
          this.currentScreen = 'landing';
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

        if (this.currentRoom.estado === 'en_combate' || this.currentScreen === 'battle') {
          if (enteredCombat) {
            // Mostrar modal de carga breve para el invitado mientras se adapta la interfaz
            this.showBattleLoadingModal('¡El anfitrión inició la partida! Cargando arena y configurando combate...');
            setTimeout(() => {
              this.hideBattleLoadingModal();
              this.currentScreen = 'battle';
              this.renderCurrentView();
              this.showAssignedTeamModal();
            }, 700);
            return;
          }
          this.currentScreen = 'battle';
          this.renderCurrentView();
          return;
        }

        if (this.currentScreen === 'lobby') {
          if (enteredCombat) {
            this.currentScreen = 'battle';
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
    } else if (this.currentScreen === 'battle') {
      this.renderBattleScreen(container);
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
            <!-- BLOQUE DE SESIÓN / APODO (REQUERIDO LOGIN PARA BATALLAS) -->
            ${isLogged ? `
              <div class="apodo-field-group">
                <div class="apodo-label-row">
                  <span class="apodo-label">
                    <span class="label-user-icon">👤</span> ENTRENADOR CONECTADO <span class="apodo-locked-tag">(Verificado)</span>
                  </span>
                </div>
                <div class="apodo-input-wrapper is-locked" style="background: rgba(14, 116, 144, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 10px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
                  <span style="font-weight: 800; color: #fff; font-size: 1.05rem; letter-spacing: 0.5px;">
                    ${this.escapeHtml(this.userNickname)}
                  </span>
                  <span style="font-size: 0.85rem; color: #38bdf8; font-weight: 700;">🟢 Listo para combatir</span>
                </div>
              </div>

              <!-- BOTONES DE ACCIÓN PARA USUARIO LOGUEADO -->
              <button class="battle-primary-action-btn btn-crear-sala" id="btnCrearSala">
                <span class="btn-action-icon">🚀</span>
                <span class="btn-action-text">CREAR SALA</span>
              </button>

              <button class="battle-primary-action-btn btn-unirse-sala" id="btnUnirseSala">
                <span class="btn-action-icon">🔑</span>
                <span class="btn-action-text">UNIRSE A SALA</span>
              </button>
            ` : `
              <div class="battle-auth-required-box" style="padding: 16px 14px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; margin-bottom: 16px; text-align: center;">
                <div style="font-size: 1.6rem; margin-bottom: 6px;">🔐</div>
                <div style="font-size: 0.92rem; font-weight: 800; color: #38bdf8; margin-bottom: 4px;">ACCESO REQUERIDO</div>
                <p style="font-size: 0.78rem; color: #94a3b8; margin: 0 0 14px 0; line-height: 1.4;">
                  Para crear o unirte a salas multijugador debes iniciar sesión o registrarte con tu cuenta de entrenador.
                </p>
                
                <div style="display: flex; gap: 8px;">
                  <button class="battle-primary-action-btn" id="btnLandingLogin" style="flex: 1; padding: 10px; font-size: 0.85rem;">
                    Ingresar
                  </button>
                  <button class="battle-secondary-action-btn" id="btnLandingRegister" style="flex: 1; padding: 10px; font-size: 0.85rem; width: auto;">
                    Registrarse
                  </button>
                </div>
              </div>

              <!-- BOTONES DE SALA DESHABILITADOS QUE PIDEN INICIAR SESIÓN -->
              <button class="battle-primary-action-btn btn-crear-sala" id="btnCrearSala" style="opacity: 0.6;">
                <span class="btn-action-icon">🚀</span>
                <span class="btn-action-text">CREAR SALA (Requiere Login)</span>
              </button>

              <button class="battle-primary-action-btn btn-unirse-sala" id="btnUnirseSala" style="opacity: 0.6;">
                <span class="btn-action-icon">🔑</span>
                <span class="btn-action-text">UNIRSE A SALA (Requiere Login)</span>
              </button>
            `}

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
              oninput="BatallaModule.handleJoinCodeInput(this.value)"
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

      <!-- MODAL ESTILO STADIUM PARA INGRESAR CONTRASEÑA DE SALA PRIVADA -->
      <div class="battle-modal-overlay" id="roomPasswordPromptModal" style="display: none;">
        <div class="battle-modal-card" style="max-width: 420px; animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
          <div class="battle-modal-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.3rem;">🔒</span>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: #f1f5f9;">Sala Privada</h3>
            </div>
            <button class="battle-modal-close" onclick="BatallaModule.closePasswordPromptModal()">✕</button>
          </div>
          <div class="battle-modal-body" style="padding-top: 8px;">
            <p style="color: #94a3b8; font-size: 0.88rem; margin-bottom: 14px; line-height: 1.4;">
              Esta sala está protegida con contraseña. Ingrésala para poder unirte a la partida:
            </p>
            <div class="create-room-form-group">
              <input 
                type="password" 
                id="promptRoomPasswordInput" 
                class="create-room-input" 
                placeholder="Escribe la contraseña de la sala..." 
                maxlength="25" 
                autocomplete="off" 
              />
            </div>
            <div id="promptPasswordErrorMsg" style="color: #ef4444; font-size: 0.82rem; margin-top: 10px; display: none;"></div>
            <div class="battle-modal-actions" style="margin-top: 20px; display: flex; gap: 10px;">
              <button class="battle-primary-action-btn" id="btnSubmitPasswordPrompt" style="flex: 1; padding: 11px;">
                Confirmar y Entrar
              </button>
              <button class="battle-secondary-action-btn" onclick="BatallaModule.closePasswordPromptModal()" style="width: auto; padding: 11px 18px;">
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
    const hasEnoughPlayers = room.jugadores && room.jugadores.length >= 2;

    // Buscar estado del invitado
    const guestPlayer = (room.jugadores || []).find(p => !p.es_anfitrion);
    const guestIsReady = guestPlayer ? (guestPlayer.listo === true || guestPlayer.listo === 1) : false;

    // Buscar si yo mismo (en caso de ser invitado) estoy listo
    const myPlayer = (room.jugadores || []).find(p => (p.apodo || '').toLowerCase() === myNick);
    const amIReady = myPlayer ? (myPlayer.listo === true || myPlayer.listo === 1) : false;

    // El anfitrión solo puede iniciar si hay al menos 2 jugadores y el invitado está listo
    const canStartHost = isHost && hasEnoughPlayers && guestIsReady;

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
            ${room.contrasena ? `
              <div class="room-code-tag room-password-tag" style="background: rgba(234, 179, 8, 0.18); border-color: #eab308; color: #facc15;" title="Contraseña de la sala para compartir con tu rival">
                <span class="room-label" style="color: #fef08a;">CLAVE:</span>
                <span class="room-code-val" style="color: #fff;">${this.escapeHtml(room.contrasena)}</span>
                <span style="font-size: 0.85rem;">🔒</span>
              </div>
            ` : ''}
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
              const isReady = p.es_anfitrion ? true : (p.listo === true || p.listo === 1);
              return `
                <div class="player-hslot-chip ${isSelf ? 'is-self' : ''}" style="${isReady ? 'border-color: rgba(34, 197, 94, 0.5); background: rgba(34, 197, 94, 0.12);' : ''}">
                  <span class="player-hslot-badge">${p.es_anfitrion ? '👑 Anfitrión' : '🎮 Invitado'}</span>
                  <span class="player-hslot-name">${this.escapeHtml(p.apodo)} ${isSelf ? '<strong class="self-tag">(TÚ)</strong>' : ''}</span>
                  ${p.es_anfitrion ? '<span class="player-hslot-star">★</span>' : (isReady ? '<span style="color: #4ade80; font-size: 0.82rem; font-weight: 800;">✔ LISTO</span>' : '<span style="color: #94a3b8; font-size: 0.78rem;">⏳ Esperando...</span>')}
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
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="room-mini-badge">SALA: ${room.codigo}</span>
                  ${room.contrasena ? `<span class="room-mini-badge" style="color: #facc15; border-color: rgba(234, 179, 8, 0.4); background: rgba(234, 179, 8, 0.15);">🔒 CLAVE: ${this.escapeHtml(room.contrasena)}</span>` : ''}
                </div>
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
              ${isHost 
                ? (canStartHost 
                    ? '✅ ¡Tu rival está listo! Puedes iniciar el combate.' 
                    : (hasEnoughPlayers 
                        ? '⏳ Esperando a que el invitado presione ¡LISTO!' 
                        : `⏳ Esperando a que se una tu rival (${room.jugadores.length}/${room.max_jugadores} jugadores)`))
                : (amIReady 
                    ? '✅ ¡Estás listo! Esperando a que el anfitrión inicie la partida...' 
                    : '👉 Presiona "¡LISTO!" para confirmar que estás preparado para el combate.')
              }
            </div>

            ${isHost ? `
              <button 
                class="btn-iniciar-partida ${canStartHost ? 'ready' : 'disabled'}" 
                id="btnIniciarPartida"
                ${canStartHost ? '' : 'disabled'}
                onclick="BatallaModule.startMatch()"
                style="${canStartHost ? 'background: #22c55e; box-shadow: 0 4px 18px rgba(34, 197, 94, 0.4);' : ''}"
              >
                INICIAR PARTIDA
              </button>
            ` : `
              <button 
                class="btn-iniciar-partida ${amIReady ? 'ready' : 'ready'}" 
                id="btnInvitadoListo"
                onclick="BatallaModule.toggleGuestReady()"
                style="${amIReady 
                  ? 'background: #22c55e; color: #fff; box-shadow: 0 4px 18px rgba(34, 197, 94, 0.45);' 
                  : 'background: #0284c7; color: #fff; box-shadow: 0 4px 18px rgba(2, 132, 199, 0.4);'}"
              >
                ${amIReady ? '✔ ¡ESTOY LISTO!' : '⚡ ¡LISTO!'}
              </button>
            `}
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

    const btnLogin = document.getElementById('btnLandingLogin');
    if (btnLogin) {
      btnLogin.addEventListener('click', () => {
        if (window.AuthManager) window.AuthManager.openModal('login');
      });
    }

    const btnRegister = document.getElementById('btnLandingRegister');
    if (btnRegister) {
      btnRegister.addEventListener('click', () => {
        if (window.AuthManager) window.AuthManager.openModal('register');
      });
    }

    const btnCrear = document.getElementById('btnCrearSala');
    if (btnCrear) {
      btnCrear.addEventListener('click', () => {
        if (!isLogged) {
          if (window.AuthManager) window.AuthManager.openModal('login');
          return;
        }
        this.openCreateModal();
      });
    }

    const btnUnirse = document.getElementById('btnUnirseSala');
    if (btnUnirse) {
      btnUnirse.addEventListener('click', () => {
        if (!isLogged) {
          if (window.AuthManager) window.AuthManager.openModal('login');
          return;
        }
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
    if (!window.AuthManager || !window.AuthManager.isLoggedIn()) {
      if (window.AuthManager) window.AuthManager.openModal('login');
      return;
    }
    const nick = (this.userNickname || '').trim();
    if (!nick) {
      alert('Debes iniciar sesión para crear una sala.');
      if (window.AuthManager) window.AuthManager.openModal('login');
      return;
    }

    const pokemonCount = 3; // Valor inicial por defecto (se configura y ajusta libremente adentro de la sala)

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
      try {
        room = await window.BattleRoomStore.createRoom({
          hostNickname: nick,
          pokemonCount: pokemonCount,
          maxPlayers: 2,
          password: password
        });
      } catch (err) {
        const errDiv = document.getElementById('createModalErrorMsg');
        if (errDiv) {
          errDiv.textContent = err.message || 'Error creando sala.';
          errDiv.style.display = 'block';
        } else {
          alert(err.message);
        }
        return;
      }
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
    if (window.StadiumRouter) {
      window.StadiumRouter.updateBattleRoomUrl(room.codigo);
    }

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
      const passGroup = document.getElementById('joinPasswordGroup');
      if (passGroup) passGroup.style.display = 'none';
      const passInput = document.getElementById('joinRoomPasswordInput');
      if (passInput) passInput.value = '';
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
    const passGroup = document.getElementById('joinPasswordGroup');
    if (passGroup) passGroup.style.display = 'none';
    const passInput = document.getElementById('joinRoomPasswordInput');
    if (passInput) passInput.value = '';
    const errorDiv = document.getElementById('joinModalErrorMsg');
    if (errorDiv) errorDiv.style.display = 'none';
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

  static openPasswordPromptModal(code) {
    const modal = document.getElementById('roomPasswordPromptModal');
    if (!modal) return;
    const input = document.getElementById('promptRoomPasswordInput');
    const errDiv = document.getElementById('promptPasswordErrorMsg');
    const btnSubmit = document.getElementById('btnSubmitPasswordPrompt');

    if (errDiv) errDiv.style.display = 'none';
    if (input) {
      input.value = '';
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          BatallaModule.submitPasswordPrompt(code);
        }
      };
    }

    if (btnSubmit) {
      btnSubmit.onclick = () => BatallaModule.submitPasswordPrompt(code);
    }

    modal.style.display = 'flex';
    setTimeout(() => {
      if (input) input.focus();
    }, 50);
  }

  static closePasswordPromptModal() {
    const modal = document.getElementById('roomPasswordPromptModal');
    if (modal) modal.style.display = 'none';
    const input = document.getElementById('promptRoomPasswordInput');
    if (input) input.value = '';
    const errDiv = document.getElementById('promptPasswordErrorMsg');
    if (errDiv) errDiv.style.display = 'none';
  }

  static async submitPasswordPrompt(code) {
    const input = document.getElementById('promptRoomPasswordInput');
    const errDiv = document.getElementById('promptPasswordErrorMsg');
    const pass = (input ? input.value : '').trim();

    if (!pass) {
      if (errDiv) {
        errDiv.textContent = 'Por favor ingresa la contraseña.';
        errDiv.style.display = 'block';
      }
      return;
    }

    const nick = (this.userNickname || '').trim();
    if (!nick) {
      if (window.AuthManager) window.AuthManager.openModal('login');
      return;
    }

    if (window.BattleRoomStore) {
      const res = await window.BattleRoomStore.joinRoom({
        code: code,
        userNickname: nick,
        password: pass
      });

      if (!res.ok) {
        if (errDiv) {
          errDiv.textContent = res.error || 'Contraseña incorrecta o error al entrar.';
          errDiv.style.display = 'block';
        }
        return;
      }

      this.currentRoom = res.room;
    }

    this.closePasswordPromptModal();
    sessionStorage.setItem('stadium_active_room_code', code);
    if (window.StadiumRouter) {
      window.StadiumRouter.updateBattleRoomUrl(code);
    }
    this.closeJoinModal();
    if (window.SFX) window.SFX.playSuccess();
    this.currentScreen = 'lobby';
    this.renderCurrentView();
  }

  static async joinRoomDirectly(code, requiresPassword = false) {
    if (!window.AuthManager || !window.AuthManager.isLoggedIn()) {
      if (window.AuthManager) window.AuthManager.openModal('login');
      return;
    }
    const nick = (this.userNickname || '').trim();
    if (!nick) {
      alert('Debes iniciar sesión para unirte a una sala.');
      if (window.AuthManager) window.AuthManager.openModal('login');
      return;
    }

    const errorDiv = document.getElementById('joinRoomsListErrorMsg');
    if (errorDiv) errorDiv.style.display = 'none';

    if (requiresPassword) {
      this.openPasswordPromptModal(code);
      return;
    }

    if (window.BattleRoomStore) {
      const res = await window.BattleRoomStore.joinRoom({
        code: code,
        userNickname: nick,
        password: ''
      });

      if (!res.ok) {
        if (res.requiresPassword) {
          // Si requería clave y no lo sabíamos, abrir el modal de contraseña
          return this.openPasswordPromptModal(code);
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
    if (window.StadiumRouter) {
      window.StadiumRouter.updateBattleRoomUrl(code);
    }
    this.closeJoinModal();
    if (window.SFX) window.SFX.playSuccess();
    this.currentScreen = 'lobby';
    this.renderCurrentView();
  }

  static async handleJoinCodeInput(code) {
    const cleanCode = (code || '').trim().toUpperCase();
    const passGroup = document.getElementById('joinPasswordGroup');
    const passInput = document.getElementById('joinRoomPasswordInput');
    const errorDiv = document.getElementById('joinModalErrorMsg');

    if (errorDiv) errorDiv.style.display = 'none';

    if (cleanCode.length === 6 && window.BattleRoomStore) {
      try {
        const room = await window.BattleRoomStore.getRoomDetails(cleanCode);
        if (room && (room.contrasena || room.tiene_contrasena)) {
          if (passGroup) passGroup.style.display = 'block';
          if (passInput) passInput.focus();
        } else {
          if (passGroup) passGroup.style.display = 'none';
        }
      } catch (e) {
        console.warn('Error verificando contraseña de sala:', e);
      }
    } else {
      if (cleanCode.length < 6 && passGroup) {
        passGroup.style.display = 'none';
      }
    }
  }

  static async submitJoinRoom() {
    if (!window.AuthManager || !window.AuthManager.isLoggedIn()) {
      if (window.AuthManager) window.AuthManager.openModal('login');
      return;
    }
    const nick = (this.userNickname || '').trim();
    if (!nick) {
      alert('Debes iniciar sesión para unirte a una sala.');
      if (window.AuthManager) window.AuthManager.openModal('login');
      return;
    }

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
    if (window.StadiumRouter) {
      window.StadiumRouter.updateBattleRoomUrl(code);
    }
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
    const inCombat = this.currentRoom && this.currentRoom.estado === 'en_combate';

    if (inCombat) {
      this.showCombatSurrenderModal();
    } else {
      this.showLobbyLeaveModal();
    }
  }

  /**
   * Modal de confirmación al salir de la SALA DE ESPERA (antes de iniciar la partida)
   */
  static showLobbyLeaveModal() {
    let modal = document.getElementById('lobbyLeaveConfirmModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'lobbyLeaveConfirmModal';
      modal.className = 'battle-modal-overlay';
      document.body.appendChild(modal);
    }

    const isHost = this.currentRoom && ((this.currentRoom.anfitrion_nombre || '').toLowerCase() === (this.userNickname || '').toLowerCase());
    const warningText = isHost
      ? 'Eres el anfitrión de la sala. Si sales y no hay más jugadores, la sala se cancelará. Si hay otro jugador, se le asignará el mando de la sala.'
      : 'Saldrás de la sala de espera y volverás al menú principal de duelos.';

    modal.innerHTML = `
      <div class="battle-modal-card" style="max-width: 460px; text-align: center;">
        <div class="battle-modal-header" style="justify-content: center;">
          <h3 style="color: #facc15; font-size: 1.15rem;">🚪 Salir de la Sala de Espera</h3>
        </div>
        <div class="battle-modal-body" style="padding: 20px 16px;">
          <p style="color: #e2e8f0; font-size: 0.95rem; margin-bottom: 12px; line-height: 1.5;">
            ¿Estás seguro de que deseas salir de la sala?
          </p>
          <p style="color: #94a3b8; font-size: 0.82rem; margin-bottom: 24px; line-height: 1.4;">
            ${warningText}
          </p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button class="battle-secondary-btn" onclick="document.getElementById('lobbyLeaveConfirmModal').style.display='none'" style="flex: 1; padding: 10px;">
              Cancelar
            </button>
            <button class="battle-primary-action-btn" onclick="BatallaModule.confirmLobbyLeave()" style="flex: 1; padding: 10px; background: #ef4444; border-color: #f87171;">
              Sí, Salir
            </button>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  }

  static async confirmLobbyLeave() {
    const modal = document.getElementById('lobbyLeaveConfirmModal');
    if (modal) modal.style.display = 'none';

    if (this.currentRoom && window.BattleRoomStore) {
      await window.BattleRoomStore.leaveRoom(this.currentRoom.codigo, this.userNickname);
    }
    sessionStorage.removeItem('stadium_active_room_code');
    if (window.StadiumRouter) {
      window.StadiumRouter.updateBattleRoomUrl(null);
    }
    this.currentRoom = null;
    this.currentScreen = 'landing';
    this.renderCurrentView();
  }

  /**
   * Modal de advertencia estricta en COMBATE:
   * Si sale, se toma como derrota inmediata por abandono y victoria al rival.
   */
  static showCombatSurrenderModal() {
    let modal = document.getElementById('combatSurrenderConfirmModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'combatSurrenderConfirmModal';
      modal.className = 'battle-modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="battle-modal-card" style="max-width: 480px; text-align: center; border: 2px solid rgba(239, 68, 68, 0.6); box-shadow: 0 0 35px rgba(239, 68, 68, 0.45);">
        <div class="battle-modal-header" style="justify-content: center; background: rgba(239, 68, 68, 0.15);">
          <h3 style="color: #ef4444; font-size: 1.2rem; display: flex; align-items: center; gap: 8px;">
            ⚠️ ¡ADVERTENCIA DE RENDICIÓN!
          </h3>
        </div>
        <div class="battle-modal-body" style="padding: 24px 18px;">
          <p style="color: #f87171; font-weight: 800; font-size: 1.05rem; margin-bottom: 10px;">
            ¡El combate está en curso!
          </p>
          <p style="color: #e2e8f0; font-size: 0.92rem; margin-bottom: 16px; line-height: 1.5;">
            Si decides salir ahora, se te considerará como <strong>DERROTA INMEDIATA</strong> y se le otorgará la <strong>VICTORIA OFICIAL AL RIVAL</strong> por abandono.
          </p>
          <div style="background: rgba(15, 23, 42, 0.8); border: 1px dashed rgba(239, 68, 68, 0.4); border-radius: 8px; padding: 12px; margin-bottom: 24px; text-align: left; font-size: 0.8rem; color: #94a3b8;">
            <p style="margin: 0 0 4px 0;">⚡ El combate y la sala se darán por finalizados.</p>
            <p style="margin: 0;">🛑 Se detendrán y cerrarán todos los procesos de Showdown y la conexión en segundo plano.</p>
          </div>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button class="battle-secondary-btn" onclick="document.getElementById('combatSurrenderConfirmModal').style.display='none'" style="flex: 1; padding: 12px; font-weight: 700;">
              Seguir Luchando
            </button>
            <button class="battle-primary-action-btn" onclick="BatallaModule.confirmCombatSurrender()" style="flex: 1; padding: 12px; background: #dc2626; border-color: #ef4444; box-shadow: 0 4px 15px rgba(220, 38, 38, 0.5);">
              🏳️ Rendirme y Salir
            </button>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  }

  static async confirmCombatSurrender() {
    const modal = document.getElementById('combatSurrenderConfirmModal');
    if (modal) modal.style.display = 'none';

    // 1. Notificar al iframe de Showdown que envíe /forfeit y desconecte el socket para limpiar el proceso
    try {
      const iframe = document.getElementById('showdownBattleFrame');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'stadium-forfeit-and-close' }, '*');
      }
    } catch (e) {}

    // 2. Dar por finalizada la batalla en el store y declarar victoria al rival
    if (this.currentRoom && window.BattleRoomStore) {
      await window.BattleRoomStore.leaveRoom(this.currentRoom.codigo, this.userNickname);
    }

    sessionStorage.removeItem('stadium_active_room_code');
    if (window.StadiumRouter) {
      window.StadiumRouter.updateBattleRoomUrl(null);
    }
    this.currentRoom = null;
    this.currentScreen = 'landing';
    this.renderCurrentView();
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

  static async toggleGuestReady() {
    if (!this.currentRoom) return;
    const nick = (this.userNickname || '').trim();
    if (!nick) return;

    if (window.BattleRoomStore) {
      const updated = await window.BattleRoomStore.togglePlayerReady(this.currentRoom.codigo, nick);
      if (updated) {
        this.currentRoom = updated;
        if (window.SFX) window.SFX.playSuccess();
        this.renderCurrentView();
      }
    }
  }

  static showBattleLoadingModal(message = 'Creando batalla, por favor espere...') {
    let modal = document.getElementById('battleLoadingOverlayModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'battleLoadingOverlayModal';
      modal.className = 'battle-modal-overlay';
      modal.style.zIndex = '9999';
      modal.style.background = 'rgba(4, 7, 14, 0.92)';
      modal.style.backdropFilter = 'blur(10px)';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="battle-modal-card" style="max-width: 440px; text-align: center; padding: 36px 24px; border: 1px solid rgba(56, 189, 248, 0.35); box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(56, 189, 248, 0.2);">
        <div class="pokeball-loading-spinner" style="margin: 0 auto 20px; width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(180deg, #ff1744 48%, #0f172a 48%, #0f172a 52%, #f8fafc 52%); border: 4px solid #0f172a; box-shadow: 0 0 20px rgba(255, 23, 68, 0.6); position: relative; animation: stadiumSpin 1s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;">
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 20px; height: 20px; background: #fff; border: 4px solid #0f172a; border-radius: 50%; box-shadow: 0 0 10px #00e5ff;"></div>
        </div>
        <h3 style="color: #38bdf8; font-size: 1.25rem; font-weight: 900; margin-bottom: 8px; letter-spacing: 0.5px;">
          ⚔️ CREANDO BATALLA
        </h3>
        <p id="battleLoadingStatusText" style="color: #cbd5e1; font-size: 0.92rem; line-height: 1.5; margin: 0;">
          ${this.escapeHtml(message)}
        </p>
        <div style="margin-top: 18px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.75rem; color: #94a3b8; font-family: monospace;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #22c55e; animation: pulseLight 1s infinite alternate;"></span>
          <span>Configurando Pokémon, ataques y arena...</span>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  }

  static hideBattleLoadingModal() {
    const modal = document.getElementById('battleLoadingOverlayModal');
    if (modal) modal.style.display = 'none';
  }

  static async startMatch() {
    if (!this.currentRoom) return;
    const room = this.currentRoom;
    const canStart = room.jugadores && room.jugadores.length >= 2;

    if (!canStart) {
      alert('Se necesita al menos 2 jugadores para iniciar la partida.');
      return;
    }

    // El anfitrión solo puede iniciar si el rival (invitado) ha marcado ¡LISTO!
    const guestPlayer = (room.jugadores || []).find(p => !p.es_anfitrion);
    if (guestPlayer && !(guestPlayer.listo === true || guestPlayer.listo === 1)) {
      alert('⚠️ Tu rival aún no está listo. Debe presionar el botón "¡LISTO!" antes de poder iniciar el combate.');
      return;
    }

    // Mostrar modal de carga inmediatamente para el anfitrión
    this.showBattleLoadingModal('Generando equipos Pokémon y configurando arena de combate...');

    // Permitir que el navegador dibuje el modal antes del cálculo
    await new Promise(r => setTimeout(r, 60));

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

    // Inicializar estado de combate interactivo por turnos
    if (window.StadiumBattleEngine) {
      room.battle_state = window.StadiumBattleEngine.initBattleState(room);
    }

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

    // Ocultar modal de carga tras completar la preparación
    setTimeout(() => {
      this.hideBattleLoadingModal();
    }, 400);

    if (window.SFX) window.SFX.playSuccess();
    this.currentScreen = 'battle';
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
            <button class="battle-primary-action-btn btn-crear-sala" style="width: auto; padding: 10px 24px;" onclick="document.getElementById('assignedTeamModal').style.display='none'; BatallaModule.currentScreen='battle'; BatallaModule.renderCurrentView();">
              ¡Entendido, al combate!
            </button>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  }

  /**
   * Empaqueta el equipo Pokémon asignado al formato estándar de Showdown
   * para enviarlo al cliente embebido en gen9customgame.
   */
  static packTeamForShowdown(pokemonList) {
    if (!pokemonList || !Array.isArray(pokemonList) || pokemonList.length === 0) return '';
    
    return pokemonList.map(poke => {
      const name = (poke.name || poke.id || 'Pokemon').replace(/[^A-Za-z0-9\-]/g, '');
      const species = (poke.nombre_ingles || poke.name || name).replace(/[^A-Za-z0-9\-]/g, '');
      const item = '';
      const ability = (poke.abilities && poke.abilities.length > 0) ? poke.abilities[0] : '';
      
      // Obtener nombres en inglés de los movimientos predeterminados
      const moveNames = [];
      if (poke.movimientos && poke.movimientos.length > 0) {
        poke.movimientos.forEach(m => {
          const moveEn = m.nombre_ingles || m.nombre;
          if (moveEn) moveNames.push(moveEn.replace(/[^A-Za-z0-9]+/g, ''));
        });
      }
      
      const movesStr = moveNames.join(',');
      const nature = 'Hardy';
      const evs = '85,85,85,85,85,85'; // Valores de esfuerzo balanceados
      const gender = '';
      const ivs = ''; // 31 IVs por defecto
      const shiny = '';
      const level = '50';
      
      // Formato Showdown Set: Name|Species|Item|Ability|Moves|Nature|EVs|Gender|IVs|Shiny|Level
      const speciesId = (name.toLowerCase() === species.toLowerCase()) ? '' : species;
      return `${name}|${speciesId}|${item}|${ability}|${movesStr}|${nature}|${evs}|${gender}|${ivs}|${shiny}|${level}`;
    }).join(']');
  }

  // ------------------------------------------------------------------
  // PANTALLA 3: ARENA DE COMBATE OFICIAL POKÉMON SHOWDOWN EN VIVO
  // ------------------------------------------------------------------
  static renderBattleScreen(container) {
    if (!this.currentRoom) {
      this.currentScreen = 'landing';
      this.renderLandingScreen(container);
      return;
    }

    const room = this.currentRoom;
    const myNick = (this.userNickname || 'Entrenador').trim();
    const myPlayer = (room.jugadores || []).find(p => (p.apodo || '').toLowerCase() === myNick.toLowerCase());
    const rivalPlayer = (room.jugadores || []).find(p => (p.apodo || '').toLowerCase() !== myNick.toLowerCase());
    const isHost = myPlayer ? !!myPlayer.es_anfitrion : (room.anfitrion_nombre === myNick);

    // Empaquetar el equipo del jugador actual
    const packedTeam = this.packTeamForShowdown(myPlayer ? myPlayer.equipo_pokemon : []);

    // Parámetros para el bridge de Showdown
    const queryParams = new URLSearchParams({
      user: myNick,
      rival: rivalPlayer ? rivalPlayer.apodo : '',
      room: room.codigo || '',
      host: isHost ? '1' : '0',
      team: packedTeam
    });

    const showdownClientUrl = `showdown/index.html?${queryParams.toString()}`;

    container.innerHTML = `
      <div class="stadium-battle-wrapper battle-combat-wrapper" style="height: 100vh; display: flex; flex-direction: column; overflow: hidden; background: #07090e;">
        <!-- BARRA SUPERIOR DE COMBATE STADIUM -->
        <header class="lobby-header-bar" style="padding: 10px 20px; background: rgba(10, 16, 30, 0.95); border-bottom: 1px solid rgba(56, 189, 248, 0.25); flex-shrink: 0;">
          <div class="lobby-header-left">
            <div class="lobby-pokeball-brand"></div>
            <h2 class="lobby-brand-title" style="font-size: 1.15rem;">Arena Stadium — Combate Oficial Showdown</h2>
            <div class="lobby-status-pill" style="background: rgba(34, 197, 94, 0.2); border-color: rgba(34, 197, 94, 0.5); color: #4ade80; font-size: 0.76rem;">
              ● SERVIDOR EN VIVO
            </div>
          </div>

          <div class="lobby-header-right">
            <div class="room-code-tag" style="padding: 4px 10px; font-size: 0.8rem;">
              <span class="room-label">SALA:</span>
              <span class="room-code-val">${room.codigo}</span>
            </div>
            <button class="battle-exit-btn" onclick="BatallaModule.leaveRoom()" style="padding: 6px 14px; font-size: 0.78rem;">
              <span class="exit-icon">✕</span>
              <span>Salir</span>
            </button>
          </div>
        </header>

        <!-- CONTENEDOR IFRAME COMPLETO DEL CLIENTE WEB OFICIAL DE SHOWDOWN -->
        <main style="flex: 1; width: 100%; position: relative; background: #000;">
          <iframe 
            id="showdownBattleFrame"
            src="${showdownClientUrl}" 
            style="width: 100%; height: 100%; border: none; display: block;"
            allow="fullscreen; autoplay"
          ></iframe>
        </main>
      </div>
    `;
  }

  static async selectCombatMove(moveIndex) {
    if (!this.currentRoom) return;
    const nick = (this.userNickname || '').trim();
    if (!nick) return;

    if (window.BattleRoomStore) {
      await window.BattleRoomStore.submitBattleAction(this.currentRoom.codigo, nick, {
        type: 'move',
        moveIndex: moveIndex
      });
      if (window.SFX) window.SFX.playCardClick();
      this.renderCurrentView();
    }
  }

  static async selectCombatSwitch(targetIndex) {
    if (!this.currentRoom) return;
    const nick = (this.userNickname || '').trim();
    if (!nick) return;

    if (window.BattleRoomStore) {
      await window.BattleRoomStore.submitBattleAction(this.currentRoom.codigo, nick, {
        type: 'switch',
        targetIndex: targetIndex
      });
      if (window.SFX) window.SFX.playCardClick();
      this.renderCurrentView();
    }
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
