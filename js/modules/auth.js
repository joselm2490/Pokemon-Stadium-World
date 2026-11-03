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

    // Sincronizar catálogo de usuarios remotos desde Supabase
    this.syncUsersFromSupabase();
  }

  static async syncUsersFromSupabase() {
    if (!window.StadiumSupabase) return;
    try {
      const res = await window.StadiumSupabase.request('usuarios?select=*');
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        const localUsers = this.getUsers();
        const map = new Map();
        localUsers.forEach(u => map.set(u.username.toLowerCase(), u));
        res.data.forEach(u => map.set(u.username.toLowerCase(), u));
        this.saveUsers(Array.from(map.values()));
      }
    } catch (e) {
      console.warn('Error sincronizando usuarios desde Supabase:', e);
    }
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
      if (raw) return JSON.parse(raw);
      // Fallback a sessionStorage por si el navegador bloquea o limpia localStorage
      const sRaw = sessionStorage.getItem(this.SESSION_KEY);
      return sRaw ? JSON.parse(sRaw) : null;
    } catch (e) {
      return null;
    }
  }

  static setCurrentUser(user) {
    try {
      if (user) {
        const str = JSON.stringify(user);
        localStorage.setItem(this.SESSION_KEY, str);
        sessionStorage.setItem(this.SESSION_KEY, str);
      } else {
        localStorage.removeItem(this.SESSION_KEY);
        sessionStorage.removeItem(this.SESSION_KEY);
      }
    } catch (e) {}
  }

  static isLoggedIn() {
    return this.getCurrentUser() !== null;
  }

  static async register({ nombre, apellido, username, email, contrasena }) {
    const cleanNombre = (nombre || '').trim();
    const cleanApellido = (apellido || '').trim();
    const cleanUsername = (username || '').trim().toLowerCase();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (contrasena || '').trim();

    if (!cleanNombre) return { ok: false, error: 'Por favor, ingresa tu nombre.' };
    if (!cleanApellido) return { ok: false, error: 'Por favor, ingresa tu apellido.' };
    if (!cleanUsername) return { ok: false, error: 'Por favor, ingresa un nombre de usuario.' };
    if (cleanUsername.length < 3) return { ok: false, error: 'El usuario debe tener al menos 3 caracteres.' };
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return { ok: false, error: 'Por favor, ingresa un correo electrónico válido.' };
    }
    if (!cleanPass || cleanPass.length < 4) {
      return { ok: false, error: 'La contraseña debe tener al menos 4 caracteres.' };
    }

    // 1. Verificar primero en caché local rápida
    const localUsers = this.getUsers();
    if (localUsers.some(u => u.username.toLowerCase() === cleanUsername)) {
      return { ok: false, error: `El nombre de usuario "${cleanUsername}" ya está registrado.` };
    }
    if (localUsers.some(u => u.email.toLowerCase() === cleanEmail)) {
      return { ok: false, error: `El correo "${cleanEmail}" ya está registrado.` };
    }

    // 2. Verificar en Supabase si está disponible
    if (window.StadiumSupabase) {
      try {
        const checkU = await window.StadiumSupabase.request(`usuarios?username=eq.${encodeURIComponent(cleanUsername)}&select=id`);
        if (checkU.ok && checkU.data && checkU.data.length > 0) {
          return { ok: false, error: `El nombre de usuario "${cleanUsername}" ya está registrado.` };
        }
        const checkE = await window.StadiumSupabase.request(`usuarios?email=eq.${encodeURIComponent(cleanEmail)}&select=id`);
        if (checkE.ok && checkE.data && checkE.data.length > 0) {
          return { ok: false, error: `El correo "${cleanEmail}" ya está registrado.` };
        }
      } catch (e) {
        console.warn('Error verificando usuario en Supabase:', e);
      }
    }

    let newUser = {
      id: Date.now(),
      nombre: cleanNombre,
      apellido: cleanApellido,
      username: cleanUsername,
      email: cleanEmail,
      contrasena: cleanPass,
      creado_en: new Date().toISOString(),
      ultimo_login: new Date().toISOString()
    };

    // Guardar en Supabase para que esté disponible globalmente
    if (window.StadiumSupabase) {
      try {
        const supaRes = await window.StadiumSupabase.request('usuarios', {
          method: 'POST',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify({
            nombre: cleanNombre,
            apellido: cleanApellido,
            username: cleanUsername,
            email: cleanEmail,
            contrasena: cleanPass
          })
        });
        if (supaRes.ok && Array.isArray(supaRes.data) && supaRes.data.length > 0) {
          newUser = supaRes.data[0];
        }
      } catch (err) {
        console.warn('Error guardando usuario en Supabase:', err);
      }
    }

    localUsers.push(newUser);
    this.saveUsers(localUsers);
    this.setCurrentUser(newUser);

    this.renderUserWidget();
    if (window.BatallaModule && typeof window.BatallaModule.syncUserNickname === 'function') {
      window.BatallaModule.syncUserNickname();
      if (window.BatallaModule.currentScreen === 'landing') {
        window.BatallaModule.renderCurrentView();
      }
    }
    if (window.SFX) window.SFX.playSuccess();
    return { ok: true, user: newUser };
  }

  static async login({ identifier, contrasena }) {
    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanPass = (contrasena || '').trim();

    if (!cleanId) return { ok: false, error: 'Ingresa tu usuario o correo electrónico.' };
    if (!cleanPass) return { ok: false, error: 'Ingresa tu contraseña.' };

    let user = null;

    // 1. Verificación instantánea en caché local
    const users = this.getUsers();
    user = users.find(u => 
      (u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId) &&
      u.contrasena === cleanPass
    );

    // 2. Si no está en caché local, buscar en Supabase (con filtro rápido eq)
    if (!user && window.StadiumSupabase) {
      try {
        const queryField = cleanId.includes('@') ? 'email' : 'username';
        const res = await window.StadiumSupabase.request(
          `usuarios?${queryField}=eq.${encodeURIComponent(cleanId)}&contrasena=eq.${encodeURIComponent(cleanPass)}&select=*`
        );
        if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
          user = res.data[0];
        }
      } catch (e) {
        console.warn('Error autenticando contra Supabase:', e);
      }
    }

    if (!user) {
      if (window.SFX) window.SFX.playError();
      return { ok: false, error: 'Credenciales inválidas. Verifica tu usuario/correo y contraseña.' };
    }

    user.ultimo_login = new Date().toISOString();
    const uIdx = users.findIndex(u => u.username.toLowerCase() === user.username.toLowerCase());
    if (uIdx !== -1) {
      users[uIdx] = user;
    } else {
      users.push(user);
    }
    this.saveUsers(users);
    this.setCurrentUser(user);

    this.renderUserWidget();
    if (window.BatallaModule && typeof window.BatallaModule.syncUserNickname === 'function') {
      window.BatallaModule.syncUserNickname();
      if (window.BatallaModule.currentScreen === 'landing') {
        window.BatallaModule.renderCurrentView();
      }
    }
    if (window.SFX) window.SFX.playSuccess();
    return { ok: true, user };
  }

  static logout() {
    this.setCurrentUser(null);
    this.renderUserWidget();
    if (window.BatallaModule && typeof window.BatallaModule.syncUserNickname === 'function') {
      window.BatallaModule.syncUserNickname();
      if (window.BatallaModule.currentScreen === 'landing') {
        window.BatallaModule.renderCurrentView();
      }
    }
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
    modal.style.setProperty('display', 'flex', 'important');
    if (window.SFX) window.SFX.playModalOpen();
  }

  static closeModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.classList.remove('open');
      modal.style.setProperty('display', 'none', 'important');
    }
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
      <div class="stadium-modal-backdrop modal-backdrop" id="authModal" style="position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(2, 6, 14, 0.85) !important; backdrop-filter: blur(12px) !important; z-index: 999999 !important; display: none; align-items: center !important; justify-content: center !important; padding: 20px !important;">
        <div class="auth-modal-window" style="margin: auto !important; position: relative !important;">
          <div class="auth-modal-header">
            <div class="auth-modal-title-wrap">
              <div class="auth-icon-badge">🏟️</div>
              <div>
                <h2 class="auth-modal-title">Control de Entrenadores Stadium</h2>
                <div class="auth-modal-subtitle">Registro y Acceso al Sistema Oficial</div>
              </div>
            </div>
            <button class="auth-modal-close" id="authModalCloseBtn" aria-label="Cerrar modal">✕</button>
          </div>

          <div class="auth-tabs-bar">
            <button class="auth-tab active" id="authTabLogin">
              <span>⚡</span> Iniciar Sesión
            </button>
            <button class="auth-tab" id="authTabRegister">
              <span>🛡️</span> Crear Cuenta
            </button>
          </div>

          <div class="auth-modal-body">
            <div id="authMessageAlert" class="auth-msg-box" style="display: none;"></div>

            <!-- FORMULARIO DE LOGIN -->
            <form id="authFormLogin" class="auth-form" onsubmit="event.preventDefault();">
              <div class="auth-field">
                <label for="loginIdentifier">
                  <span class="auth-field-icon">👤</span> Usuario o Correo Electrónico
                </label>
                <input type="text" id="loginIdentifier" placeholder="ej. entrenador_ash o ash@stadium.world" autocomplete="username">
              </div>

              <div class="auth-field">
                <label for="loginPassword">
                  <span class="auth-field-icon">🔒</span> Contraseña de Acceso
                </label>
                <input type="password" id="loginPassword" placeholder="••••••••••••" autocomplete="current-password">
              </div>

              <button type="submit" class="auth-submit-btn" id="btnSubmitLogin">
                <span>⚡</span> ENTRAR A POKÉMON STADIUM
              </button>

              <div class="auth-helper-text">
                ¿Aún no tienes cuenta oficial? <a href="#" id="linkGoRegister">Regístrate gratis aquí</a>
              </div>
            </form>

            <!-- FORMULARIO DE REGISTRO -->
            <form id="authFormRegister" class="auth-form" style="display: none;" onsubmit="event.preventDefault();">
              <div class="auth-row-2col">
                <div class="auth-field">
                  <label for="regNombre">
                    <span class="auth-field-icon">📛</span> Nombre
                  </label>
                  <input type="text" id="regNombre" placeholder="ej. Ash" autocomplete="given-name">
                </div>
                <div class="auth-field">
                  <label for="regApellido">
                    <span class="auth-field-icon">📛</span> Apellido
                  </label>
                  <input type="text" id="regApellido" placeholder="ej. Ketchum" autocomplete="family-name">
                </div>
              </div>

              <div class="auth-field">
                <label for="regUsername">
                  <span class="auth-field-icon">🎮</span> Nombre de Usuario (Username)
                </label>
                <input type="text" id="regUsername" placeholder="ej. red_champion" autocomplete="username">
              </div>

              <div class="auth-field">
                <label for="regEmail">
                  <span class="auth-field-icon">✉️</span> Correo Electrónico
                </label>
                <input type="email" id="regEmail" placeholder="ej. red@stadium.world" autocomplete="email">
              </div>

              <div class="auth-field">
                <label for="regPassword">
                  <span class="auth-field-icon">🔒</span> Contraseña de Entrenador
                </label>
                <input type="password" id="regPassword" placeholder="Mínimo 4 caracteres seguros" autocomplete="new-password">
              </div>

              <button type="submit" class="auth-submit-btn" id="btnSubmitRegister">
                <span>🛡️</span> REGISTRAR ENTRENADOR
              </button>

              <div class="auth-helper-text">
                ¿Ya posees una cuenta activa? <a href="#" id="linkGoLogin">Inicia sesión</a>
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
    formLogin?.addEventListener('submit', async (e) => {
      if (e) e.preventDefault();
      const btnSubmit = document.getElementById('btnSubmitLogin');
      const originalText = btnSubmit ? btnSubmit.innerHTML : '';
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span>⏳</span> VALIDANDO...`;
      }

      const iden = document.getElementById('loginIdentifier')?.value;
      const pass = document.getElementById('loginPassword')?.value;
      const res = await AuthManager.login({ identifier: iden, contrasena: pass });
      
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
      }

      if (res.ok) {
        AuthManager.showMessage(`¡Bienvenido de vuelta, Entrenador ${res.user.nombre}!`, true);
        setTimeout(() => AuthManager.closeModal(), 700);
      } else {
        AuthManager.showMessage(res.error, false);
      }
    });

    // Envío de Registro
    const formReg = document.getElementById('authFormRegister');
    formReg?.addEventListener('submit', async (e) => {
      if (e) e.preventDefault();
      const btnSubmit = document.getElementById('btnSubmitRegister');
      const originalText = btnSubmit ? btnSubmit.innerHTML : '';
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span>⏳</span> REGISTRANDO...`;
      }

      const nombre = document.getElementById('regNombre')?.value;
      const apellido = document.getElementById('regApellido')?.value;
      const username = document.getElementById('regUsername')?.value;
      const email = document.getElementById('regEmail')?.value;
      const pass = document.getElementById('regPassword')?.value;

      const res = await AuthManager.register({ nombre, apellido, username, email, contrasena: pass });

      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
      }

      if (res.ok) {
        AuthManager.showMessage(`¡Registro exitoso! Bienvenido a Pokémon Stadium, ${res.user.nombre}.`, true);
        setTimeout(() => AuthManager.closeModal(), 700);
      } else {
        AuthManager.showMessage(res.error, false);
      }
    });
  }
}

if (typeof window !== 'undefined') {
  window.AuthManager = AuthManager;
}
