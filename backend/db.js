require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
let pool = null;
let useLocalFallback = false;

// Local fallback database files configuration
const DB_DIR = path.join(__dirname, 'data');
const LOCAL_USERS_FILE = path.join(DB_DIR, 'users.json');
const LOCAL_CONFIGS_FILE = path.join(DB_DIR, 'configs.json');

let localUsers = {};
let localConfigs = {};

if (connectionString && connectionString !== 'YOUR_SUPABASE_DATABASE_URL_HERE') {
  // Parse connection string using Node's built-in URL — no extra dependency needed
  try {
    const parsed = new URL(connectionString);
    pool = new Pool({
      host: parsed.hostname,
      port: parseInt(parsed.port) || 5432,
      database: parsed.pathname.replace('/', ''),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      ssl: { rejectUnauthorized: false }
    });
    console.log('[Database] Configured connection pool for Supabase PostgreSQL.');
    
    // Asynchronously run database migrations
    runAutoMigrations();
  } catch (e) {
    console.error('[Database] Failed to parse DATABASE_URL, falling back to local JSON:', e.message);
    useLocalFallback = true;
  }
} else {
  useLocalFallback = true;
  console.log('[Database] WARNING: DATABASE_URL is not set. Falling back to multi-tenant LOCAL JSON files.');
  
  // Initialize directories
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  
  // Load local users cache
  if (fs.existsSync(LOCAL_USERS_FILE)) {
    try {
      localUsers = JSON.parse(fs.readFileSync(LOCAL_USERS_FILE, 'utf-8') || '{}');
    } catch (e) {
      console.error('[Database] Failed loading local users:', e.message);
    }
  }
  
  // Load local configurations cache
  if (fs.existsSync(LOCAL_CONFIGS_FILE)) {
    try {
      localConfigs = JSON.parse(fs.readFileSync(LOCAL_CONFIGS_FILE, 'utf-8') || '{}');
    } catch (e) {
      console.error('[Database] Failed loading local configs:', e.message);
    }
  }
}

/**
 * Migration helper for local fallback JSON user objects
 */
function migrateLocalUser(u) {
  if (!u) return u;
  if (!u.balls) u.balls = {};
  if (u.balls.pokeball === undefined) u.balls.pokeball = 10;
  if (u.balls.greatball === undefined) u.balls.greatball = 3;
  if (u.balls.ultraball === undefined) u.balls.ultraball = 1;
  if (u.balls.masterball === undefined) u.balls.masterball = 0;
  if (u.coins === undefined) u.coins = 100;
  if (u.xp === undefined) u.xp = 0;
  if (u.level === undefined) u.level = 1;
  if (u.buddyInstanceId === undefined) u.buddyInstanceId = null;
  return u;
}

/**
 * Migration helper for local fallback JSON config objects
 */
function migrateLocalConfig(c) {
  if (!c) return c;
  if (c.twitchChannel === undefined) c.twitchChannel = '';
  if (c.obsWebsocketUrl === undefined) c.obsWebsocketUrl = '';
  if (c.spawnTarget === undefined) c.spawnTarget = '';
  if (c.youtubeApiKey === undefined) c.youtubeApiKey = '';
  return c;
}

/**
 * Automatically applies SQL migrations to Postgres tables on start
 */
async function runAutoMigrations() {
  if (useLocalFallback || !pool) return;
  console.log('[Database] Checking schema auto-migrations...');
  try {
    const client = await pool.connect();
    
    // Add columns to players table
    await client.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 100,
      ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS masterballs INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS buddy_instance_id VARCHAR(50) DEFAULT NULL;
    `);

    // Add columns to streamer_configs table
    await client.query(`
      ALTER TABLE streamer_configs 
      ADD COLUMN IF NOT EXISTS twitch_channel VARCHAR(50) DEFAULT '',
      ADD COLUMN IF NOT EXISTS obs_websocket_url VARCHAR(200) DEFAULT '',
      ADD COLUMN IF NOT EXISTS spawn_target VARCHAR(50) DEFAULT '',
      ADD COLUMN IF NOT EXISTS youtube_api_key VARCHAR(200) DEFAULT '';
    `);

    client.release();
    console.log('[Database] Auto-migrations check completed successfully.');
  } catch (err) {
    console.error('[Database] Auto-migrations failed:', err.message);
  }
}

/**
 * Persists local users data to users.json (Local Fallback mode)
 */
function saveLocalUsers() {
  try {
    const tempFile = LOCAL_USERS_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(localUsers, null, 2), 'utf-8');
    fs.renameSync(tempFile, LOCAL_USERS_FILE);
  } catch (err) {
    console.error('[Database] Error saving local users:', err.message);
  }
}

/**
 * Persists local configurations data to configs.json (Local Fallback mode)
 */
function saveLocalConfigs() {
  try {
    const tempFile = LOCAL_CONFIGS_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(localConfigs, null, 2), 'utf-8');
    fs.renameSync(tempFile, LOCAL_CONFIGS_FILE);
  } catch (err) {
    console.error('[Database] Error saving local configs:', err.message);
  }
}

/**
 * Executes a PostgreSQL query (Supabase mode)
 */
async function query(text, params) {
  if (!pool) {
    throw new Error('Database is not initialized. Check your environment/database credentials.');
  }
  return pool.query(text, params);
}

/**
 * Gets a user by username or initializes a new one.
 */
async function getUser(streamerId, username, displayName = null) {
  const key = username.toLowerCase().trim();
  const streamer = streamerId.toLowerCase().trim();
  const compositeKey = `${streamer}_${key}`;
  
  if (useLocalFallback) {
    if (!localUsers[compositeKey]) {
      localUsers[compositeKey] = {
        username: key,
        displayName: displayName || username,
        balls: {
          pokeball: 10,
          greatball: 3,
          ultraball: 1,
          masterball: 0
        },
        coins: 100,
        xp: 0,
        level: 1,
        buddyInstanceId: null,
        inventory: [],
        activePokemonId: null,
        lastCatchAttempt: 0,
        lastDaily: 0
      };
      saveLocalUsers();
    } else {
      migrateLocalUser(localUsers[compositeKey]);
      if (displayName && localUsers[compositeKey].displayName !== displayName) {
        localUsers[compositeKey].displayName = displayName;
        saveLocalUsers();
      }
    }
    return JSON.parse(JSON.stringify(localUsers[compositeKey]));
  }
  
  // PostgreSQL version
  let res = await query(
    'SELECT * FROM players WHERE streamer_id = $1 AND username = $2',
    [streamer, key]
  );
  
  if (res.rows.length === 0) {
    const defaultBalls = { pokeball: 10, greatball: 3, ultraball: 1, masterball: 0 };
    await query(
      `INSERT INTO players (streamer_id, username, display_name, pokeballs, greatballs, ultraballs, masterballs, coins, xp, level, last_daily, last_catch_attempt, active_pokemon_id, buddy_instance_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 100, 0, 1, 0, 0, NULL, NULL)`,
      [streamer, key, displayName || username, defaultBalls.pokeball, defaultBalls.greatball, defaultBalls.ultraball, defaultBalls.masterball]
    );
    res = await query(
      'SELECT * FROM players WHERE streamer_id = $1 AND username = $2',
      [streamer, key]
    );
  } else if (displayName && res.rows[0].display_name !== displayName) {
    await query(
      'UPDATE players SET display_name = $1 WHERE streamer_id = $2 AND username = $3',
      [displayName, streamer, key]
    );
    res.rows[0].display_name = displayName;
  }
  
  const invRes = await query(
    'SELECT * FROM inventories WHERE streamer_id = $1 AND username = $2 ORDER BY caught_at ASC',
    [streamer, key]
  );
  
  const dbUser = res.rows[0];
  
  return {
    username: dbUser.username,
    displayName: dbUser.display_name,
    balls: {
      pokeball: dbUser.pokeballs,
      greatball: dbUser.greatballs,
      ultraball: dbUser.ultraballs,
      masterball: dbUser.masterballs || 0
    },
    coins: dbUser.coins !== undefined && dbUser.coins !== null ? dbUser.coins : 100,
    xp: dbUser.xp || 0,
    level: dbUser.level || 1,
    buddyInstanceId: dbUser.buddy_instance_id || null,
    inventory: invRes.rows.map(p => ({
      instanceId: p.instance_id,
      pokemonId: p.pokemon_id,
      name: p.pokemon_name,
      originalName: p.pokemon_name.replace('✨ Shiny ', ''),
      types: p.types,
      baseStats: {
        hp: p.base_hp,
        attack: p.base_atk,
        defense: p.base_def,
        speed: p.base_spd
      },
      shiny: p.shiny,
      wins: p.wins,
      currentStage: p.current_stage,
      caughtAt: Number(p.caught_at)
    })),
    activePokemonId: dbUser.active_pokemon_id,
    lastCatchAttempt: Number(dbUser.last_catch_attempt),
    lastDaily: Number(dbUser.last_daily)
  };
}

/**
 * Saves user details (balance, cooldowns).
 */
async function saveUser(streamerId, user) {
  const key = user.username.toLowerCase();
  const streamer = streamerId.toLowerCase();
  const compositeKey = `${streamer}_${key}`;
  
  if (useLocalFallback) {
    localUsers[compositeKey] = JSON.parse(JSON.stringify(user));
    saveLocalUsers();
    return;
  }
  
  // PostgreSQL version
  await query(
    `UPDATE players 
     SET display_name = $1, pokeballs = $2, greatballs = $3, ultraballs = $4, masterballs = $5,
         coins = $6, xp = $7, level = $8, buddy_instance_id = $9,
         active_pokemon_id = $10, last_daily = $11, last_catch_attempt = $12
     WHERE streamer_id = $13 AND username = $14`,
    [
      user.displayName, 
      user.balls.pokeball, 
      user.balls.greatball, 
      user.balls.ultraball, 
      user.balls.masterball || 0,
      user.coins || 0,
      user.xp || 0,
      user.level || 1,
      user.buddyInstanceId || null,
      user.activePokemonId, 
      BigInt(user.lastDaily), 
      BigInt(user.lastCatchAttempt),
      streamer, 
      key
    ]
  );
}

/**
 * Adds a Pokémon instance to the player's inventory.
 */
async function addPokemon(streamerId, username, displayName, pokemonData, isShiny = false) {
  const streamer = streamerId.toLowerCase().trim();
  const key = username.toLowerCase().trim();
  
  if (useLocalFallback) {
    const user = await getUser(streamerId, username, displayName);
    const instanceId = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const name = isShiny ? `✨ Shiny ${pokemonData.name}` : pokemonData.name;
    const hp = pokemonData.stats ? pokemonData.stats.hp : pokemonData.baseStats.hp;
    const attack = pokemonData.stats ? pokemonData.stats.attack : pokemonData.baseStats.attack;
    const defense = pokemonData.stats ? pokemonData.stats.defense : pokemonData.baseStats.defense;
    const speed = pokemonData.stats ? pokemonData.stats.speed : pokemonData.baseStats.speed;
    const types = pokemonData.types;
    
    const newPoke = {
      instanceId,
      pokemonId: pokemonData.id,
      name,
      originalName: pokemonData.name,
      types,
      baseStats: { hp, attack, defense, speed },
      shiny: isShiny,
      wins: 0,
      currentStage: 1,
      caughtAt: Date.now()
    };
    
    user.inventory.push(newPoke);
    if (!user.activePokemonId || !user.inventory.some(p => p.instanceId === user.activePokemonId)) {
      user.activePokemonId = instanceId;
    }
    await saveUser(streamerId, user);
    return newPoke;
  }
  
  // PostgreSQL version
  const user = await getUser(streamerId, username, displayName);
  const instanceId = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  const name = isShiny ? `✨ Shiny ${pokemonData.name}` : pokemonData.name;
  
  const hp = pokemonData.stats ? pokemonData.stats.hp : pokemonData.baseStats.hp;
  const attack = pokemonData.stats ? pokemonData.stats.attack : pokemonData.baseStats.attack;
  const defense = pokemonData.stats ? pokemonData.stats.defense : pokemonData.baseStats.defense;
  const speed = pokemonData.stats ? pokemonData.stats.speed : pokemonData.baseStats.speed;
  const types = pokemonData.types;
  
  await query(
    `INSERT INTO inventories (instance_id, streamer_id, username, pokemon_id, pokemon_name, types, base_hp, base_atk, base_def, base_spd, shiny, wins, current_stage, caught_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, 1, $12)`,
    [instanceId, streamer, key, pokemonData.id, name, types, hp, attack, defense, speed, isShiny, BigInt(Date.now())]
  );

  if (!user.activePokemonId || !user.inventory.some(p => p.instanceId === user.activePokemonId)) {
    user.activePokemonId = instanceId;
    await query(
      'UPDATE players SET active_pokemon_id = $1 WHERE streamer_id = $2 AND username = $3',
      [instanceId, streamer, key]
    );
  }

  return {
    instanceId,
    pokemonId: pokemonData.id,
    name,
    originalName: pokemonData.name,
    types,
    baseStats: { hp, attack, defense, speed },
    shiny: isShiny,
    wins: 0,
    currentStage: 1,
    caughtAt: Date.now()
  };
}

/**
 * Selects active Pokémon for fights.
 */
async function selectActivePokemon(streamerId, username, pokemonNameOrId) {
  const streamer = streamerId.toLowerCase().trim();
  const key = username.toLowerCase().trim();
  
  if (useLocalFallback) {
    const user = await getUser(streamerId, username);
    const cleanSearch = pokemonNameOrId.toLowerCase().trim();
    
    const found = user.inventory.find(p => {
      const isIdMatch = p.pokemonId.toString() === cleanSearch;
      const isNameMatch = p.name.toLowerCase().replace('✨ shiny ', '') === cleanSearch ||
                          p.originalName.toLowerCase() === cleanSearch;
      return isIdMatch || isNameMatch;
    });
    
    if (!found) {
      return { success: false, message: 'You do not own that Pokémon!' };
    }
    
    user.activePokemonId = found.instanceId;
    await saveUser(streamerId, user);
    return { success: true, pokemon: found };
  }
  
  // PostgreSQL version
  const user = await getUser(streamerId, username);
  const cleanSearch = pokemonNameOrId.toLowerCase().trim();
  
  const found = user.inventory.find(p => {
    const isIdMatch = p.pokemonId.toString() === cleanSearch;
    const isNameMatch = p.name.toLowerCase().replace('✨ shiny ', '') === cleanSearch ||
                        p.originalName.toLowerCase() === cleanSearch;
    return isIdMatch || isNameMatch;
  });
  
  if (!found) {
    return { success: false, message: 'You do not own that Pokémon!' };
  }
  
  await query(
    'UPDATE players SET active_pokemon_id = $1 WHERE streamer_id = $2 AND username = $3',
    [found.instanceId, streamer, key]
  );
  
  return { success: true, pokemon: found };
}

/**
 * Awards a victory win count. Handles evolutions if wins hit 10.
 */
async function addWin(streamerId, username, instanceId, staticPokemonDb) {
  const key = username.toLowerCase();
  const streamer = streamerId.toLowerCase();
  
  if (useLocalFallback) {
    const user = await getUser(streamerId, username);
    const poke = user.inventory.find(p => p.instanceId === instanceId);
    if (!poke) return null;
    
    poke.wins += 1;
    let evolved = false;
    let oldName = poke.name;
    let newName = poke.name;
    
    if (poke.wins >= 10) {
      const staticPoke = staticPokemonDb[poke.pokemonId];
      if (staticPoke && staticPoke.evolution) {
        let evolutionId;
        if (Array.isArray(staticPoke.evolution)) {
          const randomIndex = Math.floor(Math.random() * staticPoke.evolution.length);
          evolutionId = staticPoke.evolution[randomIndex];
        } else {
          evolutionId = staticPoke.evolution;
        }
        
        const evolvedStatic = staticPokemonDb[evolutionId];
        if (evolvedStatic) {
          poke.pokemonId = evolvedStatic.id;
          poke.originalName = evolvedStatic.name;
          poke.name = poke.shiny ? `✨ Shiny ${evolvedStatic.name}` : evolvedStatic.name;
          poke.types = evolvedStatic.types;
          poke.baseStats = evolvedStatic.stats;
          poke.currentStage += 1;
          poke.wins = 0; // Reset wins
          evolved = true;
          newName = poke.name;
        }
      }
    }
    
    await saveUser(streamerId, user);
    return {
      pokemon: poke,
      evolved,
      oldName,
      newName
    };
  }
  
  // PostgreSQL version
  const res = await query(
    'SELECT * FROM inventories WHERE instance_id = $1 AND streamer_id = $2 AND username = $3',
    [instanceId, streamer, key]
  );
  if (res.rows.length === 0) return null;
  
  const row = res.rows[0];
  let wins = row.wins + 1;
  let evolved = false;
  let oldName = row.pokemon_name;
  let newName = row.pokemon_name;
  let currentStage = row.current_stage;
  let pokemonId = row.pokemon_id;
  let pokemonName = row.pokemon_name;
  let types = row.types;
  let hp = row.base_hp;
  let attack = row.base_atk;
  let defense = row.base_def;
  let speed = row.base_spd;
  
  if (wins >= 10) {
    const staticPoke = staticPokemonDb[pokemonId];
    if (staticPoke && staticPoke.evolution) {
      let evolutionId;
      if (Array.isArray(staticPoke.evolution)) {
        const randomIndex = Math.floor(Math.random() * staticPoke.evolution.length);
        evolutionId = staticPoke.evolution[randomIndex];
      } else {
        evolutionId = staticPoke.evolution;
      }
      
      const evolvedStatic = staticPokemonDb[evolutionId];
      if (evolvedStatic) {
        pokemonId = evolvedStatic.id;
        const cleanName = evolvedStatic.name;
        pokemonName = row.shiny ? `✨ Shiny ${cleanName}` : cleanName;
        newName = pokemonName;
        types = evolvedStatic.types;
        hp = evolvedStatic.stats.hp;
        attack = evolvedStatic.stats.attack;
        defense = evolvedStatic.stats.defense;
        speed = evolvedStatic.stats.speed;
        currentStage += 1;
        wins = 0;
        evolved = true;
      }
    }
  }
  
  await query(
    `UPDATE inventories 
     SET wins = $1, pokemon_id = $2, pokemon_name = $3, types = $4, 
         base_hp = $5, base_atk = $6, base_def = $7, base_spd = $8, current_stage = $9
     WHERE instance_id = $10`,
    [wins, pokemonId, pokemonName, types, hp, attack, defense, speed, currentStage, instanceId]
  );
  
  return {
    pokemon: {
      instanceId,
      pokemonId,
      name: pokemonName,
      originalName: pokemonName.replace('✨ Shiny ', ''),
      types,
      baseStats: { hp, attack, defense, speed },
      shiny: row.shiny,
      wins,
      currentStage,
      caughtAt: Number(row.caught_at)
    },
    evolved,
    oldName,
    newName
  };
}

/**
 * Claims daily Pokeball allowance.
 */
async function claimDaily(streamerId, username, displayName) {
  if (useLocalFallback) {
    const user = await getUser(streamerId, username, displayName);
    const now = Date.now();
    const COOLDOWN = 24 * 60 * 60 * 1000;
    
    if (now - user.lastDaily < COOLDOWN) {
      const remainingMs = COOLDOWN - (now - user.lastDaily);
      const hours = Math.floor(remainingMs / (1000 * 60 * 60));
      const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      return {
        success: false,
        hours,
        minutes
      };
    }
    
    const reward = { pokeball: 10, greatball: 3, ultraball: 1 };
    user.balls.pokeball += reward.pokeball;
    user.balls.greatball += reward.greatball;
    user.balls.ultraball += reward.ultraball;
    user.lastDaily = now;
    
    await saveUser(streamerId, user);
    return { success: true, reward, newTotal: user.balls };
  }
  
  // PostgreSQL version
  const user = await getUser(streamerId, username, displayName);
  const now = Date.now();
  const COOLDOWN = 24 * 60 * 60 * 1000;
  
  if (now - user.lastDaily < COOLDOWN) {
    const remainingMs = COOLDOWN - (now - user.lastDaily);
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    return {
      success: false,
      hours,
      minutes
    };
  }
  
  const reward = { pokeball: 10, greatball: 3, ultraball: 1 };
  user.balls.pokeball += reward.pokeball;
  user.balls.greatball += reward.greatball;
  user.balls.ultraball += reward.ultraball;
  user.lastDaily = now;
  
  await saveUser(streamerId, user);
  
  return {
    success: true,
    reward,
    newTotal: user.balls
  };
}

/**
 * Returns streamer-specific leaderboard.
 */
async function getLeaderboard(streamerId) {
  const streamer = streamerId.toLowerCase().trim();
  
  if (useLocalFallback) {
    const list = Object.keys(localUsers)
      .filter(k => k.startsWith(`${streamer}_`))
      .map(k => {
        const u = localUsers[k];
        const totalWins = u.inventory.reduce((sum, p) => sum + (p.wins || 0), 0);
        return {
          displayName: u.displayName,
          username: u.username,
          totalPokemon: u.inventory.length,
          totalWins: totalWins,
          activePokemon: u.inventory.find(p => p.instanceId === u.activePokemonId)
        };
      });
      
    return list.sort((a, b) => b.totalPokemon - a.totalPokemon || b.totalWins - a.totalWins).slice(0, 10);
  }
  
  // PostgreSQL version
  const playersRes = await query(
    `SELECT 
       p.username, 
       p.display_name as "displayName", 
       p.active_pokemon_id as "activePokemonId",
       COUNT(i.instance_id)::int as "totalPokemon",
       COALESCE(SUM(i.wins), 0)::int as "totalWins"
     FROM players p
     LEFT JOIN inventories i ON p.streamer_id = i.streamer_id AND p.username = i.username
     WHERE p.streamer_id = $1
     GROUP BY p.username, p.display_name, p.active_pokemon_id`,
    [streamer]
  );
  
  const list = [];
  for (const row of playersRes.rows) {
    let activePokemon = null;
    if (row.activePokemonId) {
      const activeRes = await query(
        'SELECT * FROM inventories WHERE instance_id = $1',
        [row.activePokemonId]
      );
      if (activeRes.rows.length > 0) {
        const p = activeRes.rows[0];
        activePokemon = {
          instanceId: p.instance_id,
          pokemonId: p.pokemon_id,
          name: p.pokemon_name,
          originalName: p.pokemon_name.replace('✨ Shiny ', ''),
          types: p.types,
          baseStats: {
            hp: p.base_hp,
            attack: p.base_atk,
            defense: p.base_def,
            speed: p.base_spd
          },
          shiny: p.shiny,
          wins: p.wins,
          currentStage: p.current_stage,
          caughtAt: Number(p.caught_at)
        };
      }
    }
    
    list.push({
      username: row.username,
      displayName: row.displayName,
      totalPokemon: row.totalPokemon,
      totalWins: row.totalWins,
      activePokemon
    });
  }
  
  return list.sort((a, b) => b.totalPokemon - a.totalPokemon || b.totalWins - a.totalWins).slice(0, 10);
}

/**
 * Gets a streamer's configuration details.
 */
async function getStreamerConfig(streamerId) {
  const streamer = streamerId.toLowerCase().trim();
  
  if (useLocalFallback) {
    if (!localConfigs[streamer]) {
      localConfigs[streamer] = {
        channelId: streamerId,
        youtubeChannelId: '',
        videoId: '',
        spawnIntervalMs: 60000,
        wildDespawnTimeoutMs: 45000,
        catchCooldownMs: 15000,
        shinyChance: 0.01,
        adminPassword: '',
        theme: 'modern',
        sfxVolume: 50,
        showLiveFeed: true,
        liveFeedTitle: 'LIVE GAME FEED',
        showSpawnAlert: true,
        spawnAlertTitle: 'WILD SPAWN',
        spawnCatchGuide: 'Type catch in chat!',
        showBattleArena: true,
        primaryColor: '#3b82f6',
        customCss: '',
        spawnCardScale: 1.0,
        spawnCardPosition: 'bottom-left',
        showCardSprite: true,
        showCardTypes: true,
        showCardInstructions: true,
        twitchChannel: '',
        obsWebsocketUrl: '',
        spawnTarget: '',
        youtubeApiKey: ''
      };
      saveLocalConfigs();
    } else {
      migrateLocalConfig(localConfigs[streamer]);
    }
    return JSON.parse(JSON.stringify(localConfigs[streamer]));
  }
  
  // PostgreSQL version
  let res = await query('SELECT * FROM streamer_configs WHERE channel_id = $1', [streamer]);
  
  if (res.rows.length === 0) {
    const defaultConfig = {
      channelId: streamer,
      youtubeChannelId: '',
      videoId: '',
      spawnIntervalMs: 60000,
      wildDespawnTimeoutMs: 45000,
      catchCooldownMs: 15000,
      shinyChance: 0.01,
      adminPassword: '',
      theme: 'modern',
      sfxVolume: 50,
      showLiveFeed: true,
      liveFeedTitle: 'LIVE GAME FEED',
      showSpawnAlert: true,
      spawnAlertTitle: 'WILD SPAWN',
      spawnCatchGuide: 'Type catch in chat!',
      showBattleArena: true,
      primaryColor: '#3b82f6',
      customCss: '',
      spawnCardScale: 1.0,
      spawnCardPosition: 'bottom-left',
      showCardSprite: true,
      showCardTypes: true,
      showCardInstructions: true,
      twitchChannel: '',
      obsWebsocketUrl: '',
      spawnTarget: '',
      youtubeApiKey: ''
    };
    
    await query(
      `INSERT INTO streamer_configs (channel_id, youtube_channel_id, video_id, spawn_interval_ms, wild_despawn_timeout_ms, catch_cooldown_ms, shiny_chance, admin_password, theme, sfx_volume, show_live_feed, live_feed_title, show_spawn_alert, spawn_alert_title, spawn_catch_guide, show_battle_arena, primary_color, custom_css, spawn_card_scale, spawn_card_position, show_card_sprite, show_card_types, show_card_instructions, twitch_channel, obs_websocket_url, spawn_target, youtube_api_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)`,
      [
        defaultConfig.channelId, defaultConfig.youtubeChannelId, defaultConfig.videoId, defaultConfig.spawnIntervalMs, defaultConfig.wildDespawnTimeoutMs, defaultConfig.catchCooldownMs, defaultConfig.shinyChance, defaultConfig.adminPassword,
        defaultConfig.theme, defaultConfig.sfxVolume, defaultConfig.showLiveFeed, defaultConfig.liveFeedTitle, defaultConfig.showSpawnAlert, defaultConfig.spawnAlertTitle, defaultConfig.spawnCatchGuide, defaultConfig.showBattleArena, defaultConfig.primaryColor, defaultConfig.customCss,
        defaultConfig.spawnCardScale, defaultConfig.spawnCardPosition, defaultConfig.showCardSprite, defaultConfig.showCardTypes, defaultConfig.showCardInstructions,
        defaultConfig.twitchChannel, defaultConfig.obsWebsocketUrl, defaultConfig.spawnTarget, defaultConfig.youtubeApiKey
      ]
    );
    
    return defaultConfig;
  }
  
  const row = res.rows[0];
  return {
    channelId: row.channel_id,
    youtubeChannelId: row.youtube_channel_id || '',
    videoId: row.video_id || '',
    spawnIntervalMs: row.spawn_interval_ms,
    wildDespawnTimeoutMs: row.wild_despawn_timeout_ms,
    catchCooldownMs: row.catch_cooldown_ms,
    shinyChance: Number(row.shiny_chance),
    adminPassword: row.admin_password || '',
    theme: row.theme || 'modern',
    sfxVolume: row.sfx_volume !== undefined && row.sfx_volume !== null ? row.sfx_volume : 50,
    showLiveFeed: row.show_live_feed !== false,
    liveFeedTitle: row.live_feed_title || 'LIVE GAME FEED',
    showSpawnAlert: row.show_spawn_alert !== false,
    spawnAlertTitle: row.spawn_alert_title || 'WILD SPAWN',
    spawnCatchGuide: row.spawn_catch_guide || 'Type catch in chat!',
    showBattleArena: row.show_battle_arena !== false,
    primaryColor: row.primary_color || '#3b82f6',
    customCss: row.custom_css || '',
    spawnCardScale: row.spawn_card_scale !== null && row.spawn_card_scale !== undefined ? Number(row.spawn_card_scale) : 1.0,
    spawnCardPosition: row.spawn_card_position || 'bottom-left',
    showCardSprite: row.show_card_sprite !== false,
    showCardTypes: row.show_card_types !== false,
    showCardInstructions: row.show_card_instructions !== false,
    twitchChannel: row.twitch_channel || '',
    obsWebsocketUrl: row.obs_websocket_url || '',
    spawnTarget: row.spawn_target || '',
    youtubeApiKey: row.youtube_api_key || ''
  };
}

/**
 * Saves a streamer's configuration details.
 */
async function saveStreamerConfig(streamerId, config) {
  const streamer = streamerId.toLowerCase().trim();
  
  if (useLocalFallback) {
    localConfigs[streamer] = JSON.parse(JSON.stringify(config));
    saveLocalConfigs();
    return;
  }
  
  // PostgreSQL version
  await query(
    `UPDATE streamer_configs 
     SET video_id = $1, spawn_interval_ms = $2, wild_despawn_timeout_ms = $3, 
         catch_cooldown_ms = $4, shiny_chance = $5, admin_password = $6, youtube_channel_id = $7,
         theme = $8, sfx_volume = $9, show_live_feed = $10, live_feed_title = $11,
         show_spawn_alert = $12, spawn_alert_title = $13, spawn_catch_guide = $14,
         show_battle_arena = $15, primary_color = $16, custom_css = $17,
         spawn_card_scale = $18, spawn_card_position = $19, show_card_sprite = $20,
         show_card_types = $21, show_card_instructions = $22,
         twitch_channel = $23, obs_websocket_url = $24, spawn_target = $25,
         youtube_api_key = $26
     WHERE channel_id = $27`,
    [
      config.videoId || '',
      config.spawnIntervalMs,
      config.wildDespawnTimeoutMs,
      config.catchCooldownMs,
      config.shinyChance,
      config.adminPassword || '',
      config.youtubeChannelId || '',
      config.theme || 'modern',
      config.sfxVolume !== undefined ? config.sfxVolume : 50,
      config.showLiveFeed !== false,
      config.liveFeedTitle || 'LIVE GAME FEED',
      config.showSpawnAlert !== false,
      config.spawnAlertTitle || 'WILD SPAWN',
      config.spawnCatchGuide || 'Type catch in chat!',
      config.showBattleArena !== false,
      config.primaryColor || '#3b82f6',
      config.customCss || '',
      config.spawnCardScale !== undefined ? config.spawnCardScale : 1.0,
      config.spawnCardPosition || 'bottom-left',
      config.showCardSprite !== false,
      config.showCardTypes !== false,
      config.showCardInstructions !== false,
      config.twitchChannel || '',
      config.obsWebsocketUrl || '',
      config.spawnTarget || '',
      config.youtubeApiKey || '',
      streamer
    ]
  );
}

/**
 * Resets a streamer's database records.
 */
async function resetDatabase(streamerId) {
  const streamer = streamerId.toLowerCase().trim();
  
  if (useLocalFallback) {
    Object.keys(localUsers).forEach(k => {
      if (k.startsWith(`${streamer}_`)) {
        delete localUsers[k];
      }
    });
    saveLocalUsers();
    return;
  }
  
  // PostgreSQL version
  await query('DELETE FROM players WHERE streamer_id = $1', [streamer]);
}

/**
 * Retrieves all players registered under a streamer.
 */
async function getAllPlayers(streamerId) {
  const streamer = streamerId.toLowerCase().trim();
  if (useLocalFallback) {
    return Object.keys(localUsers)
      .filter(k => k.startsWith(`${streamer}_`))
      .map(k => migrateLocalUser(JSON.parse(JSON.stringify(localUsers[k]))));
  }
  
  const res = await query('SELECT * FROM players WHERE streamer_id = $1 ORDER BY username ASC', [streamer]);
  const list = [];
  for (const row of res.rows) {
    // Load inventory to count inventory items or details if needed
    const invRes = await query(
      'SELECT * FROM inventories WHERE streamer_id = $1 AND username = $2',
      [streamer, row.username]
    );
    
    list.push({
      username: row.username,
      displayName: row.display_name,
      level: row.level || 1,
      xp: row.xp || 0,
      coins: row.coins !== undefined && row.coins !== null ? row.coins : 100,
      balls: {
        pokeball: row.pokeballs,
        greatball: row.greatballs,
        ultraball: row.ultraballs,
        masterball: row.masterballs || 0
      },
      activePokemonId: row.active_pokemon_id,
      buddyInstanceId: row.buddy_instance_id,
      inventoryCount: invRes.rows.length,
      lastCatchAttempt: Number(row.last_catch_attempt),
      lastDaily: Number(row.last_daily)
    });
  }
  return list;
}

module.exports = {
  getUser,
  saveUser,
  addPokemon,
  selectActivePokemon,
  addWin,
  claimDaily,
  getLeaderboard,
  getStreamerConfig,
  saveStreamerConfig,
  resetDatabase,
  getAllPlayers
};
