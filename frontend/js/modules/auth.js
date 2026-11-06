// ====================================================================
// MÓDULO: SISTEMA DE AUTENTICACIÓN EXCLUSIVO CON DJANGO AUTH
// ====================================================================
class AuthManager {
  static SESSION_KEY = 'stadium_session_user';

  static init() {
    // 1. Capturar usuario desde query param tras login o registro en Django
    const urlParams = new URLSearchParams(window.location.search);
    const authUserParam = urlParams.get('auth_user');
    if (authUserParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(authUserParam));
        if (parsed && parsed.username) {
          this.setCurrentUser({
            id: parsed.id,
            username: parsed.username,
            nombre: parsed.first_name || parsed.username,
            email: parsed.email || '',
            is_staff: !!parsed.is_staff,
            is_superuser: !!parsed.is_superuser
          });
          // Limpiar el parámetro de la URL sin recargar
          urlParams.delete('auth_user');
          const cleanQuery = urlParams.toString() ? ('?' + urlParams.toString()) : '';
          history.replaceState(null, '', window.location.pathname + cleanQuery);
        }
      } catch (e) {
        console.error('Error parseando auth_user:', e);
      }
    }

    // 2. Comprobar si está autenticado. Si NO está autenticado, forzar login
    if (!this.isLoggedIn()) {
      console.warn('🔒 Acceso restringido: Se requiere autenticación obligatoria.');
      this.redirectToDjangoLogin();
      return;
    }

    this.setupModalListeners();
    this.renderUserWidget();
  }

  // GESTIÓN DE SESIÓN AISLADA POR VENTANA (MODO NORMAL vs INCÓGNITO)
  static getCurrentUser() {
    try {
      const sRaw = sessionStorage.getItem(this.SESSION_KEY);
      if (sRaw) return JSON.parse(sRaw);
      return null;
    } catch (e) {
      return null;
    }
  }

  static setCurrentUser(user) {
    try {
      if (user) {
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
      } else {
        sessionStorage.removeItem(this.SESSION_KEY);
      }
    } catch (e) {}
  }

  static isLoggedIn() {
    return this.getCurrentUser() !== null;
  }

  // Base URL para API de Django (Render o Localhost)
  static getApiBaseUrl() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8000/api/auth';
    }
    return window.DJANGO_API_URL || 'https://pokemon-stadium-backend.onrender.com/api/auth';
  }

  static async register({ nombre, apellido, username, email, contrasena }) {
    const cleanNombre = (nombre || '').trim();
    const cleanApellido = (apellido || '').trim();
    const cleanUsername = (username || '').trim().toLowerCase();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (contrasena || '').trim();

    if (!cleanNombre) return { ok: false, error: 'Por favor, ingresa tu nombre de entrenador.' };
    if (!cleanUsername) return { ok: false, error: 'Por favor, ingresa un nombre de usuario.' };
    if (cleanUsername.length < 3) return { ok: false, error: 'El usuario debe tener al menos 3 caracteres.' };
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return { ok: false, error: 'Por favor, ingresa un correo electrónico válido.' };
    }
    if (!cleanPass || cleanPass.length < 6) {
      return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres (seguridad Django).' };
    }

    // Registro nativo en el backend Django
    try {
      const response = await fetch(`${this.getApiBaseUrl()}/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          email: cleanEmail,
          password: cleanPass,
          first_name: cleanNombre,
          last_name: cleanApellido
        })
      });

      const resData = await response.json();
      if (!response.ok || !resData.ok) {
        if (window.SFX) window.SFX.playError();
        return { ok: false, error: resData.error || 'Error al registrar usuario en Django.' };
      }

      const newUser = {
        id: resData.user.id,
        nombre: resData.user.first_name || cleanNombre,
        apellido: resData.user.last_name || cleanApellido,
        username: resData.user.username,
        email: resData.user.email,
        is_staff: resData.user.is_staff,
        is_superuser: resData.user.is_superuser,
        ultimo_login: new Date().toISOString()
      };

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
    } catch (err) {
      console.warn('Error en conexión con Django register:', err);
      if (window.SFX) window.SFX.playError();
      return { ok: false, error: 'No se pudo conectar con el servidor Django. Intenta de nuevo en unos segundos.' };
    }
  }

  static async login({ identifier, contrasena }) {
    const cleanId = (identifier || '').trim();
    const cleanPass = (contrasena || '').trim();

    if (!cleanId) return { ok: false, error: 'Ingresa tu usuario o correo electrónico.' };
    if (!cleanPass) return { ok: false, error: 'Ingresa tu contraseña.' };

    // Autenticación nativa contra el endpoint de Django
    try {
      const response = await fetch(`${this.getApiBaseUrl()}/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanId,
          password: cleanPass
        })
      });

      const resData = await response.json();
      if (response.ok && resData.ok && resData.user) {
        const user = {
          id: resData.user.id,
          nombre: resData.user.first_name || resData.user.username,
          username: resData.user.username,
          email: resData.user.email,
          is_staff: resData.user.is_staff,
          is_superuser: resData.user.is_superuser,
          ultimo_login: new Date().toISOString()
        };

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
      } else {
        if (window.SFX) window.SFX.playError();
        return { ok: false, error: resData.error || 'Credenciales inválidas. Verifica tu usuario y contraseña.' };
      }
    } catch (err) {
      console.warn('Error conectando a Django Login API:', err);
      if (window.SFX) window.SFX.playError();
      return { ok: false, error: 'Error de conexión con el servidor de autenticación Django.' };
    }
  }

  static logout() {
    try {
      fetch(`${this.getApiBaseUrl()}/logout/`, { method: 'POST' }).catch(() => {});
    } catch (e) {}

    this.setCurrentUser(null);
    this.renderUserWidget();
    this.redirectToDjangoLogin();
    if (window.BatallaModule && typeof window.BatallaModule.syncUserNickname === 'function') {
      window.BatallaModule.syncUserNickname();
      if (window.BatallaModule.currentScreen === 'landing') {
        window.BatallaModule.renderCurrentView();
      }
    }
    if (window.SFX) window.SFX.playNav();
  }

  static getDjangoAdminLoginUrl() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8000/admin/login/';
    }
    return 'https://pokemon-stadium-backend.onrender.com/admin/login/';
  }

  static redirectToDjangoLogin() {
    window.location.href = this.getDjangoAdminLoginUrl();
  }

  static renderUserWidget() {
    const widget = document.getElementById('userAuthWidget');
    if (!widget) return;

    const user = this.getCurrentUser();
    const adminTab = document.getElementById('menuItemUsuarios');

    if (adminTab) {
      if (user && (user.is_superuser === true || user.is_superuser === 1)) {
        adminTab.style.display = 'flex';
      } else {
        adminTab.style.display = 'none';
      }
    }

    if (user) {
      const isSuperBadge = user.is_superuser ? '<span style="color: #facc15; font-size: 0.72rem; font-weight: 700; margin-left: 4px;">👑 SUPER</span>' : '';
      widget.innerHTML = `
        <div class="user-session-pill">
          <div class="user-avatar-badge">${user.is_superuser ? '👑' : '⚡'}</div>
          <div class="user-session-info">
            <span class="user-session-name">${this.escapeHtml(user.nombre)}${isSuperBadge}</span>
            <span class="user-session-tag">@${this.escapeHtml(user.username)}</span>
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
        <a href="${this.getDjangoAdminLoginUrl()}" class="auth-open-btn" id="authOpenBtn" style="text-decoration: none;">
          <span class="auth-icon">👤</span>
          <span>Ingresar / Registro (Django)</span>
        </a>
      `;
    }
  }

  static openModal(mode = 'login') {
    // Redirección directa al login oficial de Django adaptado al diseño de Stadium
    this.redirectToDjangoLogin();
  }

  static closeModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.remove();
  }

  static bindModalEvents(modal) {
    const closeBtn = modal.querySelector('#authModalCloseBtn');
    if (closeBtn) closeBtn.onclick = () => this.closeModal();

    modal.onclick = (e) => {
      if (e.target === modal) this.closeModal();
    };

    const tabLogin = modal.querySelector('#authTabLogin');
    const tabRegister = modal.querySelector('#authTabRegister');
    const loginForm = modal.querySelector('#loginForm');
    const registerForm = modal.querySelector('#registerForm');
    const alertBox = modal.querySelector('#authAlert');

    tabLogin.onclick = () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      loginForm.style.display = 'flex';
      registerForm.style.display = 'none';
      alertBox.style.display = 'none';
    };

    tabRegister.onclick = () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      registerForm.style.display = 'flex';
      loginForm.style.display = 'none';
      alertBox.style.display = 'none';
    };

    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      const identifier = modal.querySelector('#loginIdentifier').value;
      const pass = modal.querySelector('#loginPassword').value;

      const submitBtn = loginForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verificando con Django...';

      const res = await this.login({ identifier, contrasena: pass });
      submitBtn.disabled = false;
      submitBtn.textContent = 'Entrar a la Arena';

      if (res.ok) {
        this.closeModal();
      } else {
        alertBox.textContent = res.error;
        alertBox.style.display = 'block';
      }
    };

    registerForm.onsubmit = async (e) => {
      e.preventDefault();
      const nombre = modal.querySelector('#regNombre').value;
      const apellido = modal.querySelector('#regApellido').value;
      const username = modal.querySelector('#regUsername').value;
      const email = modal.querySelector('#regEmail').value;
      const contrasena = modal.querySelector('#regPassword').value;

      const submitBtn = registerForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Registrando en Django...';

      const res = await this.register({ nombre, apellido, username, email, contrasena });
      submitBtn.disabled = false;
      submitBtn.textContent = 'Registrarse en la Liga';

      if (res.ok) {
        this.closeModal();
      } else {
        alertBox.textContent = res.error;
        alertBox.style.display = 'block';
      }
    };
  }

  static setupModalListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });
  }

  static escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

window.AuthManager = AuthManager;
