// ====================================================================
// MÓDULO: ENRUTADOR MODULAR (SPA ROUTER) - POKÉMON STADIUM WORLD
// ====================================================================
class StadiumRouter {
  static routes = {
    'pokemon': { viewId: 'view-pokemon', navId: 'menuItemPokemon' },
    'movimientos': { viewId: 'view-movimientos', navId: 'menuItemMovimientos' },
    'batalla': { viewId: 'view-batalla', navId: 'menuItemBatalla' },
    'batallas': { viewId: 'view-batalla', navId: 'menuItemBatalla' }
  };

  static currentRoute = null;

  static init() {
    window.addEventListener('hashchange', () => this.handleHashChange());
    this.setupNavClickListeners();

    // Si la URL no tiene hash o está vacía, comenzar siempre por 'pokemon' como pidió el usuario
    if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
      window.location.hash = '#/pokemon';
    } else {
      this.handleHashChange();
    }
  }

  static parseHash() {
    const rawHash = window.location.hash || '#/pokemon';
    const clean = rawHash.replace(/^#\/?/, '');
    const [pathPart, queryPart] = clean.split('?');
    
    // Soportar rutas anidadas como batalla/7SHTXZ o batallas/7SHTXZ
    const segments = pathPart.split('/').filter(Boolean);
    const mainRoute = (segments[0] || 'pokemon').toLowerCase();
    const subParam = segments.length > 1 ? segments[1].toUpperCase() : null;

    const params = {};
    if (subParam) {
      params.roomCode = subParam;
    }

    if (queryPart) {
      const searchParams = new URLSearchParams(queryPart);
      for (const [k, v] of searchParams.entries()) {
        params[k] = v;
      }
    }

    return { path: mainRoute, params };
  }

  static updateBattleRoomUrl(code) {
    if (code) {
      const newHash = `#/batalla/${code.toUpperCase()}`;
      if (window.location.hash !== newHash) {
        history.replaceState(null, '', newHash);
      }
    } else {
      if (window.location.hash.startsWith('#/batalla')) {
        history.replaceState(null, '', '#/batalla');
      }
    }
  }

  static handleHashChange() {
    const { path, params } = this.parseHash();

    // Manejar casos especiales de rutas de auth
    if (path === 'login') {
      if (window.AuthManager) window.AuthManager.openModal('login');
      return;
    }
    if (path === 'registro') {
      if (window.AuthManager) window.AuthManager.openModal('register');
      return;
    }

    // Ruta estándar: pokemon, movimientos, batallas
    const targetRoute = this.routes[path] ? path : 'pokemon';
    this.activateView(targetRoute, params);

    // Deep linking: apertura automática de modales por parámetro (?open=...)
    const openTarget = params.open || params.id;
    if (openTarget) {
      if (targetRoute === 'pokemon' && window.PokemonModule) {
        setTimeout(() => {
          window.PokemonModule.openPokemonDetailById(openTarget);
        }, 120);
      } else if (targetRoute === 'movimientos' && window.MovimientosModule) {
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

    // Si entramos a la sección de batalla, asegurar renderizado del estado actual
    if ((routeName === 'batalla' || routeName === 'batallas') && window.BatallaModule) {
      const roomCode = params.roomCode || null;
      if (typeof window.BatallaModule.handleRouteRoomCode === 'function') {
        window.BatallaModule.handleRouteRoomCode(roomCode);
      } else {
        window.BatallaModule.renderCurrentView();
      }
    }

    // Hide or show the top menu hub based on the route
    if (routeName === 'batalla' || routeName === 'batallas') {
      document.body.classList.add('battle-mode');
    } else {
      document.body.classList.remove('battle-mode');
    }
  }

  static navigate(routeName, params = {}) {
    let hash = `#/${routeName}`;
    const keys = Object.keys(params);
    if (keys.length > 0) {
      const searchParams = new URLSearchParams(params);
      hash += `?${searchParams.toString()}`;
    }
    if (window.location.hash === hash) {
      // Forzar cambio si ya estaba en ese hash
      this.handleHashChange();
    } else {
      window.location.hash = hash;
    }
  }

  static setupNavClickListeners() {
    const hub = document.querySelector('.stadium-menu-hub');
    if (!hub) return;

    hub.querySelectorAll('.menu-card').forEach(card => {
      card.addEventListener('click', () => {
        const view = card.dataset.view;
        if (view) {
          StadiumRouter.navigate(view);
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
