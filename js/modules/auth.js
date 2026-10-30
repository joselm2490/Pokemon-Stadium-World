// ====================================================================
// MÓDULO: SISTEMA DE AUTENTICACIÓN (LOGIN Y REGISTRO) - POKÉMON STADIUM
// ====================================================================
class AuthManager {
  static USERS_KEY = 'stadium_users_db';
  static SESSION_KEY = 'stadium_session_user';

  static init() {
    // Si no existen usuarios previos, inicializar con usuario demo
    const users = this.getUsers();
    if (users.length === 0) {
      const demoUser = {
        id: 1,
        nombre: 'Ash Ketchum',
        username: 'entrenador_ash',
        email: 'ash@pokemonstadium.world',
        contrasena: 'pika1234',
        creado_en: new Date().toISOString(),
        ultimo_login: null
      };
      this.saveUsers([demoUser]);
    }

    this.setupModalListeners();
    this.renderUserWidget();
  }

  static getUsers() {
    try {
      const raw = localStorage.getItem(this.USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  static saveUsers(users) {
    try {
      localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    } catch (e) {}
  }

  static getCurrentUser() {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  static isLoggedIn() {
    return this.getCurrentUser() !== null;
  }

  static register({ nombre, username, email, contrasena }) {
    const cleanNombre = (nombre || '').trim();
    const cleanUsername = (username || '').trim().toLowerCase();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (contrasena || '').trim();

    if (!cleanNombre) return { ok: false, error: 'Por favor, ingresa tu nombre completo.' };
    if (!cleanUsername) return { ok: false, error: 'Por favor, ingresa un nombre de usuario.' };
    if (cleanUsername.length < 3) return { ok: false, error: 'El usuario debe tener al menos 3 caracteres.' };
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return { ok: false, error: 'Por favor, ingresa un correo electrónico válido.' };
    }
    if (!cleanPass || cleanPass.length < 4) {
      return { ok: false, error: 'La contraseña debe tener al menos 4 caracteres.' };
    }

    const users = this.getUsers();
    if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
      return { ok: false, error: `El nombre de usuario "${cleanUsername}" ya está registrado.` };
    }
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return { ok: false, error: `El correo "${cleanEmail}" ya está registrado.` };
    }

    const newUser = {
      id: Date.now(),
      nombre: cleanNombre,
      username: cleanUsername,
      email: cleanEmail,
      contrasena: cleanPass,
      creado_en: new Date().toISOString(),
      ultimo_login: new Date().toISOString()
    };

    users.push(newUser);
    this.saveUsers(users);
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(newUser));

    this.renderUserWidget();
    if (window.SFX) window.SFX.playSuccess();
    return { ok: true, user: newUser };
  }

  static login({ identifier, contrasena }) {
    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanPass = (contrasena || '').trim();

    if (!cleanId) return { ok: false, error: 'Ingresa tu usuario o correo electrónico.' };
    if (!cleanPass) return { ok: false, error: 'Ingresa tu contraseña.' };

    const users = this.getUsers();
    const user = users.find(u => 
      (u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId) &&
      u.contrasena === cleanPass
    );

    if (!user) {
      if (window.SFX) window.SFX.playError();
      return { ok: false, error: 'Credenciales inválidas. Verifica tu usuario/correo y contraseña.' };
    }

    user.ultimo_login = new Date().toISOString();
    this.saveUsers(users);
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(user));

    this.renderUserWidget();
    if (window.SFX) window.SFX.playSuccess();
    return { ok: true, user };
  }

  static logout() {
    localStorage.removeItem(this.SESSION_KEY);
    this.renderUserWidget();
    if (window.SFX) window.SFX.playNav();
  }

  static renderUserWidget() {
    const widget = document.getElementById('userAuthWidget');
    if (!widget) return;

    const user = this.getCurrentUser();
    if (user) {
      widget.innerHTML = `
        <div class="user-session-pill">
          <div class="user-avatar-badge">⚡</div>
          <div class="user-session-info">
            <span class="user-session-name">${user.nombre}</span>
            <span class="user-session-tag">@${user.username}</span>
          </div>
          <button class="logout-btn" id="logoutBtn" title="Cerrar Sesión">Salir</button>
        </div>
      `;
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          AuthManager.logout();
        });
      }
    } else {
      widget.innerHTML = `
        <button class="auth-open-btn" id="authOpenBtn">
          <span class="auth-icon">👤</span>
          <span>Ingresar / Registro</span>
        </button>
      `;
      const openBtn = document.getElementById('authOpenBtn');
      if (openBtn) {
        openBtn.addEventListener('click', () => {
          AuthManager.openModal('login');
        });
      }
    }
  }

  static openModal(tab = 'login') {
    let modal = document.getElementById('authModal');
    if (!modal) {
      this.createAuthModalDOM();
      modal = document.getElementById('authModal');
    }
    this.switchTab(tab);
    modal.classList.add('open');
    if (window.SFX) window.SFX.playModalOpen();
  }

  static closeModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('open');
  }

  static switchTab(tab) {
    const tabLogin = document.getElementById('authTabLogin');
    const tabRegister = document.getElementById('authTabRegister');
    const formLogin = document.getElementById('authFormLogin');
    const formRegister = document.getElementById('authFormRegister');
    const msgBox = document.getElementById('authMessageAlert');

    if (msgBox) {
      msgBox.style.display = 'none';
      msgBox.textContent = '';
      msgBox.className = 'auth-msg-box';
    }

    if (tab === 'register') {
      tabRegister?.classList.add('active');
      tabLogin?.classList.remove('active');
      if (formRegister) formRegister.style.display = 'block';
      if (formLogin) formLogin.style.display = 'none';
    } else {
      tabLogin?.classList.add('active');
      tabRegister?.classList.remove('active');
      if (formLogin) formLogin.style.display = 'block';
      if (formRegister) formRegister.style.display = 'none';
    }
  }

  static showMessage(msg, isSuccess = false) {
    const msgBox = document.getElementById('authMessageAlert');
    if (!msgBox) return;
    msgBox.textContent = msg;
    msgBox.style.display = 'block';
    msgBox.className = isSuccess ? 'auth-msg-box auth-msg-success' : 'auth-msg-box auth-msg-error';
  }

  static createAuthModalDOM() {
    const modalHtml = `
      <div class="stadium-modal-backdrop" id="authModal">
        <div class="auth-modal-window">
          <div class="auth-modal-header">
            <div class="auth-modal-title-wrap">
              <span class="auth-stadium-icon">🏟️</span>
              <div>
                <h2 class="auth-modal-title">Control de Entrenadores Stadium</h2>
                <div class="auth-modal-subtitle">Registro y Acceso al Sistema Oficial</div>
              </div>
            </div>
            <button class="modal-close-btn" id="authModalCloseBtn" aria-label="Cerrar modal">✕</button>
          </div>

          <div class="auth-tabs-bar">
            <button class="auth-tab active" id="authTabLogin">Iniciar Sesión</button>
            <button class="auth-tab" id="authTabRegister">Crear Cuenta</button>
          </div>

          <div class="auth-modal-body">
            <div id="authMessageAlert" class="auth-msg-box" style="display: none;"></div>

            <!-- FORMULARIO DE LOGIN -->
            <form id="authFormLogin" class="auth-form" onsubmit="event.preventDefault();">
              <div class="auth-field">
                <label for="loginIdentifier">Usuario o Correo:</label>
                <input type="text" id="loginIdentifier" placeholder="ej. entrenador_ash o ash@stadium.world" autocomplete="username">
              </div>
              <div class="auth-field">
                <label for="loginPassword">Contraseña:</label>
                <input type="password" id="loginPassword" placeholder="••••••••" autocomplete="current-password">
              </div>
              <button type="submit" class="auth-submit-btn" id="btnSubmitLogin">
                ⚡ Entrar a Pokémon Stadium
              </button>
              <div class="auth-helper-text">
                ¿No tienes cuenta? <a href="#" id="linkGoRegister">Regístrate aquí</a>
              </div>
            </form>

            <!-- FORMULARIO DE REGISTRO -->
            <form id="authFormRegister" class="auth-form" style="display: none;" onsubmit="event.preventDefault();">
              <div class="auth-field">
                <label for="regNombre">Nombre Completo:</label>
                <input type="text" id="regNombre" placeholder="ej. Ash Ketchum" autocomplete="name">
              </div>
              <div class="auth-field">
                <label for="regUsername">Nombre de Usuario (Username):</label>
                <input type="text" id="regUsername" placeholder="ej. red_champion" autocomplete="username">
              </div>
              <div class="auth-field">
                <label for="regEmail">Correo Electrónico:</label>
                <input type="email" id="regEmail" placeholder="ej. red@stadium.world" autocomplete="email">
              </div>
              <div class="auth-field">
                <label for="regPassword">Contraseña:</label>
                <input type="password" id="regPassword" placeholder="Mínimo 4 caracteres" autocomplete="new-password">
              </div>
              <button type="submit" class="auth-submit-btn" id="btnSubmitRegister">
                🛡️ Registrar Entrenador
              </button>
              <div class="auth-helper-text">
                ¿Ya tienes cuenta? <a href="#" id="linkGoLogin">Inicia sesión</a>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.setupModalListeners();
  }

  static setupModalListeners() {
    const modal = document.getElementById('authModal');
    if (!modal) return;

    const closeBtn = document.getElementById('authModalCloseBtn');
    closeBtn?.addEventListener('click', () => AuthManager.closeModal());

    modal.addEventListener('click', (e) => {
      if (e.target === modal) AuthManager.closeModal();
    });

    const tabLogin = document.getElementById('authTabLogin');
    const tabRegister = document.getElementById('authTabRegister');
    const linkRegister = document.getElementById('linkGoRegister');
    const linkLogin = document.getElementById('linkGoLogin');

    tabLogin?.addEventListener('click', () => AuthManager.switchTab('login'));
    tabRegister?.addEventListener('click', () => AuthManager.switchTab('register'));
    linkRegister?.addEventListener('click', (e) => {
      e.preventDefault();
      AuthManager.switchTab('register');
    });
    linkLogin?.addEventListener('click', (e) => {
      e.preventDefault();
      AuthManager.switchTab('login');
    });

    // Envío de Login
    const formLogin = document.getElementById('authFormLogin');
    formLogin?.addEventListener('submit', () => {
      const iden = document.getElementById('loginIdentifier')?.value;
      const pass = document.getElementById('loginPassword')?.value;
      const res = AuthManager.login({ identifier: iden, contrasena: pass });
      if (res.ok) {
        AuthManager.showMessage(`¡Bienvenido de vuelta, Entrenador ${res.user.nombre}!`, true);
        setTimeout(() => AuthManager.closeModal(), 1200);
      } else {
        AuthManager.showMessage(res.error, false);
      }
    });

    // Envío de Registro
    const formReg = document.getElementById('authFormRegister');
    formReg?.addEventListener('submit', () => {
      const nombre = document.getElementById('regNombre')?.value;
      const username = document.getElementById('regUsername')?.value;
      const email = document.getElementById('regEmail')?.value;
      const pass = document.getElementById('regPassword')?.value;

      const res = AuthManager.register({ nombre, username, email, contrasena: pass });
      if (res.ok) {
        AuthManager.showMessage(`¡Registro exitoso! Bienvenido a Pokémon Stadium, ${res.user.nombre}.`, true);
        setTimeout(() => AuthManager.closeModal(), 1200);
      } else {
        AuthManager.showMessage(res.error, false);
      }
    });
  }
}

if (typeof window !== 'undefined') {
  window.AuthManager = AuthManager;
}
