// Parse streamer channel query from URL or redirect to landing page
const urlParams = new URLSearchParams(window.location.search);
const channelId = urlParams.get('channel');

if (!channelId) {
  window.location.href = 'index.html';
}

// If deployed on Vercel, replace this string with your hosted Render URL
const BACKEND_URL = window.location.origin.includes('localhost') ? '' : 'https://pokemon-overlay-backend-hfpf.onrender.com';
const socket = io(BACKEND_URL, {
  query: { channelId }
});

let adminPassword = '';

// Security Lock DOM Elements
const securityOverlay = document.getElementById('security-overlay');
const securityTitle = document.getElementById('security-title');
const securityDesc = document.getElementById('security-desc');
const adminPassInput = document.getElementById('admin-pass-input');
const btnSubmitPass = document.getElementById('btn-submit-pass');
const passFeedback = document.getElementById('pass-feedback');

let isSettingPassword = false;

// Listen to password status on connection
socket.on('password_status', (data) => {
  const { hasPassword } = data;
  
  if (!hasPassword) {
    isSettingPassword = true;
    securityTitle.textContent = '🔒 Create Admin Password';
    securityDesc.textContent = 'This is a public dashboard. Please create a secret password to prevent others from modifying your settings.';
    btnSubmitPass.textContent = 'Create Password';
    securityOverlay.classList.remove('hidden');
  } else {
    isSettingPassword = false;
    const cachedPass = localStorage.getItem('admin_password_' + channelId);
    if (cachedPass) {
      socket.emit('verify_password', { password: cachedPass });
    } else {
      securityTitle.textContent = '🔒 Admin Authentication Required';
      securityDesc.textContent = 'Please enter your secret password to unlock streamer settings and controls.';
      btnSubmitPass.textContent = 'Unlock Dashboard';
      securityOverlay.classList.remove('hidden');
    }
  }
});

// Submit password button action
btnSubmitPass.addEventListener('click', () => {
  const password = adminPassInput.value.trim();
  if (!password) {
    passFeedback.textContent = 'Password cannot be empty!';
    return;
  }
  
  passFeedback.textContent = '';
  if (isSettingPassword) {
    socket.emit('set_password', { password });
  } else {
    socket.emit('verify_password', { password });
  }
});

adminPassInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    btnSubmitPass.click();
  }
});

// Verify/Set reply from server
socket.on('password_verified', (data) => {
  const { success, config, message } = data;
  
  if (success) {
    adminPassword = adminPassInput.value.trim() || localStorage.getItem('admin_password_' + channelId);
    localStorage.setItem('admin_password_' + channelId, adminPassword);
    
    if (config) {
      channelIdInput.value = config.channelId || '';
      videoIdInput.value = config.videoId || '';
      spawnIntervalInput.value = Math.round(config.spawnIntervalMs / 1000);
      despawnTimeoutInput.value = Math.round(config.wildDespawnTimeoutMs / 1000);
      catchCooldownInput.value = Math.round(config.catchCooldownMs / 1000);
      shinyChanceInput.value = config.shinyChance * 100;
    }
    
    securityOverlay.classList.add('hidden');
    passFeedback.textContent = '';
    adminPassInput.value = '';
  } else {
    passFeedback.textContent = message || 'Invalid credentials!';
    localStorage.removeItem('admin_password_' + channelId);
    securityOverlay.classList.remove('hidden');
  }
});

// DOM elements
const channelIdInput = document.getElementById('channel-id');
const videoIdInput = document.getElementById('video-id');
const spawnIntervalInput = document.getElementById('spawn-interval');
const despawnTimeoutInput = document.getElementById('despawn-timeout');
const catchCooldownInput = document.getElementById('catch-cooldown');
const shinyChanceInput = document.getElementById('shiny-chance');
const configForm = document.getElementById('config-form');

const btnForceSpawn = document.getElementById('btn-force-spawn');
const btnResetDb = document.getElementById('btn-reset-db');
const btnLogout = document.getElementById('btn-logout');

const simUserSelect = document.getElementById('sim-user');
const newUserInput = document.getElementById('new-user-input');
const btnAddUser = document.getElementById('btn-add-user');
const simChatMessage = document.getElementById('sim-chat-message');
const btnSendSim = document.getElementById('btn-send-sim');
const simChatFeed = document.getElementById('sim-chat-feed');

const activeWildDetails = document.getElementById('active-wild-details');
const activeCombatDetails = document.getElementById('active-combat-details');
const leaderboardBody = document.getElementById('leaderboard-body');
const serverStatus = document.getElementById('server-status');

// Keep track of custom users
const customUsers = {};

// Handle Connect/Disconnect UI
socket.on('connect', () => {
  serverStatus.textContent = 'Connected to Server';
  document.querySelector('.status-indicator').className = 'status-indicator online';
});

socket.on('disconnect', () => {
  serverStatus.textContent = 'Disconnected';
  document.querySelector('.status-indicator').className = 'status-indicator';
});

// Load Config from server
socket.on('config_updated', (config) => {
  channelIdInput.value = config.channelId || '';
  videoIdInput.value = config.videoId || '';
  spawnIntervalInput.value = Math.round(config.spawnIntervalMs / 1000);
  despawnTimeoutInput.value = Math.round(config.wildDespawnTimeoutMs / 1000);
  catchCooldownInput.value = Math.round(config.catchCooldownMs / 1000);
  shinyChanceInput.value = config.shinyChance * 100;
});

// Initial state sync
socket.on('init_state', (state) => {
  updateWildPokemonUI(state.activeWildPokemon);
  updateBattleUI(state.activeBattle);
  updateLeaderboardUI(state.leaderboard);
});

// Update Config Form Submission
configForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const videoIdRaw = videoIdInput.value.trim();
  let videoId = videoIdRaw;
  // Parse video ID from URL if user pastes link
  if (videoIdRaw.includes('v=')) {
    videoId = videoIdRaw.split('v=')[1].split('&')[0];
  } else if (videoIdRaw.includes('youtu.be/')) {
    videoId = videoIdRaw.split('youtu.be/')[1].split('?')[0];
  }

  const updatedConfig = {
    channelId: channelIdInput.value.trim(),
    videoId: videoId,
    spawnIntervalMs: parseInt(spawnIntervalInput.value) * 1000,
    wildDespawnTimeoutMs: parseInt(despawnTimeoutInput.value) * 1000,
    catchCooldownMs: parseInt(catchCooldownInput.value) * 1000,
    shinyChance: parseFloat(shinyChanceInput.value) / 100
  };
  
  socket.emit('update_config', { newConfig: updatedConfig, password: adminPassword });
  alert('Configuration updated successfully!');
});

// Button triggers
btnForceSpawn.addEventListener('click', () => {
  socket.emit('force_spawn', { password: adminPassword });
});

btnResetDb.addEventListener('click', () => {
  if (confirm('Are you sure you want to reset all player stats, inventories, and scores? This cannot be undone.')) {
    socket.emit('reset_db', { password: adminPassword });
  }
});

btnLogout.addEventListener('click', () => {
  localStorage.removeItem('admin_password_' + channelId);
  window.location.href = 'index.html';
});

// Simulator custom user creation
btnAddUser.addEventListener('click', () => {
  const name = newUserInput.value.trim();
  if (!name) return;
  
  // Format slug for username
  const username = name.toLowerCase().replace(/[^a-z0-9_]/g, '');
  
  if (customUsers[username]) {
    alert('User already exists!');
    return;
  }
  
  // Add to select list
  const opt = document.createElement('option');
  opt.value = username;
  opt.textContent = name;
  simUserSelect.appendChild(opt);
  simUserSelect.value = username;
  
  customUsers[username] = name;
  newUserInput.value = '';
});

// Send Chat Simulator
function sendChatMessage(text) {
  const username = simUserSelect.value;
  const displayName = simUserSelect.options[simUserSelect.selectedIndex].text;
  
  if (!text) return;
  
  // Append user message locally in simulator log
  appendSimChat(displayName, text);
  
  // Send message event to server
  socket.emit('simulate_chat', {
    username,
    displayName,
    messageText: text
  });
}

btnSendSim.addEventListener('click', () => {
  const text = simChatMessage.value.trim();
  sendChatMessage(text);
  simChatMessage.value = '';
});

simChatMessage.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const text = simChatMessage.value.trim();
    sendChatMessage(text);
    simChatMessage.value = '';
  }
});

// Wire preset command buttons
document.querySelectorAll('.btn-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    const cmd = btn.getAttribute('data-cmd');
    sendChatMessage(cmd);
  });
});

// Append messages to simulator log
function appendSimChat(author, text, isSystem = false) {
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  
  if (isSystem) {
    bubble.innerHTML = `<span class="system-reply">🤖 Bot: ${text}</span>`;
  } else {
    bubble.innerHTML = `<span class="author">${author}:</span> ${text}`;
  }
  
  simChatFeed.appendChild(bubble);
  simChatFeed.scrollTop = simChatFeed.scrollHeight;
}

// Listen to command feedback (whispers / errors)
socket.on('command_feedback', (data) => {
  const activeUser = simUserSelect.value;
  // Print bot reply if it targets the currently selected simulator user
  if (data.username === activeUser) {
    appendSimChat('System', data.text, true);
  }
});

// Listen to wild Pokémon spawns
socket.on('pokemon_spawned', (poke) => {
  updateWildPokemonUI(poke);
});

socket.on('pokemon_despawned', () => {
  updateWildPokemonUI(null);
});

socket.on('catch_success', (data) => {
  updateWildPokemonUI(null);
  appendSimChat('System', `🎉 @${data.displayName} caught the wild ${data.isShiny ? '✨ Shiny ' : ''}${data.pokemonName} with a ${data.ballType}!`, true);
});

socket.on('catch_fail', (data) => {
  appendSimChat('System', `💨 @${data.displayName}'s ${data.ballType} broke. The wild ${data.pokemonName} escaped!`, true);
});

// Game state UI helpers
function updateWildPokemonUI(poke) {
  if (!poke) {
    activeWildDetails.innerHTML = '<span class="muted">No Pokémon currently spawned.</span>';
    return;
  }
  
  const typeBadges = poke.types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join(' ');
  
  activeWildDetails.innerHTML = `
    <img src="${poke.spriteUrl || poke.fallbackSpriteUrl}" alt="${poke.name}" onerror="this.src='${poke.fallbackSpriteUrl}'">
    <div class="active-wild-info">
      <span class="active-wild-name">${poke.isShiny ? '✨ ' : ''}${poke.name}</span>
      <div class="pokemon-types">${typeBadges}</div>
      <span class="muted" style="font-size:12px;">Base Catch Rate: ${Math.round(poke.catchRate * 100)}%</span>
    </div>
  `;
}

// Listen to Battles
socket.on('battle_start', (data) => {
  activeCombatDetails.innerHTML = `
    <div class="battle-block-visual">
      <div class="battle-fighter-mini">
        <img src="${data.challengerSprite}" alt="Challenger" onerror="this.src='${data.challengerFallback}'">
        <span>@${data.challenger}</span>
      </div>
      <span class="battle-vs-mini">VS</span>
      <div class="battle-fighter-mini">
        <img src="${data.opponentSprite}" alt="Opponent" onerror="this.src='${data.opponentFallback}'">
        <span>${data.opponent === 'Wild' ? 'Wild' : '@' + data.opponent}</span>
      </div>
    </div>
  `;
});

socket.on('battle_end', () => {
  activeCombatDetails.innerHTML = '<span class="muted">Battle ended. Awaiting next challenge...</span>';
  setTimeout(() => {
    activeCombatDetails.innerHTML = '<span class="muted">No battle currently in progress.</span>';
  }, 3000);
});

function updateBattleUI(battle) {
  if (!battle) {
    activeCombatDetails.innerHTML = '<span class="muted">No battle currently in progress.</span>';
    return;
  }
  
  activeCombatDetails.innerHTML = `
    <div class="battle-block-visual">
      <div class="battle-fighter-mini">
        <span>@${battle.challenger.displayName}</span>
        <span>(${battle.challengerPoke.name})</span>
      </div>
      <span class="battle-vs-mini">VS</span>
      <div class="battle-fighter-mini">
        <span>@${battle.opponent.displayName}</span>
        <span>(${battle.opponentPoke.name})</span>
      </div>
    </div>
  `;
}

// Listen and redraw leaderboard updates
socket.on('leaderboard_update', (leaderboard) => {
  updateLeaderboardUI(leaderboard);
});

function updateLeaderboardUI(leaderboard) {
  if (!leaderboard || leaderboard.length === 0) {
    leaderboardBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center muted">No players registered. Sim a catch to start!</td>
      </tr>
    `;
    return;
  }
  
  leaderboardBody.innerHTML = '';
  
  leaderboard.forEach(row => {
    const activePokeName = row.activePokemon ? `${row.activePokemon.name} (Lvl ${row.activePokemon.currentStage})` : 'None';
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>@${row.displayName}</strong></td>
      <td>${row.totalPokemon} Pokémon</td>
      <td>${row.totalWins} wins</td>
      <td>${activePokeName}</td>
    `;
    leaderboardBody.appendChild(tr);
  });
}
