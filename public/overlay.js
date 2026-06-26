// Parse streamer channel query from URL or default to simulator
const urlParams = new URLSearchParams(window.location.search);
const channelId = urlParams.get('channel') || 'simulator';

// If deployed on Vercel, replace this string with your hosted Render URL
const BACKEND_URL = window.location.origin.includes('localhost') ? '' : 'https://pokemon-overlay-backend-hfpf.onrender.com';
const socket = io(BACKEND_URL, {
  query: { channelId }
});

// DOM References
const wildSpawnContainer = document.getElementById('wild-spawn-container');
const wildPokemonSprite = document.getElementById('wild-pokemon-sprite');
const wildPokemonName = document.getElementById('wild-pokemon-name');
const wildPokemonTypes = document.getElementById('wild-pokemon-types');
const wildShinyTag = document.getElementById('wild-shiny-tag');
const sparkleEmitter = document.getElementById('sparkle-emitter');

// Catch Anim references
const catchAnimOverlay = document.getElementById('catch-anim-overlay');
const catchTargetSprite = document.getElementById('catch-target-sprite');
const flyingBall = document.getElementById('flying-ball');
const landingBall = document.getElementById('landing-ball');
const starBurst = document.getElementById('star-burst');
const catchStatusMessage = document.getElementById('catch-status-message');

// Battle Arena references
const battleOverlay = document.getElementById('battle-overlay');
const challengerFighter = document.getElementById('fighter-challenger');
const opponentFighter = document.getElementById('fighter-opponent');
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
  ultraball: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png'
};

// Handle Image error fallback wrapper
function getSafeSprite(spriteUrl, fallbackUrl) {
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
  if (state.activeWildPokemon) {
    const poke = state.activeWildPokemon;
    wildPokemonSprite.src = getSafeSprite(poke.spriteUrl, poke.fallbackSpriteUrl);
    wildPokemonName.textContent = poke.name;
    renderTypes(wildPokemonTypes, poke.types);
    
    if (poke.isShiny) {
      wildShinyTag.classList.remove('hidden');
      triggerShinySparkles();
    } else {
      wildShinyTag.classList.add('hidden');
    }
    wildSpawnContainer.classList.remove('hidden');
  }
});

// Wild Spawn Event
socket.on('pokemon_spawned', (poke) => {
  playSound(sfxSpawn);
  
  wildPokemonSprite.src = getSafeSprite(poke.spriteUrl, poke.fallbackSpriteUrl);
  wildPokemonName.textContent = poke.name;
  renderTypes(wildPokemonTypes, poke.types);
  
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
  const ballImage = BALL_SPRITES[data.ballType] || BALL_SPRITES.pokeball;
  
  // Setup overlay sprites
  catchTargetSprite.src = getSafeSprite(data.spriteUrl, data.fallbackSpriteUrl);
  catchTargetSprite.classList.remove('hidden');
  flyingBall.src = ballImage;
  landingBall.src = ballImage;
  
  // Display catch board
  catchAnimOverlay.classList.remove('hidden');
  
  // Phase 1: Throw ball
  playSound(sfxThrow);
  flyingBall.classList.remove('hidden');
  flyingBall.classList.add('throwing');
  
  setTimeout(() => {
    // Phase 2: Ball Lands
    flyingBall.classList.remove('throwing');
    flyingBall.classList.add('hidden');
    
    catchTargetSprite.classList.add('hidden'); // Pokémon enters ball
    landingBall.classList.remove('hidden');
    landingBall.classList.add('shaking');
    catchStatusMessage.textContent = 'SHAKING...';
    
    // Simulate Pokeball shaking sounds
    const shakeSoundTimer = setInterval(() => {
      if (landingBall.classList.contains('shaking')) {
        playSound(sfxSpawn); // Use lower pitch sound or spawn click
      } else {
        clearInterval(shakeSoundTimer);
      }
    }, 600);

    setTimeout(() => {
      // Phase 3: Success Burst
      clearInterval(shakeSoundTimer);
      landingBall.classList.remove('shaking');
      
      playSound(sfxCatchSuccess);
      starBurst.classList.add('star-burst-active');
      catchStatusMessage.textContent = 'CAUGHT!';
      
      setTimeout(() => {
        // Close overlays and remove card
        catchAnimOverlay.classList.add('hidden');
        wildSpawnContainer.classList.add('hidden');
        // Reset sprites
        starBurst.classList.remove('star-burst-active');
        landingBall.classList.add('hidden');
      }, 2500);
      
    }, 1800); // 3 shakes * 0.6s
    
  }, 1100); // Wait for ball flight path
});

// Catch Fail Animation Sequence
socket.on('catch_fail', (data) => {
  const ballImage = BALL_SPRITES[data.ballType] || BALL_SPRITES.pokeball;
  
  catchTargetSprite.src = getSafeSprite(data.spriteUrl, data.fallbackSpriteUrl);
  catchTargetSprite.classList.remove('hidden');
  flyingBall.src = ballImage;
  landingBall.src = ballImage;
  
  catchAnimOverlay.classList.remove('hidden');
  
  // Phase 1: Throw ball
  playSound(sfxThrow);
  flyingBall.classList.remove('hidden');
  flyingBall.classList.add('throwing');
  
  setTimeout(() => {
    // Phase 2: Lands
    flyingBall.classList.remove('throwing');
    flyingBall.classList.add('hidden');
    
    catchTargetSprite.classList.add('hidden');
    landingBall.classList.remove('hidden');
    landingBall.classList.add('shaking');
    catchStatusMessage.textContent = 'SHAKING...';
    
    setTimeout(() => {
      // Phase 3: Fail Breakout
      landingBall.classList.remove('shaking');
      landingBall.classList.add('hidden');
      
      playSound(sfxCatchFail);
      catchTargetSprite.classList.remove('hidden'); // Pokemon pops back out
      catchStatusMessage.textContent = 'BROKE FREE!';
      
      setTimeout(() => {
        catchAnimOverlay.classList.add('hidden');
      }, 2000);
      
    }, 1200); // 2 shakes
    
  }, 1100);
});

// Battle Start Event
socket.on('battle_start', (data) => {
  playSound(sfxSpawn);
  
  // Reset all fighter classes
  challengerFighter.className = 'fighter left-fighter';
  opponentFighter.className = 'fighter right-fighter';
  impactFlash.classList.remove('impact-active');
  
  // Set data
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
  setTimeout(() => {
    challengerFighter.classList.remove('slide-in-left');
    opponentFighter.classList.remove('slide-in-right');
    
    // Trigger physical hits
    challengerFighter.classList.add('fight-strike-left');
    opponentFighter.classList.add('fight-strike-right');
    
    playSound(sfxHit);
    impactFlash.classList.add('impact-active');
    battleStatusText.textContent = 'COLLIDING... FIGHT!';
    
    // Add screen shake effect to the overlay wrapper
    battleOverlay.style.animation = 'starBurstAnim 0.2s 2';
    setTimeout(() => {
      battleOverlay.style.animation = '';
    }, 400);

  }, 1200);
});

// Battle End Event
socket.on('battle_end', (data) => {
  challengerFighter.classList.remove('fight-strike-left');
  opponentFighter.classList.remove('fight-strike-right');
  
  // Handle defeat animation
  if (data.winner === 'challenger') {
    // Opponent is defeated
    opponentFighter.classList.add('fight-defeat-right');
    battleStatusText.textContent = 'WINNER: CHALLENGER!';
    playSound(sfxCatchSuccess);
  } else {
    // Challenger is defeated
    challengerFighter.classList.add('fight-defeat-left');
    battleStatusText.textContent = 'WINNER: OPPONENT!';
    playSound(sfxCatchFail);
  }
  
  // Hide battle overlay after some time
  setTimeout(() => {
    battleOverlay.classList.add('hidden');
    // If winner evolved, evolution screen triggers next automatically
  }, 2500);
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
