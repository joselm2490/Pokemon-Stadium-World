// ====================================================================
// ORQUESTADOR PRINCIPAL - POKÉMON STADIUM WORLD
// Inicializa los módulos de la aplicación: Auth, Router, Pokémon, Movimientos, Batallas
// ====================================================================

const GameState = {
  moves: [],
  pokemon: [],
  movesById: new Map(),
  isLoaded: false
};

window.GameState = GameState;

// Inicialización de la aplicación al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  initStadiumApp();
});

function initStadiumApp() {
  console.log('⚡ Inicializando Pokémon Stadium World Engine...');

  // 1. Inicializar Audio y SFX
  setupAudioControls();

  // 2. Inicializar Sistema de Autenticación (Login / Registro / Usuarios)
  if (window.AuthManager) {
    window.AuthManager.init();
  }

  // 3. Cargar datos de movimientos y Pokémon
  loadStadiumDatasets();

  // 4. Inicializar Módulos de Catálogo
  if (window.PokemonModule) {
    window.PokemonModule.init(GameState.pokemon, GameState.movesById);
  }

  if (window.MovimientosModule) {
    window.MovimientosModule.init(GameState.moves, GameState.pokemon);
  }

  if (window.BatallaModule) {
    window.BatallaModule.init(GameState.pokemon, GameState.movesById);
  }

  // 5. Inicializar Enrutador (Router SPA) - Comienza siempre en Pokémon
  if (window.StadiumRouter) {
    window.StadiumRouter.init();
  }

  // 6. Configurar Tooltips Globales Flotantes
  setupGlobalTooltips();

  // 7. Ocultar estados de carga
  const loadingMov = document.getElementById('loadingState');
  if (loadingMov) loadingMov.style.display = 'none';

  // Actualizar pill de estado en header
  const dbCount = document.getElementById('dbMoveCount');
  if (dbCount) {
    dbCount.textContent = `${GameState.pokemon.length} Pokémon | ${GameState.moves.length} Movimientos`;
  }

  GameState.isLoaded = true;
  console.log('✅ Pokémon Stadium World listo para el combate.');
}

function loadStadiumDatasets() {
  const movesSource = window.MOVIMIENTOS_DATA || window.POKEMON_MOVES || [];
  if (Array.isArray(movesSource) && movesSource.length > 0) {
    GameState.moves = movesSource;
    GameState.moves.forEach(m => GameState.movesById.set(m.id, m));
  }

  const pokeSource = window.POKEMON_DATA || window.POKEMON_LIST || [];
  if (Array.isArray(pokeSource)) {
    GameState.pokemon = pokeSource;
  }
}

function setupAudioControls() {
  const sfxToggle = document.getElementById('sfxToggleBtn');
  if (!sfxToggle) return;

  sfxToggle.addEventListener('click', () => {
    if (window.SFX) {
      const enabled = window.SFX.toggle();
      sfxToggle.textContent = enabled ? '🔊 SFX: ON' : '🔇 SFX: OFF';
      sfxToggle.classList.toggle('sfx-disabled', !enabled);
      if (enabled) window.SFX.playNav();
    }
  });

  // Reanudar contexto de audio al primer clic del usuario
  window.addEventListener('click', () => {
    if (window.SFX && window.SFX.ctx && window.SFX.ctx.state === 'suspended') {
      window.SFX.ctx.resume();
    }
  }, { once: true });
}

// ====================================================================
// SISTEMA GLOBAL DE TOOLTIPS FLOTANTES (STADIUM HUD)
// ====================================================================
function setupGlobalTooltips() {
  let tipEl = document.getElementById('globalStadiumTooltip');
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.id = 'globalStadiumTooltip';
    tipEl.className = 'stadium-floating-tooltip';
    document.body.appendChild(tipEl);
  }

  function handleTooltip(e) {
    const target = e.target.closest('[data-tooltip]');
    if (!target) {
      tipEl.classList.remove('visible');
      return;
    }

    const text = target.getAttribute('data-tooltip');
    if (!text) {
      tipEl.classList.remove('visible');
      return;
    }

    tipEl.textContent = text;
    tipEl.classList.add('visible');

    const rect = target.getBoundingClientRect();
    const tipWidth = tipEl.offsetWidth || 260;
    const tipHeight = tipEl.offsetHeight || 40;

    let left = rect.left + (rect.width / 2) - (tipWidth / 2);
    let top = rect.top - tipHeight - 10;

    if (left < 10) left = 10;
    if (left + tipWidth > window.innerWidth - 10) {
      left = window.innerWidth - tipWidth - 10;
    }

    if (top < 10) {
      top = rect.bottom + 10;
    }

    tipEl.style.left = `${Math.round(left)}px`;
    tipEl.style.top = `${Math.round(top)}px`;
  }

  document.addEventListener('mouseover', handleTooltip, true);
  document.addEventListener('mousemove', (e) => {
    if (tipEl.classList.contains('visible')) {
      const target = e.target.closest('[data-tooltip]');
      if (!target) {
        tipEl.classList.remove('visible');
      }
    }
  }, true);

  document.addEventListener('mouseout', (e) => {
    const related = e.relatedTarget;
    if (!related || !related.closest('[data-tooltip]')) {
      tipEl.classList.remove('visible');
    }
  }, true);
}

// Funciones globales para retrocompatibilidad
window.openPokemonDetailById = (id) => {
  if (window.PokemonModule) window.PokemonModule.openPokemonDetailById(id);
};

window.openMoveDetailById = (id) => {
  if (window.MovimientosModule) window.MovimientosModule.openMoveDetailById(id);
};
