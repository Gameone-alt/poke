let cachedUserData = null;
let globalPokemonList = [];
let activeRegion = 'all';

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
    })
    .catch(err => {
      console.error(err);
      document.getElementById('pokemon-grid').innerHTML = `<div class="empty-state">❌ Failed loading trainer profile: ${err.message}</div>`;
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
  }

  // Render Pokemon cards
  const grid = document.getElementById('pokemon-grid');
  grid.innerHTML = '';

  if (!user.inventory || user.inventory.length === 0) {
    grid.innerHTML = '<div class="empty-state">No Pokémon in collection yet. Go catch some spawns!</div>';
    return;
  }

  // Sort Pokémon: buddy first, then shiny first, then highest stage, then wins, then caught date
  const sortedInventory = [...user.inventory].sort((a, b) => {
    const isBuddyA = a.instanceId === user.buddyInstanceId ? 1 : 0;
    const isBuddyB = b.instanceId === user.buddyInstanceId ? 1 : 0;
    if (isBuddyA !== isBuddyB) return isBuddyB - isBuddyA;
    
    if (a.shiny !== b.shiny) return b.shiny - a.shiny;
    if (a.wins !== b.wins) return b.wins - a.wins;
    return b.caughtAt - a.caughtAt;
  });

  sortedInventory.forEach(poke => {
    const card = document.createElement('div');
    card.className = 'pokemon-card';
    
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
    const cp = calculateCP(poke.baseStats, poke.wins, isLegendary);

    // Calculate dynamic weight & height matching the overlay stats
    const statsSum = (poke.baseStats.hp || 50) + (poke.baseStats.attack || 50) + (poke.baseStats.defense || 50) + (poke.baseStats.speed || 50);
    const seed = (poke.pokemonId || 1) * 31;
    const mockWeight = ((statsSum * 0.12) + (seed % 15) + 5).toFixed(1);
    const mockHeight = ((statsSum * 0.0028) + (seed % 8) * 0.1 + 0.3).toFixed(2);

    const starSuffix = poke.fusionCount && poke.fusionCount > 0 ? ` <span class="fusion-stars" style="color: #fbbf24; font-weight: bold; margin-left: 2px;">★${poke.fusionCount}</span>` : '';

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
      </div>
      <div class="pokemon-wins">🏆 Wins: ${poke.wins || 0}</div>
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
      return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${pokemonId}.png`;
    }
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
  }
  return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png'; // default fallback icon
}

function calculateCP(baseStats, wins, isLegendary) {
  const hp = baseStats ? (baseStats.hp || 50) : 50;
  const attack = baseStats ? (baseStats.attack || 50) : 50;
  const defense = baseStats ? (baseStats.defense || 50) : 50;
  const speed = baseStats ? (baseStats.speed || 50) : 50;
  
  let baseCP = (hp + attack * 1.5 + defense + speed) * 3.5;
  if (isLegendary) {
    baseCP *= 1.8;
  }
  let finalCP = baseCP * (1 + (wins || 0) * 0.02);
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

  const regionPokes = globalPokemonList.filter(p => p.id >= config.min && p.id <= config.max);

  if (regionPokes.length === 0) {
    grid.innerHTML = '<div class="empty-state">No Pokémon data loaded. Please reload the page.</div>';
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
