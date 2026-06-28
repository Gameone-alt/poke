# 🎮 Pokémon Live Chat Stream Overlay & Bot

An interactive Pokémon mini-game overlay designed for YouTube Live and Twitch streams. Viewers can claim daily items, buy Pokéballs, catch wild Pokémon as they spawn, and challenge other viewers (or wild Pokémon) to battles directly through chat commands.

The project features a **Streamer Dashboard** for real-time overlay configurations, live chat simulations, and player database management, plus a C# relayer script for seamless integration with **Streamer.bot**.

---

## ✨ Features

- **Dynamic Overlay Positioning**: Move components (Wild Spawn Card, Live Feed, Leaderboard Ticker, Battle Arena) via preset modes or custom pixel/percentage offsets from the dashboard.
- **Battle Arena**: Centered battle board showing trainers, Pokémon sprites, status updates, type-based elemental collision flashes, and defeat animations.
- **Leaderboard Ticker**: Auto-rotating marquee showing the top collectors, active buddies, and battle champions.
- **Sound Effects (SFX)**: retro chiptune sounds for spawns, throwing balls, capture success/fails, combat hits, and evolutions.
- **Streamer.bot Relayer**: Lightweight C# script to relay YouTube & Twitch chats dynamically to the Express server.
- **Database Fallback**: Automatically defaults to local JSON storage (`backend/data/configs.json` and `backend/data/users.json`) if PostgreSQL is not configured, making it lightweight and easy for anyone to run locally.

---

## 🚀 Setup & Installation

Follow these steps to get the server running:

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v16 or higher recommended).

### 2. Install Dependencies
Clone or download this repository, open your terminal in the project directory, and run:
```bash
npm install
```

### 3. Initialize Environment Config
1. Duplicate the `.env.example` file and rename it to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and configure:
   - `PORT`: The port to run the server on (default is `3000`).
   - `DATABASE_URL`: *(Optional)* If you want to use a cloud database (like Supabase PostgreSQL), paste your connection string. If left commented out or blank, the app will automatically use local JSON file storage.

### 4. Seed the Pokémon Database
To pull animated sprite paths and stats from the PokeAPI, run the seed script:
```bash
npm run seed
```
*This downloads and caches Pokemon data to `backend/data/pokemon.json`.*

### 5. Start the Server
Run the Express application:
```bash
npm start
```
The server will now be live on `http://localhost:3000`.

---

## 🛠️ Streamer.bot Integration (Twitch & YouTube)

To relay live stream chat to this game, setup **Streamer.bot** using the relayer script:

1. In Streamer.bot, go to the **Actions** tab and create a new Action (e.g., `PokemonChatRelayer`).
2. Add a sub-action: **Code** -> **C# Execute Code**.
3. Open the C# editor in Streamer.bot, and paste the code from [streamerbot_relayer.cs](backend/streamerbot_relayer.cs).
4. Save and compile the code.
5. In the Action, add **Set Argument** sub-actions *before* the C# Execute sub-action:
   - `pokemonChannelSlug` -> Set this to a unique slug identifier (e.g., your channel name). This maps your OBS overlay connection room to the dashboard config.
   - `useBotAccount` -> Set to `true` if you want bot responses sent from your bot account, or `false` to send messages as the broadcaster.
6. Set the triggers for this Action:
   - **Twitch** -> **Chat** -> **Chat Message**
   - **YouTube** -> **Chat** -> **Message**

---

## 📺 OBS Studio Setup

1. Open OBS Studio.
2. Under **Sources**, click `+` and select **Browser**.
3. Name it (e.g., `Pokemon Overlay`) and configure:
   - **URL**: `http://localhost:3000/overlay.html?channel=YOUR_CHANNEL_SLUG` (Replace `YOUR_CHANNEL_SLUG` with the `pokemonChannelSlug` you set in Streamer.bot).
   - **Width**: `1920`
   - **Height**: `1080`
4. *(Optional)* Click **Control Audio via OBS** if you want to route game SFX sounds through OBS audio tracks.

---

## 🎮 How to Play (Chat Commands)

Here are the primary commands viewers can type in chat:

- **🎒 Game Basics**:
  - `!help` or `!commands`: Show list of available commands.
  - `!daily`: Claim daily coins and Pokeballs.
  - `!inventory`: Check your Pokéball inventory and budget.
  - `!coins`: View your coin balance.
  - `!shop`: Display items available for purchase.
  - `!buy [ball_type] [amount]`: Purchase items (e.g. `!buy great 5`).

- **🔴 Catching Spawns**:
  - `catch`: Throw a standard Pokéball.
  - `catch great`: Throw a Great Ball (better catch chance).
  - `catch ultra`: Throw an Ultra Ball (highest catch chance).

- **⚔️ Battles & Buddy Partnership**:
  - `!buddy [pokemon_name]`: Set a partner companion buddy.
  - `!fight @username [your_pokemon]`: Challenge a viewer to combat.
  - `!fight wild [your_pokemon]`: Battle the currently active wild spawn.
  - `!accept [your_pokemon]`: Accept a pending battle request.
