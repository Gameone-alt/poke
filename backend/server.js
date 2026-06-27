require('dotenv').config();
const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const db = require('./db');
const youtube = require('./youtube');
const twitch = require('./twitch');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow connections from Vercel static deployments
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// CORS middleware — required for cross-origin requests from Vercel to Render
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Serve public directory
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Routes to explicitly serve overlay and dashboard (for local testing)
app.get('/overlay', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'overlay.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

// HTTP POST endpoint for external chat relays (like Streamer.bot C# actions)
app.post('/api/chat', async (req, res) => {
  const { channelId, username, displayName, messageText } = req.body;
  if (!channelId || !username || !messageText) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    console.log(`[API Chat Relay] [${channelId}] ${displayName || username}: ${messageText}`);
    const reply = await processCommand(channelId.toLowerCase().trim(), username, displayName || username, messageText);
    res.status(200).json({ success: true, reply });
  } catch (err) {
    console.error('[API Chat Relay] Error processing command:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Load Static Pokémon Database
let pokemonDb = {};
const POKEMON_DB_FILE = path.join(__dirname, 'data', 'pokemon.json');

function loadPokemonDb() {
  if (fs.existsSync(POKEMON_DB_FILE)) {
    try {
      pokemonDb = JSON.parse(fs.readFileSync(POKEMON_DB_FILE, 'utf-8'));
      console.log(`[Server] Loaded ${Object.keys(pokemonDb).length} Pokémon from database.`);
    } catch (err) {
      console.error('[Server] Failed parsing pokemon.json:', err.message);
      pokemonDb = {};
    }
  } else {
    console.warn('[Server] WARNING: pokemon.json not found! Please run the seeding script: npm run seed');
  }
}
loadPokemonDb();

// Active multi-tenant sessions: Map<channelId, SessionState>
const activeSessions = new Map();

/**
 * Gets or initializes a streamer's session state.
 */
function getOrCreateSession(channelId) {
  const cid = channelId.toLowerCase().trim();
  if (!activeSessions.has(cid)) {
    activeSessions.set(cid, {
      channelId: cid,
      activeWildPokemon: null,
      wildDespawnTimer: null,
      spawnIntervalTimer: null,
      activeChallenge: null,
      activeBattle: null,
      config: {
        channelId: cid,
        videoId: '',
        spawnIntervalMs: 60000,
        wildDespawnTimeoutMs: 45000,
        catchCooldownMs: 15000,
        shinyChance: 0.01
      },
      isInitialized: false,
      isInitializing: false,
      initializationPromise: null
    });
  }
  return activeSessions.get(cid);
}

/**
 * Clean up session and free system memory when a streamer is offline.
 */
function cleanupSession(channelId) {
  const cid = channelId.toLowerCase().trim();
  const session = activeSessions.get(cid);
  if (session) {
    console.log(`[Session] [${cid}] Cleaning up inactive session state...`);
    if (session.wildDespawnTimer) clearTimeout(session.wildDespawnTimer);
    if (session.spawnIntervalTimer) clearInterval(session.spawnIntervalTimer);
    
    youtube.stopYoutubeChat(cid);
    twitch.stopTwitchChat(cid);
    activeSessions.delete(cid);
  }
}

// Helper to send game logs to a specific overlay room
function sendGameLog(channelId, type, text) {
  io.to(channelId).emit('game_log', {
    id: Math.random().toString(36).substring(2, 9),
    type: type, // 'spawn', 'capture', 'battle', 'evolution', 'system'
    text: text,
    timestamp: Date.now()
  });
}

// Spawn Wild Pokémon for a specific session
async function spawnWildPokemon(channelId) {
  const session = getOrCreateSession(channelId);
  const pokemonIds = Object.keys(pokemonDb);
  if (pokemonIds.length === 0) {
    console.warn(`[Game Loop] [${channelId}] Cannot spawn: Pokemon database is empty.`);
    return;
  }

  // Clear previous despawn timer
  if (session.wildDespawnTimer) clearTimeout(session.wildDespawnTimer);

  let targetPoke = null;
  
  // Resolve manual spawn target if configured
  if (session.config.spawnTarget) {
    const cleanTarget = session.config.spawnTarget.toLowerCase().trim();
    // Search by ID or Name
    const foundId = pokemonIds.find(id => {
      const p = pokemonDb[id];
      return id === cleanTarget || p.name.toLowerCase() === cleanTarget;
    });
    if (foundId) {
      targetPoke = pokemonDb[foundId];
      console.log(`[Game Loop] [${channelId}] Resolving manual target spawn: ${targetPoke.name}`);
      
      // Reset spawnTarget in config and database so it reverts to random next time
      session.config.spawnTarget = '';
      try {
        await db.saveStreamerConfig(channelId, session.config);
        io.to(channelId).emit('config_updated', session.config);
      } catch (err) {
        console.error('[Game Loop] Failed to auto-clear spawn target:', err.message);
      }
    } else {
      console.warn(`[Game Loop] [${channelId}] Manual spawn target "${session.config.spawnTarget}" not found in Pokémon DB.`);
    }
  }

  const basePoke = targetPoke || pokemonDb[pokemonIds[Math.floor(Math.random() * pokemonIds.length)]];
  
  const isShiny = Math.random() < session.config.shinyChance;
  const sprite = isShiny ? basePoke.shinySpriteUrl : basePoke.spriteUrl;
  const fallbackSprite = isShiny ? basePoke.fallbackShinySpriteUrl : basePoke.fallbackSpriteUrl;

  session.activeWildPokemon = {
    ...basePoke,
    isShiny: isShiny,
    spriteUrl: sprite,
    fallbackSpriteUrl: fallbackSprite,
    spawnedAt: Date.now()
  };

  console.log(`[Game Loop] [${channelId}] Spawned: ${isShiny ? '✨ Shiny ' : ''}${basePoke.name}`);
  
  io.to(channelId).emit('pokemon_spawned', {
    id: session.activeWildPokemon.id,
    name: session.activeWildPokemon.name,
    types: session.activeWildPokemon.types,
    isShiny: isShiny,
    spriteUrl: sprite,
    fallbackSpriteUrl: fallbackSprite,
    catchRate: session.activeWildPokemon.catchRate
  });

  sendGameLog(channelId, 'spawn', `🌟 A wild ${isShiny ? '✨ Shiny ' : ''}${basePoke.name} has spawned! Type 'catch' to capture it!`);

  // Set despawn timer
  session.wildDespawnTimer = setTimeout(() => {
    if (session.activeWildPokemon) {
      console.log(`[Game Loop] [${channelId}] Wild ${session.activeWildPokemon.name} fled.`);
      sendGameLog(channelId, 'spawn', `💨 The wild ${session.activeWildPokemon.isShiny ? '✨ Shiny ' : ''}${session.activeWildPokemon.name} fled into the grass.`);
      io.to(channelId).emit('pokemon_despawned', { id: session.activeWildPokemon.id });
      session.activeWildPokemon = null;
    }
  }, session.config.wildDespawnTimeoutMs);
}

// Start the Spawn Loop for a specific session
function startSpawnLoop(channelId) {
  const session = getOrCreateSession(channelId);
  if (session.spawnIntervalTimer) clearInterval(session.spawnIntervalTimer);
  
  session.spawnIntervalTimer = setInterval(() => spawnWildPokemon(channelId), session.config.spawnIntervalMs);
  
  // Spawn the first wild Pokémon after a brief delay
  setTimeout(() => {
    // Verify room is still active before spawning
    if (activeSessions.has(channelId)) {
      spawnWildPokemon(channelId);
    }
  }, 5000);
}

// Type Advantage Matrix (Gen 1-3 simplified)
const TYPE_ADVANTAGES = {
  fire: { water: 0.5, grass: 2.0, ice: 2.0, bug: 2.0, steel: 2.0, fire: 0.5, rock: 0.5, dragon: 0.5 },
  water: { fire: 2.0, grass: 0.5, ground: 2.0, rock: 2.0, water: 0.5, dragon: 0.5 },
  grass: { fire: 0.5, water: 2.0, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, rock: 2.0, ground: 2.0, steel: 0.5, dragon: 0.5 },
  electric: { water: 2.0, electric: 0.5, grass: 0.5, ground: 0, flying: 2.0, dragon: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2.0, ice: 0.5, ground: 2.0, flying: 2.0, dragon: 2.0, steel: 0.5 },
  fighting: { normal: 2.0, ice: 2.0, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2.0, ghost: 0, dark: 2.0, steel: 2.0 },
  poison: { grass: 2.0, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground: { fire: 2.0, grass: 0.5, electric: 2.0, poison: 2.0, flying: 0, bug: 0.5, rock: 2.0, steel: 2.0 },
  flying: { grass: 2.0, electric: 0.5, fighting: 2.0, bug: 2.0, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2.0, poison: 2.0, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2.0, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2.0, ghost: 0.5, dark: 2.0, steel: 0.5 },
  rock: { fire: 2.0, ice: 2.0, fighting: 0.5, ground: 0.5, flying: 2.0, bug: 2.0, steel: 0.5 },
  ghost: { normal: 0, psychic: 2.0, ghost: 2.0, dark: 0.5 },
  dragon: { dragon: 2.0, steel: 0.5 },
  dark: { fighting: 0.5, psychic: 2.0, ghost: 2.0, dark: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2.0, rock: 2.0, steel: 0.5 },
  normal: { rock: 0.5, ghost: 0, steel: 0.5 }
};

function getCombatMultiplier(attackerTypes, defenderTypes) {
  let multiplier = 1.0;
  for (const aType of attackerTypes) {
    for (const dType of defenderTypes) {
      if (TYPE_ADVANTAGES[aType] && TYPE_ADVANTAGES[aType][dType] !== undefined) {
        multiplier *= TYPE_ADVANTAGES[aType][dType];
      }
    }
  }
  return Math.min(Math.max(multiplier, 0.25), 2.5);
}

// Execute Battle between two players in a room
async function runBattle(channelId, playerA, playerB) {
  const session = getOrCreateSession(channelId);
  const isWildBattle = playerB === 'wild';
  
  const userA = await db.getUser(channelId, playerA.username, playerA.displayName);
  const pokeA = userA.inventory.find(p => p.instanceId === playerA.pokemonInstanceId);
  
  let userB = null;
  let pokeB = null;
  let opponentName = '';
  
  if (isWildBattle) {
    if (!session.activeWildPokemon) {
      sendGameLog(channelId, 'system', `❌ Battle failed: No wild Pokémon is active.`);
      session.activeBattle = null;
      return;
    }
    pokeB = {
      name: session.activeWildPokemon.isShiny ? `✨ Shiny ${session.activeWildPokemon.name}` : session.activeWildPokemon.name,
      types: session.activeWildPokemon.types,
      baseStats: session.activeWildPokemon.stats,
      shiny: session.activeWildPokemon.isShiny,
      spriteUrl: session.activeWildPokemon.spriteUrl,
      fallbackSpriteUrl: session.activeWildPokemon.fallbackSpriteUrl
    };
    opponentName = 'Wild Pokémon';
  } else {
    userB = await db.getUser(channelId, playerB.username, playerB.displayName);
    pokeB = userB.inventory.find(p => p.instanceId === playerB.pokemonInstanceId);
    opponentName = `@${userB.displayName}`;
  }

  if (!pokeA || !pokeB) {
    sendGameLog(channelId, 'system', `❌ Battle failed: Active Pokémon not found.`);
    session.activeBattle = null;
    return;
  }

  session.activeBattle = {
    challenger: playerA,
    opponent: isWildBattle ? { username: 'wild', displayName: 'Wild Pokémon' } : playerB,
    challengerPoke: pokeA,
    opponentPoke: pokeB,
    status: 'animating'
  };

  const lookupA = pokemonDb[pokeA.pokemonId];
  const spriteA = pokeA.shiny ? lookupA?.shinySpriteUrl : lookupA?.spriteUrl;
  const fallbackA = pokeA.shiny ? lookupA?.fallbackShinySpriteUrl : lookupA?.fallbackSpriteUrl;

  let spriteB, fallbackB;
  if (isWildBattle) {
    spriteB = session.activeWildPokemon.spriteUrl;
    fallbackB = session.activeWildPokemon.fallbackSpriteUrl;
  } else {
    const lookupB = pokemonDb[pokeB.pokemonId];
    spriteB = pokeB.shiny ? lookupB?.shinySpriteUrl : lookupB?.spriteUrl;
    fallbackB = pokeB.shiny ? lookupB?.fallbackShinySpriteUrl : lookupB?.fallbackSpriteUrl;
  }

  // Trigger battle overlay
  io.to(channelId).emit('battle_start', {
    challenger: playerA.displayName,
    opponent: isWildBattle ? 'Wild' : playerB.displayName,
    challengerSprite: spriteA,
    challengerFallback: fallbackA,
    opponentSprite: spriteB,
    opponentFallback: fallbackB,
    challengerTypes: pokeA.types,
    opponentTypes: pokeB.types,
    challengerPoke: pokeA.name,
    opponentPoke: pokeB.name
  });

  sendGameLog(channelId, 'battle', `⚔️ Battle Started: @${playerA.displayName}'s ${pokeA.name} vs ${opponentName}'s ${pokeB.name}!`);

  const getBasePower = (p) => (p.baseStats.hp * 0.2) + (p.baseStats.attack * 0.4) + (p.baseStats.defense * 0.3) + (p.baseStats.speed * 0.1);
  const powerA = getBasePower(pokeA);
  const powerB = getBasePower(pokeB);

  const multA = getCombatMultiplier(pokeA.types, pokeB.types);
  const multB = getCombatMultiplier(pokeB.types, pokeA.types);

  const varianceA = 0.85 + Math.random() * 0.30;
  const varianceB = 0.85 + Math.random() * 0.30;

  const finalPowerA = powerA * multA * varianceA;
  const finalPowerB = powerB * multB * varianceB;

  const winner = finalPowerA >= finalPowerB ? 'challenger' : 'opponent';
  
  setTimeout(async () => {
    // Guard clause: ensure the session still exists
    if (!activeSessions.has(channelId)) return;
    
    let resultMessage = '';
    let winnerName = '';
    let loserName = '';
    
    if (winner === 'challenger') {
      winnerName = `@${playerA.displayName}`;
      loserName = opponentName;
      resultMessage = `🏆 ${winnerName}'s ${pokeA.name} defeated ${loserName}'s ${pokeB.name}! (${Math.round(finalPowerA)} vs ${Math.round(finalPowerB)} Power)`;
      
      const evoResult = await db.addWin(channelId, playerA.username, pokeA.instanceId, pokemonDb);
      
      // Award XP & Coins to challenger for winning the battle
      await addXPAndCoins(channelId, playerA.username, playerA.displayName, 30, 40);
      
      io.to(channelId).emit('battle_end', { winner: 'challenger', evolved: evoResult?.evolved });
      sendGameLog(channelId, 'battle', resultMessage);
      
      if (evoResult && evoResult.evolved) {
        const evoMsg = `✨ Evolution: @${playerA.displayName}'s ${evoResult.oldName} evolved into ${evoResult.newName}!`;
        sendGameLog(channelId, 'evolution', evoMsg);
        io.to(channelId).emit('pokemon_evolved', {
          displayName: playerA.displayName,
          oldName: evoResult.oldName,
          newName: evoResult.newName,
          spriteUrl: pokeA.shiny ? pokemonDb[pokeA.pokemonId]?.shinySpriteUrl : pokemonDb[pokeA.pokemonId]?.spriteUrl,
          fallbackSpriteUrl: pokeA.shiny ? pokemonDb[pokeA.pokemonId]?.fallbackShinySpriteUrl : pokemonDb[pokeA.pokemonId]?.fallbackSpriteUrl
        });
      }
    } else {
      winnerName = opponentName;
      loserName = `@${playerA.displayName}`;
      resultMessage = `🏆 ${winnerName}'s ${pokeB.name} defeated ${loserName}'s ${pokeA.name}! (${Math.round(finalPowerB)} vs ${Math.round(finalPowerA)} Power)`;
      
      if (!isWildBattle) {
        const evoResult = await db.addWin(channelId, playerB.username, pokeB.instanceId, pokemonDb);
        
        // Award XP & Coins to opponent player for winning
        await addXPAndCoins(channelId, playerB.username, playerB.displayName, 30, 40);
        
        io.to(channelId).emit('battle_end', { winner: 'opponent', evolved: evoResult?.evolved });
        sendGameLog(channelId, 'battle', resultMessage);
        
        if (evoResult && evoResult.evolved) {
          const evoMsg = `✨ Evolution: @${playerB.displayName}'s ${evoResult.oldName} evolved into ${evoResult.newName}!`;
          sendGameLog(channelId, 'evolution', evoMsg);
          io.to(channelId).emit('pokemon_evolved', {
            displayName: playerB.displayName,
            oldName: evoResult.oldName,
            newName: evoResult.newName,
            spriteUrl: pokeB.shiny ? pokemonDb[pokeB.pokemonId]?.shinySpriteUrl : pokemonDb[pokeB.pokemonId]?.spriteUrl,
            fallbackSpriteUrl: pokeB.shiny ? pokemonDb[pokeB.pokemonId]?.fallbackShinySpriteUrl : pokemonDb[pokeB.pokemonId]?.fallbackSpriteUrl
          });
        }
      } else {
        io.to(channelId).emit('battle_end', { winner: 'opponent', evolved: false });
        sendGameLog(channelId, 'battle', resultMessage);
      }
    }

    session.activeBattle = null;
    session.activeChallenge = null;
    
    io.to(channelId).emit('leaderboard_update', await db.getLeaderboard(channelId));
  }, 4000);
}

/**
 * Progression Helper: Awards XP and Coins to a trainer. Handles leveling up.
 */
async function addXPAndCoins(channelId, username, displayName, xpAmount, coinsAmount) {
  try {
    const user = await db.getUser(channelId, username, displayName);
    user.xp += xpAmount;
    user.coins += coinsAmount;
    
    let leveledUp = false;
    // Level up calculation: level * 100
    while (user.xp >= user.level * 100) {
      user.xp -= user.level * 100;
      user.level += 1;
      leveledUp = true;
      
      // Level up rewards: 3 Great Balls, 1 Ultra Ball, 100 coins
      user.balls.greatball += 3;
      user.balls.ultraball += 1;
      user.coins += 100;
    }
    
    await db.saveUser(channelId, user);
    
    io.to(channelId).emit('balls_updated', { username, balls: user.balls });
    
    if (leveledUp) {
      const lvlMsg = `⭐ LEVEL UP! @${user.displayName} reached Trainer Level ${user.level}! Received: 3 Great Balls, 1 Ultra Ball, 100 Coins.`;
      sendGameLog(channelId, 'system', lvlMsg);
      io.to(channelId).emit('player_level_up', {
        username: user.username,
        displayName: user.displayName,
        level: user.level,
        coinsReward: 100
      });
    }
    
    return { leveledUp, level: user.level, xp: user.xp, coins: user.coins };
  } catch (err) {
    console.error(`[Progression] Error adding XP/coins to ${username}:`, err.message);
    return null;
  }
}

// Master command processing function
async function processCommand(channelId, username, displayName, messageText) {
  const session = getOrCreateSession(channelId);
  const cleanMsg = messageText.toLowerCase().trim();
  
  // 1. !daily command
  if (cleanMsg === '!daily' || cleanMsg === 'daily') {
    const result = await db.claimDaily(channelId, username, displayName);
    if (result.success) {
      const msg = `🎁 @${displayName} claimed their daily allowance! Received: 10 Pokéballs, 3 Great Balls, 1 Ultra Ball.`;
      sendGameLog(channelId, 'system', msg);
      io.to(channelId).emit('balls_updated', { username, balls: result.newTotal });
      return msg;
    } else {
      const msg = `❌ @${displayName}, you can claim your daily reward again in ${result.hours}h ${result.minutes}m.`;
      io.to(channelId).emit('command_feedback', { 
        username, 
        text: msg 
      });
      return msg;
    }
  }

  // 2. !inventory command
  if (cleanMsg === '!inventory' || cleanMsg === 'inventory' || cleanMsg === '!pokebox' || cleanMsg === 'pokebox') {
    const user = await db.getUser(channelId, username, displayName);
    const invCount = user.inventory.length;
    const active = user.inventory.find(p => p.instanceId === user.activePokemonId);
    const activeText = active ? `Active: ${active.name} (${active.wins} wins)` : 'None';
    
    // Check buddy
    const buddy = user.inventory.find(p => p.instanceId === user.buddyInstanceId);
    const buddyText = buddy ? ` | Buddy: ${buddy.name}` : '';

    const msg = `🎒 @${displayName} (Lv.${user.level} | ${user.xp}/${user.level * 100} XP): owns ${invCount} Pokémon. ${activeText}${buddyText} | Coins: 🪙 ${user.coins} | Balls: ${user.balls.pokeball} Poké, ${user.balls.greatball} Great, ${user.balls.ultraball} Ultra, ${user.balls.masterball} Master.`;
    
    io.to(channelId).emit('command_feedback', {
      username,
      text: msg
    });
    return msg;
  }

  // 3. !select command
  if (cleanMsg.startsWith('!select ') || cleanMsg.startsWith('select ')) {
    const query = cleanMsg.replace('!select ', '').replace('select ', '').trim();
    const result = await db.selectActivePokemon(channelId, username, query);
    
    if (result.success) {
      const msg = `✅ @${displayName} selected ${result.pokemon.name} as their active combat partner!`;
      io.to(channelId).emit('command_feedback', {
        username,
        text: msg
      });
      io.to(channelId).emit('leaderboard_update', await db.getLeaderboard(channelId));
      return msg;
    } else {
      const msg = `❌ @${displayName}, error: ${result.message}`;
      io.to(channelId).emit('command_feedback', {
        username,
        text: msg
      });
      return msg;
    }
  }

  // 4. !catch command
  if (cleanMsg === '!catch' || cleanMsg === 'catch' || cleanMsg.startsWith('!catch ') || cleanMsg.startsWith('catch ')) {
    if (!session.activeWildPokemon) {
      return `❌ @${displayName}, no wild Pokémon is active to catch right now!`;
    }

    const user = await db.getUser(channelId, username, displayName);
    const now = Date.now();

    // Check catch cooldown
    if (now - user.lastCatchAttempt < session.config.catchCooldownMs) {
      const remain = Math.ceil((session.config.catchCooldownMs - (now - user.lastCatchAttempt)) / 1000);
      const msg = `⏳ @${displayName}, catch cooldown! Wait ${remain}s.`;
      io.to(channelId).emit('command_feedback', {
        username,
        text: msg
      });
      return msg;
    }

    // Determine ball type used
    let ballType = 'pokeball';
    if (cleanMsg.includes('great')) ballType = 'greatball';
    else if (cleanMsg.includes('ultra')) ballType = 'ultraball';
    else if (cleanMsg.includes('master')) ballType = 'masterball';

    // Verify ball balance
    if (user.balls[ballType] <= 0) {
      const msg = `❌ @${displayName}, you do not have any ${ballType}s left! Check '!shop' to buy more.`;
      io.to(channelId).emit('command_feedback', {
        username,
        text: msg
      });
      return msg;
    }

    // Deduct ball
    user.balls[ballType] -= 1;
    user.lastCatchAttempt = now;
    await db.saveUser(channelId, user);

    let multiplier = 1.0;
    if (ballType === 'greatball') multiplier = 1.5;
    else if (ballType === 'ultraball') multiplier = 2.0;
    else if (ballType === 'masterball') multiplier = 100.0; // Auto-catch!

    const baseCatchRate = session.activeWildPokemon.catchRate;
    const finalCatchRate = baseCatchRate * multiplier;
    const success = Math.random() < finalCatchRate;

    if (success) {
      if (session.wildDespawnTimer) clearTimeout(session.wildDespawnTimer);
      
      const isShiny = session.activeWildPokemon.isShiny;
      await db.addPokemon(channelId, username, displayName, session.activeWildPokemon, isShiny);
      
      // Award XP & Coins for successful catch
      const rewardXp = isShiny ? 50 : 15;
      const rewardCoins = isShiny ? 100 : 20;
      await addXPAndCoins(channelId, username, displayName, rewardXp, rewardCoins);
      
      io.to(channelId).emit('catch_success', {
        username,
        displayName,
        pokemonName: session.activeWildPokemon.name,
        isShiny: isShiny,
        ballType: ballType,
        spriteUrl: session.activeWildPokemon.spriteUrl,
        fallbackSpriteUrl: session.activeWildPokemon.fallbackSpriteUrl
      });
      
      const msg = `🎉 @${displayName} captured the wild ${isShiny ? '✨ Shiny ' : ''}${session.activeWildPokemon.name} using a ${ballType}! (+${rewardXp} XP, +🪙 ${rewardCoins} coins)`;
      sendGameLog(channelId, 'capture', msg);
      
      session.activeWildPokemon = null; // Clear wild slot
      io.to(channelId).emit('balls_updated', { username, balls: user.balls });
      io.to(channelId).emit('leaderboard_update', await db.getLeaderboard(channelId));
      return msg;
    } else {
      io.to(channelId).emit('catch_fail', {
        username,
        displayName,
        pokemonName: session.activeWildPokemon.name,
        ballType: ballType
      });
      const msg = `💨 @${displayName} threw a ${ballType} but the wild ${session.activeWildPokemon.name} broke free!`;
      sendGameLog(channelId, 'capture', msg);
      
      io.to(channelId).emit('balls_updated', { username, balls: user.balls });
      io.to(channelId).emit('leaderboard_update', await db.getLeaderboard(channelId));
      return msg;
    }
  }

  // 5. !fight command
  if (cleanMsg.startsWith('!fight') || cleanMsg.startsWith('fight')) {
    if (session.activeBattle) {
      const msg = `❌ @${displayName}, a battle is already in progress on screen!`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }

    // Parse parameters
    const parts = messageText.trim().split(/\s+/);
    if (parts.length < 3) {
      const msg = `❌ @${displayName}, syntax: !fight @username [pokemon_name] OR !fight wild [pokemon_name]`;
      io.to(channelId).emit('command_feedback', { 
        username, 
        text: msg 
      });
      return msg;
    }

    const rawTarget = parts[1].replace('@', '').toLowerCase().trim();
    const pokemonQuery = parts.slice(2).join(' ').toLowerCase().trim();

    const challenger = await db.getUser(channelId, username, displayName);
    const foundPokeA = challenger.inventory.find(p => 
      p.name.toLowerCase().replace('✨ shiny ', '') === pokemonQuery || 
      p.originalName.toLowerCase() === pokemonQuery
    );

    if (!foundPokeA) {
      const msg = `❌ @${displayName}, you do not have a "${pokemonQuery}" in your inventory to fight with!`;
      io.to(channelId).emit('command_feedback', { 
        username, 
        text: msg 
      });
      return msg;
    }

    // Handle fight wild
    if (rawTarget === 'wild') {
      if (!session.activeWildPokemon) {
        const msg = `❌ @${displayName}, there is no wild Pokémon active to fight right now.`;
        io.to(channelId).emit('command_feedback', { username, text: msg });
        return msg;
      }
      runBattle(channelId, { username, displayName, pokemonInstanceId: foundPokeA.instanceId }, 'wild');
      return `⚔️ Battle Started: @${displayName}'s ${foundPokeA.name} vs wild ${session.activeWildPokemon.name}!`;
    }

    // Handle fight player
    const targetUser = await db.getUser(channelId, rawTarget);
    if (!targetUser || targetUser.inventory.length === 0) {
      const msg = `❌ @${displayName}, could not find player @${rawTarget} or they have no Pokémon.`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }

    if (targetUser.username === challenger.username) {
      const msg = `❌ @${displayName}, you cannot fight yourself!`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }

    if (session.activeChallenge) {
      clearTimeout(session.activeChallenge.timeoutId);
    }

    const timeoutId = setTimeout(() => {
      if (session.activeChallenge && session.activeChallenge.challenger.username === username) {
        sendGameLog(channelId, 'system', `⏳ Challenge from @${displayName} to @${targetUser.displayName} expired.`);
        session.activeChallenge = null;
      }
    }, 30000); // 30 seconds challenge window

    session.activeChallenge = {
      challenger: { username, displayName, pokemonInstanceId: foundPokeA.instanceId },
      opponent: { username: targetUser.username, displayName: targetUser.displayName },
      challengerPokeName: foundPokeA.name,
      timeoutId
    };

    const msg = `⚔️ Challenge: @${displayName} challenged @${targetUser.displayName} to a fight using their ${foundPokeA.name}! @${targetUser.displayName}, type '!accept [your_pokemon]' to battle.`;
    sendGameLog(channelId, 'battle', msg);
    return msg;
  }

  // 6. !accept command
  if (cleanMsg.startsWith('!accept') || cleanMsg.startsWith('accept')) {
    if (!session.activeChallenge) {
      return `❌ @${displayName}, you do not have any pending battle challenges.`;
    }

    if (session.activeChallenge.opponent.username !== username) {
      return `❌ @${displayName}, you are not the opponent of this challenge.`;
    }

    if (session.activeBattle) {
      const msg = `❌ @${displayName}, a battle is already in progress on screen!`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }

    // Parse parameters
    const parts = messageText.trim().split(/\s+/);
    if (parts.length < 2) {
      const msg = `❌ @${displayName}, you must specify which Pokémon you want to battle with! Syntax: !accept [pokemon_name]`;
      io.to(channelId).emit('command_feedback', { 
        username, 
        text: msg 
      });
      return msg;
    }

    const pokemonQuery = parts.slice(1).join(' ').toLowerCase().trim();

    const opponentUser = await db.getUser(channelId, username, displayName);
    const foundPokeB = opponentUser.inventory.find(p => 
      p.name.toLowerCase().replace('✨ shiny ', '') === pokemonQuery || 
      p.originalName.toLowerCase() === pokemonQuery
    );

    if (!foundPokeB) {
      const msg = `❌ @${displayName}, you do not have a "${pokemonQuery}" in your inventory to fight with!`;
      io.to(channelId).emit('command_feedback', { 
        username, 
        text: msg 
      });
      return msg;
    }

    clearTimeout(session.activeChallenge.timeoutId);
    
    const challenger = session.activeChallenge.challenger;
    const opponent = {
      ...session.activeChallenge.opponent,
      pokemonInstanceId: foundPokeB.instanceId
    };
    
    runBattle(channelId, challenger, opponent);
    const msg = `⚔️ Battle accepted! @${displayName}'s ${foundPokeB.name} is entering the arena against @${challenger.displayName}'s ${session.activeChallenge.challengerPokeName}!`;
    return msg;
  }

  // 7. !shop / !store command
  if (cleanMsg === '!shop' || cleanMsg === 'shop' || cleanMsg === '!store' || cleanMsg === 'store') {
    const msg = `🛍️ Shop: Pokéball 🔴 (10c) | Great Ball 🔵 (30c) | Ultra Ball 🟡 (80c) | Master Ball 🟣 (250c). Type '!buy [ball_type] [amount]' to purchase.`;
    io.to(channelId).emit('command_feedback', { username, text: msg });
    return msg;
  }

  // 8. !buy command
  if (cleanMsg.startsWith('!buy ') || cleanMsg.startsWith('buy ')) {
    const parts = messageText.trim().split(/\s+/);
    if (parts.length < 2) {
      const msg = `❌ @${displayName}, syntax: !buy [pokeball/great/ultra/master] [amount]`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }

    let typeInput = parts[1].toLowerCase().trim();
    let amount = 1;
    if (parts.length >= 3) {
      const parsedAmount = parseInt(parts[2]);
      if (!isNaN(parsedAmount) && parsedAmount > 0) {
        amount = parsedAmount;
      }
    }

    // Resolve ball types
    let ballType = '';
    let pricePerItem = 0;
    let ballLabel = '';
    
    if (typeInput.includes('poke')) {
      ballType = 'pokeball';
      pricePerItem = 10;
      ballLabel = '🔴 Pokéball';
    } else if (typeInput.includes('great')) {
      ballType = 'greatball';
      pricePerItem = 30;
      ballLabel = '🔵 Great Ball';
    } else if (typeInput.includes('ultra')) {
      ballType = 'ultraball';
      pricePerItem = 80;
      ballLabel = '🟡 Ultra Ball';
    } else if (typeInput.includes('master')) {
      ballType = 'masterball';
      pricePerItem = 250;
      ballLabel = '🟣 Master Ball';
    } else {
      const msg = `❌ @${displayName}, unknown item. Available: pokeball, greatball, ultraball, masterball.`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }

    const totalPrice = pricePerItem * amount;
    const user = await db.getUser(channelId, username, displayName);

    if (user.coins < totalPrice) {
      const msg = `❌ @${displayName}, you need 🪙 ${totalPrice} coins to buy ${amount}x ${ballLabel}, but you only have 🪙 ${user.coins}!`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }

    user.coins -= totalPrice;
    user.balls[ballType] += amount;
    await db.saveUser(channelId, user);

    const msg = `✅ @${displayName} purchased ${amount}x ${ballLabel} for 🪙 ${totalPrice} coins! Remaining: 🪙 ${user.coins}.`;
    sendGameLog(channelId, 'system', msg);
    io.to(channelId).emit('balls_updated', { username, balls: user.balls });
    return msg;
  }

  // 9. !coins / !balance / !level command
  if (cleanMsg === '!coins' || cleanMsg === 'coins' || cleanMsg === '!balance' || cleanMsg === 'balance' || cleanMsg === '!level' || cleanMsg === 'level') {
    const user = await db.getUser(channelId, username, displayName);
    const xpNeeded = user.level * 100;
    const msg = `🪙 @${displayName}'s Profile: Trainer Level ${user.level} | XP: ${user.xp}/${xpNeeded} | Coins: 🪙 ${user.coins} | Inventory: ${user.inventory.length} Pokémon.`;
    io.to(channelId).emit('command_feedback', { username, text: msg });
    return msg;
  }

  // 10. !buddy / !setbuddy command
  if (cleanMsg.startsWith('!buddy ') || cleanMsg.startsWith('buddy ') || cleanMsg.startsWith('!setbuddy ') || cleanMsg.startsWith('setbuddy ')) {
    let query = messageText.replace('!setbuddy ', '').replace('setbuddy ', '').replace('!buddy ', '').replace('buddy ', '').trim().toLowerCase();
    const user = await db.getUser(channelId, username, displayName);
    
    if (query === 'none' || query === 'clear' || query === 'remove') {
      user.buddyInstanceId = null;
      await db.saveUser(channelId, user);
      const msg = `✅ @${displayName} cleared their companion buddy Pokémon.`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }

    const found = user.inventory.find(p => 
      p.name.toLowerCase().replace('✨ shiny ', '') === query || 
      p.originalName.toLowerCase() === query ||
      p.pokemonId.toString() === query
    );

    if (!found) {
      const msg = `❌ @${displayName}, you don't own a "${query}" to set as your buddy!`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }

    user.buddyInstanceId = found.instanceId;
    await db.saveUser(channelId, user);

    const msg = `✨ @${displayName} set ${found.name} as their companion buddy Pokémon!`;
    sendGameLog(channelId, 'system', msg);
    io.to(channelId).emit('command_feedback', { username, text: msg });
    return msg;
  }

  // 11. !help / !commands command
  if (cleanMsg === '!help' || cleanMsg === 'help' || cleanMsg === '!commands' || cleanMsg === 'commands') {
    return `🎮 Pokémon Game: !daily | !inventory | !coins | !shop | !buy [ball] [amt] | !buddy [name] | !select [name] | !catch [ball_type] | !fight [@user/wild] [your_poke] | !accept [your_poke]`;
  }

  return null;
}

// Websocket Events (for Overlay and Control Dashboard)
io.on('connection', async (socket) => {
  // Read channelId parameter or fallback to simulator
  const channelId = (socket.handshake.query.channelId || 'simulator').toLowerCase().trim();
  console.log(`[Sockets] Client connected: ${socket.id} to room/channel: ${channelId}`);

  socket.join(channelId);

  const session = getOrCreateSession(channelId);

  // Synchronously register all socket event handlers on connection to prevent race conditions (packet loss)
  socket.on('verify_password', async (data) => {
    if (session.initializationPromise) await session.initializationPromise;
    const { password } = data;
    if (password === session.config.adminPassword) {
      socket.emit('password_verified', { success: true, config: session.config });
    } else {
      socket.emit('password_verified', { success: false, message: 'Incorrect username or password.' });
    }
  });

  socket.on('set_password', async (data) => {
    if (session.initializationPromise) await session.initializationPromise;
    const { password } = data;
    if (session.config.adminPassword) {
      socket.emit('password_verified', { success: false, message: 'Password has already been set!' });
      return;
    }
    try {
      session.config.adminPassword = password;
      await db.saveStreamerConfig(channelId, session.config);
      
      // Notify only that registration/set succeeded
      socket.emit('password_verified', { success: true, config: session.config });
      console.log(`[Server] [${channelId}] Admin password set successfully.`);
    } catch (err) {
      console.error(`[Server] [${channelId}] Failed to set password:`, err.message);
      session.config.adminPassword = ''; // Rollback
      socket.emit('password_verified', { success: false, message: 'Server error saving password. Please try again.' });
    }
  });

  socket.on('simulate_chat', (data) => {
    const { username, displayName, messageText } = data;
    console.log(`[Simulator] [${channelId}] ${displayName} (${username}): ${messageText}`);
    processCommand(channelId, username, displayName, messageText);
  });

  socket.on('update_config', async (data) => {
    if (session.initializationPromise) await session.initializationPromise;
    const { newConfig, password } = data;
    if (session.config.adminPassword && password !== session.config.adminPassword) {
      socket.emit('command_feedback', { text: '❌ Unauthorized: Incorrect admin password!' });
      return;
    }
    
    try {
      console.log(`[Server] [${channelId}] Configuration updating...`);
      
      // Clean inputs: extract IDs from full URLs if pasted
      if (newConfig.videoId) {
        newConfig.videoId = youtube.extractVideoId(newConfig.videoId);
      }
      if (newConfig.youtubeChannelId) {
        newConfig.youtubeChannelId = youtube.extractChannelId(newConfig.youtubeChannelId);
      }

      const oldPassword = session.config.adminPassword;
      session.config = { ...session.config, ...newConfig, adminPassword: oldPassword };
      
      await db.saveStreamerConfig(channelId, session.config);
      
      startSpawnLoop(channelId);
      
      youtube.stopYoutubeChat(channelId);
      twitch.stopTwitchChat(channelId);
      await youtube.startYoutubeChat(channelId, session.config, processCommand);
      twitch.startTwitchChat(channelId, session.config, processCommand);
      
      io.to(channelId).emit('config_updated', session.config);
    } catch (err) {
      console.error(`[Server] [${channelId}] Failed to update config:`, err.message);
      socket.emit('command_feedback', { text: '❌ Server error saving settings. Please try again.' });
    }
  });

  // Force spawn button from dashboard
  socket.on('force_spawn', (data) => {
    const { password } = data || {};
    if (session.config.adminPassword && password !== session.config.adminPassword) {
      socket.emit('command_feedback', { text: '❌ Unauthorized: Incorrect admin password!' });
      return;
    }
    
    console.log(`[Server] [${channelId}] Forcing wild Pokemon spawn...`);
    spawnWildPokemon(channelId);
  });

  // Reset database button from dashboard
  socket.on('reset_db', async (data) => {
    const { password } = data || {};
    if (session.config.adminPassword && password !== session.config.adminPassword) {
      socket.emit('command_feedback', { text: '❌ Unauthorized: Incorrect admin password!' });
      return;
    }
    
    try {
      console.log(`[Server] [${channelId}] Resetting database...`);
      await db.resetDatabase(channelId);
      io.to(channelId).emit('leaderboard_update', await db.getLeaderboard(channelId));
      sendGameLog(channelId, 'system', '⚠️ Streamer has reset all player databases!');
    } catch (err) {
      console.error(`[Server] [${channelId}] Failed to reset database:`, err.message);
      socket.emit('command_feedback', { text: '❌ Server error resetting database. Please try again.' });
    }
  });

  // Request all registered players (for viewer management search list)
  socket.on('get_all_players', async () => {
    try {
      const list = await db.getAllPlayers(channelId);
      socket.emit('all_players_data', list);
    } catch (err) {
      console.error(`[Sockets] [${channelId}] Failed to fetch all players:`, err.message);
    }
  });

  // Admin edit player details (from dashboard viewer management actions)
  socket.on('admin_update_player', async (data) => {
    const { password, playerUsername, updatedFields } = data;
    if (session.config.adminPassword && password !== session.config.adminPassword) {
      socket.emit('command_feedback', { text: '❌ Unauthorized: Incorrect admin password!' });
      return;
    }
    
    try {
      console.log(`[Admin] [${channelId}] Updating player profile ${playerUsername}...`);
      const user = await db.getUser(channelId, playerUsername);
      if (user) {
        if (updatedFields.coins !== undefined) user.coins = parseInt(updatedFields.coins);
        if (updatedFields.level !== undefined) user.level = parseInt(updatedFields.level);
        if (updatedFields.xp !== undefined) user.xp = parseInt(updatedFields.xp);
        if (updatedFields.balls) {
          if (updatedFields.balls.pokeball !== undefined) user.balls.pokeball = parseInt(updatedFields.balls.pokeball);
          if (updatedFields.balls.greatball !== undefined) user.balls.greatball = parseInt(updatedFields.balls.greatball);
          if (updatedFields.balls.ultraball !== undefined) user.balls.ultraball = parseInt(updatedFields.balls.ultraball);
          if (updatedFields.balls.masterball !== undefined) user.balls.masterball = parseInt(updatedFields.balls.masterball);
        }
        
        await db.saveUser(channelId, user);
        
        // Notify all clients of update
        io.to(channelId).emit('leaderboard_update', await db.getLeaderboard(channelId));
        // Refresh player list for dashboard
        const list = await db.getAllPlayers(channelId);
        socket.emit('all_players_data', list);
        socket.emit('player_updated_ack', { success: true, username: playerUsername });
      }
    } catch (err) {
      console.error(`[Admin] [${channelId}] Player update failed:`, err.message);
      socket.emit('player_updated_ack', { success: false, error: err.message });
    }
  });

  // Clean up timers/listeners on complete disconnect
  socket.on('disconnect', () => {
    console.log(`[Sockets] Client disconnected: ${socket.id} from room: ${channelId}`);
    
    // Give 5 seconds grace period for tab refreshing before cleaning up
    setTimeout(() => {
      const room = io.sockets.adapter.rooms.get(channelId);
      const numClients = room ? room.size : 0;
      if (numClients === 0) {
        cleanupSession(channelId);
      }
    }, 5000);
  });

  // Lazy Initialization: Spin up loops/readers if this is the first connected client for this room
  if (!session.isInitialized) {
    if (session.isInitializing) {
      await session.initializationPromise;
    } else {
      session.isInitializing = true;
      session.initializationPromise = (async () => {
        console.log(`[Session] [${channelId}] Initializing multi-tenant stream session...`);
        try {
          const dbConfig = await db.getStreamerConfig(channelId);
          session.config = dbConfig;
          
          startSpawnLoop(channelId);
          await youtube.startYoutubeChat(channelId, session.config, processCommand);
          twitch.startTwitchChat(channelId, session.config, processCommand);
          session.isInitialized = true;
        } catch (err) {
          console.error(`[Session] [${channelId}] Initialization failed:`, err.message);
        } finally {
          session.isInitializing = false;
        }
      })();
      await session.initializationPromise;
    }
  }

  // Send current session state to joining client
  let leaderboard = [];
  try {
    leaderboard = await db.getLeaderboard(channelId);
  } catch (err) {
    console.error(`[Session] [${channelId}] Failed to fetch leaderboard:`, err.message);
  }
  socket.emit('init_state', {
    activeWildPokemon: session.activeWildPokemon,
    activeBattle: session.activeBattle,
    leaderboard,
    config: session.config
  });

  // Check if streamer has a password set. If not, they can access configurations.
  socket.emit('password_status', { hasPassword: !!session.config.adminPassword });
  if (!session.config.adminPassword) {
    socket.emit('config_updated', session.config);
  }
});

// Start listening
server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Pokemon Stream Overlay Server running on port ${PORT}`);
  console.log(`📺 Local OBS Overlay URL: http://localhost:${PORT}/overlay?channel=simulator`);
  console.log(`🎛️ Local Streamer Dashboard URL: http://localhost:${PORT}/dashboard?channel=simulator`);
  console.log(`===================================================`);
});

// Global safety net: prevent unhandled DB/async errors from killing the process
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Promise Rejection (will not crash):', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception (will not crash):', err.message);
});
