// Parse streamer channel query from URL or redirect to landing page
const urlParams = new URLSearchParams(window.location.search);
const channelId = urlParams.get('channel');

if (!channelId) {
  window.location.href = 'index.html';
}

const backendParam = urlParams.get('backend');
const DEFAULT_RENDER_BACKEND = 'https://pokemon-overlay-backend-hfpf.onrender.com';
const BACKEND_URL = backendParam ? backendParam.replace(/\/$/, '') : (localStorage.getItem('backend_url') || (window.location.origin.includes('localhost') ? '' : DEFAULT_RENDER_BACKEND));
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
const showLeaderboardInput = document.getElementById('show-leaderboard');
const showLiveFeedInput = document.getElementById('show-live-feed');
const liveFeedTitleInput = document.getElementById('live-feed-title');
const showSpawnAlertInput = document.getElementById('show-spawn-alert');
const spawnAlertTitleInput = document.getElementById('spawn-alert-title');
const spawnCatchGuideInput = document.getElementById('spawn-catch-guide');
const inventoryBaseUrlInput = document.getElementById('inventory-base-url');
const customCssInput = document.getElementById('custom-css');

// Custom Economy inputs
const coinsCaptureNormalInput = document.getElementById('coins-capture-normal');
const coinsCaptureShinyInput = document.getElementById('coins-capture-shiny');
const xpCaptureNormalInput = document.getElementById('xp-capture-normal');
const xpCaptureShinyInput = document.getElementById('xp-capture-shiny');
const levelUpCoinsInput = document.getElementById('level-up-coins');
const levelUpGreatballsInput = document.getElementById('level-up-greatballs');
const levelUpUltraballsInput = document.getElementById('level-up-ultraballs');
const catchMultiplierPokeballInput = document.getElementById('catch-multiplier-pokeball');
const catchMultiplierGreatballInput = document.getElementById('catch-multiplier-greatball');
const catchMultiplierUltraballInput = document.getElementById('catch-multiplier-ultraball');
const pricePokeballInput = document.getElementById('price-pokeball');
const priceGreatballInput = document.getElementById('price-greatball');
const priceUltraballInput = document.getElementById('price-ultraball');
const priceMasterballInput = document.getElementById('price-masterball');

const catchMultiplierNormalInput = document.getElementById('catch-multiplier-normal');
const catchMultiplierRareInput = document.getElementById('catch-multiplier-rare');
const catchMultiplierLegendaryInput = document.getElementById('catch-multiplier-legendary');
const pricePackKantoInput = document.getElementById('price-pack-kanto');
const pricePackJohtoInput = document.getElementById('price-pack-johto');
const pricePackHoennInput = document.getElementById('price-pack-hoenn');
const pricePackSinnohInput = document.getElementById('price-pack-sinnoh');
const pricePackUnovaInput = document.getElementById('price-pack-unova');
const pricePackKalosInput = document.getElementById('price-pack-kalos');
const pricePackAlolaInput = document.getElementById('price-pack-alola');
const pricePackLegendaryInput = document.getElementById('price-pack-legendary');
const priceFireStoneInput = document.getElementById('price-fire-stone');
const priceWaterStoneInput = document.getElementById('price-water-stone');
const priceThunderStoneInput = document.getElementById('price-thunder-stone');
const priceLeafStoneInput = document.getElementById('price-leaf-stone');
const priceMoonStoneInput = document.getElementById('price-moon-stone');

const raidChanceInput = document.getElementById('raid-chance');
const raidBossHpInput = document.getElementById('raid-boss-hp');
const raidRewardCoinsInput = document.getElementById('raid-reward-coins');
const raidRewardXpInput = document.getElementById('raid-reward-xp');
const raidDropStoneChanceInput = document.getElementById('raid-drop-stone-chance');

// Spawn Card Specific Elements
const spawnCardScaleInput = document.getElementById('spawn-card-scale');
const spawnCardPositionSelect = document.getElementById('spawn-card-position');
const showCardSpriteCheckbox = document.getElementById('show-card-sprite');
const showCardTypesCheckbox = document.getElementById('show-card-types');
const showCardInstructionsCheckbox = document.getElementById('show-card-instructions');

// Custom layout inputs
const spawnCustomPosRow = document.getElementById('spawn-custom-pos-row');
const spawnCardLeftInput = document.getElementById('spawn-card-left');
const spawnCardRightInput = document.getElementById('spawn-card-right');
const spawnCardTopInput = document.getElementById('spawn-card-top');
const spawnCardBottomInput = document.getElementById('spawn-card-bottom');

const tickerPositionSelect = document.getElementById('ticker-position');
const tickerCustomPosRow = document.getElementById('ticker-custom-pos-row');
const tickerLeftInput = document.getElementById('ticker-left');
const tickerRightInput = document.getElementById('ticker-right');
const tickerTopInput = document.getElementById('ticker-top');
const tickerBottomInput = document.getElementById('ticker-bottom');

const feedPositionSelect = document.getElementById('feed-position');
const feedCustomPosRow = document.getElementById('feed-custom-pos-row');
const feedLeftInput = document.getElementById('feed-left');
const feedRightInput = document.getElementById('feed-right');
const feedTopInput = document.getElementById('feed-top');
const feedBottomInput = document.getElementById('feed-bottom');

const battlePositionSelect = document.getElementById('battle-position');
const battleCustomPosRow = document.getElementById('battle-custom-pos-row');
const battleLeftInput = document.getElementById('battle-left');
const battleRightInput = document.getElementById('battle-right');
const battleTopInput = document.getElementById('battle-top');
const battleBottomInput = document.getElementById('battle-bottom');

function setupCustomPosToggle(selectEl, rowEl) {
  if (!selectEl || !rowEl) return;
  const updateToggle = () => {
    if (selectEl.value === 'custom') {
      rowEl.style.display = 'flex';
    } else {
      rowEl.style.display = 'none';
    }
  };
  selectEl.addEventListener('change', updateToggle);
  updateToggle();
}

setupCustomPosToggle(spawnCardPositionSelect, spawnCustomPosRow);
setupCustomPosToggle(tickerPositionSelect, tickerCustomPosRow);
setupCustomPosToggle(feedPositionSelect, feedCustomPosRow);
setupCustomPosToggle(battlePositionSelect, battleCustomPosRow);

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
  showLeaderboardInput.checked = config.showLeaderboard !== false;
  showLiveFeedInput.checked = config.showLiveFeed !== false;
  liveFeedTitleInput.value = config.liveFeedTitle || 'LIVE GAME FEED';
  showSpawnAlertInput.checked = config.showSpawnAlert !== false;
  spawnAlertTitleInput.value = config.spawnAlertTitle || 'WILD SPAWN';
  spawnCatchGuideInput.value = config.spawnCatchGuide || 'Type !catch in chat!';
  inventoryBaseUrlInput.value = config.inventoryBaseUrl || '';
  customCssInput.value = config.customCss || '';
  
  // Card layout customization
  spawnCardScaleInput.value = config.spawnCardScale !== undefined ? config.spawnCardScale : 1.0;
  spawnCardPositionSelect.value = config.spawnCardPosition || 'bottom-left';
  showCardSpriteCheckbox.checked = config.showCardSprite !== false;
  showCardTypesCheckbox.checked = config.showCardTypes !== false;
  showCardInstructionsCheckbox.checked = config.showCardInstructions !== false;

  // Custom offsets
  spawnCardLeftInput.value = config.spawnCardLeft || '';
  spawnCardRightInput.value = config.spawnCardRight || '';
  spawnCardTopInput.value = config.spawnCardTop || '';
  spawnCardBottomInput.value = config.spawnCardBottom || '';
  
  tickerPositionSelect.value = config.tickerPosition || 'top-left';
  tickerLeftInput.value = config.tickerLeft || '';
  tickerRightInput.value = config.tickerRight || '';
  tickerTopInput.value = config.tickerTop || '';
  tickerBottomInput.value = config.tickerBottom || '';
  
  feedPositionSelect.value = config.feedPosition || 'top-right';
  feedLeftInput.value = config.feedLeft || '';
  feedRightInput.value = config.feedRight || '';
  feedTopInput.value = config.feedTop || '';
  feedBottomInput.value = config.feedBottom || '';
  
  battlePositionSelect.value = config.battlePosition || 'center';
  battleLeftInput.value = config.battleLeft || '';
  battleRightInput.value = config.battleRight || '';
  battleTopInput.value = config.battleTop || '';
  battleBottomInput.value = config.battleBottom || '';
  
  // Trigger toggles
  [spawnCardPositionSelect, tickerPositionSelect, feedPositionSelect, battlePositionSelect].forEach(select => {
    if (select) select.dispatchEvent(new Event('change'));
  });
  
  // Specific Spawn Target
  spawnTargetInput.value = config.spawnTarget || '';

  // Custom Economy values
  coinsCaptureNormalInput.value = config.coinsCaptureNormal !== undefined ? config.coinsCaptureNormal : 20;
  coinsCaptureShinyInput.value = config.coinsCaptureShiny !== undefined ? config.coinsCaptureShiny : 100;
  xpCaptureNormalInput.value = config.xpCaptureNormal !== undefined ? config.xpCaptureNormal : 15;
  xpCaptureShinyInput.value = config.xpCaptureShiny !== undefined ? config.xpCaptureShiny : 50;
  levelUpCoinsInput.value = config.levelUpCoins !== undefined ? config.levelUpCoins : 100;
  levelUpGreatballsInput.value = config.levelUpGreatballs !== undefined ? config.levelUpGreatballs : 3;
  levelUpUltraballsInput.value = config.levelUpUltraballs !== undefined ? config.levelUpUltraballs : 1;
  catchMultiplierPokeballInput.value = config.catchMultiplierPokeball !== undefined ? config.catchMultiplierPokeball : 1.0;
  catchMultiplierGreatballInput.value = config.catchMultiplierGreatball !== undefined ? config.catchMultiplierGreatball : 1.5;
  catchMultiplierUltraballInput.value = config.catchMultiplierUltraball !== undefined ? config.catchMultiplierUltraball : 2.0;
  pricePokeballInput.value = config.pricePokeball !== undefined ? config.pricePokeball : 10;
  priceGreatballInput.value = config.priceGreatball !== undefined ? config.priceGreatball : 30;
  priceUltraballInput.value = config.priceUltraball !== undefined ? config.priceUltraball : 80;
  priceMasterballInput.value = config.priceMasterball !== undefined ? config.priceMasterball : 250;
  
  catchMultiplierNormalInput.value = config.catchMultiplierNormal !== undefined ? config.catchMultiplierNormal : 1.0;
  catchMultiplierRareInput.value = config.catchMultiplierRare !== undefined ? config.catchMultiplierRare : 1.0;
  catchMultiplierLegendaryInput.value = config.catchMultiplierLegendary !== undefined ? config.catchMultiplierLegendary : 1.0;
  pricePackKantoInput.value = config.pricePackKanto !== undefined ? config.pricePackKanto : 150;
  pricePackJohtoInput.value = config.pricePackJohto !== undefined ? config.pricePackJohto : 150;
  pricePackHoennInput.value = config.pricePackHoenn !== undefined ? config.pricePackHoenn : 150;
  pricePackSinnohInput.value = config.pricePackSinnoh !== undefined ? config.pricePackSinnoh : 150;
  pricePackUnovaInput.value = config.pricePackUnova !== undefined ? config.pricePackUnova : 150;
  pricePackKalosInput.value = config.pricePackKalos !== undefined ? config.pricePackKalos : 150;
  pricePackAlolaInput.value = config.pricePackAlola !== undefined ? config.pricePackAlola : 150;
  pricePackLegendaryInput.value = config.pricePackLegendary !== undefined ? config.pricePackLegendary : 500;
  
  priceFireStoneInput.value = config.priceFireStone !== undefined ? config.priceFireStone : 150;
  priceWaterStoneInput.value = config.priceWaterStone !== undefined ? config.priceWaterStone : 150;
  priceThunderStoneInput.value = config.priceThunderStone !== undefined ? config.priceThunderStone : 150;
  priceLeafStoneInput.value = config.priceLeafStone !== undefined ? config.priceLeafStone : 150;
  priceMoonStoneInput.value = config.priceMoonStone !== undefined ? config.priceMoonStone : 150;
  
  raidChanceInput.value = config.raidChance !== undefined ? Math.round(config.raidChance * 100) : 5;
  raidBossHpInput.value = config.raidBossHp !== undefined ? config.raidBossHp : 5000;
  raidRewardCoinsInput.value = config.raidRewardCoins !== undefined ? config.raidRewardCoins : 250;
  raidRewardXpInput.value = config.raidRewardXp !== undefined ? config.raidRewardXp : 150;
  raidDropStoneChanceInput.value = config.raidDropStoneChance !== undefined ? Math.round(config.raidDropStoneChance * 100) : 15;
}

const btnForceSpawn = document.getElementById('btn-force-spawn');
const btnTriggerRaid = document.getElementById('btn-trigger-raid');
const raidBossTargetInput = document.getElementById('raid-boss-target');
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
    showLeaderboard: showLeaderboardInput.checked,
    
    // Custom Economy & Game Rewards
    coinsCaptureNormal: parseInt(coinsCaptureNormalInput.value),
    coinsCaptureShiny: parseInt(coinsCaptureShinyInput.value),
    xpCaptureNormal: parseInt(xpCaptureNormalInput.value),
    xpCaptureShiny: parseInt(xpCaptureShinyInput.value),
    levelUpCoins: parseInt(levelUpCoinsInput.value),
    levelUpGreatballs: parseInt(levelUpGreatballsInput.value),
    levelUpUltraballs: parseInt(levelUpUltraballsInput.value),
    catchMultiplierPokeball: parseFloat(catchMultiplierPokeballInput.value),
    catchMultiplierGreatball: parseFloat(catchMultiplierGreatballInput.value),
    catchMultiplierUltraball: parseFloat(catchMultiplierUltraballInput.value),
    pricePokeball: parseInt(pricePokeballInput.value),
    priceGreatball: parseInt(priceGreatballInput.value),
    priceUltraball: parseInt(priceUltraballInput.value),
    priceMasterball: parseInt(priceMasterballInput.value),
    catchMultiplierNormal: parseFloat(catchMultiplierNormalInput.value),
    catchMultiplierRare: parseFloat(catchMultiplierRareInput.value),
    catchMultiplierLegendary: parseFloat(catchMultiplierLegendaryInput.value),
    pricePackKanto: parseInt(pricePackKantoInput.value, 10),
    pricePackJohto: parseInt(pricePackJohtoInput.value, 10),
    pricePackHoenn: parseInt(pricePackHoennInput.value, 10),
    pricePackSinnoh: parseInt(pricePackSinnohInput.value, 10),
    pricePackUnova: parseInt(pricePackUnovaInput.value, 10),
    pricePackKalos: parseInt(pricePackKalosInput.value, 10),
    pricePackAlola: parseInt(pricePackAlolaInput.value, 10),
    pricePackLegendary: parseInt(pricePackLegendaryInput.value, 10),
    priceFireStone: parseInt(priceFireStoneInput.value, 10),
    priceWaterStone: parseInt(priceWaterStoneInput.value, 10),
    priceThunderStone: parseInt(priceThunderStoneInput.value, 10),
    priceLeafStone: parseInt(priceLeafStoneInput.value, 10),
    priceMoonStone: parseInt(priceMoonStoneInput.value, 10),
    raidChance: parseFloat(raidChanceInput.value) / 100,
    raidBossHp: parseInt(raidBossHpInput.value, 10),
    raidRewardCoins: parseInt(raidRewardCoinsInput.value, 10),
    raidRewardXp: parseInt(raidRewardXpInput.value, 10),
    raidDropStoneChance: parseFloat(raidDropStoneChanceInput.value) / 100,
    showLiveFeed: showLiveFeedInput.checked,
    liveFeedTitle: liveFeedTitleInput.value.trim(),
    showSpawnAlert: showSpawnAlertInput.checked,
    spawnAlertTitle: spawnAlertTitleInput.value.trim(),
    spawnCatchGuide: spawnCatchGuideInput.value.trim(),
    inventoryBaseUrl: inventoryBaseUrlInput.value.trim(),
    customCss: customCssInput.value,
    
    // Spawn Card Customization
    spawnCardScale: parseFloat(spawnCardScaleInput.value),
    spawnCardPosition: spawnCardPositionSelect.value,
    showCardSprite: showCardSpriteCheckbox.checked,
    showCardTypes: showCardTypesCheckbox.checked,
    showCardInstructions: showCardInstructionsCheckbox.checked,
    
    // Custom positioning offsets
    spawnCardLeft: spawnCardLeftInput.value.trim(),
    spawnCardRight: spawnCardRightInput.value.trim(),
    spawnCardTop: spawnCardTopInput.value.trim(),
    spawnCardBottom: spawnCardBottomInput.value.trim(),
    tickerPosition: tickerPositionSelect.value,
    tickerLeft: tickerLeftInput.value.trim(),
    tickerRight: tickerRightInput.value.trim(),
    tickerTop: tickerTopInput.value.trim(),
    tickerBottom: tickerBottomInput.value.trim(),
    feedPosition: feedPositionSelect.value,
    feedLeft: feedLeftInput.value.trim(),
    feedRight: feedRightInput.value.trim(),
    feedTop: feedTopInput.value.trim(),
    feedBottom: feedBottomInput.value.trim(),
    battlePosition: battlePositionSelect.value,
    battleLeft: battleLeftInput.value.trim(),
    battleRight: battleRightInput.value.trim(),
    battleTop: battleTopInput.value.trim(),
    battleBottom: battleBottomInput.value.trim(),
    
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
    showLeaderboard: showLeaderboardInput.checked,
    
    // Custom Economy & Game Rewards
    coinsCaptureNormal: parseInt(coinsCaptureNormalInput.value),
    coinsCaptureShiny: parseInt(coinsCaptureShinyInput.value),
    xpCaptureNormal: parseInt(xpCaptureNormalInput.value),
    xpCaptureShiny: parseInt(xpCaptureShinyInput.value),
    levelUpCoins: parseInt(levelUpCoinsInput.value),
    levelUpGreatballs: parseInt(levelUpGreatballsInput.value),
    levelUpUltraballs: parseInt(levelUpUltraballsInput.value),
    catchMultiplierPokeball: parseFloat(catchMultiplierPokeballInput.value),
    catchMultiplierGreatball: parseFloat(catchMultiplierGreatballInput.value),
    catchMultiplierUltraball: parseFloat(catchMultiplierUltraballInput.value),
    pricePokeball: parseInt(pricePokeballInput.value),
    priceGreatball: parseInt(priceGreatballInput.value),
    priceUltraball: parseInt(priceUltraballInput.value),
    priceMasterball: parseInt(priceMasterballInput.value),
    catchMultiplierNormal: parseFloat(catchMultiplierNormalInput.value),
    catchMultiplierRare: parseFloat(catchMultiplierRareInput.value),
    catchMultiplierLegendary: parseFloat(catchMultiplierLegendaryInput.value),
    pricePackKanto: parseInt(pricePackKantoInput.value, 10),
    pricePackJohto: parseInt(pricePackJohtoInput.value, 10),
    pricePackHoenn: parseInt(pricePackHoennInput.value, 10),
    pricePackSinnoh: parseInt(pricePackSinnohInput.value, 10),
    pricePackUnova: parseInt(pricePackUnovaInput.value, 10),
    pricePackKalos: parseInt(pricePackKalosInput.value, 10),
    pricePackAlola: parseInt(pricePackAlolaInput.value, 10),
    pricePackLegendary: parseInt(pricePackLegendaryInput.value, 10),
    priceFireStone: parseInt(priceFireStoneInput.value, 10),
    priceWaterStone: parseInt(priceWaterStoneInput.value, 10),
    priceThunderStone: parseInt(priceThunderStoneInput.value, 10),
    priceLeafStone: parseInt(priceLeafStoneInput.value, 10),
    priceMoonStone: parseInt(priceMoonStoneInput.value, 10),
    showLiveFeed: showLiveFeedInput.checked,
    liveFeedTitle: liveFeedTitleInput.value.trim(),
    showSpawnAlert: showSpawnAlertInput.checked,
    spawnAlertTitle: spawnAlertTitleInput.value.trim(),
    spawnCatchGuide: spawnCatchGuideInput.value.trim(),
    inventoryBaseUrl: inventoryBaseUrlInput.value.trim(),
    customCss: customCssInput.value,
    spawnCardScale: parseFloat(spawnCardScaleInput.value),
    spawnCardPosition: spawnCardPositionSelect.value,
    showCardSprite: showCardSpriteCheckbox.checked,
    showCardTypes: showCardTypesCheckbox.checked,
    showCardInstructions: showCardInstructionsCheckbox.checked,
    
    spawnCardLeft: spawnCardLeftInput.value.trim(),
    spawnCardRight: spawnCardRightInput.value.trim(),
    spawnCardTop: spawnCardTopInput.value.trim(),
    spawnCardBottom: spawnCardBottomInput.value.trim(),
    tickerPosition: tickerPositionSelect.value,
    tickerLeft: tickerLeftInput.value.trim(),
    tickerRight: tickerRightInput.value.trim(),
    tickerTop: tickerTopInput.value.trim(),
    tickerBottom: tickerBottomInput.value.trim(),
    feedPosition: feedPositionSelect.value,
    feedLeft: feedLeftInput.value.trim(),
    feedRight: feedRightInput.value.trim(),
    feedTop: feedTopInput.value.trim(),
    feedBottom: feedBottomInput.value.trim(),
    battlePosition: battlePositionSelect.value,
    battleLeft: battleLeftInput.value.trim(),
    battleRight: battleRightInput.value.trim(),
    battleTop: battleTopInput.value.trim(),
    battleBottom: battleBottomInput.value.trim(),
    
    spawnTarget: target
  };
  
  socket.emit('update_config', { newConfig: updatedConfig, password: adminPassword });
  alert(`Next spawn target locked to: "${target}". Check overlay or click Force Spawn!`);
});

// manual spawn trigger
btnForceSpawn.addEventListener('click', () => {
  socket.emit('force_spawn', { password: adminPassword });
});

// Trigger Boss Raid API call
btnTriggerRaid.addEventListener('click', async () => {
  const bossName = raidBossTargetInput.value.trim();
  
  try {
    const res = await fetch(`${BACKEND_URL}/api/trigger-raid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: channelId,
        bossName: bossName,
        password: adminPassword
      })
    });
    
    if (res.ok) {
      alert('Boss Raid triggered successfully!');
      raidBossTargetInput.value = '';
    } else {
      const err = await res.json();
      alert(`Failed to trigger Boss Raid: ${err.error || 'Server error'}`);
    }
  } catch (err) {
    alert(`Connection error: ${err.message}`);
  }
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
  const backendParamStr = BACKEND_URL ? `&backend=${encodeURIComponent(BACKEND_URL)}` : '';
  obsOverlayUrl.value = `${host}/overlay.html?channel=${channelId}${backendParamStr}`;
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
const btnTabConsole = document.getElementById('btn-tab-console');
const btnTabSettings = document.getElementById('btn-tab-settings');
const btnTabViewers = document.getElementById('btn-tab-viewers');

const mainConsoleView = document.getElementById('main-console-view');
const mainSettingsView = document.getElementById('main-settings-view');
const mainViewersView = document.getElementById('main-viewers-view');

const viewerSearch = document.getElementById('viewer-search');
const viewerDbBody = document.getElementById('viewer-db-body');

let cachedPlayersList = [];

// Tab click actions
function deactivateAllTabs() {
  [btnTabConsole, btnTabSettings, btnTabViewers].forEach(btn => {
    if (btn) {
      btn.classList.remove('active');
      btn.style.background = 'rgba(255,255,255,0.05)';
      btn.style.color = 'var(--text-muted)';
    }
  });
  [mainConsoleView, mainSettingsView, mainViewersView].forEach(view => {
    if (view) view.classList.add('hidden');
  });
}

if (btnTabConsole) {
  btnTabConsole.addEventListener('click', () => {
    deactivateAllTabs();
    btnTabConsole.classList.add('active');
    btnTabConsole.style.background = 'var(--color-primary)';
    btnTabConsole.style.color = '#fff';
    if (mainConsoleView) mainConsoleView.classList.remove('hidden');
  });
}

if (btnTabSettings) {
  btnTabSettings.addEventListener('click', () => {
    deactivateAllTabs();
    btnTabSettings.classList.add('active');
    btnTabSettings.style.background = 'var(--color-primary)';
    btnTabSettings.style.color = '#fff';
    if (mainSettingsView) mainSettingsView.classList.remove('hidden');
  });
}

if (btnTabViewers) {
  btnTabViewers.addEventListener('click', () => {
    deactivateAllTabs();
    btnTabViewers.classList.add('active');
    btnTabViewers.style.background = 'var(--color-primary)';
    btnTabViewers.style.color = '#fff';
    if (mainViewersView) mainViewersView.classList.remove('hidden');
    
    // Trigger socket load
    socket.emit('get_all_players');
  });
}

// Settings Inner Tab Navigation (Vertical sidebar tabs)
const configTabBtns = document.querySelectorAll('.config-tab-btn');
const configTabPanels = document.querySelectorAll('.config-tab-panel');

configTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // Remove active class from all buttons and panels
    configTabBtns.forEach(b => b.classList.remove('active'));
    configTabPanels.forEach(p => p.classList.remove('active'));
    
    // Add active class to clicked button
    btn.classList.add('active');
    
    // Show matching panel
    const targetPanelId = btn.getAttribute('data-panel');
    const targetPanel = document.getElementById(targetPanelId);
    if (targetPanel) {
      targetPanel.classList.add('active');
    }
  });
});

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
