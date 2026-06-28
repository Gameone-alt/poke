document.addEventListener('DOMContentLoaded', () => {
  // Parse channel and username from URL path: /trainer/:channel/:username
  const pathParts = window.location.pathname.split('/');
  // E.g. pathname: "/trainer/simulator/john" -> ["", "trainer", "simulator", "john"]
  const channel = pathParts[2] || 'simulator';
  const username = pathParts[3];

  if (!username) {
    document.getElementById('pokemon-grid').innerHTML = '<div class="empty-state">Error: No trainer username specified in the URL.</div>';
    return;
  }

  fetch(`/api/trainer/${channel}/${username}`)
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

    // Type classes styling
    const typeBadges = poke.types.map(t => `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`).join(' ');

    // Sprite image URL resolving
    const spriteUrl = getSafeSprite(poke.spriteUrl, poke.fallbackSpriteUrl);

    // Buddy Badge check
    const isBuddy = poke.instanceId === user.buddyInstanceId;
    const buddyTag = isBuddy ? '<div class="buddy-badge">★ BUDDY</div>' : '';

    // Shiny spark indicator
    const shinySpark = poke.shiny ? '<span class="shiny-sparkle">✨</span>' : '';

    card.innerHTML = `
      ${buddyTag}
      <img src="${spriteUrl}" alt="${poke.name}" class="pokemon-sprite">
      <div class="pokemon-name">${shinySpark}${poke.name}</div>
      <div class="pokemon-types">${typeBadges}</div>
      <div class="pokemon-wins">🏆 Wins: ${poke.wins || 0}</div>
    `;

    grid.appendChild(card);
  });
}

function getSafeSprite(spriteUrl, fallbackUrl) {
  if (spriteUrl && spriteUrl !== '/null' && !spriteUrl.endsWith('null') && !spriteUrl.endsWith('undefined')) {
    return spriteUrl;
  }
  if (fallbackUrl && fallbackUrl !== '/null' && !fallbackUrl.endsWith('null') && !fallbackUrl.endsWith('undefined')) {
    return fallbackUrl;
  }
  return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png'; // default fallback icon
}
