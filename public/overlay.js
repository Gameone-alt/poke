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
  pokeball: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png',
  greatball: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png',
  ultraball: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png',
  masterball: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png'
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
  [sfxSpawn, sfxThrow, sfxCatchSuccess, sfxCatchFail, sfxHit, sfxEvolve].forEach(audio => {
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
      
      if (config.battleLeft && config.battleLeft !== 'auto' && config.battleTop && config.battleTop !== 'auto') {
        battleOverlay.style.transform = `translate(-50%, -50%) scale(${battleScale})`;
      } else {
        battleOverlay.style.transform = `scale(${battleScale})`;
      }
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
      if (config.showCardTypes === false) {
        wildPokemonTypes.classList.add('hidden');
      } else {
        wildPokemonTypes.classList.remove('hidden');
      }
    }

    // Catch Instruction Guide & Visibility
    updateCatchGuideDisplay();
  }

  // 5. Accent Color CSS Variable Override
  if (config.primaryColor) {
    document.documentElement.style.setProperty('--color-primary', config.primaryColor);
  }

  // 6. Custom CSS Overrides Injection
  let styleTag = document.getElementById('custom-theme-css');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'custom-theme-css';
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = config.customCss || '';
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

// Render dynamic CP, Weight, and Height stats in Pokemon GO style
function updateWildPokemonStats(poke) {
  if (!wildPokemonStats) return;
  
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

  if (state.leaderboard) {
    updateMarqueeTicker(state.leaderboard);
  }
});

// Wild Spawn Event
socket.on('pokemon_spawned', (poke) => {
  playSound(sfxSpawn);
  
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

  // 1. Create a dynamic flying ball
  const ball = document.createElement('img');
  ball.src = ballImage;
  ball.style.position = 'fixed';
  ball.style.width = '50px';
  ball.style.height = '50px';
  ball.style.zIndex = '9999';
  ball.style.pointerEvents = 'none';
  document.body.appendChild(ball);

  // Play throw sound
  playSound(sfxThrow);

  // Animate the throw from bottom-center of the screen
  const startX = window.innerWidth / 2;
  const startY = window.innerHeight;

  const throwAnim = ball.animate([
    { left: `${startX - 25}px`, top: `${startY}px`, transform: 'scale(1) rotate(0deg)' },
    { left: `${targetX - 25}px`, top: `${targetY - 25}px`, transform: 'scale(1.3) rotate(720deg)' }
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

    // Create landing ball at target location
    const landBall = document.createElement('img');
    landBall.src = ballImage;
    landBall.className = 'shaking'; // Uses existing CSS shaking animation!
    landBall.style.position = 'fixed';
    landBall.style.width = '45px';
    landBall.style.height = '45px';
    landBall.style.left = `${targetX - 22}px`;
    landBall.style.top = `${targetY - 22}px`;
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
function showDamagePopup(x, y, text, color = '#ef4444') {
  const popup = document.createElement('div');
  popup.textContent = text;
  popup.className = 'damage-popup-bounce';
  popup.style.position = 'fixed';
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
  document.body.appendChild(popup);
  
  setTimeout(() => popup.remove(), 1200);
}

const comicWords = ["BAM!", "POW!", "BOOM!", "CRACK!", "SMASH!", "WHACK!", "K.O.!"];
const comicColors = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899"];

function showComicPop(x, y, type = 'normal') {
  const popup = document.createElement('div');
  let word = comicWords[Math.floor(Math.random() * (comicWords.length - 1))];
  if (type === 'defeat') {
    word = "K.O.!";
  }
  
  popup.textContent = word;
  popup.className = 'comic-bubble';
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
  
  const color = comicColors[Math.floor(Math.random() * comicColors.length)];
  popup.style.backgroundColor = color;
  popup.style.border = '4px solid #000';
  
  document.body.appendChild(popup);
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

// Battle Start Event
socket.on('battle_start', (data) => {
  if (currentOverlayConfig.showBattleArena === false) return;
  playSound(sfxSpawn);
  
  // Clear any existing active battle simulation timers to prevent overlap
  activeBattleSimulationTimers.forEach(clearTimeout);
  activeBattleSimulationTimers = [];

  // Reset all fighter and arena classes
  challengerFighter.className = 'fighter left-fighter';
  opponentFighter.className = 'fighter right-fighter';
  impactFlash.classList.remove('impact-active');
  
  const battleField = document.querySelector('.battle-field');
  if (battleField) {
    battleField.className = 'battle-field';
  }
  
  // Get HP Bar Elements
  const challengerHpFill = document.getElementById('challenger-hp-fill');
  const challengerHpText = document.getElementById('challenger-hp-text');
  const opponentHpFill = document.getElementById('opponent-hp-fill');
  const opponentHpText = document.getElementById('opponent-hp-text');
  
  // Clear previous weather backdrops
  clearWeather();

  // Set initial HP, labels, and impact trails
  if (challengerHpFill) {
    challengerHpFill.style.width = '100%';
    challengerHpFill.style.backgroundColor = '#10b981';
  }
  if (challengerHpTrail) {
    challengerHpTrail.style.width = '100%';
  }
  if (challengerHpText) challengerHpText.textContent = `HP: ${data.challengerHp}/${data.challengerHp}`;
  
  if (opponentHpFill) {
    opponentHpFill.style.width = '100%';
    opponentHpFill.style.backgroundColor = '#10b981';
  }
  if (opponentHpTrail) {
    opponentHpTrail.style.width = '100%';
  }
  if (opponentHpText) opponentHpText.textContent = `HP: ${data.opponentHp}/${data.opponentHp}`;

  // Set text details
  challengerTrainer.textContent = `@${data.challenger}`;
  challengerPoke.textContent = data.challengerPoke;
  challengerSprite.src = data.challengerSprite;
  
  opponentTrainer.textContent = data.opponent === 'Wild' ? 'Wild Pokémon' : `@${data.opponent}`;
  opponentPoke.textContent = data.opponentPoke;
  opponentSprite.src = data.opponentSprite;
  
  battleStatusText.textContent = 'BATTLE START!';
  
  // Open battle board
  battleOverlay.classList.remove('hidden');
  
  // Slide in fighters
  challengerFighter.classList.add('slide-in-left');
  opponentFighter.classList.add('slide-in-right');
  
  // Phase 2: Strike Collision (after sliding in)
  const timer1 = setTimeout(() => {
    challengerFighter.classList.remove('slide-in-left');
    opponentFighter.classList.remove('slide-in-right');
    
    // Apply dynamic type strike style based on challenger typing
    if (battleField && data.challengerTypes && data.challengerTypes.length > 0) {
      const types = data.challengerTypes.map(t => t.toLowerCase());
      if (types.includes('fire')) battleField.classList.add('strike-fire');
      else if (types.includes('water')) battleField.classList.add('strike-water');
      else if (types.includes('grass')) battleField.classList.add('strike-grass');
      else if (types.includes('electric')) battleField.classList.add('strike-electric');
    }
    
    playSound(sfxHit);
    impactFlash.classList.add('impact-active');
    battleStatusText.textContent = 'FIGHT STARTED!';
    
    // Add screen shake effect to the overlay wrapper
    battleOverlay.style.animation = 'starBurstAnim 0.2s 2';
    const timerShake = setTimeout(() => {
      battleOverlay.style.animation = '';
    }, 400);
    activeBattleSimulationTimers.push(timerShake);

  }, 1200);
  activeBattleSimulationTimers.push(timer1);

  // Turn 1: Challenger strikes
  const timer2 = setTimeout(() => {
    impactFlash.classList.remove('impact-active');
    
    // Start fire/water/grass weather on screen based on strike element
    startWeatherEffect(data.challengerTypes);
    
    shootProjectile(challengerSprite, opponentSprite, data.challengerTypes, () => {
      challengerFighter.classList.add('fight-strike-left');
      setTimeout(() => challengerFighter.classList.remove('fight-strike-left'), 400);

      // Strike sound
      playSound(sfxHit);
      
      // Animate hit on opponent (Shake & Damage Flash)
      opponentFighter.classList.add('hit-shake', 'damage-flash');
      const timerFighterShake = setTimeout(() => {
        opponentFighter.classList.remove('hit-shake', 'damage-flash');
      }, 400);
      activeBattleSimulationTimers.push(timerFighterShake);

      // Opponent takes damage
      const damage = Math.round(data.opponentHp * (data.winner === 'challenger' ? 0.45 : 0.25));
      const newHp = Math.max(0, data.opponentHp - damage);
      const hpPercent = Math.max(0, (newHp / data.opponentHp) * 100);
      
      if (opponentHpFill) {
        opponentHpFill.style.width = `${hpPercent}%`;
        if (hpPercent < 30) opponentHpFill.style.backgroundColor = '#ef4444';
        else if (hpPercent < 60) opponentHpFill.style.backgroundColor = '#f59e0b';
      }
      // Delayed impact trail catch up
      if (opponentHpTrail) {
        setTimeout(() => {
          opponentHpTrail.style.width = `${hpPercent}%`;
        }, 400);
      }
      if (opponentHpText) opponentHpText.textContent = `HP: ${newHp}/${data.opponentHp}`;

      // Show floating damage text above Opponent Card
      const oppRect = opponentFighter.getBoundingClientRect();
      showDamagePopup(oppRect.left + oppRect.width / 2, oppRect.top - 20, `-${damage} HP!`);
      
      // Comic popup bubble
      showComicPop(oppRect.left + oppRect.width / 2, oppRect.top + oppRect.height / 2);

      // Show type effectiveness popup
      if (data.challengerMultiplier > 1) {
        showDamagePopup(oppRect.left + oppRect.width / 2, oppRect.top - 50, 'SUPER EFFECTIVE!', '#eab308');
      } else if (data.challengerMultiplier < 1) {
        showDamagePopup(oppRect.left + oppRect.width / 2, oppRect.top - 50, 'Not very effective...', '#94a3b8');
      }
    });

  }, 2000);
  activeBattleSimulationTimers.push(timer2);

  // Turn 2: Opponent strikes back
  const timer3 = setTimeout(() => {
    // Start weather on screen based on strike element
    startWeatherEffect(data.opponentTypes);
    
    shootProjectile(opponentSprite, challengerSprite, data.opponentTypes, () => {
      opponentFighter.classList.add('fight-strike-right');
      setTimeout(() => opponentFighter.classList.remove('fight-strike-right'), 400);

      // Strike sound
      playSound(sfxHit);
      
      // Animate hit on challenger (Shake & Damage Flash)
      challengerFighter.classList.add('hit-shake', 'damage-flash');
      const timerChalShake = setTimeout(() => {
        challengerFighter.classList.remove('hit-shake', 'damage-flash');
      }, 400);
      activeBattleSimulationTimers.push(timerChalShake);

      // Challenger takes damage
      const damage = Math.round(data.challengerHp * (data.winner === 'opponent' ? 0.45 : 0.25));
      const newHp = Math.max(0, data.challengerHp - damage);
      const hpPercent = Math.max(0, (newHp / data.challengerHp) * 100);
      
      if (challengerHpFill) {
        challengerHpFill.style.width = `${hpPercent}%`;
        if (hpPercent < 30) challengerHpFill.style.backgroundColor = '#ef4444';
        else if (hpPercent < 60) challengerHpFill.style.backgroundColor = '#f59e0b';
      }
      // Delayed impact trail catch up
      if (challengerHpTrail) {
        setTimeout(() => {
          challengerHpTrail.style.width = `${hpPercent}%`;
        }, 400);
      }
      if (challengerHpText) challengerHpText.textContent = `HP: ${newHp}/${data.challengerHp}`;

      // Show floating damage text above Challenger Card
      const chalRect = challengerFighter.getBoundingClientRect();
      showDamagePopup(chalRect.left + chalRect.width / 2, chalRect.top - 20, `-${damage} HP!`);
      
      // Comic popup bubble
      showComicPop(chalRect.left + chalRect.width / 2, chalRect.top + chalRect.height / 2);

      // Show type effectiveness popup
      if (data.opponentMultiplier > 1) {
        showDamagePopup(chalRect.left + chalRect.width / 2, chalRect.top - 50, 'SUPER EFFECTIVE!', '#eab308');
      } else if (data.opponentMultiplier < 1) {
        showDamagePopup(chalRect.left + chalRect.width / 2, chalRect.top - 50, 'Not very effective...', '#94a3b8');
      }
    });

  }, 3500);
  activeBattleSimulationTimers.push(timer3);

  // Turn 3: Final Blow!
  const timer4 = setTimeout(() => {
    if (data.winner === 'challenger') {
      startWeatherEffect(data.challengerTypes);
      
      shootProjectile(challengerSprite, opponentSprite, data.challengerTypes, () => {
        challengerFighter.classList.add('fight-strike-left');
        setTimeout(() => challengerFighter.classList.remove('fight-strike-left'), 400);

        playSound(sfxHit);
        
        // Shake & flash opponent
        opponentFighter.classList.add('hit-shake', 'damage-flash');
        
        // Opponent KO
        if (opponentHpFill) opponentHpFill.style.width = '0%';
        if (opponentHpTrail) {
          setTimeout(() => {
            opponentHpTrail.style.width = '0%';
          }, 400);
        }
        if (opponentHpText) opponentHpText.textContent = `HP: 0/${data.opponentHp}`;
        
        const oppRect = opponentFighter.getBoundingClientRect();
        showDamagePopup(oppRect.left + oppRect.width / 2, oppRect.top - 20, `KO!`, '#ef4444');
        
        // Comic popup bubble (K.O.)
        showComicPop(oppRect.left + oppRect.width / 2, oppRect.top + oppRect.height / 2, 'defeat');
        
        opponentFighter.classList.add('fight-defeat-right');
        battleStatusText.textContent = 'WINNER: CHALLENGER!';
        playSound(sfxCatchSuccess);
      });
    } else {
      startWeatherEffect(data.opponentTypes);
      
      shootProjectile(opponentSprite, challengerSprite, data.opponentTypes, () => {
        opponentFighter.classList.add('fight-strike-right');
        setTimeout(() => opponentFighter.classList.remove('fight-strike-right'), 400);

        playSound(sfxHit);
        
        // Shake & flash challenger
        challengerFighter.classList.add('hit-shake', 'damage-flash');
        
        // Challenger KO
        if (challengerHpFill) challengerHpFill.style.width = '0%';
        if (challengerHpTrail) {
          setTimeout(() => {
            challengerHpTrail.style.width = '0%';
          }, 400);
        }
        if (challengerHpText) challengerHpText.textContent = `HP: 0/${data.challengerHp}`;
        
        const chalRect = challengerFighter.getBoundingClientRect();
        showDamagePopup(chalRect.left + chalRect.width / 2, chalRect.top - 20, `KO!`, '#ef4444');
        
        // Comic popup bubble (K.O.)
        showComicPop(chalRect.left + chalRect.width / 2, chalRect.top + chalRect.height / 2, 'defeat');
        
        challengerFighter.classList.add('fight-defeat-left');
        battleStatusText.textContent = 'WINNER: OPPONENT!';
        playSound(sfxCatchFail);
      });
    }

  }, 5000);
  activeBattleSimulationTimers.push(timer4);
});

// Battle End Event (Handles cleanup)
socket.on('battle_end', (data) => {
  // We let the dynamic simulation finish its final hits, then hide the overlay after 3.0 seconds
  const timerEnd = setTimeout(() => {
    battleOverlay.classList.add('hidden');
    clearWeather();
    
    // Clear strike overlay indicators
    const battleField = document.querySelector('.battle-field');
    if (battleField) {
      battleField.className = 'battle-field';
    }
  }, 3000);
  activeBattleSimulationTimers.push(timerEnd);
});

// Evolution Animation Event
socket.on('pokemon_evolved', (data) => {
  playSound(sfxEvolve);
  
  evoSprite.src = getSafeSprite(data.spriteUrl, data.fallbackSpriteUrl);
  evoDesc.innerHTML = `<span class="cmd-text">@${data.displayName}</span>'s ${data.oldName} evolved into <span class="cmd-text">${data.newName}</span>!`;
  
  evolutionOverlay.classList.remove('hidden');
  
  // Rotate shiny sparkles on the circle
  let loopCount = 0;
  const sparklesInterval = setInterval(() => {
    if (!evolutionOverlay.classList.contains('hidden') && loopCount < 5) {
      // Trigger spark bursts centered on evolution
      triggerEvoSparkles();
      loopCount++;
    } else {
      clearInterval(sparklesInterval);
    }
  }, 800);

  setTimeout(() => {
    evolutionOverlay.classList.add('hidden');
  }, 4500);
});

function triggerEvoSparkles() {
  const container = document.querySelector('.evo-circle');
  if (!container) return;
  
  for (let i = 0; i < 15; i++) {
    const particle = document.createElement('div');
    particle.className = 'sparkle-particle';
    const size = Math.random() * 10 + 5;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${Math.random() * 80 + 10}%`;
    particle.style.top = `${Math.random() * 80 + 10}%`;
    particle.style.backgroundColor = '#a855f7';
    particle.style.borderRadius = '50%';
    particle.style.position = 'absolute';
    particle.style.boxShadow = '0 0 15px #c084fc';
    particle.style.animation = `starBurstAnim 1s ease-out forwards`;
    container.appendChild(particle);
    
    setTimeout(() => {
      particle.remove();
    }, 1000);
  }
}

// Level Up Event Listener
socket.on('player_level_up', (data) => {
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
socket.on('raid_start', (data) => {
  playSound(sfxSpawn);
  const raidOverlay = document.getElementById('raid-overlay');
  const sprite = document.getElementById('raid-boss-sprite');
  const name = document.getElementById('raid-boss-name');
  const hpFill = document.getElementById('raid-hp-fill');
  const hpText = document.getElementById('raid-hp-text');
  const list = document.getElementById('raid-contrib-list');
  
  if (!raidOverlay || !sprite || !name || !hpFill || !hpText || !list) return;
  
  sprite.src = getSafeSprite(data.spriteUrl, data.fallbackSpriteUrl);
  name.textContent = data.name;
  hpFill.style.width = '100%';
  hpText.textContent = `${data.maxHp} / ${data.maxHp} HP`;
  list.innerHTML = '<div style="color: #94a3b8; font-style: italic;">Attackers joining...</div>';
  
  raidOverlay.classList.remove('hidden');
});

socket.on('raid_hit', (data) => {
  playSound(sfxHit);
  const hpFill = document.getElementById('raid-hp-fill');
  const hpText = document.getElementById('raid-hp-text');
  const list = document.getElementById('raid-contrib-list');
  
  if (hpFill && hpText) {
    const percent = (data.currentHp / data.maxHp) * 100;
    hpFill.style.width = `${percent}%`;
    hpText.textContent = `${data.currentHp} / ${data.maxHp} HP`;
  }
  
  if (list && data.currentHp > 0) {
    // We don't have full participants data on hit inside this payload, but let's draw damage hit log
    list.innerHTML = `<div style="color: #e11d48; font-weight: 600;">💥 @${data.displayName}'s ${data.pokemonName} hit for ${data.damage}!</div>`;
  }
  
  const card = document.querySelector('.raid-card');
  if (card) {
    card.style.borderColor = '#ffffff';
    setTimeout(() => {
      card.style.borderColor = 'rgba(225, 29, 72, 0.4)';
    }, 150);
  }
});

socket.on('raid_end', (data) => {
  const hpFill = document.getElementById('raid-hp-fill');
  const hpText = document.getElementById('raid-hp-text');
  const list = document.getElementById('raid-contrib-list');
  
  if (data.victory) {
    playSound(sfxEvolve);
    if (hpFill && hpText) {
      hpFill.style.width = '0%';
      hpText.textContent = 'DEFEATED!';
    }
    if (list) {
      list.innerHTML = `<div style="color: #10b981; font-weight: 700;">🏆 Raid Defeated! Chat Wins!</div>`;
    }
  } else {
    playSound(sfxCatchFail);
    if (list) {
      list.innerHTML = `<div style="color: #64748b; font-style: italic;">Boss fled...</div>`;
    }
  }
  
  setTimeout(() => {
    const raidOverlay = document.getElementById('raid-overlay');
    if (raidOverlay) {
      raidOverlay.classList.add('hidden');
    }
  }, 4000);
});

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
