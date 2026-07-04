let cachedUserData = null;
let globalPokemonList = [];
let activeRegion = 'all';
let activeType = 'all';
let adminPassword = '';

// Filtering and sorting state variables
let searchTerm = '';
let sortBy = 'recent';
let shinyOnly = false;
let legendaryOnly = false;

// Parse channel and username from clean path routing /admin/:channel/:username
const pathParts = window.location.pathname.split('/');
const urlParams = new URLSearchParams(window.location.search);

let channel = pathParts[2] || 'simulator';
let username = pathParts[3];

if (pathParts[1] !== 'admin' || !username) {
  channel = urlParams.get('channel') || 'simulator';
  username = urlParams.get('username') || urlParams.get('user');
}

if (!username) {
  alert('Error: No trainer username specified in the URL.');
}

const backendParam = urlParams.get('backend');
const DEFAULT_RENDER_BACKEND = 'https://pokemon-overlay-backend-hfpf.onrender.com';
const apiBase = backendParam ? backendParam.replace(/\/$/, '') : (window.location.origin.includes('localhost') ? '' : DEFAULT_RENDER_BACKEND);

// Connect socket.io
const socket = io(apiBase, {
  query: { channelId: channel }
});

// Setup DOM elements
document.addEventListener('DOMContentLoaded', () => {
  // Eagerly load trainer data on page load (doesn't need socket)
  setTimeout(() => { if (!cachedUserData) loadTrainerData(); }, 500);

  const securityOverlay = document.getElementById('security-overlay');
  const adminPassInput = document.getElementById('admin-pass-input');
  const btnSubmitPass = document.getElementById('btn-submit-pass');
  const passFeedback = document.getElementById('pass-feedback');
  
  const pokemonSearch = document.getElementById('pokemon-search');
  const autocompleteList = document.getElementById('autocomplete-list');
  const shinyToggle = document.getElementById('shiny-toggle');
  const btnGrantPokemon = document.getElementById('btn-grant-pokemon');
  const grantFeedback = document.getElementById('grant-feedback');
  
  const inputCoins = document.getElementById('input-coins');
  const inputLevel = document.getElementById('input-level');
  const inputXp = document.getElementById('input-xp');
  const inputPokeballs = document.getElementById('input-pokeballs');
  const btnUpdateTrainer = document.getElementById('btn-update-trainer');
  const updateFeedback = document.getElementById('update-feedback');

  let selectedPokemonId = null;

  // Sockets password flow
  socket.on('connect', () => {
    console.log('[Sockets] Connected to channel:', channel);
    // Always load trainer data on connect so the page shows the player's collection
    loadTrainerData();
  });

  socket.on('password_status', (data) => {
    const { hasPassword } = data;
    if (!hasPassword) {
      passFeedback.textContent = '❌ Admin password has not been created by streamer yet!';
      securityOverlay.classList.remove('hidden');
    } else {
      const cachedPass = localStorage.getItem('admin_password_' + channel);
      if (cachedPass) {
        socket.emit('verify_password', { password: cachedPass });
      } else {
        securityOverlay.classList.remove('hidden');
      }
    }
  });

  btnSubmitPass.addEventListener('click', () => {
    const password = adminPassInput.value.trim();
    if (!password) {
      passFeedback.textContent = 'Password cannot be empty!';
      return;
    }
    passFeedback.textContent = '';
    socket.emit('verify_password', { password });
  });

  adminPassInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnSubmitPass.click();
  });

  socket.on('password_verified', (data) => {
    const { success, message } = data;
    if (success) {
      adminPassword = adminPassInput.value.trim() || localStorage.getItem('admin_password_' + channel);
      localStorage.setItem('admin_password_' + channel, adminPassword);
      securityOverlay.classList.add('hidden');
      passFeedback.textContent = '';
      adminPassInput.value = '';
      
      // Load data
      loadTrainerData();
    } else {
      passFeedback.textContent = message || 'Invalid admin credentials!';
      localStorage.removeItem('admin_password_' + channel);
      securityOverlay.classList.remove('hidden');
    }
  });

  // Handle command feedback alerts
  socket.on('command_feedback', (data) => {
    const text = data.text || '';
    if (text.includes('Success') || text.includes('✅') || text.includes('Granted')) {
      showFeedback(grantFeedback, text, 'success');
      showFeedback(updateFeedback, text, 'success');
      loadTrainerData();
    } else if (text.includes('Failed') || text.includes('❌')) {
      showFeedback(grantFeedback, text, 'error');
      showFeedback(updateFeedback, text, 'error');
    }
  });

  socket.on('pokemon_deleted_ack', (data) => {
    const { success, error } = data;
    if (success) {
      alert('Pokémon deleted successfully!');
      loadTrainerData();
    } else {
      alert(`Failed to delete Pokémon: ${error}`);
    }
  });

  socket.on('player_updated', (data) => {
    if (data && data.username && data.username.toLowerCase() === username.toLowerCase()) {
      loadTrainerData();
    }
  });

  // Load Trainer Data & Pokémon List
  async function loadTrainerData() {
    try {
      // Load static Pokemon List if not loaded
      if (globalPokemonList.length === 0) {
        const listRes = await fetch(`${apiBase}/api/pokemon-list`);
        const list = await listRes.json();
        globalPokemonList = list.sort((a, b) => a.id - b.id);
      }

      // Fetch trainer profile
      const trainerRes = await fetch(`${apiBase}/api/trainer/${channel}/${username}`);
      if (!trainerRes.ok) throw new Error('Trainer profile not found.');
      const data = await trainerRes.json();
      
      cachedUserData = data;
      renderTrainerProfile(data);
      updateRegionStats(data);
      populateFormFields(data);
    } catch (err) {
      console.error(err);
      document.getElementById('pokemon-grid').innerHTML = `<div class="empty-state">❌ Failed loading trainer profile: ${err.message}</div>`;
    }
  }

  function populateFormFields(user) {
    inputCoins.value = user.coins || 0;
    inputLevel.value = user.level || 1;
    inputXp.value = user.xp || 0;
    inputPokeballs.value = user.balls ? (user.balls.pokeball || 0) : 0;
  }

  // Grant Pokemon logic
  btnGrantPokemon.addEventListener('click', () => {
    if (!selectedPokemonId) {
      showFeedback(grantFeedback, '❌ Please select a Pokémon from search suggestions.', 'error');
      return;
    }
    const isShiny = shinyToggle.checked;
    
    socket.emit('give_pokemon', {
      password: adminPassword,
      targetUsername: username.toLowerCase().trim(),
      targetDisplayName: cachedUserData ? cachedUserData.displayName : username,
      pokemonId: selectedPokemonId.toString(),
      isShiny: isShiny
    });
    
    // Clear input
    pokemonSearch.value = '';
    selectedPokemonId = null;
    shinyToggle.checked = false;
  });

  // Update trainer statistics
  btnUpdateTrainer.addEventListener('click', () => {
    const coins = parseInt(inputCoins.value, 10);
    const level = parseInt(inputLevel.value, 10);
    const xp = parseInt(inputXp.value, 10);
    const pokeballs = parseInt(inputPokeballs.value, 10);

    if (isNaN(coins) || isNaN(level) || isNaN(xp) || isNaN(pokeballs)) {
      showFeedback(updateFeedback, '❌ All stats fields must be valid numbers!', 'error');
      return;
    }

    socket.emit('admin_update_player', {
      password: adminPassword,
      playerUsername: username.toLowerCase().trim(),
      updatedFields: {
        coins: coins,
        level: level,
        xp: xp,
        balls: {
          pokeball: pokeballs
        }
      }
    });
  });

  // Autocomplete Pokémon search logic
  pokemonSearch.addEventListener('input', () => {
    const val = pokemonSearch.value.trim().toLowerCase();
    autocompleteList.innerHTML = '';
    selectedPokemonId = null;

    if (!val) {
      autocompleteList.style.display = 'none';
      return;
    }

    const filtered = globalPokemonList.filter(p => 
      p.name.toLowerCase().includes(val) || p.id.toString() === val
    ).slice(0, 8);

    if (filtered.length === 0) {
      autocompleteList.style.display = 'none';
      return;
    }

    filtered.forEach(p => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`;
      item.innerHTML = `
        <img src="${spriteUrl}" alt="${p.name}">
        <span><strong>#${p.id}</strong> ${p.name}</span>
      `;
      item.addEventListener('click', () => {
        pokemonSearch.value = p.name;
        selectedPokemonId = p.id;
        autocompleteList.style.display = 'none';
      });
      autocompleteList.appendChild(item);
    });

    autocompleteList.style.display = 'block';
  });

  // Hide suggestion list when clicking outside
  document.addEventListener('click', (e) => {
    if (e.target !== pokemonSearch && e.target !== autocompleteList) {
      autocompleteList.style.display = 'none';
    }
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
        renderTrainerProfile(cachedUserData);
      }
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      sortBy = sortSelect.value;
      if (cachedUserData) {
        renderTrainerProfile(cachedUserData);
      }
    });
  }

  if (shinyCheckbox) {
    shinyCheckbox.addEventListener('change', () => {
      shinyOnly = shinyCheckbox.checked;
      if (cachedUserData) {
        renderTrainerProfile(cachedUserData);
      }
    });
  }
  if (legendaryCheckbox) {
    legendaryCheckbox.addEventListener('change', () => {
      legendaryOnly = legendaryCheckbox.checked;
      if (cachedUserData) {
        renderTrainerProfile(cachedUserData);
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
        renderTrainerProfile(cachedUserData);
      }
    });
  });
});

// Render UI functions
function renderTrainerProfile(user) {
  const avatar = document.getElementById('avatar');
  avatar.textContent = user.displayName ? user.displayName.substring(0, 1).toUpperCase() : 'T';

  document.getElementById('trainer-name').textContent = `@${user.displayName || user.username} (Admin)`;

  const xpNeeded = user.level * 100;
  const xpPercent = Math.min(100, Math.max(0, (user.xp / xpNeeded) * 100));
  
  document.getElementById('level-badge').textContent = `Trainer Level ${user.level}`;
  document.getElementById('xp-ratio').textContent = `${user.xp} / ${xpNeeded} XP`;
  document.getElementById('xp-fill').style.width = `${xpPercent}%`;

  document.getElementById('coins-value').textContent = `🪙 ${user.coins}`;
  document.getElementById('caught-value').textContent = user.inventory ? user.inventory.length : 0;

  const grid = document.getElementById('pokemon-grid');
  grid.innerHTML = '';

  // Apply Region, Search, and Filters
  let filtered = [...user.inventory];

  // 1. Filter by Region
  if (activeRegion !== 'all') {
    filtered = filtered.filter(poke => {
      const pokeId = parseInt(poke.pokemonId, 10);
      return getPokemonRegion(pokeId) === activeRegion;
    });
  }

  // 2. Filter by Search Term
  if (searchTerm) {
    filtered = filtered.filter(poke => 
      poke.name.toLowerCase().includes(searchTerm) || 
      poke.pokemonId.toString() === searchTerm
    );
  }

  // 3. Filter by Shiny
  if (shinyOnly) {
    filtered = filtered.filter(poke => poke.shiny);
  }

  // 4. Filter by Legendary
  if (legendaryOnly) {
    filtered = filtered.filter(poke => poke.isLegendary || (poke.catchRate !== undefined && poke.catchRate <= 0.1));
  }

  // 5. Filter by Type
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

    if (sortBy === 'cp') {
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
    
    const isLegendary = poke.isLegendary || (poke.catchRate !== undefined && poke.catchRate <= 0.1);
    if (isLegendary) card.classList.add('legendary');
    if (poke.shiny) card.classList.add('shiny');

    const typeBadges = poke.types.map(t => `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`).join(' ');
    const spriteUrl = getSafeSprite(poke.spriteUrl, poke.fallbackSpriteUrl, poke.pokemonId, poke.shiny);
    
    const isBuddy = poke.instanceId === user.buddyInstanceId;
    const buddyTag = isBuddy ? '<div class="buddy-badge">★ BUDDY</div>' : '';
    const shinySpark = poke.shiny ? '<span class="shiny-sparkle">✨</span>' : '';
    const cp = calculateCP(poke.baseStats, poke.wins, isLegendary, poke.fusionCount);

    const starSuffix = poke.fusionCount && poke.fusionCount > 0 ? ` <span class="fusion-stars" style="color: #fbbf24; font-weight: bold;">★${poke.fusionCount}</span>` : '';

    card.innerHTML = `
      ${buddyTag}
      <div class="pokemon-cp">CP ${cp}</div>
      <img src="${spriteUrl}" alt="${poke.name}" class="pokemon-sprite">
      <div class="pokemon-name">${shinySpark}${poke.name}${starSuffix}</div>
      <div class="pokemon-types">${typeBadges}</div>
      <div class="pokemon-stats-block">
        <div class="stat-row"><span>HP:</span> <strong>${poke.baseStats.hp}</strong></div>
        <div class="stat-row"><span>ATK:</span> <strong>${poke.baseStats.attack}</strong></div>
        <div class="stat-row"><span>DEF:</span> <strong>${poke.baseStats.defense}</strong></div>
      </div>
      <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">🏆 Wins: ${poke.wins || 0}</div>
      <button class="btn-delete-poke" data-id="${poke.instanceId}">
        <span>❌</span> Delete Pokémon
      </button>
    `;

    // Hook delete button click
    const delBtn = card.querySelector('.btn-delete-poke');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const instanceId = delBtn.getAttribute('data-id');
      if (confirm(`Are you sure you want to permanently delete this ${poke.name} (CP ${cp})?`)) {
        socket.emit('admin_delete_pokemon', {
          password: adminPassword,
          playerUsername: username.toLowerCase().trim(),
          instanceId: instanceId
        });
      }
    });

    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      showEvolutionTree(poke.pokemonId);
    });

    grid.appendChild(card);
  });
}

function selectRegion(region) {
  activeRegion = region;
  
  // Highlight active pill
  const pills = document.querySelectorAll('.region-pill');
  pills.forEach(p => p.classList.remove('active'));
  
  const activePill = document.getElementById(`pill-${region}`);
  if (activePill) activePill.classList.add('active');
  
  if (cachedUserData) {
    renderTrainerProfile(cachedUserData);
  }
}

function updateRegionStats(user) {
  if (!user.inventory) return;
  
  // Initialize region counts
  const counts = {
    all: user.inventory.length,
    kanto: 0,
    johto: 0,
    hoenn: 0,
    sinnoh: 0,
    unova: 0,
    kalos: 0,
    alola: 0,
    'galar-paldea': 0
  };

  user.inventory.forEach(poke => {
    const pokeId = parseInt(poke.pokemonId, 10);
    const reg = getPokemonRegion(pokeId);
    if (counts[reg] !== undefined) counts[reg]++;
  });

  // Render stats
  document.getElementById('stats-all').textContent = `${counts.all} Cards`;
  document.getElementById('stats-kanto').textContent = `${counts.kanto}/151`;
  document.getElementById('stats-johto').textContent = `${counts.johto}/100`;
  document.getElementById('stats-hoenn').textContent = `${counts.hoenn}/135`;
  document.getElementById('stats-sinnoh').textContent = `${counts.sinnoh}/107`;
  document.getElementById('stats-unova').textContent = `${counts.unova}/156`;
  document.getElementById('stats-kalos').textContent = `${counts.kalos}/72`;
  document.getElementById('stats-alola').textContent = `${counts.alola}/88`;
  document.getElementById('stats-galar-paldea').textContent = `${counts['galar-paldea'] || 0}/216`;
}

function getPokemonRegion(id) {
  if (id >= 1 && id <= 151) return 'kanto';
  if (id >= 152 && id <= 251) return 'johto';
  if (id >= 252 && id <= 386) return 'hoenn';
  if (id >= 387 && id <= 493) return 'sinnoh';
  if (id >= 494 && id <= 649) return 'unova';
  if (id >= 650 && id <= 721) return 'kalos';
  if (id >= 722 && id <= 809) return 'alola';
  if (id >= 810 && id <= 1025) return 'galar-paldea';
  return 'unknown';
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
  return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png';
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

function showFeedback(el, text, type) {
  el.textContent = text;
  el.className = type === 'success' ? 'feedback-success' : 'feedback-error';
  setTimeout(() => {
    el.textContent = '';
  }, 5000);
}

// Evolution Modal controllers for Admin
const modalEl = document.getElementById('evolution-modal');
const treeContentEl = document.getElementById('evolution-tree-content');

function closeEvolutionModal() {
  if (modalEl) modalEl.classList.add('hidden');
}
window.closeEvolutionModal = closeEvolutionModal;

async function showEvolutionTree(pokemonId) {
  if (!modalEl || !treeContentEl) return;
  
  // Show modal with loading state
  treeContentEl.innerHTML = '<div class="loading-spinner">Loading evolution family tree...</div>';
  modalEl.classList.remove('hidden');
  
  try {
    const response = await fetch(`${apiBase}/api/evolution/${pokemonId}`);
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
window.showEvolutionTree = showEvolutionTree;

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
