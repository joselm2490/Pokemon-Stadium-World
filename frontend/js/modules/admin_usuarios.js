// ====================================================================
// MÓDULO: GESTIÓN DE USUARIOS (VISTA EXCLUSIVA DE SUPERUSUARIO)
// ====================================================================

class AdminUsuariosModule {
  static containerId = 'view-usuarios';

  static async loadUsers() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const currentUser = window.AuthManager ? window.AuthManager.getCurrentUser() : null;
    const isSuperuser = currentUser && (currentUser.is_superuser === true || currentUser.is_superuser === 1);

    if (!isSuperuser) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: #f87171;">
          <div style="font-size: 3rem; margin-bottom: 12px;">🚫</div>
          <h2 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 8px;">Acceso Restringido</h2>
          <p style="color: #94a3b8; max-width: 480px; margin: 0 auto;">
            Este módulo es exclusivo para administradores (Superusuario Django). Inicia sesión con credenciales de superusuario para ver la gestión de usuarios.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="padding: 24px 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: #f1f5f9; display: flex; align-items: center; gap: 10px;">
              <span>👑</span> Módulo de Usuarios (Superusuario Django)
            </h2>
            <p style="color: #94a3b8; font-size: 0.88rem; margin-top: 4px;">
              Entrenadores registrados en PostgreSQL mediante Django Auth.
            </p>
          </div>
          <button class="battle-primary-action-btn" onclick="AdminUsuariosModule.loadUsers()" style="padding: 8px 16px; font-size: 0.85rem;">
            🔄 Refrescar Lista
          </button>
        </div>

        <div id="adminUsersTableContainer" style="overflow-x: auto; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 12px; padding: 16px;">
          <div style="text-align: center; color: #94a3b8; padding: 30px;">Cargando usuarios desde Django...</div>
        </div>
      </div>
    `;

    try {
      const baseUrl = window.AuthManager.getApiBaseUrl();
      const res = await fetch(`${baseUrl}/users/`);
      const data = await res.json();

      const tableContainer = document.getElementById('adminUsersTableContainer');
      if (!tableContainer) return;

      if (!res.ok || !data.ok) {
        tableContainer.innerHTML = `
          <div style="text-align: center; color: #ef4444; padding: 20px;">
            ${data.error || 'No se pudieron cargar los usuarios del servidor.'}
          </div>
        `;
        return;
      }

      const users = data.data || [];
      if (users.length === 0) {
        tableContainer.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 20px;">No hay usuarios registrados.</div>`;
        return;
      }

      let rowsHtml = users.map(u => {
        const isSuper = u.is_superuser ? '<span style="background: #eab308; color: #000; font-weight: 700; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem;">SUPERUSER</span>' : '<span style="color: #94a3b8; font-size: 0.75rem;">Entrenador</span>';
        const dateStr = u.date_joined ? new Date(u.date_joined).toLocaleDateString() : 'N/A';
        const loginStr = u.last_login ? new Date(u.last_login).toLocaleString() : 'Nunca';

        return `
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <td style="padding: 12px 14px; font-weight: 700; color: #38bdf8;">${u.id}</td>
            <td style="padding: 12px 14px; font-weight: 600; color: #f8fafc;">${u.username}</td>
            <td style="padding: 12px 14px; color: #cbd5e1;">${u.email || '-'}</td>
            <td style="padding: 12px 14px; color: #cbd5e1;">${u.first_name || '-'}</td>
            <td style="padding: 12px 14px; text-align: center;">${isSuper}</td>
            <td style="padding: 12px 14px; color: #94a3b8; font-size: 0.85rem;">${dateStr}</td>
            <td style="padding: 12px 14px; color: #94a3b8; font-size: 0.85rem;">${loginStr}</td>
          </tr>
        `;
      }).join('');

      tableContainer.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
          <thead>
            <tr style="border-bottom: 2px solid rgba(56, 189, 248, 0.3); color: #94a3b8; font-size: 0.8rem; text-transform: uppercase;">
              <th style="padding: 10px 14px;">ID</th>
              <th style="padding: 10px 14px;">Usuario</th>
              <th style="padding: 10px 14px;">Correo</th>
              <th style="padding: 10px 14px;">Nombre</th>
              <th style="padding: 10px 14px; text-align: center;">Rol</th>
              <th style="padding: 10px 14px;">Registrado</th>
              <th style="padding: 10px 14px;">Último Login</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;

    } catch (e) {
      console.warn('Error en AdminUsuariosModule:', e);
    }
  }
}

window.AdminUsuariosModule = AdminUsuariosModule;

