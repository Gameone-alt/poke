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
const staticPokemonDbPath = path.join(DB_DIR, 'pokemon.json');
let staticPokemonDb = {};
if (fs.existsSync(staticPokemonDbPath)) {
  try {
    staticPokemonDb = JSON.parse(fs.readFileSync(staticPokemonDbPath, 'utf-8'));
  } catch (err) {
    console.error('[Database] Failed loading pokemon.json:', err.message);
  }
}

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
  if (!u.items) u.items = {};
  if (u.items.fire_stone === undefined) u.items.fire_stone = 0;
  if (u.items.water_stone === undefined) u.items.water_stone = 0;
  if (u.items.thunder_stone === undefined) u.items.thunder_stone = 0;
  if (u.items.leaf_stone === undefined) u.items.leaf_stone = 0;
  if (u.items.moon_stone === undefined) u.items.moon_stone = 0;
  if (!u.gymBadges) u.gymBadges = [];
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
  if (c.spawnCardLeft === undefined) c.spawnCardLeft = '';
  if (c.spawnCardRight === undefined) c.spawnCardRight = '';
  if (c.spawnCardTop === undefined) c.spawnCardTop = '';
  if (c.spawnCardBottom === undefined) c.spawnCardBottom = '';
  if (c.tickerPosition === undefined) c.tickerPosition = 'top-left';
  if (c.tickerLeft === undefined) c.tickerLeft = '';
  if (c.tickerRight === undefined) c.tickerRight = '';
  if (c.tickerTop === undefined) c.tickerTop = '';
  if (c.tickerBottom === undefined) c.tickerBottom = '';
  if (c.feedPosition === undefined) c.feedPosition = 'top-right';
  if (c.feedLeft === undefined) c.feedLeft = '';
  if (c.feedRight === undefined) c.feedRight = '';
  if (c.feedTop === undefined) c.feedTop = '';
  if (c.feedBottom === undefined) c.feedBottom = '';
  if (c.battlePosition === undefined) c.battlePosition = 'center';
  if (c.battleLeft === undefined) c.battleLeft = '';
  if (c.battleRight === undefined) c.battleRight = '';
  if (c.battleTop === undefined) c.battleTop = '';
  if (c.battleBottom === undefined) c.battleBottom = '';
  if (c.showLeaderboard === undefined) c.showLeaderboard = true;
  if (c.coinsCaptureNormal === undefined) c.coinsCaptureNormal = 20;
  if (c.coinsCaptureShiny === undefined) c.coinsCaptureShiny = 100;
  if (c.xpCaptureNormal === undefined) c.xpCaptureNormal = 15;
  if (c.xpCaptureShiny === undefined) c.xpCaptureShiny = 50;
  if (c.levelUpCoins === undefined) c.levelUpCoins = 100;
  if (c.levelUpGreatballs === undefined) c.levelUpGreatballs = 3;
  if (c.levelUpUltraballs === undefined) c.levelUpUltraballs = 1;
  if (c.catchMultiplierPokeball === undefined) c.catchMultiplierPokeball = 1.0;
  if (c.catchMultiplierGreatball === undefined) c.catchMultiplierGreatball = 1.5;
  if (c.catchMultiplierUltraball === undefined) c.catchMultiplierUltraball = 2.0;
  if (c.pricePokeball === undefined) c.pricePokeball = 10;
  if (c.priceGreatball === undefined) c.priceGreatball = 30;
  if (c.priceUltraball === undefined) c.priceUltraball = 80;
  if (c.priceMasterball === undefined) c.priceMasterball = 250;
  if (c.catchMultiplierNormal === undefined) c.catchMultiplierNormal = 1.0;
  if (c.catchMultiplierRare === undefined) c.catchMultiplierRare = 1.0;
  if (c.catchMultiplierLegendary === undefined) c.catchMultiplierLegendary = 1.0;
  if (c.pricePackKanto === undefined) c.pricePackKanto = 150;
  if (c.pricePackJohto === undefined) c.pricePackJohto = 150;
  if (c.pricePackHoenn === undefined) c.pricePackHoenn = 150;
  if (c.pricePackSinnoh === undefined) c.pricePackSinnoh = 150;
  if (c.pricePackUnova === undefined) c.pricePackUnova = 150;
  if (c.pricePackKalos === undefined) c.pricePackKalos = 150;
  if (c.pricePackAlola === undefined) c.pricePackAlola = 150;
  if (c.pricePackLegendary === undefined) c.pricePackLegendary = 500;
  if (c.priceFireStone === undefined) c.priceFireStone = 150;
  if (c.priceWaterStone === undefined) c.priceWaterStone = 150;
  if (c.priceThunderStone === undefined) c.priceThunderStone = 150;
  if (c.priceLeafStone === undefined) c.priceLeafStone = 150;
  if (c.priceMoonStone === undefined) c.priceMoonStone = 150;
  if (c.raidChance === undefined) c.raidChance = 0.05;
  if (c.raidBossHp === undefined) c.raidBossHp = 5000;
  if (c.raidRewardCoins === undefined) c.raidRewardCoins = 250;
  if (c.raidRewardXp === undefined) c.raidRewardXp = 150;
  if (c.raidDropStoneChance === undefined) c.raidDropStoneChance = 0.15;
  if (c.inventoryBaseUrl === undefined) c.inventoryBaseUrl = '';
  if (c.battleScale === undefined) c.battleScale = 1.0;
  if (c.tickerScale === undefined) c.tickerScale = 1.0;
  if (c.feedScale === undefined) c.feedScale = 1.0;
  if (c.battleAcceptTimeoutSeconds === undefined) c.battleAcceptTimeoutSeconds = 30;
  if (c.streamDelaySeconds === undefined) c.streamDelaySeconds = 0;
  if (c.hideSpawnDetails === undefined) c.hideSpawnDetails = false;
  if (c.raidScale === undefined) c.raidScale = 1.0;
  if (c.raidPosition === undefined) c.raidPosition = 'center';
  if (c.raidLeft === undefined) c.raidLeft = '';
  if (c.raidRight === undefined) c.raidRight = '';
  if (c.raidTop === undefined) c.raidTop = '';
  if (c.raidBottom === undefined) c.raidBottom = '';
  if (c.battleType === undefined) c.battleType = 'normal';
  if (c.fullHealTimeMinutes === undefined) c.fullHealTimeMinutes = 60;
  if (c.healCostCoins === undefined) c.healCostCoins = 50;
  if (c.showPackOpening === undefined) c.showPackOpening = true;
  if (c.packPosition === undefined) c.packPosition = 'center';
  if (c.packLeft === undefined) c.packLeft = '';
  if (c.packRight === undefined) c.packRight = '';
  if (c.packTop === undefined) c.packTop = '';
  if (c.packBottom === undefined) c.packBottom = '';
  if (c.packScale === undefined) c.packScale = 1.0;
  if (c.showLevelUp === undefined) c.showLevelUp = true;
  if (c.levelUpPosition === undefined) c.levelUpPosition = 'center';
  if (c.levelUpLeft === undefined) c.levelUpLeft = '';
  if (c.levelUpRight === undefined) c.levelUpRight = '';
  if (c.levelUpTop === undefined) c.levelUpTop = '';
  if (c.levelUpBottom === undefined) c.levelUpBottom = '';
  if (c.levelUpScale === undefined) c.levelUpScale = 1.0;
  if (c.showRaid === undefined) c.showRaid = true;
  if (c.showBuddyOnChat === undefined) c.showBuddyOnChat = true;
  if (c.buddyChatDuration === undefined) c.buddyChatDuration = 15;
  if (c.loyaltyRewardInterval === undefined) c.loyaltyRewardInterval = 15;
  if (c.loyaltyRewardCoins === undefined) c.loyaltyRewardCoins = 50;
  if (c.loyaltyRewardPokeballs === undefined) c.loyaltyRewardPokeballs = 5;
  if (c.loyaltyRewardGreatballs === undefined) c.loyaltyRewardGreatballs = 0;
  if (c.loyaltyRewardUltraballs === undefined) c.loyaltyRewardUltraballs = 0;
  if (c.loyaltyRewardMasterballs === undefined) c.loyaltyRewardMasterballs = 0;
  if (c.buddyRoamerScale === undefined) c.buddyRoamerScale = 1.0;
  if (c.tradeTimeoutSeconds === undefined) c.tradeTimeoutSeconds = 60;
  if (c.dailyBattleLimit === undefined) c.dailyBattleLimit = 5;
  return c;
}

/**
 * Automatically applies SQL migrations to Postgres tables on start
 */
async function runAutoMigrations() {
  if (useLocalFallback || !pool) return;
  console.log('[Database] Checking schema auto-migrations...');
  let client;
  try {
    client = await pool.connect();
    
    // Add columns to players table
    await client.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 100,
      ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS masterballs INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS buddy_instance_id VARCHAR(50) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS gym_badges JSONB DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS loyalty_active_minutes INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS daily_battle_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_battle_date VARCHAR(10) DEFAULT '';
    `);

    // Add columns to streamer_configs table
    await client.query(`
      ALTER TABLE streamer_configs 
      ADD COLUMN IF NOT EXISTS twitch_channel VARCHAR(50) DEFAULT '',
      ADD COLUMN IF NOT EXISTS obs_websocket_url VARCHAR(200) DEFAULT '',
      ADD COLUMN IF NOT EXISTS spawn_target VARCHAR(50) DEFAULT '',
      ADD COLUMN IF NOT EXISTS youtube_api_key VARCHAR(200) DEFAULT '',
      ADD COLUMN IF NOT EXISTS spawn_card_left VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS spawn_card_right VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS spawn_card_top VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS spawn_card_bottom VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS ticker_position VARCHAR(20) DEFAULT 'top-left',
      ADD COLUMN IF NOT EXISTS ticker_left VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS ticker_right VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS ticker_top VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS ticker_bottom VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS feed_position VARCHAR(20) DEFAULT 'top-right',
      ADD COLUMN IF NOT EXISTS feed_left VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS feed_right VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS feed_top VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS feed_bottom VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS battle_position VARCHAR(20) DEFAULT 'center',
      ADD COLUMN IF NOT EXISTS battle_left VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS battle_right VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS battle_top VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS battle_bottom VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS show_leaderboard BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS coins_capture_normal INTEGER DEFAULT 20,
      ADD COLUMN IF NOT EXISTS coins_capture_shiny INTEGER DEFAULT 100,
      ADD COLUMN IF NOT EXISTS xp_capture_normal INTEGER DEFAULT 15,
      ADD COLUMN IF NOT EXISTS xp_capture_shiny INTEGER DEFAULT 50,
      ADD COLUMN IF NOT EXISTS level_up_coins INTEGER DEFAULT 100,
      ADD COLUMN IF NOT EXISTS level_up_greatballs INTEGER DEFAULT 3,
      ADD COLUMN IF NOT EXISTS level_up_ultraballs INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS catch_multiplier_pokeball NUMERIC DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS catch_multiplier_greatball NUMERIC DEFAULT 1.5,
      ADD COLUMN IF NOT EXISTS catch_multiplier_ultraball NUMERIC DEFAULT 2.0,
      ADD COLUMN IF NOT EXISTS price_pokeball INTEGER DEFAULT 10,
      ADD COLUMN IF NOT EXISTS price_greatball INTEGER DEFAULT 30,
      ADD COLUMN IF NOT EXISTS price_ultraball INTEGER DEFAULT 80,
      ADD COLUMN IF NOT EXISTS price_masterball INTEGER DEFAULT 250,
      ADD COLUMN IF NOT EXISTS catch_multiplier_normal NUMERIC DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS catch_multiplier_rare NUMERIC DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS catch_multiplier_legendary NUMERIC DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS price_pack_kanto INTEGER DEFAULT 150,
      ADD COLUMN IF NOT EXISTS price_pack_johto INTEGER DEFAULT 150,
      ADD COLUMN IF NOT EXISTS price_pack_hoenn INTEGER DEFAULT 150,
      ADD COLUMN IF NOT EXISTS price_pack_sinnoh INTEGER DEFAULT 150,
      ADD COLUMN IF NOT EXISTS price_pack_unova INTEGER DEFAULT 150,
      ADD COLUMN IF NOT EXISTS price_pack_kalos INTEGER DEFAULT 150,
      ADD COLUMN IF NOT EXISTS price_pack_alola INTEGER DEFAULT 150,
      ADD COLUMN IF NOT EXISTS price_pack_legendary INTEGER DEFAULT 500,
      ADD COLUMN IF NOT EXISTS price_fire_stone INTEGER DEFAULT 150,
      ADD COLUMN IF NOT EXISTS price_water_stone INTEGER DEFAULT 150,
      ADD COLUMN IF NOT EXISTS price_thunder_stone INTEGER DEFAULT 150,
      ADD COLUMN IF NOT EXISTS price_leaf_stone INTEGER DEFAULT 150,
      ADD COLUMN IF NOT EXISTS price_moon_stone INTEGER DEFAULT 150,
      ADD COLUMN IF NOT EXISTS raid_chance NUMERIC DEFAULT 0.05,
      ADD COLUMN IF NOT EXISTS raid_boss_hp INTEGER DEFAULT 5000,
      ADD COLUMN IF NOT EXISTS raid_reward_coins INTEGER DEFAULT 250,
      ADD COLUMN IF NOT EXISTS raid_reward_xp INTEGER DEFAULT 150,
      ADD COLUMN IF NOT EXISTS raid_drop_stone_chance NUMERIC DEFAULT 0.15,
      ADD COLUMN IF NOT EXISTS inventory_base_url VARCHAR(200) DEFAULT '',
      ADD COLUMN IF NOT EXISTS sprite_format VARCHAR(20) DEFAULT 'animated',
      ADD COLUMN IF NOT EXISTS spawn_catch_guide_mode VARCHAR(20) DEFAULT 'static',
      ADD COLUMN IF NOT EXISTS allowed_generations JSONB DEFAULT '[1,2,3,4,5,6,7,8]',
      ADD COLUMN IF NOT EXISTS battle_scale NUMERIC DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS ticker_scale NUMERIC DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS feed_scale NUMERIC DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS battle_accept_timeout_seconds INTEGER DEFAULT 30,
      ADD COLUMN IF NOT EXISTS stream_delay_seconds INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS hide_spawn_details BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS raid_scale NUMERIC DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS raid_position VARCHAR(20) DEFAULT 'center',
      ADD COLUMN IF NOT EXISTS raid_left VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS raid_right VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS raid_top VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS raid_bottom VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS battle_type VARCHAR(20) DEFAULT 'normal',
      ADD COLUMN IF NOT EXISTS full_heal_time_minutes INTEGER DEFAULT 60,
      ADD COLUMN IF NOT EXISTS heal_cost_coins INTEGER DEFAULT 50,
      ADD COLUMN IF NOT EXISTS show_pack_opening BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS pack_position VARCHAR(20) DEFAULT 'center',
      ADD COLUMN IF NOT EXISTS pack_left VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS pack_right VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS pack_top VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS pack_bottom VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS pack_scale NUMERIC DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS show_level_up BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS level_up_position VARCHAR(20) DEFAULT 'center',
      ADD COLUMN IF NOT EXISTS level_up_left VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS level_up_right VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS level_up_top VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS level_up_bottom VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS level_up_scale NUMERIC DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS show_raid BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS show_buddy_on_chat BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS buddy_chat_duration INTEGER DEFAULT 15,
      ADD COLUMN IF NOT EXISTS loyalty_reward_interval INTEGER DEFAULT 15,
      ADD COLUMN IF NOT EXISTS loyalty_reward_coins INTEGER DEFAULT 50,
      ADD COLUMN IF NOT EXISTS loyalty_reward_pokeballs INTEGER DEFAULT 5,
      ADD COLUMN IF NOT EXISTS loyalty_reward_greatballs INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS loyalty_reward_ultraballs INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS loyalty_reward_masterballs INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS buddy_roamer_scale NUMERIC DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS trade_timeout_seconds INTEGER DEFAULT 60,
      ADD COLUMN IF NOT EXISTS daily_battle_limit INTEGER DEFAULT 5;
    `);

    // Add columns to inventories table
    await client.query(`
      ALTER TABLE inventories
      ADD COLUMN IF NOT EXISTS fusion_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS current_hp INTEGER DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS last_battle_time BIGINT DEFAULT 0;
    `);

    console.log('[Database] Auto-migrations check completed successfully.');
  } catch (err) {
    console.warn('[Database] Auto-migrations note/warning:', err.message);
  } finally {
    if (client) {
      try { client.release(); } catch(e) {}
    }
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
  if (useLocalFallback) {
    throw new Error('Database is currently running in local fallback mode.');
  }
  if (!pool) {
    throw new Error('Database is not initialized. Check your environment/database credentials.');
  }
  try {
    return await pool.query(text, params);
  } catch (err) {
    // If the database server successfully replied with a standard SQLSTATE error code (exactly 5 characters, e.g. '23505' for unique constraint violation),
    // do NOT fall back to local JSON, because the database server connection is healthy and responsive.
    const isStandardSqlError = err.code && typeof err.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code);
    if (!isStandardSqlError) {
      console.error('[Database] Connection failure detected, falling back to local JSON database:', err.message);
      useLocalFallback = true;
    } else {
      console.error('[Database] Query execution error (integrity constraint/syntax):', err.message);
    }
    throw err;
  }
}

/**
 * Ensures that a player mapping record exists for the specific streamer channel.
 */
async function ensureChannelPlayerExists(streamerId, username, displayName) {
  // No-op: Profile resolution uses global consolidated player records and auto-migration
  return;
}

async function getFullHealTime(streamerId) {
  return 2880; // Hardcoded to exactly 2 days (48 hours = 2880 minutes)
}

async function healPokemon(streamerId, username, targetPokemonName) {
  const streamer = 'global';
  const key = username.toLowerCase().trim();
  const searchName = targetPokemonName.toLowerCase().replace('✨ shiny ', '').trim();
  
  if (useLocalFallback) {
    const compositeKey = `${streamer}_${key}`;
    const user = localUsers[compositeKey];
    if (user && user.inventory) {
      const poke = user.inventory.find(p => p.name.toLowerCase().replace('✨ shiny ', '').trim() === searchName || p.originalName.toLowerCase() === searchName);
      if (poke) {
        poke.currentHp = poke.baseStats.hp;
        poke.lastBattleTime = 0;
        saveLocalUsers();
        return poke;
      }
    }
    throw new Error(`Could not find Pokémon '${targetPokemonName}' in inventory.`);
  }
  
  // PostgreSQL version
  const user = await getUser(streamerId, username);
  const poke = user.inventory.find(p => p.name.toLowerCase().replace('✨ shiny ', '').trim() === searchName || p.originalName.toLowerCase() === searchName);
  if (!poke) {
    throw new Error(`Could not find Pokémon '${targetPokemonName}' in inventory.`);
  }
  
  await query(
    'UPDATE inventories SET current_hp = base_hp, last_battle_time = 0 WHERE streamer_id = $1 AND username = $2 AND instance_id = $3',
    ['global', key, poke.instanceId]
  );
  
  poke.currentHp = poke.baseStats.hp;
  poke.lastBattleTime = 0;
  return poke;
}

/**
 * Gets a user by username or initializes a new one.
 */
async function getUser(streamerId, username, displayName = null) {
  const key = username.toLowerCase().trim();
  const cleanStreamerId = streamerId.toLowerCase().trim();
  
  if (cleanStreamerId !== 'global') {
    await ensureChannelPlayerExists(cleanStreamerId, key, displayName || username);
  }
  
  const streamer = 'global';
  const compositeKey = `${streamer}_${key}`;
  
  if (useLocalFallback) {
    if (!localUsers[compositeKey]) {
      // Migrate from existing channel profile if found
      const existingKey = Object.keys(localUsers).find(k => k.endsWith(`_${key}`) && !k.startsWith('global_'));
      if (existingKey) {
        localUsers[compositeKey] = JSON.parse(JSON.stringify(localUsers[existingKey]));
        localUsers[compositeKey].username = key;
        if (displayName) localUsers[compositeKey].displayName = displayName;
        
        // Reset the old channel record to be a simple placeholder
        localUsers[existingKey] = {
          username: key,
          displayName: localUsers[existingKey].displayName || displayName || username,
          balls: { pokeball: 10, greatball: 3, ultraball: 1, masterball: 0 },
          coins: 100,
          xp: 0,
          level: 1,
          buddyInstanceId: null,
          items: { fire_stone: 0, water_stone: 0, thunder_stone: 0, leaf_stone: 0, moon_stone: 0 },
          gymBadges: [],
          inventory: [],
          activePokemonId: null,
          lastCatchAttempt: 0,
          lastDaily: 0
        };
      } else {
        localUsers[compositeKey] = {
          username: key,
          displayName: displayName || username,
          balls: { pokeball: 10, greatball: 3, ultraball: 1, masterball: 0 },
          coins: 100,
          xp: 0,
          level: 1,
          buddyInstanceId: null,
          items: { fire_stone: 0, water_stone: 0, thunder_stone: 0, leaf_stone: 0, moon_stone: 0 },
          gymBadges: [],
          inventory: [],
          activePokemonId: null,
          lastCatchAttempt: 0,
          lastDaily: 0,
          loyaltyActiveMinutes: 0,
          dailyBattleCount: 0,
          lastBattleDate: ''
        };
      }
      saveLocalUsers();
    } else {
      migrateLocalUser(localUsers[compositeKey]);
      if (displayName && localUsers[compositeKey].displayName !== displayName) {
        localUsers[compositeKey].displayName = displayName;
        saveLocalUsers();
      }
    }
    
    // Compute dynamic auto-heal on load
    const userCopy = JSON.parse(JSON.stringify(localUsers[compositeKey]));
    const healMinutes = await getFullHealTime(cleanStreamerId);
    let updatedLocal = false;
    
    userCopy.inventory.forEach(poke => {
      let currentHp = poke.currentHp;
      const baseHp = poke.baseStats.hp;
      const lastBattleTime = Number(poke.lastBattleTime || 0);
      
      if (currentHp === undefined || currentHp === null) {
        poke.currentHp = baseHp;
        currentHp = baseHp;
      }
      
      if (currentHp < baseHp && lastBattleTime > 0) {
        const elapsedMinutes = (Date.now() - lastBattleTime) / (1000 * 60);
        if (elapsedMinutes >= 2880) { // snap heal after 2 days (2880 mins)
          poke.currentHp = baseHp;
          poke.lastBattleTime = 0;
          
          const dbPoke = localUsers[compositeKey].inventory.find(p => p.instanceId === poke.instanceId);
          if (dbPoke) {
            dbPoke.currentHp = baseHp;
            dbPoke.lastBattleTime = 0;
          }
          updatedLocal = true;
        }
      }
    });
    
    if (updatedLocal) {
      saveLocalUsers();
    }
    
    return userCopy;
  }
  
  // PostgreSQL version
  const cleanKey = key.replace(/^@/, '');
  const keyWithAt = '@' + cleanKey;
  const baseKey = cleanKey.replace(/\d+$/, '');

  // 1. Search for ANY existing player record by username or display_name
  let res = await query(
    `SELECT * FROM players 
     WHERE LOWER(username) = $1 OR LOWER(username) = $2 OR LOWER(username) = $3
        OR LOWER(display_name) = $1 OR LOWER(display_name) = $2 OR LOWER(display_name) = $3
     ORDER BY level DESC, xp DESC, coins DESC`,
    [cleanKey, keyWithAt, baseKey]
  );

  let dbUser;
  if (res.rows.length > 0) {
    // Pick the best existing player record (highest level/XP/coins)
    dbUser = res.rows[0];
    
    // Ensure this best player record is saved under streamer_id = 'global'
    if (dbUser.streamer_id !== 'global') {
      await query(
        "UPDATE players SET streamer_id = 'global' WHERE streamer_id = $1 AND username = $2",
        [dbUser.streamer_id, dbUser.username]
      );
    }
  } else {
    // Create new global player record
    const defaultBalls = { pokeball: 10, greatball: 3, ultraball: 1, masterball: 0 };
    await query(
      `INSERT INTO players (streamer_id, username, display_name, pokeballs, greatballs, ultraballs, masterballs, coins, xp, level, last_daily, last_catch_attempt, active_pokemon_id, buddy_instance_id)
       VALUES ('global', $1, $2, $3, $4, $5, $6, 100, 0, 1, 0, 0, NULL, NULL)`,
      [cleanKey, displayName || username, defaultBalls.pokeball, defaultBalls.greatball, defaultBalls.ultraball, defaultBalls.masterball]
    );
    res = await query(
      "SELECT * FROM players WHERE streamer_id = 'global' AND LOWER(username) = LOWER($1)",
      [cleanKey]
    );
    dbUser = res.rows[0];
  }

  // Update display_name if a new non-null displayName was provided
  if (displayName && dbUser.display_name !== displayName) {
    await query(
      "UPDATE players SET display_name = $1 WHERE streamer_id = 'global' AND LOWER(username) = LOWER($2)",
      [displayName, dbUser.username]
    );
    dbUser.display_name = displayName;
  }

  // 2. Gather ALL handles & nicknames associated with this player
  const knownUsernamesRes = await query(
    `SELECT username, display_name FROM players 
     WHERE LOWER(username) = $1 OR LOWER(username) = $2 OR LOWER(username) = $3
        OR LOWER(display_name) = $1 OR LOWER(display_name) = $2 OR LOWER(display_name) = $3`,
    [cleanKey, keyWithAt, baseKey]
  );
  
  const userKeysSet = new Set([cleanKey, keyWithAt, baseKey, dbUser.username.toLowerCase()]);
  if (knownUsernamesRes && knownUsernamesRes.rows) {
    for (const r of knownUsernamesRes.rows) {
      if (r.username) userKeysSet.add(r.username.toLowerCase());
      if (r.display_name) userKeysSet.add(r.display_name.toLowerCase());
    }
  }
  const userKeys = Array.from(userKeysSet);

  // Sweep ALL inventories belonging to any of these handles into 'global' under dbUser.username
  await query(
    `UPDATE inventories 
     SET streamer_id = 'global', username = $1 
     WHERE LOWER(username) = ANY($2)`,
    [dbUser.username, userKeys]
  );
  
  const invRes = await query(
    `SELECT * FROM inventories 
     WHERE (LOWER(streamer_id) = 'global' OR streamer_id = $1)
       AND (LOWER(username) = ANY($2) OR LOWER(username) = LOWER($3)) 
     ORDER BY caught_at ASC`,
    [streamer, userKeys, dbUser.username]
  );
  
  const healMinutes = await getFullHealTime(cleanStreamerId);
  const inventory = [];
  
  for (const p of invRes.rows) {
    const staticPoke = staticPokemonDb[p.pokemon_id.toString()] || {};
    const baseName = staticPoke.name || p.pokemon_name || 'Unknown';
    const name = p.shiny ? `✨ Shiny ${baseName}` : baseName;
    const types = staticPoke.types || p.types || [];
    const baseStats = staticPoke.stats || {
      hp: p.base_hp || 50,
      attack: p.base_atk || 50,
      defense: p.base_def || 50,
      speed: p.base_spd || 50
    };
    
    const baseHp = p.base_hp || baseStats.hp || 50;
    let currentHp = p.current_hp;
    const lastBattleTime = Number(p.last_battle_time || 0);
    
    if (currentHp === null || currentHp === undefined) {
      currentHp = baseHp;
    }
    
    if (currentHp < baseHp && lastBattleTime > 0) {
      const elapsedMinutes = (Date.now() - lastBattleTime) / (1000 * 60);
      if (elapsedMinutes >= 2880) { // snap heal after 2 days (2880 mins)
        currentHp = baseHp;
        await query(
          'UPDATE inventories SET current_hp = $1, last_battle_time = $2 WHERE streamer_id = $3 AND username = $4 AND instance_id = $5',
          [currentHp, 0, 'global', key, p.instance_id]
        );
      }
    }
    
    inventory.push({
      instanceId: p.instance_id,
      pokemonId: p.pokemon_id,
      name: name,
      originalName: baseName,
      types: types,
      baseStats: {
        hp: baseStats.hp,
        attack: baseStats.attack,
        defense: baseStats.defense,
        speed: baseStats.speed
      },
      currentHp: currentHp,
      lastBattleTime: lastBattleTime,
      shiny: p.shiny,
      wins: p.wins,
      currentStage: p.current_stage,
      caughtAt: Number(p.caught_at),
      fusionCount: p.fusion_count || 0
    });
  }
  
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
    inventory: inventory,
    activePokemonId: dbUser.active_pokemon_id,
    items: dbUser.items || {},
    gymBadges: dbUser.gym_badges || [],
    lastCatchAttempt: Number(dbUser.last_catch_attempt),
    lastDaily: Number(dbUser.last_daily),
    loyaltyActiveMinutes: dbUser.loyalty_active_minutes !== null && dbUser.loyalty_active_minutes !== undefined ? Number(dbUser.loyalty_active_minutes) : 0,
    dailyBattleCount: dbUser.daily_battle_count !== null && dbUser.daily_battle_count !== undefined ? Number(dbUser.daily_battle_count) : 0,
    lastBattleDate: dbUser.last_battle_date || ''
  };
}

/**
 * Saves user details (balance, cooldowns).
 */
async function saveUser(streamerId, user) {
  const key = user.username.toLowerCase();
  const streamer = 'global';
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
         active_pokemon_id = $10, last_daily = $11, last_catch_attempt = $12,
         items = $13, gym_badges = $14, loyalty_active_minutes = $15, daily_battle_count = $16, last_battle_date = $17
     WHERE streamer_id = $18 AND username = $19`,
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
      JSON.stringify(user.items || {}),
      JSON.stringify(user.gymBadges || []),
      user.loyaltyActiveMinutes || 0,
      user.dailyBattleCount || 0,
      user.lastBattleDate || '',
      streamer, 
      key
    ]
  );
}

/**
 * Adds a Pokémon instance to the player's inventory.
 */
async function addPokemon(streamerId, username, displayName, pokemonData, isShiny = false) {
  const streamer = 'global';
  const key = username.toLowerCase().trim();
  
  // Use pre-rolled IVs from spawn time if available, otherwise roll fresh (for gacha packs)
  const preIVs = pokemonData.spawnIVs || null;
  
  if (useLocalFallback) {
    const user = await getUser(streamerId, username, displayName);
    const instanceId = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const name = isShiny ? `✨ Shiny ${pokemonData.name}` : pokemonData.name;
    const baseHp = pokemonData.stats ? pokemonData.stats.hp : pokemonData.baseStats.hp;
    const baseAtk = pokemonData.stats ? pokemonData.stats.attack : pokemonData.baseStats.attack;
    const baseDef = pokemonData.stats ? pokemonData.stats.defense : pokemonData.baseStats.defense;
    const baseSpd = pokemonData.stats ? pokemonData.stats.speed : pokemonData.baseStats.speed;
    const hp = preIVs ? (baseHp + preIVs.hp) : (baseHp + Math.floor(Math.random() * 16));
    const attack = preIVs ? (baseAtk + preIVs.attack) : (baseAtk + Math.floor(Math.random() * 16));
    const defense = preIVs ? (baseDef + preIVs.defense) : (baseDef + Math.floor(Math.random() * 16));
    const speed = preIVs ? (baseSpd + preIVs.speed) : (baseSpd + Math.floor(Math.random() * 16));
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
      caughtAt: Date.now(),
      catchRate: pokemonData.catchRate,
      fusionCount: 0
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
  
  const baseHp = pokemonData.stats ? pokemonData.stats.hp : pokemonData.baseStats.hp;
  const baseAtk = pokemonData.stats ? pokemonData.stats.attack : pokemonData.baseStats.attack;
  const baseDef = pokemonData.stats ? pokemonData.stats.defense : pokemonData.baseStats.defense;
  const baseSpd = pokemonData.stats ? pokemonData.stats.speed : pokemonData.baseStats.speed;
  const hp = preIVs ? (baseHp + preIVs.hp) : (baseHp + Math.floor(Math.random() * 16));
  const attack = preIVs ? (baseAtk + preIVs.attack) : (baseAtk + Math.floor(Math.random() * 16));
  const defense = preIVs ? (baseDef + preIVs.defense) : (baseDef + Math.floor(Math.random() * 16));
  const speed = preIVs ? (baseSpd + preIVs.speed) : (baseSpd + Math.floor(Math.random() * 16));
  const types = pokemonData.types;
  
  await query(
    `INSERT INTO inventories (instance_id, streamer_id, username, pokemon_id, pokemon_name, types, base_hp, base_atk, base_def, base_spd, shiny, wins, current_stage, caught_at)
     VALUES ($1, $2, $3, $4, '', null, $5, $6, $7, $8, $9, 0, 1, $10)`,
    [instanceId, streamer, key, pokemonData.id, hp, attack, defense, speed, isShiny, BigInt(Date.now())]
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
    caughtAt: Date.now(),
    fusionCount: 0
  };
}

/**
 * Selects active Pokémon for fights.
 */
async function selectActivePokemon(streamerId, username, pokemonNameOrId) {
  const streamer = 'global';
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
  const streamer = 'global';
  
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
    const list = [];
    for (const k of Object.keys(localUsers)) {
      if (k.startsWith(`${streamer}_`)) {
        const channelUser = localUsers[k];
        const u = await getUser('global', channelUser.username);
        const totalWins = u.inventory.reduce((sum, p) => sum + (p.wins || 0), 0);
        list.push({
          displayName: u.displayName,
          username: u.username,
          totalPokemon: u.inventory.length,
          totalWins: totalWins,
          activePokemon: u.inventory.find(p => p.instanceId === u.activePokemonId)
        });
      }
    }
    return list.sort((a, b) => b.totalPokemon - a.totalPokemon || b.totalWins - a.totalWins).slice(0, 10);
  }
  
  // PostgreSQL version
  const playersRes = await query(
    'SELECT username FROM players WHERE streamer_id = $1',
    [streamer]
  );
  
  const list = [];
  for (const row of playersRes.rows) {
    const u = await getUser('global', row.username);
    const totalWins = u.inventory.reduce((sum, p) => sum + (p.wins || 0), 0);
    list.push({
      username: row.username,
      displayName: u.displayName,
      totalPokemon: u.inventory.length,
      totalWins: totalWins,
      activePokemon: u.inventory.find(p => p.instanceId === u.activePokemonId)
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
        spawnCatchGuide: 'Type !catch in chat!',
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
        youtubeApiKey: '',
        inventoryBaseUrl: '',
        spriteFormat: 'animated',
        spawnCatchGuideMode: 'static',
        allowedGenerations: [1,2,3,4,5,6,7,8],
        battleScale: 1.0,
        tickerScale: 1.0,
        feedScale: 1.0,
        battleAcceptTimeoutSeconds: 30,
        streamDelaySeconds: 0,
        hideSpawnDetails: false,
        battleType: 'normal',
        fullHealTimeMinutes: 60,
        healCostCoins: 50,
        showBuddyOnChat: true,
        buddyChatDuration: 15,
        loyaltyRewardInterval: 15,
        loyaltyRewardCoins: 50,
        loyaltyRewardPokeballs: 5,
        loyaltyRewardGreatballs: 0,
        loyaltyRewardUltraballs: 0,
        loyaltyRewardMasterballs: 0,
        buddyRoamerScale: 1.0,
        tradeTimeoutSeconds: 60,
        dailyBattleLimit: 5
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
      spawnCatchGuide: 'Type !catch in chat!',
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
      youtubeApiKey: '',
      inventoryBaseUrl: '',
      spawnCardLeft: '',
      spawnCardRight: '',
      spawnCardTop: '',
      spawnCardBottom: '',
      tickerPosition: 'top-left',
      tickerLeft: '',
      tickerRight: '',
      tickerTop: '',
      tickerBottom: '',
      feedPosition: 'top-right',
      feedLeft: '',
      feedRight: '',
      feedTop: '',
      feedBottom: '',
      battlePosition: 'center',
      battleLeft: '',
      battleRight: '',
      battleTop: '',
      battleBottom: '',
      showLeaderboard: true,
      coinsCaptureNormal: 20,
      coinsCaptureShiny: 100,
      xpCaptureNormal: 15,
      xpCaptureShiny: 50,
      levelUpCoins: 100,
      levelUpGreatballs: 3,
      levelUpUltraballs: 1,
      catchMultiplierPokeball: 1.0,
      catchMultiplierGreatball: 1.5,
      catchMultiplierUltraball: 2.0,
      pricePokeball: 10,
      priceGreatball: 30,
      priceUltraball: 80,
      priceMasterball: 250,
      catchMultiplierNormal: 1.0,
      catchMultiplierRare: 1.0,
      catchMultiplierLegendary: 1.0,
      pricePackKanto: 150,
      pricePackJohto: 150,
      pricePackHoenn: 150,
      pricePackSinnoh: 150,
      pricePackUnova: 150,
      pricePackKalos: 150,
      pricePackAlola: 150,
      pricePackLegendary: 500,
      priceFireStone: 150,
      priceWaterStone: 150,
      priceThunderStone: 150,
      priceLeafStone: 150,
      priceMoonStone: 150,
      raidChance: 0.05,
      raidBossHp: 5000,
      raidRewardCoins: 250,
      raidRewardXp: 150,
      raidDropStoneChance: 0.15,
      inventoryBaseUrl: '',
      spriteFormat: 'animated',
      spawnCatchGuideMode: 'static',
      allowedGenerations: [1,2,3,4,5,6,7,8],
      battleScale: 1.0,
      tickerScale: 1.0,
      feedScale: 1.0,
      battleAcceptTimeoutSeconds: 30,
      streamDelaySeconds: 0,
      hideSpawnDetails: false,
      raidScale: 1.0,
      raidPosition: 'center',
      raidLeft: '',
      raidRight: '',
      raidTop: '',
      raidBottom: '',
      battleType: 'normal'
    };
    
    await query(
      `INSERT INTO streamer_configs (channel_id, youtube_channel_id, video_id, spawn_interval_ms, wild_despawn_timeout_ms, catch_cooldown_ms, shiny_chance, admin_password, theme, sfx_volume, show_live_feed, live_feed_title, show_spawn_alert, spawn_alert_title, spawn_catch_guide, show_battle_arena, primary_color, custom_css, spawn_card_scale, spawn_card_position, show_card_sprite, show_card_types, show_card_instructions, twitch_channel, obs_websocket_url, spawn_target, youtube_api_key, spawn_card_left, spawn_card_right, spawn_card_top, spawn_card_bottom, ticker_position, ticker_left, ticker_right, ticker_top, ticker_bottom, feed_position, feed_left, feed_right, feed_top, feed_bottom, battle_position, battle_left, battle_right, battle_top, battle_bottom, show_leaderboard, coins_capture_normal, coins_capture_shiny, xp_capture_normal, xp_capture_shiny, level_up_coins, level_up_greatballs, level_up_ultraballs, catch_multiplier_pokeball, catch_multiplier_greatball, catch_multiplier_ultraball, price_pokeball, price_greatball, price_ultraball, price_masterball, catch_multiplier_normal, catch_multiplier_rare, catch_multiplier_legendary, price_pack_kanto, price_pack_johto, price_pack_hoenn, price_pack_sinnoh, price_pack_unova, price_pack_kalos, price_pack_alola, price_pack_legendary, price_fire_stone, price_water_stone, price_thunder_stone, price_leaf_stone, price_moon_stone, raid_chance, raid_boss_hp, raid_reward_coins, raid_reward_xp, raid_drop_stone_chance, inventory_base_url, sprite_format, spawn_catch_guide_mode, battle_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62, $63, $64, $65, $66, $67, $68, $69, $70, $71, $72, $73, $74, $75, $76, $77, $78, $79, $80, $81, $82, $83, $84, $85, $86)`,
      [
        defaultConfig.channelId, defaultConfig.youtubeChannelId, defaultConfig.videoId, defaultConfig.spawnIntervalMs, defaultConfig.wildDespawnTimeoutMs, defaultConfig.catchCooldownMs, defaultConfig.shinyChance, defaultConfig.adminPassword,
        defaultConfig.theme, defaultConfig.sfxVolume, defaultConfig.showLiveFeed, defaultConfig.liveFeedTitle, defaultConfig.showSpawnAlert, defaultConfig.spawnAlertTitle, defaultConfig.spawnCatchGuide, defaultConfig.showBattleArena, defaultConfig.primaryColor, defaultConfig.customCss,
        defaultConfig.spawnCardScale, defaultConfig.spawnCardPosition, defaultConfig.showCardSprite, defaultConfig.showCardTypes, defaultConfig.showCardInstructions,
        defaultConfig.twitchChannel, defaultConfig.obsWebsocketUrl, defaultConfig.spawnTarget, defaultConfig.youtubeApiKey,
        defaultConfig.spawnCardLeft, defaultConfig.spawnCardRight, defaultConfig.spawnCardTop, defaultConfig.spawnCardBottom,
        defaultConfig.tickerPosition, defaultConfig.tickerLeft, defaultConfig.tickerRight, defaultConfig.tickerTop, defaultConfig.tickerBottom,
        defaultConfig.feedPosition, defaultConfig.feedLeft, defaultConfig.feedRight, defaultConfig.feedTop, defaultConfig.feedBottom,
        defaultConfig.battlePosition, defaultConfig.battleLeft, defaultConfig.battleRight, defaultConfig.battleTop, defaultConfig.battleBottom,
        defaultConfig.showLeaderboard, defaultConfig.coinsCaptureNormal, defaultConfig.coinsCaptureShiny, defaultConfig.xpCaptureNormal, defaultConfig.xpCaptureShiny,
        defaultConfig.levelUpCoins, defaultConfig.levelUpGreatballs, defaultConfig.levelUpUltraballs,
        defaultConfig.catchMultiplierPokeball, defaultConfig.catchMultiplierGreatball, defaultConfig.catchMultiplierUltraball,
        defaultConfig.pricePokeball, defaultConfig.priceGreatball, defaultConfig.priceUltraball, defaultConfig.priceMasterball,
        defaultConfig.catchMultiplierNormal, defaultConfig.catchMultiplierRare, defaultConfig.catchMultiplierLegendary,
        defaultConfig.pricePackKanto, defaultConfig.pricePackJohto, defaultConfig.pricePackHoenn, defaultConfig.pricePackSinnoh, defaultConfig.pricePackUnova, defaultConfig.pricePackKalos, defaultConfig.pricePackAlola, defaultConfig.pricePackLegendary,
        defaultConfig.priceFireStone, defaultConfig.priceWaterStone, defaultConfig.priceThunderStone, defaultConfig.priceLeafStone, defaultConfig.priceMoonStone,
        defaultConfig.raidChance, defaultConfig.raidBossHp, defaultConfig.raidRewardCoins, defaultConfig.raidRewardXp, defaultConfig.raidDropStoneChance,
        defaultConfig.inventoryBaseUrl, defaultConfig.spriteFormat, defaultConfig.spawnCatchGuideMode, defaultConfig.battleType
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
    spawnCatchGuide: row.spawn_catch_guide || 'Type !catch in chat!',
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
    youtubeApiKey: row.youtube_api_key || '',
    spawnCardLeft: row.spawn_card_left || '',
    spawnCardRight: row.spawn_card_right || '',
    spawnCardTop: row.spawn_card_top || '',
    spawnCardBottom: row.spawn_card_bottom || '',
    tickerPosition: row.ticker_position || 'top-left',
    tickerLeft: row.ticker_left || '',
    tickerRight: row.ticker_right || '',
    tickerTop: row.ticker_top || '',
    tickerBottom: row.ticker_bottom || '',
    feedPosition: row.feed_position || 'top-right',
    feedLeft: row.feed_left || '',
    feedRight: row.feed_right || '',
    feedTop: row.feed_top || '',
    feedBottom: row.feed_bottom || '',
    battlePosition: row.battle_position || 'center',
    battleLeft: row.battle_left || '',
    battleRight: row.battle_right || '',
    battleTop: row.battle_top || '',
    battleBottom: row.battle_bottom || '',
    showLeaderboard: row.show_leaderboard !== false,
    coinsCaptureNormal: row.coins_capture_normal !== null && row.coins_capture_normal !== undefined ? Number(row.coins_capture_normal) : 20,
    coinsCaptureShiny: row.coins_capture_shiny !== null && row.coins_capture_shiny !== undefined ? Number(row.coins_capture_shiny) : 100,
    xpCaptureNormal: row.xp_capture_normal !== null && row.xp_capture_normal !== undefined ? Number(row.xp_capture_normal) : 15,
    xpCaptureShiny: row.xp_capture_shiny !== null && row.xp_capture_shiny !== undefined ? Number(row.xp_capture_shiny) : 50,
    levelUpCoins: row.level_up_coins !== null && row.level_up_coins !== undefined ? Number(row.level_up_coins) : 100,
    levelUpGreatballs: row.level_up_greatballs !== null && row.level_up_greatballs !== undefined ? Number(row.level_up_greatballs) : 3,
    levelUpUltraballs: row.level_up_ultraballs !== null && row.level_up_ultraballs !== undefined ? Number(row.level_up_ultraballs) : 1,
    catchMultiplierPokeball: row.catch_multiplier_pokeball !== null && row.catch_multiplier_pokeball !== undefined ? Number(row.catch_multiplier_pokeball) : 1.0,
    catchMultiplierGreatball: row.catch_multiplier_greatball !== null && row.catch_multiplier_greatball !== undefined ? Number(row.catch_multiplier_greatball) : 1.5,
    catchMultiplierUltraball: row.catch_multiplier_ultraball !== null && row.catch_multiplier_ultraball !== undefined ? Number(row.catch_multiplier_ultraball) : 2.0,
    pricePokeball: row.price_pokeball !== null && row.price_pokeball !== undefined ? Number(row.price_pokeball) : 10,
    priceGreatball: row.price_greatball !== null && row.price_greatball !== undefined ? Number(row.price_greatball) : 30,
    priceUltraball: row.price_ultraball !== null && row.price_ultraball !== undefined ? Number(row.price_ultraball) : 80,
    priceMasterball: row.price_masterball !== null && row.price_masterball !== undefined ? Number(row.price_masterball) : 250,
    catchMultiplierNormal: row.catch_multiplier_normal !== null && row.catch_multiplier_normal !== undefined ? Number(row.catch_multiplier_normal) : 1.0,
    catchMultiplierRare: row.catch_multiplier_rare !== null && row.catch_multiplier_rare !== undefined ? Number(row.catch_multiplier_rare) : 1.0,
    catchMultiplierLegendary: row.catch_multiplier_legendary !== null && row.catch_multiplier_legendary !== undefined ? Number(row.catch_multiplier_legendary) : 1.0,
    pricePackKanto: row.price_pack_kanto !== null && row.price_pack_kanto !== undefined ? Number(row.price_pack_kanto) : 150,
    pricePackJohto: row.price_pack_johto !== null && row.price_pack_johto !== undefined ? Number(row.price_pack_johto) : 150,
    pricePackHoenn: row.price_pack_hoenn !== null && row.price_pack_hoenn !== undefined ? Number(row.price_pack_hoenn) : 150,
    pricePackSinnoh: row.price_pack_sinnoh !== null && row.price_pack_sinnoh !== undefined ? Number(row.price_pack_sinnoh) : 150,
    pricePackUnova: row.price_pack_unova !== null && row.price_pack_unova !== undefined ? Number(row.price_pack_unova) : 150,
    pricePackKalos: row.price_pack_kalos !== null && row.price_pack_kalos !== undefined ? Number(row.price_pack_kalos) : 150,
    pricePackAlola: row.price_pack_alola !== null && row.price_pack_alola !== undefined ? Number(row.price_pack_alola) : 150,
    pricePackLegendary: row.price_pack_legendary !== null && row.price_pack_legendary !== undefined ? Number(row.price_pack_legendary) : 500,
    priceFireStone: row.price_fire_stone !== null && row.price_fire_stone !== undefined ? Number(row.price_fire_stone) : 150,
    priceWaterStone: row.price_water_stone !== null && row.price_water_stone !== undefined ? Number(row.price_water_stone) : 150,
    priceThunderStone: row.price_thunder_stone !== null && row.price_thunder_stone !== undefined ? Number(row.price_thunder_stone) : 150,
    priceLeafStone: row.price_leaf_stone !== null && row.price_leaf_stone !== undefined ? Number(row.price_leaf_stone) : 150,
    priceMoonStone: row.price_moon_stone !== null && row.price_moon_stone !== undefined ? Number(row.price_moon_stone) : 150,
    raidChance: row.raid_chance !== null && row.raid_chance !== undefined ? Number(row.raid_chance) : 0.05,
    raidBossHp: row.raid_boss_hp !== null && row.raid_boss_hp !== undefined ? Number(row.raid_boss_hp) : 5000,
    raidRewardCoins: row.raid_reward_coins !== null && row.raid_reward_coins !== undefined ? Number(row.raid_reward_coins) : 250,
    raidRewardXp: row.raid_reward_xp !== null && row.raid_reward_xp !== undefined ? Number(row.raid_reward_xp) : 150,
    raidDropStoneChance: row.raid_drop_stone_chance !== null && row.raid_drop_stone_chance !== undefined ? Number(row.raid_drop_stone_chance) : 0.15,
    inventoryBaseUrl: row.inventory_base_url || '',
    spriteFormat: row.sprite_format || 'animated',
    spawnCatchGuideMode: row.spawn_catch_guide_mode || 'static',
    allowedGenerations: row.allowed_generations ? (typeof row.allowed_generations === 'string' ? JSON.parse(row.allowed_generations) : row.allowed_generations) : [1,2,3,4,5,6,7,8],
    battleScale: row.battle_scale !== null && row.battle_scale !== undefined ? Number(row.battle_scale) : 1.0,
    tickerScale: row.ticker_scale !== null && row.ticker_scale !== undefined ? Number(row.ticker_scale) : 1.0,
    feedScale: row.feed_scale !== null && row.feed_scale !== undefined ? Number(row.feed_scale) : 1.0,
    battleAcceptTimeoutSeconds: row.battle_accept_timeout_seconds !== null && row.battle_accept_timeout_seconds !== undefined ? Number(row.battle_accept_timeout_seconds) : 30,
    streamDelaySeconds: row.stream_delay_seconds !== null && row.stream_delay_seconds !== undefined ? Number(row.stream_delay_seconds) : 0,
    hideSpawnDetails: row.hide_spawn_details !== null && row.hide_spawn_details !== undefined ? Boolean(row.hide_spawn_details) : false,
    raidScale: row.raid_scale !== null && row.raid_scale !== undefined ? Number(row.raid_scale) : 1.0,
    raidPosition: row.raid_position || 'center',
    raidLeft: row.raid_left || '',
    raidRight: row.raid_right || '',
    raidTop: row.raid_top || '',
    raidBottom: row.raid_bottom || '',
    battleType: row.battle_type || 'normal',
    fullHealTimeMinutes: row.full_heal_time_minutes !== null && row.full_heal_time_minutes !== undefined ? Number(row.full_heal_time_minutes) : 60,
    healCostCoins: row.heal_cost_coins !== null && row.heal_cost_coins !== undefined ? Number(row.heal_cost_coins) : 50,
    showPackOpening: row.show_pack_opening !== false,
    packPosition: row.pack_position || 'center',
    packLeft: row.pack_left || '',
    packRight: row.pack_right || '',
    packTop: row.pack_top || '',
    packBottom: row.pack_bottom || '',
    packScale: row.pack_scale !== null && row.pack_scale !== undefined ? Number(row.pack_scale) : 1.0,
    showLevelUp: row.show_level_up !== false,
    levelUpPosition: row.level_up_position || 'center',
    levelUpLeft: row.level_up_left || '',
    levelUpRight: row.level_up_right || '',
    levelUpTop: row.level_up_top || '',
    levelUpBottom: row.level_up_bottom || '',
    levelUpScale: row.level_up_scale !== null && row.level_up_scale !== undefined ? Number(row.level_up_scale) : 1.0,
    showRaid: row.show_raid !== false,
    showBuddyOnChat: row.show_buddy_on_chat !== false,
    buddyChatDuration: row.buddy_chat_duration !== null && row.buddy_chat_duration !== undefined ? Number(row.buddy_chat_duration) : 15,
    loyaltyRewardInterval: row.loyalty_reward_interval !== null && row.loyalty_reward_interval !== undefined ? Number(row.loyalty_reward_interval) : 15,
    loyaltyRewardCoins: row.loyalty_reward_coins !== null && row.loyalty_reward_coins !== undefined ? Number(row.loyalty_reward_coins) : 50,
    loyaltyRewardPokeballs: row.loyalty_reward_pokeballs !== null && row.loyalty_reward_pokeballs !== undefined ? Number(row.loyalty_reward_pokeballs) : 5,
    loyaltyRewardGreatballs: row.loyalty_reward_greatballs !== null && row.loyalty_reward_greatballs !== undefined ? Number(row.loyalty_reward_greatballs) : 0,
    loyaltyRewardUltraballs: row.loyalty_reward_ultraballs !== null && row.loyalty_reward_ultraballs !== undefined ? Number(row.loyalty_reward_ultraballs) : 0,
    loyaltyRewardMasterballs: row.loyalty_reward_masterballs !== null && row.loyalty_reward_masterballs !== undefined ? Number(row.loyalty_reward_masterballs) : 0,
    buddyRoamerScale: row.buddy_roamer_scale !== null && row.buddy_roamer_scale !== undefined ? Number(row.buddy_roamer_scale) : 1.0,
    tradeTimeoutSeconds: row.trade_timeout_seconds !== null && row.trade_timeout_seconds !== undefined ? Number(row.trade_timeout_seconds) : 60,
    dailyBattleLimit: row.daily_battle_limit !== null && row.daily_battle_limit !== undefined ? Number(row.daily_battle_limit) : 5
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
         youtube_api_key = $26,
         spawn_card_left = $27, spawn_card_right = $28, spawn_card_top = $29, spawn_card_bottom = $30,
         ticker_position = $31, ticker_left = $32, ticker_right = $33, ticker_top = $34, ticker_bottom = $35,
         feed_position = $36, feed_left = $37, feed_right = $38, feed_top = $39, feed_bottom = $40,
         battle_position = $41, battle_left = $42, battle_right = $43, battle_top = $44, battle_bottom = $45,
         show_leaderboard = $46,
         coins_capture_normal = $47, coins_capture_shiny = $48, xp_capture_normal = $49, xp_capture_shiny = $50,
         level_up_coins = $51, level_up_greatballs = $52, level_up_ultraballs = $53,
         catch_multiplier_pokeball = $54, catch_multiplier_greatball = $55, catch_multiplier_ultraball = $56,
         price_pokeball = $57, price_greatball = $58, price_ultraball = $59, price_masterball = $60,
         catch_multiplier_normal = $61, catch_multiplier_rare = $62, catch_multiplier_legendary = $63,
         price_pack_kanto = $64, price_pack_johto = $65, price_pack_hoenn = $66, price_pack_sinnoh = $67,
         price_pack_unova = $68, price_pack_kalos = $69, price_pack_alola = $70, price_pack_legendary = $71,
         price_fire_stone = $72, price_water_stone = $73, price_thunder_stone = $74, price_leaf_stone = $75, price_moon_stone = $76,
         raid_chance = $77, raid_boss_hp = $78, raid_reward_coins = $79, raid_reward_xp = $80, raid_drop_stone_chance = $81,
         inventory_base_url = $82, sprite_format = $83, spawn_catch_guide_mode = $84, allowed_generations = $85,
         battle_scale = $86, ticker_scale = $87, feed_scale = $88,
         battle_accept_timeout_seconds = $89,
         stream_delay_seconds = $90,
         hide_spawn_details = $91,
         raid_scale = $92, raid_position = $93,
         raid_left = $94, raid_right = $95,
         raid_top = $96, raid_bottom = $97,
         battle_type = $98,
         full_heal_time_minutes = $99,
         heal_cost_coins = $100,
         show_pack_opening = $101, pack_position = $102,
         pack_left = $103, pack_right = $104, pack_top = $105, pack_bottom = $106,
         pack_scale = $107,
         show_level_up = $108, level_up_position = $109,
         level_up_left = $110, level_up_right = $111, level_up_top = $112, level_up_bottom = $113,
         level_up_scale = $114,
         show_raid = $115,
         show_buddy_on_chat = $116,
         buddy_chat_duration = $117,
         loyalty_reward_interval = $118,
         loyalty_reward_coins = $119,
         loyalty_reward_pokeballs = $120,
         loyalty_reward_greatballs = $121,
         loyalty_reward_ultraballs = $122,
         loyalty_reward_masterballs = $123,
         buddy_roamer_scale = $124,
         trade_timeout_seconds = $125,
         daily_battle_limit = $126
     WHERE channel_id = $127`,
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
      config.spawnCatchGuide || 'Type !catch in chat!',
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
      config.spawnCardLeft || '',
      config.spawnCardRight || '',
      config.spawnCardTop || '',
      config.spawnCardBottom || '',
      config.tickerPosition || 'top-left',
      config.tickerLeft || '',
      config.tickerRight || '',
      config.tickerTop || '',
      config.tickerBottom || '',
      config.feedPosition || 'top-right',
      config.feedLeft || '',
      config.feedRight || '',
      config.feedTop || '',
      config.feedBottom || '',
      config.battlePosition || 'center',
      config.battleLeft || '',
      config.battleRight || '',
      config.battleTop || '',
      config.battleBottom || '',
      config.showLeaderboard !== false,
      config.coinsCaptureNormal !== undefined ? config.coinsCaptureNormal : 20,
      config.coinsCaptureShiny !== undefined ? config.coinsCaptureShiny : 100,
      config.xpCaptureNormal !== undefined ? config.xpCaptureNormal : 15,
      config.xpCaptureShiny !== undefined ? config.xpCaptureShiny : 50,
      config.levelUpCoins !== undefined ? config.levelUpCoins : 100,
      config.levelUpGreatballs !== undefined ? config.levelUpGreatballs : 3,
      config.levelUpUltraballs !== undefined ? config.levelUpUltraballs : 1,
      config.catchMultiplierPokeball !== undefined ? config.catchMultiplierPokeball : 1.0,
      config.catchMultiplierGreatball !== undefined ? config.catchMultiplierGreatball : 1.5,
      config.catchMultiplierUltraball !== undefined ? config.catchMultiplierUltraball : 2.0,
      config.pricePokeball !== undefined ? config.pricePokeball : 10,
      config.priceGreatball !== undefined ? config.priceGreatball : 30,
      config.priceUltraball !== undefined ? config.priceUltraball : 80,
      config.priceMasterball !== undefined ? config.priceMasterball : 250,
      config.catchMultiplierNormal !== undefined ? config.catchMultiplierNormal : 1.0,
      config.catchMultiplierRare !== undefined ? config.catchMultiplierRare : 1.0,
      config.catchMultiplierLegendary !== undefined ? config.catchMultiplierLegendary : 1.0,
      config.pricePackKanto !== undefined ? config.pricePackKanto : 150,
      config.pricePackJohto !== undefined ? config.pricePackJohto : 150,
      config.pricePackHoenn !== undefined ? config.pricePackHoenn : 150,
      config.pricePackSinnoh !== undefined ? config.pricePackSinnoh : 150,
      config.pricePackUnova !== undefined ? config.pricePackUnova : 150,
      config.pricePackKalos !== undefined ? config.pricePackKalos : 150,
      config.pricePackAlola !== undefined ? config.pricePackAlola : 150,
      config.pricePackLegendary !== undefined ? config.pricePackLegendary : 500,
      config.priceFireStone !== undefined ? config.priceFireStone : 150,
      config.priceWaterStone !== undefined ? config.priceWaterStone : 150,
      config.priceThunderStone !== undefined ? config.priceThunderStone : 150,
      config.priceLeafStone !== undefined ? config.priceLeafStone : 150,
      config.priceMoonStone !== undefined ? config.priceMoonStone : 150,
      config.raidChance !== undefined ? config.raidChance : 0.05,
      config.raidBossHp !== undefined ? config.raidBossHp : 5000,
      config.raidRewardCoins !== undefined ? config.raidRewardCoins : 250,
      config.raidRewardXp !== undefined ? config.raidRewardXp : 150,
      config.raidDropStoneChance !== undefined ? config.raidDropStoneChance : 0.15,
      config.inventoryBaseUrl || '',
      config.spriteFormat || 'animated',
      config.spawnCatchGuideMode || 'static',
      JSON.stringify(config.allowedGenerations || [1,2,3,4,5,6,7,8]),
      config.battleScale !== undefined ? config.battleScale : 1.0,
      config.tickerScale !== undefined ? config.tickerScale : 1.0,
      config.feedScale !== undefined ? config.feedScale : 1.0,
      config.battleAcceptTimeoutSeconds !== undefined ? config.battleAcceptTimeoutSeconds : 30,
      config.streamDelaySeconds !== undefined ? config.streamDelaySeconds : 0,
      config.hideSpawnDetails !== undefined ? config.hideSpawnDetails : false,
      config.raidScale !== undefined ? config.raidScale : 1.0,
      config.raidPosition || 'center',
      config.raidLeft || '',
      config.raidRight || '',
      config.raidTop || '',
      config.raidBottom || '',
      config.battleType || 'normal',
      config.fullHealTimeMinutes !== undefined ? config.fullHealTimeMinutes : 60,
      config.healCostCoins !== undefined ? config.healCostCoins : 50,
      config.showPackOpening !== undefined ? config.showPackOpening : true,
      config.packPosition || 'center',
      config.packLeft || '',
      config.packRight || '',
      config.packTop || '',
      config.packBottom || '',
      config.packScale !== undefined ? config.packScale : 1.0,
      config.showLevelUp !== undefined ? config.showLevelUp : true,
      config.levelUpPosition || 'center',
      config.levelUpLeft || '',
      config.levelUpRight || '',
      config.levelUpTop || '',
      config.levelUpBottom || '',
      config.levelUpScale !== undefined ? config.levelUpScale : 1.0,
      config.showRaid !== false,
      config.showBuddyOnChat !== undefined ? config.showBuddyOnChat : true,
      config.buddyChatDuration !== undefined ? config.buddyChatDuration : 15,
      config.loyaltyRewardInterval !== undefined ? config.loyaltyRewardInterval : 15,
      config.loyaltyRewardCoins !== undefined ? config.loyaltyRewardCoins : 50,
      config.loyaltyRewardPokeballs !== undefined ? config.loyaltyRewardPokeballs : 5,
      config.loyaltyRewardGreatballs !== undefined ? config.loyaltyRewardGreatballs : 0,
      config.loyaltyRewardUltraballs !== undefined ? config.loyaltyRewardUltraballs : 0,
      config.loyaltyRewardMasterballs !== undefined ? config.loyaltyRewardMasterballs : 0,
      config.buddyRoamerScale !== undefined ? config.buddyRoamerScale : 1.0,
      config.tradeTimeoutSeconds !== undefined ? config.tradeTimeoutSeconds : 60,
      config.dailyBattleLimit !== undefined ? config.dailyBattleLimit : 5,
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
    const list = [];
    for (const k of Object.keys(localUsers)) {
      if (k.startsWith(`${streamer}_`)) {
        const channelUser = localUsers[k];
        const u = await getUser('global', channelUser.username);
        list.push({
          username: u.username,
          displayName: u.displayName,
          level: u.level || 1,
          xp: u.xp || 0,
          coins: u.coins !== undefined && u.coins !== null ? u.coins : 100,
          balls: u.balls,
          activePokemonId: u.activePokemonId,
          buddyInstanceId: u.buddyInstanceId,
          inventoryCount: u.inventory.length,
          lastCatchAttempt: u.lastCatchAttempt,
          lastDaily: u.lastDaily
        });
      }
    }
    return list;
  }
  
  const res = await query('SELECT username FROM players WHERE streamer_id = $1 ORDER BY username ASC', [streamer]);
  const list = [];
  for (const row of res.rows) {
    const u = await getUser('global', row.username);
    list.push({
      username: u.username,
      displayName: u.displayName,
      level: u.level || 1,
      xp: u.xp || 0,
      coins: u.coins !== undefined && u.coins !== null ? u.coins : 100,
      balls: u.balls,
      activePokemonId: u.activePokemonId,
      buddyInstanceId: u.buddyInstanceId,
      inventoryCount: u.inventory.length,
      lastCatchAttempt: u.lastCatchAttempt,
      lastDaily: u.lastDaily
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

/**
 * Swaps ownership of two Pokémon instances between two players.
 */
async function swapPokemonOwnership(streamerId, playerA, instanceIdA, playerB, instanceIdB) {
  const streamer = 'global';
  const usernameA = playerA.toLowerCase().trim();
  const usernameB = playerB.toLowerCase().trim();
  
  if (useLocalFallback) {
    const userA = await getUser(streamerId, usernameA);
    const userB = await getUser(streamerId, usernameB);
    
    const pokeIndexA = userA.inventory.findIndex(p => p.instanceId === instanceIdA);
    const pokeIndexB = userB.inventory.findIndex(p => p.instanceId === instanceIdB);
    
    if (pokeIndexA === -1 || pokeIndexB === -1) {
      throw new Error("One or both Pokémon not found in player inventories.");
    }
    
    const pokeA = userA.inventory.splice(pokeIndexA, 1)[0];
    const pokeB = userB.inventory.splice(pokeIndexB, 1)[0];
    
    userA.inventory.push(pokeB);
    userB.inventory.push(pokeA);
    
    // Clear buddies or active if traded
    if (userA.buddyInstanceId === instanceIdA) userA.buddyInstanceId = null;
    if (userA.activePokemonId === instanceIdA) userA.activePokemonId = userA.inventory[0]?.instanceId || null;
    if (userB.buddyInstanceId === instanceIdB) userB.buddyInstanceId = null;
    if (userB.activePokemonId === instanceIdB) userB.activePokemonId = userB.inventory[0]?.instanceId || null;
    
    await saveUser(streamerId, userA);
    await saveUser(streamerId, userB);
    return;
  }
  
  // PostgreSQL version
  const userA = await getUser(streamerId, usernameA);
  const userB = await getUser(streamerId, usernameB);
  
  await query(
    'UPDATE inventories SET username = $1 WHERE streamer_id = $2 AND instance_id = $3',
    [usernameB, streamer, instanceIdA]
  );
  await query(
    'UPDATE inventories SET username = $1 WHERE streamer_id = $2 AND instance_id = $3',
    [usernameA, streamer, instanceIdB]
  );
  
  // Clear buddies or active in players table if traded
  if (userA.buddyInstanceId === instanceIdA) {
    await query('UPDATE players SET buddy_instance_id = NULL WHERE streamer_id = $1 AND username = $2', [streamer, usernameA]);
  }
  if (userA.activePokemonId === instanceIdA) {
    const nextActive = (await query('SELECT instance_id FROM inventories WHERE streamer_id = $1 AND username = $2 LIMIT 1', [streamer, usernameA])).rows[0]?.instance_id || null;
    await query('UPDATE players SET active_pokemon_id = $1 WHERE streamer_id = $2 AND username = $3', [nextActive, streamer, usernameA]);
  }
  
  if (userB.buddyInstanceId === instanceIdB) {
    await query('UPDATE players SET buddy_instance_id = NULL WHERE streamer_id = $1 AND username = $2', [streamer, usernameB]);
  }
  if (userB.activePokemonId === instanceIdB) {
    const nextActive = (await query('SELECT instance_id FROM inventories WHERE streamer_id = $1 AND username = $2 LIMIT 1', [streamer, usernameB])).rows[0]?.instance_id || null;
    await query('UPDATE players SET active_pokemon_id = $1 WHERE streamer_id = $2 AND username = $3', [nextActive, streamer, usernameB]);
  }
}

/**
 * Forcefully evolves a Pokémon instance to a new ID, name, types, and stats.
 */
async function evolvePokemon(streamerId, username, instanceId, newPokemonData) {
  const streamer = 'global';
  const key = username.toLowerCase().trim();
  
  const name = newPokemonData.shiny ? `✨ Shiny ${newPokemonData.name}` : newPokemonData.name;
  const hp = newPokemonData.stats ? newPokemonData.stats.hp : newPokemonData.baseStats.hp;
  const attack = newPokemonData.stats ? newPokemonData.stats.attack : newPokemonData.baseStats.attack;
  const defense = newPokemonData.stats ? newPokemonData.stats.defense : newPokemonData.baseStats.defense;
  const speed = newPokemonData.stats ? newPokemonData.stats.speed : newPokemonData.baseStats.speed;
  const types = newPokemonData.types;
  
  if (useLocalFallback) {
    const user = await getUser(streamerId, username);
    const poke = user.inventory.find(p => p.instanceId === instanceId);
    if (!poke) throw new Error("Pokémon not found in inventory.");
    
    poke.pokemonId = newPokemonData.id;
    poke.originalName = newPokemonData.name;
    poke.name = name;
    poke.types = types;
    poke.baseStats = { hp, attack, defense, speed };
    poke.currentStage += 1;
    
    await saveUser(streamerId, user);
    return poke;
  }
  
  // PostgreSQL version
  await query(
    `UPDATE inventories 
     SET pokemon_id = $1, pokemon_name = '', types = null, 
         base_hp = $2, base_atk = $3, base_def = $4, base_spd = $5,
         current_stage = current_stage + 1
     WHERE streamer_id = $6 AND username = $7 AND instance_id = $8`,
    [newPokemonData.id, hp, attack, defense, speed, streamer, key, instanceId]
  );
  
  return {
    instanceId,
    pokemonId: newPokemonData.id,
    name,
    originalName: newPokemonData.name,
    types,
    baseStats: { hp, attack, defense, speed },
    shiny: newPokemonData.shiny,
    currentStage: 2 // placeholder incremental
  };
}

/**
 * Merges duplicate Pokémon of the same type.
 */
async function fusePokemon(streamerId, username, targetName) {
  const streamer = 'global';
  const key = username.toLowerCase().trim();
  const searchName = targetName.toLowerCase().replace('✨ shiny ', '').trim();

  const user = await getUser(streamerId, username);
  if (!user || !user.inventory || user.inventory.length === 0) {
    throw new Error("You don't have any Pokémon in your inventory.");
  }

  // Find all matches in the user's inventory
  const matches = user.inventory.filter(p => {
    const original = p.originalName ? p.originalName.toLowerCase() : p.name.toLowerCase().replace('✨ shiny ', '');
    const currentName = p.name.toLowerCase().replace('✨ shiny ', '');
    return original === searchName || currentName === searchName;
  });

  if (matches.length < 2) {
    throw new Error(`You need at least 2 of '${targetName}' to fuse them. You have ${matches.length}.`);
  }

  // Determine survivor: active buddy takes priority, then highest stats sum
  let survivor = matches.find(p => p.instanceId === user.activePokemonId);
  if (!survivor) {
    // Sort by stats sum descending
    matches.sort((a, b) => {
      const sumA = a.baseStats.hp + a.baseStats.attack + a.baseStats.defense + a.baseStats.speed;
      const sumB = b.baseStats.hp + b.baseStats.attack + b.baseStats.defense + b.baseStats.speed;
      return sumB - sumA;
    });
    survivor = matches[0];
  }

  const sacrifices = matches.filter(p => p.instanceId !== survivor.instanceId);

  // Perform fusion calculation:
  // survivor gets max(survivor_stat, sacrifice_stat) + 5 per sacrifice.
  let newHp = survivor.baseStats.hp;
  let newAtk = survivor.baseStats.attack;
  let newDef = survivor.baseStats.defense;
  let newSpd = survivor.baseStats.speed;
  let addedWins = 0;

  for (const sac of sacrifices) {
    newHp = Math.max(newHp, sac.baseStats.hp) + 10;
    newAtk = Math.max(newAtk, sac.baseStats.attack) + 10;
    newDef = Math.max(newDef, sac.baseStats.defense) + 10;
    newSpd = Math.max(newSpd, sac.baseStats.speed) + 10;
    addedWins += sac.wins || 0;
  }

  const finalWins = survivor.wins + addedWins;
  const finalFusionCount = (survivor.fusionCount || 0) + sacrifices.length;

  if (useLocalFallback) {
    // Local fallback update
    const freshUser = await getUser(streamerId, username);
    const mappedSurvivor = freshUser.inventory.find(p => p.instanceId === survivor.instanceId);
    mappedSurvivor.baseStats = { hp: newHp, attack: newAtk, defense: newDef, speed: newSpd };
    mappedSurvivor.wins = finalWins;
    mappedSurvivor.fusionCount = finalFusionCount;
    mappedSurvivor.currentHp = newHp;
    mappedSurvivor.lastBattleTime = 0;

    // Delete sacrifices
    const sacIds = sacrifices.map(s => s.instanceId);
    freshUser.inventory = freshUser.inventory.filter(p => !sacIds.includes(p.instanceId));

    // Reset active buddy if it was a sacrifice
    if (sacIds.includes(freshUser.activePokemonId)) {
      freshUser.activePokemonId = survivor.instanceId;
    }
    await saveUser(streamerId, freshUser);
  } else {
    // PostgreSQL database update
    // Update survivor and fully heal them
    await query(
      `UPDATE inventories 
       SET base_hp = $1, base_atk = $2, base_def = $3, base_spd = $4, wins = $5, fusion_count = $6, current_hp = $1, last_battle_time = 0
       WHERE streamer_id = $7 AND username = $8 AND instance_id = $9`,
      [newHp, newAtk, newDef, newSpd, finalWins, finalFusionCount, streamer, key, survivor.instanceId]
    );

    // Delete sacrifices
    const sacIds = sacrifices.map(s => s.instanceId);
    await query(
      'DELETE FROM inventories WHERE streamer_id = $1 AND username = $2 AND instance_id = ANY($3)',
      [streamer, key, sacIds]
    );

    // Reset active buddy if it was a sacrifice
    const playerRow = (await query('SELECT active_pokemon_id FROM players WHERE streamer_id = $1 AND username = $2', [streamer, key])).rows[0];
    if (playerRow && sacIds.includes(playerRow.active_pokemon_id)) {
      await query(
        'UPDATE players SET active_pokemon_id = $1 WHERE streamer_id = $2 AND username = $3',
        [survivor.instanceId, streamer, key]
      );
    }
  }

  return {
    survivorName: survivor.name,
    fusionCount: finalFusionCount,
    sacrificedCount: sacrifices.length,
    stats: { hp: newHp, attack: newAtk, defense: newDef, speed: newSpd }
  };
}

/**
 * Renames a player in the players and inventories tables.
 */
async function renamePlayer(streamerId, oldUsername, newUsername, newDisplayName) {
  const streamer = streamerId.toLowerCase().trim();
  const oldUser = oldUsername.toLowerCase().trim();
  const newUser = newUsername.toLowerCase().trim();
  const newDisplay = newDisplayName.trim();
  
  // 1. Rename on channel-specific player record
  if (useLocalFallback) {
    const oldKey = `${streamer}_${oldUser}`;
    const newKey = `${streamer}_${newUser}`;
    if (localUsers[oldKey]) {
      const userData = localUsers[oldKey];
      userData.username = newUser;
      userData.displayName = newDisplay;
      localUsers[newKey] = userData;
      delete localUsers[oldKey];
      saveLocalUsers();
    }
  } else {
    await query(
      'UPDATE players SET username = $1, display_name = $2 WHERE streamer_id = $3 AND username = $4',
      [newUser, newDisplay, streamer, oldUser]
    );
  }
  
  // 2. Rename on global player record
  if (useLocalFallback) {
    const oldKey = `global_${oldUser}`;
    const newKey = `global_${newUser}`;
    if (localUsers[oldKey]) {
      const userData = localUsers[oldKey];
      userData.username = newUser;
      userData.displayName = newDisplay;
      localUsers[newKey] = userData;
      delete localUsers[oldKey];
      saveLocalUsers();
    }
  } else {
    await query(
      'UPDATE players SET username = $1, display_name = $2 WHERE streamer_id = $3 AND username = $4',
      [newUser, newDisplay, 'global', oldUser]
    );
    await query(
      'UPDATE inventories SET username = $1 WHERE streamer_id = $2 AND username = $3',
      [newUser, 'global', oldUser]
    );
  }
}

/**
 * Transfers a Pokémon instance from one player to another (Steal Battle).
 */
async function stealPokemon(streamerId, winnerUsername, loserUsername, pokemonInstanceId) {
  const streamer = 'global';
  const winner = winnerUsername.toLowerCase().trim();
  const loser = loserUsername.toLowerCase().trim();

  if (useLocalFallback) {
    const userWinner = await getUser(streamerId, winner);
    const userLoser = await getUser(streamerId, loser);

    const index = userLoser.inventory.findIndex(p => p.instanceId === pokemonInstanceId);
    if (index === -1) {
      throw new Error("Pokémon not found in loser's inventory.");
    }

    const stolenPoke = userLoser.inventory.splice(index, 1)[0];
    userWinner.inventory.push(stolenPoke);

    // Reset buddy/active if they were the stolen Pokémon
    if (userLoser.buddyInstanceId === pokemonInstanceId) userLoser.buddyInstanceId = null;
    if (userLoser.activePokemonId === pokemonInstanceId) {
      userLoser.activePokemonId = userLoser.inventory[0]?.instanceId || null;
    }

    await saveUser(streamerId, userWinner);
    await saveUser(streamerId, userLoser);
    return stolenPoke;
  }

  // PostgreSQL Mode
  await query(
    'UPDATE inventories SET username = $1 WHERE streamer_id = $2 AND instance_id = $3',
    [winner, streamer, pokemonInstanceId]
  );

  const userLoser = await getUser(streamerId, loser);
  
  if (userLoser.buddyInstanceId === pokemonInstanceId) {
    await query('UPDATE players SET buddy_instance_id = NULL WHERE streamer_id = $1 AND username = $2', [streamer, loser]);
  }
  if (userLoser.activePokemonId === pokemonInstanceId) {
    const nextActive = (await query('SELECT instance_id FROM inventories WHERE streamer_id = $1 AND username = $2 LIMIT 1', [streamer, loser])).rows[0]?.instance_id || null;
    await query('UPDATE players SET active_pokemon_id = $1 WHERE streamer_id = $2 AND username = $3', [nextActive, streamer, loser]);
  }
  
  // Return the transfer details
  const userWinner = await getUser(streamerId, winner);
  const transferred = userWinner.inventory.find(p => p.instanceId === pokemonInstanceId);
  return transferred;
}

/**
 * Deletes a player profile and all associated inventory data.
 */
async function deletePlayer(streamerId, username) {
  const streamer = streamerId.toLowerCase().trim();
  const key = username.toLowerCase().trim();

  if (useLocalFallback) {
    const localKey = `${streamer}_${key}`;
    if (localUsers[localKey]) {
      delete localUsers[localKey];
      saveLocalUsers();
    }
    return;
  }

  // PostgreSQL Mode — only delete the player-streamer association
  await query('DELETE FROM players WHERE streamer_id = $1 AND username = $2', [streamer, key]);
}

/**
 * Deletes a single Pokémon instance from a player's inventory.
 */
async function deletePokemon(streamerId, username, instanceId) {
  const streamer = 'global';
  const key = username.toLowerCase().trim();
  
  if (useLocalFallback) {
    const user = await getUser(streamerId, username);
    user.inventory = user.inventory.filter(p => p.instanceId !== instanceId);
    
    // If the fainted/removed Pokémon was active, set active to another one (if inventory not empty)
    if (user.activePokemonId === instanceId) {
      user.activePokemonId = user.inventory.length > 0 ? user.inventory[0].instanceId : null;
    }
    
    await saveUser(streamerId, user);
    return true;
  }
  
  // PostgreSQL Mode
  await query(
    'DELETE FROM inventories WHERE streamer_id = $1 AND username = $2 AND instance_id = $3',
    [streamer, key, instanceId]
  );
  
  // Update active pokemon if fainted/removed
  const user = await getUser(streamerId, username);
  if (user.activePokemonId === instanceId) {
    const newActiveId = user.inventory.length > 0 ? user.inventory[0].instanceId : null;
    await query(
      'UPDATE players SET active_pokemon_id = $1 WHERE streamer_id = $2 AND username = $3',
      [newActiveId, streamer, key]
    );
  }
  return true;
}

/**
 * Resolves a player profile by nickname (checks username OR display_name).
 * Falls back to getUser if no match is found.
 */
async function findPlayerByNickname(streamerId, nickname) {
  const streamer = streamerId.toLowerCase().trim();
  const rawKey = nickname.toLowerCase().trim();
  const cleanKey = rawKey.replace(/^@/, '');
  const keyWithAt = '@' + cleanKey;

  if (useLocalFallback) {
    const matched = Object.keys(localUsers).find(k => {
      if (!k.startsWith(`${streamer}_`)) return false;
      const u = localUsers[k];
      const dbUserLower = u.username.toLowerCase();
      const dbDisplayLower = u.displayName.toLowerCase();
      return dbUserLower === cleanKey || dbUserLower === keyWithAt ||
             dbDisplayLower === cleanKey || dbDisplayLower === keyWithAt;
    });
    if (matched) {
      return await getUser('global', localUsers[matched].username);
    }
    return await getUser('global', cleanKey);
  }

  // Check against username and display_name for the specific streamer channel
  const res = await query(
    `SELECT username FROM players 
     WHERE streamer_id = $1 
       AND (LOWER(username) = $2 OR LOWER(username) = $3
            OR LOWER(display_name) = $2 OR LOWER(display_name) = $3) 
     LIMIT 1`,
    [streamer, cleanKey, keyWithAt]
  );
  if (res && res.rows.length > 0) {
    return await getUser('global', res.rows[0].username);
  }
  return await getUser('global', cleanKey);
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
  getAllPlayers,
  swapPokemonOwnership,
  evolvePokemon,
  fusePokemon,
  renamePlayer,
  stealPokemon,
  deletePlayer,
  deletePokemon,
  findPlayerByNickname,
  healPokemon
};
