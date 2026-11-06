// ====================================================================
// MÓDULO: GESTOR DE SPRITES DE ATAQUES Y VISUALES - POKÉMON STADIUM WORLD
// ====================================================================
class AttackSpriteManager {
  static CDN_BASE = '/assets/gba';

  // Mapeo oficial de tipos a sus archivos GIF descargados en sprites/tipos/
  static TYPE_FILES = {
    'Acero': 'Tipo_acero.gif',
    'Agua': 'Tipo_agua.gif',
    'Bicho': 'Tipo_bicho.gif',
    'Dragón': 'Tipo_dragón.gif',
    'Eléctrico': 'Tipo_eléctrico.gif',
    'Fantasma': 'Tipo_fantasma.gif',
    'Fuego': 'Tipo_fuego.gif',
    'Hada': 'Tipo_hada.gif',
    'Hielo': 'Tipo_hielo.gif',
    'Lucha': 'Tipo_lucha.gif',
    'Normal': 'Tipo_normal.gif',
    'Planta': 'Tipo_planta.gif',
    'Psíquico': 'Tipo_psíquico.gif',
    'Roca': 'Tipo_roca.gif',
    'Siniestro': 'Tipo_siniestro.gif',
    'Tierra': 'Tipo_tierra.gif',
    'Veneno': 'Tipo_veneno.gif',
    'Volador': 'Tipo_volador.gif',
    'Estelar': 'Tipo_normal.gif',
    '???': 'Tipo_???.gif'
  };

  static TYPE_MAP = {
    'Normal': { en: 'Normal', color: '#A8A878', gradient: 'linear-gradient(135deg, #A8A878, #8a8a5c)' },
    'Fuego': { en: 'Fire', color: '#F08030', gradient: 'linear-gradient(135deg, #F08030, #c45b14)' },
    'Agua': { en: 'Water', color: '#6890F0', gradient: 'linear-gradient(135deg, #6890F0, #3864c7)' },
    'Planta': { en: 'Grass', color: '#78C850', gradient: 'linear-gradient(135deg, #78C850, #4e9e26)' },
    'Eléctrico': { en: 'Electric', color: '#F8D030', gradient: 'linear-gradient(135deg, #F8D030, #cba214)' },
    'Hielo': { en: 'Ice', color: '#98D8D8', gradient: 'linear-gradient(135deg, #98D8D8, #60afaf)' },
    'Lucha': { en: 'Fighting', color: '#C03028', gradient: 'linear-gradient(135deg, #C03028, #8a1a14)' },
    'Veneno': { en: 'Poison', color: '#A040A0', gradient: 'linear-gradient(135deg, #A040A0, #6f236f)' },
    'Tierra': { en: 'Ground', color: '#E0C068', gradient: 'linear-gradient(135deg, #E0C068, #b89842)' },
    'Volador': { en: 'Flying', color: '#A890F0', gradient: 'linear-gradient(135deg, #A890F0, #7a5ec9)' },
    'Psíquico': { en: 'Psychic', color: '#F85888', gradient: 'linear-gradient(135deg, #F85888, #d02e5e)' },
    'Bicho': { en: 'Bug', color: '#A8B820', gradient: 'linear-gradient(135deg, #A8B820, #79850f)' },
    'Roca': { en: 'Rock', color: '#B8A038', gradient: 'linear-gradient(135deg, #B8A038, #8b7620)' },
    'Fantasma': { en: 'Ghost', color: '#705898', gradient: 'linear-gradient(135deg, #705898, #4e3875)' },
    'Dragón': { en: 'Dragon', color: '#7038F8', gradient: 'linear-gradient(135deg, #7038F8, #4917cc)' },
    'Siniestro': { en: 'Dark', color: '#705848', gradient: 'linear-gradient(135deg, #705848, #4a3427)' },
    'Acero': { en: 'Steel', color: '#B8B8D0', gradient: 'linear-gradient(135deg, #B8B8D0, #8888a6)' },
    'Hada': { en: 'Fairy', color: '#EE99AC', gradient: 'linear-gradient(135deg, #EE99AC, #c86379)' },
    'Estelar': { en: 'Stellar', color: '#45C8B8', gradient: 'linear-gradient(135deg, #45C8B8, #189889)' }
  };

  static CATEGORY_MAP = {
    'Físico': { en: 'Physical', color: '#E53E3E', icon: '💥' },
    'Especial': { en: 'Special', color: '#3182CE', icon: '✨' },
    'Estado': { en: 'Status', color: '#718096', icon: '🛡️' }
  };

  static getTypeBadgeUrl(typeName) {
    if (!typeName) return 'sprites/tipos/Tipo_normal.gif';
    const clean = typeName.trim();
    if (this.TYPE_FILES[clean]) {
      return `sprites/tipos/${this.TYPE_FILES[clean]}`;
    }

    const unaccent = clean.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const [k, v] of Object.entries(this.TYPE_FILES)) {
      if (k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === unaccent) {
        return `sprites/tipos/${v}`;
      }
    }
    return `sprites/tipos/Tipo_${clean.toLowerCase()}.gif`;
  }

  static getTypeIconUrl(typeName) {
    return this.getTypeBadgeUrl(typeName);
  }

  static CATEGORY_FILES = {
    'Físico': 'Physical.png',
    'Especial': 'Special.png',
    'Estado': 'Status.png',
    'Physical': 'Physical.png',
    'Special': 'Special.png',
    'Status': 'Status.png'
  };

  static getCategoryIconUrl(categoryName) {
    if (this.CATEGORY_FILES[categoryName]) {
      return `sprites/tipos/${this.CATEGORY_FILES[categoryName]}`;
    }
    const clean = (categoryName || '').trim().toLowerCase();
    if (clean.includes('fís') || clean.includes('fis') || clean.includes('phys')) {
      return 'sprites/tipos/Physical.png';
    }
    if (clean.includes('esp') || clean.includes('spec')) {
      return 'sprites/tipos/Special.png';
    }
    if (clean.includes('est') || clean.includes('stat')) {
      return 'sprites/tipos/Status.png';
    }
    return 'sprites/tipos/Physical.png';
  }

  static TYPE_DESCRIPTIONS = {
    'Normal': 'Tipo Normal: Movimientos neutros sin ventajas sobre otros tipos. No causan daño a Pokémon de tipo Fantasma.',
    'Fuego': 'Tipo Fuego: Ataques ardientes letales contra Planta, Hielo, Bicho y Acero. Débiles contra Agua, Roca y Dragón.',
    'Agua': 'Tipo Agua: Movimientos acuáticos demoledores contra Fuego, Tierra y Roca. Débiles contra Planta y Eléctrico.',
    'Planta': 'Tipo Planta: Ataques naturales súper efectivos contra Agua, Tierra y Roca. Resistidos por Fuego, Veneno, Volador, Bicho y Dragón.',
    'Eléctrico': 'Tipo Eléctrico: Descargas de alta potencia súper efectivas contra Agua y Volador. Inmunes los Pokémon de tipo Tierra.',
    'Hielo': 'Tipo Hielo: Ráfagas congelantes demoledoras contra Dragón, Volador, Planta y Tierra. Débiles ante Fuego, Lucha, Roca y Acero.',
    'Lucha': 'Tipo Lucha: Golpes de combate cuerpo a cuerpo demoledores contra Normal, Hielo, Roca, Siniestro y Acero. Inmunes los Fantasmas.',
    'Veneno': 'Tipo Veneno: Toxinas y sustancias corrosivas muy eficaces contra Planta y Hada. Los Pokémon de tipo Acero son inmunes.',
    'Tierra': 'Tipo Tierra: Sacudidas telúricas demoledoras contra Fuego, Eléctrico, Veneno, Roca y Acero. Inmunes los Pokémon Voladores.',
    'Volador': 'Tipo Volador: Ataques aéreos y ráfagas de viento muy eficaces contra Planta, Lucha y Bicho. Débiles ante Eléctrico, Hielo y Roca.',
    'Psíquico': 'Tipo Psíquico: Poder mental y telequinesis devastadores contra Lucha y Veneno. No afectan a Pokémon de tipo Siniestro.',
    'Bicho': 'Tipo Bicho: Picaduras y ataques de insectos muy eficaces contra Planta, Psíquico y Siniestro.',
    'Roca': 'Tipo Roca: Impactos de rocas y proyectiles pétreos súper efectivos contra Fuego, Hielo, Volador y Bicho.',
    'Fantasma': 'Tipo Fantasma: Energías espirituales y del más allá muy eficaces contra Psíquico y otros Fantasmas. Inmunes los Pokémon Normales.',
    'Dragón': 'Tipo Dragón: El poder mítico de los dragones, muy eficaz contra otros Dragones. Los Pokémon de tipo Hada son inmunes.',
    'Siniestro': 'Tipo Siniestro: Ataques oscuros y emboscadas muy eficaces contra Psíquico y Fantasma. Débiles ante Lucha, Bicho y Hada.',
    'Acero': 'Tipo Acero: Golpes metálicos pesados con la mayor resistencia defensiva; muy eficaces contra Hielo, Roca y Hada.',
    'Hada': 'Tipo Hada: Energía mágica y luminosa demoledora contra Lucha, Dragón y Siniestro. Inmunes a los ataques de tipo Dragón.',
    'Estelar': 'Tipo Estelar: Tipo especial de Teracristalización que potencia ataques de todos los tipos elementales.'
  };

  static CATEGORY_DESCRIPTIONS = {
    'Físico': 'Ataque Físico: El daño se calcula enfrentando el Ataque Físico del usuario contra la Defensa Física del rival. La mayoría hacen contacto directo.',
    'Especial': 'Ataque Especial: El daño se calcula enfrentando el Ataque Especial del usuario contra la Defensa Especial del rival. Son ráfagas de energía, rayos y proyectiles.',
    'Estado': 'Movimiento de Estado: No causa daño directo de salud. Aplica efectos de estado (parálisis, sueño, veneno), altera estadísticas (subir ataque, bajar defensa) o modifica el clima/campo.'
  };

  static renderTypeBadge(typeName, showIcon = true, options = {}) {
    const badgeUrl = this.getTypeBadgeUrl(typeName);
    const className = (options && options.className) ? options.className : 'filter-type-badge-img';
    const alt = typeName || 'Tipo';
    const fallbackUrl = `/assets/gba/battle_interface/type_badges/${typeName.toLowerCase()}.png`;
    const tooltipText = (options && options.tooltip !== undefined)
      ? options.tooltip
      : (this.TYPE_DESCRIPTIONS[typeName] || `Tipo ${typeName}: Determina las ventajas y desventajas elementales de daño.`);

    return `<img src="${badgeUrl}" alt="${alt}" class="${className}" loading="lazy" decoding="async" ${tooltipText ? `data-tooltip="${tooltipText}"` : ''} onerror="this.onerror=null; this.src='${fallbackUrl}';">`;
  }

  static renderCategoryBadge(categoryName, showText = false, options = {}) {
    const cleanCat = (categoryName || '').trim();
    const info = this.CATEGORY_MAP[cleanCat] || { en: 'Other', color: '#888', icon: '⚡' };
    const iconUrl = this.getCategoryIconUrl(cleanCat);
    const fallbackUrl = `${this.CDN_BASE}/categories/${info.en}.png`;
    const tooltipText = (options && options.tooltip) || this.CATEGORY_DESCRIPTIONS[cleanCat] || `Categoría ${cleanCat}: Determina cómo se calcula el impacto del movimiento.`;

    if (!showText) {
      return `
        <span class="category-badge-pill category-badge-icon-only category-${(info.en || 'other').toLowerCase()}" data-tooltip="${tooltipText}">
          <img src="${iconUrl}" alt="${cleanCat}" class="category-icon-mini" onerror="this.onerror=null; this.src='${fallbackUrl}';">
        </span>
      `;
    }

    return `
      <span class="category-badge-pill category-${(info.en || 'other').toLowerCase()}" data-tooltip="${tooltipText}">
        <img src="${iconUrl}" alt="${cleanCat}" class="category-icon-mini" onerror="this.onerror=null; this.src='${fallbackUrl}';">
        <span>${cleanCat}</span>
      </span>
    `;
  }

  static getAttackFxConfig(move) {
    const typeInfo = this.TYPE_MAP[move.tipo] || { color: '#ffcc00' };
    const isPhysical = move.clase === 'Físico';
    const isSpecial = move.clase === 'Especial';

    return {
      particleColor: typeInfo.color,
      animClass: isPhysical ? 'fx-physical-lunge' : (isSpecial ? 'fx-special-beam' : 'fx-status-aura'),
      screenShake: (move.potencia && move.potencia >= 90) ? 'strong' : (move.potencia ? 'light' : 'none'),
      soundPreset: isPhysical ? 'punch' : (isSpecial ? 'energy' : 'buff')
    };
  }
}

if (typeof window !== 'undefined') {
  window.AttackSpriteManager = AttackSpriteManager;
}
