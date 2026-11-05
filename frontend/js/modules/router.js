// ====================================================================
// MÓDULO: ENRUTADOR MODULAR HTML5 (CLEAN URLS SIN #) - POKÉMON STADIUM WORLD
// ====================================================================
class StadiumRouter {
  static routes = {
    'pokemon': { viewId: 'view-pokemon', navId: 'menuItemPokemon' },
    'moves': { viewId: 'view-movimientos', navId: 'menuItemMovimientos' },
    'movimientos': { viewId: 'view-movimientos', navId: 'menuItemMovimientos' },
    'battle': { viewId: 'view-batalla', navId: 'menuItemBatalla' },
    'batalla': { viewId: 'view-batalla', navId: 'menuItemBatalla' },
    'batallas': { viewId: 'view-batalla', navId: 'menuItemBatalla' },
    'users': { viewId: 'view-usuarios', navId: 'menuItemUsuarios' },
    'usuarios': { viewId: 'view-usuarios', navId: 'menuItemUsuarios' }
  };

  static currentRoute = null;

  static init() {
    // Escuchar navegación del historial (Botones Atrás/Adelante del navegador)
    window.addEventListener('popstate', () => this.handleLocationChange());
    window.addEventListener('hashchange', () => this.handleLocationChange());
    this.setupNavClickListeners();

    // Migrar automáticamente URLs con # a URLs limpias estándar
    if (window.location.hash && window.location.hash.startsWith('#/')) {
      const cleanPath = window.location.hash.replace(/^#\/?/, '/');
      history.replaceState(null, '', cleanPath);
    }

    // Si la ruta raíz es vacía o /, navegar a /pokemon
    const path = window.location.pathname.replace(/^\/+/, '');
    if (!path || path === '') {
      history.replaceState(null, '', '/pokemon');
    }

    this.handleLocationChange();
  }

  static parseCurrentUrl() {
    // Si viene hash, limpiarlo
    let cleanPath = window.location.pathname;
    if (window.location.hash && window.location.hash.startsWith('#/')) {
      cleanPath = window.location.hash.replace(/^#\/?/, '/');
    }

    const segments = cleanPath.split('/').filter(Boolean);
    const mainRoute = (segments[0] || 'pokemon').toLowerCase();
    const subParam = segments.length > 1 ? segments[1].toUpperCase() : null;

    const params = {};
    if (subParam) {
      params.roomCode = subParam;
    }

    if (window.location.search) {
      const searchParams = new URLSearchParams(window.location.search);
      for (const [k, v] of searchParams.entries()) {
        params[k] = v;
      }
    }

    return { path: mainRoute, params };
  }

  static updateBattleRoomUrl(code) {
    if (code) {
      const newUrl = `/battle/${code.toUpperCase()}`;
      if (window.location.pathname !== newUrl) {
        history.replaceState(null, '', newUrl);
      }
    } else {
      if (window.location.pathname.startsWith('/battle') || window.location.pathname.startsWith('/batalla')) {
        history.replaceState(null, '', '/battle');
      }
    }
  }

  static handleLocationChange() {
    const { path, params } = this.parseCurrentUrl();

    // Casos especiales de modales de autenticación
    if (path === 'login') {
      if (window.AuthManager) window.AuthManager.openModal('login');
      return;
    }
    if (path === 'register' || path === 'registro') {
      if (window.AuthManager) window.AuthManager.openModal('register');
      return;
    }

    // Ruta estándar: pokemon, moves, battle, users
    const targetRoute = this.routes[path] ? path : 'pokemon';
    this.activateView(targetRoute, params);

    // Deep linking: apertura automática de modales por parámetro (?open=...)
    const openTarget = params.open || params.id;
    if (openTarget) {
      if (targetRoute === 'pokemon' && window.PokemonModule) {
        setTimeout(() => {
          window.PokemonModule.openPokemonDetailById(openTarget);
        }, 120);
      } else if ((targetRoute === 'moves' || targetRoute === 'movimientos') && window.MovimientosModule) {
        setTimeout(() => {
          const moveId = parseInt(openTarget, 10);
          window.MovimientosModule.openMoveDetailById(isNaN(moveId) ? openTarget : moveId);
        }, 120);
      }
    }
  }

  static activateView(routeName, params = {}) {
    const routeConfig = this.routes[routeName] || this.routes['pokemon'];
    this.currentRoute = routeName;

    // Actualizar secciones de vista
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });
    const activeSection = document.getElementById(routeConfig.viewId);
    if (activeSection) {
      activeSection.classList.add('active');
    }

    // Actualizar tarjetas activas en la barra de navegación superior
    document.querySelectorAll('.stadium-menu-hub .menu-card').forEach(card => {
      card.classList.remove('active');
    });
    const activeNavCard = document.getElementById(routeConfig.navId);
    if (activeNavCard) {
      activeNavCard.classList.add('active');
    }

    // Si entramos a la sección de batalla, asegurar renderizado del estado actual
    if ((routeName === 'battle' || routeName === 'batalla' || routeName === 'batallas') && window.BatallaModule) {
      const roomCode = params.roomCode || null;
      if (typeof window.BatallaModule.handleRouteRoomCode === 'function') {
        window.BatallaModule.handleRouteRoomCode(roomCode);
      } else {
        window.BatallaModule.renderCurrentView();
      }
    } else if ((routeName === 'users' || routeName === 'usuarios') && window.AdminUsuariosModule) {
      window.AdminUsuariosModule.loadUsers();
    }

    // Modo batalla para ocultar o compactar el hub
    if (routeName === 'battle' || routeName === 'batalla' || routeName === 'batallas') {
      document.body.classList.add('battle-mode');
    } else {
      document.body.classList.remove('battle-mode');
    }
  }

  // Navegar usando HTML5 pushState sin recarga y sin #
  static navigate(routeName, params = {}) {
    let cleanPath = `/${routeName}`;
    const keys = Object.keys(params);
    let queryString = '';
    if (keys.length > 0) {
      const searchParams = new URLSearchParams(params);
      queryString = `?${searchParams.toString()}`;
    }
    const fullUrl = cleanPath + queryString;

    if (window.location.pathname !== cleanPath) {
      history.pushState(null, '', fullUrl);
    }
    this.handleLocationChange();
  }

  static setupNavClickListeners() {
    const hub = document.querySelector('.stadium-menu-hub');
    if (!hub) return;

    hub.querySelectorAll('.menu-card').forEach(card => {
      card.addEventListener('click', () => {
        const view = card.dataset.view;
        if (view) {
          // Mapear a nombre en inglés limpio
          let target = view;
          if (view === 'movimientos') target = 'moves';
          if (view === 'batalla') target = 'battle';
          if (view === 'usuarios') target = 'users';

          StadiumRouter.navigate(target);
          window.scrollTo({ top: 180, behavior: 'smooth' });
        }
      });
    });

    const brandLink = document.getElementById('brandHomeLink');
    if (brandLink) {
      brandLink.addEventListener('click', (e) => {
        e.preventDefault();
        StadiumRouter.navigate('pokemon');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }
}

if (typeof window !== 'undefined') {
  window.StadiumRouter = StadiumRouter;
}
