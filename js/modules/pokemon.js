// ====================================================================
// MÓDULO: POKÉDEX STADIUM (POKÉMON) - POKÉMON STADIUM WORLD
// ====================================================================
class PokemonModule {
  static pokemon = [];
  static filteredPokemon = [];
  static movesById = new Map();
  static currentPage = 1;
  static pageSize = 40;

  static filters = {
    gen: 'all',
    form: 'all',
    types: [],
    search: '',
    sort: 'num_asc'
  };

  static REGIONS = {
    1: 'Kanto',
    2: 'Johto',
    3: 'Hoenn',
    4: 'Sinnoh',
    5: 'Teselia (Unova)',
    6: 'Kalos',
    7: 'Alola',
    8: 'Galar',
    9: 'Paldea'
  };

  static getGenTooltip(gen) {
    const region = this.REGIONS[gen];
    return region
      ? `Generación ${gen}: Especie originaria de la región de ${region}.`
      : `Generación ${gen}: Introducido en la Generación ${gen} de Pokémon.`;
  }

  static getFormBadgeInfo(nameL = '', idL = '') {
    if (nameL.includes('-gmax') || idL.includes('gmax')) {
      return {
        badgeHtml: `<span class="pokemon-form-badge badge-gmax has-tooltip" data-tooltip="Forma Gigamax: Variante colosal con movimientos G-Max exclusivos y estadísticas aumentadas.">💥 G-MAX</span>`
      };
    } else if (nameL.includes('-mega') || idL.includes('mega')) {
      return {
        badgeHtml: `<span class="pokemon-form-badge badge-mega has-tooltip" data-tooltip="Megaevolución: Transformación en combate con estadísticas base altamente potenciadas.">⭐ MEGA</span>`
      };
    } else if (nameL.includes('-alola') || idL.includes('alola')) {
      return {
        badgeHtml: `<span class="pokemon-form-badge badge-regional has-tooltip" data-tooltip="Forma Regional de Alola: Adaptación biológica al archipiélago de Alola con tipos o estadísticas alternativas.">ALOLA</span>`
      };
    } else if (nameL.includes('-galar') || idL.includes('galar')) {
      return {
        badgeHtml: `<span class="pokemon-form-badge badge-regional has-tooltip" data-tooltip="Forma Regional de Galar: Variante biológica adaptada al entorno de la región de Galar.">GALAR</span>`
      };
    } else if (nameL.includes('-hisui') || idL.includes('hisui')) {
      return {
        badgeHtml: `<span class="pokemon-form-badge badge-regional has-tooltip" data-tooltip="Forma Regional de Hisui: Variante ancestral adaptada a la antigua región de Hisui (Sinnoh feudal).">HISUI</span>`
      };
    } else if (nameL.includes('-paldea') || idL.includes('paldea')) {
      return {
        badgeHtml: `<span class="pokemon-form-badge badge-regional has-tooltip" data-tooltip="Forma Regional de Paldea: Variante biológica adaptada al ecosistema de la región de Paldea.">PALDEA</span>`
      };
    }
    return { badgeHtml: '' };
  }

  static getPokemonSpriteUrl(p) {
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

    // Sprite oficial estático de PokeAPI (pixel art original con fondo transparente)
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.num}.png`;
  }

  static getPokemonSpriteFallback(p) {
    if (!p) return '';
    let slug = (p.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (slug.includes('mr-mime')) slug = slug.replace('mr-mime', 'mrmime');
    if (slug.includes('tauros-paldea-')) slug = slug.replace('tauros-paldea-', 'tauros-paldea');
    return `https://play.pokemonshowdown.com/sprites/gen5/${slug}.png`;
  }

  static init(pokemonList = [], movesByIdMap = new Map()) {
    this.pokemon = pokemonList;
    this.movesById = movesByIdMap;
    this.setupFilterEvents();
    this.setupTypeChips();
    this.setupModalEvents();
    this.applyFiltersAndSort();
  }

  static setupFilterEvents() {
    // Input de búsqueda
    const searchInput = document.getElementById('pokemonSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value.trim();
        this.currentPage = 1;
        this.applyFiltersAndSort();
      });
    }

    // Selector de orden
    const sortSelect = document.getElementById('pokemonSortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.filters.sort = e.target.value;
        this.currentPage = 1;
        this.applyFiltersAndSort();
      });
    }

    // Chips de Generación
    document.querySelectorAll('#pokemonGenFiltersRow .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (window.SFX) window.SFX.playFilter();
        document.querySelectorAll('#pokemonGenFiltersRow .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filters.gen = chip.dataset.gen;
        this.currentPage = 1;
        this.applyFiltersAndSort();
      });
    });

    // Chips de Forma Especial (Megas, Gigamax, Regionales)
    document.querySelectorAll('#pokemonFormFiltersRow .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (window.SFX) window.SFX.playFilter();
        document.querySelectorAll('#pokemonFormFiltersRow .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filters.form = chip.dataset.form;
        this.currentPage = 1;
        this.applyFiltersAndSort();
      });
    });
  }

  static setupTypeChips() {
    const container = document.getElementById('pokemonTypeFiltersRow');
    if (!container) return;

    const ELEMENTAL_TYPES = [
      'Normal', 'Fuego', 'Agua', 'Planta', 'Eléctrico', 'Hielo',
      'Lucha', 'Veneno', 'Tierra', 'Volador', 'Psíquico', 'Bicho',
      'Roca', 'Fantasma', 'Dragón', 'Siniestro', 'Acero', 'Hada'
    ];

    this.filters.types = [];

    // Limpiar chips previos excepto el botón 'Todos los Tipos'
    const allChip = container.querySelector('[data-type="all"]');
    container.innerHTML = '';
    if (allChip) container.appendChild(allChip);

    ELEMENTAL_TYPES.forEach(t => {
      const chip = document.createElement('button');
      chip.className = 'filter-chip filter-type-chip has-tooltip';
      chip.dataset.type = t;
      const desc = (typeof AttackSpriteManager !== 'undefined' && AttackSpriteManager.TYPE_DESCRIPTIONS && AttackSpriteManager.TYPE_DESCRIPTIONS[t])
        ? AttackSpriteManager.TYPE_DESCRIPTIONS[t]
        : `Tipo ${t}: Filtrar Pokémon con tipo ${t}.`;
      chip.setAttribute('data-tooltip', desc);
      chip.innerHTML = typeof AttackSpriteManager !== 'undefined'
        ? `<img src="${AttackSpriteManager.getTypeBadgeUrl(t)}" alt="${t}" class="filter-type-badge-img">`
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

    this.filteredPokemon = this.pokemon.filter(p => {
      // Filtro por gen
      if (f.gen !== 'all' && String(p.gen) !== String(f.gen)) return false;

      const nameL = (p.name || '').toLowerCase();
      const idL = (p.id || '').toLowerCase();
      const isMega = nameL.includes('-mega') || idL.includes('mega');
      const isGmax = nameL.includes('-gmax') || idL.includes('gmax') || nameL.includes('gigamax');
      const isRegional = nameL.includes('-alola') || nameL.includes('-galar') ||
                         nameL.includes('-hisui') || nameL.includes('-paldea') ||
                         idL.includes('alola') || idL.includes('galar') ||
                         idL.includes('hisui') || idL.includes('paldea');

      // Filtro por Forma Especial
      if (f.form && f.form !== 'all') {
        if (f.form === 'mega' && !isMega) return false;
        if (f.form === 'gmax' && !isGmax) return false;
        if (f.form === 'regional' && !isRegional) return false;
        if (f.form === 'standard' && (isMega || isGmax || isRegional)) return false;
      }

      // Filtro por tipo elemental (soporta 1 o 2 tipos simultáneos)
      const selectedTypes = f.types || [];
      if (selectedTypes.length > 0) {
        const pTypes = p.types || [];
        const pTypesEn = p.types_en || [];
        const matchesAllSelected = selectedTypes.every(t => pTypes.includes(t) || pTypesEn.includes(t));
        if (!matchesAllSelected) return false;
      }

      // Filtro de búsqueda por texto o número
      if (f.search) {
        const q = f.search.trim().toLowerCase();
        const rawNum = q.replace(/^#+/, '');
        const numMatch = String(p.num) === rawNum || String(p.num).padStart(3, '0') === rawNum;
        const nameMatch = nameL.includes(q);
        const idMatch = idL.includes(q);
        const enMatch = p.nombre_ingles && p.nombre_ingles.toLowerCase().includes(q);

        let formSearchMatch = false;
        if (q === 'gigamax' || q.includes('gigamax') || q === 'gmax' || q.includes('gmax') || q === 'g-max') {
          formSearchMatch = isGmax;
        } else if (q === 'mega' || q.includes('mega')) {
          formSearchMatch = isMega;
        }

        if (!numMatch && !nameMatch && !idMatch && !enMatch && !formSearchMatch) return false;
      }

      return true;
    });

    // Ordenamiento
    this.filteredPokemon.sort((a, b) => {
      const stA = a.stats || {};
      const stB = b.stats || {};
      switch (f.sort) {
        case 'num_desc': return b.num - a.num;
        case 'total_desc': return (stB.total || 0) - (stA.total || 0);
        case 'total_asc': return (stA.total || 0) - (stB.total || 0);
        case 'atk_desc': return (stB.atk || 0) - (stA.atk || 0);
        case 'spa_desc': return (stB.spa || 0) - (stA.spa || 0);
        case 'spe_desc': return (stB.spe || 0) - (stA.spe || 0);
        case 'name_asc': return a.name.localeCompare(b.name, 'es');
        case 'num_asc':
        default:
          if (a.num !== b.num) return a.num - b.num;
          return a.name.localeCompare(b.name);
      }
    });

    // Actualizar recuento
    const countLabel = document.getElementById('pokemonCountLabel');
    if (countLabel) {
      const typeFilterText = f.types && f.types.length > 0
        ? ` (${f.types.join(' + ')})`
        : '';
      countLabel.textContent = `Mostrando ${this.filteredPokemon.length} de ${this.pokemon.length} Pokémon${typeFilterText}`;
    }

    this.renderGrid();
    this.renderPagination();
  }

  static renderGrid() {
    const grid = document.getElementById('pokemonArenaGrid');
    if (!grid) return;

    if (this.filteredPokemon.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <div style="font-size: 3rem; margin-bottom: 12px;">🔍</div>
          <h3>No se encontraron Pokémon</h3>
          <p>Prueba ajustando los filtros de generación, forma, tipos o el término de búsqueda.</p>
        </div>
      `;
      return;
    }

    const startIdx = (this.currentPage - 1) * this.pageSize;
    const endIdx = startIdx + this.pageSize;
    const pageItems = this.filteredPokemon.slice(startIdx, endIdx);

    grid.innerHTML = pageItems.map(p => {
      const numFormatted = '#' + String(p.num).padStart(3, '0');
      const st = p.stats || { total: 0, hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      const nameL = (p.name || '').toLowerCase();
      const idL = (p.id || '').toLowerCase();

      const formBadge = this.getFormBadgeInfo(nameL, idL).badgeHtml;

      const numTooltip = `Pokédex Nacional ${numFormatted}: Identificador oficial del Pokémon en la Pokédex.`;
      const genTooltip = this.getGenTooltip(p.gen);
      const bstTooltip = `BST (${st.total || 0} pts): Base Stat Total. Suma total de las 6 estadísticas base; refleja el potencial y poder general en combate.`;
      const nameTooltip = `Especie: ${p.name}. Haz clic en la tarjeta para abrir su ficha completa, movimientos y debilidades.`;
      const subNameTooltip = p.nombre_ingles ? `Nombre oficial en inglés: ${p.nombre_ingles}.` : '';

      const typesHtml = (p.types || []).map(t => {
        const typeDesc = (typeof AttackSpriteManager !== 'undefined' && AttackSpriteManager.TYPE_DESCRIPTIONS && AttackSpriteManager.TYPE_DESCRIPTIONS[t])
          ? AttackSpriteManager.TYPE_DESCRIPTIONS[t]
          : `Tipo ${t}: Determina las fortalezas, debilidades elementales y bonificación por STAB.`;
        const typeTip = `Tipo ${t}: Otorga daño adicional por STAB a ataques ${t}. ${typeDesc.replace(/^Tipo [^:]+:\s*/, '')}`;

        return typeof AttackSpriteManager !== 'undefined'
          ? AttackSpriteManager.renderTypeBadge(t, true, { className: 'type-badge-official-img has-tooltip', tooltip: typeTip })
          : `<span class="badge-type type-${t} has-tooltip" data-tooltip="${typeTip}">${t}</span>`;
      }).join('');

      const spriteUrl = this.getPokemonSpriteUrl(p);
      const fallbackUrl = this.getPokemonSpriteFallback(p);
      const spriteTooltip = `Sprite oficial de ${p.name}: Ilustración gráfica estática de la especie.`;

      const hpTooltip = `Puntos de Salud (HP: ${st.hp || 0}): Determina la vitalidad máxima del Pokémon antes de debilitarse en batalla.`;
      const atkTooltip = `Ataque Físico (ATK: ${st.atk || 0}): Potencia el impacto de movimientos de categoría física (contacto directo como Placaje o Cascada).`;
      const defTooltip = `Defensa Física (DEF: ${st.def || 0}): Reduce el daño recibido al ser impactado por ataques físicos del oponente.`;
      const speTooltip = `Velocidad (VEL: ${st.spe || 0}): Determina el orden de turno; el Pokémon con mayor velocidad actuará primero en combate.`;
      const spaTooltip = `Ataque Especial (ATK ESP: ${st.spa || 0}): Potencia el daño de ataques de categoría especial (proyectiles y energía como Surf o Rayo).`;
      const spdTooltip = `Defensa Especial (DEF ESP: ${st.spd || 0}): Reduce el impacto del daño recibido por ataques especiales del adversario.`;

      return `
        <div class="pokemon-hud-card pokemon-card-arena" onclick="PokemonModule.openPokemonDetailById('${p.id}')">
          <div class="p-card-top-bar card-identity-header pokemon-card-top">
            <div class="p-card-top-left">
              <span class="pokemon-num-badge has-tooltip" data-tooltip="${numTooltip}">${numFormatted}</span>
              ${formBadge}
              <span class="pokemon-gen-label pokemon-gen-badge has-tooltip" data-tooltip="${genTooltip}">GEN ${p.gen}</span>
            </div>
            <div class="p-card-bst-dock p-card-top-bst has-tooltip" data-tooltip="${bstTooltip}">
              <span class="p-bst-label">BST</span>
              <span class="p-bst-val">${st.total || 0}</span>
            </div>
          </div>

          <div class="p-card-center card-names-wrap">
            <div class="pokemon-card-sprite-wrap">
              <img src="${spriteUrl}" alt="${p.name}" class="pokemon-card-sprite has-tooltip" data-tooltip="${spriteTooltip}" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='${fallbackUrl}';">
            </div>
            <h3 class="pokemon-name-title pokemon-card-name has-tooltip" data-tooltip="${nameTooltip}">${p.name}</h3>
            ${p.nombre_ingles && p.nombre_ingles !== p.name ? `<div class="pokemon-name-sub has-tooltip" data-tooltip="${subNameTooltip}">${p.nombre_ingles}</div>` : ''}
            <div class="pokemon-types-row card-types-row">
              ${typesHtml}
            </div>
          </div>

          <div class="p-stats-grid-6 pokemon-mini-stats">
            <div class="p-stat-cell has-tooltip" data-tooltip="${hpTooltip}">
              <span class="p-stat-lbl">HP</span>
              <span class="p-stat-num">${st.hp || 0}</span>
            </div>
            <div class="p-stat-cell has-tooltip" data-tooltip="${atkTooltip}">
              <span class="p-stat-lbl">ATK</span>
              <span class="p-stat-num">${st.atk || 0}</span>
            </div>
            <div class="p-stat-cell has-tooltip" data-tooltip="${defTooltip}">
              <span class="p-stat-lbl">DEF</span>
              <span class="p-stat-num">${st.def || 0}</span>
            </div>
            <div class="p-stat-cell has-tooltip" data-tooltip="${speTooltip}">
              <span class="p-stat-lbl">VEL</span>
              <span class="p-stat-num">${st.spe || 0}</span>
            </div>
            <div class="p-stat-cell has-tooltip" data-tooltip="${spaTooltip}">
              <span class="p-stat-lbl">ATK ESP</span>
              <span class="p-stat-num">${st.spa || 0}</span>
            </div>
            <div class="p-stat-cell has-tooltip" data-tooltip="${spdTooltip}">
              <span class="p-stat-lbl">DEF ESP</span>
              <span class="p-stat-num">${st.spd || 0}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  static renderPagination() {
    const dock = document.getElementById('pokemonPaginationDock');
    const totalItems = this.filteredPokemon.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / this.pageSize));
    const current = this.currentPage;

    const startIdx = totalItems === 0 ? 0 : (current - 1) * this.pageSize + 1;
    const endIdx = Math.min(current * this.pageSize, totalItems);
    const totalFormatted = totalItems.toLocaleString('es-ES');

    // 1. Sincronizar mini-paginación del panel superior de filtros (Fila 4 - Mockup Imagen 1)
    const miniCurrent = document.getElementById('miniPageCurrent');
    const miniTotal = document.getElementById('miniPageTotal');
    const miniPrev = document.getElementById('miniPagePrevBtn');
    const miniNext = document.getElementById('miniPageNextBtn');
    if (miniCurrent) miniCurrent.textContent = current;
    if (miniTotal) miniTotal.textContent = totalPages;
    if (miniPrev) miniPrev.disabled = current <= 1;
    if (miniNext) miniNext.disabled = current >= totalPages;

    // 2. Renderizar dock de paginación inferior (Mockup Imagen 2 adaptado a la paleta Stadium)
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
          <div class="page-size-select-box has-tooltip" data-tooltip="Cantidad de registros a mostrar por página.">
            <select id="pokemonPageSizeSelect" class="page-size-select" onchange="PokemonModule.onPageSizeChange(this.value)">
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
        <div class="pagination-info-left has-tooltip" data-tooltip="Rango de registros mostrados en la página actual sobre el total del catálogo filtrado.">
          Mostrando <b>${startIdx} - ${endIdx}</b> de <b>${totalFormatted}</b> registros
        </div>
      </div>
      <div class="pagination-controls-right">
        <button class="btn-pagination-action has-tooltip"
                onclick="PokemonModule.goToPage(${current - 1})"
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
                onclick="PokemonModule.goToPage(${current + 1})"
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
    const totalPages = Math.ceil(this.filteredPokemon.length / this.pageSize);
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
    const modal = document.getElementById('pokemonDetailModal');
    const closeBtn = document.getElementById('pokemonModalCloseBtn');

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => this.closeModal());
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal();
      });
    }

    // Cerrar con Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const pModal = document.getElementById('pokemonDetailModal');
        if (pModal && pModal.classList.contains('open')) {
          this.closeModal();
        }
      }
    });
  }

  static closeModal() {
    const modal = document.getElementById('pokemonDetailModal');
    if (modal) modal.classList.remove('open');
  }

  static openPokemonDetailById(pokeId) {
    const found = this.pokemon.find(p => p.id === pokeId || String(p.num) === String(pokeId));
    if (found) {
      // Cerrar modal de movimientos si estaba abierto
      const moveModal = document.getElementById('moveDetailModal');
      if (moveModal) moveModal.classList.remove('open');

      this.openPokemonDetail(found);
    }
  }

  static openPokemonDetail(p) {
    if (window.SFX) window.SFX.playModalOpen();

    const modal = document.getElementById('pokemonDetailModal');
    const headerContent = document.getElementById('modalPokemonHeaderContent');
    const content = document.getElementById('modalPokemonContent');
    if (!modal || !content) return;

    const numFormatted = '#' + String(p.num).padStart(3, '0');
    const st = p.stats || { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50, total: 300 };
    const calcBar = (val) => Math.min(100, Math.round((val / 200) * 100));

    // Tipos
    const typesHtml = (p.types || []).map(t => {
      return typeof AttackSpriteManager !== 'undefined'
        ? AttackSpriteManager.renderTypeBadge(t)
        : `<span class="badge-type type-${t}">${t}</span>`;
    }).join(' ');

    // Resolver la lista de ataques que este Pokémon aprende
    const pokemonMovesList = [];
    if (Array.isArray(p.moves)) {
      p.moves.forEach(mId => {
        const moveObj = this.movesById.get(mId);
        if (moveObj) pokemonMovesList.push(moveObj);
      });
    }

    // Resolver los 4 movimientos predeterminados oficiales
    const defaultMovesList = [];
    if (Array.isArray(p.movimientos_predeterminados)) {
      p.movimientos_predeterminados.forEach(mId => {
        const moveObj = this.movesById.get(mId);
        if (moveObj) defaultMovesList.push(moveObj);
      });
    }

    // Ordenar movimientos por potencia o nombre
    pokemonMovesList.sort((a, b) => (b.potencia || 0) - (a.potencia || 0) || a.nombre.localeCompare(b.nombre));

    // Distintivo de forma especial
    const nameL = (p.name || '').toLowerCase();
    const idL = (p.id || '').toLowerCase();
    const formBadge = this.getFormBadgeInfo(nameL, idL).badgeHtml;

    const spriteUrl = this.getPokemonSpriteUrl(p);
    const fallbackUrl = this.getPokemonSpriteFallback(p);
    const spriteTooltip = `Sprite oficial de ${p.name}: Ilustración gráfica estática de la especie.`;

    const numTooltip = `Pokédex Nacional ${numFormatted}: Identificador oficial del Pokémon en la Pokédex.`;
    const genTooltip = this.getGenTooltip(p.gen);
    const bstTooltip = `BST (${st.total} pts): Base Stat Total. Suma total de las 6 estadísticas base; refleja el poder general del Pokémon.`;
    const hpTooltip = `Puntos de Salud (HP: ${st.hp}): Determina la vitalidad máxima del Pokémon antes de debilitarse en batalla.`;
    const atkTooltip = `Ataque Físico (ATK: ${st.atk}): Potencia el impacto de movimientos de categoría física (contacto directo).`;
    const defTooltip = `Defensa Física (DEF: ${st.def}): Reduce el daño recibido al ser impactado por ataques físicos del oponente.`;
    const speTooltip = `Velocidad (VEL: ${st.spe}): Determina el orden de turno; el Pokémon con mayor velocidad actuará primero.`;
    const spaTooltip = `Ataque Especial (ATK ESP: ${st.spa}): Potencia el daño de ataques de categoría especial (proyectiles y energía).`;
    const spdTooltip = `Defensa Especial (DEF ESP: ${st.spd}): Reduce el impacto del daño recibido por ataques especiales del adversario.`;

    const headerHtml = `
      <div class="pokemon-modal-title-row">
        <span class="pokemon-num-badge has-tooltip" data-tooltip="${numTooltip}">${numFormatted}</span>
        ${formBadge}
        <span class="pokemon-gen-label has-tooltip" data-tooltip="${genTooltip}">GEN ${p.gen}</span>
        <h2 class="pokemon-modal-name has-tooltip" data-tooltip="Especie: ${p.name}">${p.name}</h2>
        ${p.nombre_ingles && p.nombre_ingles.toLowerCase() !== p.name.toLowerCase() ? `<span class="pokemon-modal-subname has-tooltip" data-tooltip="Nombre en inglés: ${p.nombre_ingles}">(${p.nombre_ingles})</span>` : ''}
        <div class="pokemon-modal-header-types">
          ${typesHtml}
        </div>
      </div>
    `;

    if (headerContent) {
      headerContent.innerHTML = headerHtml;
    }

    content.scrollTop = 0;

    content.innerHTML = `
      ${!headerContent ? `<div class="pokemon-modal-header">${headerHtml}</div>` : ''}

      <!-- TIER 1: 2 COLUMNAS SUPERIORES (IZQ: SPRITE Y BIO | DER: ESTADÍSTICAS BASE) -->
      <div class="pokemon-modal-top-grid">

        <!-- COLUMNA 1: SPRITE EN PEDESTAL + ALTURA/PESO + HABILIDADES -->
        <div class="modal-left-card">
          <div class="stage-pedestal has-tooltip" data-tooltip="${spriteTooltip}">
            <img src="${spriteUrl}" alt="${p.name}" class="modal-large-sprite" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='${fallbackUrl}';">
          </div>
          <div class="modal-bio-grid">
            <div class="modal-bio-cell has-tooltip" data-tooltip="Altura registrada de la especie: ${p.heightm ? p.heightm + ' metros' : 'No registrada'}">
              <span class="bio-label">ALTURA</span>
              <span class="bio-value">${p.heightm ? p.heightm + ' m' : '-'}</span>
            </div>
            <div class="modal-bio-cell has-tooltip" data-tooltip="Peso registrado: ${p.weightkg ? p.weightkg + ' kg' : 'No registrado'}">
              <span class="bio-label">PESO</span>
              <span class="bio-value">${p.weightkg ? p.weightkg + ' kg' : '-'}</span>
            </div>
          </div>
          <div class="modal-bio-full has-tooltip" data-tooltip="Habilidades pasivas con efectos especiales en combate">
            <span class="bio-label">HABILIDADES</span>
            <span class="bio-value">${p.abilities && p.abilities.length ? p.abilities.join(', ') : 'Estándar'}</span>
          </div>
        </div>

        <!-- COLUMNA 2: ESTADÍSTICAS BASE CON BARRAS GRUESAS Y AMPLIAS -->
        <div class="modal-stats-card">
          <div class="stats-title-row">
            <span class="stats-card-heading">ESTADÍSTICAS BASE</span>
            <span class="stats-bst-badge has-tooltip" data-tooltip="${bstTooltip}">BST: ${st.total}</span>
          </div>

          <div class="stats-list">
            <div class="stat-row-item has-tooltip" data-tooltip="${hpTooltip}">
              <span class="stat-name">Puntos Salud (HP)</span>
              <span class="stat-number">${st.hp}</span>
              <div class="stat-track"><div class="stat-fill fill-hp" style="width: ${calcBar(st.hp)}%;"></div></div>
            </div>

            <div class="stat-row-item has-tooltip" data-tooltip="${atkTooltip}">
              <span class="stat-name">Ataque Físico</span>
              <span class="stat-number">${st.atk}</span>
              <div class="stat-track"><div class="stat-fill fill-atk" style="width: ${calcBar(st.atk)}%;"></div></div>
            </div>

            <div class="stat-row-item has-tooltip" data-tooltip="${defTooltip}">
              <span class="stat-name">Defensa Física</span>
              <span class="stat-number">${st.def}</span>
              <div class="stat-track"><div class="stat-fill fill-def" style="width: ${calcBar(st.def)}%;"></div></div>
            </div>

            <div class="stat-row-item has-tooltip" data-tooltip="${spaTooltip}">
              <span class="stat-name">At. Especial</span>
              <span class="stat-number">${st.spa}</span>
              <div class="stat-track"><div class="stat-fill fill-spa" style="width: ${calcBar(st.spa)}%;"></div></div>
            </div>

            <div class="stat-row-item has-tooltip" data-tooltip="${spdTooltip}">
              <span class="stat-name">Def. Especial</span>
              <span class="stat-number">${st.spd}</span>
              <div class="stat-track"><div class="stat-fill fill-spd" style="width: ${calcBar(st.spd)}%;"></div></div>
            </div>

            <div class="stat-row-item has-tooltip" data-tooltip="${speTooltip}">
              <span class="stat-name">Velocidad</span>
              <span class="stat-number">${st.spe}</span>
              <div class="stat-track"><div class="stat-fill fill-spe" style="width: ${calcBar(st.spe)}%;"></div></div>
            </div>
          </div>
        </div>

      </div>

      <!-- TIER 2: MOVIMIENTOS PREDETERMINADOS (4 ATAQUES BASE DE COMBATE) -->
      ${defaultMovesList.length > 0 ? `
      <div class="pokemon-modal-default-attacks" style="margin-top: 18px; margin-bottom: 20px;">
        <div class="attacks-header-bar" style="margin-bottom: 10px;">
          <div class="attacks-heading" style="color: #ffd700; font-size: 1.15rem;">
            ⭐ Movimientos Predeterminados (Set de Batalla)
            <span class="attacks-count-pill" style="background: rgba(255, 215, 0, 0.15); border: 1px solid rgba(255, 215, 0, 0.4); color: #ffd700;">${defaultMovesList.length} ATAQUES</span>
          </div>
        </div>
        <div class="default-attacks-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
          ${this.renderDefaultMovesGrid(defaultMovesList)}
        </div>
      </div>
      ` : ''}

      <!-- TIER 3: SECCIÓN COMPLETA DE ATAQUES APRENDIBLES -->
      <div class="pokemon-modal-bottom-attacks">
        <div class="attacks-header-bar">
          <div class="attacks-heading">
            ⚔️ Ataques Aprendibles <span class="attacks-count-pill">(${pokemonMovesList.length})</span>
          </div>
          <div class="attacks-search-box">
            <input type="text" id="modalAttackFilterInput" class="attacks-search-input" placeholder="Filtrar movimientos de ${p.name}...">
          </div>
        </div>

        <div class="attacks-list-scroll" id="modalAttacksList">
          <!-- Renderizado dinámico de movimientos -->
        </div>
      </div>
    `;

    this.renderModalAttacks(pokemonMovesList);

    // Filtro interactivo en tiempo real de ataques
    const attackSearchInput = document.getElementById('modalAttackFilterInput');
    if (attackSearchInput) {
      attackSearchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        const filtered = pokemonMovesList.filter(m => {
          return m.nombre.toLowerCase().includes(q) ||
                 (m.nombre_ingles && m.nombre_ingles.toLowerCase().includes(q)) ||
                 m.tipo.toLowerCase().includes(q) ||
                 m.clase.toLowerCase().includes(q);
        });
        this.renderModalAttacks(filtered);
      });
    }

    modal.classList.add('open');
  }

  static renderDefaultMovesGrid(movesList) {
    if (!Array.isArray(movesList) || movesList.length === 0) return '';
    return movesList.map(m => {
      const potVal = m.potencia !== null ? m.potencia : (m.potencia_texto || '-');
      const accVal = m.precision !== null ? `${m.precision}%` : (m.precision_texto || '-');
      const ppVal = m.pp !== null ? m.pp : (m.pp_texto || '-');

      const typeBadge = typeof AttackSpriteManager !== 'undefined'
        ? AttackSpriteManager.renderTypeBadge(m.tipo, true)
        : `<span class="badge-type type-${m.tipo}">${m.tipo}</span>`;

      const catBadge = typeof AttackSpriteManager !== 'undefined'
        ? AttackSpriteManager.renderCategoryBadge(m.clase, false)
        : `<span class="badge-class class-${m.clase.toLowerCase()}">${m.clase}</span>`;

      return `
        <div class="pokemon-move-item default-move-card" style="border: 1px solid rgba(255, 215, 0, 0.35); background: linear-gradient(135deg, rgba(255, 215, 0, 0.05) 0%, rgba(20, 24, 38, 0.9) 100%); cursor: pointer;" onclick="PokemonModule.onMoveItemClick(${m.id})">
          <div class="move-item-row-top">
            <div class="move-name-wrap">
              <span class="p-move-name" style="color: #ffd700;">★ ${m.nombre}</span>
              <span class="p-move-subname">${m.nombre_ingles}</span>
            </div>
            <div class="move-badges-wrap">
              ${typeBadge}
              ${catBadge}
            </div>
          </div>
          <div class="move-item-row-bottom">
            <div class="p-move-desc">${m.descripcion || 'Sin descripción disponible.'}</div>
            <div class="p-move-stats-wrap">
              <div class="p-move-stat-badge">💥 ${potVal}</div>
              <div class="p-move-stat-badge">🎯 ${accVal}</div>
              <div class="p-move-stat-badge">⚡ ${ppVal}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  static renderModalAttacks(movesList) {
    const container = document.getElementById('modalAttacksList');
    if (!container) return;

    if (movesList.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">
          No se encontraron movimientos con ese filtro.
        </div>
      `;
      return;
    }

    container.innerHTML = movesList.map(m => {
      const potVal = m.potencia !== null ? m.potencia : (m.potencia_texto || '-');
      const accVal = m.precision !== null ? `${m.precision}%` : (m.precision_texto || '-');
      const ppVal = m.pp !== null ? m.pp : (m.pp_texto || '-');

      const claseL = (m.clase || '').toLowerCase();
      let catTooltip = '';
      if (claseL.includes('físico') || claseL.includes('fisico')) {
        catTooltip = 'Ataque Físico: Causa daño calculando el Ataque Físico del usuario contra la Defensa del rival.';
      } else if (claseL.includes('especial')) {
        catTooltip = 'Ataque Especial: Causa daño calculando el At. Especial del usuario contra la Def. Especial del rival.';
      } else {
        catTooltip = 'Movimiento de Estado: No causa daño directo; altera estadísticas, aplica efectos de estado o cambia el campo.';
      }

      const typeTooltip = `Tipo: ${m.tipo} (determina ventajas y resistencias elementales contra otros tipos).`;
      const potTooltip = m.potencia !== null
        ? `Potencia: ${m.potencia} (Fuerza de impacto base del movimiento; a mayor potencia, mayor daño).`
        : 'Potencia: - (Este movimiento no causa daño directo de impacto).';
      const accTooltip = m.precision !== null
        ? `Precisión: ${m.precision}% (Probabilidad de acertar el golpe al objetivo).`
        : 'Precisión: - (Movimiento certero que nunca falla al ejecutarse).';
      const ppTooltip = `Puntos de Poder (PP): ${ppVal} (Cantidad máxima de veces que se puede usar este ataque en combate).`;

      const typeBadge = typeof AttackSpriteManager !== 'undefined'
        ? AttackSpriteManager.renderTypeBadge(m.tipo, true)
        : `<span class="badge-type type-${m.tipo}">${m.tipo}</span>`;

      const catBadge = typeof AttackSpriteManager !== 'undefined'
        ? AttackSpriteManager.renderCategoryBadge(m.clase, false)
        : `<span class="badge-class class-${m.clase.toLowerCase()}">${m.clase}</span>`;

      return `
        <div class="pokemon-move-item" onclick="PokemonModule.onMoveItemClick(${m.id})">
          <div class="move-item-row-top">
            <div class="move-name-wrap">
              <span class="p-move-name">${m.nombre}</span>
              <span class="p-move-subname">${m.nombre_ingles}</span>
            </div>
            <div class="move-badges-wrap">
              <div class="badge-tooltip-container has-tooltip" data-tooltip="${typeTooltip}">
                ${typeBadge}
              </div>
              <div class="badge-tooltip-container has-tooltip" data-tooltip="${catTooltip}">
                ${catBadge}
              </div>
            </div>
          </div>

          <div class="move-item-row-bottom">
            <div class="p-move-desc">${m.descripcion || 'Sin descripción disponible.'}</div>
            <div class="p-move-stats-wrap">
              <div class="p-move-stat-badge has-tooltip" data-tooltip="${potTooltip}">💥 ${potVal}</div>
              <div class="p-move-stat-badge has-tooltip" data-tooltip="${accTooltip}">🎯 ${accVal}</div>
              <div class="p-move-stat-badge has-tooltip" data-tooltip="${ppTooltip}">⚡ ${ppVal}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // NAVEGACIÓN BIDIRECCIONAL: Al hacer clic en un movimiento desde el modal de Pokémon
  static onMoveItemClick(moveId) {
    this.closeModal();
    if (window.StadiumRouter) {
      window.StadiumRouter.navigate('movimientos', { open: moveId });
    } else if (window.MovimientosModule) {
      window.MovimientosModule.openMoveDetailById(moveId);
    }
  }
}

if (typeof window !== 'undefined') {
  window.PokemonModule = PokemonModule;
}
