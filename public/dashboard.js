// Parse streamer channel query from URL or redirect to landing page
const urlParams = new URLSearchParams(window.location.search);
const channelId = urlParams.get('channel');

if (!channelId) {
  window.location.href = 'index.html';
}

// Backend URL: empty on localhost (same-origin Express), Render URL in production
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
      populateConfig(config);
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
const twitchChannelInput = document.getElementById('twitch-channel');
const videoIdInput = document.getElementById('video-id');
const obsWebsocketUrlInput = document.getElementById('obs-websocket-url');
const youtubeApiKeyInput = document.getElementById('youtube-api-key');
const spawnIntervalInput = document.getElementById('spawn-interval');
const despawnTimeoutInput = document.getElementById('despawn-timeout');
const catchCooldownInput = document.getElementById('catch-cooldown');
const shinyChanceInput = document.getElementById('shiny-chance');
const configForm = document.getElementById('config-form');

// UI Customization DOM elements
const themeSelect = document.getElementById('theme');
const primaryColorInput = document.getElementById('primary-color');
const primaryColorTextInput = document.getElementById('primary-color-text');
const sfxVolumeInput = document.getElementById('sfx-volume');
const showBattleArenaInput = document.getElementById('show-battle-arena');
const showLiveFeedInput = document.getElementById('show-live-feed');
const liveFeedTitleInput = document.getElementById('live-feed-title');
const showSpawnAlertInput = document.getElementById('show-spawn-alert');
const spawnAlertTitleInput = document.getElementById('spawn-alert-title');
const spawnCatchGuideInput = document.getElementById('spawn-catch-guide');
const customCssInput = document.getElementById('custom-css');

// Spawn Card Specific Elements
const spawnCardScaleInput = document.getElementById('spawn-card-scale');
const spawnCardPositionSelect = document.getElementById('spawn-card-position');
const showCardSpriteCheckbox = document.getElementById('show-card-sprite');
const showCardTypesCheckbox = document.getElementById('show-card-types');
const showCardInstructionsCheckbox = document.getElementById('show-card-instructions');

// Specific Spawn Target
const spawnTargetInput = document.getElementById('spawn-target');
const btnSaveTarget = document.getElementById('btn-save-target');

// Sync color inputs
if (primaryColorInput && primaryColorTextInput) {
  primaryColorInput.addEventListener('input', () => {
    primaryColorTextInput.value = primaryColorInput.value;
  });
  primaryColorTextInput.addEventListener('input', () => {
    const val = primaryColorTextInput.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      primaryColorInput.value = val;
    }
  });
}

function populateConfig(config) {
  channelIdInput.value = config.youtubeChannelId || '';
  twitchChannelInput.value = config.twitchChannel || '';
  videoIdInput.value = config.videoId || '';
  obsWebsocketUrlInput.value = config.obsWebsocketUrl || '';
  youtubeApiKeyInput.value = config.youtubeApiKey || '';
  spawnIntervalInput.value = Math.round(config.spawnIntervalMs / 1000);
  despawnTimeoutInput.value = Math.round(config.wildDespawnTimeoutMs / 1000);
  catchCooldownInput.value = Math.round(config.catchCooldownMs / 1000);
  shinyChanceInput.value = config.shinyChance * 100;
  
  // Customization fields
  themeSelect.value = config.theme || 'modern';
  primaryColorInput.value = config.primaryColor || '#3b82f6';
  primaryColorTextInput.value = config.primaryColor || '#3b82f6';
  sfxVolumeInput.value = config.sfxVolume !== undefined ? config.sfxVolume : 50;
  showBattleArenaInput.checked = config.showBattleArena !== false;
  showLiveFeedInput.checked = config.showLiveFeed !== false;
  liveFeedTitleInput.value = config.liveFeedTitle || 'LIVE GAME FEED';
  showSpawnAlertInput.checked = config.showSpawnAlert !== false;
  spawnAlertTitleInput.value = config.spawnAlertTitle || 'WILD SPAWN';
  spawnCatchGuideInput.value = config.spawnCatchGuide || 'Type catch in chat!';
  customCssInput.value = config.customCss || '';
  
  // Card layout customization
  spawnCardScaleInput.value = config.spawnCardScale !== undefined ? config.spawnCardScale : 1.0;
  spawnCardPositionSelect.value = config.spawnCardPosition || 'bottom-left';
  showCardSpriteCheckbox.checked = config.showCardSprite !== false;
  showCardTypesCheckbox.checked = config.showCardTypes !== false;
  showCardInstructionsCheckbox.checked = config.showCardInstructions !== false;
  
  // Specific Spawn Target
  spawnTargetInput.value = config.spawnTarget || '';
}

const btnForceSpawn = document.getElementById('btn-force-spawn');
const btnResetDb = document.getElementById('btn-reset-db');
const btnLogout = document.getElementById('btn-logout');
const obsOverlayUrl = document.getElementById('obs-overlay-url');
const btnCopyUrl = document.getElementById('btn-copy-url');

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
  populateConfig(config);
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
    youtubeChannelId: channelIdInput.value.trim(),
    twitchChannel: twitchChannelInput.value.trim(),
    videoId: videoId,
    obsWebsocketUrl: obsWebsocketUrlInput.value.trim(),
    youtubeApiKey: youtubeApiKeyInput.value.trim(),
    spawnIntervalMs: parseInt(spawnIntervalInput.value) * 1000,
    wildDespawnTimeoutMs: parseInt(despawnTimeoutInput.value) * 1000,
    catchCooldownMs: parseInt(catchCooldownInput.value) * 1000,
    shinyChance: parseFloat(shinyChanceInput.value) / 100,
    
    // UI Customization
    theme: themeSelect.value,
    primaryColor: primaryColorInput.value,
    sfxVolume: parseInt(sfxVolumeInput.value),
    showBattleArena: showBattleArenaInput.checked,
    showLiveFeed: showLiveFeedInput.checked,
    liveFeedTitle: liveFeedTitleInput.value.trim(),
    showSpawnAlert: showSpawnAlertInput.checked,
    spawnAlertTitle: spawnAlertTitleInput.value.trim(),
    spawnCatchGuide: spawnCatchGuideInput.value.trim(),
    customCss: customCssInput.value,
    
    // Spawn Card Customization
    spawnCardScale: parseFloat(spawnCardScaleInput.value),
    spawnCardPosition: spawnCardPositionSelect.value,
    showCardSprite: showCardSpriteCheckbox.checked,
    showCardTypes: showCardTypesCheckbox.checked,
    showCardInstructions: showCardInstructionsCheckbox.checked,
    
    // Retain spawn target if set
    spawnTarget: spawnTargetInput.value.trim()
  };
  
  socket.emit('update_config', { newConfig: updatedConfig, password: adminPassword });
  alert('Configuration updated successfully!');
});

// Manual Spawn Target Override Button
btnSaveTarget.addEventListener('click', () => {
  const target = spawnTargetInput.value.trim();
  if (!target) {
    alert('Please enter a Pokémon name or ID to spawn!');
    return;
  }
  
  // Submit config setting update with only spawnTarget modified
  const updatedConfig = {
    youtubeChannelId: channelIdInput.value.trim(),
    twitchChannel: twitchChannelInput.value.trim(),
    videoId: videoIdInput.value.trim(),
    obsWebsocketUrl: obsWebsocketUrlInput.value.trim(),
    youtubeApiKey: youtubeApiKeyInput.value.trim(),
    spawnIntervalMs: parseInt(spawnIntervalInput.value) * 1000,
    wildDespawnTimeoutMs: parseInt(despawnTimeoutInput.value) * 1000,
    catchCooldownMs: parseInt(catchCooldownInput.value) * 1000,
    shinyChance: parseFloat(shinyChanceInput.value) / 100,
    theme: themeSelect.value,
    primaryColor: primaryColorInput.value,
    sfxVolume: parseInt(sfxVolumeInput.value),
    showBattleArena: showBattleArenaInput.checked,
    showLiveFeed: showLiveFeedInput.checked,
    liveFeedTitle: liveFeedTitleInput.value.trim(),
    showSpawnAlert: showSpawnAlertInput.checked,
    spawnAlertTitle: spawnAlertTitleInput.value.trim(),
    spawnCatchGuide: spawnCatchGuideInput.value.trim(),
    customCss: customCssInput.value,
    spawnCardScale: parseFloat(spawnCardScaleInput.value),
    spawnCardPosition: spawnCardPositionSelect.value,
    showCardSprite: showCardSpriteCheckbox.checked,
    showCardTypes: showCardTypesCheckbox.checked,
    showCardInstructions: showCardInstructionsCheckbox.checked,
    
    spawnTarget: target
  };
  
  socket.emit('update_config', { newConfig: updatedConfig, password: adminPassword });
  alert(`Next spawn target locked to: "${target}". Check overlay or click Force Spawn!`);
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

// OBS Browser Source Link copy handler
if (channelId) {
  const host = window.location.origin;
  obsOverlayUrl.value = `${host}/overlay.html?channel=${channelId}`;
}

btnCopyUrl.addEventListener('click', () => {
  obsOverlayUrl.select();
  navigator.clipboard.writeText(obsOverlayUrl.value);
  btnCopyUrl.textContent = 'Copied!';
  btnCopyUrl.style.background = 'var(--color-success)';
  setTimeout(() => {
    btnCopyUrl.textContent = 'Copy';
    btnCopyUrl.style.background = 'var(--color-primary)';
  }, 2000);
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

// ==========================================================================
// Tab Switching, Viewer Database Searching, & Administration Controllers
// ==========================================================================
const btnTabControls = document.getElementById('btn-tab-controls');
const btnTabViewers = document.getElementById('btn-tab-viewers');
const mainControlsView = document.getElementById('main-controls-view');
const mainViewersView = document.getElementById('main-viewers-view');
const viewerSearch = document.getElementById('viewer-search');
const viewerDbBody = document.getElementById('viewer-db-body');

let cachedPlayersList = [];

// Tab click actions
if (btnTabControls && btnTabViewers) {
  btnTabControls.addEventListener('click', () => {
    btnTabControls.classList.add('active');
    btnTabControls.style.background = 'var(--color-primary)';
    btnTabControls.style.color = '#fff';
    
    btnTabViewers.classList.remove('active');
    btnTabViewers.style.background = 'rgba(255,255,255,0.05)';
    btnTabViewers.style.color = 'var(--text-muted)';
    
    mainControlsView.classList.remove('hidden');
    mainViewersView.classList.add('hidden');
  });

  btnTabViewers.addEventListener('click', () => {
    btnTabViewers.classList.add('active');
    btnTabViewers.style.background = 'var(--color-primary)';
    btnTabViewers.style.color = '#fff';
    
    btnTabControls.classList.remove('active');
    btnTabControls.style.background = 'rgba(255,255,255,0.05)';
    btnTabControls.style.color = 'var(--text-muted)';
    
    mainControlsView.classList.add('hidden');
    mainViewersView.classList.remove('hidden');
    
    // Trigger socket load
    socket.emit('get_all_players');
  });
}

// Receive all players list updates
socket.on('all_players_data', (players) => {
  cachedPlayersList = players;
  renderViewersTable(players);
});

// Render table entries
function renderViewersTable(players) {
  if (!viewerDbBody) return;
  
  if (!players || players.length === 0) {
    viewerDbBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center muted" style="padding:30px;">No players registered. Sim a catch to start!</td>
      </tr>
    `;
    return;
  }
  
  viewerDbBody.innerHTML = '';
  
  players.forEach(p => {
    const tr = document.createElement('tr');
    tr.id = `player-row-${p.username}`;
    
    const buddyName = p.buddyInstanceId ? 'Buddy Active' : 'None';
    
    tr.innerHTML = `
      <td><strong>@${p.displayName}</strong><br><small class="muted" style="font-size:11px;">username: ${p.username}</small></td>
      <td style="vertical-align: middle;">
        <input type="number" id="edit-level-${p.username}" value="${p.level}" style="width:50px; padding:4px 6px; border-radius:4px; text-align:center;">
      </td>
      <td style="vertical-align: middle;">
        <input type="number" id="edit-xp-${p.username}" value="${p.xp}" style="width:60px; padding:4px 6px; border-radius:4px; text-align:center;">
      </td>
      <td style="vertical-align: middle;">
        <input type="number" id="edit-coins-${p.username}" value="${p.coins}" style="width:75px; padding:4px 6px; border-radius:4px; text-align:center;">
      </td>
      <td style="vertical-align: middle;">
        <div style="display:flex; gap:6px; font-size:11px;">
          <span>🔴 <input type="number" id="edit-poke-${p.username}" value="${p.balls.pokeball}" style="width:38px; padding:2px; border-radius:4px; text-align:center;"></span>
          <span>🔵 <input type="number" id="edit-great-${p.username}" value="${p.balls.greatball}" style="width:38px; padding:2px; border-radius:4px; text-align:center;"></span>
          <span>🟡 <input type="number" id="edit-ultra-${p.username}" value="${p.balls.ultraball}" style="width:38px; padding:2px; border-radius:4px; text-align:center;"></span>
          <span>🟣 <input type="number" id="edit-master-${p.username}" value="${p.balls.masterball}" style="width:38px; padding:2px; border-radius:4px; text-align:center;"></span>
        </div>
      </td>
      <td style="vertical-align: middle;"><span class="muted">${buddyName}</span></td>
      <td style="vertical-align: middle; text-align: center;">
        <button type="button" class="btn btn-preset btn-save-player" data-user="${p.username}" style="margin: 0; background:var(--color-primary); font-size:11px; padding:6px 12px; border:none; color:#fff;">Save</button>
      </td>
    `;
    viewerDbBody.appendChild(tr);
  });
  
  // Bind Action Buttons
  viewerDbBody.querySelectorAll('.btn-save-player').forEach(btn => {
    btn.addEventListener('click', () => {
      const username = btn.getAttribute('data-user');
      const updatedFields = {
        level: parseInt(document.getElementById(`edit-level-${username}`).value),
        xp: parseInt(document.getElementById(`edit-xp-${username}`).value),
        coins: parseInt(document.getElementById(`edit-coins-${username}`).value),
        balls: {
          pokeball: parseInt(document.getElementById(`edit-poke-${username}`).value),
          greatball: parseInt(document.getElementById(`edit-great-${username}`).value),
          ultraball: parseInt(document.getElementById(`edit-ultra-${username}`).value),
          masterball: parseInt(document.getElementById(`edit-master-${username}`).value)
        }
      };
      
      socket.emit('admin_update_player', {
        password: adminPassword,
        playerUsername: username,
        updatedFields
      });
    });
  });
}

// Receive update confirmations
socket.on('player_updated_ack', (data) => {
  if (data.success) {
    alert(`Player @${data.username} profile updated successfully!`);
  } else {
    alert(`Update failed: ${data.error}`);
  }
});

// Bind Search Filter
if (viewerSearch) {
  viewerSearch.addEventListener('keyup', () => {
    const term = viewerSearch.value.toLowerCase().trim();
    if (!term) {
      renderViewersTable(cachedPlayersList);
      return;
    }
    const filtered = cachedPlayersList.filter(p => 
      p.username.includes(term) || 
      p.displayName.toLowerCase().includes(term)
    );
    renderViewersTable(filtered);
  });
}
