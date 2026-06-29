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

app.get('/trainer/:channel/:username', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'profile.html'));
});

app.get('/api/trainer/:channel/:username', async (req, res) => {
  const channel = req.params.channel.toLowerCase().trim();
  const username = req.params.username.toLowerCase().trim();
  try {
    const user = await db.getUser(channel, username);
    if (user && user.inventory) {
      user.inventory = user.inventory.map(poke => {
        const staticPoke = pokemonDb[poke.pokemonId];
        return {
          ...poke,
          catchRate: staticPoke ? staticPoke.catchRate : 0.5,
          isLegendary: staticPoke ? (staticPoke.catchRate <= 0.1) : false
        };
      });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trigger-raid', async (req, res) => {
  const { channelId, bossName, password } = req.body;
  if (!channelId) {
    return res.status(400).json({ error: 'Missing channelId' });
  }
  const session = getOrCreateSession(channelId.toLowerCase().trim());
  if (session.config.adminPassword && password !== session.config.adminPassword) {
    return res.status(401).json({ error: 'Unauthorized: Incorrect password' });
  }
  try {
    await triggerBossRaid(channelId.toLowerCase().trim(), bossName);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HTTP POST endpoint for external chat relays (like Streamer.bot C# actions)
app.post('/api/chat', async (req, res) => {
  const { channelId, username, displayName, messageText } = req.body;
  if (!channelId || !username || !messageText) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    console.log(`[API Chat Relay] [${channelId}] ${displayName || username}: ${messageText}`);
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const baseUrl = `${protocol}://${req.headers.host}`;
    await ensureSessionInitialized(channelId.toLowerCase().trim());
    const reply = await processCommand(channelId.toLowerCase().trim(), username, displayName || username, messageText, baseUrl);
    res.status(200).json({ success: true, reply });
  } catch (err) {
    console.error('[API Chat Relay] Error processing command:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// HTTP GET endpoint for simple web requests (like Streamer.bot Fetch URL)
app.get('/api/chat', async (req, res) => {
  const { channelId, username, displayName, messageText } = req.query;
  if (!channelId || !username || !messageText) {
    return res.status(400).send('Missing required fields (channelId, username, messageText)');
  }
  
  try {
    console.log(`[API Chat Relay GET] [${channelId}] ${displayName || username}: ${messageText}`);
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const baseUrl = `${protocol}://${req.headers.host}`;
    await ensureSessionInitialized(channelId.toLowerCase().trim());
    const reply = await processCommand(channelId.toLowerCase().trim(), username, displayName || username, messageText, baseUrl);
    res.status(200).send(reply); // Send raw text reply directly
  } catch (err) {
    console.error('[API Chat Relay GET] Error processing command:', err.message);
    res.status(500).send('Error: ' + err.message);
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

const STONE_EVOLUTIONS = {
  pikachu: { stone: 'thunder_stone', result: 'raichu' },
  eevee: {
    fire_stone: 'flareon',
    water_stone: 'vaporeon',
    thunder_stone: 'jolteon'
  },
  gloom: { stone: 'leaf_stone', result: 'vileplume' },
  clefairy: { stone: 'moon_stone', result: 'clefable' },
  jigglypuff: { stone: 'moon_stone', result: 'wigglytuff' },
  nidorina: { stone: 'moon_stone', result: 'nidoqueen' },
  nidorino: { stone: 'moon_stone', result: 'nidoking' },
  growlithe: { stone: 'fire_stone', result: 'arcanine' },
  vulpix: { stone: 'fire_stone', result: 'ninetales' },
  shellder: { stone: 'water_stone', result: 'cloyster' },
  staryu: { stone: 'water_stone', result: 'starmie' }
};

function findPokemonByName(name) {
  const cleanName = name.toLowerCase().trim();
  const keys = Object.keys(pokemonDb);
  for (let k of keys) {
    if (pokemonDb[k].name.toLowerCase() === cleanName) {
      return pokemonDb[k];
    }
  }
  return null;
}

function getPokemonGen(pokemonId) {
  const id = parseInt(pokemonId);
  if (id >= 1 && id <= 151) return 1;
  if (id >= 152 && id <= 251) return 2;
  if (id >= 252 && id <= 386) return 3;
  if (id >= 387 && id <= 493) return 4;
  if (id >= 494 && id <= 649) return 5;
  if (id >= 650 && id <= 721) return 6;
  if (id >= 722 && id <= 809) return 7;
  return 8; // Gen 8/Other
}

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
      activeTrade: null,
      activeRaidBoss: null,
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

async function ensureSessionInitialized(channelId) {
  const session = getOrCreateSession(channelId);
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
  return session;
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

// Trigger a Gigantamax Boss Raid
async function triggerBossRaid(channelId, customBossName = null) {
  const session = getOrCreateSession(channelId);
  if (session.activeRaidBoss) return; // Raid already active
  
  const candidates = Object.values(pokemonDb).filter(p => p.stats && p.stats.hp >= 60);
  if (candidates.length === 0) return;
  
  let boss = candidates[Math.floor(Math.random() * candidates.length)];
  if (customBossName) {
    const matched = findPokemonByName(customBossName);
    if (matched) boss = matched;
  }
  
  const isShiny = Math.random() < 0.05; // 5% shiny raid boss chance!
  const bossName = isShiny ? `✨ Gigantamax Shiny ${boss.name}` : `Gigantamax ${boss.name}`;
  
  const maxHp = session.config.raidBossHp !== undefined ? Number(session.config.raidBossHp) : 5000;
  
  session.activeRaidBoss = {
    id: boss.id,
    name: bossName,
    maxHp,
    currentHp: maxHp,
    shiny: isShiny,
    spriteUrl: isShiny ? boss.shinySpriteUrl : boss.spriteUrl,
    fallbackSpriteUrl: isShiny ? boss.fallbackShinySpriteUrl : boss.fallbackSpriteUrl,
    participants: {}
  };
  
  session.activeWildPokemon = null;
  if (session.wildDespawnTimer) clearTimeout(session.wildDespawnTimer);
  io.to(channelId).emit('pokemon_despawned');
  
  io.to(channelId).emit('raid_start', {
    name: bossName,
    maxHp,
    spriteUrl: session.activeRaidBoss.spriteUrl,
    fallbackSpriteUrl: session.activeRaidBoss.fallbackSpriteUrl
  });
  
  const msg = `🚨 BOSS RAID ALERT! A giant ${bossName} has appeared with ${maxHp} HP! Type !attack to damage it using your buddy Pokémon!`;
  sendGameLog(channelId, 'system', msg);
  
  session.wildDespawnTimer = setTimeout(() => {
    if (session.activeRaidBoss) {
      const escapeMsg = `💨 The Raid Boss ${session.activeRaidBoss.name} fled...`;
      sendGameLog(channelId, 'system', escapeMsg);
      io.to(channelId).emit('raid_end', { victory: false, message: escapeMsg });
      session.activeRaidBoss = null;
    }
  }, 5 * 60 * 1000);
}

// Spawn Wild Pokémon for a specific session
async function spawnWildPokemon(channelId) {
  const session = getOrCreateSession(channelId);
  
  const raidChance = session.config.raidChance !== undefined ? Number(session.config.raidChance) : 0.05;
  if (!session.activeRaidBoss && Math.random() < raidChance && !session.config.spawnTarget) {
    await triggerBossRaid(channelId);
    return;
  }
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

  let allowedIds = pokemonIds;
  if (session.config.allowedGenerations && Array.isArray(session.config.allowedGenerations)) {
    const allowedGens = session.config.allowedGenerations.map(Number);
    if (allowedGens.length > 0) {
      allowedIds = pokemonIds.filter(id => {
        const gen = getPokemonGen(id);
        return allowedGens.includes(gen);
      });
    }
  }
  if (allowedIds.length === 0) {
    allowedIds = pokemonIds;
  }
  const basePoke = targetPoke || pokemonDb[allowedIds[Math.floor(Math.random() * allowedIds.length)]];
  
  const isShiny = Math.random() < session.config.shinyChance;
  const sprite = isShiny ? basePoke.shinySpriteUrl : basePoke.spriteUrl;
  const fallbackSprite = isShiny ? basePoke.fallbackShinySpriteUrl : basePoke.fallbackSpriteUrl;

  // Roll Individual Values (IVs, 0–15) at spawn time so overlay CP matches inventory CP
  const spawnIVs = {
    hp: Math.floor(Math.random() * 16),
    attack: Math.floor(Math.random() * 16),
    defense: Math.floor(Math.random() * 16),
    speed: Math.floor(Math.random() * 16)
  };
  const ivBoostedStats = {
    hp: (basePoke.stats?.hp || 50) + spawnIVs.hp,
    attack: (basePoke.stats?.attack || 50) + spawnIVs.attack,
    defense: (basePoke.stats?.defense || 50) + spawnIVs.defense,
    speed: (basePoke.stats?.speed || 50) + spawnIVs.speed
  };

  session.activeWildPokemon = {
    ...basePoke,
    isShiny: isShiny,
    spriteUrl: sprite,
    fallbackSpriteUrl: fallbackSprite,
    spawnedAt: Date.now(),
    spawnIVs: spawnIVs,
    ivBoostedStats: ivBoostedStats
  };

  console.log(`[Game Loop] [${channelId}] Spawned: ${isShiny ? '✨ Shiny ' : ''}${basePoke.name}`);
  
  // Calculate ball specific catch rates
  const baseCatchRate = basePoke.catchRate || 0.2;
  let categoryMultiplier = 1.0;
  if (baseCatchRate <= 0.1) {
    categoryMultiplier = session.config.catchMultiplierLegendary !== undefined ? Number(session.config.catchMultiplierLegendary) : 1.0;
  } else if (baseCatchRate <= 0.25) {
    categoryMultiplier = session.config.catchMultiplierRare !== undefined ? Number(session.config.catchMultiplierRare) : 1.0;
  } else {
    categoryMultiplier = session.config.catchMultiplierNormal !== undefined ? Number(session.config.catchMultiplierNormal) : 1.0;
  }

  const multPoke = session.config.catchMultiplierPokeball !== undefined ? session.config.catchMultiplierPokeball : 1.0;
  const multGreat = session.config.catchMultiplierGreatball !== undefined ? session.config.catchMultiplierGreatball : 1.5;
  const multUltra = session.config.catchMultiplierUltraball !== undefined ? session.config.catchMultiplierUltraball : 2.0;

  const ratePoke = Math.min(100, Math.round(baseCatchRate * multPoke * categoryMultiplier * 100));
  const rateGreat = Math.min(100, Math.round(baseCatchRate * multGreat * categoryMultiplier * 100));
  const rateUltra = Math.min(100, Math.round(baseCatchRate * multUltra * categoryMultiplier * 100));
  const rateMaster = 100;

  io.to(channelId).emit('pokemon_spawned', {
    id: session.activeWildPokemon.id,
    name: session.activeWildPokemon.name,
    types: session.activeWildPokemon.types,
    isShiny: isShiny,
    spriteUrl: sprite,
    fallbackSpriteUrl: fallbackSprite,
    catchRate: session.activeWildPokemon.catchRate,
    statsSum: session.activeWildPokemon.statsSum,
    stats: ivBoostedStats,
    ballRates: {
      pokeball: ratePoke,
      greatball: rateGreat,
      ultraball: rateUltra,
      masterball: rateMaster
    }
  });

  sendGameLog(channelId, 'spawn', `🌟 A wild ${isShiny ? '✨ Shiny ' : ''}${basePoke.name} has spawned! Type '!catch' to capture it!`);

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
    opponentPoke: pokeB.name,
    winner: winner,
    challengerHp: pokeA.baseStats.hp || 100,
    opponentHp: pokeB.baseStats.hp || 100,
    challengerPower: Math.round(finalPowerA),
    opponentPower: Math.round(finalPowerB),
    challengerMultiplier: multA,
    opponentMultiplier: multB
  });

  sendGameLog(channelId, 'battle', `⚔️ Battle Started: @${playerA.displayName}'s ${pokeA.name} vs ${opponentName}'s ${pokeB.name}!`);
  
  setTimeout(async () => {
    // 12s delay to allow multi-turn client animation to finish
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
  }, 12000);
}

/**
 * Progression Helper: Awards XP and Coins to a trainer. Handles leveling up.
 */
async function addXPAndCoins(channelId, username, displayName, xpAmount, coinsAmount) {
  try {
    const session = getOrCreateSession(channelId);
    const config = session.config;
    const user = await db.getUser(channelId, username, displayName);
    user.xp += xpAmount;
    user.coins += coinsAmount;
    
    let leveledUp = false;
    // Level up calculation: level * 100
    while (user.xp >= user.level * 100) {
      user.xp -= user.level * 100;
      user.level += 1;
      leveledUp = true;
      
      // Level up rewards:Great Balls, Ultra Ball, coins (dynamic from config)
      const gbReward = config.levelUpGreatballs !== undefined ? config.levelUpGreatballs : 3;
      const ubReward = config.levelUpUltraballs !== undefined ? config.levelUpUltraballs : 1;
      const coinsReward = config.levelUpCoins !== undefined ? config.levelUpCoins : 100;
      
      user.balls.greatball += gbReward;
      user.balls.ultraball += ubReward;
      user.coins += coinsReward;
    }
    
    await db.saveUser(channelId, user);
    
    io.to(channelId).emit('balls_updated', { username, balls: user.balls });
    
    if (leveledUp) {
      const gbReward = config.levelUpGreatballs !== undefined ? config.levelUpGreatballs : 3;
      const ubReward = config.levelUpUltraballs !== undefined ? config.levelUpUltraballs : 1;
      const coinsReward = config.levelUpCoins !== undefined ? config.levelUpCoins : 100;
      
      const lvlMsg = `⭐ LEVEL UP! @${user.displayName} reached Trainer Level ${user.level}! Received: ${gbReward} Great Balls, ${ubReward} Ultra Balls, ${coinsReward} Coins.`;
      sendGameLog(channelId, 'system', lvlMsg);
      io.to(channelId).emit('player_level_up', {
        username: user.username,
        displayName: user.displayName,
        level: user.level,
        coinsReward: coinsReward,
        greatballsReward: gbReward,
        ultraballsReward: ubReward
      });
    }
    
    return { leveledUp, level: user.level, xp: user.xp, coins: user.coins };
  } catch (err) {
    console.error(`[Progression] Error adding XP/coins to ${username}:`, err.message);
    return null;
  }
}

// Master command processing function
async function processCommand(channelId, username, displayName, messageText, baseUrl) {
  const session = getOrCreateSession(channelId);
  const finalBaseUrl = baseUrl || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
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

    const baseLink = session.config.inventoryBaseUrl 
      ? `${session.config.inventoryBaseUrl.replace(/\/$/, '')}/trainer/${channelId}/${username}?backend=${finalBaseUrl}` 
      : `${finalBaseUrl}/trainer/${channelId}/${username}`;
    const msg = `@${displayName} View Inventory (Click Here): ${baseLink}`;
    
    io.to(channelId).emit('command_feedback', {
      username,
      text: msg
    });
    return msg;
  }

  // 2.5. !ball / !balls command
  if (cleanMsg === '!ball' || cleanMsg === 'ball' || cleanMsg === '!balls' || cleanMsg === 'balls') {
    const user = await db.getUser(channelId, username, displayName);
    const msg = `@${displayName} has: 🔴 ${user.balls.pokeball || 0}x Pokéballs, 🔵 ${user.balls.greatball || 0}x Great Balls, 🟡 ${user.balls.ultraball || 0}x Ultra Balls, 🟣 ${user.balls.masterball || 0}x Master Balls.`;
    
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
  if (cleanMsg === '!catch' || cleanMsg.startsWith('!catch ')) {
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
    if (ballType === 'pokeball') multiplier = session.config.catchMultiplierPokeball !== undefined ? session.config.catchMultiplierPokeball : 1.0;
    else if (ballType === 'greatball') multiplier = session.config.catchMultiplierGreatball !== undefined ? session.config.catchMultiplierGreatball : 1.5;
    else if (ballType === 'ultraball') multiplier = session.config.catchMultiplierUltraball !== undefined ? session.config.catchMultiplierUltraball : 2.0;
    else if (ballType === 'masterball') multiplier = 100.0; // Auto-catch!

    const baseCatchRate = session.activeWildPokemon.catchRate;
    let categoryMultiplier = 1.0;
    if (baseCatchRate <= 0.1) {
      categoryMultiplier = session.config.catchMultiplierLegendary !== undefined ? Number(session.config.catchMultiplierLegendary) : 1.0;
    } else if (baseCatchRate <= 0.25) {
      categoryMultiplier = session.config.catchMultiplierRare !== undefined ? Number(session.config.catchMultiplierRare) : 1.0;
    } else {
      categoryMultiplier = session.config.catchMultiplierNormal !== undefined ? Number(session.config.catchMultiplierNormal) : 1.0;
    }

    const finalCatchRate = baseCatchRate * multiplier * categoryMultiplier;
    const success = Math.random() < finalCatchRate;

    if (success) {
      if (session.wildDespawnTimer) clearTimeout(session.wildDespawnTimer);
      
      const isShiny = session.activeWildPokemon.isShiny;
      await db.addPokemon(channelId, username, displayName, session.activeWildPokemon, isShiny);
      
      // Award XP & Coins for successful catch (dynamic from config)
      const rewardXp = isShiny ? (session.config.xpCaptureShiny !== undefined ? session.config.xpCaptureShiny : 50) : (session.config.xpCaptureNormal !== undefined ? session.config.xpCaptureNormal : 15);
      const rewardCoins = isShiny ? (session.config.coinsCaptureShiny !== undefined ? session.config.coinsCaptureShiny : 100) : (session.config.coinsCaptureNormal !== undefined ? session.config.coinsCaptureNormal : 20);
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
        ballType: ballType,
        spriteUrl: session.activeWildPokemon.spriteUrl,
        fallbackSpriteUrl: session.activeWildPokemon.fallbackSpriteUrl
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

    const challengeTimeoutSecs = session.config.battleAcceptTimeoutSeconds !== undefined ? session.config.battleAcceptTimeoutSeconds : 30;
    const timeoutId = setTimeout(() => {
      if (session.activeChallenge && session.activeChallenge.challenger.username === username) {
        sendGameLog(channelId, 'system', `⏳ Challenge from @${displayName} to @${targetUser.displayName} expired.`);
        session.activeChallenge = null;
      }
    }, challengeTimeoutSecs * 1000);

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
  if (cleanMsg.startsWith('!shop') || cleanMsg === 'shop' || cleanMsg.startsWith('!store') || cleanMsg === 'store') {
    const parts = messageText.trim().split(/\s+/);
    const category = parts[1] ? parts[1].toLowerCase().trim() : '';
    const user = await db.getUser(channelId, username, displayName);
    const coinsText = ` (Your Coins: 🪙 ${user.coins})`;

    if (category === 'balls') {
      const pPoke = session.config.pricePokeball !== undefined ? session.config.pricePokeball : 10;
      const pGreat = session.config.priceGreatball !== undefined ? session.config.priceGreatball : 30;
      const pUltra = session.config.priceUltraball !== undefined ? session.config.priceUltraball : 80;
      const pMaster = session.config.priceMasterball !== undefined ? session.config.priceMasterball : 250;
      const msg = `🛍️ Pokéballs Shop${coinsText}: Pokéball 🔴 (${pPoke}c) | Great Ball 🔵 (${pGreat}c) | Ultra Ball 🟡 (${pUltra}c) | Master Ball 🟣 (${pMaster}c). Buy using '!buy [ball_type] [amount]'.`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    } else if (category === 'packs') {
      const pKanto = session.config.pricePackKanto !== undefined ? session.config.pricePackKanto : 150;
      const pJohto = session.config.pricePackJohto !== undefined ? session.config.pricePackJohto : 150;
      const pHoenn = session.config.pricePackHoenn !== undefined ? session.config.pricePackHoenn : 150;
      const pSinnoh = session.config.pricePackSinnoh !== undefined ? session.config.pricePackSinnoh : 150;
      const pUnova = session.config.pricePackUnova !== undefined ? session.config.pricePackUnova : 150;
      const pKalos = session.config.pricePackKalos !== undefined ? session.config.pricePackKalos : 150;
      const pAlola = session.config.pricePackAlola !== undefined ? session.config.pricePackAlola : 150;
      const pLegendary = session.config.pricePackLegendary !== undefined ? session.config.pricePackLegendary : 500;
      const msg = `🛍️ Booster Packs Shop${coinsText}: Kanto (${pKanto}c) | Johto (${pJohto}c) | Hoenn (${pHoenn}c) | Sinnoh (${pSinnoh}c) | Unova (${pUnova}c) | Kalos (${pKalos}c) | Alola (${pAlola}c) | Legendary (${pLegendary}c). Buy using '!buy pack [type]'.`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    } else if (category === 'stones') {
      const pFire = session.config.priceFireStone !== undefined ? session.config.priceFireStone : 150;
      const pWater = session.config.priceWaterStone !== undefined ? session.config.priceWaterStone : 150;
      const pThunder = session.config.priceThunderStone !== undefined ? session.config.priceThunderStone : 150;
      const pLeaf = session.config.priceLeafStone !== undefined ? session.config.priceLeafStone : 150;
      const pMoon = session.config.priceMoonStone !== undefined ? session.config.priceMoonStone : 150;
      const msg = `🛍️ Evolution Stones Shop${coinsText}: Fire 🔥 (${pFire}c) | Water 💧 (${pWater}c) | Thunder ⚡ (${pThunder}c) | Leaf 🍃 (${pLeaf}c) | Moon 🌙 (${pMoon}c). Buy using '!buy [stone_type] [amount]'.`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    } else {
      const msg = `🛍️ Shop Categories${coinsText}: '!shop balls' | '!shop packs' | '!shop stones'. Type '!buy [item] [amount]' to purchase.`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
  }

  // 8.5. !buy pack [kanto/johto/hoenn/sinnoh/unova/kalos/alola/legendary] command
  if (cleanMsg.startsWith('!buy pack ') || cleanMsg.startsWith('buy pack ')) {
    const parts = messageText.trim().split(/\s+/);
    if (parts.length < 3) {
      const msg = `❌ @${displayName}, syntax: !buy pack [kanto/johto/hoenn/sinnoh/unova/kalos/alola/legendary]`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
    const packType = parts[2].toLowerCase().trim();
    let price = 150;
    if (packType === 'kanto') {
      price = session.config.pricePackKanto !== undefined ? Number(session.config.pricePackKanto) : 150;
    } else if (packType === 'johto') {
      price = session.config.pricePackJohto !== undefined ? Number(session.config.pricePackJohto) : 150;
    } else if (packType === 'hoenn') {
      price = session.config.pricePackHoenn !== undefined ? Number(session.config.pricePackHoenn) : 150;
    } else if (packType === 'sinnoh') {
      price = session.config.pricePackSinnoh !== undefined ? Number(session.config.pricePackSinnoh) : 150;
    } else if (packType === 'unova') {
      price = session.config.pricePackUnova !== undefined ? Number(session.config.pricePackUnova) : 150;
    } else if (packType === 'kalos') {
      price = session.config.pricePackKalos !== undefined ? Number(session.config.pricePackKalos) : 150;
    } else if (packType === 'alola') {
      price = session.config.pricePackAlola !== undefined ? Number(session.config.pricePackAlola) : 150;
    } else if (packType === 'legendary') {
      price = session.config.pricePackLegendary !== undefined ? Number(session.config.pricePackLegendary) : 500;
    }
    
    const user = await db.getUser(channelId, username, displayName);
    if (user.coins < price) {
      const msg = `❌ @${displayName}, you need 🪙 ${price} coins to buy a ${packType.toUpperCase()} pack, but you only have 🪙 ${user.coins}!`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
    
    const allPokes = Object.values(pokemonDb);
    let candidates = [];
    if (packType === 'kanto') {
      candidates = allPokes.filter(p => p.id >= 1 && p.id <= 151);
    } else if (packType === 'johto') {
      candidates = allPokes.filter(p => p.id >= 152 && p.id <= 251);
    } else if (packType === 'hoenn') {
      candidates = allPokes.filter(p => p.id >= 252 && p.id <= 386);
    } else if (packType === 'sinnoh') {
      candidates = allPokes.filter(p => p.id >= 387 && p.id <= 493);
    } else if (packType === 'unova') {
      candidates = allPokes.filter(p => p.id >= 494 && p.id <= 649);
    } else if (packType === 'kalos') {
      candidates = allPokes.filter(p => p.id >= 650 && p.id <= 721);
    } else if (packType === 'alola') {
      candidates = allPokes.filter(p => p.id >= 722 && p.id <= 809);
    } else if (packType === 'legendary') {
      candidates = allPokes.filter(p => p.catchRate <= 0.1);
    } else {
      const msg = `❌ @${displayName}, unknown pack type! Available: kanto, johto, hoenn, sinnoh, unova, kalos, alola, legendary.`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
    
    if (candidates.length === 0) {
      candidates = allPokes;
    }
    
    const legendaryCandidates = allPokes.filter(p => p.catchRate <= 0.1);
    
    const cards = [];
    for (let i = 0; i < 3; i++) {
      let drawPool = candidates;
      
      // Only for the Legendary Pack:
      if (packType === 'legendary') {
        if (i === 0 && legendaryCandidates.length > 0) {
          // Card 1 is guaranteed legendary
          drawPool = legendaryCandidates;
        } else {
          // Card 2 & 3 are completely random from the entire database (luck-based)
          drawPool = allPokes;
        }
      }
      
      const randomPoke = drawPool[Math.floor(Math.random() * drawPool.length)];
      const isShiny = Math.random() < (session.config.shinyChance || 0.01);
      
      const newPoke = await db.addPokemon(channelId, username, displayName, randomPoke, isShiny);
      cards.push({
        id: randomPoke.id,
        name: newPoke.name,
        originalName: randomPoke.name,
        types: randomPoke.types,
        spriteUrl: isShiny ? randomPoke.shinySpriteUrl : randomPoke.spriteUrl,
        fallbackSpriteUrl: isShiny ? randomPoke.fallbackShinySpriteUrl : randomPoke.fallbackSpriteUrl,
        shiny: isShiny
      });
    }
    
    user.coins -= price;
    await db.saveUser(channelId, user);
    
    io.to(channelId).emit('gacha_pack_opened', {
      username,
      displayName,
      packType,
      cards
    });
    
    const listStr = cards.map(c => c.name).join(', ');
    const msg = `🎁 @${displayName} opened a ${packType.toUpperCase()} Booster Pack for 🪙 ${price} coins and got: ${listStr}!`;
    sendGameLog(channelId, 'system', msg);
    return msg;
  }

  // 8. !buy command
  if (cleanMsg.startsWith('!buy ') || cleanMsg.startsWith('buy ')) {
    const parts = messageText.trim().split(/\s+/);
    if (parts.length < 2) {
      const msg = `❌ @${displayName}, syntax: !buy [item_name] [amount]`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }

    let typeInput = parts[1].toLowerCase().trim();
    let amount = 1;
    let nextIdx = 2;
    if (parts[2] && parts[2].toLowerCase().trim() === 'stone') {
      typeInput += '_stone';
      nextIdx = 3;
    }
    if (parts[nextIdx]) {
      const parsedAmount = parseInt(parts[nextIdx], 10);
      if (!isNaN(parsedAmount) && parsedAmount > 0) {
        amount = parsedAmount;
      }
    }

    // Resolve item types
    let isBall = false;
    let isStone = false;
    let ballType = '';
    let stoneType = '';
    let pricePerItem = 0;
    let itemLabel = '';

    if (typeInput.includes('poke') || typeInput === 'ball') {
      isBall = true;
      ballType = 'pokeball';
      pricePerItem = session.config.pricePokeball !== undefined ? session.config.pricePokeball : 10;
      itemLabel = '🔴 Pokéball';
    } else if (typeInput.includes('great')) {
      isBall = true;
      ballType = 'greatball';
      pricePerItem = session.config.priceGreatball !== undefined ? session.config.priceGreatball : 30;
      itemLabel = '🔵 Great Ball';
    } else if (typeInput.includes('ultra')) {
      isBall = true;
      ballType = 'ultraball';
      pricePerItem = session.config.priceUltraball !== undefined ? session.config.priceUltraball : 80;
      itemLabel = '🟡 Ultra Ball';
    } else if (typeInput.includes('master')) {
      isBall = true;
      ballType = 'masterball';
      pricePerItem = session.config.priceMasterball !== undefined ? session.config.priceMasterball : 250;
      itemLabel = '🟣 Master Ball';
    } else if (typeInput.includes('fire')) {
      isStone = true;
      stoneType = 'fire_stone';
      pricePerItem = session.config.priceFireStone !== undefined ? session.config.priceFireStone : 150;
      itemLabel = '🔥 Fire Stone';
    } else if (typeInput.includes('water')) {
      isStone = true;
      stoneType = 'water_stone';
      pricePerItem = session.config.priceWaterStone !== undefined ? session.config.priceWaterStone : 150;
      itemLabel = '💧 Water Stone';
    } else if (typeInput.includes('thunder')) {
      isStone = true;
      stoneType = 'thunder_stone';
      pricePerItem = session.config.priceThunderStone !== undefined ? session.config.priceThunderStone : 150;
      itemLabel = '⚡ Thunder Stone';
    } else if (typeInput.includes('leaf')) {
      isStone = true;
      stoneType = 'leaf_stone';
      pricePerItem = session.config.priceLeafStone !== undefined ? session.config.priceLeafStone : 150;
      itemLabel = '🍃 Leaf Stone';
    } else if (typeInput.includes('moon')) {
      isStone = true;
      stoneType = 'moon_stone';
      pricePerItem = session.config.priceMoonStone !== undefined ? session.config.priceMoonStone : 150;
      itemLabel = '🌙 Moon Stone';
    } else {
      const msg = `❌ @${displayName}, unknown item. Available Pokéballs: pokeball, great, ultra, master. Available Stones: fire, water, thunder, leaf, moon.`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }

    const totalPrice = pricePerItem * amount;
    const user = await db.getUser(channelId, username, displayName);

    if (user.coins < totalPrice) {
      const msg = `❌ @${displayName}, you need 🪙 ${totalPrice} coins to buy ${amount}x ${itemLabel}, but you only have 🪙 ${user.coins}!`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }

    user.coins -= totalPrice;
    if (isBall) {
      user.balls[ballType] += amount;
      await db.saveUser(channelId, user);
      io.to(channelId).emit('balls_updated', { username, balls: user.balls });
    } else if (isStone) {
      if (!user.items) user.items = {};
      user.items[stoneType] = (user.items[stoneType] || 0) + amount;
      await db.saveUser(channelId, user);
    }

    const msg = `✅ @${displayName} purchased ${amount}x ${itemLabel} for 🪙 ${totalPrice} coins! Remaining: 🪙 ${user.coins}.`;
    sendGameLog(channelId, 'system', msg);
    return msg;
  }

  // 8.6. !use [stone] [pokemon] Evolution items command
  if (cleanMsg.startsWith('!use ') || cleanMsg.startsWith('use ')) {
    const parts = messageText.trim().split(/\s+/);
    if (parts.length < 3) {
      const msg = `❌ @${displayName}, syntax: !use [stone_name] [pokemon_name]`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
    
    let stoneInput = '';
    let pokeQuery = '';
    
    // Check if they typed e.g. "!use fire stone eevee"
    if (parts[2] && parts[2].toLowerCase() === 'stone' && parts.length >= 4) {
      stoneInput = (parts[1] + '_' + parts[2]).toLowerCase().trim().replace('_', '');
      pokeQuery = parts.slice(3).join(' ').toLowerCase().trim();
    } else {
      stoneInput = parts[1].toLowerCase().trim().replace('_', '');
      pokeQuery = parts.slice(2).join(' ').toLowerCase().trim();
    }
    
    let stoneKey = '';
    if (stoneInput.includes('fire')) stoneKey = 'fire_stone';
    else if (stoneInput.includes('water')) stoneKey = 'water_stone';
    else if (stoneInput.includes('thunder')) stoneKey = 'thunder_stone';
    else if (stoneInput.includes('leaf')) stoneKey = 'leaf_stone';
    else if (stoneInput.includes('moon')) stoneKey = 'moon_stone';
    else {
      const msg = `❌ @${displayName}, unknown stone. Available: fire_stone, water_stone, thunder_stone, leaf_stone, moon_stone.`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
    
    const user = await db.getUser(channelId, username, displayName);
    if (!user.items || !user.items[stoneKey] || user.items[stoneKey] <= 0) {
      const msg = `❌ @${displayName}, you do not own a ${stoneKey.toUpperCase().replace('_', ' ')}! Buy one in the '!shop'.`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
    
    const foundPoke = user.inventory.find(p => 
      p.name.toLowerCase().replace('✨ shiny ', '') === pokeQuery || 
      p.originalName.toLowerCase() === pokeQuery ||
      p.pokemonId.toString() === pokeQuery
    );
    
    if (!foundPoke) {
      const msg = `❌ @${displayName}, you don't own a "${pokeQuery}" in your inventory!`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
    
    const origLower = foundPoke.originalName.toLowerCase().trim();
    const evoRule = STONE_EVOLUTIONS[origLower];
    let evolvedTargetName = '';
    
    if (evoRule) {
      if (typeof evoRule === 'object' && evoRule[stoneKey]) {
        evolvedTargetName = evoRule[stoneKey];
      } else if (evoRule.stone === stoneKey) {
        evolvedTargetName = evoRule.result;
      }
    }
    
    if (!evolvedTargetName) {
      const msg = `❌ @${displayName}, ${foundPoke.name} cannot be evolved using a ${stoneKey.toUpperCase().replace('_', ' ')}!`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
    
    const evolvedStatic = findPokemonByName(evolvedTargetName);
    if (!evolvedStatic) {
      const msg = `❌ @${displayName}, server error finding evolution data.`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
    
    user.items[stoneKey] -= 1;
    await db.saveUser(channelId, user);
    
    const oldName = foundPoke.name;
    const isShiny = foundPoke.shiny;
    const evolvedPoke = await db.evolvePokemon(channelId, username, foundPoke.instanceId, {
      id: evolvedStatic.id,
      name: evolvedStatic.name,
      types: evolvedStatic.types,
      baseStats: evolvedStatic.stats,
      shiny: isShiny
    });
    
    const newName = evolvedPoke.name;
    
    io.to(channelId).emit('pokemon_evolved', {
      displayName,
      oldName,
      newName,
      spriteUrl: isShiny ? evolvedStatic.shinySpriteUrl : evolvedStatic.spriteUrl,
      fallbackSpriteUrl: isShiny ? evolvedStatic.fallbackShinySpriteUrl : evolvedStatic.fallbackSpriteUrl
    });
    
    const msg = `✨ Evolution: @${displayName}'s ${oldName} evolved into ${newName} using a ${stoneKey.toUpperCase().replace('_', ' ')}!`;
    sendGameLog(channelId, 'evolution', msg);
    return msg;
  }

  // 8.6.5. Pokémon Fusion: !fuse [pokemon_name]
  if (cleanMsg.startsWith('!fuse') || cleanMsg.startsWith('fuse')) {
    const parts = messageText.trim().split(/\s+/);
    if (parts.length < 2) {
      const msg = `❌ @${displayName}, please specify which duplicate Pokémon you want to fuse! Syntax: !fuse [pokemon_name]`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
    const targetPokeName = parts.slice(1).join(' ');
    
    try {
      const result = await db.fusePokemon(channelId, username, targetPokeName);
      
      const msg = `🧬 Fusion: @${displayName} fused ${result.sacrificedCount} duplicates of ${result.survivorName}! Stats boosted by +${result.sacrificedCount * 5}! (★${result.fusionCount})`;
      
      // Update leaderboards
      io.to(channelId).emit('leaderboard_update', await db.getLeaderboard(channelId));
      io.to(channelId).emit('command_feedback', { username, text: msg });
      sendGameLog(channelId, 'evolution', msg);
      return msg;
    } catch (err) {
      const msg = `❌ @${displayName}: ${err.message}`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
  }

  // 8.7. Open-Market Trade System: !trade / !accept
  if (cleanMsg.startsWith('!trade') || cleanMsg === 'trade') {
    const parts = messageText.trim().split(/\s+/);
    if (!session.tradeOffers) session.tradeOffers = {};
    if (!session.tradeAcceptances) session.tradeAcceptances = {};

    if (parts.length < 2) {
      const offers = Object.keys(session.tradeOffers).map(u => `@${session.tradeOffers[u].displayName} (${session.tradeOffers[u].pokemon.name})`).join(', ');
      const msg = offers ? `🤝 Active Trade Offers: ${offers}. Type '!trade [your_pokemon]' to offer one, or '!accept @player' to trade.` : `🤝 No active trade offers. Type '!trade [your_pokemon]' to put a Pokémon up for trade!`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
    
    const query = parts.slice(1).join(' ').toLowerCase().trim();
    if (query === 'cancel') {
      delete session.tradeOffers[username.toLowerCase()];
      delete session.tradeAcceptances[username.toLowerCase()];
      const msg = `🤝 @${displayName}'s active trade offer has been cancelled.`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
    
    const user = await db.getUser(channelId, username, displayName);
    const foundPoke = user.inventory.find(p => 
      p.name.toLowerCase().replace('✨ shiny ', '') === query || 
      p.originalName.toLowerCase() === query ||
      p.pokemonId.toString() === query
    );
    
    if (!foundPoke) {
      const msg = `❌ @${displayName}, you don't own a "${query}" to offer for trade!`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
    
    session.tradeOffers[username.toLowerCase()] = {
      pokemon: foundPoke,
      displayName: displayName
    };
    delete session.tradeAcceptances[username.toLowerCase()];
    
    const msg = `🤝 @${displayName} is now offering their ${foundPoke.name} for trade! Type '!trade [your_pokemon]' to make an offer, or '!accept @${displayName}' to request an exchange.`;
    io.to(channelId).emit('command_feedback', { username, text: msg });
    return msg;
  }

  if (cleanMsg.startsWith('!accept ') || cleanMsg.startsWith('accept ')) {
    const parts = messageText.trim().split(/\s+/);
    if (!session.tradeOffers) session.tradeOffers = {};
    if (!session.tradeAcceptances) session.tradeAcceptances = {};

    if (parts.length < 2) {
      const msg = `❌ @${displayName}, syntax: !accept @username`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
    
    const targetMention = parts[1].replace('@', '').toLowerCase().trim();
    if (targetMention === username.toLowerCase()) {
      const msg = `❌ @${displayName}, you cannot trade with yourself!`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
    
    const myOffer = session.tradeOffers[username.toLowerCase()];
    if (!myOffer) {
      const msg = `❌ @${displayName}, you must first offer a Pokémon for trade using '!trade [your_pokemon]' before accepting!`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
    
    const targetOffer = session.tradeOffers[targetMention];
    if (!targetOffer) {
      const msg = `❌ @${displayName}, @${targetMention} is not currently offering any Pokémon for trade.`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
    
    session.tradeAcceptances[username.toLowerCase()] = targetMention;
    
    if (session.tradeAcceptances[targetMention] === username.toLowerCase()) {
      try {
        const userA = await db.getUser(channelId, username, displayName);
        const userB = await db.getUser(channelId, targetMention);
        
        const ownA = userA.inventory.some(p => p.instanceId === myOffer.pokemon.instanceId);
        const ownB = userB.inventory.some(p => p.instanceId === targetOffer.pokemon.instanceId);
        
        if (!ownA || !ownB) {
          const msg = `❌ Trade cancelled: One or both trainers no longer own the offered Pokémon.`;
          delete session.tradeOffers[username.toLowerCase()];
          delete session.tradeOffers[targetMention];
          delete session.tradeAcceptances[username.toLowerCase()];
          delete session.tradeAcceptances[targetMention];
          io.to(channelId).emit('command_feedback', { username, text: msg });
          return msg;
        }
        
        await db.swapPokemonOwnership(channelId, username, myOffer.pokemon.instanceId, targetMention, targetOffer.pokemon.instanceId);
        
        const msg = `🤝 Trade successful! @${displayName} traded ${myOffer.pokemon.name} to @${targetOffer.displayName} for ${targetOffer.pokemon.name}!`;
        sendGameLog(channelId, 'system', msg);
        
        io.to(channelId).emit('trade_completed', {
          playerA: displayName,
          pokeA: myOffer.pokemon.name,
          playerB: targetOffer.displayName,
          pokeB: targetOffer.pokemon.name
        });
        
        delete session.tradeOffers[username.toLowerCase()];
        delete session.tradeOffers[targetMention];
        delete session.tradeAcceptances[username.toLowerCase()];
        delete session.tradeAcceptances[targetMention];
        return msg;
      } catch (err) {
        console.error('[Trade] Error swapping ownership:', err.message);
        const msg = `❌ Error completing trade: ${err.message}`;
        io.to(channelId).emit('command_feedback', { username, text: msg });
        return msg;
      }
    } else {
      const msg = `🤝 @${displayName} wants to trade their ${myOffer.pokemon.name} for @${targetOffer.displayName}'s ${targetOffer.pokemon.name}! @${targetOffer.displayName}, type '!accept @${displayName}' to complete the trade!`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
  }

  // 8.8. Boss Raids: !attack / !raid
  if (cleanMsg === '!attack' || cleanMsg === 'attack') {
    if (!session.activeRaidBoss) {
      const msg = `❌ @${displayName}, there is no active Boss Raid to attack right now.`;
      io.to(channelId).emit('command_feedback', { username, text: msg });
      return msg;
    }
    
    const user = await db.getUser(channelId, username, displayName);
    let activePoke = null;
    let attackPower = 20;
    let pokemonName = 'Fists';
    
    if (user.buddyInstanceId) {
      activePoke = user.inventory.find(p => p.instanceId === user.buddyInstanceId);
    }
    if (!activePoke && user.activePokemonId) {
      activePoke = user.inventory.find(p => p.instanceId === user.activePokemonId);
    }
    
    if (activePoke) {
      pokemonName = activePoke.name;
      const baseAtk = activePoke.baseStats.attack || 50;
      const levelMult = 1 + (user.level * 0.05);
      const variance = 0.85 + Math.random() * 0.3;
      attackPower = Math.round(baseAtk * levelMult * variance * 0.5);
    } else {
      attackPower = Math.round((20 + (user.level * 2)) * (0.85 + Math.random() * 0.3));
    }
    
    const boss = session.activeRaidBoss;
    boss.currentHp = Math.max(0, boss.currentHp - attackPower);
    boss.participants[username] = (boss.participants[username] || 0) + attackPower;
    
    io.to(channelId).emit('raid_hit', {
      username,
      displayName,
      pokemonName,
      damage: attackPower,
      currentHp: boss.currentHp,
      maxHp: boss.maxHp
    });
    
    let reply = `@${displayName}'s ${pokemonName} hit ${boss.name} for 💥 ${attackPower} damage! (${boss.currentHp}/${boss.maxHp} HP left)`;
    
    if (boss.currentHp <= 0) {
      clearTimeout(session.wildDespawnTimer);
      const baseCoins = session.config.raidRewardCoins !== undefined ? Number(session.config.raidRewardCoins) : 250;
      const baseXP = session.config.raidRewardXp !== undefined ? Number(session.config.raidRewardXp) : 150;
      
      const winners = Object.keys(boss.participants);
      for (const winnerUsername of winners) {
        const winnerDmg = boss.participants[winnerUsername];
        const shareRatio = winnerDmg / boss.maxHp;
        const rewardCoins = Math.round(baseCoins * shareRatio) + 50;
        const rewardXP = Math.round(baseXP * shareRatio) + 30;
        
        let stoneItem = '';
        const stoneChance = session.config.raidDropStoneChance !== undefined ? Number(session.config.raidDropStoneChance) : 0.15;
        if (Math.random() < stoneChance) {
          const stones = ['fire_stone', 'water_stone', 'thunder_stone', 'leaf_stone', 'moon_stone'];
          stoneItem = stones[Math.floor(Math.random() * stones.length)];
        }
        
        const winUser = await db.getUser(channelId, winnerUsername);
        winUser.coins += rewardCoins;
        winUser.xp += rewardXP;
        if (stoneItem) {
          if (!winUser.items) winUser.items = {};
          winUser.items[stoneItem] = (winUser.items[stoneItem] || 0) + 1;
        }
        
        let leveledUp = false;
        while (winUser.xp >= winUser.level * 100) {
          winUser.xp -= winUser.level * 100;
          winUser.level += 1;
          leveledUp = true;
          winUser.balls.greatball += 3;
          winUser.balls.ultraball += 1;
          winUser.coins += 100;
        }
        
        await db.saveUser(channelId, winUser);
        
        if (leveledUp) {
          io.to(channelId).emit('player_level_up', {
            username: winnerUsername,
            displayName: winUser.displayName,
            level: winUser.level,
            coinsReward: 100,
            greatballsReward: 3,
            ultraballsReward: 1
          });
        }
        
        io.to(channelId).emit('balls_updated', { username: winnerUsername, balls: winUser.balls });
      }
      
      io.to(channelId).emit('raid_end', {
        victory: true,
        message: `🏆 The Raid Boss ${boss.name} has been defeated! Rewards distributed.`,
        participants: boss.participants
      });
      
      sendGameLog(channelId, 'system', `🏆 The Raid Boss ${boss.name} was defeated! Participants rewarded.`);
      session.activeRaidBoss = null;
    }
    
    return reply;
  }

  if (cleanMsg === '!raid' || cleanMsg === 'raid') {
    if (!session.activeRaidBoss) {
      return `❌ No active Raid Boss. Gym is quiet!`;
    }
    const boss = session.activeRaidBoss;
    return `🚨 ACTIVE RAID: ${boss.name} | HP: ${boss.currentHp}/${boss.maxHp}. Type !attack to battle!`;
  }

  // 8.9. !buy commands backup check

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
    return `🎮 Pokémon Game: !daily | !inventory | !coins | !shop | !buy [ball/stone] [amt] | !buddy [name] | !select [name] | !catch [ball_type] | !fight [@user/wild] [your_poke] | !trade @user [my_poke] [their_poke] | !use [stone] [poke] | !fuse [name] | !attack`;
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
    const host = socket.handshake.headers.host || 'localhost:3000';
    const protocol = socket.handshake.headers['x-forwarded-proto'] || 'http';
    const baseUrl = `${protocol}://${host}`;
    processCommand(channelId, username, displayName, messageText, baseUrl);
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

  // Admin bulk update player details (from dashboard viewer management table multi-selection)
  socket.on('admin_bulk_update_players', async (data) => {
    const { password, usernames, item, actionType, amount } = data;
    if (session.config.adminPassword && password !== session.config.adminPassword) {
      socket.emit('command_feedback', { text: '❌ Unauthorized: Incorrect admin password!' });
      return;
    }
    
    if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
      socket.emit('players_bulk_updated_ack', { success: false, error: 'No viewers selected!' });
      return;
    }

    try {
      console.log(`[Admin] [${channelId}] Bulk updating ${usernames.length} players...`);
      let successCount = 0;
      
      for (const username of usernames) {
        const user = await db.getUser(channelId, username);
        if (user) {
          const value = parseInt(amount);
          
          if (item === 'pokeball') {
            if (actionType === 'add') user.balls.pokeball = Math.max(0, user.balls.pokeball + value);
            else user.balls.pokeball = Math.max(0, value);
          } else if (item === 'greatball') {
            if (actionType === 'add') user.balls.greatball = Math.max(0, user.balls.greatball + value);
            else user.balls.greatball = Math.max(0, value);
          } else if (item === 'ultraball') {
            if (actionType === 'add') user.balls.ultraball = Math.max(0, user.balls.ultraball + value);
            else user.balls.ultraball = Math.max(0, value);
          } else if (item === 'masterball') {
            if (actionType === 'add') user.balls.masterball = Math.max(0, user.balls.masterball + value);
            else user.balls.masterball = Math.max(0, value);
          } else if (item === 'coins') {
            if (actionType === 'add') user.coins = Math.max(0, user.coins + value);
            else user.coins = Math.max(0, value);
          }
          
          await db.saveUser(channelId, user);
          successCount++;
        }
      }
      
      // Notify all clients of update
      io.to(channelId).emit('leaderboard_update', await db.getLeaderboard(channelId));
      
      // Refresh player list for dashboard
      const list = await db.getAllPlayers(channelId);
      socket.emit('all_players_data', list);
      
      socket.emit('players_bulk_updated_ack', { success: true, count: successCount });
    } catch (err) {
      console.error(`[Admin] [${channelId}] Bulk update failed:`, err.message);
      socket.emit('players_bulk_updated_ack', { success: false, error: err.message });
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
  await ensureSessionInitialized(channelId);

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
