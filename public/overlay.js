// Parse streamer channel query from URL or default to simulator
const urlParams = new URLSearchParams(window.location.search);
const channelId = urlParams.get('channel') || 'simulator';

const backendParam = urlParams.get('backend');
const DEFAULT_RENDER_BACKEND = 'https://pokemon-overlay-backend-hfpf.onrender.com';
const BACKEND_URL = backendParam ? backendParam.replace(/\/$/, '') : (localStorage.getItem('backend_url') || (window.location.origin.includes('localhost') ? '' : DEFAULT_RENDER_BACKEND));
const socket = io(BACKEND_URL, {
  query: { channelId }
});

// DOM References
const wildSpawnContainer = document.getElementById('wild-spawn-container');
const wildPokemonSprite = document.getElementById('wild-pokemon-sprite');
const wildPokemonName = document.getElementById('wild-pokemon-name');
const wildPokemonTypes = document.getElementById('wild-pokemon-types');
const wildShinyTag = document.getElementById('wild-shiny-tag');
const wildPokemonStats = document.getElementById('wild-pokemon-stats');
const sparkleEmitter = document.getElementById('sparkle-emitter');

// Catch Anim references are not needed since elements are built dynamically on the wild card

// Battle Arena references
const battleOverlay = document.getElementById('battle-overlay');
const battleOverlayCard = document.getElementById('battle-overlay-card');
const weatherArena = document.getElementById('weather-arena');
const challengerFighter = document.getElementById('fighter-challenger');
const opponentFighter = document.getElementById('fighter-opponent');
const challengerHpTrail = document.getElementById('challenger-hp-trail');
const opponentHpTrail = document.getElementById('opponent-hp-trail');
const challengerTrainer = document.getElementById('challenger-trainer');
const challengerPoke = document.getElementById('challenger-poke');
const challengerSprite = document.getElementById('challenger-sprite');
const opponentTrainer = document.getElementById('opponent-trainer');
const opponentPoke = document.getElementById('opponent-poke');
const opponentSprite = document.getElementById('opponent-sprite');
const impactFlash = document.getElementById('impact-flash');
const battleStatusText = document.getElementById('battle-status-text');

// Evolution references
const evolutionOverlay = document.getElementById('evolution-overlay');
const evoSprite = document.getElementById('evo-sprite');
const evoDesc = document.getElementById('evo-desc');

// Game Feed
const gameFeed = document.getElementById('game-feed');

// Audio elements
const sfxSpawn = document.getElementById('sfx-spawn');
const sfxThrow = document.getElementById('sfx-throw');
const sfxCatchSuccess = document.getElementById('sfx-catch-success');
const sfxCatchFail = document.getElementById('sfx-catch-fail');
const sfxHit = document.getElementById('sfx-hit');
const sfxEvolve = document.getElementById('sfx-evolve');
const sfxShiny = document.getElementById('sfx-shiny');
const sfxLegendary = document.getElementById('sfx-legendary');

console.log("[Audio Debug] Initializing spawn sound effects verification...");
[
  { name: 'Spawn', el: sfxSpawn },
  { name: 'Throw', el: sfxThrow },
  { name: 'CatchSuccess', el: sfxCatchSuccess },
  { name: 'CatchFail', el: sfxCatchFail },
  { name: 'Hit', el: sfxHit },
  { name: 'Evolve', el: sfxEvolve },
  { name: 'Shiny', el: sfxShiny },
  { name: 'Legendary', el: sfxLegendary }
].forEach(s => {
  if (s.el) {
    s.el.addEventListener('error', (e) => {
      console.error(`[Audio Debug] Error loading ${s.name} sound. URL: ${s.el.src}`);
    });
  } else {
    console.warn(`[Audio Debug] Element for ${s.name} not found in DOM.`);
  }
});

// Helper to play sound with user-interaction bypass safety
function playSound(audioEl) {
  if (audioEl) {
    audioEl.currentTime = 0;
    audioEl.play().catch(err => {
      console.warn('Audio playback blocked by browser security policy. Streamers must click once on the overlay to enable sound.', err.message);
    });
  }
}

// Map Pokéball Image URLs based on item name
const BALL_SPRITES = {
  pokeball: 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/poke-ball.png',
  greatball: 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/great-ball.png',
  ultraball: 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/ultra-ball.png',
  masterball: 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/master-ball.png'
};

// Handle Image error fallback wrapper
function getSafeSprite(spriteUrl, fallbackUrl) {
  if (currentOverlayConfig && currentOverlayConfig.spriteFormat === 'static') {
    return fallbackUrl || spriteUrl;
  }
  return spriteUrl || fallbackUrl;
}

// Generate shiny sparkles particle effects
function triggerShinySparkles() {
  sparkleEmitter.innerHTML = '';
  const particleCount = 20;
  for (let i = 0; i < particleCount; i++) {
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle-particle';
    
    // Randomize particle layout in CSS
    const size = Math.random() * 8 + 4;
    sparkle.style.width = `${size}px`;
    sparkle.style.height = `${size}px`;
    sparkle.style.left = `${Math.random() * 100}%`;
    sparkle.style.top = `${Math.random() * 100}%`;
    sparkle.style.backgroundColor = ['#fde047', '#f472b6', '#a78bfa', '#fff'][Math.floor(Math.random() * 4)];
    sparkle.style.borderRadius = '50%';
    sparkle.style.position = 'absolute';
    sparkle.style.boxShadow = '0 0 10px #fff';
    sparkle.style.animation = `starBurstAnim ${Math.random() * 1.5 + 0.5}s ease-out forwards`;
    
    sparkleEmitter.appendChild(sparkle);
  }
}

let currentOverlayConfig = {};
let catchGuideInterval = null;

function updateCatchGuideDisplay() {
  const catchInstruction = wildSpawnContainer.querySelector('.catch-instruction');
  if (!catchInstruction) return;

  if (catchGuideInterval) {
    clearInterval(catchGuideInterval);
    catchGuideInterval = null;
  }

  if (currentOverlayConfig.showCardInstructions === false) {
    catchInstruction.classList.add('hidden');
  } else {
    catchInstruction.classList.remove('hidden');
    if (currentOverlayConfig.spawnCatchGuideMode === 'rotate') {
      const rotations = [
        'Type <span class="cmd-text">!catch</span> to use Pokéball!',
        'Type <span class="cmd-text">!catch great</span> for Great Ball!',
        'Type <span class="cmd-text">!catch ultra</span> for Ultra Ball!',
        'Type <span class="cmd-text">!catch master</span> for Master Ball!'
      ];
      let rotateIdx = 0;
      catchInstruction.innerHTML = rotations[rotateIdx];
      catchGuideInterval = setInterval(() => {
        rotateIdx = (rotateIdx + 1) % rotations.length;
        catchInstruction.innerHTML = rotations[rotateIdx];
      }, 4000);
    } else {
      let guideHtml = currentOverlayConfig.spawnCatchGuide || 'Type <span class="cmd-text">!catch</span> in chat!';
      if (!guideHtml.includes('<span') && (guideHtml.toLowerCase().includes('catch') || guideHtml.toLowerCase().includes('!catch'))) {
        guideHtml = guideHtml.replace(/(catch|!catch)/i, '<span class="cmd-text">$1</span>');
      }
      catchInstruction.innerHTML = guideHtml;
    }
  }
}

function applyConfig(config) {
  if (!config) return;
  currentOverlayConfig = config;

  // 1. Theme Configuration
  const container = document.getElementById('overlay-container');
  if (container) {
    container.classList.remove('theme-retro', 'theme-minimal');
    if (config.theme === 'retro') {
      container.classList.add('theme-retro');
    } else if (config.theme === 'minimal') {
      container.classList.add('theme-minimal');
    }
  }

  // 2. Sound Effects Volume (0 to 1)
  const volume = config.sfxVolume !== undefined ? config.sfxVolume / 100 : 0.5;
  [sfxSpawn, sfxThrow, sfxCatchSuccess, sfxCatchFail, sfxHit, sfxEvolve, sfxShiny, sfxLegendary].forEach(audio => {
    if (audio) audio.volume = volume;
  });

  // 3. Live Game Feed Visibility, Header Title & Positioning
  const feedContainer = document.getElementById('game-feed-container');
  if (feedContainer) {
    if (config.showLiveFeed === false) {
      feedContainer.classList.add('hidden');
    } else {
      feedContainer.classList.remove('hidden');
    }
    const feedHeader = feedContainer.querySelector('.feed-header');
    if (feedHeader) {
      feedHeader.textContent = config.liveFeedTitle || 'LIVE GAME FEED';
    }
    
    // Positioning
    const feedPos = config.feedPosition || 'top-right';
    feedContainer.style.top = '';
    feedContainer.style.bottom = '';
    feedContainer.style.left = '';
    feedContainer.style.right = '';
    
    // Scale and origin adjustment
    const feedScale = config.feedScale !== undefined ? config.feedScale : 1.0;
    feedContainer.style.transform = `scale(${feedScale})`;
    
    if (feedPos === 'custom') {
      feedContainer.style.top = config.feedTop || 'auto';
      feedContainer.style.bottom = config.feedBottom || 'auto';
      feedContainer.style.left = config.feedLeft || 'auto';
      feedContainer.style.right = config.feedRight || 'auto';
      feedContainer.style.transformOrigin = 'top left';
    } else {
      feedContainer.style.transformOrigin = feedPos.includes('left') ? 'top left' : 'top right';
      if (feedPos === 'top-right') {
        feedContainer.style.top = '15px';
        feedContainer.style.right = '15px';
      } else if (feedPos === 'top-left') {
        feedContainer.style.top = '15px';
        feedContainer.style.left = '15px';
      } else if (feedPos === 'bottom-right') {
        feedContainer.style.bottom = '15px';
        feedContainer.style.right = '15px';
      } else if (feedPos === 'bottom-left') {
        feedContainer.style.bottom = '15px';
        feedContainer.style.left = '15px';
      }
    }
  }

  // 3.5. Leaderboard Ticker Positioning
  const tickerBar = document.getElementById('leaderboard-ticker-bar');
  if (tickerBar) {
    if (config.showLeaderboard === false) {
      tickerBar.classList.add('ticker-hidden');
    } else {
      tickerBar.classList.remove('ticker-hidden');
      
      const tickerPos = config.tickerPosition || 'top-left';
      tickerBar.style.top = '';
      tickerBar.style.bottom = '';
      tickerBar.style.left = '';
      tickerBar.style.right = '';
      
      const tickerScale = config.tickerScale !== undefined ? config.tickerScale : 1.0;
      tickerBar.style.transform = `scale(${tickerScale})`;
      
      if (tickerPos === 'custom') {
        tickerBar.style.top = config.tickerTop || 'auto';
        tickerBar.style.bottom = config.tickerBottom || 'auto';
        tickerBar.style.left = config.tickerLeft || 'auto';
        tickerBar.style.right = config.tickerRight || 'auto';
        tickerBar.style.transformOrigin = 'top left';
      } else {
        tickerBar.style.transformOrigin = tickerPos.includes('left') ? 'top left' : 'top right';
        if (tickerPos === 'top-left') {
          tickerBar.style.top = '15px';
          tickerBar.style.left = '15px';
        } else if (tickerPos === 'top-right') {
          tickerBar.style.top = '15px';
          tickerBar.style.right = '15px';
        } else if (tickerPos === 'bottom-left') {
          tickerBar.style.bottom = '15px';
          tickerBar.style.left = '15px';
        } else if (tickerPos === 'bottom-right') {
          tickerBar.style.bottom = '15px';
          tickerBar.style.right = '15px';
        }
      }
    }
  }

  // 3.8. Battle Arena Positioning Setup
  if (battleOverlay) {
    const battlePos = config.battlePosition || 'center';
    battleOverlay.style.top = '';
    battleOverlay.style.bottom = '';
    battleOverlay.style.left = '';
    battleOverlay.style.right = '';
    battleOverlay.style.transform = '';
    
    const battleScale = config.battleScale !== undefined ? config.battleScale : 1.0;
    
    if (battlePos === 'custom') {
      battleOverlay.style.top = config.battleTop || 'auto';
      battleOverlay.style.bottom = config.battleBottom || 'auto';
      battleOverlay.style.left = config.battleLeft || 'auto';
      battleOverlay.style.right = config.battleRight || 'auto';
      
      battleOverlay.style.transform = `scale(${battleScale})`;
    } else {
      if (battlePos === 'center') {
        battleOverlay.style.top = '50%';
        battleOverlay.style.left = '50%';
        battleOverlay.style.transform = `translate(-50%, -50%) scale(${battleScale})`;
      } else if (battlePos === 'top') {
        battleOverlay.style.top = '15px';
        battleOverlay.style.left = '50%';
        battleOverlay.style.transform = `translateX(-50%) scale(${battleScale})`;
      } else if (battlePos === 'bottom') {
        battleOverlay.style.bottom = '15px';
        battleOverlay.style.left = '50%';
        battleOverlay.style.transform = `translateX(-50%) scale(${battleScale})`;
      }
    }
  }

  // 3.9. Raid Boss Positioning Setup
  const raidOverlay = document.getElementById('raid-overlay');
  if (raidOverlay) {
    if (config.showRaid === false) {
      raidOverlay.classList.add('hidden');
    }
    const raidPos = config.raidPosition || 'center';
    raidOverlay.style.top = '';
    raidOverlay.style.bottom = '';
    raidOverlay.style.left = '';
    raidOverlay.style.right = '';
    raidOverlay.style.transform = '';
    
    const raidScale = config.raidScale !== undefined ? config.raidScale : 1.0;
    
    if (raidPos === 'custom') {
      raidOverlay.style.top = config.raidTop || '35%';
      raidOverlay.style.bottom = config.raidBottom || 'auto';
      raidOverlay.style.left = config.raidLeft || '35%';
      raidOverlay.style.right = config.raidRight || 'auto';
      
      raidOverlay.style.transform = `scale(${raidScale})`;
    } else {
      if (raidPos === 'center') {
        raidOverlay.style.top = '50%';
        raidOverlay.style.left = '50%';
        raidOverlay.style.transform = `translate(-50%, -50%) scale(${raidScale})`;
      } else if (raidPos === 'top') {
        raidOverlay.style.top = '15px';
        raidOverlay.style.left = '50%';
        raidOverlay.style.transform = `translateX(-50%) scale(${raidScale})`;
      } else if (raidPos === 'bottom') {
        raidOverlay.style.bottom = '15px';
        raidOverlay.style.left = '50%';
        raidOverlay.style.transform = `translateX(-50%) scale(${raidScale})`;
      }
    }
  }

  // 4. Wild Spawn Visibility, Title & Catch Instruction Guide
  if (wildSpawnContainer) {
    if (config.showSpawnAlert === false) {
      wildSpawnContainer.style.opacity = '0';
      wildSpawnContainer.style.pointerEvents = 'none';
    } else {
      wildSpawnContainer.style.opacity = '1';
      wildSpawnContainer.style.pointerEvents = 'auto';
    }
    
    const spawnHeaderElement = wildSpawnContainer.querySelector('.wild-tag');
    if (spawnHeaderElement) {
      spawnHeaderElement.textContent = config.spawnAlertTitle || 'WILD SPAWN';
    }
    
    // Positioning
    const positionClasses = ['pos-bottom-left', 'pos-bottom-right', 'pos-top-left', 'pos-top-right', 'pos-center'];
    positionClasses.forEach(cls => wildSpawnContainer.classList.remove(cls));
    const pos = config.spawnCardPosition || 'bottom-left';
    
    // Scaling
    const scale = config.spawnCardScale !== undefined ? config.spawnCardScale : 1.0;
    
    if (pos === 'custom') {
      wildSpawnContainer.style.top = config.spawnCardTop || 'auto';
      wildSpawnContainer.style.bottom = config.spawnCardBottom || 'auto';
      wildSpawnContainer.style.left = config.spawnCardLeft || 'auto';
      wildSpawnContainer.style.right = config.spawnCardRight || 'auto';
      wildSpawnContainer.style.transform = `scale(${scale})`;
    } else {
      wildSpawnContainer.style.top = '';
      wildSpawnContainer.style.bottom = '';
      wildSpawnContainer.style.left = '';
      wildSpawnContainer.style.right = '';
      wildSpawnContainer.classList.add(`pos-${pos}`);
      if (pos === 'center') {
        wildSpawnContainer.style.transform = `translate(-50%, -50%) scale(${scale})`;
      } else {
        wildSpawnContainer.style.transform = `scale(${scale})`;
      }
    }

    // Sprite Visibility
    const spriteContainer = wildSpawnContainer.querySelector('.sprite-container');
    if (spriteContainer) {
      if (config.showCardSprite === false) {
        spriteContainer.classList.add('hidden');
      } else {
        spriteContainer.classList.remove('hidden');
      }
    }

    // Types Visibility
    if (wildPokemonTypes) {
      if (config.showCardTypes === false || config.hideSpawnDetails === true) {
        wildPokemonTypes.classList.add('hidden');
      } else {
        wildPokemonTypes.classList.remove('hidden');
      }
    }

    // Simplified Mode / Hide Spawn Details
    const statsEl = document.getElementById('wild-pokemon-stats');
    const ratesEl = document.getElementById('wild-catch-rates');
    if (config.hideSpawnDetails === true) {
      if (statsEl) statsEl.classList.add('hidden');
      if (ratesEl) ratesEl.classList.add('hidden');
    } else {
      if (statsEl) statsEl.classList.remove('hidden');
      if (ratesEl) ratesEl.classList.remove('hidden');
    }

    // Catch Instruction Guide & Visibility
    updateCatchGuideDisplay();
  }

  // 5. Accent Color CSS Variable Override
  if (config.primaryColor) {
    document.documentElement.style.setProperty('--color-primary', config.primaryColor);
  }

  // 6. Custom CSS Overrides Injection
  // 6. Custom CSS Overrides Injection
  let styleTag = document.getElementById('custom-theme-css');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'custom-theme-css';
    document.head.appendChild(styleTag);
  }
  
  const championshipThemeColor = config.championshipThemeColor || '#fbbf24';
  const dynamicStyles = `
    :root {
      --championship-theme-color: ${championshipThemeColor};
    }
    .tournament-header {
      color: var(--championship-theme-color) !important;
      text-shadow: 0 0 10px var(--championship-theme-color) !important;
    }
    .finals-match-node .bracket-matchup {
      border-color: var(--championship-theme-color) !important;
      box-shadow: 0 0 20px var(--championship-theme-color) !important;
    }
  `;
  styleTag.textContent = (config.customCss || '') + dynamicStyles;

  // 7. Championship header title text override
  const tournamentHeader = document.querySelector('.tournament-header');
  if (tournamentHeader) {
    const headerText = config.championshipHeader || 'STREAM CHAMPIONSHIP';
    tournamentHeader.innerHTML = `🏆 ${headerText} 🏆`;
  }

  // Helper helper to position overlay components
  function positionInnerWidget(el, pos, scale, left, right, top, bottom, defaultTop, defaultLeft) {
    if (!el) return;
    el.style.position = 'absolute';
    el.style.top = '';
    el.style.bottom = '';
    el.style.left = '';
    el.style.right = '';
    el.style.transform = '';
    el.style.transformOrigin = 'center center';
    
    const s = scale !== undefined ? scale : 1.0;
    
    if (pos === 'custom') {
      el.style.top = top || defaultTop;
      el.style.bottom = bottom || 'auto';
      el.style.left = left || defaultLeft;
      el.style.right = right || 'auto';
      el.style.transform = `scale(${s})`;
    } else {
      if (pos === 'center' || !pos) {
        el.style.top = '50%';
        el.style.left = '50%';
        el.style.transform = `translate(-50%, -50%) scale(${s})`;
      } else if (pos === 'top') {
        el.style.top = '15px';
        el.style.left = '50%';
        el.style.transform = `translateX(-50%) scale(${s})`;
      } else if (pos === 'bottom') {
        el.style.bottom = '15px';
        el.style.left = '50%';
        el.style.transform = `translateX(-50%) scale(${s})`;
      } else if (pos === 'top-left') {
        el.style.top = '15px';
        el.style.left = '15px';
        el.style.transform = `scale(${s})`;
        el.style.transformOrigin = 'top left';
      } else if (pos === 'top-right') {
        el.style.top = '15px';
        el.style.right = '15px';
        el.style.transform = `scale(${s})`;
        el.style.transformOrigin = 'top right';
      } else if (pos === 'bottom-left') {
        el.style.bottom = '15px';
        el.style.left = '15px';
        el.style.transform = `scale(${s})`;
        el.style.transformOrigin = 'bottom left';
      } else if (pos === 'bottom-right') {
        el.style.bottom = '15px';
        el.style.right = '15px';
        el.style.transform = `scale(${s})`;
        el.style.transformOrigin = 'bottom right';
      }
    }
  }

  // 7. Booster Pack Overlay Position/Scale
  const gachaOverlayElement = document.querySelector('#gacha-overlay .gacha-pack-wrapper');
  if (gachaOverlayElement) {
    positionInnerWidget(
      gachaOverlayElement,
      config.packPosition,
      config.packScale,
      config.packLeft,
      config.packRight,
      config.packTop,
      config.packBottom,
      '30%',
      '35%'
    );
  }

  // 8. Level Up Overlay Position/Scale
  const levelupCardElement = document.querySelector('#levelup-overlay .lvl-card');
  if (levelupCardElement) {
    positionInnerWidget(
      levelupCardElement,
      config.levelUpPosition,
      config.levelUpScale,
      config.levelUpLeft,
      config.levelUpRight,
      config.levelUpTop,
      config.levelUpBottom,
      '30%',
      '35%'
    );
  }

  // 8.5 Evolution Card Scale
  const evoCardScaleWrapper = document.getElementById('evo-card-scale-wrapper');
  if (evoCardScaleWrapper) {
    const esc = config.evolutionScale !== undefined ? config.evolutionScale : 1.0;
    evoCardScaleWrapper.style.transform = `scale(${esc})`;
  }

  // 9. Championship Bracket & Arena Layout Positioning / Scaling
  const champBracketView = document.getElementById('championship-bracket-view');
  if (champBracketView) {
    champBracketView.style.width = '1920px';
    champBracketView.style.height = '1080px';
    positionInnerWidget(
      champBracketView,
      config.championshipBracketPosition || 'center',
      config.championshipBracketScale !== undefined ? config.championshipBracketScale : 1.0,
      config.championshipBracketLeft,
      config.championshipBracketRight,
      config.championshipBracketTop,
      config.championshipBracketBottom,
      '0px',
      '0px'
    );
  }

  const champBattleArena = document.getElementById('championship-battle-arena');
  if (champBattleArena) {
    champBattleArena.style.width = '1920px';
    champBattleArena.style.height = '1080px';
    positionInnerWidget(
      champBattleArena,
      config.championshipArenaPosition || 'center',
      config.championshipArenaScale !== undefined ? config.championshipArenaScale : 1.0,
      config.championshipArenaLeft,
      config.championshipArenaRight,
      config.championshipArenaTop,
      config.championshipArenaBottom,
      '0px',
      '0px'
    );
  }
}

// Render Pokemon Type Badges
function renderTypes(typesContainer, types) {
  typesContainer.innerHTML = '';
  types.forEach(t => {
    const badge = document.createElement('span');
    badge.className = `type-badge type-${t}`;
    badge.textContent = t;
    typesContainer.appendChild(badge);
  });
}

function calculateCP(baseStats, wins, isLegendary, fusionCount = 0, shiny = false) {
  const hp = baseStats ? (baseStats.hp || 50) : 50;
  const attack = baseStats ? (baseStats.attack || 50) : 50;
  const defense = baseStats ? (baseStats.defense || 50) : 50;
  const speed = baseStats ? (baseStats.speed || 50) : 50;
  
  let baseCP = (hp + attack * 1.5 + defense + speed) * 3.5;
  if (isLegendary) {
    baseCP *= 1.8;
  }
  let finalCP = baseCP * (1 + (wins || 0) * 0.02 + (fusionCount || 0) * 0.05);
  if (shiny) {
    finalCP *= 1.2;
  }
  return Math.max(10, Math.floor(finalCP));
}

// Render dynamic CP, Weight, and Height stats in Pokemon GO style
function updateWildPokemonStats(poke) {
  if (!wildPokemonStats) return;
  
  if (currentOverlayConfig && currentOverlayConfig.hideSpawnDetails === true) {
    wildPokemonStats.classList.add('hidden');
    return;
  }
  
  const isLegendary = poke.catchRate <= 0.1;
  const cp = calculateCP(poke.stats, 0, isLegendary);
  
  const statsSum = poke.statsSum || 300;
  const seed = (poke.id || 1) * 31;
  const mockWeight = ((statsSum * 0.12) + (seed % 15) + 5).toFixed(1);
  const mockHeight = ((statsSum * 0.0028) + (seed % 8) * 0.1 + 0.3).toFixed(2);
  
  wildPokemonStats.innerHTML = `<div style="font-weight: bold; margin-bottom: 2px;">CP ${cp}</div><div style="font-size: 11px; opacity: 0.85;">${mockWeight}kg / ${mockHeight}m</div>`;
  wildPokemonStats.classList.remove('hidden');
}

// Append Game logs to scroll list
socket.on('game_log', (log) => {
  const entry = document.createElement('div');
  entry.className = `feed-entry ${log.type}`;
  entry.textContent = log.text;
  
  gameFeed.prepend(entry);
  
  // Prune list to show only last 6 logs
  const currentEntries = gameFeed.querySelectorAll('.feed-entry');
  if (currentEntries.length > 6) {
    currentEntries[currentEntries.length - 1].remove();
  }
});

// Setup Init State
socket.on('init_state', (state) => {
  if (state.config) {
    applyConfig(state.config);
  }

  if (state.activeWildPokemon) {
    const poke = state.activeWildPokemon;
    wildPokemonSprite.src = getSafeSprite(poke.spriteUrl, poke.fallbackSpriteUrl);
    wildPokemonName.textContent = poke.name;
    renderTypes(wildPokemonTypes, poke.types);
    updateWildPokemonStats(poke);
    
    // Check if Legendary (catchRate <= 0.1)
    const cardWrapper = wildSpawnContainer.querySelector('.pokemon-card-wrapper');
    if (cardWrapper) {
      if (poke.catchRate <= 0.1) {
        cardWrapper.classList.add('legendary-theme');
      } else {
        cardWrapper.classList.remove('legendary-theme');
      }
    }

    if (poke.isShiny) {
      wildShinyTag.classList.remove('hidden');
      triggerShinySparkles();
    } else {
      wildShinyTag.classList.add('hidden');
    }
    
    // Check if spawn alerts are enabled
    if (!state.config || state.config.showSpawnAlert !== false) {
      wildSpawnContainer.classList.remove('hidden');
    }
  }

  if (state.activeRaidBoss) {
    const boss = state.activeRaidBoss;
    const raidOverlay = document.getElementById('raid-overlay');
    const sprite = document.getElementById('raid-boss-sprite');
    const name = document.getElementById('raid-boss-name');
    const hpFill = document.getElementById('raid-hp-fill');
    const hpText = document.getElementById('raid-hp-text');
    const list = document.getElementById('raid-contrib-list');
    const card = document.querySelector('.raid-card');
    
    if (raidOverlay && sprite && name && hpFill && hpText && list) {
      document.body.classList.add('raid-mode-active');
      sprite.src = getSafeSprite(boss.spriteUrl, boss.fallbackSpriteUrl);
      name.textContent = boss.name;
      const percent = (boss.currentHp / boss.maxHp) * 100;
      hpFill.style.width = `${percent}%`;
      hpText.textContent = `${boss.currentHp} / ${boss.maxHp} HP`;
      
      if (card) {
        card.classList.add('gigantamax-active');
      }
      
      // Calculate remaining time for countdown timer
      if (raidCountdownInterval) {
        clearInterval(raidCountdownInterval);
        raidCountdownInterval = null;
      }
      
      const elapsedSeconds = Math.round((Date.now() - (boss.startTime || Date.now())) / 1000);
      const totalDurationSeconds = (boss.durationMs || (5 * 60 * 1000)) / 1000;
      let timeLeft = Math.max(0, Math.round(totalDurationSeconds - elapsedSeconds));
      
      const timeTicker = document.querySelector('.boss-time-ticker');
      if (timeTicker) {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        const formattedSecs = secs < 10 ? `0${secs}` : secs;
        timeTicker.textContent = `⏳ ${mins}:${formattedSecs}`;
      }
      
      if (timeLeft > 0) {
        raidCountdownInterval = setInterval(() => {
          timeLeft--;
          if (timeLeft <= 0) {
            clearInterval(raidCountdownInterval);
            raidCountdownInterval = null;
            if (timeTicker) timeTicker.textContent = `⏳ 0:00`;
            return;
          }
          const mins = Math.floor(timeLeft / 60);
          const secs = timeLeft % 60;
          const formattedSecs = secs < 10 ? `0${secs}` : secs;
          if (timeTicker) {
            timeTicker.textContent = `⏳ ${mins}:${formattedSecs}`;
          }
        }, 1000);
      }
      
      raidOverlay.classList.remove('hidden');
    }
  }

  if (state.leaderboard) {
    updateMarqueeTicker(state.leaderboard);
  }
});

// Wild Spawn Event
socket.on('pokemon_spawned', (poke) => {
  if (poke.isShiny) {
    playSound(sfxShiny);
  } else if (poke.catchRate <= 0.1) {
    playSound(sfxLegendary);
  } else {
    playSound(sfxSpawn);
  }
  
  wildPokemonSprite.src = getSafeSprite(poke.spriteUrl, poke.fallbackSpriteUrl);
  wildPokemonName.textContent = poke.name;
  renderTypes(wildPokemonTypes, poke.types);
  if (currentOverlayConfig && currentOverlayConfig.hideSpawnDetails === true) {
    if (wildPokemonTypes) wildPokemonTypes.classList.add('hidden');
  } else if (currentOverlayConfig && currentOverlayConfig.showCardTypes !== false) {
    if (wildPokemonTypes) wildPokemonTypes.classList.remove('hidden');
  }
  updateWildPokemonStats(poke);

  const ratesEl = document.getElementById('wild-catch-rates');
  if (ratesEl) {
    if (currentOverlayConfig && currentOverlayConfig.hideSpawnDetails === true) {
      ratesEl.classList.add('hidden');
    } else if (poke.ballRates) {
      ratesEl.classList.remove('hidden');
      ratesEl.innerHTML = `
        <span>🔴<strong>${poke.ballRates.pokeball}%</strong></span>
        <span>🔵<strong>${poke.ballRates.greatball}%</strong></span>
        <span>🟡<strong>${poke.ballRates.ultraball}%</strong></span>
        <span>🟣<strong>${poke.ballRates.masterball}%</strong></span>
      `;
    }
  }

  // Check if Legendary (catchRate <= 0.1)
  const cardWrapper = wildSpawnContainer.querySelector('.pokemon-card-wrapper');
  if (cardWrapper) {
    if (poke.catchRate <= 0.1) {
      cardWrapper.classList.add('legendary-theme');
    } else {
      cardWrapper.classList.remove('legendary-theme');
    }
  }
  
  if (poke.isShiny) {
    wildShinyTag.classList.remove('hidden');
    triggerShinySparkles();
    // Shiny sparkle loop
    const shinyTimer = setInterval(() => {
      if (!wildSpawnContainer.classList.contains('hidden') && poke.isShiny) {
        triggerShinySparkles();
      } else {
        clearInterval(shinyTimer);
      }
    }, 3000);
  } else {
    wildShinyTag.classList.add('hidden');
  }

  // Update catch guide dynamic content
  updateCatchGuideDisplay();

  // Remove and trigger card spawn slide in
  wildSpawnContainer.classList.add('hidden');
  // force reflow
  void wildSpawnContainer.offsetWidth;
  wildSpawnContainer.classList.remove('hidden');
});

// Wild Despawn Event
socket.on('pokemon_despawned', () => {
  wildSpawnContainer.classList.add('hidden');
});

// Catch Success Animation Sequence
socket.on('catch_success', (data) => {
  runDynamicCatchAnimation(true, data);
});

// Catch Fail Animation Sequence
socket.on('catch_fail', (data) => {
  runDynamicCatchAnimation(false, data);
});

// Helper for dynamic Pokéball throw and catch on the wild card/sprite
function runDynamicCatchAnimation(isSuccess, data) {
  const ballImage = BALL_SPRITES[data.ballType] || BALL_SPRITES.pokeball;
  
  // Find target position on screen (targeting the active spawn card)
  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2 - 100;
  let useFallback = true;
  
  if (wildSpawnContainer && !wildSpawnContainer.classList.contains('hidden')) {
    const rect = wildSpawnContainer.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      targetX = rect.left + rect.width / 2;
      targetY = rect.top + rect.height / 2;
      useFallback = false;
    }
  }

  // 1. Create a dynamic flying ball (increased to 75px for higher visibility)
  const ball = document.createElement('img');
  ball.src = ballImage;
  ball.style.position = 'fixed';
  ball.style.width = '75px';
  ball.style.height = '75px';
  ball.style.zIndex = '9999';
  ball.style.pointerEvents = 'none';
  document.body.appendChild(ball);

  // Play throw sound
  playSound(sfxThrow);

  // Animate the throw from bottom-center of the screen
  const startX = window.innerWidth / 2;
  const startY = window.innerHeight;

  const throwAnim = ball.animate([
    { left: `${startX - 37}px`, top: `${startY}px`, transform: 'scale(1) rotate(0deg)' },
    { left: `${targetX - 37}px`, top: `${targetY - 37}px`, transform: 'scale(1.3) rotate(720deg)' }
  ], {
    duration: 800,
    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  });

  throwAnim.onfinish = () => {
    // Remove flying ball
    ball.remove();

    // Shrink the wild pokemon sprite to simulate entering the ball
    if (!useFallback && wildPokemonSprite) {
      wildPokemonSprite.style.transition = 'transform 0.2s ease-in, opacity 0.2s ease-in';
      wildPokemonSprite.style.transform = 'scale(0)';
      wildPokemonSprite.style.opacity = '0';
    }

    // Create landing ball at target location (increased to 68px for higher visibility)
    const landBall = document.createElement('img');
    landBall.src = ballImage;
    landBall.className = 'shaking'; // Uses existing CSS shaking animation!
    landBall.style.position = 'fixed';
    landBall.style.width = '68px';
    landBall.style.height = '68px';
    landBall.style.left = `${targetX - 34}px`;
    landBall.style.top = `${targetY - 34}px`;
    landBall.style.zIndex = '9999';
    landBall.style.pointerEvents = 'none';
    document.body.appendChild(landBall);

    // Shake sound interval
    let shakeCount = 0;
    const shakeSoundTimer = setInterval(() => {
      playSound(sfxSpawn);
      shakeCount++;
      if (shakeCount >= (isSuccess ? 3 : 2)) {
        clearInterval(shakeSoundTimer);
      }
    }, 600);

    setTimeout(() => {
      // End of shakes
      clearInterval(shakeSoundTimer);
      landBall.classList.remove('shaking');

      if (isSuccess) {
        // Success: burst stars, remove ball, hide wild card
        playSound(sfxCatchSuccess);
        
        // Show star burst
        const burst = document.createElement('div');
        burst.className = 'star-burst star-burst-active';
        burst.style.position = 'fixed';
        burst.style.left = `${targetX - 75}px`;
        burst.style.top = `${targetY - 75}px`;
        burst.style.zIndex = '9998';
        document.body.appendChild(burst);

        landBall.remove();

        setTimeout(() => {
          burst.remove();
          // Hide wild spawn container
          wildSpawnContainer.classList.add('hidden');
          // Reset wild pokemon sprite styles for next spawn
          if (wildPokemonSprite) {
            wildPokemonSprite.style.transition = '';
            wildPokemonSprite.style.transform = '';
            wildPokemonSprite.style.opacity = '';
          }
        }, 1500);

      } else {
        // Fail: play break sound, pop pokemon back out, remove ball
        playSound(sfxCatchFail);
        landBall.remove();

        if (wildPokemonSprite) {
          wildPokemonSprite.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s';
          wildPokemonSprite.style.transform = 'scale(1)';
          wildPokemonSprite.style.opacity = '1';
        }
      }
    }, isSuccess ? 1800 : 1200); // 3 shakes vs 2 shakes
  };
}

// Damage Popup Helper
function showDamagePopup(x, y, text, color = '#ef4444', isLocal = false) {
  const popup = document.createElement('div');
  popup.textContent = text;
  popup.className = 'damage-popup-bounce';
  popup.style.position = isLocal ? 'absolute' : 'fixed';
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.fontFamily = "'Outfit', sans-serif";
  popup.style.fontSize = '26px';
  popup.style.fontWeight = '900';
  popup.style.color = color;
  popup.style.textShadow = '0 0 10px rgba(0,0,0,0.8), 0 0 5px ' + color;
  popup.style.zIndex = '10000';
  popup.style.pointerEvents = 'none';

  if (isLocal) {
    const container = document.getElementById('battle-overlay-card');
    if (container) container.appendChild(popup);
    else document.body.appendChild(popup);
  } else {
    document.body.appendChild(popup);
  }
  
  setTimeout(() => popup.remove(), 1200);
}

const comicWords = ["BAM!", "POW!", "BOOM!", "CRACK!", "SMASH!", "WHACK!", "K.O.!"];
const comicColors = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899"];

function showComicPop(x, y, type = 'normal', isLocal = false) {
  const popup = document.createElement('div');
  let word = comicWords[Math.floor(Math.random() * (comicWords.length - 1))];
  if (type === 'defeat') {
    word = "K.O.!";
  }
  
  popup.textContent = word;
  popup.className = 'comic-bubble';
  popup.style.position = isLocal ? 'absolute' : 'fixed';
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
  
  const color = comicColors[Math.floor(Math.random() * comicColors.length)];
  popup.style.backgroundColor = color;
  popup.style.border = '4px solid #000';
  
  if (isLocal) {
    const container = document.getElementById('battle-overlay-card');
    if (container) container.appendChild(popup);
    else document.body.appendChild(popup);
  } else {
    document.body.appendChild(popup);
  }
  
  setTimeout(() => popup.remove(), 800);
}

let weatherInterval = null;

function clearWeather() {
  if (weatherInterval) clearInterval(weatherInterval);
  if (weatherArena) weatherArena.innerHTML = '';
}

function startWeatherEffect(types) {
  clearWeather();
  if (!weatherArena) return;
  if (!types || types.length === 0) return;
  
  const type = types[0].toLowerCase();
  let emoji = '';
  let animName = '';
  let rate = 300; // ms
  
  if (type === 'fire') {
    emoji = '🔥';
    animName = 'weatherFire';
    rate = 200;
  } else if (type === 'water') {
    emoji = '💧';
    animName = 'weatherWater';
    rate = 250;
  } else if (type === 'grass') {
    emoji = '🍃';
    animName = 'weatherGrass';
    rate = 300;
  } else if (type === 'electric') {
    emoji = '⚡';
    animName = 'weatherElectric';
    rate = 150;
  } else if (type === 'ice') {
    emoji = '❄️';
    animName = 'weatherIce';
    rate = 250;
  } else {
    emoji = '✨';
    animName = 'weatherWater';
    rate = 400;
  }
  
  weatherInterval = setInterval(() => {
    const p = document.createElement('div');
    p.className = 'weather-particle';
    p.textContent = emoji;
    
    const startX = Math.random() * 100;
    p.style.left = `${startX}%`;
    
    if (type === 'grass' || type === 'ice') {
      p.style.top = `-20px`;
    } else {
      p.style.bottom = `-20px`;
    }
    
    const size = Math.floor(Math.random() * 16) + 12;
    const duration = (Math.random() * 2 + 2).toFixed(1);
    const delay = (Math.random() * 0.5).toFixed(1);
    const drift = Math.floor(Math.random() * 100) - 50;
    const rot = Math.floor(Math.random() * 360);
    const dx = Math.floor(Math.random() * 40) - 20;
    const dy = Math.floor(Math.random() * 40) - 20;
    
    p.style.fontSize = `${size}px`;
    p.style.animation = `${animName} ${duration}s ${delay}s ease-in-out infinite`;
    p.style.setProperty('--drift', `${drift}px`);
    p.style.setProperty('--rot', `${rot}deg`);
    p.style.setProperty('--dx', `${dx}px`);
    p.style.setProperty('--dy', `${dy}px`);
    
    weatherArena.appendChild(p);
    setTimeout(() => p.remove(), (parseFloat(duration) + parseFloat(delay)) * 1000);
  }, rate);
}

// Projectile Attack Helper
function shootProjectile(fromEl, toEl, types, callback) {
  if (!fromEl || !toEl) {
    if (callback) callback();
    return;
  }
  
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  
  const startX = fromRect.left + fromRect.width / 2;
  const startY = fromRect.top + fromRect.height / 2;
  
  const endX = toRect.left + toRect.width / 2;
  const endY = toRect.top + toRect.height / 2;
  
  let emoji = '💥'; // Default physical strike
  let color = '#ef4444'; // Red default
  let shadow = 'rgba(239, 68, 68, 0.6)';
  
  const tList = types ? types.map(t => t.toLowerCase()) : [];
  if (tList.includes('fire')) {
    emoji = '🔥';
    color = '#f97316';
    shadow = 'rgba(249, 115, 22, 0.8)';
  } else if (tList.includes('water')) {
    emoji = '💧';
    color = '#3b82f6';
    shadow = 'rgba(59, 130, 246, 0.8)';
  } else if (tList.includes('electric')) {
    emoji = '⚡';
    color = '#eab308';
    shadow = 'rgba(234, 179, 8, 0.8)';
  } else if (tList.includes('grass')) {
    emoji = '🍃';
    color = '#22c55e';
    shadow = 'rgba(34, 197, 94, 0.8)';
  } else if (tList.includes('ghost') || tList.includes('psychic')) {
    emoji = '🔮';
    color = '#a855f7';
    shadow = 'rgba(168, 85, 247, 0.8)';
  } else if (tList.includes('ice')) {
    emoji = '❄️';
    color = '#06b6d4';
    shadow = 'rgba(6, 182, 212, 0.8)';
  } else if (tList.includes('rock') || tList.includes('ground')) {
    emoji = '🪨';
    color = '#78350f';
    shadow = 'rgba(120, 53, 15, 0.8)';
  }
  
  const proj = document.createElement('div');
  proj.textContent = emoji;
  proj.style.position = 'fixed';
  proj.style.fontSize = '32px';
  proj.style.left = `${startX - 16}px`;
  proj.style.top = `${startY - 16}px`;
  proj.style.zIndex = '1000';
  proj.style.pointerEvents = 'none';
  proj.style.display = 'flex';
  proj.style.alignItems = 'center';
  proj.style.justifyContent = 'center';
  proj.style.filter = `drop-shadow(0 0 10px ${shadow})`;
  document.body.appendChild(proj);
  
  const anim = proj.animate([
    { left: `${startX - 16}px`, top: `${startY - 16}px`, transform: 'scale(1) rotate(0deg)' },
    { left: `${endX - 16}px`, top: `${endY - 16}px`, transform: 'scale(1.5) rotate(720deg)' }
  ], {
    duration: 500,
    easing: 'ease-in-out'
  });
  
  anim.onfinish = () => {
    proj.remove();
    createHitParticles(endX, endY, color);
    if (callback) callback();
  };
}

// Sparkle/Particle explosion helper
function createHitParticles(x, y, color) {
  const count = 12;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.style.position = 'fixed';
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.width = '6px';
    p.style.height = '6px';
    p.style.borderRadius = '50%';
    p.style.backgroundColor = color;
    p.style.boxShadow = `0 0 8px ${color}`;
    p.style.zIndex = '999';
    p.style.pointerEvents = 'none';
    document.body.appendChild(p);
    
    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 60;
    const destX = x + Math.cos(angle) * distance;
    const destY = y + Math.sin(angle) * distance;
    
    const pAnim = p.animate([
      { transform: 'scale(1)', opacity: 1 },
      { left: `${destX}px`, top: `${destY}px`, transform: 'scale(0)', opacity: 0 }
    ], {
      duration: 600,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    });
    
    pAnim.onfinish = () => p.remove();
  }
}

let activeBattleSimulationTimers = [];
let currentBattleId = 0; // Unique ID to guard against stale callbacks

// Battle Start Event — Dynamic Multi-Turn System with GSAP
socket.on('battle_start', (data) => {
  if (currentOverlayConfig.showBattleArena === false) return;

  // ── 0. Cancel all previous battle timers to prevent overlap ──
  activeBattleSimulationTimers.forEach(clearTimeout);
  activeBattleSimulationTimers = [];
  
  // Kill any running GSAP animations on these elements
  gsap.killTweensOf([battleOverlayCard, challengerFighter, opponentFighter]);

  const battleId = ++currentBattleId; // Guard: all timers check this

  // Apply layout config positions immediately to ensure center/custom alignment before reveal
  if (currentOverlayConfig) {
    applyConfig(currentOverlayConfig);
  }

  // Force-reset visibility
  battleOverlay.classList.remove('hidden');

  // Hard-reset positions and scales using GSAP
  gsap.set(battleOverlayCard, { scale: 0.7, opacity: 0, transformOrigin: "center center" });
  gsap.set(challengerFighter, { x: -350, y: 0, opacity: 0, rotation: 0, scale: 1, filter: "none" });
  gsap.set(opponentFighter, { x: 350, y: 0, opacity: 0, rotation: 0, scale: 1, filter: "none" });
  impactFlash.classList.remove('impact-active');

  const battleField = document.querySelector('.battle-field');
  if (battleField) battleField.className = 'battle-field';

  clearWeather();

  // ── 2. Get HP bar elements ──
  const challengerHpFill = document.getElementById('challenger-hp-fill');
  const challengerHpText = document.getElementById('challenger-hp-text');
  const opponentHpFill = document.getElementById('opponent-hp-fill');
  const opponentHpText = document.getElementById('opponent-hp-text');

  // Reset HP bars to full
  if (challengerHpFill) { challengerHpFill.style.width = '100%'; challengerHpFill.style.backgroundColor = '#10b981'; }
  if (challengerHpTrail) challengerHpTrail.style.width = '100%';
  if (challengerHpText) challengerHpText.textContent = `HP: ${data.challengerHp}/${data.challengerHp}`;
  if (opponentHpFill) { opponentHpFill.style.width = '100%'; opponentHpFill.style.backgroundColor = '#10b981'; }
  if (opponentHpTrail) opponentHpTrail.style.width = '100%';
  if (opponentHpText) opponentHpText.textContent = `HP: ${data.opponentHp}/${data.opponentHp}`;

  // ── 3. Set fighter labels & sprites ──
  challengerTrainer.textContent = `@${data.challenger}`;
  challengerPoke.textContent = data.challengerPoke;
  challengerSprite.src = data.challengerSprite;
  opponentTrainer.textContent = data.opponent === 'Wild' ? 'Wild Pokémon' : `@${data.opponent}`;
  opponentPoke.textContent = data.opponentPoke;
  opponentSprite.src = data.opponentSprite;
  battleStatusText.textContent = 'BATTLE START!';

  // ── 4. Reveal overlay with a juicy spring pop ──
  gsap.to(battleOverlayCard, { duration: 0.5, scale: 1, opacity: 1, ease: "back.out(1.2)" });
  playSound(sfxSpawn);

  // Slide-in sprites onto center stage
  gsap.to(challengerFighter, { duration: 0.8, x: 0, opacity: 1, ease: "power2.out", delay: 0.2 });
  gsap.to(opponentFighter, { duration: 0.8, x: 0, opacity: 1, ease: "power2.out", delay: 0.2 });
 
  // ── 5. Build the dynamic turn schedule ──
  // Decide randomly who attacks first (challenger or opponent)
  const challengerGoesFirst = Math.random() < 0.5;
  let totalTurns = 5 + Math.floor(Math.random() * 2); // 5–6 turns base
  const isWinnerChallenger = data.winner === 'challenger';

  // Ensure the final turn always belongs to the winner so the KO animation triggers correctly
  const lastTurnIndex = totalTurns - 1;
  const lastTurnIsChallenger = challengerGoesFirst ? (lastTurnIndex % 2 === 0) : (lastTurnIndex % 2 !== 0);
  if (isWinnerChallenger !== lastTurnIsChallenger) {
    totalTurns += 1; // Shift final turn parity to the winner
  }

  // Pre-calculate exact attack counts for both fighters in the schedule to prevent division by zero
  let challengerAttackCountTotal = 0;
  let opponentAttackCountTotal = 0;
  for (let t = 0; t < totalTurns; t++) {
    const isChal = challengerGoesFirst ? (t % 2 === 0) : (t % 2 !== 0);
    if (isChal) challengerAttackCountTotal++;
    else opponentAttackCountTotal++;
  }

  const chalMaxHp = data.challengerHp || 100;
  const oppMaxHp = data.opponentHp || 100;

  // Winner's attacks: split opponent's full HP across their attack turns
  // Loser's attacks: drain only 40-60% of winner's HP
  const winnerAttackTurns = isWinnerChallenger ? challengerAttackCountTotal : opponentAttackCountTotal;
  const loserAttackTurns = isWinnerChallenger ? opponentAttackCountTotal : challengerAttackCountTotal;
  const loserHpToDrain = (isWinnerChallenger ? oppMaxHp : chalMaxHp);
  const winnerHpToDrain = (isWinnerChallenger ? chalMaxHp : oppMaxHp) * (0.4 + Math.random() * 0.2);

  // Current HP trackers
  let chalCurrentHp = chalMaxHp;
  let oppCurrentHp = oppMaxHp;
  let chalAttackCount = 0;
  let oppAttackCount = 0;

  // ── INTRO PHASE: 1.2s — Impact flash after slide-in ──
  const t1 = setTimeout(() => {
    if (battleId !== currentBattleId) return;

    if (battleField && data.challengerTypes && data.challengerTypes.length > 0) {
      const types = data.challengerTypes.map(t => t.toLowerCase());
      if (types.includes('fire')) battleField.classList.add('strike-fire');
      else if (types.includes('water')) battleField.classList.add('strike-water');
      else if (types.includes('grass')) battleField.classList.add('strike-grass');
      else if (types.includes('electric')) battleField.classList.add('strike-electric');
    }

    playSound(sfxHit);
    impactFlash.classList.add('impact-active');
    battleStatusText.textContent = 'FIGHT!';

    // Star burst screen shake
    gsap.fromTo(battleOverlayCard, 
      { x: "+=10", y: "+=10" }, 
      { duration: 0.05, x: 0, y: 0, clearProps: "x,y", repeat: 5, yoyo: true }
    );
  }, 1200);
  activeBattleSimulationTimers.push(t1);

  // ── SEQUENTIAL TURN CONTROLLER (RECURSIVE) ──
  function playNextTurn(turn) {
    if (battleId !== currentBattleId) return;
    
    // Safety check if we exceed turns without a KO
    if (turn >= totalTurns) {
      triggerFadeOutCleanup();
      return;
    }

    const isChallengerTurn = challengerGoesFirst ? (turn % 2 === 0) : (turn % 2 !== 0);
    const isFinalTurn = turn === totalTurns - 1;

    impactFlash.classList.remove('impact-active');

    if (isChallengerTurn) {
      // ── Challenger attacks Opponent ──
      chalAttackCount++;
      startWeatherEffect(data.challengerTypes);

      let damage;
      if (isWinnerChallenger && isFinalTurn) {
        // Final KO blow — drain all remaining HP
        damage = oppCurrentHp;
      } else if (isWinnerChallenger) {
        // Winner's normal attack
        damage = Math.round(loserHpToDrain / winnerAttackTurns) + Math.floor(Math.random() * 5);
      } else {
        // Loser's attack (challenger is loser, attacking opponent)
        damage = Math.round(winnerHpToDrain / loserAttackTurns) + Math.floor(Math.random() * 5);
      }
      
      // Safety cap: non-final turns cannot reduce HP to 0. Must leave at least 5 HP.
      if (!isFinalTurn) {
        damage = Math.max(1, Math.min(damage, oppCurrentHp - 5));
      } else {
        damage = Math.min(damage, oppCurrentHp);
      }

      // --- GSAP Challenger Lunge Animation ---
      gsap.to(challengerFighter, {
        duration: 0.15,
        x: 100, // lunge forward right
        scale: 1.15,
        ease: "power1.in",
        onComplete: () => {
          if (battleId !== currentBattleId) return;

          // Retract back to position
          gsap.to(challengerFighter, { duration: 0.3, x: 0, scale: 1, ease: "power2.out" });

          // Trigger hit reaction
          playSound(sfxHit);
          
          // Shake defender
          gsap.fromTo(opponentFighter, 
            { x: 0 }, 
            { duration: 0.05, x: 15, repeat: 5, yoyo: true, onComplete: () => gsap.set(opponentFighter, { x: 0 }) }
          );

          // Red damage flash
          gsap.fromTo(opponentFighter,
            { filter: "brightness(2.2) sepia(1) saturate(800%) hue-rotate(-50deg) drop-shadow(0 0 25px #ef4444)" },
            { duration: 0.4, filter: "none", ease: "power2.out" }
          );

          // Render slash overlay
          const slash = document.createElement('div');
          slash.className = 'slash-slice';
          opponentFighter.appendChild(slash);
          setTimeout(() => slash.remove(), 400);

          // Health calculation
          oppCurrentHp = Math.max(0, oppCurrentHp - damage);
          const hpPct = Math.max(0, (oppCurrentHp / oppMaxHp) * 100);

          if (opponentHpFill) {
            opponentHpFill.style.width = `${hpPct}%`;
            if (hpPct < 30) opponentHpFill.style.backgroundColor = '#ef4444';
            else if (hpPct < 60) opponentHpFill.style.backgroundColor = '#f59e0b';
          }
          if (opponentHpTrail) {
            setTimeout(() => { 
              if (battleId === currentBattleId && opponentHpTrail) opponentHpTrail.style.width = `${hpPct}%`; 
            }, 400);
          }
          if (opponentHpText) opponentHpText.textContent = `HP: ${oppCurrentHp}/${oppMaxHp}`;

          // Check KO
          if (oppCurrentHp <= 0) {
            showDamagePopup(600, 130, 'KO!', '#ef4444', true);
            showComicPop(600, 180, 'defeat', true);
            
            // Loser slide and roll off-screen
            gsap.to(opponentFighter, {
              duration: 0.8,
              y: 150,
              x: 250,
              rotation: 90,
              opacity: 0,
              ease: "power2.in"
            });

            battleStatusText.textContent = `🏆 WINNER: @${data.challenger}!`;
            playSound(sfxCatchSuccess);

            // Schedule cleanup to fade out overlay after 4 seconds
            const tCleanup = setTimeout(() => {
              triggerFadeOutCleanup();
            }, 4000);
            activeBattleSimulationTimers.push(tCleanup);
          } else {
            showDamagePopup(600, 130, `-${damage} HP!`, '#ef4444', true);
            showComicPop(600, 180, 'normal', true);

            if (chalAttackCount === 1) {
              if (data.challengerMultiplier > 1) {
                showDamagePopup(600, 90, 'SUPER EFFECTIVE!', '#eab308', true);
              } else if (data.challengerMultiplier < 1) {
                showDamagePopup(600, 90, 'Not very effective...', '#94a3b8', true);
              }
            }
            battleStatusText.textContent = `${data.challengerPoke} attacks!`;

            // Wait 1.5 seconds, then execute next turn sequentially
            const tNext = setTimeout(() => playNextTurn(turn + 1), 1500);
            activeBattleSimulationTimers.push(tNext);
          }
        }
      });

    } else {
      // ── Opponent attacks Challenger ──
      oppAttackCount++;
      startWeatherEffect(data.opponentTypes);

      let damage;
      if (!isWinnerChallenger && isFinalTurn) {
        damage = chalCurrentHp;
      } else if (!isWinnerChallenger) {
        damage = Math.round(loserHpToDrain / winnerAttackTurns) + Math.floor(Math.random() * 5);
      } else {
        damage = Math.round(winnerHpToDrain / loserAttackTurns) + Math.floor(Math.random() * 5);
      }
      
      // Safety cap: non-final turns cannot reduce HP to 0. Must leave at least 5 HP.
      if (!isFinalTurn) {
        damage = Math.max(1, Math.min(damage, chalCurrentHp - 5));
      } else {
        damage = Math.min(damage, chalCurrentHp);
      }

      // --- GSAP Opponent Lunge Animation ---
      gsap.to(opponentFighter, {
        duration: 0.15,
        x: -100, // lunge forward left
        scale: 1.15,
        ease: "power1.in",
        onComplete: () => {
          if (battleId !== currentBattleId) return;

          // Retract back to position
          gsap.to(opponentFighter, { duration: 0.3, x: 0, scale: 1, ease: "power2.out" });

          // Trigger hit reaction
          playSound(sfxHit);
          
          // Shake defender
          gsap.fromTo(challengerFighter, 
            { x: 0 }, 
            { duration: 0.05, x: -15, repeat: 5, yoyo: true, onComplete: () => gsap.set(challengerFighter, { x: 0 }) }
          );

          // Red damage flash
          gsap.fromTo(challengerFighter,
            { filter: "brightness(2.2) sepia(1) saturate(800%) hue-rotate(-50deg) drop-shadow(0 0 25px #ef4444)" },
            { duration: 0.4, filter: "none", ease: "power2.out" }
          );

          // Render slash overlay
          const slash = document.createElement('div');
          slash.className = 'slash-slice';
          challengerFighter.appendChild(slash);
          setTimeout(() => slash.remove(), 400);

          // Health calculation
          chalCurrentHp = Math.max(0, chalCurrentHp - damage);
          const hpPct = Math.max(0, (chalCurrentHp / chalMaxHp) * 100);

          if (challengerHpFill) {
            challengerHpFill.style.width = `${hpPct}%`;
            if (hpPct < 30) challengerHpFill.style.backgroundColor = '#ef4444';
            else if (hpPct < 60) challengerHpFill.style.backgroundColor = '#f59e0b';
          }
          if (challengerHpTrail) {
            setTimeout(() => { 
              if (battleId === currentBattleId && challengerHpTrail) challengerHpTrail.style.width = `${hpPct}%`; 
            }, 400);
          }
          if (challengerHpText) challengerHpText.textContent = `HP: ${chalCurrentHp}/${chalMaxHp}`;

          // Check KO
          if (chalCurrentHp <= 0) {
            showDamagePopup(160, 130, 'KO!', '#ef4444', true);
            showComicPop(160, 180, 'defeat', true);
            
            // Loser slide and roll off-screen
            gsap.to(challengerFighter, {
              duration: 0.8,
              y: 150,
              x: -250,
              rotation: -90,
              opacity: 0,
              ease: "power2.in"
            });

            const oppLabel = data.opponent === 'Wild' ? 'Wild Pokémon' : `@${data.opponent}`;
            battleStatusText.textContent = `🏆 WINNER: ${oppLabel}!`;
            playSound(sfxCatchFail);

            // Schedule cleanup to fade out overlay after 4 seconds
            const tCleanup = setTimeout(() => {
              triggerFadeOutCleanup();
            }, 4000);
            activeBattleSimulationTimers.push(tCleanup);
          } else {
            showDamagePopup(160, 130, `-${damage} HP!`, '#ef4444', true);
            showComicPop(160, 180, 'normal', true);

            if (oppAttackCount === 1) {
              if (data.opponentMultiplier > 1) {
                showDamagePopup(160, 90, 'SUPER EFFECTIVE!', '#eab308', true);
              } else if (data.opponentMultiplier < 1) {
                showDamagePopup(160, 90, 'Not very effective...', '#94a3b8', true);
              }
            }
            battleStatusText.textContent = `${data.opponentPoke} attacks!`;

            // Wait 1.5 seconds, then execute next turn sequentially
            const tNext = setTimeout(() => playNextTurn(turn + 1), 1500);
            activeBattleSimulationTimers.push(tNext);
          }
        }
      });
    }
  }

  function triggerFadeOutCleanup() {
    if (battleId !== currentBattleId) return;
    gsap.to(battleOverlayCard, {
      duration: 0.4,
      scale: 0.7,
      opacity: 0,
      ease: "power2.in",
      onComplete: () => {
        if (battleId !== currentBattleId) return;
        battleOverlay.classList.add('hidden');
        clearWeather();
        gsap.set([challengerFighter, opponentFighter], { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, filter: "none" });
      }
    });
  }

  // Start the first turn after 2 seconds
  const tStart = setTimeout(() => playNextTurn(0), 2000);
  activeBattleSimulationTimers.push(tStart);
});

// Battle End Event — Server signals results are processed; client may already be cleaned up
socket.on('battle_end', (data) => {
  // The client-side cleanup is already handled by the timed cleanup above.
  // This event is now purely for server-side state sync (leaderboard, etc.)
  // If overlay is somehow still visible, hide it as a safety net (30s backup).
  const safetyTimer = setTimeout(() => {
    if (!battleOverlay.classList.contains('hidden')) {
      console.log('Battle end safety backup triggered.');
      gsap.to(battleOverlayCard, {
        duration: 0.4,
        scale: 0.7,
        opacity: 0,
        ease: "power2.in",
        onComplete: () => {
          battleOverlay.classList.add('hidden');
          clearWeather();
          gsap.set([challengerFighter, opponentFighter], { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, filter: "none" });
        }
      });
    }
  }, 30000);
  activeBattleSimulationTimers.push(safetyTimer);
});

// Evolution Animation Event
socket.on('pokemon_evolved', (data) => {
  playSound(sfxEvolve);
  
  const oldSprite = getSafeSprite(data.oldSpriteUrl, data.oldFallbackSpriteUrl);
  const newSprite = getSafeSprite(data.spriteUrl, data.fallbackSpriteUrl);
  
  evoSprite.src = oldSprite;
  evoDesc.innerHTML = `<span class="cmd-text">@${data.displayName}</span>'s ${data.oldName} is evolving...`;
  
  // Reset elements
  evoSprite.style.animation = 'none';
  evoSprite.style.filter = 'none';
  evoSprite.style.opacity = '1';
  evoSprite.style.transform = 'scale(1)';
  evolutionOverlay.style.opacity = '1';
  
  evolutionOverlay.classList.remove('hidden');
  
  // Stage 1: The flashing silhouette loop (classic Game Boy style)
  let flashCount = 0;
  let maxFlashes = 22;
  let delay = 160;
  
  function triggerFlashCycle() {
    if (flashCount >= maxFlashes) {
      // Stage 2: Evolution blast!
      triggerEvolutionBlast(newSprite, data);
      return;
    }
    
    const isSilhouette = flashCount % 2 === 0;
    evoSprite.style.filter = isSilhouette ? 'brightness(0) invert(1)' : 'none';
    
    const scaleVal = isSilhouette ? 1.25 : 0.75;
    gsap.to(evoSprite, { scale: scaleVal, duration: delay / 1000, ease: 'power1.inOut' });
    
    flashCount++;
    delay = Math.max(45, delay - 7); // Speed up morphing transition
    
    setTimeout(triggerFlashCycle, delay);
  }
  
  setTimeout(triggerFlashCycle, 600);
});

function triggerEvolutionBlast(newSprite, data) {
  playSound(sfxCatchSuccess || sfxSpawn);

  gsap.to(evoSprite, { 
    scale: 0.1, 
    opacity: 0.1, 
    duration: 0.1, 
    onComplete: () => {
      evoSprite.src = newSprite;
      evoSprite.style.filter = 'none';
      
      gsap.to(evoSprite, {
        scale: 1.3,
        opacity: 1,
        duration: 0.6,
        ease: 'back.out(2.5)',
        onComplete: () => {
          evoSprite.style.animation = 'floatBounce 2.5s ease-in-out infinite';
        }
      });
      
      triggerCircularCelebration(data.isShiny);
      
      evoDesc.innerHTML = `<span class="cmd-text">@${data.displayName}</span>'s ${data.oldName} evolved into <span class="cmd-text" style="color: ${data.isShiny ? '#fbbf24' : '#c084fc'}; font-size: 23px; text-shadow: 0 0 10px rgba(168,85,247,0.5);">${data.newName}</span>!`;
    }
  });

  setTimeout(() => {
    gsap.to(evolutionOverlay, {
      opacity: 0,
      duration: 0.5,
      onComplete: () => {
        evolutionOverlay.classList.add('hidden');
        evolutionOverlay.style.opacity = '1';
      }
    });
  }, 5000);
}

function triggerCircularCelebration(isShiny) {
  const container = document.querySelector('.evo-circle');
  if (!container) return;

  const numParticles = 32;
  const colors = isShiny 
    ? ['#f59e0b', '#fbbf24', '#fef08a', '#ffffff']
    : ['#a855f7', '#c084fc', '#e9d5ff', '#22d3ee', '#ffffff'];

  for (let i = 0; i < numParticles; i++) {
    const particle = document.createElement('div');
    particle.style.width = `${Math.random() * 8 + 4}px`;
    particle.style.height = `${Math.random() * 8 + 4}px`;
    particle.style.borderRadius = '50%';
    particle.style.position = 'absolute';
    particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    particle.style.boxShadow = `0 0 10px ${particle.style.backgroundColor}`;
    particle.style.zIndex = '12';
    particle.style.left = '50%';
    particle.style.top = '50%';
    particle.style.transform = 'translate(-50%, -50%)';
    
    container.appendChild(particle);
    
    const angle = (i / numParticles) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
    const distance = Math.random() * 130 + 80;
    const destX = Math.cos(angle) * distance;
    const destY = Math.sin(angle) * distance;
    
    gsap.to(particle, {
      x: destX,
      y: destY,
      scale: 0.1,
      opacity: 0,
      duration: 1.2 + Math.random() * 0.4,
      ease: 'power3.out',
      onComplete: () => {
        particle.remove();
      }
    });
  }

  if (isShiny) {
    for (let i = 0; i < 12; i++) {
      const star = document.createElement('div');
      star.textContent = '✨';
      star.style.position = 'absolute';
      star.style.fontSize = `${Math.random() * 14 + 10}px`;
      star.style.zIndex = '15';
      star.style.left = '50%';
      star.style.top = '50%';
      
      container.appendChild(star);
      
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 95 + 30;
      const destX = Math.cos(angle) * distance;
      const destY = Math.sin(angle) * distance;
      
      gsap.to(star, {
        x: destX,
        y: destY,
        rotation: Math.random() * 360,
        opacity: 0,
        scale: 0.4,
        duration: 1.5,
        ease: 'power2.out',
        onComplete: () => {
          star.remove();
        }
      });
    }
  }
}

// Level Up Event Listener
socket.on('player_level_up', (data) => {
  if (currentOverlayConfig && currentOverlayConfig.showLevelUp === false) {
    return; // Streamer has disabled showing level up alert animations
  }
  playSound(sfxEvolve); // Play retro jingle
  
  const infoText = document.getElementById('lvl-info-text');
  if (infoText) {
    infoText.innerHTML = `<span class="cmd-text">@${data.displayName}</span> reached Trainer Level <span class="cmd-text">${data.level}</span>!`;
  }
  
  const rewardText = document.getElementById('lvl-reward-text');
  if (rewardText) {
    const gb = data.greatballsReward !== undefined ? data.greatballsReward : 3;
    const ub = data.ultraballsReward !== undefined ? data.ultraballsReward : 1;
    const coins = data.coinsReward !== undefined ? data.coinsReward : 100;
    
    const parts = [];
    if (gb > 0) parts.push(`${gb} Great Ball${gb !== 1 ? 's' : ''}`);
    if (ub > 0) parts.push(`${ub} Ultra Ball${ub !== 1 ? 's' : ''}`);
    if (coins > 0) parts.push(`${coins} Coin${coins !== 1 ? 's' : ''}`);
    
    if (parts.length > 0) {
      rewardText.textContent = `Received: ${parts.join(', ')}!`;
    } else {
      rewardText.textContent = '';
    }
  }
  
  const levelupOverlay = document.getElementById('levelup-overlay');
  if (levelupOverlay) {
    levelupOverlay.classList.remove('hidden');
    setTimeout(() => {
      levelupOverlay.classList.add('hidden');
    }, 5000);
  }
});

// Gacha Pack Opening Socket Event
socket.on('gacha_pack_opened', (data) => {
  if (currentOverlayConfig && currentOverlayConfig.showPackOpening === false) {
    return; // Streamer has disabled showing pack opening animations
  }
  playSound(sfxSpawn);
  const overlay = document.getElementById('gacha-overlay');
  const pack = document.getElementById('gacha-pack-element');
  const container = document.getElementById('gacha-cards-container');
  
  if (!overlay || !pack || !container) return;
  
  overlay.classList.remove('hidden');
  pack.classList.remove('tear-open');
  pack.classList.remove('hidden');
  container.classList.add('hidden');
  container.innerHTML = '';
  
  // Wait 1.5s then tear open the pack
  setTimeout(() => {
    playSound(sfxHit);
    pack.classList.add('tear-open');
    
    // Hide pack and show cards deal
    setTimeout(() => {
      pack.classList.add('hidden');
      container.classList.remove('hidden');
      
      // Deal 3 cards
      data.cards.forEach((card, idx) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = `gacha-card deal-${idx+1}`;
        
        const typeBadges = card.types.map(t => `<span class="type-badge type-${t.toLowerCase()}" style="font-size: 8px;">${t}</span>`).join(' ');
        const shinySpark = card.shiny ? '<span class="shiny-sparkle">✨</span>' : '';
        const sprite = getSafeSprite(card.spriteUrl, card.fallbackSpriteUrl);
        
        cardDiv.innerHTML = `
          <div class="gacha-card-inner">
            <div class="gacha-card-front">❓</div>
            <div class="gacha-card-back">
              <img src="${sprite}" class="gacha-card-sprite">
              <div class="gacha-card-name">${shinySpark}${card.name}</div>
              <div class="gacha-card-types">${typeBadges}</div>
            </div>
          </div>
        `;
        
        cardDiv.addEventListener('click', () => {
          if (!cardDiv.classList.contains('reveal')) {
            playSound(sfxThrow);
            cardDiv.classList.add('reveal');
          }
        });
        
        container.appendChild(cardDiv);
        
        // Auto-reveal delay
        setTimeout(() => {
          if (!cardDiv.classList.contains('reveal')) {
            playSound(sfxThrow);
            cardDiv.classList.add('reveal');
          }
        }, 1500 + idx * 1000);
      });
      
      // Close overlay after 7.5 seconds
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 7500);
      
    }, 500);
    
  }, 1800);
});

// Boss Raid Events
let raidCountdownInterval = null;

socket.on('raid_start', (data) => {
  if (currentOverlayConfig && currentOverlayConfig.showRaid === false) {
    return;
  }
  playSound(sfxLegendary);
  
  // Clear any existing countdown interval
  if (raidCountdownInterval) {
    clearInterval(raidCountdownInterval);
    raidCountdownInterval = null;
  }

  // Calculate remaining time dynamically using start and duration parameters
  const elapsedSeconds = data.startTime ? Math.round((Date.now() - data.startTime) / 1000) : 0;
  const totalDurationSeconds = (data.durationMs || (5 * 60 * 1000)) / 1000;
  let timeLeft = Math.max(0, Math.round(totalDurationSeconds - elapsedSeconds));
  
  const timeTicker = document.querySelector('.boss-time-ticker');
  if (timeTicker) {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const formattedSecs = secs < 10 ? `0${secs}` : secs;
    timeTicker.textContent = `⏳ ${mins}:${formattedSecs}`;
  }
  
  raidCountdownInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(raidCountdownInterval);
      raidCountdownInterval = null;
      if (timeTicker) timeTicker.textContent = `⏳ 0:00`;
      return;
    }
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const formattedSecs = secs < 10 ? `0${secs}` : secs;
    if (timeTicker) {
      timeTicker.textContent = `⏳ ${mins}:${formattedSecs}`;
    }
  }, 1000);
  const warningBanner = document.getElementById('raid-warning-banner');
  const raidOverlay = document.getElementById('raid-overlay');
  const sprite = document.getElementById('raid-boss-sprite');
  const name = document.getElementById('raid-boss-name');
  const hpFill = document.getElementById('raid-hp-fill');
  const hpText = document.getElementById('raid-hp-text');
  const list = document.getElementById('raid-contrib-list');
  const card = document.querySelector('.raid-card');
  
  if (!raidOverlay || !sprite || !name || !hpFill || !hpText || !list) return;
  
  // Force-reset visibility & class tags for a clean animation start
  raidOverlay.classList.add('hidden');
  if (card) card.className = 'raid-card';

  // Toggle active raid panels
  const activeView = document.getElementById('raid-active-view');
  const victoryView = document.getElementById('raid-victory-view');
  if (activeView) activeView.classList.remove('hidden');
  if (victoryView) {
    victoryView.classList.add('hidden');
    victoryView.innerHTML = '';
  }

  // Apply layout config positions immediately to ensure custom alignment before reveal
  if (currentOverlayConfig) {
    applyConfig(currentOverlayConfig);
  }
  
  // 1. Activate full-screen takeover mode
  document.body.classList.add('raid-mode-active');
  
  // 2. Play warning alert banner animation
  if (warningBanner) {
    warningBanner.classList.remove('hidden');
    setTimeout(() => {
      warningBanner.classList.add('hidden');
    }, 2600);
  }

  // 3. Load boss data
  sprite.src = getSafeSprite(data.spriteUrl, data.fallbackSpriteUrl);
  name.textContent = data.name;
  hpFill.style.width = '100%';
  hpText.textContent = `${data.maxHp} / ${data.maxHp} HP`;
  list.innerHTML = '<div style="color: #94a3b8; font-style: italic;">Attackers joining...</div>';
  
  if (card) {
    card.classList.add('gigantamax-active');
  }
  
  // Delay card pop-in slightly to follow warning slide animation
  setTimeout(() => {
    raidOverlay.classList.remove('hidden');
  }, 1000);
});

socket.on('raid_hit', (data) => {
  const hpFill = document.getElementById('raid-hp-fill');
  const hpText = document.getElementById('raid-hp-text');
  const list = document.getElementById('raid-contrib-list');
  const sprite = document.getElementById('raid-boss-sprite');
  const card = document.querySelector('.raid-card');
  
  if (!sprite) return;

  // 1. Calculate hit position on Raid Boss card
  const rect = sprite.getBoundingClientRect();
  const endX = rect.left + rect.width / 2;
  const endY = rect.top + rect.height / 2;
  
  // Projectile starts from a random spot at the bottom of the screen (chat style)
  const startX = Math.random() * window.innerWidth;
  const startY = window.innerHeight;

  // 2. Spawn flying type-based raid projectile
  shootRaidProjectile(startX, startY, endX, endY, data.types, () => {
    playSound(sfxHit);
    
    // Shake card on hit
    if (card) {
      card.classList.add('raid-boss-hit-active');
      setTimeout(() => card.classList.remove('raid-boss-hit-active'), 200);
    }

    // Show floating damage popup on boss card
    showDamagePopup(endX, endY - 30, `-${data.damage} HP!`, '#f43f5e');
    
    // Particle explosion
    createHitParticles(endX, endY, '#f43f5e');

    // Spawn attacking buddy Pokemon around the boss sprite
    if (data.spriteUrl) {
      const spriteWrapper = document.querySelector('.raid-sprite-wrapper');
      if (spriteWrapper) {
        const attackerContainer = document.createElement('div');
        attackerContainer.className = 'raid-attacker-sprite-container';
        
        const theta = Math.random() * 2 * Math.PI;
        const radius = 100 + Math.random() * 40;
        const xOffset = Math.cos(theta) * radius;
        const yOffset = Math.sin(theta) * radius;
        
        attackerContainer.style.left = `calc(50% + ${xOffset}px)`;
        attackerContainer.style.top = `calc(50% + ${yOffset}px)`;
        attackerContainer.style.transform = 'translate(-50%, -50%) scale(0)';
        attackerContainer.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        
        const attackerImg = document.createElement('img');
        attackerImg.src = getSafeSprite(data.spriteUrl, data.fallbackSpriteUrl);
        attackerImg.onerror = () => { attackerImg.src = data.fallbackSpriteUrl; };
        attackerContainer.appendChild(attackerImg);
        
        const nameTag = document.createElement('div');
        nameTag.className = 'raid-attacker-label';
        nameTag.textContent = `@${data.displayName}`;
        attackerContainer.appendChild(nameTag);
        
        spriteWrapper.appendChild(attackerContainer);
        
        // Pop in
        setTimeout(() => {
          attackerContainer.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 50);
        
        // Dash strike
        setTimeout(() => {
          attackerContainer.style.transform = `translate(calc(-50% - ${xOffset * 0.45}px), calc(-50% - ${yOffset * 0.45}px)) scale(1.15)`;
        }, 500);
        
        // Return back
        setTimeout(() => {
          attackerContainer.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 700);
        
        // Pop out
        setTimeout(() => {
          attackerContainer.style.opacity = '0';
          attackerContainer.style.transform = 'translate(-50%, -50%) scale(0)';
        }, 2200);
        
        setTimeout(() => {
          attackerContainer.remove();
        }, 2750);
      }
    }

    // Update health bars
    if (hpFill && hpText) {
      const percent = (data.currentHp / data.maxHp) * 100;
      hpFill.style.width = `${percent}%`;
      hpText.textContent = `${data.currentHp} / ${data.maxHp} HP`;
    }
  });

  // 3. Render Top 4 attackers leaderboard
  if (list && data.contributors && data.contributors.length > 0) {
    let html = '';
    // Show top 4 contributors
    const top4 = data.contributors.slice(0, 4);
    top4.forEach((c, index) => {
      let medal = '⚔️';
      if (index === 0) medal = '🥇';
      else if (index === 1) medal = '🥈';
      else if (index === 2) medal = '🥉';

      const sharePct = Math.round((c.damage / data.maxHp) * 100);
      
      html += `
        <div class="contrib-row">
          <div class="contrib-header-info">
            <span class="contrib-rank-name">${medal} <strong>@${c.username}</strong></span>
            <span>💥 ${c.damage} dmg (${sharePct}%)</span>
          </div>
          <div class="contrib-progress-outer">
            <div class="contrib-progress-fill" style="width: ${sharePct}%"></div>
          </div>
        </div>
      `;
    });
    list.innerHTML = html;
  }
});

socket.on('raid_end', (data) => {
  // Clear countdown interval immediately on end
  if (raidCountdownInterval) {
    clearInterval(raidCountdownInterval);
    raidCountdownInterval = null;
  }

  const hpFill = document.getElementById('raid-hp-fill');
  const hpText = document.getElementById('raid-hp-text');
  const list = document.getElementById('raid-contrib-list');
  const card = document.querySelector('.raid-card');
  
  if (card) {
    card.classList.remove('gigantamax-active');
  }

  let dismissTimeout = 5000;

  if (data.victory) {
    playSound(sfxEvolve);
    dismissTimeout = 12000; // Keep on screen longer for victory celebration & reward viewing
    
    if (hpFill && hpText) {
      hpFill.style.width = '0%';
      hpText.textContent = 'DEFEATED!';
    }
    
    // Render top 3 winners with rewards inside boss info block
    if (data.topWinners) {
      const bossInfo = document.querySelector('.raid-boss-info');
      if (bossInfo) {
        let winnersHtml = '';
        data.topWinners.forEach((w, index) => {
          let medal = '🥇';
          if (index === 1) medal = '🥈';
          if (index === 2) medal = '🥉';
          
          const rewardsList = [];
          rewardsList.push(`🪙 ${w.coins}`);
          rewardsList.push(`✨ ${w.xp} XP`);
          if (w.stone) {
            const stoneName = w.stone.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
            rewardsList.push(`🪨 ${stoneName}`);
          }
          
          winnersHtml += `
            <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 6px 10px; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #fff;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 16px;">${medal}</span>
                <div>
                  <strong style="color: #fbbf24; font-size: 12px;">@${w.displayName}</strong>
                  <div style="font-size: 9px; color: #94a3b8;">💥 ${w.damage} HP damage</div>
                </div>
              </div>
              <div style="text-align: right; font-weight: 700; color: #10b981; display: flex; gap: 4px;">
                ${rewardsList.map(r => `<span style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 1px 4px; border-radius: 4px; font-size: 9px; white-space: nowrap;">${r}</span>`).join('')}
              </div>
            </div>
          `;
        });
        
        const activeView = document.getElementById('raid-active-view');
        const victoryView = document.getElementById('raid-victory-view');
        if (activeView) activeView.classList.add('hidden');
        if (victoryView) {
          victoryView.classList.remove('hidden');
          victoryView.innerHTML = `
            <div style="text-align: center; animation: battlePopIn 0.5s ease-out; height: 100%; display: flex; flex-direction: column; justify-content: center;">
              <h2 style="font-family: 'Press Start 2P', monospace; font-size: 14px; color: #10b981; text-shadow: 0 0 10px rgba(16,185,129,0.5); margin: 0 0 4px 0;">🏆 RAID VICTORY!</h2>
              <div style="color: #94a3b8; font-size: 10px; margin-bottom: 8px;">The Boss has been defeated! Top Attackers & Rewards:</div>
              <div style="text-align: left; overflow-y: auto; max-height: 180px;">
                ${winnersHtml || '<div style="text-align: center; color: #94a3b8;">No contributors recorded.</div>'}
              </div>
            </div>
          `;
        }
      }
    }
  } else {
    playSound(sfxCatchFail);
    if (list) {
      list.innerHTML = `<div style="color: #94a3b8; font-style: italic; text-align: center; padding: 10px;">💨 The Raid Boss fled into the clouds...</div>`;
    }
  }
  
  setTimeout(() => {
    const raidOverlay = document.getElementById('raid-overlay');
    if (raidOverlay) {
      raidOverlay.classList.add('hidden');
    }
    document.body.classList.remove('raid-mode-active');
  }, dismissTimeout);
});

// Helper: Spawn flying projectile for Boss Raid hit
function shootRaidProjectile(startX, startY, endX, endY, types, callback) {
  let emoji = '💥'; // Default physical strike
  let color = '#f43f5e';
  let shadow = 'rgba(244, 63, 94, 0.8)';
  
  const tList = types ? types.map(t => t.toLowerCase()) : [];
  if (tList.includes('fire')) { emoji = '🔥'; color = '#f97316'; shadow = 'rgba(249, 115, 22, 0.8)'; }
  else if (tList.includes('water')) { emoji = '💧'; color = '#3b82f6'; shadow = 'rgba(59, 130, 246, 0.8)'; }
  else if (tList.includes('electric')) { emoji = '⚡'; color = '#eab308'; shadow = 'rgba(234, 179, 8, 0.8)'; }
  else if (tList.includes('grass')) { emoji = '🍃'; color = '#22c55e'; shadow = 'rgba(34, 197, 94, 0.8)'; }
  else if (tList.includes('ghost') || tList.includes('psychic')) { emoji = '🔮'; color = '#a855f7'; shadow = 'rgba(168, 85, 247, 0.8)'; }
  
  const proj = document.createElement('div');
  proj.textContent = emoji;
  proj.style.position = 'fixed';
  proj.style.fontSize = '36px';
  proj.style.left = `${startX - 18}px`;
  proj.style.top = `${startY - 18}px`;
  proj.style.zIndex = '9999';
  proj.style.pointerEvents = 'none';
  proj.style.filter = `drop-shadow(0 0 12px ${shadow})`;
  document.body.appendChild(proj);
  
  const anim = proj.animate([
    { left: `${startX - 18}px`, top: `${startY - 18}px`, transform: 'scale(1) rotate(0deg)' },
    { left: `${endX - 18}px`, top: `${endY - 18}px`, transform: 'scale(1.8) rotate(360deg)' }
  ], {
    duration: 600,
    easing: 'ease-out'
  });
  
  anim.onfinish = () => {
    proj.remove();
    if (callback) callback();
  };
}

// Marquee Leaderboard Ticker Logic
let tickerInterval = null;
let currentTickerIndex = 0;

function updateMarqueeTicker(leaderboard) {
  const tickerBar = document.getElementById('leaderboard-ticker-bar');
  const tickerContent = document.getElementById('ticker-content');
  
  if (!tickerBar || !tickerContent) return;
  
  if (currentOverlayConfig.showLeaderboard === false) {
    tickerBar.classList.add('ticker-hidden');
    return;
  }
  
  if (!leaderboard || leaderboard.length === 0) {
    tickerBar.classList.add('ticker-hidden');
    return;
  }
  
  tickerBar.classList.remove('ticker-hidden');
  
  // Clear any existing timer
  if (tickerInterval) clearInterval(tickerInterval);
  
  const slides = [];
  
  // Slide 1: Top Collectors (by total pokemon)
  const topCollectors = [...leaderboard].sort((a,b) => b.totalPokemon - a.totalPokemon).slice(0, 3);
  if (topCollectors.length > 0) {
    const listStr = topCollectors.map((p, idx) => `#${idx+1} @${p.displayName} (${p.totalPokemon} pokes)`).join(' | ');
    slides.push(`<div class="ticker-item">🎒 Collectors: ${listStr}</div>`);
  }
  
  // Slide 2: Top Champions (by total battle wins)
  const topWinners = [...leaderboard].sort((a,b) => b.totalWins - a.totalWins).slice(0, 3);
  if (topWinners.length > 0) {
    const listStr = topWinners.map((p, idx) => `#${idx+1} @${p.displayName} (${p.totalWins} wins)`).join(' | ');
    slides.push(`<div class="ticker-item">⚔️ Champions: ${listStr}</div>`);
  }
  
  // Slide 3: Active Buddy companion status
  const buddyOwners = leaderboard.filter(p => p.activePokemon);
  if (buddyOwners.length > 0) {
    const listStr = buddyOwners.slice(0, 2).map(p => `@${p.displayName} buddy: ${p.activePokemon.name}`).join(' | ');
    slides.push(`<div class="ticker-item">✨ Partner Buddies: ${listStr}</div>`);
  }
  
  if (slides.length === 0) {
    tickerBar.classList.add('ticker-hidden');
    return;
  }
  
  // Render first slide
  currentTickerIndex = 0;
  tickerContent.innerHTML = slides[0];
  
  // Rotate slides every 10 seconds
  tickerInterval = setInterval(() => {
    currentTickerIndex = (currentTickerIndex + 1) % slides.length;
    
    // Apply slide-out fade CSS animation
    tickerContent.style.animation = 'none';
    void tickerContent.offsetWidth; // Trigger reflow
    tickerContent.style.animation = 'tickerFadeInOut 0.6s ease-in-out';
    
    tickerContent.innerHTML = slides[currentTickerIndex];
  }, 10000);
}

// Receive updated leaderboard stats
socket.on('leaderboard_update', (leaderboard) => {
  updateMarqueeTicker(leaderboard);
});

// Listen for dynamic config updates
socket.on('config_updated', (config) => {
  applyConfig(config);
});

// Active roaming buddies maps to prevent duplicate instances and persist them while chatting
const activeRoamerElements = new Map();
const activeRoamerTimeouts = new Map();
const activeRoamerTimelines = new Map();

socket.on('chat_buddy_roam', (data) => {
  const container = document.getElementById('chat-roamer-container');
  if (!container) return;

  const duration = data.duration || 15;
  const roamerScale = data.scale || 1.0;

  // If already roaming, reset their timers and start a new walk sequence
  if (activeRoamerElements.has(data.username)) {
    const existing = activeRoamerElements.get(data.username);
    existing.dataset.scale = roamerScale;
    
    // Pulse nudge to show activity
    gsap.to(existing, { scale: roamerScale * 1.15, duration: 0.15, yoyo: true, repeat: 1 });
    
    // Clear old dismiss timer
    const oldTimeout = activeRoamerTimeouts.get(data.username);
    if (oldTimeout) clearTimeout(oldTimeout);
    
    // Kill old timeline
    const oldTimeline = activeRoamerTimelines.get(data.username);
    if (oldTimeline) oldTimeline.kill();
    
    // Setup a new walk sequence starting from their current position
    const img = existing.querySelector('.roaming-buddy-sprite');
    const steps = Math.floor(duration / 3);
    const tl = gsap.timeline({ defaults: { ease: 'power1.inOut' } });
    activeRoamerTimelines.set(data.username, tl);
    
    // Get current horizontal position (parse left style)
    let currentPos = parseFloat(existing.style.left) || 50;
    
    for (let i = 0; i < steps; i++) {
      const direction = Math.random() < 0.5 ? -1 : 1;
      const distance = 5 + Math.random() * 15;
      let nextPos = currentPos + direction * distance;
      if (nextPos < 1) nextPos = 1 + Math.random() * 10;
      else if (nextPos > 95) nextPos = 95 - Math.random() * 10;
      
      const walkDirection = nextPos > currentPos ? 1 : -1;
      tl.to(img, { scaleX: walkDirection, duration: 0.1 }, i * 3);
      tl.to(existing, { left: `${nextPos}%`, duration: 2.5 }, i * 3 + 0.1);
      
      currentPos = nextPos;
    }
    
    // Schedule new dismiss timer
    const newTimeout = setTimeout(() => {
      gsap.to(existing, {
        scale: 0,
        opacity: 0,
        duration: 0.8,
        ease: 'back.in(1.7)',
        onComplete: () => {
          existing.remove();
          activeRoamerElements.delete(data.username);
          activeRoamerTimeouts.delete(data.username);
          activeRoamerTimelines.delete(data.username);
        }
      });
    }, duration * 1000);
    
    activeRoamerTimeouts.set(data.username, newTimeout);
    return;
  }

  const roamer = document.createElement('div');
  roamer.className = 'roaming-buddy-container';
  roamer.dataset.scale = roamerScale;
  
  const spawnLeft = 2 + Math.random() * 91;
  roamer.style.left = `${spawnLeft}%`;
  
  const img = document.createElement('img');
  img.className = 'roaming-buddy-sprite walking';
  img.src = getSafeSprite(data.spriteUrl, data.fallbackSpriteUrl);
  img.onerror = () => { img.src = data.fallbackSpriteUrl; };
  roamer.appendChild(img);
  
  const label = document.createElement('div');
  label.className = 'roaming-buddy-label';
  label.textContent = `${data.displayName}: ${data.pokemonName}`;
  roamer.appendChild(label);
  
  container.appendChild(roamer);
  activeRoamerElements.set(data.username, roamer);
  
  gsap.fromTo(roamer, { scale: 0, opacity: 0 }, { scale: roamerScale, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' });
  
  const tl = gsap.timeline({ defaults: { ease: 'power1.inOut' } });
  activeRoamerTimelines.set(data.username, tl);
  const steps = Math.floor(duration / 3);
  
  let currentPos = spawnLeft;
  
  for (let i = 0; i < steps; i++) {
    const direction = Math.random() < 0.5 ? -1 : 1;
    const distance = 5 + Math.random() * 15;
    let nextPos = currentPos + direction * distance;
    
    if (nextPos < 1) {
      nextPos = 1 + Math.random() * 10;
    } else if (nextPos > 95) {
      nextPos = 95 - Math.random() * 10;
    }
    
    const walkDirection = nextPos > currentPos ? 1 : -1;
    
    tl.to(img, { scaleX: walkDirection, duration: 0.1 }, i * 3);
    tl.to(roamer, { left: `${nextPos}%`, duration: 2.5 }, i * 3 + 0.1);
    
    currentPos = nextPos;
  }
  
  const timeoutId = setTimeout(() => {
    gsap.to(roamer, {
      scale: 0,
      opacity: 0,
      duration: 0.8,
      ease: 'back.in(1.7)',
      onComplete: () => {
        roamer.remove();
        activeRoamerElements.delete(data.username);
        activeRoamerTimeouts.delete(data.username);
        activeRoamerTimelines.delete(data.username);
      }
    });
  }, duration * 1000);
  
  activeRoamerTimeouts.set(data.username, timeoutId);
});

socket.on('chat_buddy_update', (data) => {
  if (activeRoamerElements.has(data.username)) {
    const container = activeRoamerElements.get(data.username);
    const img = container.querySelector('.roaming-buddy-sprite');
    const label = container.querySelector('.roaming-buddy-label');
    const roamerScale = parseFloat(container.dataset.scale) || 1.0;
    
    // Smooth swap animation: scale down, change src, scale back up
    gsap.to(container, {
      scale: 0,
      duration: 0.3,
      onComplete: () => {
        if (img) {
          img.src = getSafeSprite(data.spriteUrl, data.fallbackSpriteUrl);
          img.onerror = () => { img.src = data.fallbackSpriteUrl; };
        }
        if (label) {
          const displayName = label.textContent.split(':')[0] || data.username;
          label.textContent = `${displayName}: ${data.pokemonName}`;
        }
        gsap.to(container, { scale: roamerScale, duration: 0.4, ease: 'back.out(1.7)' });
      }
    });
  }
});

socket.on('chat_buddy_remove', (data) => {
  if (activeRoamerElements.has(data.username)) {
    const container = activeRoamerElements.get(data.username);
    
    const timeout = activeRoamerTimeouts.get(data.username);
    if (timeout) clearTimeout(timeout);
    activeRoamerTimeouts.delete(data.username);
    
    const timeline = activeRoamerTimelines.get(data.username);
    if (timeline) timeline.kill();
    activeRoamerTimelines.delete(data.username);
    
    gsap.to(container, {
      scale: 0,
      opacity: 0,
      duration: 0.5,
      ease: 'back.in(1.7)',
      onComplete: () => {
        container.remove();
        activeRoamerElements.delete(data.username);
      }
    });
  }
});

// Autoplay Audio Unblock Banner click listener
const audioBanner = document.getElementById('audio-unblock-banner');
if (audioBanner) {
  window.addEventListener('click', () => {
    // Hide the banner immediately on click
    audioBanner.style.opacity = '0';
    setTimeout(() => {
      audioBanner.classList.add('hidden');
      audioBanner.style.display = 'none';
    }, 300);

    // Attempt to trigger silent audio context unlock
    try {
      const unlockAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA');
      unlockAudio.play().catch(err => console.log('Autoplay audio context unlock trigger:', err.message));
    } catch (e) {
      console.log('Autoplay context unlock failed:', e.message);
    }
  }, { once: true });
}

// ==========================================================================
// Championship Tournament Overlay Visuals
// ==========================================================================
let currentTournamentState = null;
let currentP1Idx = 0;
let currentP2Idx = 0;

function renderChampionshipBracket(bracket, activeRoundIdx, activeMatchIdx) {
  const leftCol16 = document.querySelector('.bracket-side-left .round-16');
  const leftColQtr = document.querySelector('.bracket-side-left .round-qtr');
  const leftColSemi = document.querySelector('.bracket-side-left .round-semi');

  const rightCol16 = document.querySelector('.bracket-side-right .round-16');
  const rightColQtr = document.querySelector('.bracket-side-right .round-qtr');
  const rightColSemi = document.querySelector('.bracket-side-right .round-semi');

  const finalsNode = document.querySelector('.finals-match-node');
  const thirdPlaceNode = document.querySelector('.third-place-match-node');

  if (leftCol16) leftCol16.innerHTML = '';
  if (leftColQtr) leftColQtr.innerHTML = '';
  if (leftColSemi) leftColSemi.innerHTML = '';
  if (rightCol16) rightCol16.innerHTML = '';
  if (rightColQtr) rightColQtr.innerHTML = '';
  if (rightColSemi) rightColSemi.innerHTML = '';
  if (finalsNode) finalsNode.innerHTML = '';
  if (thirdPlaceNode) thirdPlaceNode.innerHTML = '';

  bracket.forEach((round, roundIdx) => {
    const isRoundActive = (roundIdx === activeRoundIdx);
    
    if (round.length === 8) {
      round.slice(0, 4).forEach((match, idx) => {
        if (leftCol16) leftCol16.innerHTML += createMatchupNodeHtml(match, roundIdx, idx, isRoundActive && idx === activeMatchIdx);
      });
      round.slice(4, 8).forEach((match, idx) => {
        const actualIdx = idx + 4;
        if (rightCol16) rightCol16.innerHTML += createMatchupNodeHtml(match, roundIdx, actualIdx, isRoundActive && actualIdx === activeMatchIdx);
      });
    } else if (round.length === 4) {
      round.slice(0, 2).forEach((match, idx) => {
        if (leftColQtr) leftColQtr.innerHTML += createMatchupNodeHtml(match, roundIdx, idx, isRoundActive && idx === activeMatchIdx);
      });
      round.slice(2, 4).forEach((match, idx) => {
        const actualIdx = idx + 2;
        if (rightColQtr) rightColQtr.innerHTML += createMatchupNodeHtml(match, roundIdx, actualIdx, isRoundActive && actualIdx === activeMatchIdx);
      });
    } else if (round.length === 2) {
      if (leftColSemi && round[0]) leftColSemi.innerHTML += createMatchupNodeHtml(round[0], roundIdx, 0, isRoundActive && activeMatchIdx === 0);
      if (rightColSemi && round[1]) rightColSemi.innerHTML += createMatchupNodeHtml(round[1], roundIdx, 1, isRoundActive && activeMatchIdx === 1);
    } else if (round.length === 1) {
      const isFinalsRound = (roundIdx === bracket.length - 1);
      if (isFinalsRound) {
        if (finalsNode && round[0]) finalsNode.innerHTML += createMatchupNodeHtml(round[0], roundIdx, 0, isRoundActive);
      } else {
        if (thirdPlaceNode && round[0]) {
          thirdPlaceNode.innerHTML += `<div style="font-size: 7px; color: #cd7f32; margin-bottom: 6px; font-weight: bold;">🥉 3RD PLACE PLAYOFF</div>`;
          thirdPlaceNode.innerHTML += createMatchupNodeHtml(round[0], roundIdx, 0, isRoundActive);
        }
      }
    }
  });
}

function createMatchupNodeHtml(match, roundIdx, matchIdx, isActive) {
  if (!match) return '';
  const p1Name = match.p1 ? `@${match.p1.displayName}` : 'EMPTY';
  const p2Name = match.p2 ? `@${match.p2.displayName}` : 'EMPTY';
  
  let p1Class = 'bracket-slot';
  let p2Class = 'bracket-slot';
  
  if (match.winner) {
    if (match.p1 && match.winner.username === match.p1.username) {
      p1Class += ' winner-slot';
      p2Class += ' loser-slot';
    } else if (match.p2 && match.winner.username === match.p2.username) {
      p2Class += ' winner-slot';
      p1Class += ' loser-slot';
    }
  }
  
  const activeClass = isActive ? 'active-match' : '';
  const byeClass = match.isBye ? 'bye-match' : '';
  
  return `
    <div class="bracket-matchup ${activeClass} ${byeClass}">
      <div class="${p1Class}">${p1Name}</div>
      <div class="bracket-divider" style="border-bottom: 1px solid rgba(255,255,255,0.08); margin: 2px 0;"></div>
      <div class="${p2Class}">${p2Name}</div>
    </div>
  `;
}

function buildFighterCardHtml(poke) {
  if (!poke) return '';
  const typeBadges = (poke.types || []).map(t => `<span class="type-badge type-${t}" style="padding: 2px 4px; border-radius: 4px; font-size: 6px; text-transform: uppercase; color: #fff;">${t}</span>`).join(' ');
  const borderStyle = poke.shiny ? 'border: 2px solid #fbbf24; box-shadow: 0 0 15px rgba(251, 191, 36, 0.4);' : 'border: 1px solid rgba(255,255,255,0.15);';
  
  return `
    <div class="relay-card-inner" style="width: 100%; height: 100%; background: radial-gradient(circle at center, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.99) 100%); border-radius: 16px; ${borderStyle} display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; padding: 15px; position: relative;">
      ${poke.shiny ? '<div style="position: absolute; top: 8px; right: 10px; font-size: 10px; animation: bounce 1s infinite alternate;">✨</div>' : ''}
      <div style="font-size: 7px; color: #94a3b8; margin-bottom: 5px; text-transform: uppercase;">CP ${calculateCP(poke.baseStats, poke.wins || 0, poke.isLegendary, poke.fusionCount || 0, poke.shiny)}</div>
      
      <img class="fighter-sprite" src="${poke.spriteUrl}" onerror="this.src='${poke.fallbackSpriteUrl}';" style="width: 90px; height: 90px; object-fit: contain; image-rendering: pixelated; margin-bottom: 8px;" />
      
      <div style="font-size: 8px; color: #fff; margin-bottom: 4px; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; text-align: center;">${poke.name}</div>
      <div style="display: flex; gap: 4px; margin-bottom: 12px;">${typeBadges}</div>
      
      <div style="width: 100%; background: rgba(0, 0, 0, 0.5); height: 8px; border-radius: 4px; position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
        <div class="fighter-hp-fill" style="width: 100%; height: 100%; background: #10b981; transition: width 0.3s ease;"></div>
      </div>
      <div class="fighter-hp-text" style="font-size: 6px; color: #94a3b8; margin-top: 4px;">${poke.currentHp} / ${poke.maxHp} HP</div>
    </div>
  `;
}

function updateRelayBenchBalls(containerId, activeIdx) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  let ballsHtml = '';
  for (let i = 0; i < 6; i++) {
    if (i < activeIdx) {
      ballsHtml += `<span style="font-size: 11px; opacity: 0.2; filter: grayscale(100%);">⚫</span>`;
    } else if (i === activeIdx) {
      ballsHtml += `<span style="font-size: 11px; animation: bounce 0.6s infinite alternate;">🔴</span>`;
    } else {
      ballsHtml += `<span style="font-size: 11px;">🔴</span>`;
    }
  }
  container.innerHTML = ballsHtml;
}

// Websocket Events for Championship Overlay
socket.on('championship_registration_started', (data) => {
  const overlay = document.getElementById('championship-overlay');
  const bracketView = document.getElementById('championship-bracket-view');
  const battleArena = document.getElementById('championship-battle-arena');
  const trophy = document.querySelector('.trophy-display');

  if (overlay) overlay.classList.remove('hidden');
  if (bracketView) bracketView.classList.add('hidden');
  if (battleArena) battleArena.classList.add('hidden');
  if (trophy) trophy.classList.add('hidden');
  
  // Clean up bracket elements
  renderChampionshipBracket([], 0, 0);
  
  playSound(sfxSpawn);
});

socket.on('championship_started', (data) => {
  const overlay = document.getElementById('championship-overlay');
  const bracketView = document.getElementById('championship-bracket-view');
  const battleArena = document.getElementById('championship-battle-arena');
  
  if (overlay) overlay.classList.remove('hidden');
  if (bracketView) bracketView.classList.remove('hidden');
  if (battleArena) battleArena.classList.add('hidden');
  
  currentTournamentState = data.bracket;
  renderChampionshipBracket(data.bracket, 0, 0);
  
  playSound(sfxEvolve);
});

socket.on('championship_bracket_update', (data) => {
  currentTournamentState = data.bracket;
  renderChampionshipBracket(data.bracket, data.currentRound, 0);
});

socket.on('championship_match_start', (data) => {
  const battleArena = document.getElementById('championship-battle-arena');
  const p1CardWrap = document.getElementById('p1-relay-card-wrap');
  const p2CardWrap = document.getElementById('p2-relay-card-wrap');
  const p1Name = document.getElementById('p1-bench-name');
  const p2Name = document.getElementById('p2-bench-name');
  const statusText = document.getElementById('relay-status-text');

  if (battleArena) battleArena.classList.remove('hidden');
  
  currentP1Idx = 0;
  currentP2Idx = 0;
  
  if (p1Name) p1Name.textContent = `@${data.p1.displayName}`;
  if (p2Name) p2Name.textContent = `@${data.p2.displayName}`;
  
  updateRelayBenchBalls('p1-bench-balls', 0);
  updateRelayBenchBalls('p2-bench-balls', 0);

  if (p1CardWrap) {
    p1CardWrap.innerHTML = buildFighterCardHtml(data.p1.team[0]);
    p1CardWrap.className = ''; // Reset Last Hope aura classes
    gsap.fromTo(p1CardWrap, { x: -350, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: 'power2.out' });
  }
  
  if (p2CardWrap) {
    p2CardWrap.innerHTML = buildFighterCardHtml(data.p2.team[0]);
    p2CardWrap.className = '';
    gsap.fromTo(p2CardWrap, { x: 350, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: 'power2.out' });
  }

  if (statusText) statusText.innerHTML = `⚔️ Matchup Started!<br/>Place your bets now: <strong>!bet [username] [coins]</strong>`;

  playSound(sfxSpawn);
  renderChampionshipBracket(currentTournamentState, data.roundIdx, data.matchIdx);
});

socket.on('championship_relay_hit', (data) => {
  const p1CardWrap = document.getElementById('p1-relay-card-wrap');
  const p2CardWrap = document.getElementById('p2-relay-card-wrap');
  const statusText = document.getElementById('relay-status-text');

  // Trigger Clash collision animation
  const activeAttacker = data.attacker === 'p1' ? p1CardWrap : p2CardWrap;
  const activeDefender = data.attacker === 'p1' ? p2CardWrap : p1CardWrap;
  const moveX = data.attacker === 'p1' ? 120 : -120;

  // Animate attack clash
  gsap.timeline()
    .to(activeAttacker, { x: moveX, duration: 0.1, ease: 'power2.in' })
    .to(activeAttacker, { 
      x: 0, 
      duration: 0.4, 
      ease: 'back.out(1.5)',
      onStart: () => {
        // Play hit sound effect
        playSound(sfxHit);
        
        // Shake defender card & flash full-screen briefly
        gsap.fromTo(activeDefender, { x: data.attacker === 'p1' ? 10 : -10 }, { x: 0, duration: 0.08, repeat: 3, yoyo: true });
        
        // Render stylized impact bubble popup
        createRelashImpactPopup(data.damage, data.isCrit);
      }
    });

  // Update HP indicators
  setTimeout(() => {
    if (p1CardWrap) {
      const fill = p1CardWrap.querySelector('.fighter-hp-fill');
      const text = p1CardWrap.querySelector('.fighter-hp-text');
      if (fill) fill.style.width = `${(data.p1Hp / data.p1MaxHp) * 100}%`;
      if (text) text.textContent = `${data.p1Hp} / ${data.p1MaxHp} HP`;
    }
    if (p2CardWrap) {
      const fill = p2CardWrap.querySelector('.fighter-hp-fill');
      const text = p2CardWrap.querySelector('.fighter-hp-text');
      if (fill) fill.style.width = `${(data.p2Hp / data.p2MaxHp) * 100}%`;
      if (text) text.textContent = `${data.p2Hp} / ${data.p2MaxHp} HP`;
    }
  }, 100);
});

socket.on('championship_relay_slidein', (data) => {
  const p1CardWrap = document.getElementById('p1-relay-card-wrap');
  const p2CardWrap = document.getElementById('p2-relay-card-wrap');
  const statusText = document.getElementById('relay-status-text');

  const faintedCard = data.player === 'p1' ? p1CardWrap : p2CardWrap;
  
  if (data.player === 'p1') {
    currentP1Idx = data.nextIndex;
    updateRelayBenchBalls('p1-bench-balls', currentP1Idx);
  } else {
    currentP2Idx = data.nextIndex;
    updateRelayBenchBalls('p2-bench-balls', currentP2Idx);
  }

  // Play Red energy-burst faint exit animation
  gsap.timeline()
    .to(faintedCard.querySelector('.relay-card-inner'), {
      filter: 'brightness(1.5) sepia(100%) saturate(1000%) hue-rotate(-50deg)',
      duration: 0.3
    })
    .to(faintedCard, {
      scale: 0.3,
      opacity: 0,
      y: 150,
      duration: 0.5,
      ease: 'power2.in',
      onStart: () => {
        playSound(sfxCatchFail);
        createRelashFaintParticles(faintedCard);
      },
      onComplete: () => {
        faintedCard.innerHTML = buildFighterCardHtml(data.nextPokemon);
        
        // Apply Last Hope aura if index is 5 (last pokemon)
        if (data.nextIndex === 5) {
          faintedCard.classList.add('last-hope-glow');
          if (statusText) statusText.innerHTML = `⚠️ <strong>LAST HOPE AURA ENERGISED!</strong>`;
        }

        // Pokéball Launch summon animation
        const xOffset = data.player === 'p1' ? -350 : 350;
        gsap.fromTo(faintedCard, { x: xOffset, scale: 0.3, opacity: 0 }, {
          x: 0,
          scale: 1,
          opacity: 1,
          duration: 0.6,
          ease: 'back.out(1.5)',
          onStart: () => {
            playSound(sfxThrow);
          }
        });
      }
    });
});

socket.on('championship_match_result', (data) => {
  const battleArena = document.getElementById('championship-battle-arena');
  if (battleArena) battleArena.classList.add('hidden');
});

socket.on('championship_match_end', (data) => {
  const battleArena = document.getElementById('championship-battle-arena');
  const statusText = document.getElementById('relay-status-text');

  if (statusText) statusText.innerHTML = `🏁 Match ended! Winner: @${data.winner.displayName}`;
  
  setTimeout(() => {
    if (battleArena) battleArena.classList.add('hidden');
    renderChampionshipBracket(currentTournamentState, data.roundIdx, data.matchIdx + 1);
  }, 2000);
});

socket.on('championship_ended', (data) => {
  const battleArena = document.getElementById('championship-battle-arena');
  const bracketView = document.getElementById('championship-bracket-view');
  const trophy = document.querySelector('.trophy-display');
  const champName = document.getElementById('champ-winner-name');

  if (battleArena) battleArena.classList.add('hidden');
  if (bracketView) bracketView.classList.remove('hidden');
  if (trophy) {
    trophy.classList.remove('hidden');
    if (champName) champName.textContent = `@${data.champion.displayName}`;
  }

  playSound(sfxEvolve);

  // Automatically hide the tournament screen after the configured winner screen duration
  const durationSeconds = (currentOverlayConfig && currentOverlayConfig.championshipWinnerScreenDuration !== undefined)
    ? currentOverlayConfig.championshipWinnerScreenDuration
    : 30;

  setTimeout(() => {
    const overlay = document.getElementById('championship-overlay');
    if (overlay) overlay.classList.add('hidden');
    if (trophy) trophy.classList.add('hidden');
  }, durationSeconds * 1000);
});

socket.on('championship_cancelled', () => {
  const overlay = document.getElementById('championship-overlay');
  if (overlay) overlay.classList.add('hidden');
});

socket.on('trade_completed', (data) => {
  console.log('[Trade] Trade completed event received:', data);
  
  const overlay = document.getElementById('trade-overlay');
  if (!overlay) return;

  const sideA = document.getElementById('trade-side-a');
  const sideB = document.getElementById('trade-side-b');
  const spriteA = sideA.querySelector('.trade-sprite');
  const spriteB = sideB.querySelector('.trade-sprite');
  const nameA = sideA.querySelector('.trainer-name');
  const nameB = sideB.querySelector('.trainer-name');
  const pokeNameA = sideA.querySelector('.poke-name');
  const pokeNameB = sideB.querySelector('.poke-name');
  const ballA = document.getElementById('trade-ball-a');
  const ballB = document.getElementById('trade-ball-b');
  const statusLabel = document.getElementById('trade-status-label');

  nameA.textContent = `@${data.playerA}`;
  nameB.textContent = `@${data.playerB}`;
  pokeNameA.textContent = data.pokeA.toUpperCase();
  pokeNameB.textContent = data.pokeB.toUpperCase();
  
  spriteA.src = getSafeSprite(data.spriteA, data.fallbackA);
  spriteB.src = getSafeSprite(data.spriteB, data.fallbackB);
  
  spriteA.style.transform = 'scale(1)';
  spriteB.style.transform = 'scale(1)';
  spriteA.style.opacity = '1';
  spriteB.style.opacity = '1';
  
  ballA.style.display = 'none';
  ballB.style.display = 'none';
  ballA.style.left = '0';
  ballB.style.right = '0';
  
  statusLabel.textContent = `🤝 ESTABLISHING TRADE LINK FOR @${data.playerA.toUpperCase()} AND @${data.playerB.toUpperCase()}...`;
  overlay.classList.remove('hidden');
  
  // Step 1: Shrink sprites into Pokéballs
  setTimeout(() => {
    statusLabel.textContent = `⚡ CONVERTING POKÉMON INTO DIGITAL DATA STREAM...`;
    spriteA.style.transform = 'scale(0)';
    spriteB.style.transform = 'scale(0)';
    spriteA.style.opacity = '0';
    spriteB.style.opacity = '0';
    triggerScreenFlash();
    playSound(sfxHit); // Play conversion sound
  }, 1500);

  // Step 2: Show balls and slide swap
  setTimeout(() => {
    ballA.style.display = 'block';
    ballB.style.display = 'block';
    statusLabel.textContent = `🚀 INITIATING TRANS-MAP MOVEMENT SEGMENT...`;
    
    setTimeout(() => {
      ballA.style.left = 'calc(100% - 40px)';
      ballB.style.right = 'calc(100% - 40px)';
    }, 100);
  }, 2200);

  // Step 3: Reconstruct sprites swapped
  setTimeout(() => {
    statusLabel.textContent = `⚡ ARRIVAL DETECTED. RECONSTRUCTING POKÉMON SPATIAL FORMS...`;
    ballA.style.display = 'none';
    ballB.style.display = 'none';
    
    spriteA.src = getSafeSprite(data.spriteB, data.fallbackB);
    spriteB.src = getSafeSprite(data.spriteA, data.fallbackA);
    pokeNameA.textContent = data.pokeB.toUpperCase();
    pokeNameB.textContent = data.pokeA.toUpperCase();
    
    spriteA.style.transform = 'scale(1.3)';
    spriteB.style.transform = 'scale(1.3)';
    spriteA.style.opacity = '1';
    spriteB.style.opacity = '1';
    triggerScreenFlash();
    playSound(sfxEvolve); // Play triumphant evolution sound
    
    setTimeout(() => {
      spriteA.style.transform = 'scale(1)';
      spriteB.style.transform = 'scale(1)';
    }, 500);
    
    statusLabel.innerHTML = `<span style="color: #10b981;">🤝 TRADE SUCCESSFUL!</span><br/>@${data.playerA} received ${data.pokeB}!<br/>@${data.playerB} received ${data.pokeA}!`;
  }, 5200);

  // Step 4: Hide trade overlay
  setTimeout(() => {
    overlay.classList.add('hidden');
  }, 8500);
});



// Animates a stylized collision splash bubble in the center stage
function createRelashImpactPopup(damage, isCrit) {
  const clashCenter = document.getElementById('relay-clash-impact');
  if (!clashCenter) return;

  const bubble = document.createElement('div');
  bubble.className = 'clash-impact-bubble';
  bubble.style.position = 'absolute';
  bubble.style.transform = 'translate(-50%, -50%)';
  bubble.style.background = isCrit ? '#ef4444' : '#fbbf24';
  bubble.style.border = '2px solid #fff';
  bubble.style.borderRadius = '8px';
  bubble.style.padding = '5px 10px';
  bubble.style.color = '#fff';
  bubble.style.fontSize = isCrit ? '11px' : '9px';
  bubble.style.fontWeight = 'bold';
  bubble.style.boxShadow = '0 0 15px rgba(255,255,255,0.4)';
  bubble.style.whiteSpace = 'nowrap';
  bubble.style.zIndex = '1000';
  
  const textArr = isCrit ? ['💥 CRIT!', '💥 BOOM!', '💥 SLAM!'] : ['💥 POW!', '💥 HIT!', '💥 CLASH!'];
  const text = textArr[Math.floor(Math.random() * textArr.length)];
  bubble.textContent = `${text} -${damage}`;

  clashCenter.appendChild(bubble);

  // Animate splash boom popup
  const rot = Math.floor(Math.random() * 20) - 10;
  gsap.fromTo(bubble, 
    { scale: 0.1, rotation: rot, opacity: 1 }, 
    { 
      scale: 1.3, 
      y: -50,
      opacity: 0, 
      duration: 0.8, 
      ease: 'back.out(1.7)',
      onComplete: () => {
        bubble.remove();
      }
    }
  );
}

// Particle explosion for fainted exit cards
function createRelashFaintParticles(cardEl) {
  const clashCenter = document.getElementById('relay-clash-impact');
  if (!clashCenter || !cardEl) return;

  const cardRect = cardEl.getBoundingClientRect();
  const centerLeft = cardRect.left + cardRect.width / 2;
  const centerTop = cardRect.top + cardRect.height / 2;

  // Emit 25 small pixel particles
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.style.position = 'fixed';
    p.style.left = `${centerLeft}px`;
    p.style.top = `${centerTop}px`;
    p.style.width = '6px';
    p.style.height = '6px';
    p.style.background = Math.random() < 0.5 ? '#ef4444' : '#475569';
    p.style.borderRadius = '2px';
    p.style.zIndex = '2000';
    p.style.pointerEvents = 'none';

    document.body.appendChild(p);

    const destX = (Math.random() - 0.5) * 150;
    const destY = (Math.random() - 0.5) * 150 - 50;

    gsap.to(p, {
      x: destX,
      y: destY,
      opacity: 0,
      scale: 0.2,
      rotation: Math.random() * 360,
      duration: 1.0,
      ease: 'power2.out',
      onComplete: () => {
        p.remove();
      }
    });
  }
}
