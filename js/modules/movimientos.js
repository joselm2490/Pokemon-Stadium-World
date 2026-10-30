// ====================================================================
// MÓDULO: CATÁLOGO DE MOVIMIENTOS - POKÉMON STADIUM WORLD
// ====================================================================
class MovimientosModule {
  static moves = [];
  static filteredMoves = [];
  static pokemonList = [];
  static currentPage = 1;
  static pageSize = 40;

  static filters = {
    class: 'all',
    gen: 'all',
    types: [],
    search: '',
    sort: 'id_asc'
  };

  static init(movesList = [], pokemonList = []) {
    this.moves = (Array.isArray(movesList) && movesList.length > 0)
      ? movesList
      : (window.MOVIMIENTOS_DATA || window.POKEMON_MOVES || []);
    this.pokemonList = (Array.isArray(pokemonList) && pokemonList.length > 0)
      ? pokemonList
      : (window.POKEMON_DATA || []);
    this.setupFilterEvents();
    this.setupTypeChips();
    this.setupModalEvents();
    this.applyFiltersAndSort();
  }

  static setupFilterEvents() {
    // Input de búsqueda
    const searchInput = document.getElementById('moveSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value.trim();
        this.currentPage = 1;
        this.applyFiltersAndSort();
      });
    }

    // Selector de orden
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.filters.sort = e.target.value;
        this.currentPage = 1;
        this.applyFiltersAndSort();
      });
    }

    // Chips de Clase (Físico, Especial, Estado)
    document.querySelectorAll('#classFiltersRow .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (window.SFX) window.SFX.playFilter();
        document.querySelectorAll('#classFiltersRow .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filters.class = chip.dataset.class;
        this.currentPage = 1;
        this.applyFiltersAndSort();
      });
    });

    // Chips de Generación
    document.querySelectorAll('#genFiltersRow .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (window.SFX) window.SFX.playFilter();
        document.querySelectorAll('#genFiltersRow .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filters.gen = chip.dataset.gen;
        this.currentPage = 1;
        this.applyFiltersAndSort();
      });
    });
  }

  static setupTypeChips() {
    const container = document.getElementById('typeFiltersRow');
    if (!container) return;

    const ELEMENTAL_TYPES = [
      'Normal', 'Fuego', 'Agua', 'Planta', 'Eléctrico', 'Hielo',
      'Lucha', 'Veneno', 'Tierra', 'Volador', 'Psíquico', 'Bicho',
      'Roca', 'Fantasma', 'Dragón', 'Siniestro', 'Acero', 'Hada'
    ];

    this.filters.types = [];

    const allChip = container.querySelector('[data-type="all"]');
    container.innerHTML = '';
    if (allChip) container.appendChild(allChip);

    ELEMENTAL_TYPES.forEach(t => {
      const chip = document.createElement('button');
      chip.className = 'filter-chip filter-type-chip has-tooltip';
      chip.dataset.type = t;
      const desc = (typeof AttackSpriteManager !== 'undefined' && AttackSpriteManager.TYPE_DESCRIPTIONS && AttackSpriteManager.TYPE_DESCRIPTIONS[t])
        ? AttackSpriteManager.TYPE_DESCRIPTIONS[t]
        : `Tipo ${t}: Filtrar movimientos de tipo ${t}.`;
      chip.setAttribute('data-tooltip', desc);
      chip.innerHTML = typeof AttackSpriteManager !== 'undefined'
        ? AttackSpriteManager.renderTypeBadge(t, true, { className: 'filter-type-badge-img' })
        : t;

      chip.addEventListener('click', () => {
        if (window.SFX) window.SFX.playFilter();
        const allBtn = container.querySelector('[data-type="all"]');

        if (this.filters.types.includes(t)) {
          this.filters.types = this.filters.types.filter(type => type !== t);
          chip.classList.remove('active');
        } else {
          if (this.filters.types.length >= 2) {
            const oldest = this.filters.types.shift();
            const oldChip = container.querySelector(`[data-type="${oldest}"]`);
            if (oldChip) oldChip.classList.remove('active');
          }
          this.filters.types.push(t);
          chip.classList.add('active');
        }

        if (this.filters.types.length === 0) {
          allBtn?.classList.add('active');
        } else {
          allBtn?.classList.remove('active');
        }

        this.currentPage = 1;
        this.applyFiltersAndSort();
      });

      container.appendChild(chip);
    });

    if (allChip) {
      allChip.addEventListener('click', () => {
        if (window.SFX) window.SFX.playFilter();
        container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        allChip.classList.add('active');
        this.filters.types = [];
        this.currentPage = 1;
        this.applyFiltersAndSort();
      });
    }
  }

  static applyFiltersAndSort() {
    const f = this.filters;

    this.filteredMoves = this.moves.filter(m => {
      if (f.class !== 'all' && m.clase !== f.class) return false;
      if (f.gen !== 'all' && String(m.gen) !== String(f.gen)) return false;
      if (f.types && f.types.length > 0 && !f.types.includes(m.tipo)) return false;

      if (f.search) {
        const q = f.search.trim().toLowerCase();
        const codeMatch = String(m.codigo).toLowerCase().includes(q) || String(m.codigo).padStart(3, '0').includes(q);
        const nameMatch = (m.nombre || '').toLowerCase().includes(q);
        const enMatch = (m.nombre_ingles || '').toLowerCase().includes(q);
        const altMatch = (m.nombre_alt || '').toLowerCase().includes(q);
        if (!codeMatch && !nameMatch && !enMatch && !altMatch) return false;
      }

      return true;
    });

    // Ordenamiento
    this.filteredMoves.sort((a, b) => {
      switch (f.sort) {
        case 'id_desc': return b.id - a.id;
        case 'potencia_desc': return (b.potencia || 0) - (a.potencia || 0);
        case 'potencia_asc': return (a.potencia || 0) - (b.potencia || 0);
        case 'precision_desc': return (b.precision || 0) - (a.precision || 0);
        case 'pp_desc': return (b.pp || 0) - (a.pp || 0);
        case 'nombre_asc': return a.nombre.localeCompare(b.nombre, 'es');
        case 'gen_asc': return a.gen - b.gen || a.id - b.id;
        case 'id_asc':
        default:
          return a.id - b.id;
      }
    });

    // Actualizar recuento
    const countLabel = document.getElementById('moveCountLabel') || document.getElementById('showingCountLabel');
    if (countLabel) {
      countLabel.textContent = `Mostrando ${this.filteredMoves.length} de ${this.moves.length} Movimientos`;
    }

    this.renderGrid();
    this.renderPagination();
  }

  static renderGrid() {
    const grid = document.getElementById('movesArenaGrid');
    if (!grid) return;

    if (this.filteredMoves.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <div style="font-size: 3rem; margin-bottom: 12px;">🔍</div>
          <h3>No se encontraron movimientos</h3>
          <p>Prueba ajustando los filtros de clase, tipo, generación o búsqueda.</p>
        </div>
      `;
      return;
    }

    const startIdx = (this.currentPage - 1) * this.pageSize;
    const endIdx = startIdx + this.pageSize;
    const pageItems = this.filteredMoves.slice(startIdx, endIdx);

    grid.innerHTML = pageItems.map(m => {
      const potVal = m.potencia !== null ? m.potencia : (m.potencia_texto || '-');
      const accVal = m.precision !== null ? `${m.precision}%` : (m.precision_texto || '-');
      const ppVal = m.pp !== null ? m.pp : (m.pp_texto || '-');
      const altText = m.nombre_alt ? `<div class="card-name-alt">LA: ${m.nombre_alt}</div>` : '';
      const prio = m.prioridad !== null && m.prioridad !== undefined ? m.prioridad : 0;

      const codeTooltip = `ID #${m.codigo}: Identificador oficial en la base de datos de movimientos.`;
      const genTooltip = `Generación ${m.gen}: Movimiento introducido en la Generación ${m.gen} de Pokémon.`;
      let prioTooltip = '';
      if (prio === 0) {
        prioTooltip = 'Prioridad 0 (Normal): Ataca primero el Pokémon con mayor Velocidad en el turno.';
      } else if (prio > 0) {
        prioTooltip = `Prioridad +${prio} (Ataque Rápido): Se ejecuta antes que los ataques normales.`;
      } else {
        prioTooltip = `Prioridad ${prio} (Movimiento Retardado): Se ejecuta después de los ataques normales.`;
      }

      const potTooltip = m.potencia !== null
        ? `Potencia (${potVal}): Fuerza de impacto base del movimiento.`
        : 'Potencia (-): Este movimiento no causa daño directo de impacto de salud.';
      const accTooltip = m.precision !== null
        ? `Precisión (${accVal}): Probabilidad porcentual de acertar el golpe al objetivo.`
        : 'Precisión (-): Movimiento infalible que nunca falla al ejecutarse.';
      const ppTooltip = `Puntos de Poder (${ppVal} PP): Cantidad de veces que se puede utilizar antes de agotarse.`;

      const typeBadge = typeof AttackSpriteManager !== 'undefined'
        ? AttackSpriteManager.renderTypeBadge(m.tipo, true, { className: 'filter-type-badge-img' })
        : `<span class="badge-type type-${m.tipo}">${m.tipo}</span>`;

      const catBadge = typeof AttackSpriteManager !== 'undefined'
        ? AttackSpriteManager.renderCategoryBadge(m.clase, false)
        : `<span class="badge-class class-${m.clase.toLowerCase()}">${m.clase}</span>`;

      return `
        <div class="move-card move-hud-card" onclick="MovimientosModule.openMoveDetailById(${m.id})">
          <div class="move-card-top-bar card-top-meta">
            <span class="card-code has-tooltip" data-tooltip="${codeTooltip}">#${m.codigo}</span>
            <span class="pokemon-gen-label pokemon-gen-badge card-gen has-tooltip" data-tooltip="${genTooltip}">GEN ${m.gen}</span>
          </div>

          <div class="move-card-names card-names">
            <h3 class="card-name-es">${m.nombre}</h3>
            <div class="card-name-en">${m.nombre_ingles}</div>
            ${altText}
          </div>

          <div class="move-badges-prio-row card-badges-row">
            <div class="move-badges-left">
              ${typeBadge}
              ${catBadge}
            </div>
            <div class="move-priority-right has-tooltip" data-tooltip="${prioTooltip}">
              Prioridad: ${prio}
            </div>
          </div>

          <div class="move-stats-hud card-stats-hud">
            <div class="move-stat-item stat-hud-col has-tooltip" data-tooltip="${potTooltip}">
              <span class="m-stat-lbl stat-hud-label">POTENCIA</span>
              <div class="m-stat-box stat-hud-box">
                <span class="m-stat-icon stat-hud-icon">💥</span>
                <span class="m-stat-val stat-hud-num">${potVal}</span>
              </div>
            </div>
            <div class="move-stat-item stat-hud-col has-tooltip" data-tooltip="${accTooltip}">
              <span class="m-stat-lbl stat-hud-label">PRECISIÓN</span>
              <div class="m-stat-box stat-hud-box">
                <span class="m-stat-icon stat-hud-icon">🎯</span>
                <span class="m-stat-val stat-hud-num">${accVal}</span>
              </div>
            </div>
            <div class="move-stat-item stat-hud-col has-tooltip" data-tooltip="${ppTooltip}">
              <span class="m-stat-lbl stat-hud-label">PP</span>
              <div class="m-stat-box stat-hud-box">
                <span class="m-stat-icon stat-hud-icon">⚡</span>
                <span class="m-stat-val stat-hud-num">${ppVal}</span>
              </div>
            </div>
          </div>

          <div class="move-card-desc card-description">
            ${m.descripcion || 'Sin descripción disponible.'}
          </div>
        </div>
      `;
    }).join('');
  }

  static renderPagination() {
    const dock = document.getElementById('movesPaginationDock');
    const totalItems = this.filteredMoves.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / this.pageSize));
    const current = this.currentPage;

    const startIdx = totalItems === 0 ? 0 : (current - 1) * this.pageSize + 1;
    const endIdx = Math.min(current * this.pageSize, totalItems);
    const totalFormatted = totalItems.toLocaleString('es-ES');

    // 1. Sincronizar mini-paginación del panel superior de filtros (Fila 4)
    const miniCurrent = document.getElementById('moveMiniPageCurrent');
    const miniTotal = document.getElementById('moveMiniPageTotal');
    const miniPrev = document.getElementById('moveMiniPagePrevBtn');
    const miniNext = document.getElementById('moveMiniPageNextBtn');
    if (miniCurrent) miniCurrent.textContent = current;
    if (miniTotal) miniTotal.textContent = totalPages;
    if (miniPrev) miniPrev.disabled = current <= 1;
    if (miniNext) miniNext.disabled = current >= totalPages;

    // 2. Renderizar dock de paginación inferior adaptado a la paleta Stadium
    if (!dock) return;

    if (totalItems === 0) {
      dock.innerHTML = '';
      dock.style.display = 'none';
      return;
    }

    dock.style.display = 'flex';
    dock.innerHTML = `
      <div class="pagination-left-wrap">
        <div class="pagination-page-size-wrap">
          <span class="page-size-lbl">Mostrar</span>
          <div class="page-size-select-box has-tooltip" data-tooltip="Cantidad de movimientos a mostrar por página.">
            <select id="movePageSizeSelect" class="page-size-select" onchange="MovimientosModule.onPageSizeChange(this.value)">
              <option value="40" ${this.pageSize === 40 ? 'selected' : ''}>40</option>
              <option value="45" ${this.pageSize === 45 ? 'selected' : ''}>45</option>
              <option value="50" ${this.pageSize === 50 ? 'selected' : ''}>50</option>
              <option value="55" ${this.pageSize === 55 ? 'selected' : ''}>55</option>
              <option value="60" ${this.pageSize === 60 ? 'selected' : ''}>60</option>
            </select>
          </div>
          <span class="page-size-lbl">registros</span>
        </div>
        <div class="pagination-divider"></div>
        <div class="pagination-info-left has-tooltip" data-tooltip="Rango de movimientos mostrados en la página actual sobre el total del catálogo filtrado.">
          Mostrando <b>${startIdx} - ${endIdx}</b> de <b>${totalFormatted}</b> registros
        </div>
      </div>
      <div class="pagination-controls-right">
        <button class="btn-pagination-action has-tooltip"
                onclick="MovimientosModule.goToPage(${current - 1})"
                ${current <= 1 ? 'disabled' : ''}
                data-tooltip="Ir a la página anterior (${Math.max(1, current - 1)} de ${totalPages})"
                aria-label="Página anterior">
          <span class="nav-chevron">‹</span>
        </button>
        <span class="pagination-current-pill has-tooltip" data-tooltip="Página actual ${current} de un total de ${totalPages} páginas.">
          <span class="pill-full-text">Página ${current} de ${totalPages}</span>
          <span class="pill-short-text">${current} / ${totalPages}</span>
        </span>
        <button class="btn-pagination-action has-tooltip"
                onclick="MovimientosModule.goToPage(${current + 1})"
                ${current >= totalPages ? 'disabled' : ''}
                data-tooltip="Ir a la página siguiente (${Math.min(totalPages, current + 1)} de ${totalPages})"
                aria-label="Página siguiente">
          <span class="nav-chevron">›</span>
        </button>
      </div>
    `;
  }

  static onPageSizeChange(newSize) {
    const size = parseInt(newSize, 10);
    if (isNaN(size) || size <= 0) return;
    this.pageSize = size;
    this.currentPage = 1;
    if (window.SFX) window.SFX.playFilter();
    this.renderGrid();
    this.renderPagination();
  }

  static goToPage(pageNum) {
    const totalPages = Math.ceil(this.filteredMoves.length / this.pageSize);
    if (pageNum < 1 || pageNum > totalPages) return;
    this.currentPage = pageNum;
    if (window.SFX) window.SFX.playNav();
    const currentScrollY = window.scrollY;
    this.renderGrid();
    this.renderPagination();
    if (window.scrollY !== currentScrollY) {
      window.scrollTo({ top: currentScrollY, behavior: 'instant' });
    }
  }

  static setupModalEvents() {
    const modal = document.getElementById('moveDetailModal');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => this.closeModal());
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const mModal = document.getElementById('moveDetailModal');
        if (mModal && mModal.classList.contains('open')) {
          this.closeModal();
        }
      }
    });
  }

  static closeModal() {
    const modal = document.getElementById('moveDetailModal');
    if (modal) modal.classList.remove('open');
  }

  static getPokemonSpriteUrl(p) {
    if (typeof PokemonModule !== 'undefined' && PokemonModule.getPokemonSpriteUrl) {
      return PokemonModule.getPokemonSpriteUrl(p);
    }
    if (!p) return '';
    const nameL = (p.name || '').toLowerCase();
    const idL = (p.id || '').toLowerCase();
    const isRegional = nameL.includes('alola') || nameL.includes('galar') || nameL.includes('hisui') || nameL.includes('paldea') ||
                       idL.includes('alola') || idL.includes('galar') || idL.includes('hisui') || idL.includes('paldea');

    if (isRegional) {
      let slug = nameL.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (slug.includes('mr-mime')) slug = slug.replace('mr-mime', 'mrmime');
      if (slug.includes('tauros-paldea-')) slug = slug.replace('tauros-paldea-', 'tauros-paldea');
      return `https://play.pokemonshowdown.com/sprites/gen5/${slug}.png`;
    }

    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.num}.png`;
  }

  static getPokemonSpriteFallback(p) {
    if (typeof PokemonModule !== 'undefined' && PokemonModule.getPokemonSpriteFallback) {
      return PokemonModule.getPokemonSpriteFallback(p);
    }
    if (!p) return '';
    let slug = (p.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (slug.includes('mr-mime')) slug = slug.replace('mr-mime', 'mrmime');
    if (slug.includes('tauros-paldea-')) slug = slug.replace('tauros-paldea-', 'tauros-paldea');
    return `https://play.pokemonshowdown.com/sprites/gen5/${slug}.png`;
  }

  static openMoveDetailById(moveId) {
    const found = this.moves.find(m => m.id === moveId || String(m.codigo) === String(moveId));
    if (found) {
      // Cerrar modal de pokemon si estuviese abierto
      const pModal = document.getElementById('pokemonDetailModal');
      if (pModal) pModal.classList.remove('open');

      this.openMoveDetail(found);
    }
  }

  static openMoveDetail(m) {
    if (window.SFX) window.SFX.playModalOpen();

    const modal = document.getElementById('moveDetailModal');
    const headerMeta = document.getElementById('modalMoveHeaderMeta');
    const content = document.getElementById('modalMoveContent');
    if (!modal || !content) return;

    const potVal = m.potencia !== null ? m.potencia : (m.potencia_texto || '-');
    const accVal = m.precision !== null ? `${m.precision}%` : (m.precision_texto || '-');
    const ppVal = m.pp !== null ? m.pp : (m.pp_texto || '-');
    const altText = m.nombre_alt ? `<div class="move-modal-title-alt">LA: ${m.nombre_alt}</div>` : '';
    const prio = m.prioridad !== null && m.prioridad !== undefined ? m.prioridad : 0;

    const codeTooltip = `ID #${m.codigo}: Número de registro oficial en la base de datos de movimientos.`;
    const genTooltip = `Generación ${m.gen}: Movimiento introducido en la Generación ${m.gen} de Pokémon.`;
    let prioTooltip = '';
    if (prio === 0) {
      prioTooltip = 'Prioridad 0 (Normal): Ataca primero el Pokémon con mayor Velocidad en el turno.';
    } else if (prio > 0) {
      prioTooltip = `Prioridad +${prio} (Ataque Rápido): Se ejecuta antes que los ataques normales.`;
    } else {
      prioTooltip = `Prioridad ${prio} (Movimiento Retardado): Se ejecuta después de los ataques normales.`;
    }

    const potTooltip = m.potencia !== null
      ? `Potencia (${potVal}): Fuerza de impacto base del movimiento.`
      : 'Potencia (-): Este movimiento no causa daño directo de impacto de salud.';
    const accTooltip = m.precision !== null
      ? `Precisión (${accVal}): Probabilidad porcentual de acertar el golpe al objetivo.`
      : 'Precisión (-): Movimiento infalible que nunca falla al ejecutarse.';
    const ppTooltip = `Puntos de Poder (${ppVal} PP): Cantidad de veces que se puede utilizar antes de agotarse.`;

    if (headerMeta) {
      const codeFormatted = '#' + String(m.codigo).padStart(4, '0');
      headerMeta.innerHTML = `
        <span class="card-code has-tooltip" data-tooltip="${codeTooltip}">${codeFormatted}</span>
        <span class="card-gen has-tooltip" data-tooltip="${genTooltip}">Gen ${m.gen}</span>
      `;
    }

    // Filtrar Pokémon compatibles (que tienen este movimiento en su array moves)
    const compatiblePokemon = this.pokemonList.filter(p => Array.isArray(p.moves) && p.moves.includes(m.id));

    content.innerHTML = `
      <!-- SECCIÓN SUPERIOR: DATOS DEL MOVIMIENTO (2 COLUMNAS) -->
      <div class="move-modal-top-panel">
        <div class="move-modal-col-left">
          <h2 class="move-modal-title-es">${m.nombre}</h2>
          <div class="move-modal-title-en">${m.nombre_ingles}</div>
          ${altText}
          <div class="move-modal-badges-row">
            ${typeof AttackSpriteManager !== 'undefined'
              ? AttackSpriteManager.renderTypeBadge(m.tipo, true, { className: 'filter-type-badge-img' })
              : `<span class="badge-type type-${m.tipo}">${m.tipo}</span>`}
            ${typeof AttackSpriteManager !== 'undefined'
              ? AttackSpriteManager.renderCategoryBadge(m.clase, false)
              : `<span class="badge-class class-${m.clase.toLowerCase()}">${m.clase}</span>`}
          </div>
        </div>

        <div class="move-modal-col-right">
          <div class="move-modal-priority-label has-tooltip" data-tooltip="${prioTooltip}">Prioridad: ${prio}</div>
          <div class="move-modal-stats-hud">
            <div class="stat-hud-col has-tooltip" data-tooltip="${potTooltip}">
              <div class="stat-hud-label">POTENCIA</div>
              <div class="stat-hud-box">
                <span class="stat-hud-icon">💥</span>
                <span class="stat-hud-num">${potVal}</span>
              </div>
            </div>
            <div class="stat-hud-col has-tooltip" data-tooltip="${accTooltip}">
              <div class="stat-hud-label">PRECISIÓN</div>
              <div class="stat-hud-box">
                <span class="stat-hud-icon">🎯</span>
                <span class="stat-hud-num">${accVal}</span>
              </div>
            </div>
            <div class="stat-hud-col has-tooltip" data-tooltip="${ppTooltip}">
              <div class="stat-hud-label">PP</div>
              <div class="stat-hud-box">
                <span class="stat-hud-icon">⚡</span>
                <span class="stat-hud-num">${ppVal}</span>
              </div>
            </div>
          </div>
          <div class="move-modal-desc">${m.descripcion || 'Sin descripción disponible.'}</div>
        </div>
      </div>

      <!-- SECCIÓN INFERIOR: POKÉMON COMPATIBLES -->
      <div class="move-modal-compat-section">
        <div class="move-modal-compat-header">
          <div class="compat-header-title">
            🐾 Pokémon compatibles <span class="compat-count-badge">(${compatiblePokemon.length})</span>
          </div>
          <div class="compat-search-wrap">
            <input type="text" id="modalMovePokemonSearchInput" class="compat-search-input" placeholder="Filtrar Pokémon...">
          </div>
        </div>

        <div class="compatible-pokemon-list-scroll" id="compatiblePokemonList">
          <!-- Tarjetas generadas dinámicamente -->
        </div>
      </div>
    `;

    this.renderCompatiblePokemonList(compatiblePokemon);

    const searchInput = document.getElementById('modalMovePokemonSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        const filtered = compatiblePokemon.filter(p => {
          const nameMatch = p.name.toLowerCase().includes(q) || (p.nombre_ingles && p.nombre_ingles.toLowerCase().includes(q));
          const numMatch = String(p.num).includes(q) || String(p.num).padStart(3, '0').includes(q);
          const typeMatch = (p.types || []).some(t => t.toLowerCase().includes(q));
          return nameMatch || numMatch || typeMatch;
        });
        this.renderCompatiblePokemonList(filtered);
      });
    }

    modal.classList.add('open');
  }

  static renderCompatiblePokemonList(pokeList) {
    const container = document.getElementById('compatiblePokemonList');
    if (!container) return;

    if (pokeList.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 10px; color: var(--text-muted); font-size: 0.95rem;">
          No se encontraron Pokémon compatibles con este criterio.
        </div>
      `;
      return;
    }

    container.innerHTML = pokeList.map(p => {
      const numFormatted = String(p.num).padStart(3, '0');
      const st = p.stats || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, total: 0 };
      const bstVal = st.total || (st.hp + st.atk + st.def + st.spa + st.spd + st.spe) || 0;
      const hpVal = st.hp || 0;
      const atkVal = st.atk || 0;
      const spaVal = st.spa || 0;
      const defVal = st.def || 0;
      const spdVal = st.spd || 0;
      const speVal = st.spe || 0;

      const numTooltip = `Pokédex Nacional #${numFormatted}: Identificador oficial del Pokémon.`;
      const genTooltip = `Generación ${p.gen}: Pokémon introducido en la Generación ${p.gen}.`;
      const nameTooltip = `Especie: ${p.name}. Haz clic para abrir su ficha completa.`;
      const spriteTooltip = `Sprite oficial de ${p.name}. Haz clic para abrir su ficha completa.`;
      const hpTooltip = `Puntos de Salud (HP: ${hpVal}): Vitalidad máxima del Pokémon antes de debilitarse.`;
      const atkTooltip = `Ataque Físico (ATK: ${atkVal}): Potencia el impacto de movimientos físicos.`;
      const spaTooltip = `Ataque Especial (ATK ESP: ${spaVal}): Potencia el impacto de movimientos especiales.`;
      const defTooltip = `Defensa Física (DEF: ${defVal}): Reduce el daño recibido ante ataques físicos.`;
      const spdTooltip = `Defensa Especial (DEF ESP: ${spdVal}): Reduce el daño recibido ante ataques especiales.`;
      const speTooltip = `Velocidad (VEL: ${speVal}): Determina el orden de turno en combate.`;
      const bstTooltip = `BST (${bstVal} pts): Base Stat Total. Suma total de las 6 estadísticas base.`;

      const spriteUrl = this.getPokemonSpriteUrl(p);
      const fallbackUrl = this.getPokemonSpriteFallback(p);

      const typesStackHtml = (p.types || []).map(t => {
        const typeTip = `Tipo ${t}: Otorga daño adicional por STAB a ataques ${t}.`;
        return typeof AttackSpriteManager !== 'undefined'
          ? AttackSpriteManager.renderTypeBadge(t, true, { className: 'compat-type-badge-img has-tooltip', tooltip: typeTip })
          : `<span class="badge-type type-${t} has-tooltip" data-tooltip="${typeTip}">${t}</span>`;
      }).join('');

      return `
        <div class="compatible-pokemon-card" onclick="MovimientosModule.onPokemonCardClick('${p.id}')">
          <!-- 1. IDENTIDAD: CÓDIGO, GENERACIÓN Y NOMBRE -->
          <div class="compat-card-identity">
            <div class="compat-top-meta">
              <span class="card-code has-tooltip" data-tooltip="${numTooltip}">#${numFormatted}</span>
              <span class="compat-gen-label has-tooltip" data-tooltip="${genTooltip}">GEN ${p.gen}</span>
            </div>
            <div class="compat-poke-name has-tooltip" data-tooltip="${nameTooltip}">${p.name}</div>
          </div>

          <!-- 2. SPRITE CON PEDESTAL ILUMINADO CIAN -->
          <div class="compat-card-sprite-wrap has-tooltip" data-tooltip="${spriteTooltip}">
            <div class="compat-sprite-pedestal"></div>
            <img class="compat-mini-sprite"
                 src="${spriteUrl}"
                 alt="${p.name}"
                 loading="lazy"
                 onerror="this.onerror=null; if('${fallbackUrl}') this.src='${fallbackUrl}'; else this.style.display='none';">
          </div>

          <!-- 3. TIPOS APILADOS VERTICALMENTE -->
          <div class="compat-card-types">
            ${typesStackHtml}
          </div>

          <!-- 4. BLOQUE DE 6 ESTADÍSTICAS + BST -->
          <div class="compat-card-stats-wrap">
            <div class="compat-card-stats-6">
              <div class="compat-stat-col has-tooltip" data-tooltip="${hpTooltip}">
                <div class="compat-stat-lbl">HP</div>
                <div class="compat-stat-val">${hpVal}</div>
              </div>
              <div class="compat-stat-col has-tooltip" data-tooltip="${atkTooltip}">
                <div class="compat-stat-lbl">ATK</div>
                <div class="compat-stat-val">${atkVal}</div>
              </div>
              <div class="compat-stat-col has-tooltip" data-tooltip="${spaTooltip}">
                <div class="compat-stat-lbl">ATK ESP</div>
                <div class="compat-stat-val">${spaVal}</div>
              </div>
              <div class="compat-stat-col has-tooltip" data-tooltip="${defTooltip}">
                <div class="compat-stat-lbl">DEF</div>
                <div class="compat-stat-val">${defVal}</div>
              </div>
              <div class="compat-stat-col has-tooltip" data-tooltip="${spdTooltip}">
                <div class="compat-stat-lbl">DEF ESP</div>
                <div class="compat-stat-val">${spdVal}</div>
              </div>
              <div class="compat-stat-col has-tooltip" data-tooltip="${speTooltip}">
                <div class="compat-stat-lbl">VEL</div>
                <div class="compat-stat-val">${speVal}</div>
              </div>
            </div>

            <!-- 5. BST BADGE -->
            <div class="compat-card-bst has-tooltip" data-tooltip="${bstTooltip}">
              <span class="compat-bst-lbl">BST:</span>
              <span class="compat-bst-val">${bstVal}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // NAVEGACIÓN BIDIRECCIONAL: Al hacer clic en un Pokémon desde el modal de Movimiento
  static onPokemonCardClick(pokeId) {
    this.closeModal();
    if (window.StadiumRouter) {
      window.StadiumRouter.navigate('pokemon', { open: pokeId });
    } else if (window.PokemonModule) {
      window.PokemonModule.openPokemonDetailById(pokeId);
    }
  }
}

if (typeof window !== 'undefined') {
  window.MovimientosModule = MovimientosModule;
}
