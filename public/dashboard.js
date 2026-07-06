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
let currentConfigRef = null;

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
    
    // Automatically load the player database once unlocked
    socket.emit('get_all_players', { password: adminPassword });
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

// Generation checkboxes
const genCheckboxes = [
  document.getElementById('gen-1'),
  document.getElementById('gen-2'),
  document.getElementById('gen-3'),
  document.getElementById('gen-4'),
  document.getElementById('gen-5'),
  document.getElementById('gen-6'),
  document.getElementById('gen-7'),
  document.getElementById('gen-8')
];

// UI Customization DOM elements
const themeSelect = document.getElementById('theme');
const spriteFormatSelect = document.getElementById('sprite-format');
const spawnCatchGuideModeSelect = document.getElementById('spawn-catch-guide-mode');
const primaryColorInput = document.getElementById('primary-color');
const primaryColorTextInput = document.getElementById('primary-color-text');
const sfxVolumeInput = document.getElementById('sfx-volume');
const showBattleArenaInput = document.getElementById('show-battle-arena');
const battleTypeSelect = document.getElementById('battle-type');
const fullHealTimeMinutesInput = document.getElementById('full-heal-time-minutes');
const healCostCoinsInput = document.getElementById('heal-cost-coins');
const persistentHpSettingsGroup = document.getElementById('persistent-hp-settings');
const showLeaderboardInput = document.getElementById('show-leaderboard');
const showLiveFeedInput = document.getElementById('show-live-feed');
const liveFeedTitleInput = document.getElementById('live-feed-title');
const showSpawnAlertInput = document.getElementById('show-spawn-alert');
const spawnAlertTitleInput = document.getElementById('spawn-alert-title');
const spawnCatchGuideInput = document.getElementById('spawn-catch-guide');
const inventoryBaseUrlInput = document.getElementById('inventory-base-url');
const customCssInput = document.getElementById('custom-css');
const showBuddyOnChatInput = document.getElementById('show-buddy-on-chat');
const buddyChatDurationInput = document.getElementById('buddy-chat-duration');
const buddyRoamerScaleInput = document.getElementById('buddy-roamer-scale');

// Custom Economy inputs
const coinsCaptureNormalInput = document.getElementById('coins-capture-normal');
const coinsCaptureShinyInput = document.getElementById('coins-capture-shiny');
const xpCaptureNormalInput = document.getElementById('xp-capture-normal');
const xpCaptureShinyInput = document.getElementById('xp-capture-shiny');
const levelUpCoinsInput = document.getElementById('level-up-coins');
const levelUpGreatballsInput = document.getElementById('level-up-greatballs');
const levelUpUltraballsInput = document.getElementById('level-up-ultraballs');
const loyaltyRewardIntervalInput = document.getElementById('loyalty-reward-interval');
const loyaltyRewardCoinsInput = document.getElementById('loyalty-reward-coins');
const loyaltyRewardPokeballsInput = document.getElementById('loyalty-reward-pokeballs');
const loyaltyRewardGreatballsInput = document.getElementById('loyalty-reward-greatballs');
const loyaltyRewardUltraballsInput = document.getElementById('loyalty-reward-ultraballs');
const loyaltyRewardMasterballsInput = document.getElementById('loyalty-reward-masterballs');
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
const battleAcceptTimeoutInput = document.getElementById('battle-accept-timeout');
const tradeTimeoutInput = document.getElementById('trade-timeout');
const dailyBattleLimitInput = document.getElementById('daily-battle-limit');
const streamDelayInput = document.getElementById('stream-delay');

// Spawn Card Specific Elements
const spawnCardScaleInput = document.getElementById('spawn-card-scale');
const spawnCardPositionSelect = document.getElementById('spawn-card-position');
const showCardSpriteCheckbox = document.getElementById('show-card-sprite');
const showCardTypesCheckbox = document.getElementById('show-card-types');
const showCardInstructionsCheckbox = document.getElementById('show-card-instructions');
const hideSpawnDetailsCheckbox = document.getElementById('hide-spawn-details');

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

const raidPositionSelect = document.getElementById('raid-position');
const raidCustomPosRow = document.getElementById('raid-custom-pos-row');
const raidLeftInput = document.getElementById('raid-left');
const raidRightInput = document.getElementById('raid-right');
const raidTopInput = document.getElementById('raid-top');
const raidBottomInput = document.getElementById('raid-bottom');

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
setupCustomPosToggle(raidPositionSelect, raidCustomPosRow);

if (battleTypeSelect) {
  battleTypeSelect.addEventListener('change', () => {
    if (persistentHpSettingsGroup) persistentHpSettingsGroup.style.display = 'none';
  });
}

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
  currentConfigRef = config;
  channelIdInput.value = config.youtubeChannelId || '';
  twitchChannelInput.value = config.twitchChannel || '';
  videoIdInput.value = config.videoId || '';
  obsWebsocketUrlInput.value = config.obsWebsocketUrl || '';
  youtubeApiKeyInput.value = config.youtubeApiKey || '';
  spawnIntervalInput.value = Math.round(config.spawnIntervalMs / 1000);
  despawnTimeoutInput.value = Math.round(config.wildDespawnTimeoutMs / 1000);
  catchCooldownInput.value = Math.round(config.catchCooldownMs / 1000);
  shinyChanceInput.value = config.shinyChance * 100;
  
  // Set generation checkboxes
  const allowedGens = config.allowedGenerations || [1,2,3,4,5,6,7,8];
  genCheckboxes.forEach((chk, index) => {
    if (chk) {
      chk.checked = allowedGens.includes(index + 1);
    }
  });
  
  // Customization fields
  themeSelect.value = config.theme || 'modern';
  spriteFormatSelect.value = config.spriteFormat || 'animated';
  spawnCatchGuideModeSelect.value = config.spawnCatchGuideMode || 'static';
  primaryColorInput.value = config.primaryColor || '#3b82f6';
  primaryColorTextInput.value = config.primaryColor || '#3b82f6';
  sfxVolumeInput.value = config.sfxVolume !== undefined ? config.sfxVolume : 50;
  showBattleArenaInput.checked = config.showBattleArena !== false;
  if (battleTypeSelect) {
    battleTypeSelect.value = config.battleType || 'normal';
    if (persistentHpSettingsGroup) persistentHpSettingsGroup.style.display = 'none';
  }
  if (fullHealTimeMinutesInput) fullHealTimeMinutesInput.value = config.fullHealTimeMinutes !== undefined ? config.fullHealTimeMinutes : 60;
  if (healCostCoinsInput) healCostCoinsInput.value = config.healCostCoins !== undefined ? config.healCostCoins : 50;

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
  hideSpawnDetailsCheckbox.checked = config.hideSpawnDetails || false;
  showBuddyOnChatInput.checked = config.showBuddyOnChat !== false;
  buddyChatDurationInput.value = config.buddyChatDuration !== undefined ? config.buddyChatDuration : 15;
  buddyRoamerScaleInput.value = config.buddyRoamerScale !== undefined ? config.buddyRoamerScale : 1.0;

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

  raidPositionSelect.value = config.raidPosition || 'center';
  raidLeftInput.value = config.raidLeft || '';
  raidRightInput.value = config.raidRight || '';
  raidTopInput.value = config.raidTop || '';
  raidBottomInput.value = config.raidBottom || '';
  
  // Trigger toggles
  [spawnCardPositionSelect, tickerPositionSelect, feedPositionSelect, battlePositionSelect, raidPositionSelect].forEach(select => {
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
  loyaltyRewardIntervalInput.value = config.loyaltyRewardInterval !== undefined ? config.loyaltyRewardInterval : 15;
  loyaltyRewardCoinsInput.value = config.loyaltyRewardCoins !== undefined ? config.loyaltyRewardCoins : 50;
  loyaltyRewardPokeballsInput.value = config.loyaltyRewardPokeballs !== undefined ? config.loyaltyRewardPokeballs : 5;
  loyaltyRewardGreatballsInput.value = config.loyaltyRewardGreatballs !== undefined ? config.loyaltyRewardGreatballs : 0;
  loyaltyRewardUltraballsInput.value = config.loyaltyRewardUltraballs !== undefined ? config.loyaltyRewardUltraballs : 0;
  loyaltyRewardMasterballsInput.value = config.loyaltyRewardMasterballs !== undefined ? config.loyaltyRewardMasterballs : 0;
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
  battleAcceptTimeoutInput.value = config.battleAcceptTimeoutSeconds !== undefined ? config.battleAcceptTimeoutSeconds : 30;
  tradeTimeoutInput.value = config.tradeTimeoutSeconds !== undefined ? config.tradeTimeoutSeconds : 60;
  dailyBattleLimitInput.value = config.dailyBattleLimit !== undefined ? config.dailyBattleLimit : 5;
  streamDelayInput.value = config.streamDelaySeconds !== undefined ? config.streamDelaySeconds : 0;
  
  // Set layout editor scale labels
  document.getElementById('lbl-scale-spawn').textContent = (config.spawnCardScale !== undefined ? config.spawnCardScale : 1.0).toFixed(2);
  document.getElementById('lbl-scale-battle').textContent = (config.battleScale !== undefined ? config.battleScale : 1.0).toFixed(2);
  document.getElementById('lbl-scale-ticker').textContent = (config.tickerScale !== undefined ? config.tickerScale : 1.0).toFixed(2);
  document.getElementById('lbl-scale-feed').textContent = (config.feedScale !== undefined ? config.feedScale : 1.0).toFixed(2);
  document.getElementById('lbl-scale-raid').textContent = (config.raidScale !== undefined ? config.raidScale : 1.0).toFixed(2);
  document.getElementById('lbl-scale-pack').textContent = (config.packScale !== undefined ? config.packScale : 1.0).toFixed(2);
  document.getElementById('lbl-scale-levelup').textContent = (config.levelUpScale !== undefined ? config.levelUpScale : 1.0).toFixed(2);


  // Initialize drag & drop layout editor settings
  setupLayoutEditor(config);
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
  currentConfigRef = state.config;
  updateWildPokemonUI(state.activeWildPokemon);
  updateBattleUI(state.activeBattle);
  updateLeaderboardUI(state.leaderboard);
});

// Update Config Form Submission
function compileConfigObject() {
  const videoIdRaw = videoIdInput.value.trim();
  let videoId = videoIdRaw;
  // Parse video ID from URL if user pastes link
  if (videoIdRaw.includes('v=')) {
    videoId = videoIdRaw.split('v=')[1].split('&')[0];
  } else if (videoIdRaw.includes('youtu.be/')) {
    videoId = videoIdRaw.split('youtu.be/')[1].split('?')[0];
  }

  const allowedGenerations = [];
  genCheckboxes.forEach((chk, index) => {
    if (chk && chk.checked) {
      allowedGenerations.push(index + 1);
    }
  });

  return {
    allowedGenerations,
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
    spriteFormat: spriteFormatSelect.value,
    spawnCatchGuideMode: spawnCatchGuideModeSelect.value,
    primaryColor: primaryColorInput.value,
    sfxVolume: parseInt(sfxVolumeInput.value),
    showBattleArena: widgetSidebarState['drag-battle'] ? widgetSidebarState['drag-battle'].show : true,
    battleType: battleTypeSelect ? battleTypeSelect.value : 'normal',
    fullHealTimeMinutes: fullHealTimeMinutesInput ? parseInt(fullHealTimeMinutesInput.value, 10) : 60,
    healCostCoins: healCostCoinsInput ? parseInt(healCostCoinsInput.value, 10) : 50,
    showLeaderboard: widgetSidebarState['drag-ticker'] ? widgetSidebarState['drag-ticker'].show : true,
    
    // Custom Economy & Game Rewards
    coinsCaptureNormal: parseInt(coinsCaptureNormalInput.value),
    coinsCaptureShiny: parseInt(coinsCaptureShinyInput.value),
    xpCaptureNormal: parseInt(xpCaptureNormalInput.value),
    xpCaptureShiny: parseInt(xpCaptureShinyInput.value),
    levelUpCoins: parseInt(levelUpCoinsInput.value),
    levelUpGreatballs: parseInt(levelUpGreatballsInput.value),
    levelUpUltraballs: parseInt(levelUpUltraballsInput.value),
    loyaltyRewardInterval: parseInt(loyaltyRewardIntervalInput.value, 10) || 15,
    loyaltyRewardCoins: parseInt(loyaltyRewardCoinsInput.value, 10) || 50,
    loyaltyRewardPokeballs: parseInt(loyaltyRewardPokeballsInput.value, 10) || 5,
    loyaltyRewardGreatballs: parseInt(loyaltyRewardGreatballsInput.value, 10) || 0,
    loyaltyRewardUltraballs: parseInt(loyaltyRewardUltraballsInput.value, 10) || 0,
    loyaltyRewardMasterballs: parseInt(loyaltyRewardMasterballsInput.value, 10) || 0,
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
    battleAcceptTimeoutSeconds: parseInt(battleAcceptTimeoutInput.value, 10),
    tradeTimeoutSeconds: parseInt(tradeTimeoutInput.value, 10) || 60,
    dailyBattleLimit: parseInt(dailyBattleLimitInput.value, 10) || 5,
    streamDelaySeconds: parseInt(streamDelayInput.value, 10),
    showLiveFeed: widgetSidebarState['drag-feed'] ? widgetSidebarState['drag-feed'].show : true,
    liveFeedTitle: liveFeedTitleInput.value.trim(),
    showSpawnAlert: widgetSidebarState['drag-spawn-card'] ? widgetSidebarState['drag-spawn-card'].show : true,
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
    hideSpawnDetails: hideSpawnDetailsCheckbox.checked,
    showBuddyOnChat: showBuddyOnChatInput.checked,
    buddyChatDuration: parseInt(buddyChatDurationInput.value, 10) || 15,
    buddyRoamerScale: parseFloat(buddyRoamerScaleInput.value) || 1.0,
    
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

    raidPosition: raidPositionSelect.value,
    raidLeft: raidLeftInput.value.trim(),
    raidRight: raidRightInput.value.trim(),
    raidTop: raidTopInput.value.trim(),
    raidBottom: raidBottomInput.value.trim(),
    
    // Custom scales saved from layout editor
    battleScale: parseFloat(document.getElementById('lbl-scale-battle').textContent) || 1.0,
    tickerScale: parseFloat(document.getElementById('lbl-scale-ticker').textContent) || 1.0,
    feedScale: parseFloat(document.getElementById('lbl-scale-feed').textContent) || 1.0,
    raidScale: parseFloat(document.getElementById('lbl-scale-raid').textContent) || 1.0,

    showRaid: widgetSidebarState['drag-raid'] ? widgetSidebarState['drag-raid'].show : true,
    showPackOpening: widgetSidebarState['drag-pack'] ? widgetSidebarState['drag-pack'].show : true,
    packPosition: widgetSidebarState['drag-pack'] ? widgetSidebarState['drag-pack'].position : 'center',
    packLeft: widgetSidebarState['drag-pack'] ? widgetSidebarState['drag-pack'].left : '',
    packRight: widgetSidebarState['drag-pack'] ? widgetSidebarState['drag-pack'].right : '',
    packTop: widgetSidebarState['drag-pack'] ? widgetSidebarState['drag-pack'].top : '',
    packBottom: widgetSidebarState['drag-pack'] ? widgetSidebarState['drag-pack'].bottom : '',
    packScale: widgetSidebarState['drag-pack'] ? widgetSidebarState['drag-pack'].scale : 1.0,

    showLevelUp: widgetSidebarState['drag-levelup'] ? widgetSidebarState['drag-levelup'].show : true,
    levelUpPosition: widgetSidebarState['drag-levelup'] ? widgetSidebarState['drag-levelup'].position : 'center',
    levelUpLeft: widgetSidebarState['drag-levelup'] ? widgetSidebarState['drag-levelup'].left : '',
    levelUpRight: widgetSidebarState['drag-levelup'] ? widgetSidebarState['drag-levelup'].right : '',
    levelUpTop: widgetSidebarState['drag-levelup'] ? widgetSidebarState['drag-levelup'].top : '',
    levelUpBottom: widgetSidebarState['drag-levelup'] ? widgetSidebarState['drag-levelup'].bottom : '',
    levelUpScale: widgetSidebarState['drag-levelup'] ? widgetSidebarState['drag-levelup'].scale : 1.0,

    spawnTarget: spawnTargetInput.value.trim()
  };
}

configForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const updatedConfig = compileConfigObject();
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
  const updatedConfig = compileConfigObject();
  updatedConfig.spawnTarget = target;
  
  socket.emit('update_config', { newConfig: updatedConfig, password: adminPassword });
  alert(`Next spawn target locked to: "${target}". Check overlay or click Force Spawn!`);
});

// manual spawn trigger
btnForceSpawn.addEventListener('click', () => {
  socket.emit('force_spawn', { password: adminPassword });
});

// Trigger Boss Raid via websocket event
btnTriggerRaid.addEventListener('click', () => {
  const bossName = raidBossTargetInput.value.trim();
  socket.emit('trigger_raid', { password: adminPassword, bossName });
  raidBossTargetInput.value = '';
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
    messageText: text,
    password: adminPassword
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
function appendSimChat(author, text, isSystem = false, username = null) {
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  
  // Helper to wrap @mentions in clickable profile links
  const formatTextWithMentions = (msg) => {
    return msg.replace(/@([a-zA-Z0-9_-]+)/g, (match, mentionName) => {
      let dbUsername = mentionName.toLowerCase();
      if (!dbUsername.startsWith('twitch_') && !dbUsername.startsWith('youtube_')) {
        dbUsername = 'twitch_' + dbUsername;
      }
      const baseLink = currentConfigRef?.inventoryBaseUrl 
        ? `${currentConfigRef.inventoryBaseUrl.replace(/\/$/, '')}/trainer/${channelId}/${dbUsername}` 
        : `/trainer/${channelId}/${dbUsername}`;
      return `<a href="${baseLink}" target="_blank" style="color: #3b82f6; text-decoration: underline; font-weight: 600;">@${mentionName}</a>`;
    });
  };

  const formattedText = formatTextWithMentions(text);
  
  if (isSystem) {
    bubble.innerHTML = `<span class="system-reply">🤖 Bot: ${formattedText}</span>`;
  } else {
    let dbUsername = username;
    if (!dbUsername) {
      dbUsername = author.toLowerCase();
      if (!dbUsername.startsWith('twitch_') && !dbUsername.startsWith('youtube_')) {
        dbUsername = 'twitch_' + dbUsername;
      }
    }
    const baseLink = currentConfigRef?.inventoryBaseUrl 
      ? `${currentConfigRef.inventoryBaseUrl.replace(/\/$/, '')}/trainer/${channelId}/${dbUsername}` 
      : `/trainer/${channelId}/${dbUsername}`;
      
    bubble.innerHTML = `<a href="${baseLink}" target="_blank" class="author" style="color: var(--color-primary); text-decoration: underline; font-weight: bold; cursor: pointer;">${author}:</a> ${formattedText}`;
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

// Listen to global game announcements (daily claims, battle start/end results, evolutions)
socket.on('game_log', (log) => {
  appendSimChat('System', log.text, true);
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

socket.on('player_updated', (data) => {
  if (!data || !data.username) return;
  const invModal = document.getElementById('manage-inventory-modal');
  const targetUsernameEl = document.getElementById('inventory-target-username');
  if (invModal && invModal.style.display === 'flex' && targetUsernameEl && targetUsernameEl.value.toLowerCase() === data.username.toLowerCase()) {
    const activeBtn = Array.from(document.querySelectorAll('.btn-manage-inventory')).find(btn => btn.getAttribute('data-user').toLowerCase() === data.username.toLowerCase());
    if (activeBtn) activeBtn.click();
  }
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

// Tab click actions & persistence
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

function activateMainTab(tabName) {
  deactivateAllTabs();
  if (tabName === 'console' && btnTabConsole && mainConsoleView) {
    btnTabConsole.classList.add('active');
    btnTabConsole.style.background = 'var(--color-primary)';
    btnTabConsole.style.color = '#fff';
    mainConsoleView.classList.remove('hidden');
  } else if (tabName === 'settings' && btnTabSettings && mainSettingsView) {
    btnTabSettings.classList.add('active');
    btnTabSettings.style.background = 'var(--color-primary)';
    btnTabSettings.style.color = '#fff';
    mainSettingsView.classList.remove('hidden');
  } else if (tabName === 'viewers' && btnTabViewers && mainViewersView) {
    btnTabViewers.classList.add('active');
    btnTabViewers.style.background = 'var(--color-primary)';
    btnTabViewers.style.color = '#fff';
    mainViewersView.classList.remove('hidden');
    socket.emit('get_all_players', { password: adminPassword });
  }
  localStorage.setItem('activeMainTab', tabName);
}

if (btnTabConsole) {
  btnTabConsole.addEventListener('click', () => activateMainTab('console'));
}
if (btnTabSettings) {
  btnTabSettings.addEventListener('click', () => activateMainTab('settings'));
}
if (btnTabViewers) {
  btnTabViewers.addEventListener('click', () => activateMainTab('viewers'));
}

// Restore saved main tab on page load
const savedMainTab = localStorage.getItem('activeMainTab') || 'console';
activateMainTab(savedMainTab);

// Settings Inner Tab Navigation (Vertical sidebar tabs)
const configTabBtns = document.querySelectorAll('.config-tab-btn');
const configTabPanels = document.querySelectorAll('.config-tab-panel');

// Load active tab from localStorage if present
const savedTab = localStorage.getItem('activeConfigTab');
if (savedTab) {
  const activeBtn = Array.from(configTabBtns).find(btn => btn.getAttribute('data-panel') === savedTab);
  if (activeBtn) {
    configTabBtns.forEach(b => b.classList.remove('active'));
    configTabPanels.forEach(p => p.classList.remove('active'));
    activeBtn.classList.add('active');
    const targetPanel = document.getElementById(savedTab);
    if (targetPanel) {
      targetPanel.classList.add('active');
    }
  }
}

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
    
    // Save active tab to localStorage
    localStorage.setItem('activeConfigTab', targetPanelId);
  });
});

// Receive all players list updates
socket.on('all_players_data', (players) => {
  cachedPlayersList = players;
  renderViewersTable(players);
});

socket.on('admin_error', (msg) => {
  alert('Admin Error: ' + msg);
});

let selectedViewerUsernames = new Set();

// Render table entries
function renderViewersTable(players) {
  if (!viewerDbBody) return;
  
  // Reset selected list
  selectedViewerUsernames.clear();
  const checkAllHeader = document.getElementById('check-all-viewers');
  if (checkAllHeader) checkAllHeader.checked = false;
  updateBulkActionPanel();
  
  const term = viewerSearch ? viewerSearch.value.toLowerCase().trim() : '';
  
  if (!players || players.length === 0) {
    if (term) {
      viewerDbBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center" style="padding:40px; color: var(--text-muted);">
            <div style="font-size: 14px; margin-bottom: 12px;">No viewer named <strong style="color: #fff;">"${term}"</strong> found in your channel list.</div>
            <button id="btn-register-search-term" class="btn btn-preset" style="background: var(--color-primary); border: none; color: #fff; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-family: inherit; font-size: 13px;">
              ➕ Register "@${term}" to Channel List
            </button>
          </td>
        </tr>
      `;
      const btnRegister = document.getElementById('btn-register-search-term');
      if (btnRegister) {
        btnRegister.addEventListener('click', () => {
          socket.emit('admin_register_player', {
            password: adminPassword,
            playerUsername: term
          });
        });
      }
    } else {
      viewerDbBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center muted" style="padding:35px; color: var(--text-muted);">
            No viewers registered. Simulate active chats or search a username above to register them!
          </td>
        </tr>
      `;
    }
    return;
  }
  
  viewerDbBody.innerHTML = '';
  
  players.forEach(p => {
    const tr = document.createElement('tr');
    tr.id = `player-row-${p.username}`;
    
    const buddyName = p.buddyInstanceId ? 'Buddy Active' : 'None';
    
    tr.innerHTML = `
      <td style="text-align: center; vertical-align: middle;">
        <input type="checkbox" class="viewer-select-check" data-user="${p.username}" style="cursor: pointer; width: 15px; height: 15px; vertical-align: middle;">
      </td>
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
      <td style="vertical-align: middle; text-align: center; white-space: nowrap;">
        <button type="button" class="btn btn-preset btn-save-player" data-user="${p.username}" style="margin: 0; background:var(--color-primary); font-size:11px; padding:6px 12px; border:none; color:#fff; border-radius: 4px; cursor: pointer;">Save</button>
        <button type="button" class="btn btn-preset btn-rename-player" data-user="${p.username}" data-display="${p.displayName}" style="margin-left: 6px; background:#eab308; font-size:11px; padding:6px 12px; border:none; color:#000; border-radius: 4px; cursor: pointer; font-weight:600;">✏️ Rename</button>
        <button type="button" class="btn btn-preset btn-give-player" data-user="${p.username}" data-display="${p.displayName}" style="margin-left: 6px; background:#3b82f6; font-size:11px; padding:6px 12px; border:none; color:#fff; border-radius: 4px; cursor: pointer; font-weight:600;">🎁 Give Poke</button>
        <button type="button" class="btn btn-preset btn-delete-player" data-user="${p.username}" data-display="${p.displayName}" style="margin-left: 6px; background:#ef4444; font-size:11px; padding:6px 12px; border:none; color:#fff; border-radius: 4px; cursor: pointer; font-weight:600;">🗑️ Delete</button>
        <a href="/trainer/${channelId}/${p.username}${urlParams.get('backend') ? '?backend=' + encodeURIComponent(urlParams.get('backend')) : ''}" target="_blank" class="btn btn-preset" style="margin-left: 6px; background:#475569; font-size:11px; padding:6px 12px; border:none; color:#fff; text-decoration:none; display:inline-block; border-radius:4px; font-weight:600;">🔍 Profile</a>
        <a href="/admin/${channelId}/${p.username}${urlParams.get('backend') ? '?backend=' + encodeURIComponent(urlParams.get('backend')) : ''}" target="_blank" class="btn btn-preset" style="margin-left: 6px; background:#ef4444; font-size:11px; padding:6px 12px; border:none; color:#fff; text-decoration:none; display:inline-block; border-radius:4px; font-weight:600;">🛡️ Admin</a>
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

  // Bind Rename Buttons
  viewerDbBody.querySelectorAll('.btn-rename-player').forEach(btn => {
    btn.addEventListener('click', () => {
      const username = btn.getAttribute('data-user');
      const display = btn.getAttribute('data-display');
      
      document.getElementById('rename-old-username').value = username;
      document.getElementById('rename-new-username').value = username;
      document.getElementById('rename-new-display').value = display;
      
      const renameModal = document.getElementById('rename-player-modal');
      renameModal.style.display = 'flex';
      renameModal.classList.remove('hidden');
    });
  });

  // Bind Give Pokémon Buttons
  viewerDbBody.querySelectorAll('.btn-give-player').forEach(btn => {
    btn.addEventListener('click', () => {
      const username = btn.getAttribute('data-user');
      const display = btn.getAttribute('data-display');
      
      document.getElementById('give-target-username').value = username;
      document.getElementById('give-target-display').value = display;
      document.getElementById('give-pokemon-shiny').checked = false;
      
      const giveModal = document.getElementById('give-pokemon-modal');
      giveModal.style.display = 'flex';
      giveModal.classList.remove('hidden');
    });
  });

  // Bind Manage Inventory Buttons
  viewerDbBody.querySelectorAll('.btn-manage-inventory').forEach(btn => {
    btn.addEventListener('click', async () => {
      const username = btn.getAttribute('data-user');
      const display = btn.getAttribute('data-display');
      
      document.getElementById('inventory-target-username').value = username;
      document.getElementById('inventory-display-name').textContent = `@${display} (${username})`;
      
      const listContainer = document.getElementById('inventory-list-container');
      listContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">Loading player inventory...</div>';
      
      const invModal = document.getElementById('manage-inventory-modal');
      invModal.style.display = 'flex';
      invModal.classList.remove('hidden');
      
      try {
        const res = await fetch(`${BACKEND_URL}/api/trainer/${channelId}/${username}`);
        if (!res.ok) throw new Error('Failed to load profile');
        const user = await res.json();
        
        if (!user.inventory || user.inventory.length === 0) {
          listContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">This trainer has no Pokémon in their inventory.</div>';
          return;
        }
        
        // Helper functions for card rendering
        const getSafeSprite = (spriteUrl, fallbackUrl, pokemonId, isShiny) => {
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
          return 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/0.png';
        };

        const calculateCP = (baseStats, wins, isLegendary, fusionCount = 0) => {
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
        };

        // Render inventory cards
        listContainer.innerHTML = '';
        
        // Sort inventory: active/buddy first, shiny first, then wins
        const sortedInventory = [...user.inventory].sort((a, b) => {
          const isBuddyA = a.instanceId === user.activePokemonId ? 1 : 0;
          const isBuddyB = b.instanceId === user.activePokemonId ? 1 : 0;
          if (isBuddyA !== isBuddyB) return isBuddyB - isBuddyA;
          if (a.shiny !== b.shiny) return b.shiny - a.shiny;
          return (b.wins || 0) - (a.wins || 0);
        });

        sortedInventory.forEach(poke => {
          const isLegendary = poke.catchRate !== undefined && poke.catchRate <= 0.1;
          const isBuddy = poke.instanceId === user.activePokemonId;
          
          const card = document.createElement('div');
          card.className = 'dashboard-poke-card';
          if (isLegendary) card.classList.add('legendary');
          if (poke.shiny) card.classList.add('shiny');
          
          const buddyTag = isBuddy ? '<div class="buddy-badge">★ BUDDY</div>' : '';
          const cp = calculateCP(poke.baseStats, poke.wins, isLegendary, poke.fusionCount);
          const spriteUrl = getSafeSprite(poke.spriteUrl, poke.fallbackSpriteUrl, poke.pokemonId, poke.shiny);
          const typeBadges = poke.types ? poke.types.map(t => `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`).join(' ') : '';
          
          let hpBarHtml = '';
          if (currentConfigRef && currentConfigRef.battleType === 'persistent_hp') {
            const maxHp = poke.baseStats ? (poke.baseStats.hp || 50) : 50;
            const currentHp = poke.currentHp !== undefined && poke.currentHp !== null ? poke.currentHp : maxHp;
            const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
            
            let hpColor = '#10b981';
            if (hpPct < 30) hpColor = '#ef4444';
            else if (hpPct < 60) hpColor = '#f59e0b';
            
            let timerText = '';
            if (currentHp < maxHp && poke.lastBattleTime > 0) {
              const elapsedMinutes = (Date.now() - poke.lastBattleTime) / (1000 * 60);
              const healMinutes = currentConfigRef.fullHealTimeMinutes || 60;
              const ratePerMinute = maxHp / healMinutes;
              const minutesRemaining = Math.max(0, (maxHp - currentHp) / ratePerMinute - elapsedMinutes);
              if (minutesRemaining > 0) {
                timerText = `<div style="font-size: 10px; font-weight: bold; color: #fbbf24; margin-top: 2px;">⏳ Healing: ${Math.ceil(minutesRemaining)}m left</div>`;
              }
            }
            
            hpBarHtml = `
              <div style="margin: 4px 0; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 4px;">
                <div style="font-size: 10px; font-weight: bold; color: var(--text-muted); margin-bottom: 2px;">HP: ${currentHp}/${maxHp}</div>
                <div style="width: 80%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin: 0 auto; overflow: hidden;">
                  <div style="width: ${hpPct}%; height: 100%; background: ${hpColor}; border-radius: 2px;"></div>
                </div>
                ${timerText}
              </div>
            `;
          }

          card.innerHTML = `
            ${buddyTag}
            <div class="pokemon-cp">CP ${cp}</div>
            <img src="${spriteUrl}" alt="${poke.name}" class="pokemon-sprite">
            <div class="pokemon-name">${poke.shiny ? '✨ ' : ''}${poke.name}</div>
            <div class="pokemon-types">${typeBadges}</div>
            <div class="pokemon-stats-block">
              <div class="stat-row"><span>HP:</span> <strong>${poke.baseStats ? (poke.baseStats.hp || 50) : 50}</strong></div>
              <div class="stat-row"><span>ATK:</span> <strong>${poke.baseStats ? (poke.baseStats.attack || 50) : 50}</strong></div>
              <div class="stat-row"><span>DEF:</span> <strong>${poke.baseStats ? (poke.baseStats.defense || 50) : 50}</strong></div>
            </div>
            <div class="pokemon-wins">🏆 Wins: ${poke.wins || 0}</div>
            ${hpBarHtml}
            <button type="button" class="btn-release">🗑️ Release</button>
          `;
          
          // Bind Release Button click
          const releaseBtn = card.querySelector('.btn-release');
          releaseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to release ${poke.name} from @${display}'s inventory?`)) {
              socket.emit('admin_delete_pokemon', {
                password: adminPassword,
                playerUsername: username,
                instanceId: poke.instanceId
              });
              card.remove();
              if (listContainer.children.length === 0) {
                listContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px; width: 100%; grid-column: 1 / -1;">This trainer has no Pokémon in their inventory.</div>';
              }
            }
          });
          
          listContainer.appendChild(card);
        });
      } catch (err) {
        console.error(err);
        listContainer.innerHTML = `<div style="color: #ef4444; text-align: center; padding: 20px;">Error: ${err.message}</div>`;
      }
    });
  });

  // Bind Delete Player Buttons
  viewerDbBody.querySelectorAll('.btn-delete-player').forEach(btn => {
    btn.addEventListener('click', () => {
      const username = btn.getAttribute('data-user');
      const display = btn.getAttribute('data-display');
      
      document.getElementById('delete-target-username').value = username;
      document.getElementById('delete-display-name').textContent = `@${display} (${username})`;
      
      const deleteModal = document.getElementById('delete-player-modal');
      deleteModal.style.display = 'flex';
      deleteModal.classList.remove('hidden');
    });
  });

  // Bind checkbox change listeners
  viewerDbBody.querySelectorAll('.viewer-select-check').forEach(chk => {
    chk.addEventListener('change', () => {
      const user = chk.getAttribute('data-user');
      if (chk.checked) {
        selectedViewerUsernames.add(user);
      } else {
        selectedViewerUsernames.delete(user);
      }
      
      // Update check all header status if all or not all are checked
      const allChecks = viewerDbBody.querySelectorAll('.viewer-select-check');
      const checkedCount = selectedViewerUsernames.size;
      const checkAllHeader = document.getElementById('check-all-viewers');
      if (checkAllHeader) {
        checkAllHeader.checked = (checkedCount === allChecks.length && allChecks.length > 0);
      }
      updateBulkActionPanel();
    });
  });
}

// Bulk action panel controls
const bulkActionPanel = document.getElementById('bulk-action-panel');
const selectedCountSpan = document.getElementById('selected-count');
const bulkItemSelect = document.getElementById('bulk-item');
const bulkActionTypeSelect = document.getElementById('bulk-action-type');
const bulkAmountInput = document.getElementById('bulk-amount');
const btnApplyBulk = document.getElementById('btn-apply-bulk');
const checkAllHeader = document.getElementById('check-all-viewers');

function updateBulkActionPanel() {
  if (!bulkActionPanel || !selectedCountSpan) return;
  const count = selectedViewerUsernames.size;
  selectedCountSpan.textContent = count;
  if (count > 0) {
    bulkActionPanel.style.display = 'flex';
  } else {
    bulkActionPanel.style.display = 'none';
  }
}

if (checkAllHeader) {
  checkAllHeader.addEventListener('change', () => {
    const isChecked = checkAllHeader.checked;
    const allChecks = viewerDbBody.querySelectorAll('.viewer-select-check');
    
    allChecks.forEach(chk => {
      chk.checked = isChecked;
      const user = chk.getAttribute('data-user');
      if (isChecked) {
        selectedViewerUsernames.add(user);
      } else {
        selectedViewerUsernames.delete(user);
      }
    });
    
    updateBulkActionPanel();
  });
}

if (btnApplyBulk) {
  btnApplyBulk.addEventListener('click', () => {
    const count = selectedViewerUsernames.size;
    if (count === 0) return;
    
    const item = bulkItemSelect.value;
    const actionType = bulkActionTypeSelect.value;
    const amount = parseInt(bulkAmountInput.value);
    
    if (isNaN(amount)) {
      alert('Please enter a valid amount!');
      return;
    }
    
    const actionLabel = actionType === 'add' ? `give ${amount} of` : `set stock to ${amount} for`;
    const confirmMsg = `Are you sure you want to ${actionLabel} ${item} for the ${count} selected viewers?`;
    if (!confirm(confirmMsg)) return;
    
    socket.emit('admin_bulk_update_players', {
      password: adminPassword,
      usernames: Array.from(selectedViewerUsernames),
      item,
      actionType,
      amount
    });
  });
}

// Receive bulk update acknowledgements
socket.on('players_bulk_updated_ack', (data) => {
  if (data.success) {
    alert(`Successfully bulk updated ${data.count} players!`);
    selectedViewerUsernames.clear();
    const checkAllHeader = document.getElementById('check-all-viewers');
    if (checkAllHeader) checkAllHeader.checked = false;
    updateBulkActionPanel();
  } else {
    alert(`Bulk update failed: ${data.error}`);
  }
});

// Receive delete confirmation
socket.on('player_deleted_ack', (data) => {
  if (data.success) {
    alert(`Player @${data.username} profile and inventory deleted successfully!`);
  } else {
    alert(`Delete failed: ${data.error}`);
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

// Visual Layout Editor controller
let selectedWidget = null;

// Widget metadata registry — maps each draggable widget to its config keys
const WIDGET_REGISTRY = {
  'drag-spawn-card': {
    type: 'spawn', icon: '🦖', label: 'Wild Spawn Card',
    scaleKey: 'spawnCardScale', posKey: 'spawnCardPosition',
    topKey: 'spawnCardTop', bottomKey: 'spawnCardBottom', leftKey: 'spawnCardLeft', rightKey: 'spawnCardRight',
    scaleLabelId: 'lbl-scale-spawn',
    defaultTop: '50%', defaultLeft: '5%',
    hasVisibility: true, showKey: 'showSpawnAlert'
  },
  'drag-ticker': {
    type: 'ticker', icon: '👑', label: 'Ticker Bar',
    scaleKey: 'tickerScale', posKey: 'tickerPosition',
    topKey: 'tickerTop', bottomKey: 'tickerBottom', leftKey: 'tickerLeft', rightKey: 'tickerRight',
    scaleLabelId: 'lbl-scale-ticker',
    defaultTop: '5%', defaultLeft: '5%',
    hasVisibility: true, showKey: 'showLeaderboard'
  },
  'drag-feed': {
    type: 'feed', icon: '📰', label: 'Live Feed',
    scaleKey: 'feedScale', posKey: 'feedPosition',
    topKey: 'feedTop', bottomKey: 'feedBottom', leftKey: 'feedLeft', rightKey: 'feedRight',
    scaleLabelId: 'lbl-scale-feed',
    defaultTop: '5%', defaultLeft: '70%',
    hasVisibility: true, showKey: 'showLiveFeed'
  },
  'drag-battle': {
    type: 'battle', icon: '⚔️', label: 'Battle Arena',
    scaleKey: 'battleScale', posKey: 'battlePosition',
    topKey: 'battleTop', bottomKey: 'battleBottom', leftKey: 'battleLeft', rightKey: 'battleRight',
    scaleLabelId: 'lbl-scale-battle',
    defaultTop: '40%', defaultLeft: '40%',
    hasVisibility: true, showKey: 'showBattleArena'
  },
  'drag-raid': {
    type: 'raid', icon: '🦖', label: 'Raid Boss',
    scaleKey: 'raidScale', posKey: 'raidPosition',
    topKey: 'raidTop', bottomKey: 'raidBottom', leftKey: 'raidLeft', rightKey: 'raidRight',
    scaleLabelId: 'lbl-scale-raid',
    defaultTop: '35%', defaultLeft: '35%',
    hasVisibility: true, showKey: 'showRaid'
  },
  'drag-pack': {
    type: 'pack', icon: '🎒', label: 'Pack Opening',
    scaleKey: 'packScale', posKey: 'packPosition',
    topKey: 'packTop', bottomKey: 'packBottom', leftKey: 'packLeft', rightKey: 'packRight',
    scaleLabelId: 'lbl-scale-pack',
    defaultTop: '30%', defaultLeft: '35%',
    hasVisibility: true, showKey: 'showPackOpening'
  },
  'drag-levelup': {
    type: 'levelup', icon: '🏆', label: 'Level Up',
    scaleKey: 'levelUpScale', posKey: 'levelUpPosition',
    topKey: 'levelUpTop', bottomKey: 'levelUpBottom', leftKey: 'levelUpLeft', rightKey: 'levelUpRight',
    scaleLabelId: 'lbl-scale-levelup',
    defaultTop: '30%', defaultLeft: '35%',
    hasVisibility: true, showKey: 'showLevelUp'
  }
};

// Sidebar element refs
const sidebarNoSelection = document.getElementById('sidebar-no-selection');
const sidebarEditor = document.getElementById('sidebar-widget-editor');
const sidebarWidgetIcon = document.getElementById('sidebar-widget-icon');
const sidebarWidgetName = document.getElementById('sidebar-widget-name');
const sidebarVisibilityRow = document.getElementById('sidebar-visibility-row');
const sidebarShowToggle = document.getElementById('sidebar-show-toggle');
const sidebarPositionPreset = document.getElementById('sidebar-position-preset');
const sidebarCustomCoords = document.getElementById('sidebar-custom-coords');
const sidebarCoordLeft = document.getElementById('sidebar-coord-left');
const sidebarCoordRight = document.getElementById('sidebar-coord-right');
const sidebarCoordTop = document.getElementById('sidebar-coord-top');
const sidebarCoordBottom = document.getElementById('sidebar-coord-bottom');
const sidebarScaleSlider = document.getElementById('sidebar-scale-slider');
const sidebarScaleDisplay = document.getElementById('sidebar-scale-display');
const sidebarResetWidget = document.getElementById('sidebar-reset-widget');

// Internal cache for each widget's sidebar-editable state (persisted to config on save)
const widgetSidebarState = {};

function initWidgetSidebarState(config) {
  Object.keys(WIDGET_REGISTRY).forEach(wId => {
    const w = WIDGET_REGISTRY[wId];
    widgetSidebarState[wId] = {
      show: w.hasVisibility ? (config[w.showKey] !== false) : true,
      position: config[w.posKey] || 'center',
      left: config[w.leftKey] || '',
      right: config[w.rightKey] || '',
      top: config[w.topKey] || '',
      bottom: config[w.bottomKey] || '',
      scale: config[w.scaleKey] !== undefined ? Number(config[w.scaleKey]) : 1.0
    };
  });
}

function selectWidget(widgetId) {
  const w = WIDGET_REGISTRY[widgetId];
  if (!w) return;
  selectedWidget = { id: widgetId, ...w };

  // Highlight selected widget
  document.querySelectorAll('.draggable-widget').forEach(node => {
    node.classList.toggle('widget-selected', node.id === widgetId);
  });

  // Show editor
  if (sidebarNoSelection) sidebarNoSelection.style.display = 'none';
  if (sidebarEditor) sidebarEditor.style.display = 'block';

  // Populate sidebar from cached state
  const state = widgetSidebarState[widgetId];
  if (sidebarWidgetIcon) sidebarWidgetIcon.textContent = w.icon;
  if (sidebarWidgetName) sidebarWidgetName.textContent = w.label;

  // Visibility toggle (only for pack/levelup)
  if (sidebarVisibilityRow) {
    sidebarVisibilityRow.style.display = w.hasVisibility ? 'flex' : 'none';
  }
  if (sidebarShowToggle) sidebarShowToggle.checked = state.show;

  // Position preset
  if (sidebarPositionPreset) sidebarPositionPreset.value = state.position || 'center';

  // Custom coords visibility
  if (sidebarCustomCoords) {
    sidebarCustomCoords.style.display = state.position === 'custom' ? 'block' : 'none';
  }
  if (sidebarCoordLeft) sidebarCoordLeft.value = state.left || '';
  if (sidebarCoordRight) sidebarCoordRight.value = state.right || '';
  if (sidebarCoordTop) sidebarCoordTop.value = state.top || '';
  if (sidebarCoordBottom) sidebarCoordBottom.value = state.bottom || '';

  // Scale
  if (sidebarScaleSlider) sidebarScaleSlider.value = state.scale;
  if (sidebarScaleDisplay) sidebarScaleDisplay.textContent = `${state.scale.toFixed(2)}x`;

  // Keep dropdown selector in sync
  const selector = document.getElementById('layout-widget-selector');
  if (selector) {
    selector.value = widgetId;
  }
}

function positionWidgetOnCanvas(widgetId) {
  const el = document.getElementById(widgetId);
  const w = WIDGET_REGISTRY[widgetId];
  if (!el || !w) return;
  const state = widgetSidebarState[widgetId];

  const scale = state.scale;
  el.querySelector('.widget-scale-val').textContent = scale.toFixed(2);
  el.style.transform = `scale(${scale})`;

  let topVal = w.defaultTop;
  let leftVal = w.defaultLeft;

  const pos = state.position || '';
  if (pos === 'custom' || state.left || state.top) {
    if (state.left) leftVal = state.left;
    if (state.top) topVal = state.top;
  } else if (pos) {
    if (pos === 'top-left') { topVal = '5%'; leftVal = '5%'; }
    else if (pos === 'top-right') { topVal = '5%'; leftVal = '70%'; }
    else if (pos === 'bottom-left') { topVal = '75%'; leftVal = '5%'; }
    else if (pos === 'bottom-right') { topVal = '75%'; leftVal = '70%'; }
    else if (pos === 'center') { topVal = '40%'; leftVal = '40%'; }
    else if (pos === 'top') { topVal = '5%'; leftVal = '40%'; }
    else if (pos === 'bottom') { topVal = '75%'; leftVal = '40%'; }
  }

  el.style.top = topVal;
  el.style.left = leftVal;
  el.style.right = 'auto';
  el.style.bottom = 'auto';

  // Dim if not visible
  if (w.hasVisibility) {
    el.style.opacity = state.show ? '1' : '0.35';
  }
}

function setupLayoutEditor(config) {
  currentConfigRef = config;
  const container = document.getElementById('layout-screen-preview');
  if (!container) return;

  initWidgetSidebarState(config);

  const selector = document.getElementById('layout-widget-selector');
  if (selector) {
    selector.value = "";
    selector.onchange = () => {
      const val = selector.value;
      if (val) {
        selectWidget(val);
      }
    };
  }

  Object.keys(WIDGET_REGISTRY).forEach(wId => {
    const el = document.getElementById(wId);
    if (!el) return;

    positionWidgetOnCanvas(wId);

    // Click-to-select is disabled to prevent accidental selection/movement of overlapping items.
    // Selection must be done via the dropdown selector above.

    // Drag Logic
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    el.addEventListener('mousedown', (e) => {
      // Must be selected first via the dropdown before dragging is allowed
      if (!selectedWidget || selectedWidget.id !== wId) {
        return;
      }
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = el.offsetLeft;
      initialTop = el.offsetTop;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      const maxLeft = container.clientWidth - el.offsetWidth;
      const maxTop = container.clientHeight - el.offsetHeight;

      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));

      const pctLeft = ((newLeft / container.clientWidth) * 100).toFixed(1) + '%';
      const pctTop = ((newTop / container.clientHeight) * 100).toFixed(1) + '%';

      el.style.left = pctLeft;
      el.style.top = pctTop;

      // Update sidebar state
      const state = widgetSidebarState[wId];
      state.position = 'custom';
      state.left = pctLeft;
      state.top = pctTop;
      state.right = 'auto';
      state.bottom = 'auto';

      // Also sync the existing hidden form fields for spawn/ticker/feed/battle/raid
      syncWidgetToFormFields(wId, pctLeft, pctTop);

      // If this widget is selected in the sidebar, update sidebar fields too
      if (selectedWidget && selectedWidget.id === wId) {
        if (sidebarPositionPreset) sidebarPositionPreset.value = 'custom';
        if (sidebarCustomCoords) sidebarCustomCoords.style.display = 'block';
        if (sidebarCoordLeft) sidebarCoordLeft.value = pctLeft;
        if (sidebarCoordTop) sidebarCoordTop.value = pctTop;
        if (sidebarCoordRight) sidebarCoordRight.value = 'auto';
        if (sidebarCoordBottom) sidebarCoordBottom.value = 'auto';
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  });
}

// Sync drag position to existing hidden form inputs (for save compatibility)
function syncWidgetToFormFields(wId, pctLeft, pctTop) {
  if (wId === 'drag-spawn-card') {
    if (spawnCardPositionSelect) spawnCardPositionSelect.value = 'custom';
    if (spawnCardLeftInput) spawnCardLeftInput.value = pctLeft;
    if (spawnCardTopInput) spawnCardTopInput.value = pctTop;
    if (spawnCardRightInput) spawnCardRightInput.value = 'auto';
    if (spawnCardBottomInput) spawnCardBottomInput.value = 'auto';
  } else if (wId === 'drag-ticker') {
    if (tickerPositionSelect) tickerPositionSelect.value = 'custom';
    if (tickerLeftInput) tickerLeftInput.value = pctLeft;
    if (tickerTopInput) tickerTopInput.value = pctTop;
    if (tickerRightInput) tickerRightInput.value = 'auto';
    if (tickerBottomInput) tickerBottomInput.value = 'auto';
  } else if (wId === 'drag-feed') {
    if (feedPositionSelect) feedPositionSelect.value = 'custom';
    if (feedLeftInput) feedLeftInput.value = pctLeft;
    if (feedTopInput) feedTopInput.value = pctTop;
    if (feedRightInput) feedRightInput.value = 'auto';
    if (feedBottomInput) feedBottomInput.value = 'auto';
  } else if (wId === 'drag-battle') {
    if (battlePositionSelect) battlePositionSelect.value = 'custom';
    if (battleLeftInput) battleLeftInput.value = pctLeft;
    if (battleTopInput) battleTopInput.value = pctTop;
    if (battleRightInput) battleRightInput.value = 'auto';
    if (battleBottomInput) battleBottomInput.value = 'auto';
  } else if (wId === 'drag-raid') {
    if (raidPositionSelect) raidPositionSelect.value = 'custom';
    if (raidLeftInput) raidLeftInput.value = pctLeft;
    if (raidTopInput) raidTopInput.value = pctTop;
    if (raidRightInput) raidRightInput.value = 'auto';
    if (raidBottomInput) raidBottomInput.value = 'auto';
  }
}

// Sidebar control bindings
if (sidebarPositionPreset) {
  sidebarPositionPreset.addEventListener('change', () => {
    if (!selectedWidget) return;
    const state = widgetSidebarState[selectedWidget.id];
    state.position = sidebarPositionPreset.value;
    if (sidebarCustomCoords) {
      sidebarCustomCoords.style.display = state.position === 'custom' ? 'block' : 'none';
    }
    if (state.position !== 'custom') {
      state.left = ''; state.right = ''; state.top = ''; state.bottom = '';
    }
    positionWidgetOnCanvas(selectedWidget.id);
    syncWidgetToFormFields(selectedWidget.id, state.left, state.top);
    // Also update hidden form field for position
    if (selectedWidget.type === 'spawn' && spawnCardPositionSelect) spawnCardPositionSelect.value = state.position;
    if (selectedWidget.type === 'ticker' && tickerPositionSelect) tickerPositionSelect.value = state.position;
    if (selectedWidget.type === 'feed' && feedPositionSelect) feedPositionSelect.value = state.position;
    if (selectedWidget.type === 'battle' && battlePositionSelect) battlePositionSelect.value = state.position;
    if (selectedWidget.type === 'raid' && raidPositionSelect) raidPositionSelect.value = state.position;
  });
}

if (sidebarScaleSlider) {
  sidebarScaleSlider.addEventListener('input', () => {
    if (!selectedWidget) return;
    const val = parseFloat(sidebarScaleSlider.value);
    if (sidebarScaleDisplay) sidebarScaleDisplay.textContent = `${val.toFixed(2)}x`;

    const state = widgetSidebarState[selectedWidget.id];
    state.scale = val;

    const el = document.getElementById(selectedWidget.id);
    if (el) {
      el.style.transform = `scale(${val})`;
      el.querySelector('.widget-scale-val').textContent = val.toFixed(2);
    }

    // Sync to existing hidden form for spawn scale
    if (selectedWidget.type === 'spawn' && spawnCardScaleInput) spawnCardScaleInput.value = val;
  });
}

if (sidebarShowToggle) {
  sidebarShowToggle.addEventListener('change', () => {
    if (!selectedWidget) return;
    const state = widgetSidebarState[selectedWidget.id];
    state.show = sidebarShowToggle.checked;
    const el = document.getElementById(selectedWidget.id);
    if (el && WIDGET_REGISTRY[selectedWidget.id].hasVisibility) {
      el.style.opacity = state.show ? '1' : '0.35';
    }
  });
}

// Custom coord inputs
[sidebarCoordLeft, sidebarCoordRight, sidebarCoordTop, sidebarCoordBottom].forEach(input => {
  if (!input) return;
  input.addEventListener('input', () => {
    if (!selectedWidget) return;
    const state = widgetSidebarState[selectedWidget.id];
    state.left = sidebarCoordLeft.value.trim();
    state.right = sidebarCoordRight.value.trim();
    state.top = sidebarCoordTop.value.trim();
    state.bottom = sidebarCoordBottom.value.trim();
    positionWidgetOnCanvas(selectedWidget.id);
  });
});

// Reset individual widget
if (sidebarResetWidget) {
  sidebarResetWidget.addEventListener('click', () => {
    if (!selectedWidget) return;
    const w = WIDGET_REGISTRY[selectedWidget.id];
    const state = widgetSidebarState[selectedWidget.id];
    state.position = 'center';
    state.left = ''; state.right = ''; state.top = ''; state.bottom = '';
    state.scale = 1.0;
    if (w.hasVisibility) state.show = true;
    positionWidgetOnCanvas(selectedWidget.id);
    selectWidget(selectedWidget.id); // refresh sidebar
  });
}

// Reset Layout (all widgets)
const layoutResetBtn = document.getElementById('btn-reset-layout');
if (layoutResetBtn) {
  layoutResetBtn.addEventListener('click', () => {
    if (!confirm('Are you sure you want to reset all positions to presets?')) return;

    // Reset existing form fields
    if (spawnCardPositionSelect) spawnCardPositionSelect.value = 'bottom-left';
    if (tickerPositionSelect) tickerPositionSelect.value = 'top-left';
    if (feedPositionSelect) feedPositionSelect.value = 'top-right';
    if (battlePositionSelect) battlePositionSelect.value = 'center';
    if (raidPositionSelect) raidPositionSelect.value = 'center';

    [spawnCardLeftInput, spawnCardTopInput, spawnCardRightInput, spawnCardBottomInput,
     tickerLeftInput, tickerTopInput, tickerRightInput, tickerBottomInput,
     feedLeftInput, feedTopInput, feedRightInput, feedBottomInput,
     battleLeftInput, battleTopInput, battleRightInput, battleBottomInput,
     raidLeftInput, raidTopInput, raidRightInput, raidBottomInput].forEach(inp => {
       if (inp) inp.value = '';
     });

    [spawnCardPositionSelect, tickerPositionSelect, feedPositionSelect, battlePositionSelect, raidPositionSelect].forEach(select => {
      if (select) select.dispatchEvent(new Event('change'));
    });

    // Reset all widget sidebar states
    Object.keys(WIDGET_REGISTRY).forEach(wId => {
      widgetSidebarState[wId] = {
        show: true,
        position: 'center',
        left: '', right: '', top: '', bottom: '',
        scale: 1.0
      };
      positionWidgetOnCanvas(wId);
    });

    if (selectedWidget) selectWidget(selectedWidget.id);
  });
}




// ──────────────────────────────────────────────────────────────────────────
// MODALS CONTROLLERS (RENAME & GIVE POKEMON)
// ──────────────────────────────────────────────────────────────────────────
const renameModal = document.getElementById('rename-player-modal');
const btnCancelRename = document.getElementById('btn-cancel-rename');
const btnSubmitRename = document.getElementById('btn-submit-rename');

const giveModal = document.getElementById('give-pokemon-modal');
const btnCancelGive = document.getElementById('btn-cancel-give');
const btnSubmitGive = document.getElementById('btn-submit-give');

// Cancel buttons
if (btnCancelRename) {
  btnCancelRename.addEventListener('click', () => {
    renameModal.style.display = 'none';
    renameModal.classList.add('hidden');
  });
}
if (btnCancelGive) {
  btnCancelGive.addEventListener('click', () => {
    giveModal.style.display = 'none';
    giveModal.classList.add('hidden');
  });
}

// Submit Rename
if (btnSubmitRename) {
  btnSubmitRename.addEventListener('click', () => {
    const oldUsername = document.getElementById('rename-old-username').value;
    const newUsername = document.getElementById('rename-new-username').value.trim();
    const newDisplayName = document.getElementById('rename-new-display').value.trim();
    
    if (!newUsername || !newDisplayName) {
      alert('Please fill out all fields.');
      return;
    }
    
    socket.emit('rename_player', {
      password: adminPassword,
      oldUsername,
      newUsername,
      newDisplayName
    });
    
    renameModal.style.display = 'none';
    renameModal.classList.add('hidden');
  });
}

// Submit Give Pokémon
if (btnSubmitGive) {
  btnSubmitGive.addEventListener('click', () => {
    const targetUsername = document.getElementById('give-target-username').value;
    const targetDisplayName = document.getElementById('give-target-display').value;
    const pokemonId = parseInt(document.getElementById('give-pokemon-select').value, 10);
    const isShiny = document.getElementById('give-pokemon-shiny').checked;
    
    if (!targetUsername || isNaN(pokemonId)) {
      alert('Invalid selection.');
      return;
    }
    
    socket.emit('give_pokemon', {
      password: adminPassword,
      targetUsername,
      targetDisplayName,
      pokemonId,
      isShiny
    });
    
    giveModal.style.display = 'none';
    giveModal.classList.add('hidden');
  });
}

// Modals Delete Profile Controllers
const deleteModal = document.getElementById('delete-player-modal');
const btnCancelDelete = document.getElementById('btn-cancel-delete');
const btnSubmitDelete = document.getElementById('btn-submit-delete');

if (btnCancelDelete) {
  btnCancelDelete.addEventListener('click', () => {
    deleteModal.style.display = 'none';
    deleteModal.classList.add('hidden');
  });
}

if (btnSubmitDelete) {
  btnSubmitDelete.addEventListener('click', () => {
    const targetUsername = document.getElementById('delete-target-username').value;
    if (!targetUsername) return;
    
    socket.emit('admin_delete_player', {
      password: adminPassword,
      playerUsername: targetUsername
    });
    
    deleteModal.style.display = 'none';
    deleteModal.classList.add('hidden');
  });
}

// Fetch Pokémon List on load
let allPokemonList = [];
const givePokemonSelect = document.getElementById('give-pokemon-select');

async function loadPokemonList() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/pokemon-list`);
    if (res.ok) {
      allPokemonList = await res.json();
      if (givePokemonSelect) {
        givePokemonSelect.innerHTML = allPokemonList.map(p => 
          `<option value="${p.id}">${p.name} (#${p.id})</option>`
        ).join('');
      }
    }
  } catch (err) {
    console.error('Failed loading Pokémon list:', err.message);
  }
}
loadPokemonList();

// Modals Manage Inventory Controllers
const manageInventoryModal = document.getElementById('manage-inventory-modal');
const btnCloseInventory = document.getElementById('btn-close-inventory');
if (btnCloseInventory) {
  btnCloseInventory.addEventListener('click', () => {
    manageInventoryModal.style.display = 'none';
    manageInventoryModal.classList.add('hidden');
  });
}
