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
  fetch(`${apiBase}/api/trainer/${channel}/${username}`)
    .then(res => {
      if (!res.ok) throw new Error('Trainer profile not found.');
      return res.json();
    })
    .then(data => {
      renderTrainerProfile(data);
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

    card.innerHTML = `
      ${buddyTag}
      <div class="pokemon-cp">CP ${cp}</div>
      <img src="${spriteUrl}" alt="${poke.name}" class="pokemon-sprite">
      <div class="pokemon-name">${shinySpark}${poke.name}</div>
      <div class="pokemon-types">${typeBadges}</div>
      <div class="pokemon-dimensions" style="font-size: 11px; color: var(--text-muted); margin: 5px 0 8px 0; font-weight: 600;">${mockWeight}kg / ${mockHeight}m</div>
      <div class="pokemon-stats-block">
        <div class="stat-row"><span>HP:</span> <strong>${poke.baseStats.hp}</strong></div>
        <div class="stat-row"><span>ATK:</span> <strong>${poke.baseStats.attack}</strong></div>
        <div class="stat-row"><span>DEF:</span> <strong>${poke.baseStats.defense}</strong></div>
      </div>
      <div class="pokemon-wins">🏆 Wins: ${poke.wins || 0}</div>
    `;

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
