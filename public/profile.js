function formatHealingTime(minutesRemaining) {
  if (minutesRemaining <= 0) return 'Ready';
  const totalMinutes = Math.ceil(minutesRemaining);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const mins = totalMinutes % 60;
  
  if (days > 0) {
    return `⏳ Healing: ${days}d ${hours}h left`;
  } else if (hours > 0) {
    return `⏳ Healing: ${hours}h ${mins}m left`;
  } else {
    return `⏳ Healing: ${mins}m left`;
  }
}

let cachedUserData = null;
let globalPokemonList = [];
let activeRegion = 'all';
let activeType = 'all';
let activeSelectedStone = null;

const STONE_COMPATIBILITY = {
  fire_stone: ['vulpix', 'growlithe', 'eevee'],
  water_stone: ['poliwhirl', 'shellder', 'staryu', 'eevee'],
  thunder_stone: ['pikachu', 'magneton', 'eevee'],
  leaf_stone: ['gloom', 'weepinbell', 'eevee'],
  moon_stone: ['nidorino', 'nidorina', 'clefairy', 'jigglypuff'],
  sun_stone: ['gloom', 'sunkern', 'petilil'],
  ice_stone: ['sandshrew', 'vulpix', 'eevee'],
  shiny_stone: ['togetic', 'roselia'],
  dusk_stone: ['murkrow', 'misdreavus'],
  dawn_stone: ['kirlia', 'snorunt']
};

// Filtering and sorting state variables
let searchTerm = '';
let sortBy = 'recent';
let shinyOnly = false;
let legendaryOnly = false;

document.addEventListener('DOMContentLoaded', () => {
  const pathParts = window.location.pathname.split('/');
  const urlParams = new URLSearchParams(window.location.search);
  
  let channel = pathParts[2] || 'simulator';
  let username = pathParts[3];
  
  // Fallback to query params if not using clean /trainer/ path routing
  if (pathParts[1] !== 'trainer' || !username) {
    channel = urlParams.get('channel') || 'simulator';
    username = urlParams.get('username') || urlParams.get('user');
  }

  if (!username) {
    document.getElementById('pokemon-grid').innerHTML = '<div class="empty-state">Error: No trainer username specified in the URL.</div>';
    return;
  }

  const backend = urlParams.get('backend') || '';
  const apiBase = backend.replace(/\/$/, '');

  // Fetch all Pokémon list for Pokédex checklist first
  fetch(`${apiBase}/api/pokemon-list`)
    .then(res => res.json())
    .then(list => {
      globalPokemonList = list.sort((a, b) => a.id - b.id);
      
      // Now fetch trainer profile data
      return fetch(`${apiBase}/api/trainer/${channel}/${username}`);
    })
    .then(res => {
      if (!res.ok) throw new Error('Trainer profile not found.');
      return res.json();
    })
    .then(data => {
      cachedUserData = data;
      renderTrainerProfile(data);
      updateRegionStats(data);
      
      // Start dynamic countdown updates for healing Pokémon
      if (window.healingIntervalId) clearInterval(window.healingIntervalId);
      window.healingIntervalId = setInterval(() => {
        refreshTrainerData(channel, username, apiBase);
      }, 15000);
    })
    .catch(err => {
      console.error(err);
      document.getElementById('pokemon-grid').innerHTML = `<div class="empty-state">❌ Failed loading trainer profile: ${err.message}</div>`;
    });

  // Hook filter and search inputs
  const searchInput = document.getElementById('poke-search');
  const sortSelect = document.getElementById('poke-sort');
  const shinyCheckbox = document.getElementById('poke-shiny-filter');
  const legendaryCheckbox = document.getElementById('poke-legendary-filter');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchTerm = searchInput.value.trim().toLowerCase();
      if (cachedUserData) {
        if (activeRegion === 'all') {
          renderTrainerProfile(cachedUserData);
        } else {
          renderPokedexRegion(cachedUserData, activeRegion);
        }
      }
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      sortBy = sortSelect.value;
      if (cachedUserData && activeRegion === 'all') {
        renderTrainerProfile(cachedUserData);
      }
    });
  }

  if (shinyCheckbox) {
    shinyCheckbox.addEventListener('change', () => {
      shinyOnly = shinyCheckbox.checked;
      if (cachedUserData) {
        if (activeRegion === 'all') {
          renderTrainerProfile(cachedUserData);
        } else {
          renderPokedexRegion(cachedUserData, activeRegion);
        }
      }
    });
  }

  if (legendaryCheckbox) {
    legendaryCheckbox.addEventListener('change', () => {
      legendaryOnly = legendaryCheckbox.checked;
      if (cachedUserData) {
        if (activeRegion === 'all') {
          renderTrainerProfile(cachedUserData);
        } else {
          renderPokedexRegion(cachedUserData, activeRegion);
        }
      }
    });
  }

  // Hook type filter pills
  const typePills = document.querySelectorAll('#type-filter-bar .type-pill');
  typePills.forEach(pill => {
    pill.addEventListener('click', () => {
      typePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeType = pill.getAttribute('data-type') || 'all';
      if (cachedUserData) {
        if (activeRegion === 'all') {
          renderTrainerProfile(cachedUserData);
        } else {
          renderPokedexRegion(cachedUserData, activeRegion);
        }
      }
    });
  });

  // Hook stone pills for inventory filtering/use
  const stonePills = document.querySelectorAll('.stone-pill');
  stonePills.forEach(pill => {
    pill.addEventListener('click', () => {
      const stone = pill.getAttribute('data-stone');
      
      // If already active, toggle off
      if (activeSelectedStone === stone) {
        activeSelectedStone = null;
        pill.style.background = 'transparent';
        pill.style.borderColor = 'transparent';
        pill.style.color = 'var(--text-muted)';
      } else {
        // Toggle all off first
        stonePills.forEach(p => {
          p.style.background = 'transparent';
          p.style.borderColor = 'transparent';
          p.style.color = 'var(--text-muted)';
        });
        
        // Toggle this on
        activeSelectedStone = stone;
        pill.style.background = 'rgba(56, 189, 248, 0.12)';
        pill.style.borderColor = 'rgba(56, 189, 248, 0.3)';
        pill.style.color = '#38bdf8';
      }
      
      if (cachedUserData) {
        renderTrainerProfile(cachedUserData);
      }
    });
  });
});

function renderTrainerProfile(user) {
  // Avatar initial letter
  const avatar = document.getElementById('avatar');
  avatar.textContent = user.displayName ? user.displayName.substring(0, 1).toUpperCase() : 'T';

  // Name
  document.getElementById('trainer-name').textContent = `@${user.displayName || user.username}`;

  // Level Badge & XP bar
  const xpNeeded = user.level * 100;
  const xpPercent = Math.min(100, Math.max(0, (user.xp / xpNeeded) * 100));
  
  document.getElementById('level-badge').textContent = `Trainer Level ${user.level}`;
  document.getElementById('xp-ratio').textContent = `${user.xp} / ${xpNeeded} XP`;
  document.getElementById('xp-fill').style.width = `${xpPercent}%`;

  // Wallet and inventory counter
  document.getElementById('coins-value').textContent = `🪙 ${user.coins}`;
  document.getElementById('caught-value').textContent = user.inventory ? user.inventory.length : 0;

  // Balls Stock
  if (user.balls) {
    document.getElementById('balls-poke').textContent = user.balls.pokeball || 0;
    document.getElementById('balls-great').textContent = user.balls.greatball || 0;
    document.getElementById('balls-ultra').textContent = user.balls.ultraball || 0;
    document.getElementById('balls-master').textContent = user.balls.masterball || 0;
  }

  // Stones Stock
  if (user.items) {
    document.getElementById('stone-fire').textContent = user.items.fire_stone || 0;
    document.getElementById('stone-water').textContent = user.items.water_stone || 0;
    document.getElementById('stone-thunder').textContent = user.items.thunder_stone || 0;
    document.getElementById('stone-leaf').textContent = user.items.leaf_stone || 0;
    document.getElementById('stone-moon').textContent = user.items.moon_stone || 0;
    document.getElementById('stone-sun').textContent = user.items.sun_stone || 0;
    document.getElementById('stone-ice').textContent = user.items.ice_stone || 0;
    document.getElementById('stone-shiny').textContent = user.items.shiny_stone || 0;
    document.getElementById('stone-dusk').textContent = user.items.dusk_stone || 0;
    document.getElementById('stone-dawn').textContent = user.items.dawn_stone || 0;
  }

  // Render Pokemon cards
  const grid = document.getElementById('pokemon-grid');
  grid.innerHTML = '';

  // Apply Search & Filters
  let filtered = [...user.inventory];

  if (activeSelectedStone) {
    const compatiblePokes = STONE_COMPATIBILITY[activeSelectedStone] || [];
    filtered = filtered.filter(p => {
      const origLower = p.originalName ? p.originalName.toLowerCase().trim() : p.name.toLowerCase().replace('✨ shiny ', '').trim();
      return compatiblePokes.includes(origLower);
    });
  }

  if (searchTerm) {
    filtered = filtered.filter(poke => 
      poke.name.toLowerCase().includes(searchTerm) || 
      poke.pokemonId.toString() === searchTerm
    );
  }

  if (shinyOnly) {
    filtered = filtered.filter(poke => poke.shiny);
  }

  if (legendaryOnly) {
    filtered = filtered.filter(poke => poke.isLegendary || (poke.catchRate !== undefined && poke.catchRate <= 0.1));
  }

  if (activeType !== 'all') {
    filtered = filtered.filter(poke => 
      poke.types && poke.types.some(t => t.toLowerCase() === activeType.toLowerCase())
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state">No Pokémon found matching the filters.</div>';
    return;
  }

  // Sort Pokémon: buddy first, then chosen sort field
  const sortedInventory = [...filtered].sort((a, b) => {
    const isBuddyA = a.instanceId === user.buddyInstanceId ? 1 : 0;
    const isBuddyB = b.instanceId === user.buddyInstanceId ? 1 : 0;
    if (isBuddyA !== isBuddyB) return isBuddyB - isBuddyA;

    if (sortBy === 'pokedex') {
      if (a.pokemonId !== b.pokemonId) {
        return (a.pokemonId || 0) - (b.pokemonId || 0);
      }
      return b.caughtAt - a.caughtAt;
    } else if (sortBy === 'cp') {
      const isLegendaryA = a.isLegendary || (a.catchRate !== undefined && a.catchRate <= 0.1);
      const isLegendaryB = b.isLegendary || (b.catchRate !== undefined && b.catchRate <= 0.1);
      return calculateCP(b.baseStats, b.wins, isLegendaryB, b.fusionCount) - calculateCP(a.baseStats, a.wins, isLegendaryA, a.fusionCount);
    } else if (sortBy === 'cp-asc') {
      const isLegendaryA = a.isLegendary || (a.catchRate !== undefined && a.catchRate <= 0.1);
      const isLegendaryB = b.isLegendary || (b.catchRate !== undefined && b.catchRate <= 0.1);
      return calculateCP(a.baseStats, a.wins, isLegendaryA, a.fusionCount) - calculateCP(b.baseStats, b.wins, isLegendaryB, b.fusionCount);
    } else if (sortBy === 'hp') {
      return (b.baseStats.hp || 0) - (a.baseStats.hp || 0);
    } else if (sortBy === 'attack') {
      return (b.baseStats.attack || 0) - (a.baseStats.attack || 0);
    } else if (sortBy === 'defense') {
      return (b.baseStats.defense || 0) - (a.baseStats.defense || 0);
    } else if (sortBy === 'wins') {
      return (b.wins || 0) - (a.wins || 0);
    } else { // default to 'recent'
      return b.caughtAt - a.caughtAt;
    }
  });

  sortedInventory.forEach(poke => {
    const card = document.createElement('div');
    card.className = 'pokemon-card';
    card.dataset.instanceId = poke.instanceId;
    
    // Add legendary glow style if legendary
    const isLegendary = poke.isLegendary || (poke.catchRate !== undefined && poke.catchRate <= 0.1);
    if (isLegendary) {
      card.classList.add('legendary');
    }
    
    // Add shiny class for shiny styling
    if (poke.shiny) {
      card.classList.add('shiny');
    }

    // Type classes styling
    const typeBadges = poke.types.map(t => `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`).join(' ');

    // Sprite image URL resolving
    const spriteUrl = getSafeSprite(poke.spriteUrl, poke.fallbackSpriteUrl, poke.pokemonId, poke.shiny);

    // Buddy Badge check
    const isBuddy = poke.instanceId === user.buddyInstanceId;
    const buddyTag = isBuddy ? '<div class="buddy-badge">★ BUDDY</div>' : '';

        // Shiny spark indicator
    const shinySpark = poke.shiny ? '<span class="shiny-sparkle">✨</span>' : '';

    // Calculate dynamic CP
    const cp = calculateCP(poke.baseStats, poke.wins, isLegendary, poke.fusionCount);

    // Calculate dynamic weight & height matching the overlay stats
    const statsSum = (poke.baseStats.hp || 50) + (poke.baseStats.attack || 50) + (poke.baseStats.defense || 50) + (poke.baseStats.speed || 50);
    const seed = (poke.pokemonId || 1) * 31;
    const mockWeight = ((statsSum * 0.12) + (seed % 15) + 5).toFixed(1);
    const mockHeight = ((statsSum * 0.0028) + (seed % 8) * 0.1 + 0.3).toFixed(2);

    const starSuffix = poke.fusionCount && poke.fusionCount > 0 ? ` <span class="fusion-stars" style="color: #fbbf24; font-weight: bold; margin-left: 2px;">★${poke.fusionCount}</span>` : '';

    let hpBarHtml = '';
    if (user.battleType === 'persistent_hp') {
      const maxHp = poke.baseStats.hp || 50;
      const currentHp = poke.currentHp !== undefined && poke.currentHp !== null ? poke.currentHp : maxHp;
      const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
      
      let hpColor = '#10b981'; // green
      if (hpPct < 30) hpColor = '#ef4444'; // red
      else if (hpPct < 60) hpColor = '#f59e0b'; // amber
      
      let timerText = '';
      if (currentHp < maxHp && poke.lastBattleTime > 0) {
        const elapsedMinutes = (Date.now() - poke.lastBattleTime) / (1000 * 60);
        const minutesRemaining = Math.max(0, 2880 - elapsedMinutes);
        
        if (minutesRemaining > 0) {
          const timeStr = formatHealingTime(minutesRemaining);
          timerText = `<div class="hp-timer" style="font-size: 11px; font-weight: 700; color: #fbbf24; margin-top: 3px; display: flex; align-items: center; justify-content: center; gap: 4px;">${timeStr}</div>`;
        }
      }
      
      hpBarHtml = `
        <div class="hp-bar-section" style="margin: 6px 0 4px 0; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px;">
          <div class="hp-label" style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 2px;">HP: ${currentHp}/${maxHp}</div>
          <div class="hp-bar-outer" style="width: 80%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; margin: 0 auto; overflow: hidden;">
            <div class="hp-fill-bar" style="width: ${hpPct}%; height: 100%; background: ${hpColor}; border-radius: 3px; transition: width 0.3s ease;"></div>
          </div>
          ${timerText}
        </div>
      `;
    }

    card.innerHTML = `
      ${buddyTag}
      <div class="pokemon-cp">CP ${cp}</div>
      <img src="${spriteUrl}" alt="${poke.name}" class="pokemon-sprite">
      <div class="pokemon-name">${shinySpark}${poke.name}${starSuffix}</div>
      <div class="pokemon-types">${typeBadges}</div>
      <div class="pokemon-dimensions" style="font-size: 11px; color: var(--text-muted); margin: 5px 0 8px 0; font-weight: 600;">${mockWeight}kg / ${mockHeight}m</div>
      <div class="pokemon-stats-block">
        <div class="stat-row"><span>HP:</span> <strong>${poke.baseStats.hp}</strong></div>
        <div class="stat-row"><span>ATK:</span> <strong>${poke.baseStats.attack}</strong></div>
        <div class="stat-row"><span>DEF:</span> <strong>${poke.baseStats.defense}</strong></div>
        <div class="stat-row"><span>SPD:</span> <strong>${poke.baseStats.speed || 50}</strong></div>
      </div>
      <div class="pokemon-wins">🏆 Wins: ${poke.wins || 0}</div>
      ${hpBarHtml}
    `;

    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      showEvolutionTree(poke.pokemonId);
    });

    grid.appendChild(card);
  });
}

function getSafeSprite(spriteUrl, fallbackUrl, pokemonId, isShiny) {
  if (spriteUrl && spriteUrl !== '/null' && !spriteUrl.endsWith('null') && !spriteUrl.endsWith('undefined')) {
    return spriteUrl;
  }
  if (fallbackUrl && fallbackUrl !== '/null' && !fallbackUrl.endsWith('null') && !fallbackUrl.endsWith('undefined')) {
    return fallbackUrl;
  }
  if (pokemonId) {
    if (isShiny) {
      return `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/shiny/${pokemonId}.png`;
    }
    return `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/${pokemonId}.png`;
  }
  return 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/0.png'; // default fallback icon
}

function calculateCP(baseStats, wins, isLegendary, fusionCount = 0) {
  const hp = baseStats ? (baseStats.hp || 50) : 50;
  const attack = baseStats ? (baseStats.attack || 50) : 50;
  const defense = baseStats ? (baseStats.defense || 50) : 50;
  const speed = baseStats ? (baseStats.speed || 50) : 50;
  
  let baseCP = (hp + attack * 1.5 + defense + speed) * 3.5;
  if (isLegendary) {
    baseCP *= 1.8;
  }
  let finalCP = baseCP * (1 + (wins || 0) * 0.02 + (fusionCount || 0) * 0.05);
  return Math.max(10, Math.floor(finalCP));
}

// Evolution Modal controllers
const modalEl = document.getElementById('evolution-modal');
const treeContentEl = document.getElementById('evolution-tree-content');

function closeEvolutionModal() {
  if (modalEl) modalEl.classList.add('hidden');
}

async function showEvolutionTree(pokemonId) {
  if (!modalEl || !treeContentEl) return;
  
  // Show modal with loading state
  treeContentEl.innerHTML = '<div class="loading-spinner">Loading evolution family tree...</div>';
  modalEl.classList.remove('hidden');
  
  try {
    const response = await fetch(`/api/evolution/${pokemonId}`);
    if (!response.ok) throw new Error('Evolution data not available');
    const treeData = await response.json();
    
    // Generate and render the tree
    treeContentEl.innerHTML = `
      <div class="evolution-tree-container">
        ${generateTreeHTML(treeData, pokemonId)}
      </div>
    `;
  } catch (err) {
    treeContentEl.innerHTML = `<div style="color: #ef4444; padding: 20px;">❌ Error: ${err.message}</div>`;
  }
}

function generateTreeHTML(node, activePokemonId) {
  const isActive = node.id === activePokemonId;
  const activeClass = isActive ? 'active-node' : '';
  const spriteUrl = getSafeSprite(node.spriteUrl, null, node.id, false);
  const typeBadges = node.types.map(t => `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`).join(' ');

  let html = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 15px; flex-wrap: wrap;">
      <div class="evo-node ${activeClass}">
        <img src="${spriteUrl}" alt="${node.name}">
        <div class="evo-node-name">${node.name}</div>
        <div class="evo-node-types">${typeBadges}</div>
      </div>
  `;

  if (node.evolutions && node.evolutions.length > 0) {
    const childrenHTML = node.evolutions.map(child => {
      return `
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="evo-connector">
            <div class="evo-method-badge">${child.method}</div>
            <div class="evo-arrow">➔</div>
          </div>
          ${generateTreeHTML(child, activePokemonId)}
        </div>
      `;
    }).join('');

    html += `
      <div style="display: flex; flex-direction: column; gap: 15px; align-items: flex-start; border-left: 1px dashed rgba(255,255,255,0.15); padding-left: 15px; margin-left: 5px;">
        ${childrenHTML}
      </div>
    `;
  }

  html += `</div>`;
  return html;
}

/**
 * Calculates how many unique Pokémon have been caught in each region and updates stats row labels.
 */
function updateRegionStats(user) {
  if (!user || !user.inventory) return;

  const caughtIds = new Set(user.inventory.map(p => p.pokemonId));
  const regions = {
    kanto: { min: 1, max: 151, total: 151 },
    johto: { min: 152, max: 251, total: 100 },
    hoenn: { min: 252, max: 386, total: 135 },
    sinnoh: { min: 387, max: 493, total: 107 },
    unova: { min: 494, max: 649, total: 156 },
    kalos: { min: 650, max: 721, total: 72 },
    alola: { min: 722, max: 809, total: 88 },
    'galar-paldea': { min: 810, max: 1025, total: 216 }
  };

  Object.keys(regions).forEach(reg => {
    const config = regions[reg];
    let caughtCount = 0;

    for (let id = config.min; id <= config.max; id++) {
      if (caughtIds.has(id)) {
        caughtCount++;
      }
    }

    const el = document.getElementById(`stats-${reg}`);
    if (el) {
      el.textContent = `${caughtCount}/${config.total}`;
    }
  });
}

/**
 * Tab/Pill click handler to toggle between main Collection view and regional Pokédex checklist views.
 */
window.selectRegion = function(region) {
  activeRegion = region;

  const pills = document.querySelectorAll('.region-pill');
  pills.forEach(pill => pill.classList.remove('active'));

  const activePill = document.getElementById(`pill-${region}`);
  if (activePill) {
    activePill.classList.add('active');
  }

  if (cachedUserData) {
    if (region === 'all') {
      renderTrainerProfile(cachedUserData);
    } else {
      renderPokedexRegion(cachedUserData, region);
    }
  }
};

/**
 * Renders the regional checklist. Caught entries show full artwork/names, locked entries hide them behind question marks.
 */
function renderPokedexRegion(user, region) {
  const grid = document.getElementById('pokemon-grid');
  grid.innerHTML = '';

  const regions = {
    kanto: { min: 1, max: 151 },
    johto: { min: 152, max: 251 },
    hoenn: { min: 252, max: 386 },
    sinnoh: { min: 387, max: 493 },
    unova: { min: 494, max: 649 },
    kalos: { min: 650, max: 721 },
    alola: { min: 722, max: 809 },
    'galar-paldea': { min: 810, max: 1025 }
  };

  const config = regions[region];
  if (!config) return;

  const caughtMap = new Map();
  if (user.inventory) {
    user.inventory.forEach(poke => {
      const id = poke.pokemonId;
      if (id >= config.min && id <= config.max) {
        const existing = caughtMap.get(id);
        if (!existing || (poke.shiny && !existing.shiny) || (poke.wins > existing.wins)) {
          caughtMap.set(id, poke);
        }
      }
    });
  }

  let regionPokes = globalPokemonList.filter(p => p.id >= config.min && p.id <= config.max);

  // Apply search/filters to the Pokédex checklist
  if (searchTerm) {
    regionPokes = regionPokes.filter(p => 
      p.name.toLowerCase().includes(searchTerm) || 
      p.id.toString() === searchTerm
    );
  }

  if (shinyOnly) {
    regionPokes = regionPokes.filter(p => {
      const poke = caughtMap.get(p.id);
      return poke && poke.shiny;
    });
  }

  if (legendaryOnly) {
    regionPokes = regionPokes.filter(p => {
      const poke = caughtMap.get(p.id);
      return (poke && poke.isLegendary) || (p.catchRate !== undefined && p.catchRate <= 0.1);
    });
  }

  if (activeType !== 'all') {
    regionPokes = regionPokes.filter(p => 
      p.types && p.types.some(t => t.toLowerCase() === activeType.toLowerCase())
    );
  }

  if (regionPokes.length === 0) {
    grid.innerHTML = '<div class="empty-state">No Pokémon found matching the filters.</div>';
    return;
  }

  regionPokes.forEach(staticPoke => {
    const card = document.createElement('div');
    const poke = caughtMap.get(staticPoke.id);

    if (poke) {
      card.className = 'pokemon-card';
      const isLegendary = poke.isLegendary || (poke.catchRate !== undefined && poke.catchRate <= 0.1);
      if (isLegendary) card.classList.add('legendary');
      if (poke.shiny) card.classList.add('shiny');

      const typeBadges = poke.types.map(t => `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`).join(' ');
      const spriteUrl = getSafeSprite(poke.spriteUrl, poke.fallbackSpriteUrl, poke.pokemonId, poke.shiny);
      const shinySpark = poke.shiny ? '<span class="shiny-sparkle">✨</span>' : '';

      card.innerHTML = `
        <div class="pokemon-cp" style="font-size: 11px; color: var(--text-muted); top: 12px; left: 14px; position: absolute; font-weight: 700;">#${staticPoke.id}</div>
        <img src="${spriteUrl}" alt="${poke.name}" class="pokemon-sprite" style="margin-top: 10px;">
        <div class="pokemon-name" style="margin-top: 5px;">${shinySpark}${poke.name}</div>
        <div class="pokemon-types" style="justify-content: center; margin-bottom: 5px;">${typeBadges}</div>
        <div style="font-size: 11px; color: #10b981; font-weight: 700; display: flex; align-items: center; gap: 4px; justify-content: center; margin-bottom: 5px;">✅ Caught</div>
      `;

      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        showEvolutionTree(poke.pokemonId);
      });
    } else {
      card.className = 'pokemon-card locked';
      card.innerHTML = `
        <div class="pokemon-cp" style="font-size: 11px; color: var(--text-muted); top: 12px; left: 14px; position: absolute; font-weight: 700;">#${staticPoke.id}</div>
        <div class="locked-sprite-placeholder" style="margin-top: 10px;">🔒</div>
        <div class="pokemon-name" style="color: var(--text-muted); font-style: italic; margin-top: 5px;">????</div>
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 500; text-align: center; margin-bottom: 5px;">Missing</div>
      `;
    }

    grid.appendChild(card);
  });
}

function refreshTrainerData(channel, username, apiBase) {
  fetch(`${apiBase}/api/trainer/${channel}/${username}`)
    .then(res => {
      if (res.ok) return res.json();
    })
    .then(data => {
      if (!data) return;
      
      const oldLen = cachedUserData && cachedUserData.inventory ? cachedUserData.inventory.length : 0;
      const newLen = data.inventory ? data.inventory.length : 0;
      
      cachedUserData = data;
      
      if (oldLen !== newLen) {
        if (activeRegion === 'all') {
          renderTrainerProfile(data);
        } else {
          renderPokedexRegion(data, activeRegion);
        }
        updateRegionStats(data);
        return;
      }
      
      const xpNeeded = data.level * 100;
      const xpPercent = Math.min(100, Math.max(0, (data.xp / xpNeeded) * 100));
      
      const lvlBadge = document.getElementById('level-badge');
      if (lvlBadge) lvlBadge.textContent = `Trainer Level ${data.level}`;
      
      const xpRatio = document.getElementById('xp-ratio');
      if (xpRatio) xpRatio.textContent = `${data.xp} / ${xpNeeded} XP`;
      
      const xpFill = document.getElementById('xp-fill');
      if (xpFill) xpFill.style.width = `${xpPercent}%`;
      
      const coinsVal = document.getElementById('coins-value');
      if (coinsVal) coinsVal.textContent = `🪙 ${data.coins}`;
      
      const caughtVal = document.getElementById('caught-value');
      if (caughtVal) caughtVal.textContent = newLen;
      
      if (data.balls) {
        const bp = document.getElementById('balls-poke');
        if (bp) bp.textContent = data.balls.pokeball || 0;
        const bg = document.getElementById('balls-great');
        if (bg) bg.textContent = data.balls.greatball || 0;
        const bu = document.getElementById('balls-ultra');
        if (bu) bu.textContent = data.balls.ultraball || 0;
        const bm = document.getElementById('balls-master');
        if (bm) bm.textContent = data.balls.masterball || 0;
      }
      
      if (data.items) {
        const sf = document.getElementById('stone-fire');
        if (sf) sf.textContent = data.items.fire_stone || 0;
        const sw = document.getElementById('stone-water');
        if (sw) sw.textContent = data.items.water_stone || 0;
        const st = document.getElementById('stone-thunder');
        if (st) st.textContent = data.items.thunder_stone || 0;
        const sl = document.getElementById('stone-leaf');
        if (sl) sl.textContent = data.items.leaf_stone || 0;
        const sm = document.getElementById('stone-moon');
        if (sm) sm.textContent = data.items.moon_stone || 0;
        const s_sun = document.getElementById('stone-sun');
        if (s_sun) s_sun.textContent = data.items.sun_stone || 0;
        const s_ice = document.getElementById('stone-ice');
        if (s_ice) s_ice.textContent = data.items.ice_stone || 0;
        const s_shiny = document.getElementById('stone-shiny');
        if (s_shiny) s_shiny.textContent = data.items.shiny_stone || 0;
        const s_dusk = document.getElementById('stone-dusk');
        if (s_dusk) s_dusk.textContent = data.items.dusk_stone || 0;
        const s_dawn = document.getElementById('stone-dawn');
        if (s_dawn) s_dawn.textContent = data.items.dawn_stone || 0;
      }
      
      document.querySelectorAll('.pokemon-card').forEach(card => {
        const instanceId = card.dataset.instanceId;
        if (!instanceId) return;
        const poke = data.inventory.find(p => p.instanceId === instanceId);
        if (!poke) return;
        
        const winsEl = card.querySelector('.pokemon-wins');
        if (winsEl) winsEl.textContent = `🏆 Wins: ${poke.wins || 0}`;
        
        const isLegendary = poke.isLegendary || (poke.catchRate !== undefined && poke.catchRate <= 0.1);
        const cpVal = calculateCP(poke.baseStats, poke.wins, isLegendary, poke.fusionCount);
        const cpEl = card.querySelector('.pokemon-cp');
        if (cpEl) cpEl.textContent = `CP ${cpVal}`;
        
        const maxHp = poke.baseStats.hp || 50;
        const currentHp = poke.currentHp !== undefined && poke.currentHp !== null ? poke.currentHp : maxHp;
        const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
        
        const hpLabel = card.querySelector('.hp-label');
        if (hpLabel) hpLabel.textContent = `HP: ${currentHp}/${maxHp}`;
        
        const hpFillBar = card.querySelector('.hp-fill-bar');
        if (hpFillBar) {
          hpFillBar.style.width = `${hpPct}%`;
          let hpColor = '#10b981';
          if (hpPct < 30) hpColor = '#ef4444';
          else if (hpPct < 60) hpColor = '#f59e0b';
          hpFillBar.style.backgroundColor = hpColor;
        }
        
        const hpTimer = card.querySelector('.hp-timer');
        if (currentHp < maxHp && poke.lastBattleTime > 0) {
          const elapsedMinutes = (Date.now() - poke.lastBattleTime) / (1000 * 60);
          const minutesRemaining = Math.max(0, 2880 - elapsedMinutes);
          
          if (minutesRemaining > 0) {
            const timeStr = formatHealingTime(minutesRemaining);
            if (hpTimer) {
              hpTimer.innerHTML = timeStr;
            } else {
              const hpSection = card.querySelector('.hp-bar-section');
              if (hpSection) {
                const timerDiv = document.createElement('div');
                timerDiv.className = 'hp-timer';
                timerDiv.style.cssText = 'font-size: 11px; font-weight: 700; color: #fbbf24; margin-top: 3px; display: flex; align-items: center; justify-content: center; gap: 4px;';
                timerDiv.innerHTML = timeStr;
                hpSection.appendChild(timerDiv);
              }
            }
          } else {
            if (hpTimer) hpTimer.remove();
          }
        } else {
          if (hpTimer) hpTimer.remove();
        }
      });
    })
    .catch(err => console.error('Error refreshing trainer profile:', err));
}
