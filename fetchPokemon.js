const fs = require('fs');
const path = require('path');

const LIMIT = 1025; // Gen 1 to Gen 9
const OUTPUT_DIR = path.join(__dirname, 'backend', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'pokemon.json');

// Complete Static Evolution Mapping for Gen 1 - Gen 3
const EVOLUTIONS = {
  1: 2, 2: 3,          // Bulbasaur -> Ivysaur -> Venusaur
  4: 5, 5: 6,          // Charmander -> Charmeleon -> Charizard
  7: 8, 8: 9,          // Squirtle -> Wartortle -> Blastoise
  10: 11, 11: 12,      // Caterpie -> Metapod -> Butterfree
  13: 14, 14: 15,      // Weedle -> Kakuna -> Beedrill
  16: 17, 17: 18,      // Pidgey -> Pidgeotto -> Pidgeot
  19: 20,              // Rattata -> Raticate
  21: 22,              // Spearow -> Fearow
  23: 24,              // Ekans -> Arbok
  25: 26,              // Pikachu -> Raichu
  27: 28,              // Sandshrew -> Sandslash
  29: 30, 30: 31,      // Nidoran F -> Nidorina -> Nidoqueen
  32: 33, 33: 34,      // Nidoran M -> Nidorino -> Nidoking
  35: 36,              // Clefairy -> Clefable
  37: 38,              // Vulpix -> Ninetales
  39: 40,              // Jigglypuff -> Wigglytuff
  41: 42, 42: 169,     // Zubat -> Golbat -> Crobat (Gen 2)
  43: 44, 44: [45, 182], // Oddish -> Gloom -> Vileplume / Bellossom (Gen 2)
  46: 47,              // Paras -> Parasect
  48: 49,              // Venonat -> Venomoth
  50: 51,              // Diglett -> Dugtrio
  52: 53,              // Meowth -> Persian
  54: 55,              // Psyduck -> Golduck
  56: 57,              // Mankey -> Primeape
  58: 59,              // Growlithe -> Arcanine
  60: 61, 61: [62, 186], // Poliwag -> Poliwhirl -> Poliwrath / Politoed (Gen 2)
  63: 64, 64: 65,      // Abra -> Kadabra -> Alakazam
  66: 67, 67: 68,      // Machop -> Machoke -> Machamp
  69: 70, 70: 71,      // Bellsprout -> Weepinbell -> Victreebel
  72: 73,              // Tentacool -> Tentacruel
  74: 75, 75: 76,      // Geodude -> Graveler -> Golem
  77: 78,              // Ponyta -> Rapidash
  79: [80, 199],       // Slowpoke -> Slowbro / Slowking (Gen 2)
  81: 82,              // Magnemite -> Magneton
  84: 85,              // Doduo -> Dodrio
  86: 87,              // Seel -> Dewgong
  88: 89,              // Grimer -> Muk
  90: 91,              // Shellder -> Cloyster
  92: 93, 93: 94,      // Gastly -> Haunter -> Gengar
  95: 208,             // Onix -> Steelix (Gen 2)
  96: 97,              // Drowzee -> Hypno
  98: 99,              // Krabby -> Kingler
  100: 101,            // Voltorb -> Electrode
  102: 103,            // Exeggcute -> Exeggutor
  104: 105,            // Cubone -> Marowak
  109: 110,            // Koffing -> Weezing
  111: 112,            // Rhyhorn -> Rhydon
  113: 242,            // Chansey -> Blissey (Gen 2)
  116: 117, 117: 230,  // Horsea -> Seadra -> Kingdra (Gen 2)
  118: 119,            // Goldeen -> Seaking
  120: 121,            // Staryu -> Starmie
  123: 212,            // Scyther -> Scizor (Gen 2)
  129: 130,            // Magikarp -> Gyarados
  133: [134, 135, 136, 196, 197], // Eevee -> Vaporeon, Jolteon, Flareon, Espeon, Umbreon
  138: 139,            // Omanyte -> Omastar
  140: 141,            // Kabuto -> Kabutops
  147: 148, 148: 149,  // Dratini -> Dragonair -> Dragonite
  
  // Gen 2 Evolutions
  152: 153, 153: 154,  // Chikorita -> Bayleef -> Meganium
  155: 156, 156: 157,  // Cyndaquil -> Quilava -> Typhlosion
  158: 159, 159: 160,  // Totodile -> Croconaw -> Feraligatr
  161: 162,            // Sentret -> Furret
  163: 164,            // Hoothoot -> Noctowl
  165: 166,            // Ledyba -> Ledian
  167: 168,            // Spinarak -> Ariados
  170: 171,            // Chinchou -> Lanturn
  172: 25,             // Pichu -> Pikachu
  173: 35,             // Cleffa -> Clefairy
  174: 39,             // Igglybuff -> Jigglypuff
  175: 176,            // Togepi -> Togetic
  177: 178,            // Natu -> Xatu
  179: 180, 180: 181,  // Mareep -> Flaaffy -> Ampharos
  183: 184,            // Marill -> Azumarill
  187: 188, 188: 189,  // Hoppip -> Skiploom -> Jumpluff
  191: 192,            // Sunkern -> Sunflora
  194: 195,            // Wooper -> Quagsire
  204: 205,            // Pineco -> Forretress
  209: 210,            // Snubbull -> Granbull
  216: 217,            // Teddiursa -> Ursaring
  218: 219,            // Slugma -> Magcargo
  220: 221,            // Swinub -> Piloswine
  223: 224,            // Remoraid -> Octillery
  228: 229,            // Houndour -> Houndoom
  231: 232,            // Phanpy -> Donphan
  236: [106, 107, 237], // Tyrogue -> Hitmonlee/Hitmonchan/Hitmontop
  238: 124,            // Smoochum -> Jynx
  239: 125,            // Elekid -> Electabuzz
  240: 126,            // Magby -> Magmar
  246: 247, 247: 248,  // Larvitar -> Pupitar -> Tyranitar
  
  // Gen 3 Evolutions
  252: 253, 253: 254,  // Treecko -> Grovyle -> Sceptile
  255: 256, 256: 257,  // Torchic -> Combusken -> Blaziken
  258: 259, 259: 260,  // Mudkip -> Marshtomp -> Swampert
  261: 262,            // Poochyena -> Mightyena
  263: 264,            // Zigzagoon -> Linoone
  265: [266, 268],     // Wurmple -> Silcoon / Cascoon (branched)
  266: 267,            // Silcoon -> Beautifly
  268: 269,            // Cascoon -> Dustox
  270: 271, 271: 272,  // Lotad -> Lombre -> Ludicolo
  273: 274, 274: 275,  // Seedot -> Nuzleaf -> Shiftry
  276: 277,            // Taillow -> Swellow
  278: 279,            // Wingull -> Pelipper
  280: 281, 281: 282,  // Ralts -> Kirlia -> Gardevoir
  283: 284,            // Surskit -> Masquerain
  285: 286,            // Shroomish -> Breloom
  287: 288, 288: 289,  // Slakoth -> Vigoroth -> Slaking
  290: [291, 292],     // Nincada -> Ninjask / Shedinja
  293: 294, 294: 295,  // Whismur -> Loudred -> Exploud
  296: 297,            // Makuhita -> Hariyama
  298: 183,            // Azurill -> Marill
  300: 301,            // Skitty -> Delcatty
  304: 305, 305: 306,  // Aron -> Lairon -> Aggron
  307: 308,            // Meditite -> Medicham
  309: 310,            // Electrike -> Manectric
  316: 317,            // Gulpin -> Swalot
  318: 319,            // Carvanha -> Sharpedo
  320: 321,            // Wailmer -> Wailord
  322: 323,            // Numel -> Camerupt
  325: 326,            // Spoink -> Grumpig
  328: 329, 329: 330,  // Trapinch -> Vibrava -> Flygon
  331: 332,            // Cacnea -> Cacturne
  333: 334,            // Swablu -> Altaria
  339: 340,            // Barboach -> Whiscash
  341: 342,            // Corphish -> Crawdaunt
  343: 344,            // Baltoy -> Claydol
  345: 346,            // Lileep -> Cradily
  347: 348,            // Anorith -> Armaldo
  349: 350,            // Feebas -> Milotic
  353: 354,            // Shuppet -> Banette
  355: 356,            // Duskull -> Dusclops
  360: 202,            // Wynaut -> Wobbuffet
  361: 362,            // Snorunt -> Glalie
  363: 364, 364: 365,  // Spheal -> Sealeo -> Walrein
  366: [367, 368],     // Clamperl -> Huntail / Gorebyss
  371: 372, 372: 373,  // Bagon -> Shelgon -> Salamence
  374: 375, 375: 376   // Beldum -> Metang -> Metagross
};

async function run() {
  console.log(`Starting optimized Pokémon static fetch (Gens 1-3, limit ${LIMIT})...`);
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const sourceUrl = 'https://raw.githubusercontent.com/fanzeyi/pokemon.json/master/pokedex.json';
  
  console.log(`Downloading static database from: ${sourceUrl}...`);
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download static pokedex: status ${response.status}`);
  }
  
  const rawData = await response.json();
  console.log(`Successfully downloaded. Parsing ${LIMIT} Pokémon...`);
  
  const pokemonDb = {};
  
  // Filter and process
  const list = rawData.slice(0, LIMIT);
  
  list.forEach((item) => {
    const id = item.id;
    const name = item.name.english;
    const types = item.type.map(t => t.toLowerCase());
    
    // Stats mapping
    const hp = item.base.HP;
    const attack = item.base.Attack;
    const defense = item.base.Defense;
    const speed = item.base.Speed;
    const spAttack = item.base['Sp. Attack'];
    const spDefense = item.base['Sp. Defense'];
    
    const statsSum = hp + attack + defense + speed + spAttack + spDefense;
    
    // Calculate capture rates based on base stats sum
    let catchRate = 0.55; // Common (55%)
    if (statsSum >= 580) {
      catchRate = 0.04; // Legendary/Mythical (4%)
    } else if (statsSum >= 480) {
      catchRate = 0.12; // Rare (12%)
    } else if (statsSum >= 380) {
      catchRate = 0.22; // Uncommon (22%)
    } else if (statsSum >= 300) {
      catchRate = 0.35; // Medium (35%)
    }
    
    // Sprites: Showdown animated gifs, with official artwork as fallback
    const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`;
    const shinySpriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/${id}.gif`;
    const fallbackSpriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
    const fallbackShinySpriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${id}.png`;
    
    // Check if evolution is defined in our static list
    const evolution = EVOLUTIONS[id] || null;
    
    pokemonDb[id] = {
      id: id,
      name: name,
      types: types,
      stats: {
        hp: hp,
        attack: attack,
        defense: defense,
        speed: speed
      },
      statsSum: statsSum,
      catchRate: catchRate,
      spriteUrl: spriteUrl,
      shinySpriteUrl: shinySpriteUrl,
      fallbackSpriteUrl: fallbackSpriteUrl,
      fallbackShinySpriteUrl: fallbackShinySpriteUrl,
      evolution: evolution
    };
  });
  
  // Fetch remaining Gen 8 & 9 Pokémon from PokeAPI
  console.log('Fetching remaining Gen 8 & 9 Pokémon from PokeAPI...');
  const startId = 810;
  const endId = 1025;
  const ids = [];
  for (let id = startId; id <= endId; id++) {
    ids.push(id);
  }

  // Fetch in batches of 20
  const batchSize = 20;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    console.log(`Fetching batch: IDs ${batch[0]} to ${batch[batch.length - 1]}...`);
    await Promise.all(batch.map(async (id) => {
      try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
        if (!res.ok) {
          console.warn(`[PokeAPI] Failed to fetch ID ${id}: status ${res.status}`);
          return;
        }
        const data = await res.json();
        const name = data.name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        const types = data.types.map(t => t.type.name.toLowerCase());
        
        const hp = data.stats[0].base_stat;
        const attack = data.stats[1].base_stat;
        const defense = data.stats[2].base_stat;
        const spAttack = data.stats[3].base_stat;
        const spDefense = data.stats[4].base_stat;
        const speed = data.stats[5].base_stat;
        
        const statsSum = hp + attack + defense + speed + spAttack + spDefense;
        
        let catchRate = 0.55;
        if (statsSum >= 580) {
          catchRate = 0.04;
        } else if (statsSum >= 480) {
          catchRate = 0.12;
        } else if (statsSum >= 380) {
          catchRate = 0.22;
        } else if (statsSum >= 300) {
          catchRate = 0.35;
        }
        
        const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`;
        const shinySpriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/${id}.gif`;
        const fallbackSpriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
        const fallbackShinySpriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${id}.png`;
        
        pokemonDb[id] = {
          id: id,
          name: name,
          types: types,
          stats: {
            hp: hp,
            attack: attack,
            defense: defense,
            speed: speed
          },
          statsSum: statsSum,
          catchRate: catchRate,
          spriteUrl: spriteUrl,
          shinySpriteUrl: shinySpriteUrl,
          fallbackSpriteUrl: fallbackSpriteUrl,
          fallbackShinySpriteUrl: fallbackShinySpriteUrl,
          evolution: null
        };
      } catch (err) {
        console.error(`[PokeAPI] Error fetching ID ${id}:`, err.message);
      }
    }));
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pokemonDb, null, 2), 'utf-8');
  console.log(`Successfully generated ${OUTPUT_FILE} with ${Object.keys(pokemonDb).length} Pokémon!`);
}

run().catch(err => {
  console.error('Fatal error during seed:', err);
  process.exit(1);
});
